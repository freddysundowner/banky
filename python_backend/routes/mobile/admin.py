"""
Mobile Banking Admin Routes — /api/mobile/admin/*

Staff-facing endpoints to manage member mobile banking.
Uses the same staff session authentication as the main app (imports get_current_user).
Does NOT modify any existing route files.

  POST   /admin/{org_id}/members/{member_id}/activate          — staff generates activation code + sends SMS
  GET    /admin/{org_id}/members/{member_id}/activity          — returns mobile session history
  DELETE /admin/{org_id}/members/{member_id}/deactivate-mobile — staff resets mobile access (lost phone, etc.)
"""

import secrets
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from models.database import get_db
from routes.common import get_tenant_session_context, require_role

router = APIRouter(prefix="/admin")

ACTIVATION_CODE_LENGTH = 8
ACTIVATION_EXPIRY_HOURS = 12


def _generate_activation_code() -> str:
    chars = string.ascii_uppercase + string.digits
    chars = chars.replace("O", "").replace("0", "").replace("I", "").replace("1", "")
    return "".join(secrets.choice(chars) for _ in range(ACTIVATION_CODE_LENGTH))


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

    user = get_current_user(request, db)
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "staff"])

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

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

        # Register account_number → org_id in the master DB so that the
        # mobile app can route directly to this tenant without scanning all orgs.
        try:
            from models.master import MobileDeviceRegistry
            registry_entry = db.query(MobileDeviceRegistry).filter(
                MobileDeviceRegistry.account_number == member.member_number,
                MobileDeviceRegistry.org_id == org_id,
            ).first()
            if registry_entry:
                registry_entry.updated_at = datetime.utcnow()
            else:
                db.add(MobileDeviceRegistry(
                    account_number=member.member_number,
                    org_id=org_id,
                ))
            db.commit()
        except Exception as e:
            print(f"[MobileRegistry] Failed to register {member.member_number}: {e}")

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

    user = get_current_user(request, db)
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "staff"])

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

        return {
            "member_id": member_id,
            "mobile_banking_active": member.mobile_banking_active or False,
            "has_activation_code": bool(member.mobile_activation_code),
            "activation_expires_at": member.mobile_activation_expires_at.isoformat() if member.mobile_activation_expires_at else None,
            "sessions": [
                {
                    "id": s.id,
                    "device_name": s.device_name,
                    "login_at": s.login_at.isoformat() if s.login_at else None,
                    "logout_at": s.logout_at.isoformat() if s.logout_at else None,
                    "is_active": s.is_active,
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

    user = get_current_user(request, db)
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "staff"])

    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

        old_device_id = member.mobile_device_id

        member.mobile_banking_active = False
        member.mobile_device_id = None
        member.mobile_activation_code = None
        member.mobile_activation_expires_at = None
        member.pin_hash = None
        member.otp_code = None
        member.otp_expires_at = None

        tenant_session.query(MobileSession).filter(
            MobileSession.member_id == member_id,
            MobileSession.is_active == True,
        ).update({"is_active": False, "logout_at": datetime.utcnow()})

        tenant_session.commit()

        # Clear device_id from the master registry so the old device can no longer route here.
        if old_device_id:
            try:
                from models.master import MobileDeviceRegistry
                db.query(MobileDeviceRegistry).filter(
                    MobileDeviceRegistry.device_id == old_device_id,
                    MobileDeviceRegistry.org_id == org_id,
                ).update({"device_id": None, "updated_at": datetime.utcnow()})
                db.commit()
            except Exception as e:
                print(f"[MobileRegistry] Failed to clear device_id on deactivation: {e}")

        return {"success": True, "message": "Mobile banking deactivated. Member can re-activate using a new code."}
    finally:
        tenant_session.close()
        tenant_ctx.close()
