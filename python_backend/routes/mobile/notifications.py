"""
Mobile Member API — Notifications
GET /api/mobile/me/notifications
"""

import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from .deps import get_current_member

router = APIRouter()


@router.get("/me/notifications")
def get_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    ctx: dict = Depends(get_current_member),
):
    from models.tenant import SMSNotification

    member = ctx["member"]
    ts = ctx["session"]

    try:
        q = ts.query(SMSNotification).filter(SMSNotification.member_id == member.id)
        total = q.count()
        items = q.order_by(desc(SMSNotification.created_at)).offset((page - 1) * per_page).limit(per_page).all()

        return {
            "items": [
                {
                    "id": n.id,
                    "notification_type": n.notification_type,
                    "message": n.message,
                    "status": n.status,
                    "sent_at": n.sent_at.isoformat() if n.sent_at else None,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in items
            ],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": math.ceil(total / per_page) if total > 0 else 1,
        }
    finally:
        ts.close()
