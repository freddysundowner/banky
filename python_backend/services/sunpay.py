import httpx
from decimal import Decimal
from models.tenant import OrganizationSettings

BASE_URL = "https://sunpay.co.ke/api/v1"


def get_sunpay_api_key(tenant_session) -> str:
    setting = tenant_session.query(OrganizationSettings).filter(
        OrganizationSettings.setting_key == "sunpay_api_key"
    ).first()
    if not setting or not setting.setting_value:
        raise Exception("SunPay API key not configured")
    return setting.setting_value


def _headers(api_key: str) -> dict:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }


async def stk_push(tenant_session, phone: str, amount: Decimal, external_ref: str = None, callback_url: str = "") -> dict:
    api_key = get_sunpay_api_key(tenant_session)

    clean_phone = phone.replace("+", "").strip()
    if not clean_phone.startswith("254"):
        clean_phone = "254" + clean_phone.lstrip("0")

    payload = {
        "phoneNumber": clean_phone,
        "amount": float(amount),
    }
    if external_ref:
        payload["externalRef"] = external_ref
    if callback_url:
        payload["callbackUrl"] = callback_url

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/payments/stk-push",
            json=payload,
            headers=_headers(api_key)
        )
        if response.status_code >= 400:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
            return {"success": False, "error": error_data, "status_code": response.status_code}
        return {**response.json(), "success": True}


async def c2b_expect(tenant_session, amount: Decimal, external_ref: str, callback_url: str = "") -> dict:
    api_key = get_sunpay_api_key(tenant_session)

    payload = {
        "amount": float(amount),
        "externalRef": external_ref,
    }
    if callback_url:
        payload["callbackUrl"] = callback_url

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/payments/expect",
            json=payload,
            headers=_headers(api_key)
        )
        if response.status_code >= 400:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
            return {"success": False, "error": error_data, "status_code": response.status_code}
        return response.json()


async def b2c_payment(tenant_session, phone: str, amount: Decimal, remarks: str = "", occasion: str = "", callback_url: str = "") -> dict:
    api_key = get_sunpay_api_key(tenant_session)

    payload = {
        "phoneNumber": phone,
        "amount": float(amount),
    }
    if remarks:
        payload["remarks"] = remarks
    if occasion:
        payload["occasion"] = occasion
    if callback_url:
        payload["callbackUrl"] = callback_url

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/payments/b2c",
            json=payload,
            headers=_headers(api_key)
        )
        if response.status_code >= 400:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
            return {"success": False, "error": error_data, "status_code": response.status_code}
        return {**response.json(), "success": True}


async def reverse_transaction(tenant_session, transaction_id: str, amount: Decimal, receiver_party: str, remarks: str = "", occasion: str = "") -> dict:
    api_key = get_sunpay_api_key(tenant_session)

    payload = {
        "transactionId": transaction_id,
        "amount": float(amount),
        "receiverParty": receiver_party,
    }
    if remarks:
        payload["remarks"] = remarks
    if occasion:
        payload["occasion"] = occasion

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/payments/reversal",
            json=payload,
            headers=_headers(api_key)
        )
        if response.status_code >= 400:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
            return {"success": False, "error": error_data, "status_code": response.status_code}
        return response.json()


async def check_payment_status(tenant_session, transaction_id: str) -> dict:
    api_key = get_sunpay_api_key(tenant_session)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/payments/{transaction_id}",
            headers=_headers(api_key)
        )
        if response.status_code >= 400:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
            return {"success": False, "error": error_data, "status_code": response.status_code}
        return response.json()
