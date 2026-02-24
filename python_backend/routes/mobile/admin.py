"""
Mobile Banking Admin Routes — /api/mobile/admin/*

Staff-facing endpoints to manage member mobile banking.
Uses the same staff session authentication as the main app (imports get_current_user).
Does NOT modify any existing route files.

  POST   /admin/{org_id}/members/{member_id}/activate          — staff generates activation code + sends SMS
  GET    /admin/{org_id}/members/{member_id}/activity          — returns mobile session history
  DELETE /admin/{org_id}/members/{member_id}/deactivate-mobile — staff resets mobile access (lost phone, etc.)
"""

import uuid
import random
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from models.database import get_db

router = APIRouter(prefix="/admin")

ACTIVATION_CODE_LENGTH = 8
ACTIVATION_EXPIRY_HOURS = 12


def _generate_activation_code() -> str:
    chars = string.ascii_uppercase + string.digits
    chars = chars.replace("O", "").replace("0", "").replace("I", "").replace("1", "")
    return "".join(random.choices(chars, k=ACTIVATION_CODE_LENGTH))


def _get_staff_auth(request: Request, db: Session = Depends(get_db)):
    from routes.auth import get_current_user
    return get_current_user(request, db)


@router.post("/{org_id}/members/{member_id}/activate")
async def staff_activate_mobile(
    org_id: str,
    member_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Staff triggers mobile banking activation for a member.
    Generates a one-time activation code (8 chars, 12h expiry) and sends it via SMS.
    """
    from routes.auth import get_current_user
    from models.tenant import Member
    from models.master import Organization
    from services.tenant_context import get_tenant_context_simple

    auth = get_current_user(request, db)
    if not auth.is_staff or auth.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    tenant_ctx = get_tenant_context_simple(org_id, db)
    if not tenant_ctx:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

        if member.status != "active":
            raise HTTPException(status_code=400, detail="Member account must be active before enabling mobile banking")

        activation_code = _generate_activation_code()
        member.mobile_activation_code = activation_code
        member.mobile_activation_expires_at = datetime.utcnow() + timedelta(hours=ACTIVATION_EXPIRY_HOURS)
        tenant_session.commit()

        sms_sent = False
        try:
            from routes.sms import send_sms
            message = (
                f"Dear {member.first_name}, your {org.name} mobile banking activation code is: "
                f"{activation_code}. Valid for {ACTIVATION_EXPIRY_HOURS} hours. "
                f"Download the app and use this code to activate your account."
            )
            send_sms(member.phone, message, tenant_session)
            sms_sent = True
        except Exception:
            sms_sent = False

        return {
            "success": True,
            "activation_code": activation_code,
            "expires_at": member.mobile_activation_expires_at.isoformat(),
            "expires_hours": ACTIVATION_EXPIRY_HOURS,
            "sms_sent": sms_sent,
            "member_name": f"{member.first_name} {member.last_name}",
            "member_phone": member.phone,
            "message": (
                f"Activation code generated. {'SMS sent to member.' if sms_sent else 'SMS could not be sent — share the code manually.'}"
            )
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/members/{member_id}/activity")
async def get_member_mobile_activity(
    org_id: str,
    member_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Returns mobile session history for a member (newest first, max 20).
    Used by the staff member profile page to display mobile activity.
    """
    from routes.auth import get_current_user
    from models.tenant import Member, MobileSession
    from services.tenant_context import get_tenant_context_simple

    auth = get_current_user(request, db)
    if not auth.is_staff or auth.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    tenant_ctx = get_tenant_context_simple(org_id, db)
    if not tenant_ctx:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

        sessions = (
            tenant_session.query(MobileSession)
            .filter(MobileSession.member_id == member_id)
            .order_by(MobileSession.login_at.desc())
            .limit(20)
            .all()
        )

        activation_pending = bool(
            member.mobile_activation_code
            and member.mobile_activation_expires_at
            and datetime.utcnow() < member.mobile_activation_expires_at
        )

        return {
            "mobile_banking_active": bool(member.mobile_banking_active),
            "mobile_device_id": member.mobile_device_id,
            "activation_pending": activation_pending,
            "activation_expires_at": (
                member.mobile_activation_expires_at.isoformat()
                if member.mobile_activation_expires_at
                else None
            ),
            "sessions": [
                {
                    "id": s.id,
                    "device_id": s.device_id,
                    "device_name": s.device_name,
                    "ip_address": s.ip_address,
                    "login_at": s.login_at.isoformat() if s.login_at else None,
                    "last_active": s.last_active.isoformat() if s.last_active else None,
                    "is_active": s.is_active,
                    "logout_at": s.logout_at.isoformat() if s.logout_at else None,
                }
                for s in sessions
            ],
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.delete("/{org_id}/members/{member_id}/deactivate-mobile")
async def staff_deactivate_mobile(
    org_id: str,
    member_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Staff deactivates mobile banking for a member (e.g. lost phone).
    Clears device binding, PIN, and invalidates all active sessions.
    Member can re-activate from scratch.
    """
    from routes.auth import get_current_user
    from models.tenant import Member, MobileSession
    from services.tenant_context import get_tenant_context_simple

    auth = get_current_user(request, db)
    if not auth.is_staff or auth.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    tenant_ctx = get_tenant_context_simple(org_id, db)
    if not tenant_ctx:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

        member.mobile_banking_active = False
        member.mobile_device_id = None
        member.mobile_activation_code = None
        member.mobile_activation_expires_at = None
        member.pin_hash = None

        tenant_session.query(MobileSession).filter(
            MobileSession.member_id == member_id,
            MobileSession.is_active == True,
        ).update({"is_active": False, "logout_at": datetime.utcnow()})

        tenant_session.commit()
        return {"success": True, "message": "Mobile banking deactivated. Member can re-activate using a new code."}
    finally:
        tenant_session.close()
        tenant_ctx.close()
