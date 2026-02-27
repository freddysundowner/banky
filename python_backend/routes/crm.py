from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from models.database import get_db
from models.tenant import CrmContact, CrmInteraction, CrmFollowUp, Staff
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from middleware.demo_guard import require_not_demo

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    referred_by: Optional[str] = None
    interest: Optional[str] = None
    estimated_amount: Optional[float] = None
    notes: Optional[str] = None
    assigned_to_id: Optional[str] = None

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    referred_by: Optional[str] = None
    interest: Optional[str] = None
    estimated_amount: Optional[float] = None
    status: Optional[str] = None
    lost_reason: Optional[str] = None
    notes: Optional[str] = None
    assigned_to_id: Optional[str] = None

class InteractionCreate(BaseModel):
    interaction_type: str
    interaction_date: Optional[datetime] = None
    notes: str
    outcome: Optional[str] = None

class FollowUpCreate(BaseModel):
    contact_id: str
    description: str
    due_date: datetime
    assigned_to_id: Optional[str] = None

class FollowUpUpdate(BaseModel):
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    assigned_to_id: Optional[str] = None

class ConvertRequest(BaseModel):
    member_id: Optional[str] = None


# ── Serializers ───────────────────────────────────────────────────────────────

def contact_to_dict(c: CrmContact) -> dict:
    return {
        "id": c.id,
        "first_name": c.first_name,
        "last_name": c.last_name,
        "full_name": f"{c.first_name} {c.last_name}",
        "phone": c.phone,
        "email": c.email,
        "source": c.source,
        "referred_by": c.referred_by,
        "interest": c.interest,
        "estimated_amount": float(c.estimated_amount) if c.estimated_amount else None,
        "status": c.status,
        "lost_reason": c.lost_reason,
        "notes": c.notes,
        "member_id": c.member_id,
        "converted_at": c.converted_at.isoformat() if c.converted_at else None,
        "assigned_to_id": c.assigned_to_id,
        "assigned_to_name": (
            f"{c.assigned_to.first_name} {c.assigned_to.last_name}"
            if c.assigned_to else None
        ),
        "interaction_count": len(c.interactions) if c.interactions else 0,
        "followup_count": len([f for f in c.followups if f.status == "pending"]) if c.followups else 0,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def interaction_to_dict(i: CrmInteraction, contact: CrmContact = None) -> dict:
    return {
        "id": i.id,
        "contact_id": i.contact_id,
        "contact_name": (
            f"{contact.first_name} {contact.last_name}" if contact
            else (f"{i.contact.first_name} {i.contact.last_name}" if i.contact else None)
        ),
        "interaction_type": i.interaction_type,
        "interaction_date": i.interaction_date.isoformat() if i.interaction_date else None,
        "notes": i.notes,
        "outcome": i.outcome,
        "created_by_id": i.created_by_id,
        "created_by_name": (
            f"{i.created_by.first_name} {i.created_by.last_name}"
            if i.created_by else None
        ),
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


def followup_to_dict(f: CrmFollowUp, contact: CrmContact = None) -> dict:
    now = datetime.utcnow()
    is_overdue = f.status == "pending" and f.due_date and f.due_date < now
    return {
        "id": f.id,
        "contact_id": f.contact_id,
        "contact_name": f"{contact.first_name} {contact.last_name}" if contact else None,
        "contact_phone": contact.phone if contact else None,
        "description": f.description,
        "due_date": f.due_date.isoformat() if f.due_date else None,
        "status": "overdue" if is_overdue else f.status,
        "assigned_to_id": f.assigned_to_id,
        "assigned_to_name": (
            f"{f.assigned_to.first_name} {f.assigned_to.last_name}"
            if f.assigned_to else None
        ),
        "completed_at": f.completed_at.isoformat() if f.completed_at else None,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


def get_staff_from_user(tenant_session, user_email: str):
    return tenant_session.query(Staff).filter(Staff.email == user_email).first()


# ── CRM Stats ─────────────────────────────────────────────────────────────────

@router.get("/{organization_id}/crm/stats")
def get_crm_stats(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        now = datetime.utcnow()
        total = tenant_session.query(CrmContact).count()
        by_status = {
            s: tenant_session.query(CrmContact).filter(CrmContact.status == s).count()
            for s in ["new", "contacted", "qualified", "converted", "lost"]
        }
        overdue = tenant_session.query(CrmFollowUp).filter(
            CrmFollowUp.status == "pending",
            CrmFollowUp.due_date < now
        ).count()
        pending = tenant_session.query(CrmFollowUp).filter(
            CrmFollowUp.status == "pending"
        ).count()
        return {
            "total_contacts": total,
            "by_status": by_status,
            "overdue_followups": overdue,
            "pending_followups": pending,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


# ── Contacts ──────────────────────────────────────────────────────────────────

@router.get("/{organization_id}/crm/contacts")
def list_contacts(
    organization_id: str,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    assigned_to_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        q = tenant_session.query(CrmContact)
        if search:
            q = q.filter(or_(
                CrmContact.first_name.ilike(f"%{search}%"),
                CrmContact.last_name.ilike(f"%{search}%"),
                CrmContact.phone.ilike(f"%{search}%"),
                CrmContact.email.ilike(f"%{search}%"),
            ))
        if status:
            q = q.filter(CrmContact.status == status)
        if source:
            q = q.filter(CrmContact.source == source)
        if assigned_to_id:
            q = q.filter(CrmContact.assigned_to_id == assigned_to_id)

        contacts = q.order_by(desc(CrmContact.created_at)).all()
        return [contact_to_dict(c) for c in contacts]
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/crm/contacts", dependencies=[Depends(require_not_demo)])
def create_contact(
    organization_id: str,
    body: ContactCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = get_staff_from_user(tenant_session, current_user.email)
        contact = CrmContact(
            first_name=body.first_name,
            last_name=body.last_name,
            phone=body.phone,
            email=body.email,
            source=body.source,
            referred_by=body.referred_by,
            interest=body.interest,
            estimated_amount=body.estimated_amount,
            notes=body.notes,
            assigned_to_id=body.assigned_to_id,
            created_by_id=staff.id if staff else None,
        )
        tenant_session.add(contact)
        tenant_session.commit()
        tenant_session.refresh(contact)
        return contact_to_dict(contact)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{organization_id}/crm/contacts/{contact_id}")
def get_contact(
    organization_id: str,
    contact_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        contact = tenant_session.query(CrmContact).filter(CrmContact.id == contact_id).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        return contact_to_dict(contact)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.put("/{organization_id}/crm/contacts/{contact_id}", dependencies=[Depends(require_not_demo)])
def update_contact(
    organization_id: str,
    contact_id: str,
    body: ContactUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        contact = tenant_session.query(CrmContact).filter(CrmContact.id == contact_id).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(contact, field, value)
        contact.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(contact)
        return contact_to_dict(contact)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.delete("/{organization_id}/crm/contacts/{contact_id}", dependencies=[Depends(require_not_demo)])
def delete_contact(
    organization_id: str,
    contact_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        contact = tenant_session.query(CrmContact).filter(CrmContact.id == contact_id).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        tenant_session.delete(contact)
        tenant_session.commit()
        return {"message": "Contact deleted"}
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/crm/contacts/{contact_id}/convert", dependencies=[Depends(require_not_demo)])
def convert_contact(
    organization_id: str,
    contact_id: str,
    body: ConvertRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        contact = tenant_session.query(CrmContact).filter(CrmContact.id == contact_id).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        contact.status = "converted"
        contact.converted_at = datetime.utcnow()
        if body.member_id:
            contact.member_id = body.member_id
        tenant_session.commit()
        tenant_session.refresh(contact)
        return contact_to_dict(contact)
    finally:
        tenant_session.close()
        tenant_ctx.close()


# ── Interactions ──────────────────────────────────────────────────────────────

@router.get("/{organization_id}/crm/contacts/{contact_id}/interactions")
def list_interactions(
    organization_id: str,
    contact_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        interactions = tenant_session.query(CrmInteraction).filter(
            CrmInteraction.contact_id == contact_id
        ).order_by(desc(CrmInteraction.interaction_date)).all()
        return [interaction_to_dict(i) for i in interactions]
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{organization_id}/crm/interactions")
def list_all_interactions(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        interactions = (
            tenant_session.query(CrmInteraction)
            .order_by(desc(CrmInteraction.interaction_date))
            .limit(200)
            .all()
        )
        result = []
        for i in interactions:
            contact = tenant_session.query(CrmContact).filter(
                CrmContact.id == i.contact_id
            ).first()
            result.append(interaction_to_dict(i, contact))
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/crm/contacts/{contact_id}/interactions", dependencies=[Depends(require_not_demo)])
def create_interaction(
    organization_id: str,
    contact_id: str,
    body: InteractionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        contact = tenant_session.query(CrmContact).filter(CrmContact.id == contact_id).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        staff = get_staff_from_user(tenant_session, current_user.email)
        interaction = CrmInteraction(
            contact_id=contact_id,
            interaction_type=body.interaction_type,
            interaction_date=body.interaction_date or datetime.utcnow(),
            notes=body.notes,
            outcome=body.outcome,
            created_by_id=staff.id if staff else None,
        )
        tenant_session.add(interaction)
        if contact.status == "new":
            contact.status = "contacted"
        tenant_session.commit()
        tenant_session.refresh(interaction)
        return interaction_to_dict(interaction, contact)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.delete("/{organization_id}/crm/interactions/{interaction_id}", dependencies=[Depends(require_not_demo)])
def delete_interaction(
    organization_id: str,
    interaction_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        interaction = tenant_session.query(CrmInteraction).filter(
            CrmInteraction.id == interaction_id
        ).first()
        if not interaction:
            raise HTTPException(status_code=404, detail="Interaction not found")
        tenant_session.delete(interaction)
        tenant_session.commit()
        return {"message": "Interaction deleted"}
    finally:
        tenant_session.close()
        tenant_ctx.close()


# ── Follow-ups ────────────────────────────────────────────────────────────────

@router.get("/{organization_id}/crm/followups")
def list_followups(
    organization_id: str,
    status: Optional[str] = Query(None),
    assigned_to_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        now = datetime.utcnow()
        q = tenant_session.query(CrmFollowUp)
        if status == "overdue":
            q = q.filter(CrmFollowUp.status == "pending", CrmFollowUp.due_date < now)
        elif status:
            q = q.filter(CrmFollowUp.status == status)
        if assigned_to_id:
            q = q.filter(CrmFollowUp.assigned_to_id == assigned_to_id)

        followups = q.order_by(CrmFollowUp.due_date).all()
        result = []
        for f in followups:
            contact = tenant_session.query(CrmContact).filter(
                CrmContact.id == f.contact_id
            ).first()
            result.append(followup_to_dict(f, contact))
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/crm/followups", dependencies=[Depends(require_not_demo)])
def create_followup(
    organization_id: str,
    body: FollowUpCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        contact = tenant_session.query(CrmContact).filter(
            CrmContact.id == body.contact_id
        ).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        staff = get_staff_from_user(tenant_session, current_user.email)
        followup = CrmFollowUp(
            contact_id=body.contact_id,
            description=body.description,
            due_date=body.due_date,
            assigned_to_id=body.assigned_to_id,
            created_by_id=staff.id if staff else None,
        )
        tenant_session.add(followup)
        tenant_session.commit()
        tenant_session.refresh(followup)
        return followup_to_dict(followup, contact)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.put("/{organization_id}/crm/followups/{followup_id}", dependencies=[Depends(require_not_demo)])
def update_followup(
    organization_id: str,
    followup_id: str,
    body: FollowUpUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        followup = tenant_session.query(CrmFollowUp).filter(
            CrmFollowUp.id == followup_id
        ).first()
        if not followup:
            raise HTTPException(status_code=404, detail="Follow-up not found")
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(followup, field, value)
        if body.status == "done" and not followup.completed_at:
            followup.completed_at = datetime.utcnow()
        followup.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(followup)
        contact = tenant_session.query(CrmContact).filter(
            CrmContact.id == followup.contact_id
        ).first()
        return followup_to_dict(followup, contact)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.delete("/{organization_id}/crm/followups/{followup_id}", dependencies=[Depends(require_not_demo)])
def delete_followup(
    organization_id: str,
    followup_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        followup = tenant_session.query(CrmFollowUp).filter(
            CrmFollowUp.id == followup_id
        ).first()
        if not followup:
            raise HTTPException(status_code=404, detail="Follow-up not found")
        tenant_session.delete(followup)
        tenant_session.commit()
        return {"message": "Follow-up deleted"}
    finally:
        tenant_session.close()
        tenant_ctx.close()
