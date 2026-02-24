"""
Shared dependency: get_current_member
Reads the member:{org_id}:{member_id}:{token} cookie set by auth.py login flow.
"""

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from models.database import get_db

SESSION_COOKIE_NAME = "session_token"


def get_current_member(request: Request, db: Session = Depends(get_db)):
    from services.tenant_context import get_tenant_context_simple
    from models.tenant import Member
    from models.master import Organization

    cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie:
        raise HTTPException(status_code=401, detail="Not authenticated")

    parts = cookie.split(":", 3)
    if len(parts) < 4 or parts[0] != "member":
        raise HTTPException(status_code=401, detail="Invalid session")

    _, org_id, member_id, token = parts

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=401, detail="Organization not found")

    tenant_ctx = get_tenant_context_simple(org_id, db)
    if not tenant_ctx:
        raise HTTPException(status_code=401, detail="Tenant not found")

    tenant_session = tenant_ctx.create_session()
    member = tenant_session.query(Member).filter(Member.id == member_id).first()

    if not member:
        tenant_session.close()
        raise HTTPException(status_code=401, detail="Member not found")

    if member.status != "active":
        tenant_session.close()
        raise HTTPException(status_code=403, detail="Account is not active")

    return {
        "member": member,
        "org_id": org_id,
        "org": org,
        "session": tenant_session,
    }
