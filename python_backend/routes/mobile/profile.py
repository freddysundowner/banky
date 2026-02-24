"""
Mobile Member API — Profile
GET  /api/mobile/me
PATCH /api/mobile/me
"""

from fastapi import APIRouter, Depends, HTTPException
from .deps import get_current_member

router = APIRouter()


def _member_profile(member, org) -> dict:
    return {
        "id": member.id,
        "member_number": member.member_number,
        "first_name": member.first_name,
        "middle_name": member.middle_name,
        "last_name": member.last_name,
        "full_name": f"{member.first_name} {member.last_name}",
        "email": member.email,
        "phone": member.phone,
        "gender": member.gender,
        "date_of_birth": member.date_of_birth.isoformat() if member.date_of_birth else None,
        "id_type": member.id_type,
        "id_number": member.id_number,
        "address": member.address,
        "city": member.city,
        "county": member.county,
        "country": member.country,
        "membership_type": member.membership_type,
        "status": member.status,
        "mobile_banking_active": member.mobile_banking_active,
        "photo_url": member.photo_url,
        "joined_at": member.joined_at.isoformat() if member.joined_at else None,
        "organization": {
            "id": org.id,
            "name": org.name,
            "subdomain": getattr(org, "subdomain", None),
            "currency": getattr(org, "currency", "KES"),
            "logo_url": getattr(org, "logo_url", None),
        },
    }


@router.get("/me")
def get_profile(ctx: dict = Depends(get_current_member)):
    try:
        return _member_profile(ctx["member"], ctx["org"])
    finally:
        ctx["session"].close()


@router.patch("/me")
def update_profile(ctx: dict = Depends(get_current_member)):
    ctx["session"].close()
    raise HTTPException(status_code=501, detail="Profile update coming soon")
