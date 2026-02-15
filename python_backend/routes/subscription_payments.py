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
from services.exchange_rate import fetch_exchange_rates, convert_usd_to

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
        amount_usd = float(plan.annual_price)
        period_days = 365
    else:
        amount_usd = float(plan.monthly_price)
        period_days = 30
        billing_period = "monthly"

    if amount_usd <= 0:
        raise HTTPException(status_code=400, detail="This plan has no price set. Contact admin.")

    rates = await fetch_exchange_rates()
    amount = convert_usd_to(amount_usd, "KES", rates)

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Currency conversion error. Contact admin.")

    api_key = get_platform_sunpay_key(db)

    payment = SubscriptionPayment(
        organization_id=organization_id,
        plan_id=plan_id,
        amount=Decimal(str(amount)),
        currency="KES",
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


def activate_subscription(db: Session, payment: SubscriptionPayment, receipt: str = ""):
    now = datetime.utcnow()
    payment.status = "completed"
    payment.mpesa_receipt = receipt
    payment.payment_reference = receipt
    period_days = 365 if payment.billing_period == "annual" else 30
    payment.period_start = now
    payment.period_end = now + timedelta(days=period_days)

    sub = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == payment.organization_id
    ).first()

    if sub:
        sub.plan_id = payment.plan_id
        sub.status = "active"
        if sub.current_period_end and sub.current_period_end > now:
            sub.current_period_end = sub.current_period_end + timedelta(days=period_days)
        else:
            sub.current_period_start = now
            sub.current_period_end = now + timedelta(days=period_days)
    else:
        new_sub = OrganizationSubscription(
            organization_id=payment.organization_id,
            plan_id=payment.plan_id,
            status="active",
            current_period_start=now,
            current_period_end=now + timedelta(days=period_days)
        )
        db.add(new_sub)

    db.commit()
    print(f"[Subscription] Activated for org {payment.organization_id}, plan {payment.plan_id}")


@router.get("/{organization_id}/subscription/check-payment/{payment_id}")
async def check_payment_status_endpoint(organization_id: str, payment_id: str, auth=Depends(get_current_user), db: Session = Depends(get_db)):
    payment = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.id == payment_id,
        SubscriptionPayment.organization_id == organization_id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.status == "awaiting_payment" and payment.mpesa_checkout_id:
        try:
            api_key = get_platform_sunpay_key(db)
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{SUNPAY_BASE_URL}/payments/{payment.mpesa_checkout_id}",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                )
                if resp.status_code < 400:
                    data = resp.json()
                    result_code = str(data.get("resultCode", data.get("ResultCode", "")))
                    receipt = data.get("mpesaRef", data.get("MpesaRef", data.get("receipt", "")))
                    status_field = str(data.get("status", "")).lower()

                    if result_code == "0" or status_field in ("completed", "success"):
                        activate_subscription(db, payment, receipt or "")
                        print(f"[Subscription Poll] Payment {payment_id} confirmed via API query")
                    elif result_code and result_code != "0" and result_code != "":
                        if status_field in ("failed", "cancelled"):
                            payment.status = "failed"
                            db.commit()
                            print(f"[Subscription Poll] Payment {payment_id} failed: {result_code}")
        except Exception as e:
            print(f"[Subscription Poll] Error querying SunPay: {e}")

    if payment.status == "awaiting_payment" and payment.stripe_session_id:
        try:
            from services.stripe_service import retrieve_session
            session = await retrieve_session(payment.stripe_session_id)
            if session.payment_status == "paid":
                receipt = session.payment_intent if hasattr(session, 'payment_intent') else session.id
                activate_subscription(db, payment, str(receipt))
                print(f"[Subscription Poll] Stripe payment {payment_id} confirmed")
            elif session.status == "expired":
                payment.status = "failed"
                db.commit()
        except Exception as e:
            print(f"[Subscription Poll] Error querying Stripe: {e}")

    if payment.status == "awaiting_payment" and payment.paystack_reference:
        try:
            from services.paystack_service import verify_transaction
            result = await verify_transaction(db, payment.paystack_reference)
            if result.get("success") and result.get("status") == "success":
                activate_subscription(db, payment, payment.paystack_reference)
                print(f"[Subscription Poll] Paystack payment {payment_id} confirmed")
            elif result.get("status") in ("failed", "abandoned"):
                payment.status = "failed"
                db.commit()
        except Exception as e:
            print(f"[Subscription Poll] Error querying Paystack: {e}")

    return {
        "status": payment.status,
        "mpesa_receipt": payment.mpesa_receipt,
        "payment_method": payment.payment_method
    }


@router.post("/{organization_id}/subscription/pay-stripe")
async def initiate_stripe_payment(organization_id: str, data: dict, auth=Depends(get_current_user), db: Session = Depends(get_db)):
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
    billing_period = data.get("billing_period", "monthly")

    if not plan_id:
        raise HTTPException(status_code=400, detail="plan_id is required")

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if billing_period == "annual" and plan.annual_price and float(plan.annual_price) > 0:
        amount_usd = float(plan.annual_price)
        period_days = 365
    else:
        amount_usd = float(plan.monthly_price)
        period_days = 30
        billing_period = "monthly"

    if amount_usd <= 0:
        raise HTTPException(status_code=400, detail="USD price not set for this plan. Contact admin.")

    amount_cents = int(amount_usd * 100)

    payment = SubscriptionPayment(
        organization_id=organization_id,
        plan_id=plan_id,
        amount=Decimal(str(amount_usd)),
        currency="USD",
        payment_method="stripe",
        billing_period=billing_period,
        status="pending"
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    public_domain = os.environ.get("REPLIT_DEV_DOMAIN", "") or os.environ.get("REPL_SLUG", "")
    if public_domain and not public_domain.startswith("http"):
        base_url = f"https://{public_domain}"
    else:
        base_url = public_domain or "http://localhost:5000"

    try:
        from services.stripe_service import create_checkout_session
        session = await create_checkout_session(
            amount_cents=amount_cents,
            currency="usd",
            plan_name=plan.name,
            success_url=f"{base_url}/dashboard?payment=success&payment_id={payment.id}",
            cancel_url=f"{base_url}/upgrade?payment=cancelled",
            metadata={
                "payment_id": payment.id,
                "organization_id": organization_id,
                "plan_id": plan_id,
                "billing_period": billing_period
            }
        )

        payment.stripe_session_id = session.id
        payment.status = "awaiting_payment"
        db.commit()

        print(f"[Subscription] Stripe session created for org {org.name}, plan {plan.name}, amount ${amount_usd}")

        return {
            "success": True,
            "checkout_url": session.url,
            "payment_id": payment.id,
            "session_id": session.id
        }

    except Exception as e:
        payment.status = "failed"
        db.commit()
        print(f"[Subscription] Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create Stripe checkout session")


@router.post("/{organization_id}/subscription/pay-paystack")
async def initiate_paystack_payment(organization_id: str, data: dict, auth=Depends(get_current_user), db: Session = Depends(get_db)):
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
    email = data.get("email", "")
    billing_period = data.get("billing_period", "monthly")
    channels = data.get("channels")

    paystack_currency_setting = db.query(PlatformSettings).filter(
        PlatformSettings.setting_key == "paystack_currency"
    ).first()
    currency = (paystack_currency_setting.setting_value if paystack_currency_setting else "NGN").upper()

    if currency not in ("NGN", "KES", "GHS", "ZAR", "USD"):
        currency = "NGN"

    if not plan_id or not email:
        raise HTTPException(status_code=400, detail="plan_id and email are required")

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if billing_period == "annual" and plan.annual_price and float(plan.annual_price) > 0:
        amount_usd = float(plan.annual_price)
        period_days = 365
    else:
        amount_usd = float(plan.monthly_price)
        period_days = 30
        billing_period = "monthly"

    if amount_usd <= 0:
        raise HTTPException(status_code=400, detail="Price not set for this plan. Contact admin.")

    rates = await fetch_exchange_rates()
    amount = convert_usd_to(amount_usd, currency, rates)

    amount_minor = int(amount * 100)

    payment = SubscriptionPayment(
        organization_id=organization_id,
        plan_id=plan_id,
        amount=Decimal(str(amount)),
        currency=currency,
        payment_method="paystack",
        billing_period=billing_period,
        status="pending"
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    reference = f"BANKY-SUB-{payment.id}"

    public_domain = os.environ.get("REPLIT_DEV_DOMAIN", "") or os.environ.get("REPL_SLUG", "")
    if public_domain and not public_domain.startswith("http"):
        callback_url = f"https://{public_domain}/upgrade?payment=success&payment_id={payment.id}"
    else:
        callback_url = f"{public_domain}/upgrade?payment=success&payment_id={payment.id}" if public_domain else ""

    try:
        from services.paystack_service import initialize_transaction
        result = await initialize_transaction(
            db=db,
            email=email,
            amount_kobo=amount_minor,
            currency=currency,
            reference=reference,
            callback_url=callback_url,
            metadata={
                "payment_id": payment.id,
                "organization_id": organization_id,
                "plan_id": plan_id,
                "billing_period": billing_period
            },
            channels=channels
        )

        if not result.get("success"):
            payment.status = "failed"
            db.commit()
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to initialize Paystack payment"))

        payment.paystack_reference = reference
        payment.paystack_access_code = result.get("access_code", "")
        payment.status = "awaiting_payment"
        db.commit()

        print(f"[Subscription] Paystack transaction initialized for org {org.name}, plan {plan.name}, amount {currency} {amount}")

        return {
            "success": True,
            "authorization_url": result["authorization_url"],
            "payment_id": payment.id,
            "reference": reference
        }

    except HTTPException:
        raise
    except Exception as e:
        payment.status = "failed"
        db.commit()
        print(f"[Subscription] Paystack error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize Paystack payment")


@router.get("/{organization_id}/subscription/stripe-key")
async def get_stripe_publishable_key(organization_id: str, auth=Depends(get_current_user)):
    try:
        from services.stripe_service import get_stripe_credentials
        creds = await get_stripe_credentials()
        return {"publishable_key": creds["publishable_key"]}
    except Exception as e:
        print(f"[Stripe] Error fetching publishable key: {e}")
        return {"publishable_key": ""}
