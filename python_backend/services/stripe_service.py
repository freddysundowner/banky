import stripe
import os


def get_stripe_credentials_from_db(db):
    from models.master import PlatformSettings
    settings = {s.setting_key: s.setting_value for s in db.query(PlatformSettings).filter(
        PlatformSettings.setting_key.in_(["stripe_secret_key", "stripe_publishable_key"])
    ).all()}

    secret_key = settings.get("stripe_secret_key", "")
    publishable_key = settings.get("stripe_publishable_key", "")

    if not secret_key:
        raise Exception("Stripe secret key not configured. Set it in Admin Panel > Settings > Payments.")

    return {"secret_key": secret_key, "publishable_key": publishable_key}


def get_stripe_client(db):
    creds = get_stripe_credentials_from_db(db)
    stripe.api_key = creds["secret_key"]
    return stripe


async def create_checkout_session(
    db,
    amount_cents: int,
    currency: str,
    plan_name: str,
    success_url: str,
    cancel_url: str,
    metadata: dict = None
):
    s = get_stripe_client(db)

    session = s.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": currency.lower(),
                "product_data": {
                    "name": f"BANKY - {plan_name} Plan Subscription",
                },
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata or {}
    )

    return session


async def retrieve_session(db, session_id: str):
    s = get_stripe_client(db)
    return s.checkout.Session.retrieve(session_id)
