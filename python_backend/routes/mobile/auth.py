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
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from routes.sms import send_sms
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from models.database import get_db

router = APIRouter(prefix="/auth")

MOBILE_SESSION_COOKIE = "mobile_session"
OTP_EXPIRY_MINUTES = 5          # Activation OTP (sent by staff)
LOGIN_OTP_EXPIRY_MINUTES = 3    # Login OTP (sent by member themselves)


def _get_client_ip(request: Request) -> str:
    """Extract the real client IP, respecting X-Forwarded-For from reverse proxies."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _generate_otp() -> str:
    """Cryptographically secure 6-digit OTP."""
    return str(secrets.randbelow(900000) + 100000)


_PBKDF2_ITERATIONS = 260000
_PBKDF2_HASH = "sha256"


def _hash_pin(pin: str) -> str:
    """PBKDF2-HMAC-SHA256 with random salt. Returns salt:hash (hex)."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(_PBKDF2_HASH, pin.encode(), salt.encode(), _PBKDF2_ITERATIONS)
    return f"{salt}:{dk.hex()}"


def _verify_pin(pin: str, stored: str) -> bool:
    """Constant-time comparison of PBKDF2 hashes. Handles legacy plain SHA-256 too."""
    if ":" not in stored:
        # Legacy plain SHA-256 (migrate on next login)
        return secrets.compare_digest(
            hashlib.sha256(pin.encode()).hexdigest(), stored
        )
    salt, dk_hex = stored.split(":", 1)
    dk = hashlib.pbkdf2_hmac(_PBKDF2_HASH, pin.encode(), salt.encode(), _PBKDF2_ITERATIONS)
    return secrets.compare_digest(dk.hex(), dk_hex)


def _open_tenant(org, db: Session):
    """Open a tenant session for a given org. Returns (tenant_session, tenant_ctx) or (None, None)."""
    from services.tenant_context import get_tenant_context_simple
    tenant_ctx = get_tenant_context_simple(org.id, db)
    if not tenant_ctx:
        return None, None
    return tenant_ctx.create_session(), tenant_ctx


def _find_member_by_account(account_number: str, db: Session):
    """
    Find a member by account_number.

    Fast path: look up account_number in the master-DB MobileDeviceRegistry,
    which is written when staff generates the activation code. This avoids
    scanning every tenant database.

    Fallback: if the registry has no entry (e.g., legacy data), scan all
    tenant databases in sequence.
    """
    from models.master import Organization, MobileDeviceRegistry
    from models.tenant import Member

    norm = account_number.upper().strip()

    # --- Fast path via registry ---
    entry = db.query(MobileDeviceRegistry).filter(
        MobileDeviceRegistry.account_number == norm
    ).first()

    if entry:
        org = db.query(Organization).filter(Organization.id == entry.org_id).first()
        if org:
            tenant_session, tenant_ctx = _open_tenant(org, db)
            if tenant_session:
                member = None
                try:
                    member = tenant_session.query(Member).filter(
                        Member.member_number == norm
                    ).first()
                    if member:
                        return member, org, tenant_session, tenant_ctx
                except Exception:
                    pass
                finally:
                    if not member:
                        tenant_session.close()
                        tenant_ctx.close()

    # --- Fallback: scan all tenants (backward compat / stale registry) ---
    skip_org_id = entry.org_id if entry else None
    _filters = [Organization.connection_string.isnot(None)]
    if skip_org_id:
        _filters.append(Organization.id != skip_org_id)
    organizations = db.query(Organization).filter(*_filters).all()

    for org in organizations:
        tenant_session, tenant_ctx = _open_tenant(org, db)
        if not tenant_session:
            continue
        try:
            member = tenant_session.query(Member).filter(
                Member.member_number == norm
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
    """
    Find a member by device_id using the master-DB MobileDeviceRegistry only.

    The registry entry is written when a member completes activation, so if
    the device is not in the registry the member has never activated and
    cannot log in.
    """
    from models.master import Organization, MobileDeviceRegistry
    from models.tenant import Member

    entry = db.query(MobileDeviceRegistry).filter(
        MobileDeviceRegistry.device_id == device_id
    ).first()

    if not entry:
        return None, None, None, None

    org = db.query(Organization).filter(Organization.id == entry.org_id).first()
    if not org:
        return None, None, None, None

    tenant_session, tenant_ctx = _open_tenant(org, db)
    if not tenant_session:
        return None, None, None, None

    try:
        member = tenant_session.query(Member).filter(
            Member.mobile_device_id == device_id
        ).first()
        if member:
            return member, org, tenant_session, tenant_ctx
        tenant_session.close()
        tenant_ctx.close()
        return None, None, None, None
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
    device_name: Optional[str] = None


class LoginVerifyRequest(BaseModel):
    device_id: str
    otp: str
    device_name: Optional[str] = None


class ResendOtpRequest(BaseModel):
    account_number: Optional[str] = None
    device_id: Optional[str] = None


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

        send_sms(
            member.phone,
            f"{org.name} Mobile Banking: Your OTP is {otp}. "
            f"Valid for {OTP_EXPIRY_MINUTES} minutes. Do not share.",
            tenant_session,
        )

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

        # Revoke all previous sessions (device replacement / re-activation).
        tenant_session.query(MobileSession).filter(
            MobileSession.member_id == member.id,
            MobileSession.is_active == True,
        ).update({"is_active": False, "logout_at": datetime.utcnow()})

        ip = _get_client_ip(request)
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

        # Bind device_id to the registry entry so subsequent logins use O(1) lookup.
        try:
            from models.master import MobileDeviceRegistry
            reg = db.query(MobileDeviceRegistry).filter(
                MobileDeviceRegistry.account_number == data.account_number.upper().strip(),
                MobileDeviceRegistry.org_id == org.id,
            ).first()
            if reg:
                reg.device_id = data.device_id
                reg.updated_at = datetime.utcnow()
            else:
                db.add(MobileDeviceRegistry(
                    account_number=data.account_number.upper().strip(),
                    device_id=data.device_id,
                    org_id=org.id,
                ))
            db.commit()
        except Exception as e:
            print(f"[MobileRegistry] Failed to bind device {data.device_id}: {e}")

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

        # Upgrade legacy plain SHA-256 hash to PBKDF2 on successful login.
        if ":" not in member.pin_hash:
            member.pin_hash = _hash_pin(data.password)
            tenant_session.commit()

        otp = _generate_otp()
        member.otp_code = otp
        member.otp_expires_at = datetime.utcnow() + timedelta(minutes=LOGIN_OTP_EXPIRY_MINUTES)
        tenant_session.commit()

        send_sms(
            member.phone,
            f"{org.name} Mobile Banking: Your login OTP is {otp}. "
            f"Valid for {LOGIN_OTP_EXPIRY_MINUTES} minutes. Do not share.",
            tenant_session,
        )

        phone = member.phone or ""
        masked = phone[:3] + "****" + phone[-3:] if len(phone) >= 7 else "****"

        return {
            "success": True,
            "masked_phone": masked,
            "otp_expires_seconds": LOGIN_OTP_EXPIRY_MINUTES * 60,
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
        ip = _get_client_ip(request)

        existing_session = tenant_session.query(MobileSession).filter(
            MobileSession.member_id == member.id,
            MobileSession.device_id == data.device_id,
            MobileSession.is_active == True,
        ).first()

        if existing_session:
            existing_session.session_token = session_token
            existing_session.last_active = datetime.utcnow()
            existing_session.ip_address = ip
            if data.device_name:
                existing_session.device_name = data.device_name
        else:
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
            "member_name": f"{member.first_name} {member.last_name}",
            "member_number": member.member_number,
            "org_name": org.name,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/resend-otp")
async def resend_otp(data: ResendOtpRequest, db: Session = Depends(get_db)):
    """
    Resend OTP for an in-progress activation or login.
    Activation flow: provide account_number.
    Login flow: provide device_id.
    Only works if there is an OTP that hasn't expired yet.
    """
    if not data.account_number and not data.device_id:
        raise HTTPException(status_code=400, detail="Provide account_number or device_id")

    if data.account_number:
        member, org, tenant_session, tenant_ctx = _find_member_by_account(data.account_number, db)
    else:
        member, org, tenant_session, tenant_ctx = _find_member_by_device(data.device_id, db)

    if not member:
        raise HTTPException(status_code=404, detail="Account not found.")

    try:
        # account_number presence means activation flow; device_id alone means login flow.
        is_login_flow = not bool(data.account_number)
        expiry_minutes = LOGIN_OTP_EXPIRY_MINUTES if is_login_flow else OTP_EXPIRY_MINUTES

        otp = _generate_otp()
        member.otp_code = otp
        member.otp_expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)
        tenant_session.commit()

        send_sms(
            member.phone,
            f"{org.name} Mobile Banking: Your OTP is {otp}. "
            f"Valid for {expiry_minutes} minutes. Do not share.",
            tenant_session,
        )

        phone = member.phone or ""
        masked = phone[:3] + "****" + phone[-3:] if len(phone) >= 7 else "****"

        result: dict = {"success": True, "masked_phone": masked, "message": f"OTP resent to {masked}"}
        if is_login_flow:
            result["otp_expires_seconds"] = expiry_minutes * 60
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/logout")
async def mobile_logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Invalidate the current mobile session. Supports both Bearer token and cookie."""
    from models.tenant import MobileSession
    from models.master import Organization
    from services.tenant_context import get_tenant_context_simple

    session_token = None

    # 1. Try Bearer token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        session_token = auth_header[7:].strip()

    # 2. Fall back to cookie
    if not session_token:
        cookie = request.cookies.get(MOBILE_SESSION_COOKIE)
        if cookie:
            parts = cookie.split(":", 3)
            if len(parts) == 4 and parts[0] == "mobile":
                session_token = parts[3]

    if session_token:
        # The cookie encodes org_id, so we can go straight to the right tenant.
        # Fall back to scanning all orgs only when using a raw Bearer token
        # (where we don't have org_id embedded).
        org_id_hint = None
        cookie = request.cookies.get(MOBILE_SESSION_COOKIE)
        if cookie:
            parts = cookie.split(":", 3)
            if len(parts) == 4 and parts[0] == "mobile":
                org_id_hint = parts[1]

        orgs_to_check = []
        if org_id_hint:
            org = db.query(Organization).filter(Organization.id == org_id_hint).first()
            if org:
                orgs_to_check = [org]
        if not orgs_to_check:
            orgs_to_check = db.query(Organization).filter(
                Organization.connection_string.isnot(None)
            ).all()

        for org in orgs_to_check:
            tenant_ctx = get_tenant_context_simple(org.id, db)
            if not tenant_ctx:
                continue
            tenant_session = tenant_ctx.create_session()
            try:
                sess = tenant_session.query(MobileSession).filter(
                    MobileSession.session_token == session_token,
                    MobileSession.is_active == True,
                ).first()
                if sess:
                    sess.is_active = False
                    sess.logout_at = datetime.utcnow()
                    tenant_session.commit()
                    tenant_session.close()
                    tenant_ctx.close()
                    break
                tenant_session.close()
                tenant_ctx.close()
            except Exception:
                tenant_session.close()
                tenant_ctx.close()

    response.delete_cookie(MOBILE_SESSION_COOKIE)
    return {"success": True, "message": "Logged out"}
