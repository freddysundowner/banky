"""
Mobile Member API — Dashboard & Balances
GET /api/mobile/me/dashboard
GET /api/mobile/me/balances
GET /api/mobile/me/savings
GET /api/mobile/me/shares
GET /api/mobile/me/fixed-deposits
"""

from fastapi import APIRouter, Depends
from sqlalchemy import desc
from .deps import get_current_member

CURRENCY_SYMBOLS = {
    "USD": "$", "EUR": "€", "GBP": "£", "KES": "KSh", "UGX": "USh",
    "TZS": "TSh", "RWF": "RF", "NGN": "₦", "GHS": "GH₵", "ZAR": "R",
    "ETB": "Br", "XAF": "FCFA", "XOF": "CFA", "INR": "₹", "BRL": "R$",
    "JPY": "¥", "CNY": "¥", "AUD": "A$", "CAD": "CA$", "CHF": "CHF",
}

def get_currency_symbol(currency_code: str) -> str:
    return CURRENCY_SYMBOLS.get(currency_code, currency_code)

router = APIRouter()


@router.get("/me/dashboard")
def get_dashboard(ctx: dict = Depends(get_current_member)):
    from models.tenant import LoanApplication, Transaction

    member = ctx["member"]
    org = ctx["org"]
    ts = ctx["session"]

    try:
        active_loans = ts.query(LoanApplication).filter(
            LoanApplication.member_id == member.id,
            LoanApplication.status == "disbursed",
        ).all()

        total_loan_outstanding = sum(float(l.outstanding_balance or 0) for l in active_loans)

        next_payment_date = None
        next_payment_amount = None
        upcoming = sorted(
            [l for l in active_loans if l.next_payment_date],
            key=lambda l: l.next_payment_date,
        )
        if upcoming:
            next_payment_date = upcoming[0].next_payment_date.isoformat()
            next_payment_amount = float(upcoming[0].monthly_repayment or 0)

        recent_txs = ts.query(Transaction).filter(
            Transaction.member_id == member.id
        ).order_by(desc(Transaction.created_at)).limit(5).all()

        return {
            "member": {
                "full_name": f"{member.first_name} {member.last_name}",
                "member_number": member.member_number,
                "photo_url": member.photo_url,
            },
            "balances": {
                "savings": float(member.savings_balance or 0),
                "shares": float(member.shares_balance or 0),
                "deposits": float(member.deposits_balance or 0),
                "total_loan_outstanding": total_loan_outstanding,
            },
            "loans": {
                "active_count": len(active_loans),
                "next_payment_date": next_payment_date,
                "next_payment_amount": next_payment_amount,
            },
            "recent_transactions": [
                {
                    "id": t.id,
                    "transaction_number": t.transaction_number,
                    "transaction_type": t.transaction_type,
                    "account_type": t.account_type,
                    "amount": float(t.amount),
                    "description": t.description,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in recent_txs
            ],
            "organization": {
                "name": org.name,
                "currency": org.currency or "USD",
                "currency_symbol": get_currency_symbol(org.currency or "USD"),
                "logo_url": getattr(org, "logo", None),
            },
        }
    finally:
        ts.close()


@router.get("/me/balances")
def get_balances(ctx: dict = Depends(get_current_member)):
    from models.tenant import MemberFixedDeposit

    member = ctx["member"]
    ts = ctx["session"]

    try:
        fds = ts.query(MemberFixedDeposit).filter(
            MemberFixedDeposit.member_id == member.id,
            MemberFixedDeposit.status == "active",
        ).all()
        total_fixed = sum(float(f.principal_amount or 0) for f in fds)

        return {
            "savings": float(member.savings_balance or 0),
            "savings_pending": float(member.savings_pending or 0),
            "shares": float(member.shares_balance or 0),
            "shares_pending": float(member.shares_pending or 0),
            "deposits": float(member.deposits_balance or 0),
            "deposits_pending": float(member.deposits_pending or 0),
            "fixed_deposits_total": total_fixed,
            "fixed_deposits_count": len(fds),
        }
    finally:
        ts.close()


@router.get("/me/savings")
def get_savings(ctx: dict = Depends(get_current_member)):
    from models.tenant import Transaction

    member = ctx["member"]
    ts = ctx["session"]

    try:
        last_tx = ts.query(Transaction).filter(
            Transaction.member_id == member.id,
            Transaction.account_type == "savings",
        ).order_by(desc(Transaction.created_at)).first()

        return {
            "balance": float(member.savings_balance or 0),
            "pending": float(member.savings_pending or 0),
            "last_transaction_date": last_tx.created_at.isoformat() if last_tx else None,
        }
    finally:
        ts.close()


@router.get("/me/shares")
def get_shares(ctx: dict = Depends(get_current_member)):
    from models.tenant import Transaction

    member = ctx["member"]
    ts = ctx["session"]

    try:
        last_tx = ts.query(Transaction).filter(
            Transaction.member_id == member.id,
            Transaction.account_type == "shares",
        ).order_by(desc(Transaction.created_at)).first()

        return {
            "balance": float(member.shares_balance or 0),
            "pending": float(member.shares_pending or 0),
            "share_capital": float(member.share_capital or 0),
            "last_transaction_date": last_tx.created_at.isoformat() if last_tx else None,
        }
    finally:
        ts.close()


@router.get("/me/fixed-deposits")
def get_fixed_deposits(ctx: dict = Depends(get_current_member)):
    from models.tenant import MemberFixedDeposit

    member = ctx["member"]
    ts = ctx["session"]

    try:
        fds = ts.query(MemberFixedDeposit).filter(
            MemberFixedDeposit.member_id == member.id,
        ).order_by(desc(MemberFixedDeposit.created_at)).all()

        return [
            {
                "id": fd.id,
                "principal_amount": float(fd.principal_amount or 0),
                "interest_rate": float(fd.interest_rate or 0),
                "term_months": fd.term_months,
                "maturity_date": fd.maturity_date.isoformat() if fd.maturity_date else None,
                "status": fd.status,
                "created_at": fd.created_at.isoformat() if fd.created_at else None,
            }
            for fd in fds
        ]
    finally:
        ts.close()
