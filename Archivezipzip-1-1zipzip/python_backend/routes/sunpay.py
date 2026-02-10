from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from decimal import Decimal
from datetime import datetime
from models.database import get_db
from models.tenant import Member, Transaction, OrganizationSettings, MpesaPayment, Staff, LoanApplication
from models.master import Organization
from services.tenant_context import TenantContext
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from services.feature_flags import check_org_feature
from services.sunpay import (
    stk_push, c2b_expect, b2c_payment, reverse_transaction, check_payment_status
)
from services.mpesa_loan_service import apply_mpesa_payment_to_loan, find_loan_from_reference

router = APIRouter()


def get_org_setting(tenant_session, key: str, default=None):
    setting = tenant_session.query(OrganizationSettings).filter(
        OrganizationSettings.setting_key == key
    ).first()
    if setting:
        if setting.setting_type == "boolean":
            return setting.setting_value.lower() == "true"
        elif setting.setting_type == "number":
            return Decimal(setting.setting_value) if setting.setting_value else default
        return setting.setting_value
    return default


def post_mpesa_deposit_to_gl(tenant_session, member, amount: Decimal, trans_id: str):
    try:
        from accounting.service import AccountingService, post_transaction
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        member_name = f"{member.first_name} {member.last_name}"
        post_transaction(
            svc,
            member_id=str(member.id),
            transaction_type="deposit",
            amount=amount,
            payment_method="mpesa",
            description=f"SunPay M-Pesa deposit - {member_name} - {trans_id}"
        )
    except Exception as e:
        print(f"[GL] Failed to post SunPay deposit to GL: {e}")


@router.post("/webhooks/sunpay/{org_id}")
async def sunpay_webhook(org_id: str, request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()

        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org or not org.connection_string:
            return {"status": "error", "message": "Invalid organization"}

        tenant_ctx = TenantContext(org.connection_string, org_id)
        tenant_session = tenant_ctx.create_session()

        try:
            transaction_id = data.get("transactionId", "")
            status = data.get("status", "")
            mpesa_ref = data.get("mpesaRef", "")
            amount = Decimal(str(data.get("amount", 0)))
            phone = data.get("phoneNumber", "")
            payment_type = data.get("paymentType", "stk")
            payer_name = data.get("payerName", "")

            lookup_id = mpesa_ref or transaction_id
            if lookup_id:
                existing = tenant_session.query(MpesaPayment).filter(
                    (MpesaPayment.trans_id == lookup_id)
                ).first()
                if not existing and mpesa_ref and transaction_id and mpesa_ref != transaction_id:
                    existing = tenant_session.query(MpesaPayment).filter(
                        MpesaPayment.trans_id == transaction_id
                    ).first()
                if existing:
                    if existing.status != "credited" and status == "completed":
                        existing.status = "credited"
                        existing.credited_at = datetime.utcnow()
                        tenant_session.commit()
                    return {"status": "ok", "message": "Duplicate handled"}

            name_parts = payer_name.split(" ") if payer_name else []
            first_name = name_parts[0] if len(name_parts) > 0 else ""
            last_name = name_parts[-1] if len(name_parts) > 1 else ""

            external_ref = data.get("externalRef", "")
            account_ref = external_ref.strip().upper() if external_ref else ""

            member = None
            if account_ref:
                member = tenant_session.query(Member).filter(
                    func.upper(Member.member_number) == account_ref
                ).first()

            if not member and phone:
                member = tenant_session.query(Member).filter(
                    Member.phone_number.like(f"%{phone[-9:]}")
                ).first()

            mpesa_enabled = get_org_setting(tenant_session, "mpesa_enabled", False)

            mpesa_payment = MpesaPayment(
                trans_id=mpesa_ref or transaction_id,
                trans_time=datetime.utcnow().strftime("%Y%m%d%H%M%S"),
                amount=amount,
                phone_number=phone,
                bill_ref_number=account_ref or external_ref,
                first_name=first_name,
                last_name=last_name,
                transaction_type=f"sunpay_{payment_type}",
                member_id=member.id if member else None,
                status="pending",
                raw_payload=data
            )
            tenant_session.add(mpesa_payment)

            if status != "completed":
                mpesa_payment.status = "failed" if status == "failed" else "pending"
                tenant_session.commit()
                return {"status": "ok", "message": f"Payment status: {status}"}

            if not mpesa_enabled:
                mpesa_payment.status = "pending"
                mpesa_payment.notes = "M-Pesa not enabled - payment logged but not credited"
                tenant_session.commit()
                return {"status": "ok", "message": "Logged but M-Pesa disabled"}

            if not member:
                mpesa_payment.status = "unmatched"
                mpesa_payment.notes = f"No member found for ref: {account_ref}, phone: {phone}"
                tenant_session.commit()
                return {"status": "ok", "message": "Logged but member not found"}

            ref_id = mpesa_ref or transaction_id
            loan = find_loan_from_reference(tenant_session, account_ref)

            if loan and loan.member_id == member.id:
                repayment, error = apply_mpesa_payment_to_loan(
                    tenant_session, loan, member, amount, ref_id, "SunPay"
                )
                if error:
                    mpesa_payment.notes = f"Loan repayment failed: {error}"
                    mpesa_payment.status = "pending"
                    tenant_session.commit()
                    return {"status": "ok", "message": f"Payment logged: {error}"}

                mpesa_payment.transaction_id = None
                mpesa_payment.status = "credited"
                mpesa_payment.credited_at = datetime.utcnow()
                mpesa_payment.notes = f"Applied to loan {loan.application_number}"
                tenant_session.commit()
                return {"status": "ok", "message": f"Payment applied to loan {loan.application_number}"}

            current_balance = member.savings_balance or Decimal("0")
            new_balance = current_balance + amount

            count = tenant_session.query(func.count(Transaction.id)).scalar() or 0
            code = f"TXN{count + 1:04d}"

            transaction = Transaction(
                transaction_number=code,
                member_id=member.id,
                transaction_type="deposit",
                account_type="savings",
                amount=amount,
                balance_before=current_balance,
                balance_after=new_balance,
                payment_method="mpesa",
                reference=ref_id,
                description=f"SunPay M-Pesa deposit from {phone} ({payer_name})"
            )

            member.savings_balance = new_balance

            if member.status == "pending":
                auto_activate = get_org_setting(tenant_session, "auto_activate_on_deposit", True)
                require_opening_deposit = get_org_setting(tenant_session, "require_opening_deposit", False)
                min_opening_deposit = get_org_setting(tenant_session, "minimum_opening_deposit", Decimal("0"))
                if auto_activate:
                    total_deposits = (member.savings_balance or Decimal("0")) + \
                                   (member.shares_balance or Decimal("0")) + \
                                   (member.deposits_balance or Decimal("0"))
                    if not require_opening_deposit or total_deposits >= min_opening_deposit:
                        member.status = "active"

            tenant_session.add(transaction)
            tenant_session.flush()

            mpesa_payment.transaction_id = transaction.id
            mpesa_payment.status = "credited"
            mpesa_payment.credited_at = datetime.utcnow()

            tenant_session.commit()

            post_mpesa_deposit_to_gl(tenant_session, member, amount, ref_id)

            return {"status": "ok", "message": "Payment credited to savings"}
        finally:
            tenant_session.close()
            tenant_ctx.close()

    except Exception as e:
        print(f"[SunPay Webhook Error] {e}")
        return {"status": "error", "message": str(e)}


@router.post("/organizations/{org_id}/sunpay/stk-push")
async def sunpay_stk_push_endpoint(org_id: str, request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_org_feature(org_id, "mpesa_integration", db):
        raise HTTPException(status_code=403, detail="M-Pesa integration not available in your plan")

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        data = await request.json()
        phone = data.get("phone", "")
        amount = Decimal(str(data.get("amount", 0)))
        external_ref = data.get("external_ref", "")
        loan_id = data.get("loan_id", "")

        if not phone:
            raise HTTPException(status_code=400, detail="Phone number is required")
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")

        if loan_id:
            loan = tenant_session.query(LoanApplication).filter(
                LoanApplication.id == loan_id,
                LoanApplication.status == "disbursed"
            ).first()
            if loan:
                external_ref = f"LOAN:{loan_id}"
            else:
                raise HTTPException(status_code=404, detail="Active loan not found")

        phone = phone.replace("+", "").replace(" ", "")
        if phone.startswith("0"):
            phone = "254" + phone[1:]

        callback_url = f"{str(request.base_url).rstrip('/')}/api/webhooks/sunpay/{org_id}"
        result = await stk_push(tenant_session, phone, amount, external_ref, callback_url)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/organizations/{org_id}/sunpay/c2b-expect")
async def sunpay_c2b_expect_endpoint(org_id: str, request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_org_feature(org_id, "mpesa_integration", db):
        raise HTTPException(status_code=403, detail="M-Pesa integration not available in your plan")

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        data = await request.json()
        amount = Decimal(str(data.get("amount", 0)))
        external_ref = data.get("external_ref", "")

        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        if not external_ref:
            raise HTTPException(status_code=400, detail="External reference (member/account number) is required")

        callback_url = f"{str(request.base_url).rstrip('/')}/api/webhooks/sunpay/{org_id}"
        result = await c2b_expect(tenant_session, amount, external_ref, callback_url)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/organizations/{org_id}/sunpay/b2c")
async def sunpay_b2c_endpoint(org_id: str, request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_org_feature(org_id, "mpesa_integration", db):
        raise HTTPException(status_code=403, detail="M-Pesa integration not available in your plan")

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        data = await request.json()
        phone = data.get("phone", "")
        amount = Decimal(str(data.get("amount", 0)))
        remarks = data.get("remarks", "")
        occasion = data.get("occasion", "")

        if not phone:
            raise HTTPException(status_code=400, detail="Phone number is required")
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")

        phone = phone.replace("+", "").replace(" ", "")
        if phone.startswith("0"):
            phone = "254" + phone[1:]

        result = await b2c_payment(tenant_session, phone, amount, remarks, occasion)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/organizations/{org_id}/sunpay/reversal")
async def sunpay_reversal_endpoint(org_id: str, request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_org_feature(org_id, "mpesa_integration", db):
        raise HTTPException(status_code=403, detail="M-Pesa integration not available in your plan")

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        data = await request.json()
        transaction_id = data.get("transaction_id", "")
        amount = Decimal(str(data.get("amount", 0)))
        receiver_party = data.get("receiver_party", "")
        remarks = data.get("remarks", "")
        occasion = data.get("occasion", "")

        if not transaction_id:
            raise HTTPException(status_code=400, detail="M-Pesa transaction ID is required")
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        if not receiver_party:
            raise HTTPException(status_code=400, detail="Receiver party (shortcode) is required")

        result = await reverse_transaction(tenant_session, transaction_id, amount, receiver_party, remarks, occasion)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/organizations/{org_id}/sunpay/payment-status/{payment_id}")
async def sunpay_payment_status_endpoint(org_id: str, payment_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_org_feature(org_id, "mpesa_integration", db):
        raise HTTPException(status_code=403, detail="M-Pesa integration not available in your plan")

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        result = await check_payment_status(tenant_session, payment_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tenant_session.close()
        tenant_ctx.close()
