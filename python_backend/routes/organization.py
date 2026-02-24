import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from models.database import get_db
from models.master import Organization, OrganizationMember, OrganizationSubscription, SubscriptionPlan, User, Session as UserSession, PasswordResetToken, EmailVerificationToken
from schemas.organization import OrganizationCreate, OrganizationUpdate, OrganizationResponse, OrganizationMemberResponse
from routes.auth import get_current_user
from middleware.demo_guard import require_not_demo
from services.neon_tenant import neon_tenant_service
from services.tenant_context import TenantContext
from services.feature_flags import get_deployment_mode
from routes.admin import get_default_plan_id, get_trial_days

router = APIRouter()

def sanitize_org(org: Organization) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "code": org.code,
        "logo": org.logo,
        "email": org.email,
        "phone": org.phone,
        "address": org.address,
        "staff_email_domain": org.staff_email_domain,
        "currency": org.currency or "KES",
        "is_active": org.is_active,
        "created_at": org.created_at
    }

def generate_org_code(db: Session) -> str:
    """Generate organization code like ORG0001"""
    count = db.query(Organization).count()
    return f"ORG{count + 1:04d}"

@router.post("", response_model=OrganizationResponse)
async def create_organization(data: OrganizationCreate, user = Depends(get_current_user), db: Session = Depends(get_db)):
    deployment_mode = get_deployment_mode()
    
    if deployment_mode == "enterprise":
        existing_org = db.query(Organization).first()
        if existing_org:
            raise HTTPException(
                status_code=400,
                detail="This deployment supports one organization. An organization already exists."
            )
    
    code = generate_org_code(db)
    
    staff_domain = data.staffEmailDomain.lstrip('@').strip() if data.staffEmailDomain else None
    if staff_domain and '.' not in staff_domain:
        staff_domain = f"{staff_domain}.com"
    
    org = Organization(
        name=data.name,
        code=code,
        logo=data.logo,
        email=data.email,
        phone=data.phone,
        address=data.address,
        staff_email_domain=staff_domain,
        deployment_mode=deployment_mode,
        currency=data.currency or "KES",
        financial_year_start="01-01"
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    
    if deployment_mode == "enterprise":
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            db.delete(org)
            db.commit()
            raise HTTPException(status_code=500, detail="DATABASE_URL not configured.")
        
        org.connection_string = database_url
        org.neon_project_id = None
        org.neon_branch_id = None
        db.commit()
        
        try:
            TenantContext(database_url)
            print(f"Enterprise: tenant tables created in shared database for org {org.id}")
        except Exception as migration_err:
            print(f"Enterprise tenant migration: {migration_err}")
    else:
        try:
            tenant_info = await neon_tenant_service.create_tenant_database(org.id, org.name)
            org.neon_project_id = tenant_info["project_id"]
            org.neon_branch_id = tenant_info["branch_id"]
            org.connection_string = tenant_info["connection_string"]
            db.commit()
            
            if tenant_info.get("connection_string"):
                try:
                    TenantContext(tenant_info["connection_string"])
                except Exception as migration_err:
                    print(f"Tenant migration during creation: {migration_err}")
        except Exception as e:
            print(f"Error provisioning tenant database: {e}")
            db.delete(org)
            db.commit()
            raise HTTPException(
                status_code=500, 
                detail="Failed to provision organization database. Please try again."
            )
    
    membership = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role="admin",
        is_owner=True
    )
    db.add(membership)
    db.commit()
    
    default_plan_id = get_default_plan_id(db)
    trial_days = get_trial_days(db)
    
    subscription = OrganizationSubscription(
        organization_id=org.id,
        plan_id=default_plan_id,
        status="trial",
        trial_ends_at=datetime.utcnow() + timedelta(days=trial_days),
        current_period_start=datetime.utcnow(),
        current_period_end=datetime.utcnow() + timedelta(days=30)
    )
    db.add(subscription)
    db.commit()
    
    return sanitize_org(org)

@router.get("")
async def list_organizations(user = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user.id
    ).all()
    
    result = []
    for membership in memberships:
        org = db.query(Organization).filter(Organization.id == membership.organization_id).first()
        if org:
            result.append(sanitize_org(org))
    
    return result

@router.get("/my")
async def get_my_organizations(auth = Depends(get_current_user), db: Session = Depends(get_db)):
    from routes.auth import AuthContext
    
    # If staff user, return their organization directly
    if hasattr(auth, 'is_staff') and auth.is_staff:
        org = db.query(Organization).filter(Organization.id == auth.organization_id).first()
        if org:
            return [{
                "id": auth.staff.id,
                "organizationId": auth.organization_id,
                "userId": auth.staff.id,
                "role": auth.staff.role,
                "isOwner": False,
                "organization": sanitize_org(org)
            }]
        return []
    
    # For master users, check OrganizationMember table
    user = auth.user if hasattr(auth, 'user') else auth
    memberships = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user.id
    ).all()
    
    result = []
    for membership in memberships:
        org = db.query(Organization).filter(Organization.id == membership.organization_id).first()
        if org:
            result.append({
                "id": membership.id,
                "organizationId": membership.organization_id,
                "userId": membership.user_id,
                "role": membership.role,
                "isOwner": membership.is_owner,
                "createdAt": membership.created_at,
                "organization": sanitize_org(org)
            })
    
    return result

@router.get("/{org_id}")
async def get_organization(org_id: str, user = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    return {
        **sanitize_org(org),
        "membership": {
            "id": membership.id,
            "role": membership.role,
            "is_owner": membership.is_owner
        }
    }

@router.patch("/{org_id}")
async def update_organization(org_id: str, data: OrganizationUpdate, user = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user.id,
        OrganizationMember.role == "admin"
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Only admins can update organization settings")
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    update_data = data.model_dump(exclude_unset=True)
    if "staff_email_domain" in update_data and update_data["staff_email_domain"]:
        domain = update_data["staff_email_domain"].lstrip('@').strip()
        if domain and '.' not in domain:
            domain = f"{domain}.com"
        update_data["staff_email_domain"] = domain
    for key, value in update_data.items():
        setattr(org, key, value)
    
    db.commit()
    db.refresh(org)
    
    return sanitize_org(org)

@router.delete("/{org_id}", dependencies=[Depends(require_not_demo)])
async def delete_organization(org_id: str, user = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user.id,
        OrganizationMember.is_owner == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Only the organization owner can delete the organization")
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if org.neon_project_id:
        try:
            deleted = await neon_tenant_service.delete_tenant_database(org.neon_project_id)
            if not deleted:
                raise HTTPException(status_code=500, detail="Failed to delete organization database. Please try again.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete organization database: {str(e)}")
    
    all_members = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id
    ).all()
    user_ids_to_check = [m.user_id for m in all_members]
    
    db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == org_id
    ).delete()
    db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id
    ).delete()
    db.delete(org)
    
    for uid in user_ids_to_check:
        other_memberships = db.query(OrganizationMember).filter(
            OrganizationMember.user_id == uid
        ).count()
        if other_memberships == 0:
            db.query(PasswordResetToken).filter(PasswordResetToken.user_id == uid).delete()
            db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == uid).delete()
            db.query(UserSession).filter(UserSession.user_id == uid).delete()
            db.query(User).filter(User.id == uid).delete()
    
    db.commit()
    
    return {"message": "Organization deleted successfully"}

@router.get("/{org_id}/team")
async def get_organization_team(org_id: str, user = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user.id,
        OrganizationMember.role == "admin"
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Only admins can view organization team")
    
    members = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id
    ).all()
    
    return members
