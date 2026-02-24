"""
Mobile Member API — Transactions & Statements
GET  /api/mobile/me/transactions
GET  /api/mobile/me/mini-statement
GET  /api/mobile/me/payments
POST /api/mobile/me/deposit
POST /api/mobile/me/withdraw
"""

import math
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from typing import Optional
from .deps import get_current_member

router = APIRouter()


def _tx(t) -> dict:
    return {
        "id": t.id,
        "transaction_number": t.transaction_number,
        "transaction_type": t.transaction_type,
        "account_type": t.account_type,
        "amount": float(t.amount),
        "balance_before": float(t.balance_before or 0),
        "balance_after": float(t.balance_after or 0),
        "payment_method": t.payment_method,
        "reference": t.reference,
        "description": t.description,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/me/transactions")
def get_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    account_type: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    ctx: dict = Depends(get_current_member),
):
    from models.tenant import Transaction

    member = ctx["member"]
    ts = ctx["session"]

    try:
        q = ts.query(Transaction).filter(Transaction.member_id == member.id)
        if account_type:
            q = q.filter(Transaction.account_type == account_type)
        if transaction_type:
            q = q.filter(Transaction.transaction_type == transaction_type)

        total = q.count()
        items = q.order_by(desc(Transaction.created_at)).offset((page - 1) * per_page).limit(per_page).all()

        return {
            "items": [_tx(t) for t in items],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": math.ceil(total / per_page) if total > 0 else 1,
        }
    finally:
        ts.close()


@router.get("/me/mini-statement")
def get_mini_statement(ctx: dict = Depends(get_current_member)):
    from models.tenant import Transaction

    member = ctx["member"]
    ts = ctx["session"]

    try:
        txs = ts.query(Transaction).filter(
            Transaction.member_id == member.id
        ).order_by(desc(Transaction.created_at)).limit(10).all()

        return {
            "transactions": [_tx(t) for t in txs],
            "balances": {
                "savings": float(member.savings_balance or 0),
                "shares": float(member.shares_balance or 0),
                "deposits": float(member.deposits_balance or 0),
            },
        }
    finally:
        ts.close()


@router.get("/me/payments")
def get_payment_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    ctx: dict = Depends(get_current_member),
):
    from models.tenant import LoanRepayment, LoanApplication

    member = ctx["member"]
    ts = ctx["session"]

    try:
        loan_ids = [
            row.id for row in ts.query(LoanApplication.id).filter(
                LoanApplication.member_id == member.id
            ).all()
        ]

        q = ts.query(LoanRepayment).filter(LoanRepayment.loan_id.in_(loan_ids))
        total = q.count()
        items = q.order_by(desc(LoanRepayment.payment_date)).offset((page - 1) * per_page).limit(per_page).all()

        return {
            "items": [
                {
                    "id": r.id,
                    "repayment_number": r.repayment_number,
                    "loan_id": r.loan_id,
                    "amount": float(r.amount),
                    "principal_amount": float(r.principal_amount or 0),
                    "interest_amount": float(r.interest_amount or 0),
                    "payment_method": r.payment_method,
                    "reference": r.reference,
                    "payment_date": r.payment_date.isoformat() if r.payment_date else None,
                }
                for r in items
            ],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": math.ceil(total / per_page) if total > 0 else 1,
        }
    finally:
        ts.close()


class DepositRequest(BaseModel):
    amount: float
    phone_number: Optional[str] = None
    description: Optional[str] = None


class WithdrawRequest(BaseModel):
    amount: float
    description: Optional[str] = None


@router.post("/me/deposit")
def initiate_deposit(data: DepositRequest, ctx: dict = Depends(get_current_member)):
    """Initiate a savings deposit via M-Pesa STK push."""
    from models.tenant import Transaction
    from routes.mpesa import initiate_stk_push
    from services.code_generator import generate_txn_code

    member = ctx["member"]
    org = ctx["org"]
    ts = ctx["session"]

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")

    phone = data.phone_number or member.phone
    if not phone:
        raise HTTPException(status_code=400, detail="No phone number on file. Please provide a phone number.")

    amount = Decimal(str(data.amount))

    try:
        result = initiate_stk_push(
            tenant_session=ts,
            phone=phone,
            amount=amount,
            account_reference=member.account_number or member.id[:8],
            description=data.description or "Savings Deposit",
            org_id=org.id,
        )

        checkout_request_id = result.get("CheckoutRequestID")
        merchant_request_id = result.get("MerchantRequestID")
        response_code = result.get("ResponseCode", "")

        if response_code != "0":
            error_msg = result.get("CustomerMessage") or result.get("errorMessage") or "STK push failed"
            raise HTTPException(status_code=502, detail=error_msg)

        return {
            "success": True,
            "message": "M-Pesa prompt sent. Enter your PIN to complete the deposit.",
            "checkout_request_id": checkout_request_id,
            "merchant_request_id": merchant_request_id,
            "phone": phone,
            "amount": float(amount),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate deposit: {str(e)}")
    finally:
        ts.close()


@router.post("/me/withdraw")
def request_withdrawal(data: WithdrawRequest, ctx: dict = Depends(get_current_member)):
    """Withdraw from savings balance. Creates a pending withdrawal transaction."""
    from models.tenant import Transaction
    from services.code_generator import generate_txn_code

    member = ctx["member"]
    ts = ctx["session"]

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")

    amount = Decimal(str(data.amount))
    current_balance = member.savings_balance or Decimal("0")

    if amount > current_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: {float(current_balance):.2f}"
        )

    try:
        new_balance = current_balance - amount
        txn_code = generate_txn_code()

        txn = Transaction(
            transaction_number=txn_code,
            member_id=member.id,
            transaction_type="withdrawal",
            account_type="savings",
            amount=amount,
            balance_before=current_balance,
            balance_after=new_balance,
            payment_method="mobile",
            description=data.description or "Member self-service withdrawal",
            created_at=datetime.utcnow(),
        )
        ts.add(txn)
        member.savings_balance = new_balance
        ts.commit()
        ts.refresh(txn)

        return {
            "success": True,
            "message": "Withdrawal recorded successfully.",
            "transaction_number": txn.transaction_number,
            "amount": float(amount),
            "balance_before": float(current_balance),
            "balance_after": float(new_balance),
        }
    except HTTPException:
        raise
    except Exception as e:
        ts.rollback()
        raise HTTPException(status_code=500, detail=f"Withdrawal failed: {str(e)}")
    finally:
        ts.close()
