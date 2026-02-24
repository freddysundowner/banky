"""
Mobile Member API — Loans
GET  /api/mobile/me/loans
GET  /api/mobile/me/loans/{loan_id}
GET  /api/mobile/me/loans/{loan_id}/schedule
POST /api/mobile/me/loans/{loan_id}/repayments  (bank transfer notification)
GET  /api/mobile/me/loan-products
POST /api/mobile/me/loan-applications
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from pydantic import BaseModel
from .deps import get_current_member

router = APIRouter()


def _loan_summary(loan) -> dict:
    product_name = loan.loan_product.name if loan.loan_product else None
    progress = 0.0
    if loan.total_repayment and float(loan.total_repayment) > 0:
        progress = round((float(loan.amount_repaid or 0) / float(loan.total_repayment)) * 100, 1)
    return {
        "id": loan.id,
        "application_number": loan.application_number,
        "product_name": product_name,
        "amount": float(loan.amount),
        "amount_disbursed": float(loan.amount_disbursed or 0),
        "amount_repaid": float(loan.amount_repaid or 0),
        "outstanding_balance": float(loan.outstanding_balance or 0),
        "total_repayment": float(loan.total_repayment or 0),
        "monthly_repayment": float(loan.monthly_repayment or 0),
        "interest_rate": float(loan.interest_rate),
        "term_months": loan.term_months,
        "status": loan.status,
        "purpose": loan.purpose,
        "next_payment_date": loan.next_payment_date.isoformat() if loan.next_payment_date else None,
        "last_payment_date": loan.last_payment_date.isoformat() if loan.last_payment_date else None,
        "disbursed_at": loan.disbursed_at.isoformat() if loan.disbursed_at else None,
        "applied_at": loan.applied_at.isoformat() if loan.applied_at else None,
        "repayment_progress": progress,
    }


@router.get("/me/loans")
def get_loans(
    status: Optional[str] = Query(None),
    ctx: dict = Depends(get_current_member),
):
    from models.tenant import LoanApplication

    member = ctx["member"]
    ts = ctx["session"]

    try:
        q = ts.query(LoanApplication).filter(LoanApplication.member_id == member.id)
        if status:
            q = q.filter(LoanApplication.status == status)
        return [_loan_summary(l) for l in q.order_by(desc(LoanApplication.applied_at)).all()]
    finally:
        ts.close()


@router.get("/me/loans/{loan_id}")
def get_loan_detail(loan_id: str, ctx: dict = Depends(get_current_member)):
    from models.tenant import LoanApplication

    member = ctx["member"]
    ts = ctx["session"]

    try:
        loan = ts.query(LoanApplication).filter(
            LoanApplication.id == loan_id,
            LoanApplication.member_id == member.id,
        ).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        data = _loan_summary(loan)
        data.update({
            "processing_fee": float(loan.processing_fee or 0),
            "insurance_fee": float(loan.insurance_fee or 0),
            "total_fees": float(loan.total_fees or 0),
            "total_interest": float(loan.total_interest or 0),
            "disbursement_method": loan.disbursement_method,
            "rejection_reason": loan.rejection_reason,
        })
        return data
    finally:
        ts.close()


@router.get("/me/loans/{loan_id}/schedule")
def get_loan_schedule(loan_id: str, ctx: dict = Depends(get_current_member)):
    from models.tenant import LoanApplication, LoanInstalment

    member = ctx["member"]
    ts = ctx["session"]

    try:
        loan = ts.query(LoanApplication).filter(
            LoanApplication.id == loan_id,
            LoanApplication.member_id == member.id,
        ).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        instalments = ts.query(LoanInstalment).filter(
            LoanInstalment.loan_id == loan_id
        ).order_by(LoanInstalment.instalment_number).all()

        return {
            "loan_id": loan.id,
            "application_number": loan.application_number,
            "schedule": [
                {
                    "instalment_number": i.instalment_number,
                    "due_date": i.due_date.isoformat() if i.due_date else None,
                    "expected_principal": float(i.expected_principal or 0),
                    "expected_interest": float(i.expected_interest or 0),
                    "expected_penalty": float(i.expected_penalty or 0),
                    "expected_insurance": float(i.expected_insurance or 0),
                    "total_due": float(
                        (i.expected_principal or 0) + (i.expected_interest or 0)
                        + (i.expected_penalty or 0) + (i.expected_insurance or 0)
                    ),
                    "paid_principal": float(i.paid_principal or 0),
                    "paid_interest": float(i.paid_interest or 0),
                    "status": i.status,
                    "paid_at": i.paid_at.isoformat() if i.paid_at else None,
                }
                for i in instalments
            ],
        }
    finally:
        ts.close()


class BankRepaymentRequest(BaseModel):
    amount: float
    reference: str
    notes: Optional[str] = None


@router.post("/me/loans/{loan_id}/repayments")
def record_bank_repayment(
    loan_id: str,
    data: BankRepaymentRequest,
    ctx: dict = Depends(get_current_member),
):
    from models.tenant import LoanApplication

    member = ctx["member"]
    ts = ctx["session"]

    try:
        loan = ts.query(LoanApplication).filter(
            LoanApplication.id == loan_id,
            LoanApplication.member_id == member.id,
        ).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        if loan.status not in ("disbursed", "active"):
            raise HTTPException(status_code=400, detail="Loan is not active")
        if data.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0")

        return {
            "message": "Repayment notification received. A staff member will confirm your payment shortly.",
            "loan_id": loan_id,
            "amount": data.amount,
            "reference": data.reference,
            "submitted_at": datetime.utcnow().isoformat(),
        }
    finally:
        ts.close()


@router.get("/me/loan-products")
def get_loan_products(ctx: dict = Depends(get_current_member)):
    from models.tenant import LoanProduct

    ts = ctx["session"]

    try:
        products = ts.query(LoanProduct).filter(LoanProduct.is_active == True).all()
        return [
            {
                "id": p.id,
                "name": p.name,
                "description": getattr(p, "description", None),
                "min_amount": float(p.min_amount) if getattr(p, "min_amount", None) else None,
                "max_amount": float(p.max_amount) if getattr(p, "max_amount", None) else None,
                "interest_rate": float(p.interest_rate),
                "interest_type": p.interest_type,
                "min_term_months": getattr(p, "min_term_months", None),
                "max_term_months": getattr(p, "max_term_months", None),
                "processing_fee_type": getattr(p, "processing_fee_type", None),
                "processing_fee_value": float(p.processing_fee_value) if getattr(p, "processing_fee_value", None) else None,
            }
            for p in products
        ]
    finally:
        ts.close()


class LoanApplicationRequest(BaseModel):
    loan_product_id: str
    amount: float
    term_months: int
    purpose: Optional[str] = None
    disbursement_method: Optional[str] = "mpesa"
    disbursement_phone: Optional[str] = None
    disbursement_account: Optional[str] = None


@router.post("/me/loan-applications")
def apply_for_loan(data: LoanApplicationRequest, ctx: dict = Depends(get_current_member)):
    from models.tenant import LoanProduct, LoanApplication

    member = ctx["member"]
    ts = ctx["session"]

    try:
        product = ts.query(LoanProduct).filter(
            LoanProduct.id == data.loan_product_id,
            LoanProduct.is_active == True,
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail="Loan product not found")
        if data.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0")
        if data.term_months <= 0:
            raise HTTPException(status_code=400, detail="Term must be greater than 0")

        count = ts.query(LoanApplication).count()
        app_number = f"LN-{(count + 1):05d}"

        interest_rate = float(product.interest_rate)
        total_interest = round((data.amount * interest_rate / 100) * data.term_months, 2)
        total_repayment = round(data.amount + total_interest, 2)
        monthly_repayment = round(total_repayment / data.term_months, 2)

        loan = LoanApplication(
            application_number=app_number,
            member_id=member.id,
            loan_product_id=data.loan_product_id,
            amount=data.amount,
            term_months=data.term_months,
            interest_rate=interest_rate,
            total_interest=total_interest,
            total_repayment=total_repayment,
            monthly_repayment=monthly_repayment,
            purpose=data.purpose,
            disbursement_method=data.disbursement_method,
            disbursement_phone=data.disbursement_phone or member.phone,
            disbursement_account=data.disbursement_account,
            status="pending",
            applied_at=datetime.utcnow(),
        )
        ts.add(loan)
        ts.commit()
        ts.refresh(loan)

        return {
            "message": "Loan application submitted successfully.",
            "application_number": loan.application_number,
            "id": loan.id,
            "status": "pending",
            "amount": data.amount,
            "term_months": data.term_months,
            "monthly_repayment": monthly_repayment,
        }
    except HTTPException:
        ts.rollback()
        raise
    except Exception as e:
        ts.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        ts.close()
