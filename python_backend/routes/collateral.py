from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, desc
from datetime import datetime, date, timedelta
from typing import Optional
from pydantic import BaseModel
import os, uuid, shutil
from pathlib import Path

from models.database import get_db
from models.tenant import CollateralType, CollateralItem, CollateralInsurance, LoanApplication, LoanProduct, Member, Staff, Valuer
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from middleware.demo_guard import require_not_demo

UPLOADS_DIR = Path(__file__).parent.parent / "uploads" / "valuations"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter()

DEFAULT_COLLATERAL_TYPES = [
    {"name": "Land / Title Deed", "ltv_percent": 75, "revaluation_months": 36, "requires_insurance": False, "description": "Registered land with title deed"},
    {"name": "Motor Vehicle Logbook", "ltv_percent": 65, "revaluation_months": 12, "requires_insurance": True, "description": "Motor vehicle with logbook"},
    {"name": "Fixed Deposit (Lien)", "ltv_percent": 95, "revaluation_months": 0, "requires_insurance": False, "description": "Fixed deposit held internally"},
    {"name": "Shares Pledge", "ltv_percent": 90, "revaluation_months": 0, "requires_insurance": False, "description": "Member shares held in SACCO"},
    {"name": "Salary Assignment", "ltv_percent": 70, "revaluation_months": 12, "requires_insurance": False, "description": "Assignment of salary from employer"},
    {"name": "Business Assets", "ltv_percent": 50, "revaluation_months": 24, "requires_insurance": True, "description": "Business equipment or stock"},
    {"name": "Household Goods", "ltv_percent": 40, "revaluation_months": 24, "requires_insurance": False, "description": "Household furniture and appliances"},
    {"name": "Guarantor", "ltv_percent": 60, "revaluation_months": 12, "requires_insurance": False, "description": "Third-party guarantor pledge"},
    {"name": "Insurance Policy", "ltv_percent": 80, "revaluation_months": 12, "requires_insurance": False, "description": "Life or endowment insurance policy"},
]


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CollateralTypeCreate(BaseModel):
    name: str
    ltv_percent: float
    revaluation_months: int = 24
    requires_insurance: bool = False
    description: Optional[str] = None

class CollateralTypeUpdate(BaseModel):
    name: Optional[str] = None
    ltv_percent: Optional[float] = None
    revaluation_months: Optional[int] = None
    requires_insurance: Optional[bool] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CollateralItemCreate(BaseModel):
    loan_id: str
    collateral_type_id: str
    owner_name: str
    owner_id_number: Optional[str] = None
    description: str
    document_ref: Optional[str] = None
    declared_value: Optional[float] = None

class CollateralItemUpdate(BaseModel):
    collateral_type_id: Optional[str] = None
    owner_name: Optional[str] = None
    owner_id_number: Optional[str] = None
    description: Optional[str] = None
    document_ref: Optional[str] = None
    declared_value: Optional[float] = None

class ValuationRecord(BaseModel):
    appraised_value: float
    valuer_name: Optional[str] = None
    valuer_id: Optional[str] = None
    valuation_date: Optional[date] = None
    next_revaluation_date: Optional[date] = None
    ltv_override: Optional[float] = None

class ReleaseRequest(BaseModel):
    release_notes: Optional[str] = None

class LiquidationRequest(BaseModel):
    liquidation_amount: float
    liquidation_notes: Optional[str] = None

class LienRequest(BaseModel):
    pass

class InsuranceCreate(BaseModel):
    policy_number: str
    insurer_name: str
    policy_type: Optional[str] = None
    sum_insured: Optional[float] = None
    premium_amount: Optional[float] = None
    premium_frequency: Optional[str] = None
    start_date: date
    expiry_date: date
    notes: Optional[str] = None

class InsuranceUpdate(BaseModel):
    policy_number: Optional[str] = None
    insurer_name: Optional[str] = None
    policy_type: Optional[str] = None
    sum_insured: Optional[float] = None
    premium_amount: Optional[float] = None
    premium_frequency: Optional[str] = None
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


# ── Serializers ───────────────────────────────────────────────────────────────

def type_to_dict(t: CollateralType) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "ltv_percent": float(t.ltv_percent) if t.ltv_percent else 70.0,
        "revaluation_months": t.revaluation_months,
        "requires_insurance": t.requires_insurance,
        "description": t.description,
        "is_system": t.is_system,
        "is_active": t.is_active,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def item_to_dict(item: CollateralItem, include_insurance: bool = False) -> dict:
    loan = item.loan
    member = loan.member if loan else None
    ctype = item.collateral_type

    effective_ltv = float(item.ltv_override or (ctype.ltv_percent if ctype else 70))
    appraised = float(item.appraised_value) if item.appraised_value else None
    lending_limit = round(appraised * effective_ltv / 100, 2) if appraised else None

    today = date.today()
    revaluation_status = None
    if item.next_revaluation_date:
        if item.next_revaluation_date < today:
            revaluation_status = "overdue"
        elif item.next_revaluation_date <= today + timedelta(days=60):
            revaluation_status = "due_soon"
        else:
            revaluation_status = "ok"

    d = {
        "id": item.id,
        "loan_id": item.loan_id,
        "loan_number": loan.application_number if loan else None,
        "member_name": f"{member.first_name} {member.last_name}" if member else None,
        "member_id": member.id if member else None,
        "collateral_type_id": item.collateral_type_id,
        "collateral_type_name": ctype.name if ctype else None,
        "ltv_percent": effective_ltv,
        "owner_name": item.owner_name,
        "owner_id_number": item.owner_id_number,
        "description": item.description,
        "document_ref": item.document_ref,
        "declared_value": float(item.declared_value) if item.declared_value else None,
        "appraised_value": appraised,
        "lending_limit": lending_limit,
        "valuer_id": item.valuer_id,
        "valuer_name": item.valuer.name if item.valuer else item.valuer_name,
        "valuation_document_path": item.valuation_document_path,
        "valuation_document_url": f"/api/uploads/valuations/{item.valuation_document_path}" if item.valuation_document_path else None,
        "valuation_date": item.valuation_date.isoformat() if item.valuation_date else None,
        "next_revaluation_date": item.next_revaluation_date.isoformat() if item.next_revaluation_date else None,
        "revaluation_status": revaluation_status,
        "status": item.status,
        "lien_date": item.lien_date.isoformat() if item.lien_date else None,
        "release_date": item.release_date.isoformat() if item.release_date else None,
        "release_notes": item.release_notes,
        "liquidation_date": item.liquidation_date.isoformat() if item.liquidation_date else None,
        "liquidation_amount": float(item.liquidation_amount) if item.liquidation_amount else None,
        "liquidation_notes": item.liquidation_notes,
        "insurance_count": len(item.insurance_policies) if item.insurance_policies is not None else 0,
        "has_active_insurance": any(p.status == "active" and p.expiry_date >= date.today() for p in item.insurance_policies) if item.insurance_policies else False,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }
    if include_insurance:
        d["insurance_policies"] = [insurance_to_dict(p) for p in item.insurance_policies]
    return d


def insurance_to_dict(p: CollateralInsurance) -> dict:
    today = date.today()
    computed_status = p.status
    if p.status == "active" and p.expiry_date:
        if p.expiry_date < today:
            computed_status = "expired"
        elif p.expiry_date <= today + timedelta(days=30):
            computed_status = "expiring_soon"
    return {
        "id": p.id,
        "collateral_item_id": p.collateral_item_id,
        "policy_number": p.policy_number,
        "insurer_name": p.insurer_name,
        "policy_type": p.policy_type,
        "sum_insured": float(p.sum_insured) if p.sum_insured else None,
        "premium_amount": float(p.premium_amount) if p.premium_amount else None,
        "premium_frequency": p.premium_frequency,
        "start_date": p.start_date.isoformat() if p.start_date else None,
        "expiry_date": p.expiry_date.isoformat() if p.expiry_date else None,
        "status": computed_status,
        "notes": p.notes,
        "document_path": p.document_path,
        "document_url": f"/api/uploads/valuations/{p.document_path}" if p.document_path else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def get_staff_id(tenant_session, user_email: str):
    staff = tenant_session.query(Staff).filter(Staff.email == user_email).first()
    return staff.id if staff else None


# ── Collateral Types ──────────────────────────────────────────────────────────

@router.get("/{organization_id}/collateral/types")
def list_collateral_types(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        types = tenant_session.query(CollateralType).order_by(CollateralType.name).all()
        if not types:
            _seed_default_types(tenant_session)
            tenant_session.commit()
            types = tenant_session.query(CollateralType).order_by(CollateralType.name).all()
        return [type_to_dict(t) for t in types]
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/collateral/types", dependencies=[Depends(require_not_demo)])
def create_collateral_type(
    organization_id: str,
    body: CollateralTypeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        ctype = CollateralType(**body.dict())
        tenant_session.add(ctype)
        tenant_session.commit()
        tenant_session.refresh(ctype)
        return type_to_dict(ctype)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.put("/{organization_id}/collateral/types/{type_id}", dependencies=[Depends(require_not_demo)])
def update_collateral_type(
    organization_id: str,
    type_id: str,
    body: CollateralTypeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        ctype = tenant_session.query(CollateralType).filter(CollateralType.id == type_id).first()
        if not ctype:
            raise HTTPException(status_code=404, detail="Collateral type not found")
        updates = body.dict(exclude_none=True)
        if ctype.is_system:
            # System types: allow only ltv_percent, revaluation_months, requires_insurance, is_active
            safe_fields = {"ltv_percent", "revaluation_months", "requires_insurance", "is_active"}
            blocked = set(updates.keys()) - safe_fields
            if blocked:
                raise HTTPException(status_code=400, detail=f"System types: cannot change {', '.join(blocked)}")
        for k, v in updates.items():
            setattr(ctype, k, v)
        tenant_session.commit()
        tenant_session.refresh(ctype)
        return type_to_dict(ctype)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.delete("/{organization_id}/collateral/types/{type_id}", dependencies=[Depends(require_not_demo)])
def delete_collateral_type(
    organization_id: str,
    type_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        ctype = tenant_session.query(CollateralType).filter(CollateralType.id == type_id).first()
        if not ctype:
            raise HTTPException(status_code=404, detail="Collateral type not found")
        if ctype.is_system:
            raise HTTPException(status_code=400, detail="System collateral types cannot be deleted")
        in_use = tenant_session.query(CollateralItem).filter(CollateralItem.collateral_type_id == type_id).count()
        if in_use:
            raise HTTPException(status_code=400, detail="Cannot delete: this type is used by existing collateral items")
        tenant_session.delete(ctype)
        tenant_session.commit()
        return {"message": "Collateral type deleted"}
    finally:
        tenant_session.close()
        tenant_ctx.close()


# ── Collateral Items ──────────────────────────────────────────────────────────

@router.get("/{organization_id}/collateral/items")
def list_collateral_items(
    organization_id: str,
    loan_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    collateral_type_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        q = tenant_session.query(CollateralItem).options(
            joinedload(CollateralItem.loan).joinedload(LoanApplication.member),
            joinedload(CollateralItem.collateral_type),
            joinedload(CollateralItem.insurance_policies),
        )
        if loan_id:
            q = q.filter(CollateralItem.loan_id == loan_id)
        if status:
            q = q.filter(CollateralItem.status == status)
        if collateral_type_id:
            q = q.filter(CollateralItem.collateral_type_id == collateral_type_id)
        if search:
            q = q.filter(or_(
                CollateralItem.description.ilike(f"%{search}%"),
                CollateralItem.owner_name.ilike(f"%{search}%"),
                CollateralItem.document_ref.ilike(f"%{search}%"),
            ))
        items = q.order_by(desc(CollateralItem.created_at)).all()
        return [item_to_dict(i) for i in items]
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{organization_id}/collateral/items/{item_id}")
def get_collateral_item(
    organization_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        item = tenant_session.query(CollateralItem).filter(CollateralItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Collateral item not found")
        return item_to_dict(item, include_insurance=True)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/collateral/items", dependencies=[Depends(require_not_demo)])
def create_collateral_item(
    organization_id: str,
    body: CollateralItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == body.loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        ctype = tenant_session.query(CollateralType).filter(CollateralType.id == body.collateral_type_id).first()
        if not ctype:
            raise HTTPException(status_code=404, detail="Collateral type not found")
        going_under_lien = loan.status in ["disbursed", "restructured"]
        if going_under_lien and ctype.requires_insurance:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insurance is required for '{ctype.name}' collateral. "
                    "Save the collateral as 'registered' first (on an unapproved loan), "
                    "add an insurance policy, then attach it to the loan."
                ),
            )
        item = CollateralItem(
            loan_id=body.loan_id,
            collateral_type_id=body.collateral_type_id,
            owner_name=body.owner_name,
            owner_id_number=body.owner_id_number,
            description=body.description,
            document_ref=body.document_ref,
            declared_value=body.declared_value,
            status="under_lien" if going_under_lien else "registered",
            lien_date=datetime.utcnow() if going_under_lien else None,
            created_by_id=get_staff_id(tenant_session, current_user.email),
        )
        tenant_session.add(item)
        tenant_session.commit()
        tenant_session.refresh(item)
        return item_to_dict(item)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.put("/{organization_id}/collateral/items/{item_id}", dependencies=[Depends(require_not_demo)])
def update_collateral_item(
    organization_id: str,
    item_id: str,
    body: CollateralItemUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        item = tenant_session.query(CollateralItem).filter(CollateralItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Collateral item not found")
        for k, v in body.dict(exclude_none=True).items():
            setattr(item, k, v)
        item.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(item)
        return item_to_dict(item)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.delete("/{organization_id}/collateral/items/{item_id}", dependencies=[Depends(require_not_demo)])
def delete_collateral_item(
    organization_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        item = tenant_session.query(CollateralItem).filter(CollateralItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Collateral item not found")
        if item.status == "under_lien":
            raise HTTPException(status_code=400, detail="Cannot delete collateral that is under lien. Release it first.")
        tenant_session.delete(item)
        tenant_session.commit()
        return {"message": "Collateral item deleted"}
    finally:
        tenant_session.close()
        tenant_ctx.close()


# ── Collateral Actions ────────────────────────────────────────────────────────

@router.post("/{organization_id}/collateral/items/{item_id}/valuate", dependencies=[Depends(require_not_demo)])
def record_valuation(
    organization_id: str,
    item_id: str,
    body: ValuationRecord,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        item = tenant_session.query(CollateralItem).filter(CollateralItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Collateral item not found")
        ctype = item.collateral_type
        effective_ltv = body.ltv_override or float(ctype.ltv_percent if ctype else 70)
        old_appraised_value = float(item.appraised_value) if item.appraised_value is not None else None
        item.appraised_value = body.appraised_value
        if body.valuer_id:
            valuer_obj = tenant_session.query(Valuer).filter(Valuer.id == body.valuer_id).first()
            item.valuer_id = body.valuer_id
            item.valuer_name = valuer_obj.name if valuer_obj else body.valuer_name
        else:
            item.valuer_id = None
            item.valuer_name = body.valuer_name
        item.valuation_date = body.valuation_date or date.today()
        item.ltv_override = body.ltv_override
        item.lending_limit = round(body.appraised_value * effective_ltv / 100, 2)
        if body.next_revaluation_date:
            item.next_revaluation_date = body.next_revaluation_date
        elif ctype and ctype.revaluation_months and ctype.revaluation_months > 0:
            from dateutil.relativedelta import relativedelta
            item.next_revaluation_date = item.valuation_date + relativedelta(months=ctype.revaluation_months)
        item.updated_at = datetime.utcnow()

        # --- Collateral deficiency check and revaluation notification ---
        if item.loan_id:
            loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == item.loan_id).first()
            if loan:
                from routes.notifications import create_notification
                product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
                notif_link = f"/?section=loans"

                # Resolve min_ltv — treat None and 0 distinctly: 0 means "no minimum set"
                min_ltv = None
                if product and product.min_ltv_coverage is not None:
                    try:
                        val = float(product.min_ltv_coverage)
                        if val > 0:
                            min_ltv = val
                    except (TypeError, ValueError):
                        pass

                all_items = tenant_session.query(CollateralItem).filter(
                    CollateralItem.loan_id == loan.id,
                    CollateralItem.status.notin_(["released", "liquidated"])
                ).all()
                total_lending = sum(float(ci.lending_limit or 0) for ci in all_items)
                loan_amount = float(loan.amount) if loan.amount else 0
                coverage_pct = (total_lending / loan_amount * 100) if loan_amount > 0 else 0

                was_deficient = bool(loan.collateral_deficient)
                active_statuses = ["approved", "disbursed", "under_review", "restructured", "defaulted"]
                new_value = float(body.appraised_value)

                # Always broadcast on first valuation or value drop for active loans
                # staff_id=None means broadcast — visible to all org users regardless of Staff table state
                if loan.status in active_statuses:
                    if old_appraised_value is None:
                        create_notification(
                            tenant_session,
                            title=f"Collateral Revalued: {loan.application_number}",
                            message=(
                                f"Collateral '{item.description}' for loan {loan.application_number} "
                                f"has been valuated at {new_value:,.2f}."
                            ),
                            notification_type="info",
                            link=notif_link,
                            staff_id=None,
                        )
                    elif new_value < old_appraised_value:
                        drop_pct = ((old_appraised_value - new_value) / old_appraised_value * 100)
                        create_notification(
                            tenant_session,
                            title=f"Collateral Value Dropped: {loan.application_number}",
                            message=(
                                f"Collateral '{item.description}' for loan {loan.application_number} "
                                f"was revalued from {old_appraised_value:,.2f} to {new_value:,.2f} "
                                f"(a drop of {drop_pct:.1f}%). Review may be required."
                            ),
                            notification_type="warning",
                            link=notif_link,
                            staff_id=None,
                        )

                if min_ltv and loan_amount > 0:
                    # LTV threshold configured — run deficiency check
                    is_deficient = coverage_pct < min_ltv
                    loan.collateral_deficient = is_deficient

                    if is_deficient:
                        if not was_deficient:
                            notif_msg = (
                                f"Collateral coverage for loan {loan.application_number} has dropped to "
                                f"{coverage_pct:.1f}% against the required {min_ltv:.1f}%. "
                                f"Immediate review required."
                            )
                        else:
                            notif_msg = (
                                f"Revaluation recorded for loan {loan.application_number} — coverage remains "
                                f"at {coverage_pct:.1f}%, below the required {min_ltv:.1f}%. "
                                f"Action still required."
                            )
                        create_notification(
                            tenant_session,
                            title=f"Collateral Deficient: {loan.application_number}",
                            message=notif_msg,
                            notification_type="warning",
                            link=notif_link,
                            staff_id=None,
                        )
                    elif was_deficient and not is_deficient:
                        loan.collateral_deficient = False
                        create_notification(
                            tenant_session,
                            title=f"Collateral Restored: {loan.application_number}",
                            message=f"Collateral coverage for loan {loan.application_number} is now {coverage_pct:.1f}%, meeting the required {min_ltv:.1f}%.",
                            notification_type="success",
                            link=notif_link,
                            staff_id=None,
                        )

        tenant_session.commit()
        tenant_session.refresh(item)
        return item_to_dict(item)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/collateral/items/{item_id}/lien", dependencies=[Depends(require_not_demo)])
def place_lien(
    organization_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        item = tenant_session.query(CollateralItem).filter(CollateralItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Collateral item not found")
        if item.status == "under_lien":
            raise HTTPException(status_code=400, detail="Item is already under lien")
        if item.status in ("released", "liquidated"):
            raise HTTPException(status_code=400, detail=f"Cannot place lien on a {item.status} item")
        ctype = tenant_session.query(CollateralType).filter(CollateralType.id == item.collateral_type_id).first()
        if ctype and ctype.requires_insurance:
            active_policy = tenant_session.query(CollateralInsurance).filter(
                CollateralInsurance.collateral_item_id == item_id,
                CollateralInsurance.status == "active",
                CollateralInsurance.expiry_date >= date.today(),
            ).first()
            if not active_policy:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot place lien: '{ctype.name}' requires an active, non-expired insurance policy. "
                        "Please add a valid insurance policy before placing this item under lien."
                    ),
                )
        item.status = "under_lien"
        item.lien_date = datetime.utcnow()
        item.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(item)
        return item_to_dict(item)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/collateral/items/{item_id}/release", dependencies=[Depends(require_not_demo)])
def release_collateral(
    organization_id: str,
    item_id: str,
    body: ReleaseRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        item = tenant_session.query(CollateralItem).filter(CollateralItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Collateral item not found")
        if item.status != "under_lien":
            raise HTTPException(status_code=400, detail=f"Only items under lien can be released (current status: {item.status})")
        item.status = "released"
        item.release_date = datetime.utcnow()
        item.release_notes = body.release_notes
        item.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(item)
        return item_to_dict(item)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/collateral/items/{item_id}/liquidate", dependencies=[Depends(require_not_demo)])
def liquidate_collateral(
    organization_id: str,
    item_id: str,
    body: LiquidationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        item = tenant_session.query(CollateralItem).filter(CollateralItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Collateral item not found")
        if item.status not in ("under_lien", "defaulted"):
            raise HTTPException(status_code=400, detail=f"Only items under lien or defaulted can be liquidated (current status: {item.status})")
        item.status = "liquidated"
        item.liquidation_date = datetime.utcnow()
        item.liquidation_amount = body.liquidation_amount
        item.liquidation_notes = body.liquidation_notes
        item.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(item)
        return item_to_dict(item)
    finally:
        tenant_session.close()
        tenant_ctx.close()


# ── Insurance ─────────────────────────────────────────────────────────────────

@router.get("/{organization_id}/collateral/insurance")
def list_all_insurance(
    organization_id: str,
    status: Optional[str] = Query(None),
    expiring_days: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        q = tenant_session.query(CollateralInsurance).options(
            joinedload(CollateralInsurance.collateral_item).joinedload(CollateralItem.loan).joinedload(LoanApplication.member),
        )
        if expiring_days is not None:
            cutoff = date.today() + timedelta(days=expiring_days)
            q = q.filter(
                CollateralInsurance.expiry_date <= cutoff,
                CollateralInsurance.expiry_date >= date.today(),
                CollateralInsurance.status == "active",
            )
        policies = q.order_by(CollateralInsurance.expiry_date).all()
        result = []
        for p in policies:
            d = insurance_to_dict(p)
            item = p.collateral_item
            if item:
                loan = item.loan
                member = loan.member if loan else None
                d["collateral_description"] = item.description
                d["loan_number"] = loan.application_number if loan else None
                d["member_name"] = f"{member.first_name} {member.last_name}" if member else None
            result.append(d)
        if status:
            result = [p for p in result if p["status"] == status or (status == "active" and p["status"] in ["active", "expiring_soon"])]
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{organization_id}/collateral/items/{item_id}/insurance")
def list_item_insurance(
    organization_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        item = tenant_session.query(CollateralItem).filter(CollateralItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Collateral item not found")
        return [insurance_to_dict(p) for p in item.insurance_policies]
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/collateral/items/{item_id}/insurance", dependencies=[Depends(require_not_demo)])
def add_insurance(
    organization_id: str,
    item_id: str,
    body: InsuranceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        item = tenant_session.query(CollateralItem).filter(CollateralItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Collateral item not found")
        policy = CollateralInsurance(collateral_item_id=item_id, **body.dict())
        tenant_session.add(policy)
        tenant_session.commit()
        tenant_session.refresh(policy)

        from routes.notifications import create_notification
        today = date.today()
        expiry = policy.expiry_date
        link = "/?section=collateral"
        desc = item.description or "collateral item"
        if expiry and expiry < today:
            create_notification(
                tenant_session,
                title=f"Insurance Expired: {desc}",
                message=(
                    f"The insurance policy (#{policy.policy_number}) for '{desc}' expired on "
                    f"{expiry.strftime('%d %b %Y')}. Renew immediately to remain compliant."
                ),
                notification_type="warning",
                link=link,
                staff_id=None,
            )
        elif expiry and (expiry - today).days <= 30:
            days_left = (expiry - today).days
            create_notification(
                tenant_session,
                title=f"Insurance Expiring Soon: {desc}",
                message=(
                    f"Insurance policy (#{policy.policy_number}) for '{desc}' expires in {days_left} day(s) "
                    f"on {expiry.strftime('%d %b %Y')}. Please renew before it lapses."
                ),
                notification_type="warning",
                link=link,
                staff_id=None,
            )
        else:
            create_notification(
                tenant_session,
                title=f"Insurance Registered: {desc}",
                message=(
                    f"Insurance policy (#{policy.policy_number}) for '{desc}' has been registered. "
                    f"It expires on {expiry.strftime('%d %b %Y') if expiry else 'N/A'}."
                ),
                notification_type="info",
                link=link,
                staff_id=None,
            )
        tenant_session.commit()
        return insurance_to_dict(policy)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.put("/{organization_id}/collateral/insurance/{policy_id}", dependencies=[Depends(require_not_demo)])
def update_insurance(
    organization_id: str,
    policy_id: str,
    body: InsuranceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        policy = tenant_session.query(CollateralInsurance).filter(CollateralInsurance.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Insurance policy not found")
        old_expiry = policy.expiry_date
        for k, v in body.dict(exclude_none=True).items():
            setattr(policy, k, v)
        policy.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(policy)

        new_expiry = policy.expiry_date
        if new_expiry and new_expiry != old_expiry:
            from routes.notifications import create_notification
            item = tenant_session.query(CollateralItem).filter(CollateralItem.id == policy.collateral_item_id).first()
            desc = item.description if item else "collateral item"
            today = date.today()
            link = "/?section=collateral"
            if new_expiry < today:
                create_notification(
                    tenant_session,
                    title=f"Insurance Expired: {desc}",
                    message=(
                        f"Insurance policy (#{policy.policy_number}) for '{desc}' was updated — "
                        f"expiry date is {new_expiry.strftime('%d %b %Y')}, which has already passed. "
                        "Renewal is required."
                    ),
                    notification_type="warning",
                    link=link,
                    staff_id=None,
                )
            elif (new_expiry - today).days <= 30:
                days_left = (new_expiry - today).days
                create_notification(
                    tenant_session,
                    title=f"Insurance Expiring Soon: {desc}",
                    message=(
                        f"Insurance policy (#{policy.policy_number}) for '{desc}' was updated — "
                        f"it expires in {days_left} day(s) on {new_expiry.strftime('%d %b %Y')}."
                    ),
                    notification_type="warning",
                    link=link,
                    staff_id=None,
                )
            else:
                create_notification(
                    tenant_session,
                    title=f"Insurance Renewed: {desc}",
                    message=(
                        f"Insurance policy (#{policy.policy_number}) for '{desc}' has been updated. "
                        f"New expiry: {new_expiry.strftime('%d %b %Y')}."
                    ),
                    notification_type="info",
                    link=link,
                    staff_id=None,
                )
            tenant_session.commit()

        return insurance_to_dict(policy)
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.delete("/{organization_id}/collateral/insurance/{policy_id}", dependencies=[Depends(require_not_demo)])
def delete_insurance(
    organization_id: str,
    policy_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        policy = tenant_session.query(CollateralInsurance).filter(CollateralInsurance.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Insurance policy not found")
        tenant_session.delete(policy)
        tenant_session.commit()
        return {"message": "Insurance policy deleted"}
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{organization_id}/collateral/insurance/{policy_id}/upload-document", dependencies=[Depends(require_not_demo)])
async def upload_insurance_document(
    organization_id: str,
    policy_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        policy = tenant_session.query(CollateralInsurance).filter(CollateralInsurance.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Insurance policy not found")

        ext = Path(file.filename).suffix.lower() if file.filename else ".pdf"
        allowed = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
        if ext not in allowed:
            raise HTTPException(status_code=400, detail="File type not allowed. Use PDF, image, or Word document.")

        filename = f"{organization_id}_ins_{policy_id}_{uuid.uuid4().hex}{ext}"
        dest = UPLOADS_DIR / filename
        with dest.open("wb") as buf:
            shutil.copyfileobj(file.file, buf)

        if policy.document_path and policy.document_path != filename:
            old = UPLOADS_DIR / policy.document_path
            if old.exists():
                old.unlink(missing_ok=True)

        policy.document_path = filename
        policy.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(policy)
        return {"document_path": filename, "document_url": f"/api/uploads/valuations/{filename}"}
    finally:
        tenant_session.close()
        tenant_ctx.close()


# ── Alerts & Stats ────────────────────────────────────────────────────────────

@router.get("/{organization_id}/collateral/alerts")
def get_collateral_alerts(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        today = date.today()
        soon = today + timedelta(days=60)
        insurance_soon = today + timedelta(days=30)

        overdue_revaluation = tenant_session.query(CollateralItem).filter(
            CollateralItem.next_revaluation_date < today,
            CollateralItem.status.notin_(["released", "liquidated"]),
        ).all()

        due_soon_revaluation = tenant_session.query(CollateralItem).filter(
            CollateralItem.next_revaluation_date >= today,
            CollateralItem.next_revaluation_date <= soon,
            CollateralItem.status.notin_(["released", "liquidated"]),
        ).all()

        ins_options = joinedload(CollateralInsurance.collateral_item).joinedload(CollateralItem.loan).joinedload(LoanApplication.member)

        # Collateral items that already have at least one healthy active policy (not expiring within 30 days)
        covered_item_ids = {
            row[0] for row in tenant_session.query(CollateralInsurance.collateral_item_id).filter(
                CollateralInsurance.status == "active",
                CollateralInsurance.expiry_date > insurance_soon,
            ).all()
        }

        expiring_insurance = [
            p for p in tenant_session.query(CollateralInsurance).options(ins_options).filter(
                CollateralInsurance.expiry_date >= today,
                CollateralInsurance.expiry_date <= insurance_soon,
                CollateralInsurance.status == "active",
            ).all()
            # Only alert if the item has no other policy that is still healthy
            if p.collateral_item_id not in covered_item_ids
        ]

        expired_insurance = [
            p for p in tenant_session.query(CollateralInsurance).options(ins_options).filter(
                CollateralInsurance.expiry_date < today,
                CollateralInsurance.status == "active",
            ).all()
            # Only alert if the item has no current valid policy
            if p.collateral_item_id not in covered_item_ids
        ]

        def enrich_insurance(p):
            d = insurance_to_dict(p)
            item = p.collateral_item
            if item:
                loan = item.loan
                member = loan.member if loan else None
                d["collateral_description"] = item.description
                d["loan_number"] = loan.application_number if loan else None
                d["member_name"] = f"{member.first_name} {member.last_name}" if member else None
            return d

        # Fire deduped notifications for expiring / expired insurance
        # Only create a notification if one hasn't been sent in the last 7 days for the same policy
        try:
            from routes.notifications import create_notification
            from models.tenant import InAppNotification
            week_ago = datetime.utcnow() - timedelta(days=7)
            link = "/?section=collateral"
            for p in expiring_insurance:
                tag = f"[ins:{p.id}]"
                already = tenant_session.query(InAppNotification).filter(
                    InAppNotification.title.contains(tag),
                    InAppNotification.created_at >= week_ago,
                ).first()
                if not already:
                    item = p.collateral_item
                    desc = item.description if item else "collateral item"
                    days_left = (p.expiry_date - today).days
                    create_notification(
                        tenant_session,
                        title=f"Insurance Expiring Soon {tag}",
                        message=(
                            f"Insurance policy (#{p.policy_number}) for '{desc}' expires in {days_left} day(s) "
                            f"on {p.expiry_date.strftime('%d %b %Y')}. Please renew before it lapses."
                        ),
                        notification_type="warning",
                        link=link,
                        staff_id=None,
                    )
            for p in expired_insurance:
                tag = f"[ins:{p.id}]"
                already = tenant_session.query(InAppNotification).filter(
                    InAppNotification.title.contains(tag),
                    InAppNotification.created_at >= week_ago,
                ).first()
                if not already:
                    item = p.collateral_item
                    desc = item.description if item else "collateral item"
                    create_notification(
                        tenant_session,
                        title=f"Insurance Expired {tag}",
                        message=(
                            f"Insurance policy (#{p.policy_number}) for '{desc}' expired on "
                            f"{p.expiry_date.strftime('%d %b %Y')} and is still marked active. "
                            "Renew or update the policy status immediately."
                        ),
                        notification_type="warning",
                        link=link,
                        staff_id=None,
                    )
            tenant_session.commit()
        except Exception:
            pass

        return {
            "overdue_revaluation": [item_to_dict(i) for i in overdue_revaluation],
            "due_soon_revaluation": [item_to_dict(i) for i in due_soon_revaluation],
            "expiring_insurance": [enrich_insurance(p) for p in expiring_insurance],
            "expired_insurance": [enrich_insurance(p) for p in expired_insurance],
            "summary": {
                "overdue_revaluation_count": len(overdue_revaluation),
                "due_soon_revaluation_count": len(due_soon_revaluation),
                "expiring_insurance_count": len(expiring_insurance),
                "expired_insurance_count": len(expired_insurance),
            }
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{organization_id}/collateral/stats")
def get_collateral_stats(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        total = tenant_session.query(CollateralItem).count()
        by_status = {
            s: tenant_session.query(CollateralItem).filter(CollateralItem.status == s).count()
            for s in ["registered", "under_lien", "released", "defaulted", "liquidated"]
        }
        today = date.today()
        overdue_revaluation = tenant_session.query(CollateralItem).filter(
            CollateralItem.next_revaluation_date < today,
            CollateralItem.status == "under_lien",
        ).count()
        soon = today + timedelta(days=30)
        covered_ids = {
            row[0] for row in tenant_session.query(CollateralInsurance.collateral_item_id).filter(
                CollateralInsurance.status == "active",
                CollateralInsurance.expiry_date > soon,
            ).all()
        }
        expiring_insurance = sum(
            1 for p in tenant_session.query(
                CollateralInsurance.collateral_item_id,
                CollateralInsurance.expiry_date,
            ).filter(
                CollateralInsurance.expiry_date >= today,
                CollateralInsurance.expiry_date <= soon,
                CollateralInsurance.status == "active",
            ).all()
            if p[0] not in covered_ids
        )
        return {
            "total_items": total,
            "by_status": by_status,
            "overdue_revaluation": overdue_revaluation,
            "expiring_insurance": expiring_insurance,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


# ── Valuers Registry ──────────────────────────────────────────────────────────

class ValuerCreate(BaseModel):
    name: str
    license_number: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    location: Optional[str] = None
    physical_address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True

class ValuerUpdate(BaseModel):
    name: Optional[str] = None
    license_number: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    location: Optional[str] = None
    physical_address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

def valuer_to_dict(v: Valuer) -> dict:
    return {
        "id": v.id,
        "name": v.name,
        "license_number": v.license_number,
        "contact_phone": v.contact_phone,
        "contact_email": v.contact_email,
        "location": v.location,
        "physical_address": v.physical_address,
        "notes": v.notes,
        "is_active": v.is_active,
        "created_at": v.created_at.isoformat() if v.created_at else None,
    }

@router.get("/{organization_id}/collateral/valuers")
def list_valuers(
    organization_id: str,
    search: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        q = tenant_session.query(Valuer)
        if active_only:
            q = q.filter(Valuer.is_active == True)
        if search:
            q = q.filter(or_(
                Valuer.name.ilike(f"%{search}%"),
                Valuer.license_number.ilike(f"%{search}%"),
            ))
        return [valuer_to_dict(v) for v in q.order_by(Valuer.name).all()]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{organization_id}/collateral/valuers", dependencies=[Depends(require_not_demo)])
def create_valuer(
    organization_id: str,
    body: ValuerCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        v = Valuer(**body.model_dump())
        tenant_session.add(v)
        tenant_session.commit()
        tenant_session.refresh(v)
        return valuer_to_dict(v)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{organization_id}/collateral/valuers/{valuer_id}", dependencies=[Depends(require_not_demo)])
def update_valuer(
    organization_id: str,
    valuer_id: str,
    body: ValuerUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        v = tenant_session.query(Valuer).filter(Valuer.id == valuer_id).first()
        if not v:
            raise HTTPException(status_code=404, detail="Valuer not found")
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(v, field, value)
        tenant_session.commit()
        tenant_session.refresh(v)
        return valuer_to_dict(v)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.delete("/{organization_id}/collateral/valuers/{valuer_id}", dependencies=[Depends(require_not_demo)])
def delete_valuer(
    organization_id: str,
    valuer_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        v = tenant_session.query(Valuer).filter(Valuer.id == valuer_id).first()
        if not v:
            raise HTTPException(status_code=404, detail="Valuer not found")
        in_use = tenant_session.query(CollateralItem).filter(CollateralItem.valuer_id == valuer_id).count()
        if in_use:
            v.is_active = False
            tenant_session.commit()
            return {"deactivated": True, "reason": "in_use"}
        tenant_session.delete(v)
        tenant_session.commit()
        return {"deleted": True}
    finally:
        tenant_session.close()
        tenant_ctx.close()


# ── Valuation Document Upload ──────────────────────────────────────────────────

@router.post("/{organization_id}/collateral/items/{item_id}/upload-document", dependencies=[Depends(require_not_demo)])
async def upload_valuation_document(
    organization_id: str,
    item_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_ctx, membership = get_tenant_session_context(organization_id, current_user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        item = tenant_session.query(CollateralItem).filter(CollateralItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Collateral item not found")

        ext = Path(file.filename).suffix.lower() if file.filename else ".pdf"
        allowed = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
        if ext not in allowed:
            raise HTTPException(status_code=400, detail="File type not allowed. Use PDF, image, or Word document.")

        filename = f"{organization_id}_{item_id}_{uuid.uuid4().hex}{ext}"
        dest = UPLOADS_DIR / filename
        with dest.open("wb") as buf:
            shutil.copyfileobj(file.file, buf)

        if item.valuation_document_path and item.valuation_document_path != filename:
            old = UPLOADS_DIR / item.valuation_document_path
            if old.exists():
                old.unlink(missing_ok=True)

        item.valuation_document_path = filename
        item.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(item)
        return {"valuation_document_path": filename, "valuation_document_url": f"/api/uploads/valuations/{filename}"}
    finally:
        tenant_session.close()
        tenant_ctx.close()


# ── Seed helper ───────────────────────────────────────────────────────────────

def _seed_default_types(tenant_session):
    for t in DEFAULT_COLLATERAL_TYPES:
        obj = CollateralType(is_system=True, **t)
        tenant_session.add(obj)
