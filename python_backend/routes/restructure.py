from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from decimal import Decimal
from datetime import datetime, timedelta, date
import math
from models.database import get_db
from models.tenant import LoanApplication, LoanRestructure, LoanProduct, Member
from schemas.tenant import LoanRestructureCreate, LoanRestructureResponse
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from services.instalment_service import regenerate_instalments_after_restructure
from routes.loans import calculate_loan

router = APIRouter()

def post_penalty_waiver_to_gl(tenant_session, loan, waived_amount: Decimal, reason: str):
    """Post penalty waiver to General Ledger"""
    try:
        from accounting.service import AccountingService
        
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        lines = [
            {"account_code": "5040", "debit": waived_amount, "credit": Decimal("0"), "loan_id": str(loan.id), "memo": "Penalty waiver expense"},
            {"account_code": "1100", "debit": Decimal("0"), "credit": waived_amount, "loan_id": str(loan.id), "memo": "Penalty waived"}
        ]
        
        svc.create_journal_entry(
            entry_date=date.today(),
            description=f"Penalty waiver - {loan.application_number} - {reason}",
            source_type="penalty_waiver",
            source_id=str(loan.id),
            lines=lines
        )
        print(f"[GL] Posted penalty waiver to GL: {loan.application_number}")
    except Exception as e:
        print(f"[GL] Failed to post penalty waiver to GL: {e}")

def get_remaining_principal_and_paid_interest(tenant_session, loan: LoanApplication):
    """Calculate remaining principal and interest already allocated from instalment records.
    Returns (remaining_principal, preserved_interest) where preserved_interest is the
    expected_interest from paid/partial instalments (used to compute full-loan totals)."""
    from models.tenant import LoanInstalment
    paid_principal = tenant_session.query(
        func.coalesce(func.sum(LoanInstalment.paid_principal), 0)
    ).filter(LoanInstalment.loan_id == str(loan.id)).scalar()
    remaining_principal = Decimal(str(loan.amount or 0)) - Decimal(str(paid_principal or 0))

    preserved_interest = tenant_session.query(
        func.coalesce(func.sum(LoanInstalment.expected_interest), 0)
    ).filter(
        LoanInstalment.loan_id == str(loan.id),
        LoanInstalment.status.in_(["paid", "partial"])
    ).scalar()
    return remaining_principal, Decimal(str(preserved_interest or 0))

def recalculate_loan(remaining_principal: Decimal, product: LoanProduct, loan: LoanApplication, new_term: int = None, new_rate: Decimal = None):
    """Recalculate loan based on remaining principal with correct formula per interest type."""
    term = new_term or loan.term_months
    rate = new_rate if new_rate is not None else loan.interest_rate
    interest_deducted_upfront = bool(getattr(loan, 'interest_deducted_upfront', False))

    if interest_deducted_upfront:
        periodic_payment = remaining_principal / term if term > 0 else Decimal("0")
        return {
            "monthly_repayment": round(periodic_payment, 2),
            "total_repayment": round(remaining_principal, 2),
            "total_interest": Decimal("0")
        }

    interest_type = getattr(product, 'interest_type', 'reducing_balance') if product else 'reducing_balance'
    freq = getattr(product, 'repayment_frequency', 'monthly') if product else 'monthly'
    return calculate_loan(remaining_principal, term, rate, interest_type, freq)

@router.get("/{org_id}/loans/{loan_id}/restructures")
async def list_loan_restructures(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "restructure:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        restructures = tenant_session.query(LoanRestructure).filter(LoanRestructure.loan_id == loan_id).order_by(LoanRestructure.created_at.desc()).all()
        return [LoanRestructureResponse.model_validate(r) for r in restructures]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/loans/{loan_id}/restructure")
async def restructure_loan(org_id: str, loan_id: str, data: LoanRestructureCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "restructure:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        if loan.status != "disbursed":
            raise HTTPException(status_code=400, detail="Only active loans can be restructured")

        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        remaining_principal, preserved_interest = get_remaining_principal_and_paid_interest(tenant_session, loan)
        amount_already_paid = Decimal(str(loan.amount_repaid or 0))

        valid_types = ["extend_term", "reduce_installment", "adjust_interest", "waive_penalty", "grace_period"]
        if data.restructure_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid restructure type")
        
        restructure = LoanRestructure(
            loan_id=loan_id,
            restructure_type=data.restructure_type,
            old_term_months=loan.term_months,
            old_interest_rate=loan.interest_rate,
            old_monthly_repayment=loan.monthly_repayment,
            reason=data.reason
        )
        
        if data.restructure_type == "extend_term" and data.new_term_months:
            if data.new_term_months <= loan.term_months:
                raise HTTPException(status_code=400, detail="New term must be greater than current term")
            
            recalc = recalculate_loan(remaining_principal, product, loan, new_term=data.new_term_months)
            restructure.new_term_months = data.new_term_months
            restructure.new_monthly_repayment = recalc["monthly_repayment"]
            
            loan.term_months = data.new_term_months
            loan.monthly_repayment = recalc["monthly_repayment"]
            loan.total_interest = preserved_interest + recalc["total_interest"]
            loan.total_repayment = amount_already_paid + recalc["total_repayment"]
            loan.outstanding_balance = recalc["total_repayment"]
        
        elif data.restructure_type == "reduce_installment" and data.new_monthly_repayment:
            if data.new_monthly_repayment >= (loan.monthly_repayment or Decimal("0")):
                raise HTTPException(status_code=400, detail="New installment must be less than current")
            
            interest_type = getattr(product, 'interest_type', 'reducing_balance') if product else 'reducing_balance'
            rate = loan.interest_rate
            periodic_rate = rate / Decimal("100")
            new_payment = data.new_monthly_repayment

            if periodic_rate > 0 and interest_type != "flat":
                ratio = float(remaining_principal) * float(periodic_rate) / float(new_payment)
                if ratio >= 1:
                    raise HTTPException(status_code=400, detail="Payment too low to cover interest on outstanding principal")
                n = -math.log(1 - ratio) / math.log(1 + float(periodic_rate))
                new_term = max(int(math.ceil(n)), 1)
            elif interest_type == "flat" and periodic_rate > 0:
                principal_per_period = new_payment - (remaining_principal * periodic_rate)
                if principal_per_period > 0:
                    new_term = max(int(math.ceil(float(remaining_principal / principal_per_period))), 1)
                else:
                    raise HTTPException(status_code=400, detail="Payment too low to cover interest")
            else:
                new_term = max(int(math.ceil(float(remaining_principal / new_payment))), 1)

            recalc = recalculate_loan(remaining_principal, product, loan, new_term=new_term)
            
            restructure.new_monthly_repayment = new_payment
            restructure.new_term_months = new_term
            loan.monthly_repayment = new_payment
            loan.term_months = new_term
            loan.total_interest = preserved_interest + recalc["total_interest"]
            loan.total_repayment = amount_already_paid + recalc["total_repayment"]
            loan.outstanding_balance = recalc["total_repayment"]
        
        elif data.restructure_type == "adjust_interest" and data.new_interest_rate is not None:
            recalc = recalculate_loan(remaining_principal, product, loan, new_rate=data.new_interest_rate)
            restructure.new_interest_rate = data.new_interest_rate
            restructure.new_monthly_repayment = recalc["monthly_repayment"]
            
            loan.interest_rate = data.new_interest_rate
            loan.monthly_repayment = recalc["monthly_repayment"]
            loan.total_interest = preserved_interest + recalc["total_interest"]
            loan.total_repayment = amount_already_paid + recalc["total_repayment"]
            loan.outstanding_balance = recalc["total_repayment"]
        
        elif data.restructure_type == "waive_penalty" and data.penalty_waived:
            restructure.penalty_waived = data.penalty_waived
            if loan.outstanding_balance:
                loan.outstanding_balance = loan.outstanding_balance - data.penalty_waived
            # Post to GL
            post_penalty_waiver_to_gl(tenant_session, loan, data.penalty_waived, data.reason or "Penalty waiver")
        
        elif data.restructure_type == "grace_period" and data.grace_period_days:
            restructure.grace_period_days = data.grace_period_days
            if loan.next_payment_date:
                loan.next_payment_date = loan.next_payment_date + timedelta(days=data.grace_period_days)
        
        loan.is_restructured = True
        
        tenant_session.add(restructure)
        tenant_session.flush()

        if data.restructure_type in ("extend_term", "reduce_installment", "adjust_interest", "grace_period"):
            regenerate_instalments_after_restructure(tenant_session, loan, product)

        tenant_session.commit()
        tenant_session.refresh(restructure)
        return LoanRestructureResponse.model_validate(restructure)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/loans/{loan_id}/restructure/preview")
async def preview_restructure(
    org_id: str, 
    loan_id: str, 
    restructure_type: str,
    new_term_months: int = None,
    new_interest_rate: float = None,
    new_monthly_repayment: float = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "restructure:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        remaining_principal, _ = get_remaining_principal_and_paid_interest(tenant_session, loan)

        current = {
            "term_months": loan.term_months,
            "interest_rate": float(loan.interest_rate),
            "monthly_repayment": float(loan.monthly_repayment or 0),
            "outstanding_balance": float(remaining_principal)
        }
        
        new_term = new_term_months or loan.term_months
        new_rate = Decimal(str(new_interest_rate)) if new_interest_rate else loan.interest_rate
        
        recalc = recalculate_loan(remaining_principal, product, loan, new_term=new_term, new_rate=new_rate)
        
        proposed = {
            "term_months": new_term,
            "interest_rate": float(new_rate),
            "monthly_repayment": float(recalc["monthly_repayment"]),
            "total_repayment": float(recalc["total_repayment"]),
            "total_interest": float(recalc["total_interest"])
        }
        
        return {
            "current": current,
            "proposed": proposed,
            "savings": {
                "monthly_savings": current["monthly_repayment"] - proposed["monthly_repayment"]
            }
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()
