from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime, timedelta
import httpx
import os

from models.database import get_db
from models.master import (
    Organization, OrganizationSubscription, SubscriptionPlan,
    SubscriptionPayment, PlatformSettings, OrganizationMember
)
from routes.auth import get_current_user

router = APIRouter()

SUNPAY_BASE_URL = "https://sunpay.co.ke/api/v1"


def get_platform_sunpay_key(db: Session) -> str:
    setting = db.query(PlatformSettings).filter(
        PlatformSettings.setting_key == "subscription_sunpay_api_key"
    ).first()
    if not setting or not setting.setting_value:
        raise HTTPException(status_code=400, detail="Platform M-Pesa payments not configured. Contact admin.")
    return setting.setting_value


@router.post("/{organization_id}/subscription/pay-mpesa")
async def initiate_subscription_payment(organization_id: str, data: dict, auth=Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not auth.is_staff:
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == auth.user.id,
            OrganizationMember.is_owner == True
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Only organization owners can make subscription payments")

    plan_id = data.get("plan_id")
    phone = data.get("phone", "").replace("+", "").replace(" ", "")
    billing_period = data.get("billing_period", "monthly")

    if not plan_id or not phone:
        raise HTTPException(status_code=400, detail="plan_id and phone are required")

    if phone.startswith("0"):
        phone = "254" + phone[1:]
    if not phone.startswith("254"):
        phone = "254" + phone

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if billing_period == "annual" and plan.annual_price and float(plan.annual_price) > 0:
        amount = float(plan.annual_price)
        period_days = 365
    else:
        amount = float(plan.monthly_price)
        period_days = 30
        billing_period = "monthly"

    if amount <= 0:
        raise HTTPException(status_code=400, detail="This plan has no price set. Contact admin.")

    api_key = get_platform_sunpay_key(db)

    payment = SubscriptionPayment(
        organization_id=organization_id,
        plan_id=plan_id,
        amount=Decimal(str(amount)),
        phone_number=phone,
        billing_period=billing_period,
        status="pending"
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    public_domain = os.environ.get("REPLIT_DEV_DOMAIN", "") or os.environ.get("REPL_SLUG", "")
    if public_domain and not public_domain.startswith("http"):
        callback_url = f"https://{public_domain}/api/webhooks/subscription-payment"
    else:
        callback_url = f"{public_domain}/api/webhooks/subscription-payment" if public_domain else ""

    external_ref = f"SUB:{payment.id}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{SUNPAY_BASE_URL}/payments/stk-push",
                json={
                    "phoneNumber": phone,
                    "amount": amount,
                    "externalRef": external_ref,
                    "callbackUrl": callback_url
                },
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
            )

            if response.status_code >= 400:
                payment.status = "failed"
                db.commit()
                error_data = response.json() if "json" in response.headers.get("content-type", "") else {"error": response.text}
                print(f"[Subscription] STK Push failed: {error_data}")
                raise HTTPException(status_code=400, detail="Failed to initiate M-Pesa payment. Please try again.")

            result = response.json()
            payment.mpesa_checkout_id = result.get("checkoutRequestId", result.get("CheckoutRequestID", ""))
            payment.status = "awaiting_payment"
            db.commit()

            print(f"[Subscription] STK Push sent for org {org.name}, plan {plan.name}, amount {amount}, phone {phone}")

            return {
                "success": True,
                "message": "M-Pesa payment prompt sent to your phone. Enter your PIN to complete payment.",
                "payment_id": payment.id,
                "checkout_id": payment.mpesa_checkout_id
            }

    except HTTPException:
        raise
    except Exception as e:
        payment.status = "failed"
        db.commit()
        print(f"[Subscription] STK Push error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate M-Pesa payment")


@router.get("/{organization_id}/subscription/payments")
def get_subscription_payments(organization_id: str, auth=Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    payments = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.organization_id == organization_id
    ).order_by(SubscriptionPayment.created_at.desc()).limit(20).all()

    return [{
        "id": p.id,
        "amount": float(p.amount),
        "currency": p.currency,
        "payment_method": p.payment_method,
        "mpesa_receipt": p.mpesa_receipt,
        "phone_number": p.phone_number,
        "status": p.status,
        "billing_period": p.billing_period,
        "period_start": p.period_start.isoformat() if p.period_start else None,
        "period_end": p.period_end.isoformat() if p.period_end else None,
        "plan_name": p.plan.name if p.plan else None,
        "created_at": p.created_at.isoformat() if p.created_at else None
    } for p in payments]


@router.get("/{organization_id}/subscription/check-payment/{payment_id}")
def check_payment_status(organization_id: str, payment_id: str, auth=Depends(get_current_user), db: Session = Depends(get_db)):
    payment = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.id == payment_id,
        SubscriptionPayment.organization_id == organization_id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    return {
        "status": payment.status,
        "mpesa_receipt": payment.mpesa_receipt
    }
