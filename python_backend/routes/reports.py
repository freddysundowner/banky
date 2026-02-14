from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from decimal import Decimal
from datetime import datetime, date, timedelta
from models.database import get_db
from models.tenant import Member, LoanApplication, LoanRepayment, Transaction, Branch, Staff, LoanDefault, MemberFixedDeposit, FixedDepositProduct, LoanExtraCharge, Expense, ExpenseCategory
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission

router = APIRouter()

@router.get("/{org_id}/reports/member-statement/{member_id}")
async def get_member_statement(
    org_id: str, 
    member_id: str, 
    start_date: date = None, 
    end_date: date = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
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
            func.date(Transaction.created_at) <= end_date
        ).order_by(Transaction.created_at).all()
        
        loans = tenant_session.query(LoanApplication).filter(
            LoanApplication.member_id == member_id
        ).all()
        
        active_loans = [l for l in loans if l.status in ["disbursed", "defaulted", "restructured"]]
        
        fixed_deposits = tenant_session.query(MemberFixedDeposit).filter(
            MemberFixedDeposit.member_id == member_id
        ).order_by(MemberFixedDeposit.created_at.desc()).all()
        
        fixed_deposit_data = []
        for fd in fixed_deposits:
            product = tenant_session.query(FixedDepositProduct).filter(FixedDepositProduct.id == fd.product_id).first()
            fixed_deposit_data.append({
                "deposit_number": fd.deposit_number,
                "product_name": product.name if product else "Unknown",
                "principal_amount": float(fd.principal_amount),
                "interest_rate": float(fd.interest_rate),
                "term_months": fd.term_months,
                "start_date": fd.start_date.isoformat() if fd.start_date else None,
                "maturity_date": fd.maturity_date.isoformat() if fd.maturity_date else None,
                "expected_interest": float(fd.expected_interest),
                "maturity_amount": float(fd.maturity_amount),
                "actual_amount_paid": float(fd.actual_amount_paid) if fd.actual_amount_paid else None,
                "status": fd.status,
                "early_withdrawal": fd.early_withdrawal,
                "penalty_amount": float(fd.penalty_amount or 0)
            })
        
        return {
            "member": {
                "id": member.id,
                "member_number": member.member_number,
                "name": f"{member.first_name} {member.last_name}",
                "phone": member.phone,
                "email": member.email
            },
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "balances": {
                "savings": float(member.savings_balance or 0),
                "shares": float(member.shares_balance or 0),
                "deposits": float(member.deposits_balance or 0),
                "total_loan_outstanding": float(sum(l.outstanding_balance or Decimal("0") for l in active_loans))
            },
            "transactions": [
                {
                    "date": t.created_at.isoformat(),
                    "type": t.transaction_type,
                    "account": t.account_type,
                    "amount": float(t.amount),
                    "balance_after": float(t.balance_after or 0),
                    "reference": t.reference,
                    "description": t.description
                } for t in transactions
            ],
            "loans_summary": [
                {
                    "loan_number": l.application_number,
                    "amount": float(l.amount),
                    "status": l.status,
                    "outstanding": float(l.outstanding_balance or 0),
                    "disbursed_at": l.disbursed_at.isoformat() if l.disbursed_at else None,
                    "interest_deducted_upfront": getattr(l, 'interest_deducted_upfront', False)
                } for l in loans
            ],
            "fixed_deposits": fixed_deposit_data
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/reports/fixed-deposits")
async def get_fixed_deposits_report(
    org_id: str,
    status: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get fixed deposits summary report"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(
            MemberFixedDeposit,
            Member.member_number,
            Member.first_name,
            Member.last_name,
            FixedDepositProduct.name.label("product_name")
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
            
            report_data.append({
                "deposit_number": fd.deposit_number,
                "member_number": member_number,
                "member_name": f"{first_name} {last_name}",
                "product_name": product_name,
                "principal_amount": float(fd.principal_amount),
                "interest_rate": float(fd.interest_rate),
                "term_months": fd.term_months,
                "start_date": fd.start_date.isoformat() if fd.start_date else None,
                "maturity_date": fd.maturity_date.isoformat() if fd.maturity_date else None,
                "expected_interest": float(fd.expected_interest),
                "maturity_amount": float(fd.maturity_amount),
                "status": fd.status,
                "early_withdrawal": fd.early_withdrawal,
                "penalty_amount": float(fd.penalty_amount or 0),
                "actual_amount_paid": float(fd.actual_amount_paid) if fd.actual_amount_paid else None
            })
        
        return {
            "summary": {
                "total_deposits": len(results),
                "active_count": active_count,
                "matured_count": matured_count,
                "closed_count": closed_count,
                "total_principal_active": float(total_principal),
                "total_expected_interest": float(total_expected_interest),
                "total_amount_paid": float(total_paid)
            },
            "deposits": report_data
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
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(LoanApplication)
        
        if start_date:
            query = query.filter(func.date(LoanApplication.applied_at) >= start_date)
        if end_date:
            query = query.filter(func.date(LoanApplication.applied_at) <= end_date)
        if status:
            query = query.filter(LoanApplication.status == status)
        if branch_id:
            query = query.join(Member).filter(Member.branch_id == branch_id)
        
        loans = query.all()
        
        total_applied = sum(l.amount for l in loans)
        ever_approved_statuses = ["approved", "disbursed", "paid", "defaulted", "completed", "restructured", "written_off"]
        total_approved = sum(l.amount for l in loans if l.status in ever_approved_statuses)
        ever_disbursed_statuses = ["disbursed", "paid", "defaulted", "completed", "restructured", "written_off"]
        total_disbursed = sum(l.amount_disbursed or Decimal("0") for l in loans if l.status in ever_disbursed_statuses)
        active_outstanding_statuses = ["disbursed", "defaulted", "restructured"]
        total_outstanding = sum(l.outstanding_balance or Decimal("0") for l in loans if l.status in active_outstanding_statuses)
        total_repaid = sum(l.amount_repaid or Decimal("0") for l in loans)
        
        by_status = {}
        for l in loans:
            by_status[l.status] = by_status.get(l.status, 0) + 1
        
        approved_count = sum(1 for l in loans if l.status in ever_approved_statuses)
        
        return {
            "period": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            },
            "summary": {
                "total_applications": len(loans),
                "total_applied_amount": float(total_applied),
                "total_approved_amount": float(total_approved),
                "total_disbursed_amount": float(total_disbursed),
                "total_outstanding": float(total_outstanding),
                "total_repaid": float(total_repaid),
                "approval_rate": (approved_count / len(loans) * 100) if loans else 0
            },
            "by_status": by_status,
            "loans": [
                {
                    "application_number": l.application_number,
                    "member_name": f"{l.member.first_name} {l.member.last_name}" if l.member else None,
                    "amount": float(l.amount),
                    "status": l.status,
                    "applied_at": l.applied_at.isoformat() if l.applied_at else None,
                    "disbursed_at": l.disbursed_at.isoformat() if l.disbursed_at else None,
                    "outstanding": float(l.outstanding_balance or 0),
                    "interest_deducted_upfront": getattr(l, 'interest_deducted_upfront', False)
                } for l in loans[:100]
            ]
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
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        if not start_date:
            start_date = date.today().replace(day=1)
        if not end_date:
            end_date = date.today()
        
        member_query = tenant_session.query(Member)
        if branch_id:
            member_query = member_query.filter(Member.branch_id == branch_id)
        members = member_query.all()
        
        total_savings = sum(m.savings_balance or Decimal("0") for m in members)
        total_shares = sum(m.shares_balance or Decimal("0") for m in members)
        total_deposits = sum(m.deposits_balance or Decimal("0") for m in members)
        
        loan_query = tenant_session.query(LoanApplication)
        if branch_id:
            loan_query = loan_query.join(Member).filter(Member.branch_id == branch_id)
        loans = loan_query.all()
        
        active_loan_statuses = ["disbursed", "defaulted", "restructured"]
        total_loan_portfolio = sum(l.outstanding_balance or Decimal("0") for l in loans if l.status in active_loan_statuses)
        
        txn_query = tenant_session.query(Transaction).filter(
            func.date(Transaction.created_at) >= start_date,
            func.date(Transaction.created_at) <= end_date
        )
        transactions = txn_query.all()
        
        total_deposits_period = sum(t.amount for t in transactions if t.transaction_type == "deposit")
        total_withdrawals_period = sum(t.amount for t in transactions if t.transaction_type == "withdrawal")
        
        repayments = tenant_session.query(LoanRepayment).filter(
            func.date(LoanRepayment.payment_date) >= start_date,
            func.date(LoanRepayment.payment_date) <= end_date
        ).all()
        
        total_collections = sum(
            (r.principal_amount or Decimal("0")) + (r.interest_amount or Decimal("0")) + (r.penalty_amount or Decimal("0"))
            for r in repayments
        )
        total_interest_income = sum(r.interest_amount or Decimal("0") for r in repayments)
        total_penalty_income = sum(r.penalty_amount or Decimal("0") for r in repayments)
        
        disbursements = tenant_session.query(LoanApplication).filter(
            func.date(LoanApplication.disbursed_at) >= start_date,
            func.date(LoanApplication.disbursed_at) <= end_date,
            LoanApplication.disbursed_at.isnot(None)
        ).all()
        
        total_disbursements = sum(l.amount_disbursed or Decimal("0") for l in disbursements)
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "member_deposits": {
                "total_savings": float(total_savings),
                "total_shares": float(total_shares),
                "total_deposits": float(total_deposits),
                "total_member_funds": float(total_savings + total_shares + total_deposits)
            },
            "loan_portfolio": {
                "total_outstanding": float(total_loan_portfolio),
                "active_loans": sum(1 for l in loans if l.status in active_loan_statuses)
            },
            "period_activity": {
                "deposits_received": float(total_deposits_period),
                "withdrawals_made": float(total_withdrawals_period),
                "net_deposits": float(total_deposits_period - total_withdrawals_period),
                "loans_disbursed": float(total_disbursements),
                "loan_collections": float(total_collections),
                "interest_income": float(total_interest_income),
                "penalty_income": float(total_penalty_income),
                "total_income": float(total_interest_income + total_penalty_income)
            }
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
    db: Session = Depends(get_db)
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
            func.date(LoanRepayment.payment_date) <= end_date
        ).all()
        
        repayment_interest = sum(r.interest_amount or Decimal("0") for r in repayments)
        penalty_income = sum(r.penalty_amount or Decimal("0") for r in repayments)
        
        disbursements = tenant_session.query(LoanApplication).filter(
            func.date(LoanApplication.disbursed_at) >= start_date,
            func.date(LoanApplication.disbursed_at) <= end_date,
            LoanApplication.disbursed_at.isnot(None)
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
        
        approved_expenses = tenant_session.query(Expense).filter(
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
            Expense.status == "approved"
        ).all()
        
        expense_by_category = {}
        for exp in approved_expenses:
            cat = tenant_session.query(ExpenseCategory).filter(ExpenseCategory.id == exp.category_id).first()
            cat_name = cat.name if cat else "Uncategorized"
            expense_by_category[cat_name] = expense_by_category.get(cat_name, Decimal("0")) + (exp.amount or Decimal("0"))
        
        total_expenses = sum(expense_by_category.values(), Decimal("0"))
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "income": {
                "interest_income": float(interest_income),
                "penalty_income": float(penalty_income),
                "processing_fees": float(processing_fee_income),
                "insurance_fees": float(insurance_fee_income),
                "extra_charges": float(extra_charges_income),
                "total_income": float(total_income)
            },
            "expenses": {
                "categories": {k: float(v) for k, v in expense_by_category.items()},
                "total_expenses": float(total_expenses)
            },
            "net_profit": float(total_income - total_expenses)
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/reports/aging")
async def get_aging_report(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        today = date.today()
        
        loans = tenant_session.query(LoanApplication).filter(
            LoanApplication.status.in_(["disbursed", "defaulted", "restructured"]),
            LoanApplication.outstanding_balance > 0
        ).all()
        
        aging_buckets = {
            "current": [],
            "1_30_days": [],
            "31_60_days": [],
            "61_90_days": [],
            "over_90_days": []
        }
        
        for loan in loans:
            if not loan.next_payment_date or loan.next_payment_date >= today:
                aging_buckets["current"].append(loan)
            else:
                days_overdue = (today - loan.next_payment_date).days
                if days_overdue <= 30:
                    aging_buckets["1_30_days"].append(loan)
                elif days_overdue <= 60:
                    aging_buckets["31_60_days"].append(loan)
                elif days_overdue <= 90:
                    aging_buckets["61_90_days"].append(loan)
                else:
                    aging_buckets["over_90_days"].append(loan)
        
        return {
            "as_of_date": today.isoformat(),
            "summary": {
                bucket: {
                    "count": len(loans_list),
                    "total_outstanding": float(sum(l.outstanding_balance or Decimal("0") for l in loans_list))
                } for bucket, loans_list in aging_buckets.items()
            },
            "total_portfolio": {
                "count": len(loans),
                "total_outstanding": float(sum(l.outstanding_balance or Decimal("0") for l in loans))
            }
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()
