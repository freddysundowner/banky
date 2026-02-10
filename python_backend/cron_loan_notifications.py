#!/usr/bin/env python3
"""
Cron job script to send SMS notifications for loan instalments.
Run this script twice daily:
1. Morning run (~1 hour before business): sends "due today" reminders
2. Evening run (after business hours): sends "overdue" notices for missed payments

It checks each tenant's loans and sends:
- payment_reminder: for instalments due today (not yet paid)
- overdue_notice: for instalments that are now overdue/defaulted

Duplicate prevention: checks sms_notifications table to avoid re-sending
the same notification type for the same loan on the same day.

Usage: python cron_loan_notifications.py [due_today|overdue]
  - due_today: send reminders for instalments due today
  - overdue:   send notices for overdue/defaulted instalments
  - (no arg):  run both
"""

import os
import sys
from datetime import datetime, date
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, and_
from sqlalchemy.orm import sessionmaker, joinedload
from models.master import Organization
from models.tenant import (
    TenantBase, LoanApplication, LoanInstalment, Member,
    SMSNotification, SMSTemplate
)
from routes.sms import send_sms, process_template


def already_notified_today(tenant_session, loan_id, notification_type):
    today_start = datetime.combine(date.today(), datetime.min.time())
    existing = tenant_session.query(SMSNotification).filter(
        SMSNotification.loan_id == str(loan_id),
        SMSNotification.notification_type == notification_type,
        SMSNotification.created_at >= today_start
    ).first()
    return existing is not None


def send_with_template(tenant_session, template_type, phone, name, context,
                       member_id, loan_id, notification_type):
    template = tenant_session.query(SMSTemplate).filter(
        SMSTemplate.template_type == template_type,
        SMSTemplate.is_active == True
    ).first()

    if not template:
        print(f"    [SKIP] Template '{template_type}' not found or inactive")
        return False

    message = process_template(template.message_template, context)

    notification = SMSNotification(
        notification_type=notification_type,
        recipient_phone=phone,
        recipient_name=name,
        member_id=str(member_id),
        loan_id=str(loan_id),
        message=message,
        status="pending"
    )
    tenant_session.add(notification)

    result = send_sms(phone, message, tenant_session)
    if result.get("success"):
        notification.status = "sent"
        notification.sent_at = datetime.utcnow()
    else:
        notification.status = "failed"
        notification.error_message = result.get("error", "Failed to send")

    return result.get("success", False)


def process_due_today(tenant_session, org_name):
    today = date.today()
    sent = 0
    skipped = 0

    loans = tenant_session.query(LoanApplication).options(
        joinedload(LoanApplication.member)
    ).filter(
        LoanApplication.status == "disbursed",
        LoanApplication.outstanding_balance > 0
    ).all()

    for loan in loans:
        due_insts = tenant_session.query(LoanInstalment).filter(
            LoanInstalment.loan_id == str(loan.id),
            LoanInstalment.due_date == today,
            LoanInstalment.status.in_(["pending", "partial"])
        ).all()

        if not due_insts:
            continue

        member = loan.member
        if not member or not getattr(member, "phone", None):
            print(f"    [SKIP] {loan.application_number}: no phone number")
            skipped += 1
            continue

        if already_notified_today(tenant_session, loan.id, "due_today_reminder"):
            skipped += 1
            continue

        amount_due = sum(
            (i.expected_principal + i.expected_interest + i.expected_penalty) -
            (i.paid_principal + i.paid_interest + i.paid_penalty)
            for i in due_insts
        )

        if amount_due <= 0:
            continue

        context = {
            "name": member.first_name,
            "amount": f"{amount_due:,.2f}",
            "due_date": str(today),
            "balance": f"{loan.outstanding_balance:,.2f}"
        }

        success = send_with_template(
            tenant_session, "payment_reminder",
            member.phone, f"{member.first_name} {member.last_name}",
            context, member.id, loan.id, "due_today_reminder"
        )

        if success:
            print(f"    [SENT] {loan.application_number} -> {member.phone}: KES {amount_due:,.2f} due today")
            sent += 1
        else:
            print(f"    [FAIL] {loan.application_number} -> {member.phone}")
            skipped += 1

    tenant_session.commit()
    return sent, skipped


def process_overdue(tenant_session, org_name):
    today = date.today()
    sent = 0
    skipped = 0

    loans = tenant_session.query(LoanApplication).options(
        joinedload(LoanApplication.member)
    ).filter(
        LoanApplication.status == "disbursed",
        LoanApplication.outstanding_balance > 0,
        LoanApplication.next_payment_date < today
    ).all()

    for loan in loans:
        overdue_insts = tenant_session.query(LoanInstalment).filter(
            LoanInstalment.loan_id == str(loan.id),
            LoanInstalment.due_date < today,
            LoanInstalment.status.in_(["pending", "partial", "overdue"])
        ).all()

        if not overdue_insts:
            continue

        member = loan.member
        if not member or not getattr(member, "phone", None):
            print(f"    [SKIP] {loan.application_number}: no phone number")
            skipped += 1
            continue

        if already_notified_today(tenant_session, loan.id, "overdue_notice"):
            skipped += 1
            continue

        amount_overdue = sum(
            (i.expected_principal + i.expected_interest + i.expected_penalty) -
            (i.paid_principal + i.paid_interest + i.paid_penalty)
            for i in overdue_insts
        )

        if amount_overdue <= 0:
            continue

        earliest_overdue = min(overdue_insts, key=lambda i: i.due_date)
        days_overdue = (today - earliest_overdue.due_date).days

        context = {
            "name": member.first_name,
            "amount": f"{amount_overdue:,.2f}",
            "due_date": str(earliest_overdue.due_date),
            "balance": f"{loan.outstanding_balance:,.2f}",
            "days_overdue": str(days_overdue)
        }

        success = send_with_template(
            tenant_session, "overdue_notice",
            member.phone, f"{member.first_name} {member.last_name}",
            context, member.id, loan.id, "overdue_notice"
        )

        if success:
            print(f"    [SENT] {loan.application_number} -> {member.phone}: KES {amount_overdue:,.2f} overdue ({days_overdue}d)")
            sent += 1
        else:
            print(f"    [FAIL] {loan.application_number} -> {member.phone}")
            skipped += 1

    tenant_session.commit()
    return sent, skipped


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "both"
    if mode not in ("due_today", "overdue", "both"):
        print("Usage: python cron_loan_notifications.py [due_today|overdue|both]")
        sys.exit(1)

    print(f"=== Loan Notifications - {date.today()} (mode: {mode}) ===")

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    master_engine = create_engine(database_url)
    MasterSession = sessionmaker(bind=master_engine)
    master_session = MasterSession()

    total_sent = 0
    total_skipped = 0
    orgs_processed = 0

    try:
        orgs = master_session.query(Organization).filter(
            Organization.connection_string.isnot(None),
            Organization.is_active == True
        ).all()

        print(f"Found {len(orgs)} active organization(s)")

        for org in orgs:
            print(f"\n  [{org.name}]")
            try:
                tenant_engine = create_engine(org.connection_string)
                TenantSession = sessionmaker(bind=tenant_engine)
                tenant_session = TenantSession()

                try:
                    if mode in ("due_today", "both"):
                        sent, skipped = process_due_today(tenant_session, org.name)
                        total_sent += sent
                        total_skipped += skipped
                        print(f"    Due today: {sent} sent, {skipped} skipped")

                    if mode in ("overdue", "both"):
                        sent, skipped = process_overdue(tenant_session, org.name)
                        total_sent += sent
                        total_skipped += skipped
                        print(f"    Overdue: {sent} sent, {skipped} skipped")

                    orgs_processed += 1
                finally:
                    tenant_session.close()
                    tenant_engine.dispose()

            except Exception as e:
                print(f"    ERROR processing {org.name}: {e}")

        print(f"\n=== SUMMARY ===")
        print(f"Organizations processed: {orgs_processed}")
        print(f"SMS sent: {total_sent}")
        print(f"SMS skipped: {total_skipped}")

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        master_session.close()
        master_engine.dispose()


if __name__ == "__main__":
    main()
