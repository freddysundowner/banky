from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime, timedelta
import httpx
import os

from models.database import get_db
from middleware.demo_guard import require_not_demo
from models.master import (
    Organization, OrganizationSubscription, SubscriptionPlan,
    SubscriptionPayment, PlatformSettings, OrganizationMember
)
from routes.auth import get_current_user
from services.exchange_rate import fetch_exchange_rates, convert_usd_to

router = APIRouter()

DARAJA_SANDBOX_URL = "https://sandbox.safaricom.co.ke"
DARAJA_PRODUCTION_URL = "https://api.safaricom.co.ke"


def get_platform_mpesa_config(db: Session) -> dict:
    keys = ["subscription_mpesa_consumer_key", "subscription_mpesa_consumer_secret",
            "subscription_mpesa_passkey", "subscription_mpesa_shortcode"]
    settings = db.query(PlatformSettings).filter(
        PlatformSettings.setting_key.in_(keys)
    ).all()
    config = {s.setting_key: s.setting_value for s in settings if s.setting_value}
    if not config.get("subscription_mpesa_consumer_key") or not config.get("subscription_mpesa_consumer_secret"):
        raise HTTPException(status_code=400, detail="Platform M-Pesa payments not configured. Contact admin.")
    return config


async def get_daraja_token(consumer_key: str, consumer_secret: str, is_production: bool = False) -> str:
    base_url = DARAJA_PRODUCTION_URL if is_production else DARAJA_SANDBOX_URL
    import base64
    credentials = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{base_url}/oauth/v1/generate?grant_type=client_credentials",
            headers={"Authorization": f"Basic {credentials}"}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to authenticate with M-Pesa")
        return resp.json()["access_token"]


async def daraja_stk_push(config: dict, phone: str, amount: float, account_ref: str, callback_url: str, is_production: bool = False) -> dict:
    from datetime import datetime as dt
    import base64
    base_url = DARAJA_PRODUCTION_URL if is_production else DARAJA_SANDBOX_URL
    shortcode = config.get("subscription_mpesa_shortcode", "174379")
    passkey = config.get("subscription_mpesa_passkey", "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919")
    timestamp = dt.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()
    token = await get_daraja_token(config["subscription_mpesa_consumer_key"], config["subscription_mpesa_consumer_secret"], is_production)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{base_url}/mpesa/stkpush/v1/processrequest",
            json={
                "BusinessShortCode": shortcode,
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": "CustomerPayBillOnline",
                "Amount": int(amount),
                "PartyA": phone,
                "PartyB": shortcode,
                "PhoneNumber": phone,
                "CallBackURL": callback_url,
                "AccountReference": account_ref,
                "TransactionDesc": "Subscription Payment"
            },
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        )
        return resp.json()


@router.post("/{organization_id}/subscription/pay-mpesa", dependencies=[Depends(require_not_demo)])
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

    # Prices are stored directly in KES — no conversion needed.
    if billing_period == "annual" and plan.annual_price and float(plan.annual_price) > 0:
        amount = round(float(plan.annual_price))
        period_days = 365
    else:
        amount = round(float(plan.monthly_price))
        period_days = 30
        billing_period = "monthly"

    if amount <= 0:
        raise HTTPException(status_code=400, detail="This plan has no price set. Contact admin.")

    mpesa_config = get_platform_mpesa_config(db)

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

    account_ref = f"SUB:{payment.id}"

    try:
        result = await daraja_stk_push(mpesa_config, phone, amount, account_ref, callback_url)

        if result.get("ResponseCode") != "0" and not result.get("CheckoutRequestID"):
            payment.status = "failed"
            db.commit()
            print(f"[Subscription] STK Push failed: {result}")
            raise HTTPException(status_code=400, detail="Failed to initiate M-Pesa payment. Please try again.")

        payment.mpesa_checkout_id = result.get("CheckoutRequestID", "")
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
            mpesa_config = get_platform_mpesa_config(db)
            import base64
            from datetime import datetime as dt
            shortcode = mpesa_config.get("subscription_mpesa_shortcode", "174379")
            passkey = mpesa_config.get("subscription_mpesa_passkey", "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919")
            timestamp = dt.now().strftime("%Y%m%d%H%M%S")
            password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()
            token = await get_daraja_token(mpesa_config["subscription_mpesa_consumer_key"], mpesa_config["subscription_mpesa_consumer_secret"])
            base_url = DARAJA_SANDBOX_URL
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{base_url}/mpesa/stkpushquery/v1/query",
                    json={
                        "BusinessShortCode": shortcode,
                        "Password": password,
                        "Timestamp": timestamp,
                        "CheckoutRequestID": payment.mpesa_checkout_id
                    },
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                )
                if resp.status_code < 400:
                    data = resp.json()
                    result_code = str(data.get("ResultCode", ""))
                    receipt = data.get("MpesaReceiptNumber", "")

                    if result_code == "0":
                        activate_subscription(db, payment, receipt or "")
                        print(f"[Subscription Poll] Payment {payment_id} confirmed via Daraja query")
                    elif result_code in ("1032", "1037"):
                        payment.status = "failed"
                        db.commit()
                        print(f"[Subscription Poll] Payment {payment_id} cancelled: {result_code}")
        except Exception as e:
            print(f"[Subscription Poll] Error querying Daraja: {e}")

    if payment.status == "awaiting_payment" and payment.stripe_session_id:
        try:
            from services.stripe_service import retrieve_session
            session = await retrieve_session(db, payment.stripe_session_id)
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


@router.post("/{organization_id}/subscription/pay-stripe", dependencies=[Depends(require_not_demo)])
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

    # Prices are stored in KES — convert to USD for Stripe.
    if billing_period == "annual" and plan.annual_price and float(plan.annual_price) > 0:
        amount_kes = round(float(plan.annual_price))
        period_days = 365
    else:
        amount_kes = round(float(plan.monthly_price))
        period_days = 30
        billing_period = "monthly"

    if amount_kes <= 0:
        raise HTTPException(status_code=400, detail="Price not set for this plan. Contact admin.")

    rates = await fetch_exchange_rates()
    kes_rate = rates.get("KES", 130.0)
    amount_usd = round(amount_kes / kes_rate, 2)
    amount_cents = int(amount_usd * 100)

    payment = SubscriptionPayment(
        organization_id=organization_id,
        plan_id=plan_id,
        amount=Decimal(str(amount_kes)),
        currency="KES",
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
            db=db,
            amount_cents=amount_cents,
            currency="usd",
            plan_name=plan.name,
            success_url=f"{base_url}/api/stripe-return?status=success&payment_id={payment.id}",
            cancel_url=f"{base_url}/api/stripe-return?status=cancelled&payment_id={payment.id}",
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

        print(f"[Subscription] Stripe session created for org {org.name}, plan {plan.name}, KES {amount_kes} (${amount_usd} USD)")

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


@router.post("/{organization_id}/subscription/pay-paystack", dependencies=[Depends(require_not_demo)])
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
    currency_override = data.get("currency")

    if currency_override and currency_override.upper() in ("NGN", "KES", "GHS", "ZAR", "USD"):
        currency = currency_override.upper()
    else:
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

    # Prices are stored in KES. For non-KES Paystack currencies convert via exchange rate.
    if billing_period == "annual" and plan.annual_price and float(plan.annual_price) > 0:
        amount_kes = round(float(plan.annual_price))
        period_days = 365
    else:
        amount_kes = round(float(plan.monthly_price))
        period_days = 30
        billing_period = "monthly"

    if amount_kes <= 0:
        raise HTTPException(status_code=400, detail="Price not set for this plan. Contact admin.")

    if currency == "KES":
        amount = amount_kes
    else:
        rates = await fetch_exchange_rates()
        kes_rate = rates.get("KES", 130.0)
        target_rate = rates.get(currency, 1.0)
        amount = round(amount_kes / kes_rate * target_rate)

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

    reference = f"BANKYKIT-SUB-{payment.id}"

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

        from services.paystack_service import get_paystack_public_key
        public_key = get_paystack_public_key(db)

        return {
            "success": True,
            "authorization_url": result["authorization_url"],
            "access_code": result.get("access_code", ""),
            "public_key": public_key,
            "payment_id": payment.id,
            "reference": reference,
            "email": email,
            "amount": amount_minor,
            "currency": currency
        }

    except HTTPException:
        raise
    except Exception as e:
        payment.status = "failed"
        db.commit()
        print(f"[Subscription] Paystack error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize Paystack payment")


@router.get("/{organization_id}/subscription/stripe-key")
async def get_stripe_publishable_key(organization_id: str, auth=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        from services.stripe_service import get_stripe_credentials_from_db
        creds = get_stripe_credentials_from_db(db)
        return {"publishable_key": creds["publishable_key"]}
    except Exception as e:
        print(f"[Stripe] Error fetching publishable key: {e}")
        return {"publishable_key": ""}
