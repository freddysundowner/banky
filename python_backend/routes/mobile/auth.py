"""
Mobile Banking Authentication — /api/mobile/auth/*

New activation and login flow (completely separate from existing auth.py):
  POST /auth/activate/init     — member enters account_number + staff one-time code + device_id
  POST /auth/activate/complete — member enters OTP + sets 6-digit password, binds device
  POST /auth/login             — member logs in with device_id + 6-digit password
  POST /auth/login/verify      — member verifies OTP to receive session cookie
  POST /auth/logout            — invalidate current session

No org_id is required from the client — members are found via cross-tenant search.
"""

import uuid
import random
import secrets
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from models.database import get_db

router = APIRouter(prefix="/auth")

MOBILE_SESSION_COOKIE = "mobile_session"
OTP_EXPIRY_MINUTES = 5


def _generate_otp() -> str:
    return str(random.randint(100000, 999999))


def _hash_pin(pin: str) -> str:
    import hashlib
    return hashlib.sha256(pin.encode()).hexdigest()


def _verify_pin(pin: str, pin_hash: str) -> bool:
    import hashlib
    return hashlib.sha256(pin.encode()).hexdigest() == pin_hash


def _send_otp_sms(phone: str, otp: str, org_name: str, tenant_session: Session) -> None:
    try:
        from routes.sms import send_sms
        message = (
            f"{org_name} Mobile Banking OTP: {otp}. "
            f"Valid for {OTP_EXPIRY_MINUTES} minutes. Do not share."
        )
        send_sms(phone, message, tenant_session)
    except Exception:
        pass


def _find_member_by_account(account_number: str, db: Session):
    """Search all tenant databases for a member by account number."""
    from models.master import Organization
    from models.tenant import Member
    from services.tenant_context import get_tenant_context_simple

    organizations = db.query(Organization).filter(
        Organization.connection_string.isnot(None)
    ).all()

    for org in organizations:
        tenant_ctx = get_tenant_context_simple(org.id, db)
        if not tenant_ctx:
            continue
        tenant_session = tenant_ctx.create_session()
        try:
            member = tenant_session.query(Member).filter(
                Member.member_number == account_number.upper().strip()
            ).first()
            if member:
                return member, org, tenant_session, tenant_ctx
            tenant_session.close()
            tenant_ctx.close()
        except Exception:
            tenant_session.close()
            tenant_ctx.close()

    return None, None, None, None


def _find_member_by_device(device_id: str, db: Session):
    """Search all tenant databases for a member by device_id."""
    from models.master import Organization
    from models.tenant import Member
    from services.tenant_context import get_tenant_context_simple

    organizations = db.query(Organization).filter(
        Organization.connection_string.isnot(None)
    ).all()

    for org in organizations:
        tenant_ctx = get_tenant_context_simple(org.id, db)
        if not tenant_ctx:
            continue
        tenant_session = tenant_ctx.create_session()
        try:
            member = tenant_session.query(Member).filter(
                Member.mobile_device_id == device_id
            ).first()
            if member:
                return member, org, tenant_session, tenant_ctx
            tenant_session.close()
            tenant_ctx.close()
        except Exception:
            tenant_session.close()
            tenant_ctx.close()

    return None, None, None, None


class ActivateInitRequest(BaseModel):
    account_number: str
    activation_code: str
    device_id: str
    device_name: Optional[str] = None


class ActivateCompleteRequest(BaseModel):
    account_number: str
    otp: str
    password: str
    device_id: str
    device_name: Optional[str] = None


class LoginRequest(BaseModel):
    device_id: str
    password: str


class LoginVerifyRequest(BaseModel):
    device_id: str
    otp: str


@router.post("/activate/init")
async def activate_init(data: ActivateInitRequest, request: Request, db: Session = Depends(get_db)):
    """
    Step 1 of activation:
    Member enters account_number + staff one-time activation code + device_id.
    Returns masked phone and member name, sends OTP to member's phone.
    """
    member, org, tenant_session, tenant_ctx = _find_member_by_account(data.account_number, db)

    if not member:
        raise HTTPException(status_code=404, detail="Account number not found. Please check and try again.")

    try:
        if member.status != "active":
            raise HTTPException(status_code=403, detail="Account is not active. Contact your administrator.")

        if not member.mobile_activation_code:
            raise HTTPException(
                status_code=400,
                detail="Mobile banking has not been activated for this account. Please contact your branch."
            )

        if member.mobile_activation_expires_at and datetime.utcnow() > member.mobile_activation_expires_at:
            raise HTTPException(
                status_code=400,
                detail="Activation code has expired. Please contact your branch for a new code."
            )

        if member.mobile_activation_code.upper() != data.activation_code.upper().strip():
            raise HTTPException(status_code=400, detail="Invalid activation code. Please check and try again.")

        otp = _generate_otp()
        member.otp_code = otp
        member.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
        tenant_session.commit()

        _send_otp_sms(member.phone, otp, org.name, tenant_session)

        phone = member.phone or ""
        masked = phone[:3] + "****" + phone[-3:] if len(phone) >= 7 else "****"

        return {
            "success": True,
            "member_name": f"{member.first_name} {member.last_name}",
            "masked_phone": masked,
            "organization_name": org.name,
            "message": f"OTP sent to {masked}. Enter it to set your 6-digit password."
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/activate/complete")
async def activate_complete(
    data: ActivateCompleteRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Step 2 of activation:
    Member verifies OTP and sets a 6-digit password. Binds the device.
    Issues a session cookie on success.
    """
    from models.tenant import MobileSession

    if len(data.password) != 6 or not data.password.isdigit():
        raise HTTPException(status_code=400, detail="Password must be exactly 6 digits")

    member, org, tenant_session, tenant_ctx = _find_member_by_account(data.account_number, db)

    if not member:
        raise HTTPException(status_code=404, detail="Account not found. Please restart activation.")

    try:
        if not member.otp_code or not member.otp_expires_at:
            raise HTTPException(status_code=400, detail="OTP not found. Please restart activation.")

        if datetime.utcnow() > member.otp_expires_at:
            member.otp_code = None
            member.otp_expires_at = None
            tenant_session.commit()
            raise HTTPException(status_code=400, detail="OTP has expired. Please restart activation.")

        if member.otp_code != data.otp.strip():
            raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")

        session_token = secrets.token_urlsafe(32)
        member.pin_hash = _hash_pin(data.password)
        member.mobile_device_id = data.device_id
        member.mobile_banking_active = True
        member.mobile_activation_code = None
        member.mobile_activation_expires_at = None
        member.otp_code = None
        member.otp_expires_at = None

        ip = request.client.host if request.client else None
        mobile_session = MobileSession(
            id=str(uuid.uuid4()),
            member_id=member.id,
            device_id=data.device_id,
            device_name=data.device_name,
            ip_address=ip,
            session_token=session_token,
            login_at=datetime.utcnow(),
            last_active=datetime.utcnow(),
            is_active=True,
        )
        tenant_session.add(mobile_session)
        tenant_session.commit()

        cookie_value = f"mobile:{org.id}:{member.id}:{session_token}"
        response.set_cookie(
            key=MOBILE_SESSION_COOKIE,
            value=cookie_value,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 30,
        )

        return {
            "success": True,
            "access_token": session_token,
            "token_type": "bearer",
            "message": "Mobile banking activated successfully. You can now sign in.",
            "member_name": f"{member.first_name} {member.last_name}",
            "member_number": member.member_number,
            "org_name": org.name,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/login")
async def mobile_login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Member logs in with device_id + 6-digit password.
    Sends OTP to the member's registered phone.
    """
    member, org, tenant_session, tenant_ctx = _find_member_by_device(data.device_id, db)

    if not member:
        raise HTTPException(
            status_code=404,
            detail="Device not registered. Please activate mobile banking first."
        )

    try:
        if member.status != "active":
            raise HTTPException(status_code=403, detail="Account is not active. Contact your administrator.")

        if not member.mobile_banking_active:
            raise HTTPException(status_code=403, detail="Mobile banking is not active for this account.")

        if not member.pin_hash or not _verify_pin(data.password, member.pin_hash):
            raise HTTPException(status_code=401, detail="Invalid password. Please try again.")

        otp = _generate_otp()
        member.otp_code = otp
        member.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
        tenant_session.commit()

        _send_otp_sms(member.phone, otp, org.name, tenant_session)

        phone = member.phone or ""
        masked = phone[:3] + "****" + phone[-3:] if len(phone) >= 7 else "****"

        return {
            "success": True,
            "masked_phone": masked,
            "message": f"OTP sent to {masked}",
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/login/verify")
async def mobile_login_verify(
    data: LoginVerifyRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Member verifies OTP after login. Issues session cookie on success.
    """
    from models.tenant import MobileSession

    member, org, tenant_session, tenant_ctx = _find_member_by_device(data.device_id, db)

    if not member:
        raise HTTPException(status_code=404, detail="Device not registered. Please activate mobile banking first.")

    try:
        if not member.otp_code or not member.otp_expires_at:
            raise HTTPException(status_code=400, detail="No OTP pending. Please start login again.")

        if datetime.utcnow() > member.otp_expires_at:
            member.otp_code = None
            member.otp_expires_at = None
            tenant_session.commit()
            raise HTTPException(status_code=400, detail="OTP has expired. Please login again.")

        if member.otp_code != data.otp.strip():
            raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")

        member.otp_code = None
        member.otp_expires_at = None

        session_token = secrets.token_urlsafe(32)
        ip = request.client.host if request.client else None

        existing_session = tenant_session.query(MobileSession).filter(
            MobileSession.member_id == member.id,
            MobileSession.device_id == data.device_id,
            MobileSession.is_active == True,
        ).first()

        if existing_session:
            existing_session.session_token = session_token
            existing_session.last_active = datetime.utcnow()
            existing_session.ip_address = ip
        else:
            mobile_session = MobileSession(
                id=str(uuid.uuid4()),
                member_id=member.id,
                device_id=data.device_id,
                ip_address=ip,
                session_token=session_token,
                login_at=datetime.utcnow(),
                last_active=datetime.utcnow(),
                is_active=True,
            )
            tenant_session.add(mobile_session)

        tenant_session.commit()

        cookie_value = f"mobile:{org.id}:{member.id}:{session_token}"
        response.set_cookie(
            key=MOBILE_SESSION_COOKIE,
            value=cookie_value,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 30,
        )

        return {
            "success": True,
            "access_token": session_token,
            "token_type": "bearer",
            "member_name": f"{member.first_name} {member.last_name}",
            "member_number": member.member_number,
            "org_name": org.name,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/logout")
async def mobile_logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Invalidate the current mobile session."""
    from models.tenant import MobileSession
    from services.tenant_context import get_tenant_context_simple

    cookie = request.cookies.get(MOBILE_SESSION_COOKIE)
    if cookie:
        parts = cookie.split(":", 3)
        if len(parts) == 4 and parts[0] == "mobile":
            org_id = parts[1]
            session_token = parts[3]
            try:
                tenant_ctx = get_tenant_context_simple(org_id, db)
                if tenant_ctx:
                    tenant_session = tenant_ctx.create_session()
                    sess = tenant_session.query(MobileSession).filter(
                        MobileSession.session_token == session_token
                    ).first()
                    if sess:
                        sess.is_active = False
                        sess.logout_at = datetime.utcnow()
                        tenant_session.commit()
                    tenant_session.close()
                    tenant_ctx.close()
            except Exception:
                pass

    response.delete_cookie(MOBILE_SESSION_COOKIE)
    return {"success": True, "message": "Logged out"}
