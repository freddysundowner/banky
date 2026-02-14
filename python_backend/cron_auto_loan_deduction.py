#!/usr/bin/env python3
"""
Cron job script to auto-deduct loan repayments from member savings accounts.
Runs daily. For each active organization with auto_loan_deduction enabled,
finds due/overdue loan instalments and deducts from member savings.

Usage: python cron_auto_loan_deduction.py
"""

import os
import sys
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.tenant import (
    TenantBase, LoanApplication, LoanInstalment, LoanRepayment,
    Member, Transaction, OrganizationSettings, AuditLog, LoanDefault, LoanProduct
)
from models.master import Organization
from services.tenant_context import TenantContext
from services.code_generator import generate_txn_code, generate_repayment_code


def get_setting(session, key, default=None):
    setting = session.query(OrganizationSettings).filter(
        OrganizationSettings.setting_key == key
    ).first()
    if setting:
        return setting.setting_value
    return default


def process_auto_deductions(org_id, org_name, connection_string, force=False):
    """Process auto loan deductions for a single organization. If force=True, skip time and already-ran checks."""
    print(f"\n--- Processing organization: {org_name} ({org_id}) ---")

    try:
        tenant_ctx = TenantContext(connection_string)
        session = tenant_ctx.create_session()
    except Exception as e:
        print(f"  Error connecting to tenant database: {e}")
        return {"deducted": 0, "skipped": 0, "errors": 0}

    deducted_count = 0
    skipped_count = 0
    error_count = 0

    try:
        enabled = get_setting(session, "auto_loan_deduction", "false")
        if enabled.lower() != "true":
            print(f"  Auto loan deduction is disabled for this organization")
            return {"deducted": 0, "skipped": 0, "errors": 0}

        run_time = get_setting(session, "auto_loan_deduction_time", "06:00")
        try:
            run_hour, run_minute = map(int, run_time.split(":"))
        except (ValueError, AttributeError):
            run_hour, run_minute = 6, 0

        now = datetime.utcnow()
        tz_offset_str = get_setting(session, "timezone", "Africa/Nairobi")
        try:
            import zoneinfo
            tz = zoneinfo.ZoneInfo(tz_offset_str)
            local_now = now.replace(tzinfo=zoneinfo.ZoneInfo("UTC")).astimezone(tz)
        except Exception:
            local_now = now

        local_today = local_now.date()
        current_hour = local_now.hour
        current_minute = local_now.minute
        current_total = current_hour * 60 + current_minute
        scheduled_total = run_hour * 60 + run_minute

        if not force and current_total < scheduled_total:
            print(f"  Not yet time to run (scheduled at {run_time}, current local time {local_now.strftime('%H:%M')})")
            return {"deducted": 0, "skipped": 0, "errors": 0}

        last_run = get_setting(session, "auto_loan_deduction_last_run", "")
        today_str = str(local_today)
        if not force and last_run == today_str:
            print(f"  Already ran today ({today_str})")
            return {"deducted": 0, "skipped": 0, "errors": 0}

        due_instalments = session.query(LoanInstalment).join(
            LoanApplication, LoanInstalment.loan_id == LoanApplication.id
        ).filter(
            LoanApplication.status.in_(["disbursed", "defaulted"]),
            LoanInstalment.status.in_(["pending", "partial", "overdue"]),
            LoanInstalment.due_date <= local_today
        ).order_by(
            LoanInstalment.due_date.asc()
        ).all()

        print(f"  Found {len(due_instalments)} due instalments")

        loan_instalments_map = {}
        for inst in due_instalments:
            loan_instalments_map.setdefault(inst.loan_id, []).append(inst)

        from services.instalment_service import allocate_payment_to_instalments

        for loan_id, instalments in loan_instalments_map.items():
            try:
                loan = session.query(LoanApplication).filter(
                    LoanApplication.id == loan_id
                ).first()
                if not loan or loan.status not in ("disbursed", "defaulted"):
                    continue

                member = session.query(Member).filter(
                    Member.id == loan.member_id
                ).first()
                if not member:
                    continue

                savings = member.savings_balance or Decimal("0")
                if savings <= 0:
                    print(f"  Skipping loan {loan.application_number} for {member.first_name} {member.last_name}: insufficient savings (KES {savings})")
                    skipped_count += 1
                    continue

                total_due_for_loan = Decimal("0")
                for inst in instalments:
                    inst_remaining = (
                        (inst.expected_principal or Decimal("0")) - (inst.paid_principal or Decimal("0")) +
                        (inst.expected_interest or Decimal("0")) - (inst.paid_interest or Decimal("0")) +
                        (inst.expected_penalty or Decimal("0")) - (inst.paid_penalty or Decimal("0"))
                    )
                    if inst_remaining > 0:
                        total_due_for_loan += inst_remaining

                if total_due_for_loan <= 0:
                    continue

                deduction_amount = min(savings, total_due_for_loan)

                savings_before = member.savings_balance or Decimal("0")

                principal_amount, interest_amount, penalty_amount, insurance_amount, overpayment = allocate_payment_to_instalments(
                    session, loan, deduction_amount
                )

                actual_payment = principal_amount + interest_amount + penalty_amount + insurance_amount
                if actual_payment <= 0:
                    continue

                member.savings_balance = savings_before - actual_payment

                code = generate_repayment_code()
                auto_ref = f"AUTO-{local_today.strftime('%Y%m%d')}-{loan.application_number}"

                instalments_covered = len([i for i in instalments if i.status == "paid"])

                repayment = LoanRepayment(
                    repayment_number=code,
                    loan_id=str(loan.id),
                    amount=actual_payment,
                    principal_amount=principal_amount,
                    interest_amount=interest_amount,
                    penalty_amount=penalty_amount,
                    payment_method="auto_deduction",
                    reference=auto_ref,
                    notes=f"Auto-deducted from savings on {local_today} covering {instalments_covered} instalment(s)",
                    payment_date=datetime.utcnow()
                )

                loan.amount_repaid = (loan.amount_repaid or Decimal("0")) + actual_payment
                loan.outstanding_balance = (loan.outstanding_balance or Decimal("0")) - actual_payment
                loan.last_payment_date = local_today

                withdrawal_txn = Transaction(
                    transaction_number=generate_txn_code(),
                    member_id=str(member.id),
                    transaction_type="withdrawal",
                    account_type="savings",
                    amount=actual_payment,
                    balance_before=savings_before,
                    balance_after=member.savings_balance,
                    payment_method="auto_deduction",
                    reference=auto_ref,
                    description=f"Auto loan deduction for {loan.application_number} ({instalments_covered} instalment(s))"
                )

                repayment_txn = Transaction(
                    transaction_number=generate_txn_code(),
                    member_id=str(member.id),
                    transaction_type="loan_repayment",
                    account_type="loan",
                    amount=actual_payment,
                    reference=auto_ref,
                    description=f"Auto loan repayment for {loan.application_number} ({instalments_covered} instalment(s))"
                )

                session.add(repayment)
                session.add(withdrawal_txn)
                session.add(repayment_txn)

                next_inst = session.query(LoanInstalment).filter(
                    LoanInstalment.loan_id == str(loan.id),
                    LoanInstalment.status.in_(["pending", "partial", "overdue"])
                ).order_by(LoanInstalment.instalment_number).first()
                if next_inst:
                    loan.next_payment_date = next_inst.due_date

                if loan.outstanding_balance is not None and loan.outstanding_balance <= 0:
                    loan.status = "paid"
                    loan.closed_at = datetime.utcnow()
                    loan.outstanding_balance = Decimal("0")
                    session.query(LoanDefault).filter(
                        LoanDefault.loan_id == str(loan.id),
                        LoanDefault.status.in_(["overdue", "in_collection"])
                    ).update({"status": "resolved", "resolved_at": datetime.utcnow()}, synchronize_session="fetch")
                elif loan.status == "defaulted":
                    overdue_remaining = session.query(LoanInstalment).filter(
                        LoanInstalment.loan_id == str(loan.id),
                        LoanInstalment.status.in_(["overdue", "partial"]),
                        LoanInstalment.due_date <= local_today
                    ).count()
                    if overdue_remaining == 0:
                        loan.status = "disbursed"
                        session.query(LoanDefault).filter(
                            LoanDefault.loan_id == str(loan.id),
                            LoanDefault.status.in_(["overdue", "in_collection"])
                        ).update({"status": "resolved", "resolved_at": datetime.utcnow()}, synchronize_session="fetch")
                        print(f"  Loan {loan.application_number} restored from defaulted to active (all overdue instalments cleared)")

                audit_log = AuditLog(
                    staff_id=None,
                    action="auto_loan_deduction",
                    entity_type="loan_repayment",
                    entity_id=str(loan.id),
                    old_values={"savings_balance": str(savings_before)},
                    new_values={
                        "deducted_amount": str(actual_payment),
                        "instalments_covered": instalments_covered,
                        "savings_balance_after": str(member.savings_balance),
                        "loan_outstanding": str(loan.outstanding_balance),
                    }
                )
                session.add(audit_log)

                session.commit()

                try:
                    from routes.repayments import post_repayment_to_gl
                    post_repayment_to_gl(session, repayment, loan, member)
                except Exception as gl_err:
                    print(f"  [GL] Warning: Failed to post GL entry for {repayment.repayment_number}: {gl_err}")

                try:
                    from routes.repayments import try_send_sms
                    if member.phone:
                        sms_vars = {
                            "name": member.first_name,
                            "amount": str(actual_payment),
                            "balance": str(loan.outstanding_balance or 0)
                        }
                        try_send_sms(
                            session,
                            "repayment_received",
                            member.phone,
                            f"{member.first_name} {member.last_name}",
                            sms_vars,
                            member_id=str(member.id),
                            loan_id=str(loan.id)
                        )
                except Exception as sms_err:
                    print(f"  [SMS] Warning: Failed to send SMS: {sms_err}")

                print(f"  Deducted KES {total_deducted_for_loan} from {member.first_name} {member.last_name} savings for {instalments_paid} instalment(s) on loan {loan.application_number}")
                deducted_count += 1

            except Exception as e:
                session.rollback()
                print(f"  Error processing loan {loan_id}: {e}")
                import traceback
                traceback.print_exc()
                error_count += 1

        last_run_setting = session.query(OrganizationSettings).filter(
            OrganizationSettings.setting_key == "auto_loan_deduction_last_run"
        ).first()
        if last_run_setting:
            last_run_setting.setting_value = today_str
        else:
            last_run_setting = OrganizationSettings(
                setting_key="auto_loan_deduction_last_run",
                setting_value=today_str
            )
            session.add(last_run_setting)
        session.commit()
        print(f"  Marked as run for {today_str}")

    except Exception as e:
        print(f"  Error: {e}")
        import traceback
        traceback.print_exc()
        error_count += 1
    finally:
        session.close()
        tenant_ctx.close()

    return {"deducted": deducted_count, "skipped": skipped_count, "errors": error_count}


def main():
    print(f"=== Auto Loan Deduction from Savings - {date.today()} ===")

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    master_session = Session()

    try:
        organizations = master_session.query(Organization).filter(
            Organization.is_active == True,
            Organization.connection_string.isnot(None)
        ).all()

        print(f"Found {len(organizations)} active organizations")

        total_deducted = 0
        total_skipped = 0
        total_errors = 0

        for org in organizations:
            result = process_auto_deductions(org.id, org.name, org.connection_string)
            total_deducted += result["deducted"]
            total_skipped += result["skipped"]
            total_errors += result["errors"]

        print(f"\n=== TOTAL SUMMARY ===")
        print(f"Loans auto-deducted: {total_deducted}")
        print(f"Loans skipped (insufficient savings): {total_skipped}")
        print(f"Errors: {total_errors}")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        master_session.close()


if __name__ == "__main__":
    main()
