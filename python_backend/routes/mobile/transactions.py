"""
Mobile Member API — Transactions & Statements
GET /api/mobile/me/transactions
GET /api/mobile/me/mini-statement
GET /api/mobile/me/payments
"""

import math
from fastapi import APIRouter, Depends, Query
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
