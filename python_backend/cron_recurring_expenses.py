#!/usr/bin/env python3
"""
Cron job script to process recurring expenses.
Run this script daily to:
1. Find approved recurring expenses where next_due_date has arrived
2. Create new pending expense entries based on the original
3. Advance the next_due_date on the original expense

Usage: python cron_recurring_expenses.py
"""

import os
import sys
import uuid
from datetime import date, datetime
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, and_
from sqlalchemy.orm import sessionmaker
from models.master import Organization
from models.tenant import (
    TenantBase, Expense, ExpenseCategory, AuditLog
)
from services.tenant_context import TenantContext
from dateutil.relativedelta import relativedelta


INTERVAL_DELTAS = {
    "daily": relativedelta(days=1),
    "weekly": relativedelta(weeks=1),
    "monthly": relativedelta(months=1),
    "quarterly": relativedelta(months=3),
    "yearly": relativedelta(years=1),
}


def advance_due_date(current_date: date, interval: str) -> date:
    delta = INTERVAL_DELTAS.get(interval)
    if not delta:
        return current_date + relativedelta(months=1)
    return current_date + delta


def process_organization_recurring(org_id, org_name, connection_string):
    print(f"\n--- Processing recurring expenses: {org_name} ({org_id}) ---")

    try:
        tenant_ctx = TenantContext(connection_string)
        session = tenant_ctx.create_session()
    except Exception as e:
        print(f"  Error connecting to tenant database: {e}")
        return {"created": 0, "errors": 1}

    today = date.today()
    created_count = 0
    error_count = 0

    try:
        recurring_expenses = session.query(Expense).filter(
            Expense.is_recurring == True,
            Expense.status == "approved",
            Expense.next_due_date.isnot(None),
            Expense.next_due_date <= today
        ).all()

        print(f"  Found {len(recurring_expenses)} recurring expenses due")

        for parent_expense in recurring_expenses:
            try:
                new_expense = Expense(
                    id=str(uuid.uuid4()),
                    category_id=parent_expense.category_id,
                    branch_id=parent_expense.branch_id,
                    amount=parent_expense.amount,
                    expense_date=parent_expense.next_due_date,
                    description=f"[Recurring] {parent_expense.description}",
                    vendor=parent_expense.vendor,
                    payment_method=parent_expense.payment_method,
                    status="pending",
                    created_by_id=parent_expense.created_by_id,
                    created_by_admin_name=parent_expense.created_by_admin_name,
                    notes=f"Auto-generated from recurring expense on {today}",
                    is_recurring=False,
                )
                session.add(new_expense)

                old_due = parent_expense.next_due_date
                parent_expense.next_due_date = advance_due_date(
                    old_due, parent_expense.recurrence_interval or "monthly"
                )

                audit_log = AuditLog(
                    staff_id=parent_expense.created_by_id,
                    action="auto_create_recurring_expense",
                    entity_type="expense",
                    entity_id=new_expense.id,
                    new_values={
                        "parent_expense_id": parent_expense.id,
                        "amount": str(parent_expense.amount),
                        "interval": parent_expense.recurrence_interval,
                        "old_due_date": str(old_due),
                        "new_due_date": str(parent_expense.next_due_date),
                    }
                )
                session.add(audit_log)

                category = session.query(ExpenseCategory).filter(
                    ExpenseCategory.id == parent_expense.category_id
                ).first()
                cat_name = category.name if category else "Unknown"

                print(f"  [CREATED] {cat_name}: {parent_expense.amount} "
                      f"(next due: {parent_expense.next_due_date})")
                created_count += 1

            except Exception as e:
                print(f"  [ERROR] Expense {parent_expense.id}: {str(e)}")
                error_count += 1

        session.commit()
        print(f"  Summary: {created_count} created, {error_count} errors")

    except Exception as e:
        print(f"  Error processing recurring expenses: {e}")
        session.rollback()
        error_count += 1
    finally:
        session.close()
        tenant_ctx.close()

    return {"created": created_count, "errors": error_count}


def main():
    print(f"=== Recurring Expenses Processing - {date.today()} ===")

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

        total_created = 0
        total_errors = 0

        for org in organizations:
            result = process_organization_recurring(org.id, org.name, org.connection_string)
            total_created += result["created"]
            total_errors += result["errors"]

        print(f"\n=== TOTAL SUMMARY ===")
        print(f"Recurring expenses created: {total_created}")
        print(f"Errors: {total_errors}")

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        master_session.close()
        engine.dispose()


if __name__ == "__main__":
    main()
