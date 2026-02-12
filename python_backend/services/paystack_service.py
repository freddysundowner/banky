import httpx
from sqlalchemy.orm import Session
from models.master import PlatformSettings

PAYSTACK_BASE_URL = "https://api.paystack.co"


def get_paystack_secret_key(db: Session) -> str:
    setting = db.query(PlatformSettings).filter(
        PlatformSettings.setting_key == "paystack_secret_key"
    ).first()
    if not setting or not setting.setting_value:
        raise Exception("Paystack secret key not configured. Contact admin.")
    return setting.setting_value


def get_paystack_public_key(db: Session) -> str:
    setting = db.query(PlatformSettings).filter(
        PlatformSettings.setting_key == "paystack_public_key"
    ).first()
    if not setting or not setting.setting_value:
        return ""
    return setting.setting_value


def _headers(secret_key: str) -> dict:
    return {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json"
    }


async def initialize_transaction(
    db: Session,
    email: str,
    amount_kobo: int,
    currency: str,
    reference: str,
    callback_url: str = "",
    metadata: dict = None,
    channels: list = None
) -> dict:
    secret_key = get_paystack_secret_key(db)
    
    payload = {
        "email": email,
        "amount": amount_kobo,
        "currency": currency.upper(),
        "reference": reference,
    }
    if callback_url:
        payload["callback_url"] = callback_url
    if metadata:
        payload["metadata"] = metadata
    if channels:
        payload["channels"] = channels
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{PAYSTACK_BASE_URL}/transaction/initialize",
            json=payload,
            headers=_headers(secret_key)
        )
        data = resp.json()
        
        if not data.get("status"):
            return {"success": False, "error": data.get("message", "Failed to initialize payment")}
        
        return {
            "success": True,
            "authorization_url": data["data"]["authorization_url"],
            "access_code": data["data"]["access_code"],
            "reference": data["data"]["reference"]
        }


async def verify_transaction(db: Session, reference: str) -> dict:
    secret_key = get_paystack_secret_key(db)
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
            headers=_headers(secret_key)
        )
        data = resp.json()
        
        if not data.get("status"):
            return {"success": False, "error": data.get("message", "Verification failed")}
        
        tx_data = data.get("data", {})
        return {
            "success": True,
            "status": tx_data.get("status", ""),
            "reference": tx_data.get("reference", ""),
            "amount": tx_data.get("amount", 0),
            "currency": tx_data.get("currency", ""),
            "gateway_response": tx_data.get("gateway_response", "")
        }
