"""
Shared dependency: get_current_member
Supports two auth methods for the mobile app:
  1. Authorization: Bearer <session_token>  — preferred for Flutter mobile clients
  2. mobile_session cookie — fallback for web/PWA clients

Token is the session_token stored in MobileSession during activate/complete or login/verify.
"""

from datetime import datetime
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from models.database import get_db

MOBILE_SESSION_COOKIE = "mobile_session"


def get_current_member(request: Request, db: Session = Depends(get_db)):
    from services.tenant_context import get_tenant_context_simple
    from models.tenant import Member, MobileSession
    from models.master import Organization

    # --- 1. Try Bearer token first (mobile app standard) ---
    bearer = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        bearer = auth_header[7:].strip()

    if bearer:
        # Bearer token = session_token — search all tenants for this session
        organizations = db.query(Organization).filter(
            Organization.connection_string.isnot(None)
        ).all()

        for org in organizations:
            tenant_ctx = get_tenant_context_simple(org.id, db)
            if not tenant_ctx:
                continue
            tenant_session = tenant_ctx.create_session()
            try:
                session = tenant_session.query(MobileSession).filter(
                    MobileSession.session_token == bearer,
                    MobileSession.is_active == True,
                ).first()
                if not session:
                    tenant_session.close()
                    tenant_ctx.close()
                    continue

                member = tenant_session.query(Member).filter(
                    Member.id == session.member_id
                ).first()

                if not member:
                    tenant_session.close()
                    tenant_ctx.close()
                    continue

                if member.status != "active":
                    tenant_session.close()
                    tenant_ctx.close()
                    raise HTTPException(status_code=403, detail="Account is not active")

                if not member.mobile_banking_active:
                    tenant_session.close()
                    tenant_ctx.close()
                    raise HTTPException(status_code=403, detail="Mobile banking is not active")

                # Update last_active
                session.last_active = datetime.utcnow()
                tenant_session.commit()

                return {
                    "member": member,
                    "org_id": org.id,
                    "org": org,
                    "session": tenant_session,
                }
            except HTTPException:
                tenant_session.close()
                tenant_ctx.close()
                raise
            except Exception:
                tenant_session.close()
                tenant_ctx.close()
                continue

        raise HTTPException(status_code=401, detail="Invalid or expired session")

    # --- 2. Fall back to mobile_session cookie ---
    cookie = request.cookies.get(MOBILE_SESSION_COOKIE)
    if not cookie:
        raise HTTPException(status_code=401, detail="Not authenticated")

    parts = cookie.split(":", 3)
    if len(parts) < 4 or parts[0] != "mobile":
        raise HTTPException(status_code=401, detail="Invalid session")

    _, org_id, member_id, session_token = parts

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=401, detail="Organization not found")

    tenant_ctx = get_tenant_context_simple(org_id, db)
    if not tenant_ctx:
        raise HTTPException(status_code=401, detail="Tenant not found")

    tenant_session = tenant_ctx.create_session()
    try:
        from models.tenant import MobileSession as MS
        session = tenant_session.query(MS).filter(
            MS.member_id == member_id,
            MS.session_token == session_token,
            MS.is_active == True,
        ).first()

        if not session:
            tenant_session.close()
            raise HTTPException(status_code=401, detail="Session not found or expired")

        member = tenant_session.query(Member).filter(Member.id == member_id).first()

        if not member:
            tenant_session.close()
            raise HTTPException(status_code=401, detail="Member not found")

        if member.status != "active":
            tenant_session.close()
            raise HTTPException(status_code=403, detail="Account is not active")

        session.last_active = datetime.utcnow()
        tenant_session.commit()

        return {
            "member": member,
            "org_id": org_id,
            "org": org,
            "session": tenant_session,
        }
    except HTTPException:
        raise
    except Exception:
        tenant_session.close()
        raise HTTPException(status_code=401, detail="Authentication error")
