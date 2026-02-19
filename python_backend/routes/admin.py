from fastapi import APIRouter, HTTPException, Depends, Cookie, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional
from datetime import datetime, timedelta
import bcrypt
import secrets
import os

from models.database import get_db, get_tenant_session
from services.neon_tenant import neon_tenant_service
from models.master import (
    Organization, OrganizationMember, User, AdminUser, AdminSession,
    SubscriptionPlan, OrganizationSubscription, LicenseKey, PlatformSettings,
    Session as UserSession, PasswordResetToken, EmailVerificationToken
)
from services.feature_flags import (
    get_all_features, PLAN_LIMITS, 
    EDITION_LIMITS, generate_license_key,
    get_all_plan_features_from_db, get_all_edition_features_from_db,
    _get_edition_features_from_db
)

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/public/branding")
def get_public_branding(db: Session = Depends(get_db)):
    """Get public platform branding settings (no auth required)"""
    initialize_platform_settings(db)
    
    branding_keys = [
        "platform_name", "support_email",
        "theme_primary_color", "theme_secondary_color", 
        "theme_accent_color", "theme_sidebar_color"
    ]
    
    settings = db.query(PlatformSettings).filter(
        PlatformSettings.setting_key.in_(branding_keys)
    ).all()
    
    result = {}
    for s in settings:
        result[s.setting_key] = s.setting_value or ""
    
    return result

@router.get("/public/legal/{page_type}")
def get_public_legal_content(page_type: str, db: Session = Depends(get_db)):
    """Get public legal page content (terms or privacy) - no auth required"""
    initialize_platform_settings(db)
    
    if page_type not in ("terms", "privacy"):
        raise HTTPException(status_code=404, detail="Page not found")
    
    key_map = {
        "terms": ("terms_of_service", "terms_last_updated"),
        "privacy": ("privacy_policy", "privacy_last_updated"),
    }
    
    content_key, date_key = key_map[page_type]
    
    settings = db.query(PlatformSettings).filter(
        PlatformSettings.setting_key.in_([content_key, date_key, "platform_name"])
    ).all()
    
    result = {}
    for s in settings:
        result[s.setting_key] = s.setting_value or ""
    
    return {
        "content": result.get(content_key, ""),
        "last_updated": result.get(date_key, ""),
        "platform_name": result.get("platform_name", "BANKY"),
    }

@router.get("/public/enabled-gateways")
def get_enabled_gateways(db: Session = Depends(get_db)):
    """Get which payment gateways are enabled (no auth required)"""
    initialize_platform_settings(db)
    
    gateway_keys = ["gateway_mpesa_enabled", "gateway_stripe_enabled", "gateway_paystack_enabled"]
    settings = db.query(PlatformSettings).filter(
        PlatformSettings.setting_key.in_(gateway_keys)
    ).all()
    
    result = {}
    for s in settings:
        result[s.setting_key] = s.setting_value == "true"
    
    return {
        "mpesa": result.get("gateway_mpesa_enabled", True),
        "stripe": result.get("gateway_stripe_enabled", True),
        "paystack": result.get("gateway_paystack_enabled", True),
    }

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except:
        return False

def get_current_admin(token: str, db: Session):
    if not token:
        return None
    session = db.query(AdminSession).filter(
        AdminSession.token == token,
        AdminSession.expires_at > datetime.utcnow()
    ).first()
    if not session:
        return None
    return db.query(AdminUser).filter(AdminUser.id == session.admin_id).first()

def require_admin(banky_admin_token: Optional[str] = Cookie(None), db: Session = Depends(get_db)):
    admin = get_current_admin(banky_admin_token, db)
    if not admin:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    return admin

@router.post("/login")
def admin_login(data: dict, response: Response, db: Session = Depends(get_db)):
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    admin = db.query(AdminUser).filter(
        AdminUser.email == email,
        AdminUser.is_active == True
    ).first()
    
    if not admin or not verify_password(password, admin.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = secrets.token_urlsafe(32)
    session = AdminSession(
        admin_id=admin.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(session)
    admin.last_login = datetime.utcnow()
    db.commit()
    
    is_prod = os.environ.get("REPL_SLUG") is not None
    
    response.set_cookie(
        key="banky_admin_token",
        value=token,
        httponly=True,
        max_age=7*24*60*60,
        samesite="lax",
        secure=is_prod
    )
    
    return {"id": admin.id, "email": admin.email, "name": admin.name}

@router.post("/logout")
def admin_logout(response: Response, banky_admin_token: Optional[str] = Cookie(None), db: Session = Depends(get_db)):
    if banky_admin_token:
        db.query(AdminSession).filter(AdminSession.token == banky_admin_token).delete()
        db.commit()
    response.delete_cookie("banky_admin_token")
    return {"message": "Logged out"}

@router.get("/me")
def get_admin_profile(admin: AdminUser = Depends(require_admin)):
    return {"id": admin.id, "email": admin.email, "name": admin.name}

@router.get("/dashboard")
def get_dashboard_stats(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    total_orgs = db.query(func.count(Organization.id)).scalar() or 0
    active_orgs = db.query(func.count(Organization.id)).filter(Organization.is_active == True).scalar() or 0
    
    subscriptions = db.query(OrganizationSubscription).all()
    by_plan = {}
    by_status = {}
    for sub in subscriptions:
        plan_type = sub.plan.plan_type if sub.plan else "none"
        by_plan[plan_type] = by_plan.get(plan_type, 0) + 1
        by_status[sub.status] = by_status.get(sub.status, 0) + 1
    
    total_members = 0
    total_staff = 0
    for org in db.query(Organization).filter(Organization.connection_string.isnot(None)).all():
        try:
            tenant_db = get_tenant_session(org.connection_string)
            from sqlalchemy import text
            result = tenant_db.execute(text("SELECT COUNT(*) FROM members")).scalar()
            total_members += result or 0
            result = tenant_db.execute(text("SELECT COUNT(*) FROM staff")).scalar()
            total_staff += result or 0
            tenant_db.close()
        except:
            pass
    
    licenses = db.query(LicenseKey).filter(LicenseKey.is_active == True).count()
    
    return {
        "organizations": {
            "total": total_orgs,
            "active": active_orgs
        },
        "subscriptions": {
            "by_plan": by_plan,
            "by_status": by_status
        },
        "platform": {
            "total_members": total_members,
            "total_staff": total_staff
        },
        "licenses": {
            "active": licenses
        }
    }

@router.get("/organizations")
def list_organizations(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    orgs = db.query(Organization).order_by(Organization.created_at.desc()).all()
    result = []
    
    for org in orgs:
        sub = db.query(OrganizationSubscription).filter(
            OrganizationSubscription.organization_id == org.id
        ).first()
        
        member_count = 0
        staff_count = 0
        if org.connection_string:
            try:
                tenant_db = get_tenant_session(org.connection_string)
                from sqlalchemy import text
                member_count = tenant_db.execute(text("SELECT COUNT(*) FROM members")).scalar() or 0
                staff_count = tenant_db.execute(text("SELECT COUNT(*) FROM staff")).scalar() or 0
                tenant_db.close()
            except:
                pass
        
        owner = db.query(User).join(OrganizationMember).filter(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.is_owner == True
        ).first()
        
        result.append({
            "id": org.id,
            "name": org.name,
            "code": org.code,
            "email": org.email,
            "phone": org.phone,
            "is_active": org.is_active,
            "created_at": org.created_at.isoformat() if org.created_at else None,
            "subscription": {
                "plan": sub.plan.plan_type if sub and sub.plan else None,
                "status": sub.status if sub else None,
                "trial_ends_at": sub.trial_ends_at.isoformat() if sub and sub.trial_ends_at else None
            } if sub else None,
            "usage": {
                "members": member_count,
                "staff": staff_count
            },
            "owner": {
                "email": owner.email if owner else None,
                "name": f"{owner.first_name or ''} {owner.last_name or ''}".strip() if owner else None
            }
        })
    
    return result

@router.post("/organizations")
def create_organization(data: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    """Create a new organization from admin panel"""
    name = data.get("name", "").strip()
    code = data.get("code", "").strip().upper()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    staff_email_domain = data.get("staff_email_domain", "").strip()
    plan_id = data.get("plan_id")
    owner_email = data.get("owner_email", "").strip()
    owner_first_name = data.get("owner_first_name", "").strip()
    owner_last_name = data.get("owner_last_name", "").strip()
    owner_password = data.get("owner_password", "")
    subscription_status = data.get("subscription_status", "trial")
    
    if not name:
        raise HTTPException(status_code=400, detail="Organization name is required")
    if not code:
        code = name.upper().replace(" ", "_")[:20]
    if not owner_email:
        raise HTTPException(status_code=400, detail="Owner email is required")
    if not owner_password:
        raise HTTPException(status_code=400, detail="Owner password is required")
    
    existing_org = db.query(Organization).filter(Organization.code == code).first()
    if existing_org:
        raise HTTPException(status_code=400, detail="Organization code already exists")
    
    existing_user = db.query(User).filter(User.email == owner_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    try:
        org = Organization(
            name=name,
            code=code,
            email=email or owner_email,
            phone=phone,
            staff_email_domain=staff_email_domain or None,
            is_active=True
        )
        db.add(org)
        db.flush()
        
        user = User(
            email=owner_email,
            password=hash_password(owner_password),
            first_name=owner_first_name,
            last_name=owner_last_name
        )
        db.add(user)
        db.flush()
        
        membership = OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            is_owner=True,
            role="owner"
        )
        db.add(membership)
        
        if plan_id:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
            if plan:
                trial_days = 14
                settings = db.query(PlatformSettings).filter(PlatformSettings.setting_key == "default_trial_days").first()
                if settings and settings.setting_value:
                    try:
                        trial_days = int(settings.setting_value)
                    except:
                        pass
                
                sub = OrganizationSubscription(
                    organization_id=org.id,
                    plan_id=plan.id,
                    status=subscription_status,
                    trial_ends_at=datetime.utcnow() + timedelta(days=trial_days) if subscription_status == "trial" else None,
                    current_period_start=datetime.utcnow(),
                    current_period_end=datetime.utcnow() + timedelta(days=30)
                )
                db.add(sub)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Organization '{name}' created successfully",
            "organization_id": str(org.id)
        }
        
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create organization: {str(e)}")

@router.get("/organizations/{org_id}")
def get_organization_details(org_id: str, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    sub = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == org.id
    ).first()
    
    usage = {"members": 0, "staff": 0, "branches": 0, "loans": 0}
    if org.connection_string:
        try:
            tenant_db = get_tenant_session(org.connection_string)
            from sqlalchemy import text
            usage["members"] = tenant_db.execute(text("SELECT COUNT(*) FROM members")).scalar() or 0
            usage["staff"] = tenant_db.execute(text("SELECT COUNT(*) FROM staff")).scalar() or 0
            usage["branches"] = tenant_db.execute(text("SELECT COUNT(*) FROM branches")).scalar() or 0
            usage["loans"] = tenant_db.execute(text("SELECT COUNT(*) FROM loans")).scalar() or 0
            tenant_db.close()
        except:
            pass
    
    return {
        "id": org.id,
        "name": org.name,
        "code": org.code,
        "email": org.email,
        "phone": org.phone,
        "address": org.address,
        "is_active": org.is_active,
        "created_at": org.created_at.isoformat() if org.created_at else None,
        "subscription": {
            "id": sub.id if sub else None,
            "plan_id": sub.plan_id if sub else None,
            "plan": sub.plan.plan_type if sub and sub.plan else None,
            "status": sub.status if sub else None,
            "trial_ends_at": sub.trial_ends_at.isoformat() if sub and sub.trial_ends_at else None,
            "current_period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
            "sms_credits_used": sub.sms_credits_used if sub else 0
        } if sub else None,
        "usage": usage
    }

@router.delete("/organizations/{org_id}")
async def admin_delete_organization(org_id: str, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
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

@router.put("/organizations/{org_id}/subscription")
def update_subscription(org_id: str, data: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    sub = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == org.id
    ).first()
    
    plan_type = data.get("plan_type")
    status = data.get("status")
    
    if not sub:
        sub = OrganizationSubscription(organization_id=org.id)
        db.add(sub)
    
    if plan_type:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_type == plan_type).first()
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid plan type")
        sub.plan_id = plan.id
    
    if status:
        sub.status = status
        sub.updated_at = datetime.utcnow()
    
    db.commit()
    return {"message": "Subscription updated"}

@router.put("/organizations/{org_id}/status")
def update_org_status(org_id: str, data: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    org.is_active = data.get("is_active", org.is_active)
    db.commit()
    return {"message": "Organization status updated"}

@router.put("/organizations/{org_id}/reset-password")
def reset_org_owner_password(org_id: str, data: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    new_password = data.get("new_password", "").strip()
    if not new_password or len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.is_owner == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Organization owner not found")
    
    owner = db.query(User).filter(User.id == membership.user_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner user not found")
    
    owner.password = hash_password(new_password)
    db.commit()
    return {"message": f"Password reset successfully for {owner.email}"}

@router.get("/plans")
def list_plans(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.sort_order, SubscriptionPlan.monthly_price).all()
    return [{
        "id": p.id,
        "name": p.name,
        "plan_type": p.plan_type,
        "pricing_model": p.pricing_model or "saas",
        "monthly_price": float(p.monthly_price) if p.monthly_price else 0,
        "annual_price": float(p.annual_price) if p.annual_price else 0,
        "one_time_price": float(p.one_time_price) if p.one_time_price else 0,
        "max_members": p.max_members,
        "max_staff": p.max_staff,
        "max_branches": p.max_branches,
        "sms_credits_monthly": p.sms_credits_monthly,
        "support_years": p.support_years or 1,
        "sort_order": p.sort_order or 0,
        "features": p.features,
        "is_active": p.is_active
    } for p in plans]

@router.post("/plans")
def create_plan(data: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    plan = SubscriptionPlan(
        name=data.get("name"),
        plan_type=data.get("plan_type"),
        monthly_price=data.get("monthly_price", 0),
        annual_price=data.get("annual_price", 0),
        max_members=data.get("max_members", 500),
        max_staff=data.get("max_staff", 3),
        max_branches=data.get("max_branches", 1),
        sms_credits_monthly=data.get("sms_credits_monthly", 0),
        features=data.get("features", {})
    )
    db.add(plan)
    db.commit()
    return {"id": plan.id, "message": "Plan created"}

@router.put("/plans/{plan_id}")
def update_plan(plan_id: str, data: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    for field in ["name", "monthly_price", "annual_price", "one_time_price", "max_members", "max_staff", "max_branches", "sms_credits_monthly", "support_years", "sort_order", "features", "is_active", "pricing_model"]:
        if field in data:
            setattr(plan, field, data[field])
    
    db.commit()
    return {"message": "Plan updated"}

@router.get("/enterprise-plans")
def get_enterprise_plans_for_license(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    """Get enterprise plans for license key generation dropdown"""
    plans = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.pricing_model == "enterprise",
        SubscriptionPlan.is_active == True
    ).order_by(SubscriptionPlan.sort_order).all()
    
    return [{
        "id": p.id,
        "name": p.name,
        "plan_type": p.plan_type,
        "price": float(p.one_time_price) if p.one_time_price else 0,
        "max_members": p.max_members,
        "max_staff": p.max_staff,
        "max_branches": p.max_branches,
        "support_years": p.support_years or 1,
        "features": p.features
    } for p in plans]

@router.get("/licenses")
def list_licenses(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    licenses = db.query(LicenseKey).order_by(LicenseKey.issued_at.desc()).all()
    return [{
        "id": l.id,
        "license_key": l.license_key,
        "edition": l.edition,
        "organization_name": l.organization_name,
        "contact_email": l.contact_email,
        "features": l.features,
        "max_members": l.max_members,
        "max_staff": l.max_staff,
        "max_branches": l.max_branches,
        "issued_at": l.issued_at.isoformat() if l.issued_at else None,
        "expires_at": l.expires_at.isoformat() if l.expires_at else None,
        "is_active": l.is_active,
        "notes": l.notes
    } for l in licenses]

@router.post("/licenses")
def create_license(data: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    plan_id = data.get("plan_id")
    edition = data.get("edition", "basic")
    org_name = data.get("organization_name", "")
    
    plan = None
    if plan_id:
        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == plan_id,
            SubscriptionPlan.pricing_model == "enterprise"
        ).first()
    
    if not plan:
        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_type == edition,
            SubscriptionPlan.pricing_model == "enterprise"
        ).first()
    
    if plan:
        max_members = data.get("max_members") or plan.max_members
        max_staff = data.get("max_staff") or plan.max_staff
        max_branches = data.get("max_branches") or plan.max_branches
        features = plan.features.get("enabled", []) if plan.features else []
        support_years = plan.support_years or 1
        edition = plan.plan_type
    else:
        limits = EDITION_LIMITS.get(edition, EDITION_LIMITS["basic"])
        max_members = data.get("max_members") or limits.get("max_members")
        max_staff = data.get("max_staff") or limits.get("max_staff")
        max_branches = data.get("max_branches") or limits.get("max_branches")
        features = list(_get_edition_features_from_db(edition, db))
        support_years = 1
    
    license_key = generate_license_key(edition, org_name)
    
    expires_at = None
    expires_in_years = data.get("expires_in_years") or support_years
    if expires_in_years:
        expires_at = datetime.utcnow() + timedelta(days=365 * int(expires_in_years))
    
    license = LicenseKey(
        license_key=license_key,
        edition=edition,
        organization_name=org_name,
        contact_email=data.get("contact_email"),
        features={"enabled": features},
        max_members=max_members,
        max_staff=max_staff,
        max_branches=max_branches,
        expires_at=expires_at,
        notes=data.get("notes")
    )
    db.add(license)
    db.commit()
    
    return {
        "id": license.id,
        "license_key": license.license_key,
        "edition": edition,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "message": "License created"
    }

@router.put("/licenses/{license_id}")
def update_license(license_id: str, data: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    license = db.query(LicenseKey).filter(LicenseKey.id == license_id).first()
    if not license:
        raise HTTPException(status_code=404, detail="License not found")
    
    for field in ["organization_name", "contact_email", "max_members", "max_staff", "max_branches", "is_active", "notes"]:
        if field in data:
            setattr(license, field, data[field])
    
    db.commit()
    return {"message": "License updated"}

@router.get("/features")
def list_features(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return {
        "features": get_all_features(),
        "plan_features": get_all_plan_features_from_db(db),
        "edition_features": get_all_edition_features_from_db(db),
        "plan_limits": PLAN_LIMITS,
        "edition_limits": EDITION_LIMITS
    }

@router.post("/plans/reset-features")
def reset_plan_features_to_defaults(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    from main import DEFAULT_PLAN_FEATURES
    
    plans = db.query(SubscriptionPlan).all()
    updated = 0
    for plan in plans:
        default_features = DEFAULT_PLAN_FEATURES.get(plan.plan_type)
        if default_features:
            plan.features = {"enabled": list(default_features)}
            updated += 1
    
    db.commit()
    return {"message": f"Reset features to defaults for {updated} plans", "updated": updated}

@router.get("/landing-page")
def get_landing_page_settings(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    """Get landing page settings"""
    settings = db.query(PlatformSettings).filter(
        PlatformSettings.setting_key.like("landing_%")
    ).all()
    
    defaults = {
        "landing_hero_title": "The Complete Banking Platform for Saccos",
        "landing_hero_subtitle": "Manage members, loans, savings, fixed deposits, and dividends with a powerful, secure multi-tenant system. Available as SaaS or self-hosted.",
        "landing_hero_badge": "Trusted by 500+ Saccos in East Africa",
        "landing_cta_primary_text": "Start Free Trial",
        "landing_cta_primary_url": "#pricing",
        "landing_cta_secondary_text": "Watch Demo",
        "landing_cta_secondary_url": "",
        "landing_demo_video_url": "",
        "landing_app_url": "https://app.banky.co.ke",
        "landing_stats_saccos": "500+",
        "landing_stats_transactions": "KES 2B+",
        "landing_stats_members": "1M+",
        "landing_stats_uptime": "99.9%"
    }
    
    result = defaults.copy()
    for s in settings:
        result[s.setting_key] = s.setting_value
    
    return result

@router.put("/landing-page")
def update_landing_page_settings(data: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    """Update landing page settings"""
    allowed_keys = [
        "landing_hero_title", "landing_hero_subtitle", "landing_hero_badge",
        "landing_cta_primary_text", "landing_cta_primary_url",
        "landing_cta_secondary_text", "landing_cta_secondary_url",
        "landing_demo_video_url", "landing_app_url",
        "landing_stats_saccos", "landing_stats_transactions",
        "landing_stats_members", "landing_stats_uptime"
    ]
    
    for key, value in data.items():
        if key in allowed_keys:
            setting = db.query(PlatformSettings).filter(PlatformSettings.setting_key == key).first()
            if setting:
                setting.setting_value = str(value)
            else:
                setting = PlatformSettings(setting_key=key, setting_value=str(value))
                db.add(setting)
    
    db.commit()
    return {"message": "Landing page settings updated"}

@router.post("/plans")
def create_plan(data: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    """Create a new subscription plan"""
    plan = SubscriptionPlan(
        name=data.get("name", "New Plan"),
        plan_type=data.get("plan_type", "custom"),
        pricing_model=data.get("pricing_model", "saas"),
        monthly_price=data.get("monthly_price", 0),
        annual_price=data.get("annual_price", 0),
        one_time_price=data.get("one_time_price", 0),
        max_members=data.get("max_members"),
        max_staff=data.get("max_staff"),
        max_branches=data.get("max_branches"),
        sms_credits_monthly=data.get("sms_credits_monthly", 0),
        support_years=data.get("support_years", 1),
        features=data.get("features", {}),
        is_active=True,
        sort_order=data.get("sort_order", 99)
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {"id": plan.id, "message": "Plan created"}

@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: str, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    """Delete a subscription plan"""
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    org_count = db.query(Organization).filter(Organization.subscription_plan_id == plan_id).count()
    if org_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete plan: {org_count} organization(s) are using it")
    
    db.delete(plan)
    db.commit()
    return {"message": "Plan deleted"}

@router.get("/setup-status")
def check_setup_status(db: Session = Depends(get_db)):
    existing = db.query(AdminUser).first()
    return {"admin_exists": existing is not None}

@router.post("/setup")
def initial_setup(data: dict, db: Session = Depends(get_db)):
    existing = db.query(AdminUser).first()
    if existing:
        raise HTTPException(status_code=400, detail="Admin already exists")
    
    email = data.get("email")
    password = data.get("password")
    name = data.get("name", "Admin")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    admin = AdminUser(
        email=email,
        password=hash_password(password),
        name=name
    )
    db.add(admin)
    
    existing_plans = db.query(SubscriptionPlan).count()
    if existing_plans == 0:
        default_plans = [
            {"name": "Starter", "plan_type": "starter", "monthly_price": 50, "annual_price": 500, "max_members": 500, "max_staff": 3, "max_branches": 1, "sms_credits_monthly": 0},
            {"name": "Growth", "plan_type": "growth", "monthly_price": 150, "annual_price": 1500, "max_members": 2000, "max_staff": 10, "max_branches": 5, "sms_credits_monthly": 500},
            {"name": "Professional", "plan_type": "professional", "monthly_price": 400, "annual_price": 4000, "max_members": 10000, "max_staff": 50, "max_branches": 20, "sms_credits_monthly": 2000},
            {"name": "Enterprise", "plan_type": "enterprise", "monthly_price": 0, "annual_price": 0, "max_members": None, "max_staff": None, "max_branches": None, "sms_credits_monthly": None}
        ]
        
        for plan_data in default_plans:
            plan = SubscriptionPlan(**plan_data)
            db.add(plan)
    
    db.commit()
    
    return {"message": "Admin setup complete", "admin_id": admin.id}

DEFAULT_PLATFORM_SETTINGS = [
    {"key": "default_plan_id", "value": "", "type": "string", "description": "Default subscription plan for new organizations"},
    {"key": "trial_days", "value": "14", "type": "number", "description": "Number of trial days for new organizations"},
    {"key": "platform_name", "value": "BANKY", "type": "string", "description": "Platform name displayed across the system"},
    {"key": "support_email", "value": "", "type": "string", "description": "Support email address"},
    {"key": "sales_email", "value": "", "type": "string", "description": "Sales email address for enterprise inquiries"},
    {"key": "brevo_api_key", "value": "", "type": "string", "description": "Brevo API key for sending emails (sales inquiries, notifications)"},
    {"key": "brevo_sender_email", "value": "", "type": "string", "description": "Verified sender email for platform emails (verification, welcome, password reset)"},
    {"key": "brevo_sender_name", "value": "", "type": "string", "description": "Display name for platform emails"},
    {"key": "theme_primary_color", "value": "#2563eb", "type": "string", "description": "Primary brand color for buttons and links"},
    {"key": "theme_secondary_color", "value": "#64748b", "type": "string", "description": "Secondary color for supporting elements"},
    {"key": "theme_accent_color", "value": "#10b981", "type": "string", "description": "Accent color for success states and highlights"},
    {"key": "theme_sidebar_color", "value": "#1e293b", "type": "string", "description": "Background color for sidebars"},
    {"key": "subscription_sunpay_api_key", "value": "", "type": "string", "description": "SunPay API key for processing subscription payments via M-Pesa"},
    {"key": "subscription_mpesa_paybill", "value": "", "type": "string", "description": "M-Pesa Paybill/Till number displayed to customers for subscription payments"},
    {"key": "gateway_mpesa_enabled", "value": "true", "type": "boolean", "description": "Enable M-Pesa (KES) as a subscription payment gateway"},
    {"key": "gateway_stripe_enabled", "value": "true", "type": "boolean", "description": "Enable Stripe (USD) as a subscription payment gateway"},
    {"key": "gateway_paystack_enabled", "value": "true", "type": "boolean", "description": "Enable Paystack as a subscription payment gateway"},
    {"key": "paystack_currency", "value": "NGN", "type": "string", "description": "Currency for Paystack payments (NGN, KES, GHS, ZAR, USD) - must match your Paystack account currency"},
    {"key": "stripe_secret_key", "value": "", "type": "string", "description": "Stripe secret API key for processing card payments"},
    {"key": "stripe_publishable_key", "value": "", "type": "string", "description": "Stripe publishable key for frontend checkout"},
    {"key": "paystack_secret_key", "value": "", "type": "string", "description": "Paystack secret key for processing payments"},
    {"key": "paystack_public_key", "value": "", "type": "string", "description": "Paystack public key for frontend integration"},
    {"key": "terms_of_service", "value": "", "type": "text", "description": "Terms of Service page content (HTML)"},
    {"key": "privacy_policy", "value": "", "type": "text", "description": "Privacy Policy page content (HTML)"},
    {"key": "terms_last_updated", "value": "", "type": "string", "description": "Terms of Service last updated date"},
    {"key": "privacy_last_updated", "value": "", "type": "string", "description": "Privacy Policy last updated date"},
]

def initialize_platform_settings(db: Session):
    for setting in DEFAULT_PLATFORM_SETTINGS:
        existing = db.query(PlatformSettings).filter(PlatformSettings.setting_key == setting["key"]).first()
        if not existing:
            s = PlatformSettings(
                setting_key=setting["key"],
                setting_value=setting["value"],
                setting_type=setting["type"],
                description=setting["description"]
            )
            db.add(s)
    db.commit()

@router.get("/settings")
def get_platform_settings(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    initialize_platform_settings(db)
    settings = db.query(PlatformSettings).all()
    
    plans = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.is_active == True,
        SubscriptionPlan.pricing_model.in_(["saas", None])
    ).order_by(SubscriptionPlan.monthly_price).all()
    
    return {
        "settings": [{
            "key": s.setting_key,
            "value": s.setting_value,
            "type": s.setting_type,
            "description": s.description
        } for s in settings],
        "plans": [{
            "id": p.id,
            "name": p.name,
            "plan_type": p.plan_type
        } for p in plans]
    }

@router.put("/settings")
def update_platform_settings(updates: dict, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    initialize_platform_settings(db)
    
    for key, value in updates.items():
        setting = db.query(PlatformSettings).filter(PlatformSettings.setting_key == key).first()
        if setting:
            setting.setting_value = str(value) if value is not None else ""
            setting.updated_at = datetime.utcnow()
        else:
            new_setting = PlatformSettings(
                setting_key=key,
                setting_value=str(value) if value is not None else "",
                setting_type="string",
                description=""
            )
            db.add(new_setting)
    
    db.commit()
    return {"message": "Settings updated"}

def get_default_plan_id(db: Session) -> Optional[str]:
    setting = db.query(PlatformSettings).filter(PlatformSettings.setting_key == "default_plan_id").first()
    if setting and setting.setting_value:
        return setting.setting_value
    professional = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_type == "professional").first()
    return professional.id if professional else None

def get_trial_days(db: Session) -> int:
    setting = db.query(PlatformSettings).filter(PlatformSettings.setting_key == "trial_days").first()
    if setting and setting.setting_value:
        try:
            return int(setting.setting_value)
        except:
            return 14
    return 14
