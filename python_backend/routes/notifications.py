from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from models.database import get_db
from routes.auth import get_current_user
from routes.common import get_tenant_session_context

router = APIRouter()


class NotificationCreate(BaseModel):
    title: str
    message: str
    notification_type: str = "info"
    link: Optional[str] = None
    staff_id: Optional[str] = None


@router.get("/{org_id}/notifications")
def list_notifications(
    org_id: str,
    unread_only: bool = False,
    limit: int = 50,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.tenant import InAppNotification, Staff

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        staff_id = staff.id if staff else None

        query = tenant_session.query(InAppNotification).filter(
            (InAppNotification.staff_id == staff_id) | (InAppNotification.staff_id == None)
        )
        if unread_only:
            query = query.filter(InAppNotification.is_read == False)
        
        notifications = query.order_by(desc(InAppNotification.created_at)).limit(limit).all()

        unread_count = tenant_session.query(InAppNotification).filter(
            ((InAppNotification.staff_id == staff_id) | (InAppNotification.staff_id == None)),
            InAppNotification.is_read == False
        ).count()

        return {
            "notifications": [
                {
                    "id": n.id,
                    "title": n.title,
                    "message": n.message,
                    "notification_type": n.notification_type,
                    "link": n.link,
                    "is_read": n.is_read,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in notifications
            ],
            "unread_count": unread_count,
        }
    finally:
        tenant_session.close()


@router.patch("/{org_id}/notifications/{notification_id}/read")
def mark_notification_read(
    org_id: str,
    notification_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.tenant import InAppNotification

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        from models.tenant import Staff
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        staff_id = staff.id if staff else None

        notification = tenant_session.query(InAppNotification).filter(
            InAppNotification.id == notification_id,
            (InAppNotification.staff_id == staff_id) | (InAppNotification.staff_id == None)
        ).first()
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        notification.is_read = True
        tenant_session.commit()
        return {"success": True}
    finally:
        tenant_session.close()


@router.patch("/{org_id}/notifications/read-all")
def mark_all_notifications_read(
    org_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.tenant import InAppNotification, Staff

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        staff_id = staff.id if staff else None

        tenant_session.query(InAppNotification).filter(
            ((InAppNotification.staff_id == staff_id) | (InAppNotification.staff_id == None)),
            InAppNotification.is_read == False
        ).update({"is_read": True}, synchronize_session="fetch")
        tenant_session.commit()
        return {"success": True}
    finally:
        tenant_session.close()


def create_notification(tenant_session, title: str, message: str,
                        notification_type: str = "info", link: str = None,
                        staff_id: str = None):
    from models.tenant import InAppNotification
    notification = InAppNotification(
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        staff_id=staff_id,
    )
    tenant_session.add(notification)
    return notification
