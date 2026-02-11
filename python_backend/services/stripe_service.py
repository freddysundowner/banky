import stripe
import os
import httpx


async def get_stripe_credentials():
    hostname = os.environ.get("REPLIT_CONNECTORS_HOSTNAME", "")
    repl_identity = os.environ.get("REPL_IDENTITY", "")
    web_renewal = os.environ.get("WEB_REPL_RENEWAL", "")
    
    if repl_identity:
        token = f"repl {repl_identity}"
    elif web_renewal:
        token = f"depl {web_renewal}"
    else:
        raise Exception("Stripe credentials not available - no Replit token found")
    
    is_production = os.environ.get("REPLIT_DEPLOYMENT") == "1"
    target_env = "production" if is_production else "development"
    
    url = f"https://{hostname}/api/v2/connection?include_secrets=true&connector_names=stripe&environment={target_env}"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers={
            "Accept": "application/json",
            "X_REPLIT_TOKEN": token
        })
        data = resp.json()
    
    items = data.get("items", [])
    if not items:
        raise Exception("Stripe connection not found")
    
    settings = items[0].get("settings", {})
    secret_key = settings.get("secret", "")
    publishable_key = settings.get("publishable", "")
    
    if not secret_key:
        raise Exception("Stripe secret key not found in connection")
    
    return {"secret_key": secret_key, "publishable_key": publishable_key}


async def get_stripe_client():
    creds = await get_stripe_credentials()
    stripe.api_key = creds["secret_key"]
    return stripe


async def create_checkout_session(
    amount_cents: int,
    currency: str,
    plan_name: str,
    success_url: str,
    cancel_url: str,
    metadata: dict = None
):
    s = await get_stripe_client()
    
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


async def retrieve_session(session_id: str):
    s = await get_stripe_client()
    return s.checkout.Session.retrieve(session_id)
