"""
Mobile Member API — Notifications
GET  /api/mobile/me/notifications
PATCH /api/mobile/me/notifications/{id}/read
POST  /api/mobile/me/notifications/read-all
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
                    "is_read": n.is_read if n.is_read is not None else False,
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


@router.patch("/me/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    ctx: dict = Depends(get_current_member),
):
    from models.tenant import SMSNotification

    member = ctx["member"]
    ts = ctx["session"]

    try:
        n = (
            ts.query(SMSNotification)
            .filter(
                SMSNotification.id == notification_id,
                SMSNotification.member_id == member.id,
            )
            .first()
        )
        if not n:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Notification not found")

        n.is_read = True
        ts.commit()
        return {"success": True, "message": "Notification marked as read"}
    finally:
        ts.close()


@router.post("/me/notifications/read-all")
def mark_all_notifications_read(ctx: dict = Depends(get_current_member)):
    from models.tenant import SMSNotification

    member = ctx["member"]
    ts = ctx["session"]

    try:
        ts.query(SMSNotification).filter(
            SMSNotification.member_id == member.id,
            SMSNotification.is_read == False,
        ).update({"is_read": True}, synchronize_session=False)
        ts.commit()
        return {"success": True, "message": "All notifications marked as read"}
    finally:
        ts.close()
