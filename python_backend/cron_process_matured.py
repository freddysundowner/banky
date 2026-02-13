#!/usr/bin/env python3
"""
Cron job script to process matured fixed deposits.
Run this script daily to:
1. Pay out matured deposits to member savings
2. Create new deposits for auto-rollover accounts
3. Send notifications (if SMS is configured)

Usage: python cron_process_matured.py
"""

import os
import sys
import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from dateutil.relativedelta import relativedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.tenant import TenantBase, MemberFixedDeposit, FixedDepositProduct, Member, Staff, Transaction, AuditLog
from models.master import Organization
from services.tenant_context import TenantContext

def create_audit_log(session, staff_id, action, entity_type, entity_id, old_values=None, new_values=None):
    audit_log = AuditLog(
        staff_id=staff_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values
    )
    session.add(audit_log)

def process_organization_deposits(org_id, org_name, connection_string):
    """Process matured deposits for a single organization"""
    print(f"\n--- Processing organization: {org_name} ({org_id}) ---")
    
    try:
        tenant_ctx = TenantContext(connection_string)
        session = tenant_ctx.create_session()
    except Exception as e:
        print(f"  Error connecting to tenant database: {e}")
        return {"processed": 0, "rolled_over": 0, "errors": 1}
    
    today = date.today()
    processed_count = 0
    rolled_over_count = 0
    error_count = 0
    
    try:
        matured_deposits = session.query(MemberFixedDeposit).filter(
            MemberFixedDeposit.status == "active",
            MemberFixedDeposit.maturity_date <= today
        ).all()
        
        print(f"  Found {len(matured_deposits)} matured deposits")
        
        for deposit in matured_deposits:
            try:
                member = session.query(Member).filter(Member.id == deposit.member_id).first()
                product = session.query(FixedDepositProduct).filter(FixedDepositProduct.id == deposit.product_id).first()
                
                if not member or not product:
                    print(f"  [ERROR] Deposit {deposit.deposit_number}: Member or product not found")
                    error_count += 1
                    continue
                
                interest_to_pay = deposit.expected_interest
                
                if deposit.auto_rollover:
                    member.savings_balance = (member.savings_balance or Decimal("0")) + interest_to_pay
                    
                    unique_suffix = uuid.uuid4().hex[:8]
                    interest_tx = Transaction(
                        transaction_number=f"FDTXN-{unique_suffix}",
                        member_id=deposit.member_id,
                        transaction_type="deposit",
                        account_type="savings",
                        amount=interest_to_pay,
                        balance_before=member.savings_balance - interest_to_pay,
                        balance_after=member.savings_balance,
                        payment_method="transfer",
                        reference=deposit.deposit_number,
                        description=f"Fixed Deposit Interest Payout - {deposit.deposit_number} (Auto Rolled Over)"
                    )
                    session.add(interest_tx)
                    
                    deposit.status = "matured"
                    deposit.closed_date = today
                    deposit.actual_interest_paid = interest_to_pay
                    deposit.actual_amount_paid = interest_to_pay
                    deposit.notes = (deposit.notes or "") + f"\nAuto-matured and rolled over on {today}"
                    
                    new_deposit_number = f"FD-{uuid.uuid4().hex[:8]}"
                    
                    new_start_date = today
                    new_maturity_date = new_start_date + relativedelta(months=product.term_months)
                    term_years = Decimal(str(product.term_months)) / Decimal("12")
                    new_expected_interest = (deposit.principal_amount * product.interest_rate * term_years) / Decimal("100")
                    new_maturity_amount = deposit.principal_amount + new_expected_interest
                    
                    new_deposit = MemberFixedDeposit(
                        deposit_number=new_deposit_number,
                        member_id=deposit.member_id,
                        product_id=deposit.product_id,
                        principal_amount=deposit.principal_amount,
                        interest_rate=product.interest_rate,
                        term_months=product.term_months,
                        start_date=new_start_date,
                        maturity_date=new_maturity_date,
                        expected_interest=new_expected_interest,
                        maturity_amount=new_maturity_amount,
                        auto_rollover=deposit.auto_rollover,
                        rollover_count=(deposit.rollover_count or 0) + 1,
                        parent_deposit_id=deposit.id,
                        notes=f"Auto rolled over from {deposit.deposit_number}"
                    )
                    session.add(new_deposit)
                    
                    create_audit_log(
                        session,
                        staff_id=None,
                        action="auto_rollover_fixed_deposit",
                        entity_type="member_fixed_deposit",
                        entity_id=deposit.id,
                        new_values={
                            "old_deposit": deposit.deposit_number,
                            "new_deposit": new_deposit_number,
                            "interest_paid": str(interest_to_pay),
                            "principal": str(deposit.principal_amount)
                        }
                    )
                    
                    print(f"  [ROLLOVER] {deposit.deposit_number} -> {new_deposit_number} for {member.first_name} {member.last_name}, interest: {interest_to_pay}")
                    rolled_over_count += 1
                else:
                    actual_amount = deposit.principal_amount + interest_to_pay
                    
                    member.deposits_balance = (member.deposits_balance or Decimal("0")) - deposit.principal_amount
                    if member.deposits_balance < 0:
                        member.deposits_balance = Decimal("0")
                    
                    member.savings_balance = (member.savings_balance or Decimal("0")) + actual_amount
                    
                    unique_suffix = uuid.uuid4().hex[:8]
                    payout_tx = Transaction(
                        transaction_number=f"FDTXN-{unique_suffix}",
                        member_id=deposit.member_id,
                        transaction_type="deposit",
                        account_type="savings",
                        amount=actual_amount,
                        balance_before=member.savings_balance - actual_amount,
                        balance_after=member.savings_balance,
                        payment_method="transfer",
                        reference=deposit.deposit_number,
                        description=f"Fixed Deposit Auto Maturity Payout - {deposit.deposit_number}"
                    )
                    session.add(payout_tx)
                    
                    deposit.status = "matured"
                    deposit.closed_date = today
                    deposit.actual_interest_paid = interest_to_pay
                    deposit.actual_amount_paid = actual_amount
                    deposit.notes = (deposit.notes or "") + f"\nAuto-matured and paid out on {today}"
                    
                    create_audit_log(
                        session,
                        staff_id=None,
                        action="auto_mature_fixed_deposit",
                        entity_type="member_fixed_deposit",
                        entity_id=deposit.id,
                        new_values={
                            "deposit_number": deposit.deposit_number,
                            "principal": str(deposit.principal_amount),
                            "interest_paid": str(interest_to_pay),
                            "total_paid": str(actual_amount)
                        }
                    )
                    
                    print(f"  [PAYOUT] {deposit.deposit_number} for {member.first_name} {member.last_name}, total: {actual_amount}")
                    processed_count += 1
                
            except Exception as e:
                print(f"  [ERROR] Deposit {deposit.id}: {str(e)}")
                error_count += 1
        
        session.commit()
        print(f"  Summary: {processed_count} paid out, {rolled_over_count} rolled over, {error_count} errors")
        
    except Exception as e:
        print(f"  Error processing deposits: {e}")
        session.rollback()
        error_count += 1
    finally:
        session.close()
        tenant_ctx.close()
    
    return {"processed": processed_count, "rolled_over": rolled_over_count, "errors": error_count}

def main():
    print(f"=== Fixed Deposit Maturity Processing - {date.today()} ===")
    
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
        
        total_processed = 0
        total_rolled_over = 0
        total_errors = 0
        
        for org in organizations:
            result = process_organization_deposits(org.id, org.name, org.connection_string)
            total_processed += result["processed"]
            total_rolled_over += result["rolled_over"]
            total_errors += result["errors"]
        
        print(f"\n=== TOTAL SUMMARY ===")
        print(f"Deposits paid out: {total_processed}")
        print(f"Deposits rolled over: {total_rolled_over}")
        print(f"Errors: {total_errors}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        master_session.close()

if __name__ == "__main__":
    main()
