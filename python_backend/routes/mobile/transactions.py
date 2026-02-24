"""
Mobile Member API — Transactions & Statements
GET  /api/mobile/me/transactions
GET  /api/mobile/me/mini-statement
GET  /api/mobile/me/payments
POST /api/mobile/me/deposit
POST /api/mobile/me/withdraw
POST /api/mobile/me/mpesa-pay
"""

import math
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from typing import Optional
from .deps import get_current_member


def _require_mpesa_available(org, tenant_session):
    from middleware.demo_guard import is_demo_mode
    from models.tenant import OrganizationSettings
    from routes.mpesa import get_org_setting
    setting = tenant_session.query(OrganizationSettings).filter(
        OrganizationSettings.setting_key == "mpesa_enabled"
    ).first()
    mpesa_enabled = setting and setting.setting_value.lower() == "true" if setting else False
    if not mpesa_enabled:
        raise HTTPException(status_code=400, detail="M-Pesa payments are not available at this time. Please contact your administrator.")
    if not is_demo_mode():
        currency = getattr(org, "currency", None) or "USD"
        if currency != "KES":
            raise HTTPException(status_code=400, detail="M-Pesa payments are not available for your organization. Please contact your administrator.")
        mpesa_env = get_org_setting(tenant_session, "mpesa_environment", "sandbox")
        if mpesa_env != "production":
            raise HTTPException(status_code=400, detail="M-Pesa is not configured for live payments yet. Please ask your administrator to set up production M-Pesa credentials.")

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
    per_page: int = Query(20, ge=1, le=200),
    limit: Optional[int] = Query(None),
    account_type: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ctx: dict = Depends(get_current_member),
):
    from models.tenant import Transaction

    member = ctx["member"]
    ts = ctx["session"]

    effective_per_page = limit if limit is not None else per_page

    try:
        q = ts.query(Transaction).filter(Transaction.member_id == member.id)
        if account_type:
            q = q.filter(Transaction.account_type == account_type)
        if transaction_type:
            q = q.filter(Transaction.transaction_type == transaction_type)
        if start_date:
            try:
                from datetime import datetime as dt
                sd = dt.fromisoformat(start_date.replace("Z", "+00:00"))
                q = q.filter(Transaction.created_at >= sd)
            except Exception:
                pass
        if end_date:
            try:
                from datetime import datetime as dt
                ed = dt.fromisoformat(end_date.replace("Z", "+00:00"))
                q = q.filter(Transaction.created_at <= ed)
            except Exception:
                pass

        total = q.count()
        items = q.order_by(desc(Transaction.created_at)).offset((page - 1) * effective_per_page).limit(effective_per_page).all()

        return {
            "items": [_tx(t) for t in items],
            "total": total,
            "page": page,
            "per_page": effective_per_page,
            "total_pages": math.ceil(total / effective_per_page) if total > 0 else 1,
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


VALID_DEPOSIT_ACCOUNTS = {"savings", "shares"}
VALID_WITHDRAW_ACCOUNTS = {"savings"}

ACCOUNT_LABELS = {
    "savings": "Savings Account",
    "shares": "Share Capital",
}


class DepositRequest(BaseModel):
    amount: float
    account_type: str = "savings"
    phone_number: Optional[str] = None
    description: Optional[str] = None


class WithdrawRequest(BaseModel):
    amount: float
    account_type: str = "savings"
    phone_number: Optional[str] = None
    description: Optional[str] = None


@router.post("/me/deposit")
async def initiate_deposit(data: DepositRequest, ctx: dict = Depends(get_current_member)):
    """Initiate a deposit via M-Pesa STK push to savings or shares."""
    import asyncio
    from models.tenant import Transaction, MpesaPayment
    from routes.mpesa import initiate_stk_push, simulate_sandbox_callback
    from middleware.demo_guard import is_demo_mode
    from services.code_generator import generate_txn_code
    import uuid as _uuid
    generate_uuid = lambda: str(_uuid.uuid4())

    member = ctx["member"]
    org = ctx["org"]
    ts = ctx["session"]

    _require_mpesa_available(org, ts)

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")

    if data.account_type not in VALID_DEPOSIT_ACCOUNTS:
        raise HTTPException(status_code=400, detail=f"Invalid account type. Choose from: {', '.join(VALID_DEPOSIT_ACCOUNTS)}")

    phone = data.phone_number or member.phone
    if not phone:
        raise HTTPException(status_code=400, detail="No phone number on file. Please provide a phone number.")

    import re
    cleaned_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
    if not re.match(r'^\d{10,15}$', cleaned_phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must be 10-15 digits.")

    amount = Decimal(str(data.amount))
    account_label = ACCOUNT_LABELS.get(data.account_type, data.account_type.title())

    try:
        result = initiate_stk_push(
            tenant_session=ts,
            phone=phone,
            amount=amount,
            account_reference=member.member_number or member.id[:8],
            description=data.description or f"{account_label} Deposit",
            org_id=org.id,
        )

        checkout_request_id = result.get("CheckoutRequestID")
        merchant_request_id = result.get("MerchantRequestID")
        response_code = result.get("ResponseCode", "")

        if response_code != "0":
            error_msg = result.get("CustomerMessage") or result.get("errorMessage") or "STK push failed"
            raise HTTPException(status_code=502, detail=error_msg)

        pending_payment = MpesaPayment(
            id=generate_uuid(),
            trans_id=f"PENDING-{checkout_request_id}",
            trans_time=datetime.utcnow().strftime("%Y%m%d%H%M%S"),
            amount=amount,
            phone_number=phone,
            bill_ref_number=checkout_request_id,
            first_name=member.first_name or "Mobile",
            last_name=member.last_name or "",
            transaction_type="STK",
            member_id=member.id,
            status="pending",
            notes=f"payment_type:deposit | account_type:{data.account_type}",
        )
        ts.add(pending_payment)
        ts.commit()

        if is_demo_mode():
            asyncio.create_task(simulate_sandbox_callback(
                org.id,
                checkout_request_id or "",
                merchant_request_id or "",
                float(amount)
            ))

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
        ts.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to initiate deposit: {str(e)}")
    finally:
        ts.close()


@router.post("/me/withdraw")
def request_withdrawal(data: WithdrawRequest, ctx: dict = Depends(get_current_member)):
    """Withdraw from savings or shares balance. Creates a withdrawal transaction."""
    from models.tenant import Transaction
    from services.code_generator import generate_txn_code

    member = ctx["member"]
    org = ctx["org"]
    ts = ctx["session"]

    _require_mpesa_available(org, ts)

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")

    if data.account_type not in VALID_WITHDRAW_ACCOUNTS:
        raise HTTPException(status_code=400, detail=f"Invalid account type. Choose from: {', '.join(VALID_WITHDRAW_ACCOUNTS)}")

    amount = Decimal(str(data.amount))
    account_label = ACCOUNT_LABELS.get(data.account_type, data.account_type.title())

    from models.tenant import Member as MemberModel
    member = ts.query(MemberModel).filter(MemberModel.id == member.id).with_for_update().first()

    if data.account_type == "savings":
        current_balance = member.savings_balance or Decimal("0")
    else:
        current_balance = member.shares_balance or Decimal("0")

    if amount > current_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient {account_label} balance. Available: {float(current_balance):.2f}"
        )

    try:
        new_balance = current_balance - amount
        txn_code = generate_txn_code()

        phone = data.phone_number or member.phone

        txn = Transaction(
            transaction_number=txn_code,
            member_id=member.id,
            transaction_type="withdrawal",
            account_type=data.account_type,
            amount=amount,
            balance_before=current_balance,
            balance_after=new_balance,
            payment_method="mpesa",
            reference=phone,
            description=data.description or f"{account_label} M-Pesa withdrawal",
            created_at=datetime.utcnow(),
        )
        ts.add(txn)

        if data.account_type == "savings":
            member.savings_balance = new_balance
        else:
            member.shares_balance = new_balance

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


class MpesaPayRequest(BaseModel):
    phone_number: str
    amount: float
    loan_id: Optional[str] = None
    description: Optional[str] = None
    payment_type: Optional[str] = "loan_repayment"


@router.post("/me/mpesa-pay")
async def mobile_mpesa_pay(data: MpesaPayRequest, ctx: dict = Depends(get_current_member)):
    """Initiate M-Pesa STK push for loan repayment from the mobile app."""
    import asyncio
    from routes.mpesa import initiate_stk_push, simulate_sandbox_callback
    from middleware.demo_guard import is_demo_mode
    from models.tenant import LoanApplication, MpesaPayment
    import uuid as _uuid
    generate_uuid = lambda: str(_uuid.uuid4())

    member = ctx["member"]
    org = ctx["org"]
    ts = ctx["session"]

    _require_mpesa_available(org, ts)

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")

    if not data.phone_number:
        raise HTTPException(status_code=400, detail="Phone number is required")

    import re
    cleaned_pay_phone = data.phone_number.replace("+", "").replace(" ", "").replace("-", "")
    if not re.match(r'^\d{10,15}$', cleaned_pay_phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format. Must be 10-15 digits.")

    loan = None
    if data.loan_id:
        loan = ts.query(LoanApplication).filter(
            LoanApplication.id == data.loan_id,
            LoanApplication.member_id == member.id,
        ).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        if loan.status not in ("disbursed", "active"):
            raise HTTPException(status_code=400, detail="Loan is not active")

    amount = Decimal(str(data.amount))
    account_ref = member.member_number or member.id[:8]
    description = data.description or "Loan Repayment"

    try:
        result = initiate_stk_push(
            tenant_session=ts,
            phone=data.phone_number,
            amount=amount,
            account_reference=account_ref,
            description=description,
            org_id=org.id,
        )

        checkout_request_id = result.get("CheckoutRequestID")
        merchant_request_id = result.get("MerchantRequestID")
        response_code = result.get("ResponseCode", "")

        if response_code != "0":
            error_msg = result.get("CustomerMessage") or result.get("errorMessage") or "STK push failed"
            raise HTTPException(status_code=502, detail=error_msg)

        notes_parts = []
        if data.loan_id:
            notes_parts.append(f"payment_type:loan_repayment")
            notes_parts.append(f"loan_id:{data.loan_id}")
        else:
            notes_parts.append(f"payment_type:deposit")
            notes_parts.append(f"account_type:savings")

        pending_payment = MpesaPayment(
            id=generate_uuid(),
            trans_id=f"PENDING-{checkout_request_id}",
            trans_time=datetime.utcnow().strftime("%Y%m%d%H%M%S"),
            amount=amount,
            phone_number=data.phone_number,
            bill_ref_number=checkout_request_id,
            first_name=member.first_name or "Mobile",
            last_name=member.last_name or "",
            transaction_type="STK",
            member_id=member.id,
            status="pending",
            notes=" | ".join(notes_parts),
        )
        ts.add(pending_payment)
        ts.commit()

        if is_demo_mode():
            asyncio.create_task(simulate_sandbox_callback(
                org.id,
                checkout_request_id or "",
                merchant_request_id or "",
                float(amount)
            ))

        return {
            "success": True,
            "message": "M-Pesa prompt sent. Enter your PIN to complete the payment.",
            "checkout_request_id": checkout_request_id,
            "merchant_request_id": merchant_request_id,
            "phone": data.phone_number,
            "amount": float(amount),
        }
    except HTTPException:
        raise
    except Exception as e:
        ts.rollback()
        raise HTTPException(status_code=500, detail=f"Payment failed: {str(e)}")
    finally:
        ts.close()
