import os
from fastapi import HTTPException, Depends

DEMO_BLOCKED_MESSAGE = (
    "This action is not available in the demo."
)

DEMO_SETTINGS_MESSAGE = (
    "This setting cannot be changed in the demo."
)

SENSITIVE_KEYS = {
    "sms_api_key",
    "mpesa_consumer_key",
    "mpesa_consumer_secret",
    "mpesa_passkey",
    "mpesa_security_credential",
    "brevo_api_key",
    "stripe_secret_key",
    "stripe_publishable_key",
    "paystack_secret_key",
    "paystack_public_key",
    "subscription_sunpay_api_key",
}

CRITICAL_SETTINGS_KEYS = SENSITIVE_KEYS | {
    "currency",
    "currency_symbol",
    "enforce_working_hours",
    "working_hours_start",
    "working_hours_end",
}


def is_demo_mode() -> bool:
    try:
        from models.database import SessionLocal
        from models.master import PlatformSettings
        db = SessionLocal()
        try:
            setting = db.query(PlatformSettings).filter(
                PlatformSettings.setting_key == "demo_mode"
            ).first()
            if setting is not None:
                return setting.setting_value.lower() == "true"
        finally:
            db.close()
    except Exception:
        pass
    return os.environ.get("VITE_PRODUCTION_MODE", "").lower() == "demo"


def require_not_demo():
    """FastAPI dependency — raises 403 when running in demo mode."""
    if is_demo_mode():
        raise HTTPException(status_code=403, detail=DEMO_BLOCKED_MESSAGE)


def mask_if_demo(value: str) -> str:
    """Return a masked placeholder for sensitive values in demo mode."""
    if is_demo_mode() and value:
        return "••••••••••••"
    return value


def mask_settings_for_demo(settings: list[dict]) -> list[dict]:
    """
    Given a list of {'key': ..., 'value': ...} dicts, mask any sensitive
    values when running in demo mode.
    """
    if not is_demo_mode():
        return settings
    return [
        {**s, "value": mask_if_demo(s.get("value", "")) if s.get("key") in SENSITIVE_KEYS else s.get("value", "")}
        for s in settings
    ]


def block_critical_settings(updates: dict):
    """
    Raise 403 if any critical/sensitive settings key is being updated while
    in demo mode.
    """
    if not is_demo_mode():
        return
    blocked = CRITICAL_SETTINGS_KEYS & set(updates.keys())
    if blocked:
        raise HTTPException(status_code=403, detail=DEMO_SETTINGS_MESSAGE)
