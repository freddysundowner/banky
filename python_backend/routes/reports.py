import csv
import io
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, case
from decimal import Decimal
from datetime import date, timedelta
from models.database import get_db
from models.tenant import (
    Member, LoanApplication, LoanRepayment, Transaction,
    LoanExtraCharge, Expense, ExpenseCategory,
    MemberFixedDeposit, FixedDepositProduct, LoanInstalment,
)
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission

ACTIVE_LOAN_STATUSES = ["disbursed", "defaulted", "restructured"]
EVER_APPROVED_STATUSES = ["approved", "disbursed", "paid", "defaulted", "completed", "restructured", "written_off"]
EVER_DISBURSED_STATUSES = ["disbursed", "paid", "defaulted", "completed", "restructured", "written_off"]

router = APIRouter()


def _dec(value) -> float:
    return float(value or 0)


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _loan_dict(loan) -> dict:
    return {
        "application_number": loan.application_number,
        "member_name": f"{loan.member.first_name} {loan.member.last_name}" if loan.member else None,
        "amount": _dec(loan.amount),
        "status": loan.status,
        "applied_at": _iso(loan.applied_at),
        "disbursed_at": _iso(loan.disbursed_at),
        "outstanding": _dec(loan.outstanding_balance),
        "interest_deducted_upfront": getattr(loan, 'interest_deducted_upfront', False),
    }


def _fixed_deposit_dict(fd, product_name=None) -> dict:
    return {
        "deposit_number": fd.deposit_number,
        "product_name": product_name or "Unknown",
        "principal_amount": _dec(fd.principal_amount),
        "interest_rate": _dec(fd.interest_rate),
        "term_months": fd.term_months,
        "start_date": _iso(fd.start_date),
        "maturity_date": _iso(fd.maturity_date),
        "expected_interest": _dec(fd.expected_interest),
        "maturity_amount": _dec(fd.maturity_amount),
        "actual_amount_paid": _dec(fd.actual_amount_paid) if fd.actual_amount_paid else None,
        "status": fd.status,
        "early_withdrawal": fd.early_withdrawal,
        "penalty_amount": _dec(fd.penalty_amount),
    }


def _apply_branch_filter(query, branch_id, model=Member):
    if branch_id:
        if model == Member:
            return query.filter(Member.branch_id == branch_id)
        return query.join(Member).filter(Member.branch_id == branch_id)
    return query


@router.get("/{org_id}/reports/member-search")
async def search_members(
    org_id: str,
    query: str = "",
    limit: int = 20,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        if not query or len(query.strip()) == 0:
            return []
        search_term = f"%{query.strip()}%"
        results = tenant_session.query(
            Member.id,
            Member.member_number,
            Member.first_name,
            Member.last_name,
        ).filter(
            or_(
                Member.member_number.ilike(search_term),
                Member.first_name.ilike(search_term),
                Member.last_name.ilike(search_term),
            )
        ).limit(limit).all()
        return [
            {"id": r.id, "member_number": r.member_number, "first_name": r.first_name, "last_name": r.last_name}
            for r in results
        ]
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/reports/member-statement/{member_id}")
async def get_member_statement(
    org_id: str,
    member_id: str,
    start_date: date = None,
    end_date: date = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

        if not start_date:
            start_date = date.today() - timedelta(days=365)
        if not end_date:
            end_date = date.today()

        transactions = tenant_session.query(Transaction).filter(
            Transaction.member_id == member_id,
            func.date(Transaction.created_at) >= start_date,
            func.date(Transaction.created_at) <= end_date,
        ).order_by(Transaction.created_at).all()

        loans = tenant_session.query(LoanApplication).filter(
            LoanApplication.member_id == member_id
        ).all()

        active_loans = [l for l in loans if l.status in ACTIVE_LOAN_STATUSES]

        fixed_deposits = tenant_session.query(
            MemberFixedDeposit, FixedDepositProduct.name
        ).join(
            FixedDepositProduct, MemberFixedDeposit.product_id == FixedDepositProduct.id
        ).filter(
            MemberFixedDeposit.member_id == member_id
        ).order_by(MemberFixedDeposit.created_at.desc()).all()

        return {
            "member": {
                "id": member.id,
                "member_number": member.member_number,
                "name": f"{member.first_name} {member.last_name}",
                "phone": member.phone,
                "email": member.email,
            },
            "period": {
                "start_date": _iso(start_date),
                "end_date": _iso(end_date),
            },
            "balances": {
                "savings": _dec(member.savings_balance),
                "shares": _dec(member.shares_balance),
                "deposits": _dec(member.deposits_balance),
                "total_loan_outstanding": _dec(sum(l.outstanding_balance or Decimal("0") for l in active_loans)),
            },
            "transactions": [
                {
                    "date": t.created_at.isoformat(),
                    "type": t.transaction_type,
                    "account": t.account_type,
                    "amount": _dec(t.amount),
                    "balance_after": _dec(t.balance_after),
                    "reference": t.reference,
                    "description": t.description,
                }
                for t in transactions
            ],
            "loans_summary": [
                {
                    "loan_number": l.application_number,
                    "amount": _dec(l.amount),
                    "status": l.status,
                    "outstanding": _dec(l.outstanding_balance),
                    "disbursed_at": _iso(l.disbursed_at),
                    "interest_deducted_upfront": getattr(l, 'interest_deducted_upfront', False),
                }
                for l in loans
            ],
            "fixed_deposits": [_fixed_deposit_dict(fd, pname) for fd, pname in fixed_deposits],
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/reports/fixed-deposits")
async def get_fixed_deposits_report(
    org_id: str,
    status: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(
            MemberFixedDeposit,
            Member.member_number,
            Member.first_name,
            Member.last_name,
            FixedDepositProduct.name.label("product_name"),
        ).join(
            Member, MemberFixedDeposit.member_id == Member.id
        ).join(
            FixedDepositProduct, MemberFixedDeposit.product_id == FixedDepositProduct.id
        )

        if status:
            query = query.filter(MemberFixedDeposit.status == status)

        results = query.order_by(MemberFixedDeposit.created_at.desc()).all()

        total_principal = Decimal("0")
        total_expected_interest = Decimal("0")
        total_paid = Decimal("0")
        active_count = 0
        matured_count = 0
        closed_count = 0

        report_data = []
        for fd, member_number, first_name, last_name, product_name in results:
            if fd.status == "active":
                active_count += 1
                total_principal += fd.principal_amount
                total_expected_interest += fd.expected_interest
            elif fd.status == "matured":
                matured_count += 1
            elif fd.status == "closed":
                closed_count += 1
                if fd.actual_amount_paid:
                    total_paid += fd.actual_amount_paid

            entry = _fixed_deposit_dict(fd, product_name)
            entry["member_number"] = member_number
            entry["member_name"] = f"{first_name} {last_name}"
            report_data.append(entry)

        return {
            "summary": {
                "total_deposits": len(results),
                "active_count": active_count,
                "matured_count": matured_count,
                "closed_count": closed_count,
                "total_principal_active": _dec(total_principal),
                "total_expected_interest": _dec(total_expected_interest),
                "total_amount_paid": _dec(total_paid),
            },
            "deposits": report_data,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/reports/loans")
async def get_loan_report(
    org_id: str,
    start_date: date = None,
    end_date: date = None,
    status: str = None,
    branch_id: str = None,
    page: int = 1,
    page_size: int = 50,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        base_query = tenant_session.query(LoanApplication)

        if start_date:
            base_query = base_query.filter(func.date(LoanApplication.applied_at) >= start_date)
        if end_date:
            base_query = base_query.filter(func.date(LoanApplication.applied_at) <= end_date)
        if status:
            base_query = base_query.filter(LoanApplication.status == status)
        if branch_id:
            base_query = base_query.join(Member).filter(Member.branch_id == branch_id)

        loans = base_query.all()

        total_applied = sum(l.amount for l in loans)
        total_approved = sum(l.amount for l in loans if l.status in EVER_APPROVED_STATUSES)
        total_disbursed = sum(l.amount_disbursed or Decimal("0") for l in loans if l.status in EVER_DISBURSED_STATUSES)
        total_outstanding = sum(l.outstanding_balance or Decimal("0") for l in loans if l.status in ACTIVE_LOAN_STATUSES)
        total_repaid = sum(l.amount_repaid or Decimal("0") for l in loans)

        by_status = {}
        for l in loans:
            by_status[l.status] = by_status.get(l.status, 0) + 1

        approved_count = sum(1 for l in loans if l.status in EVER_APPROVED_STATUSES)

        total = len(loans)
        total_pages = max(1, math.ceil(total / page_size))
        offset = (page - 1) * page_size
        page_items = loans[offset:offset + page_size]

        return {
            "period": {
                "start_date": _iso(start_date),
                "end_date": _iso(end_date),
            },
            "summary": {
                "total_applications": total,
                "total_applied_amount": _dec(total_applied),
                "total_approved_amount": _dec(total_approved),
                "total_disbursed_amount": _dec(total_disbursed),
                "total_outstanding": _dec(total_outstanding),
                "total_repaid": _dec(total_repaid),
                "approval_rate": (approved_count / total * 100) if total else 0,
            },
            "by_status": by_status,
            "loans": {
                "items": [_loan_dict(l) for l in page_items],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages,
                },
            },
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/reports/financial-summary")
async def get_financial_summary(
    org_id: str,
    start_date: date = None,
    end_date: date = None,
    branch_id: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        if not start_date:
            start_date = date.today().replace(day=1)
        if not end_date:
            end_date = date.today()

        member_agg_query = tenant_session.query(
            func.coalesce(func.sum(Member.savings_balance), 0),
            func.coalesce(func.sum(Member.shares_balance), 0),
            func.coalesce(func.sum(Member.deposits_balance), 0),
            func.count(Member.id),
        )
        if branch_id:
            member_agg_query = member_agg_query.filter(Member.branch_id == branch_id)
        total_savings, total_shares, total_deposits, member_count = member_agg_query.first()

        loan_agg_query = tenant_session.query(
            func.coalesce(func.sum(
                case(
                    (LoanApplication.status.in_(ACTIVE_LOAN_STATUSES), LoanApplication.outstanding_balance),
                    else_=0,
                )
            ), 0),
            func.count(case((LoanApplication.status.in_(ACTIVE_LOAN_STATUSES), LoanApplication.id))),
        )
        if branch_id:
            loan_agg_query = loan_agg_query.join(Member).filter(Member.branch_id == branch_id)
        total_loan_portfolio, active_loan_count = loan_agg_query.first()

        txn_agg = tenant_session.query(
            func.coalesce(func.sum(case((Transaction.transaction_type == "deposit", Transaction.amount), else_=0)), 0),
            func.coalesce(func.sum(case((Transaction.transaction_type == "withdrawal", Transaction.amount), else_=0)), 0),
        ).filter(
            func.date(Transaction.created_at) >= start_date,
            func.date(Transaction.created_at) <= end_date,
        ).first()
        total_deposits_period, total_withdrawals_period = txn_agg

        repayment_agg = tenant_session.query(
            func.coalesce(func.sum(LoanRepayment.principal_amount), 0),
            func.coalesce(func.sum(LoanRepayment.interest_amount), 0),
            func.coalesce(func.sum(LoanRepayment.penalty_amount), 0),
        ).filter(
            func.date(LoanRepayment.payment_date) >= start_date,
            func.date(LoanRepayment.payment_date) <= end_date,
        ).first()
        total_principal_collected, total_interest_income, total_penalty_income = repayment_agg
        total_collections = _dec(total_principal_collected) + _dec(total_interest_income) + _dec(total_penalty_income)

        disbursement_agg = tenant_session.query(
            func.coalesce(func.sum(LoanApplication.amount_disbursed), 0),
        ).filter(
            func.date(LoanApplication.disbursed_at) >= start_date,
            func.date(LoanApplication.disbursed_at) <= end_date,
            LoanApplication.disbursed_at.isnot(None),
        ).scalar()

        return {
            "period": {
                "start_date": _iso(start_date),
                "end_date": _iso(end_date),
            },
            "member_deposits": {
                "total_savings": _dec(total_savings),
                "total_shares": _dec(total_shares),
                "total_deposits": _dec(total_deposits),
                "total_member_funds": _dec(total_savings) + _dec(total_shares) + _dec(total_deposits),
            },
            "loan_portfolio": {
                "total_outstanding": _dec(total_loan_portfolio),
                "active_loans": int(active_loan_count or 0),
            },
            "period_activity": {
                "deposits_received": _dec(total_deposits_period),
                "withdrawals_made": _dec(total_withdrawals_period),
                "net_deposits": _dec(total_deposits_period) - _dec(total_withdrawals_period),
                "loans_disbursed": _dec(disbursement_agg),
                "loan_collections": total_collections,
                "interest_income": _dec(total_interest_income),
                "penalty_income": _dec(total_penalty_income),
                "total_income": _dec(total_interest_income) + _dec(total_penalty_income),
            },
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/reports/profit-loss")
async def get_profit_loss_report(
    org_id: str,
    start_date: date = None,
    end_date: date = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        if not start_date:
            start_date = date.today().replace(day=1)
        if not end_date:
            end_date = date.today()

        repayments = tenant_session.query(LoanRepayment).filter(
            func.date(LoanRepayment.payment_date) >= start_date,
            func.date(LoanRepayment.payment_date) <= end_date,
        ).all()

        repayment_interest = sum(r.interest_amount or Decimal("0") for r in repayments)
        penalty_income = sum(r.penalty_amount or Decimal("0") for r in repayments)

        disbursements = tenant_session.query(LoanApplication).filter(
            func.date(LoanApplication.disbursed_at) >= start_date,
            func.date(LoanApplication.disbursed_at) <= end_date,
            LoanApplication.disbursed_at.isnot(None),
        ).all()

        upfront_interest = sum(
            l.total_interest or Decimal("0")
            for l in disbursements
            if getattr(l, 'interest_deducted_upfront', False)
        )
        interest_income = repayment_interest + upfront_interest

        processing_fee_income = sum(l.processing_fee or Decimal("0") for l in disbursements)
        insurance_fee_income = sum(l.insurance_fee or Decimal("0") for l in disbursements)

        disbursed_loan_ids = [str(l.id) for l in disbursements]
        extra_charges_income = Decimal("0")
        if disbursed_loan_ids:
            extra_charges = tenant_session.query(LoanExtraCharge).filter(
                LoanExtraCharge.loan_id.in_(disbursed_loan_ids)
            ).all()
            extra_charges_income = sum(c.amount or Decimal("0") for c in extra_charges)

        total_income = interest_income + penalty_income + processing_fee_income + insurance_fee_income + extra_charges_income

        expense_rows = tenant_session.query(
            func.coalesce(ExpenseCategory.name, "Uncategorized").label("category_name"),
            func.sum(Expense.amount).label("total_amount"),
        ).outerjoin(
            ExpenseCategory, Expense.category_id == ExpenseCategory.id
        ).filter(
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
            Expense.status == "approved",
        ).group_by(ExpenseCategory.name).all()

        expense_by_category = {row.category_name: _dec(row.total_amount) for row in expense_rows}
        total_expenses = sum(expense_by_category.values())

        return {
            "period": {
                "start_date": _iso(start_date),
                "end_date": _iso(end_date),
            },
            "income": {
                "interest_income": _dec(interest_income),
                "penalty_income": _dec(penalty_income),
                "processing_fees": _dec(processing_fee_income),
                "insurance_fees": _dec(insurance_fee_income),
                "extra_charges": _dec(extra_charges_income),
                "total_income": _dec(total_income),
            },
            "expenses": {
                "categories": expense_by_category,
                "total_expenses": total_expenses,
            },
            "net_profit": _dec(total_income) - total_expenses,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/reports/aging")
async def get_aging_report(
    org_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        today = date.today()

        loans = tenant_session.query(LoanApplication).filter(
            LoanApplication.status.in_(ACTIVE_LOAN_STATUSES),
            LoanApplication.outstanding_balance > 0,
        ).all()

        loan_ids = [l.id for l in loans]
        earliest_overdue = {}
        if loan_ids:
            overdue_rows = tenant_session.query(
                LoanInstalment.loan_id,
                func.min(LoanInstalment.due_date).label("earliest_due"),
            ).filter(
                LoanInstalment.loan_id.in_(loan_ids),
                LoanInstalment.status.in_(["pending", "partial"]),
                LoanInstalment.due_date < today,
            ).group_by(LoanInstalment.loan_id).all()
            earliest_overdue = {row.loan_id: row.earliest_due for row in overdue_rows}

        aging_buckets = {
            "current": [],
            "1_30_days": [],
            "31_60_days": [],
            "61_90_days": [],
            "over_90_days": [],
        }

        for loan in loans:
            overdue_date = earliest_overdue.get(loan.id) or loan.next_payment_date
            if not overdue_date or overdue_date >= today:
                aging_buckets["current"].append(loan)
            else:
                days_overdue = (today - overdue_date).days
                if days_overdue <= 30:
                    aging_buckets["1_30_days"].append(loan)
                elif days_overdue <= 60:
                    aging_buckets["31_60_days"].append(loan)
                elif days_overdue <= 90:
                    aging_buckets["61_90_days"].append(loan)
                else:
                    aging_buckets["over_90_days"].append(loan)

        return {
            "as_of_date": _iso(today),
            "summary": {
                bucket: {
                    "count": len(loans_list),
                    "total_outstanding": _dec(sum(l.outstanding_balance or Decimal("0") for l in loans_list)),
                }
                for bucket, loans_list in aging_buckets.items()
            },
            "total_portfolio": {
                "count": len(loans),
                "total_outstanding": _dec(sum(l.outstanding_balance or Decimal("0") for l in loans)),
            },
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/reports/export")
async def export_report(
    org_id: str,
    report_type: str = Query(..., description="One of: loans, aging, summary, pnl, members"),
    start_date: date = None,
    end_date: date = None,
    branch_id: str = None,
    status: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        output = io.StringIO()
        writer = csv.writer(output)
        filename = f"{report_type}_report.csv"

        if report_type == "loans":
            writer.writerow(["Application Number", "Member Name", "Amount", "Status", "Applied At", "Disbursed At", "Outstanding"])
            loan_query = tenant_session.query(LoanApplication)
            if start_date:
                loan_query = loan_query.filter(func.date(LoanApplication.applied_at) >= start_date)
            if end_date:
                loan_query = loan_query.filter(func.date(LoanApplication.applied_at) <= end_date)
            if status:
                loan_query = loan_query.filter(LoanApplication.status == status)
            if branch_id:
                loan_query = loan_query.join(Member).filter(Member.branch_id == branch_id)
            loans = loan_query.all()
            for l in loans:
                member_name = f"{l.member.first_name} {l.member.last_name}" if l.member else ""
                writer.writerow([l.application_number, member_name, _dec(l.amount), l.status, _iso(l.applied_at), _iso(l.disbursed_at), _dec(l.outstanding_balance)])

        elif report_type == "aging":
            writer.writerow(["Application Number", "Member Name", "Outstanding Balance", "Status", "Next Payment Date"])
            loans = tenant_session.query(LoanApplication).filter(
                LoanApplication.status.in_(ACTIVE_LOAN_STATUSES),
                LoanApplication.outstanding_balance > 0,
            ).all()
            for l in loans:
                member_name = f"{l.member.first_name} {l.member.last_name}" if l.member else ""
                writer.writerow([l.application_number, member_name, _dec(l.outstanding_balance), l.status, _iso(l.next_payment_date)])

        elif report_type == "summary":
            writer.writerow(["Metric", "Value"])
            agg = tenant_session.query(
                func.coalesce(func.sum(Member.savings_balance), 0),
                func.coalesce(func.sum(Member.shares_balance), 0),
                func.coalesce(func.sum(Member.deposits_balance), 0),
                func.count(Member.id),
            ).first()
            writer.writerow(["Total Members", int(agg[3])])
            writer.writerow(["Total Savings", _dec(agg[0])])
            writer.writerow(["Total Shares", _dec(agg[1])])
            writer.writerow(["Total Deposits", _dec(agg[2])])

        elif report_type == "pnl":
            writer.writerow(["Category", "Amount"])
            today = date.today()
            period_start = today.replace(day=1)
            repayment_agg = tenant_session.query(
                func.coalesce(func.sum(LoanRepayment.interest_amount), 0),
                func.coalesce(func.sum(LoanRepayment.penalty_amount), 0),
            ).filter(
                func.date(LoanRepayment.payment_date) >= period_start,
                func.date(LoanRepayment.payment_date) <= today,
            ).first()
            writer.writerow(["Interest Income", _dec(repayment_agg[0])])
            writer.writerow(["Penalty Income", _dec(repayment_agg[1])])
            expense_total = tenant_session.query(
                func.coalesce(func.sum(Expense.amount), 0)
            ).filter(
                Expense.expense_date >= period_start,
                Expense.expense_date <= today,
                Expense.status == "approved",
            ).scalar()
            writer.writerow(["Total Expenses", _dec(expense_total)])
            writer.writerow(["Net Profit", _dec(repayment_agg[0]) + _dec(repayment_agg[1]) - _dec(expense_total)])

        elif report_type == "members":
            writer.writerow(["Member Number", "First Name", "Last Name", "Phone", "Email", "Savings", "Shares", "Deposits", "Status"])
            members = tenant_session.query(Member).order_by(Member.member_number).all()
            for m in members:
                writer.writerow([m.member_number, m.first_name, m.last_name, m.phone, m.email, _dec(m.savings_balance), _dec(m.shares_balance), _dec(m.deposits_balance), m.status])

        else:
            raise HTTPException(status_code=400, detail=f"Invalid report_type: {report_type}. Must be one of: loans, aging, summary, pnl, members")

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    finally:
        tenant_session.close()
        tenant_ctx.close()
