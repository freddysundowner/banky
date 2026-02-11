from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os

from models.database import get_db
from models.master import Organization, OrganizationSubscription, SubscriptionPlan, OrganizationMember
from services.feature_flags import (
    get_deployment_mode, get_license_key, get_feature_access_for_enterprise,
    get_feature_access_for_saas, Feature, PLAN_FEATURES, PLAN_LIMITS
)
from routes.auth import get_current_user

router = APIRouter()

def get_subscription_status_info(subscription):
    """Get detailed subscription status information"""
    if not subscription:
        return {
            "status": "none",
            "is_active": False,
            "is_trial": False,
            "trial_days_remaining": 0,
            "trial_ends_at": None,
            "is_expired": True,
            "message": "No subscription found"
        }
    
    now = datetime.utcnow()
    status = subscription.status or "trial"
    is_trial = status == "trial"
    is_active = status in ["trial", "active"]
    is_expired = status in ["expired", "cancelled", "past_due"]
    
    trial_days_remaining = 0
    trial_ends_at = None
    
    if is_trial and subscription.trial_ends_at:
        trial_ends_at = subscription.trial_ends_at.isoformat()
        delta = subscription.trial_ends_at - now
        trial_days_remaining = max(0, delta.days)
        if delta.total_seconds() < 0:
            is_expired = True
            is_active = False
    
    message = None
    if is_expired:
        if status == "expired":
            message = "Your trial has expired. Please upgrade to continue using the platform."
        elif status == "past_due":
            message = "Your payment is past due. Please update your payment method."
        elif status == "cancelled":
            message = "Your subscription has been cancelled."
    elif is_trial and trial_days_remaining <= 3:
        message = f"Your trial expires in {trial_days_remaining} day{'s' if trial_days_remaining != 1 else ''}. Upgrade now to avoid interruption."
    
    return {
        "status": status,
        "is_active": is_active,
        "is_trial": is_trial,
        "trial_days_remaining": trial_days_remaining,
        "trial_ends_at": trial_ends_at,
        "is_expired": is_expired,
        "message": message
    }

@router.get("/{organization_id}/subscription-status")
def get_subscription_status(organization_id: str, db: Session = Depends(get_db)):
    """Get the current subscription status for an organization"""
    subscription = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == organization_id
    ).first()
    
    status_info = get_subscription_status_info(subscription)
    
    plan_name = None
    if subscription and subscription.plan:
        plan_name = subscription.plan.name
    
    return {
        **status_info,
        "plan_name": plan_name
    }

@router.get("/{organization_id}/features")
def get_organization_features(organization_id: str, db: Session = Depends(get_db)):
    mode = get_deployment_mode()
    
    if mode == "enterprise":
        license_key = get_license_key()
        access = get_feature_access_for_enterprise(license_key)
        return {
            "mode": access.mode,
            "plan_or_edition": access.plan_or_edition,
            "features": list(access.enabled_features),
            "limits": access.limits,
            "subscription_status": {
                "status": "active",
                "is_active": True,
                "is_trial": False,
                "is_expired": False
            }
        }
    
    subscription = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == organization_id
    ).first()
    
    status_info = get_subscription_status_info(subscription)
    
    if status_info["is_expired"]:
        return {
            "mode": "saas",
            "plan_or_edition": "expired",
            "features": [],
            "limits": {"max_members": 0, "max_staff": 0, "max_branches": 0, "sms_monthly": 0},
            "subscription_status": status_info
        }
    
    plan_type = "starter"
    plan_features = None
    limits = PLAN_LIMITS.get("starter", {})
    
    if subscription and subscription.plan:
        plan_type = subscription.plan.plan_type
        limits = {
            "max_members": subscription.plan.max_members,
            "max_staff": subscription.plan.max_staff,
            "max_branches": subscription.plan.max_branches,
            "sms_monthly": subscription.plan.sms_credits_monthly
        }
        if subscription.plan.features and subscription.plan.features.get("enabled"):
            plan_features = subscription.plan.features.get("enabled")
    
    if plan_features:
        features = plan_features
    else:
        access = get_feature_access_for_saas(plan_type)
        features = list(access.enabled_features)
    
    return {
        "mode": "saas",
        "plan_or_edition": plan_type,
        "features": features,
        "limits": limits,
        "subscription_status": status_info
    }

@router.get("/{organization_id}/features/check/{feature_name}")
def check_feature(organization_id: str, feature_name: str, db: Session = Depends(get_db)):
    mode = get_deployment_mode()
    
    if mode == "enterprise":
        license_key = get_license_key()
        access = get_feature_access_for_enterprise(license_key)
        is_expired = False
    else:
        subscription = db.query(OrganizationSubscription).filter(
            OrganizationSubscription.organization_id == organization_id
        ).first()
        
        status_info = get_subscription_status_info(subscription)
        is_expired = status_info["is_expired"]
        
        if is_expired:
            return {
                "feature": feature_name,
                "enabled": False,
                "plan": "expired",
                "reason": "Subscription expired"
            }
        
        plan_type = "starter"
        if subscription and subscription.plan:
            plan_type = subscription.plan.plan_type
        
        access = get_feature_access_for_saas(plan_type)
    
    is_enabled = feature_name in access.enabled_features
    
    return {
        "feature": feature_name,
        "enabled": is_enabled,
        "plan": access.plan_or_edition
    }

@router.get("/{organization_id}/plans")
def get_available_plans(organization_id: str, auth = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get available subscription plans for upgrade"""
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if not auth.is_staff:
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == auth.user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Not authorized to access this organization")
    
    plans = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active == True).all()
    
    subscription = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == organization_id
    ).first()
    
    current_plan_type = None
    if subscription and subscription.plan:
        current_plan_type = subscription.plan.plan_type
    
    plan_order = {"starter": 0, "growth": 1, "professional": 2, "enterprise": 3}
    current_order = plan_order.get(current_plan_type, -1)
    
    feature_display_names = {
        "core_banking": "Core Banking",
        "members": "Member Management",
        "savings": "Savings Accounts",
        "shares": "Share Capital",
        "loans": "Loan Management",
        "teller_station": "Teller Station",
        "float_management": "Float Management",
        "analytics": "Analytics Dashboard",
        "sms_notifications": "SMS Notifications",
        "expenses": "Expense Tracking",
        "leave_management": "Leave Management",
        "multiple_branches": "Multiple Branches",
        "audit_logs": "Audit Logs",
        "accounting": "Full Accounting",
        "fixed_deposits": "Fixed Deposits",
        "dividends": "Dividends",
        "hr": "HR Management",
        "payroll": "Payroll",
        "api_access": "API Access",
        "custom_reports": "Custom Reports",
        "white_label": "White Label",
        "priority_support": "Priority Support"
    }
    
    result = []
    for plan in plans:
        plan_order_val = plan_order.get(plan.plan_type, 0)
        enabled_features = plan.features.get("enabled", []) if plan.features else []
        display_features = [feature_display_names.get(f, f.replace("_", " ").title()) for f in enabled_features]
        
        result.append({
            "id": plan.id,
            "name": plan.name,
            "plan_type": plan.plan_type,
            "pricing_model": plan.pricing_model or "saas",
            "monthly_price": float(plan.monthly_price) if plan.monthly_price else 0,
            "annual_price": float(plan.annual_price) if plan.annual_price else 0,
            "usd_monthly_price": float(plan.usd_monthly_price) if plan.usd_monthly_price else 0,
            "usd_annual_price": float(plan.usd_annual_price) if plan.usd_annual_price else 0,
            "ngn_monthly_price": float(plan.ngn_monthly_price) if plan.ngn_monthly_price else 0,
            "ngn_annual_price": float(plan.ngn_annual_price) if plan.ngn_annual_price else 0,
            "max_members": plan.max_members,
            "max_staff": plan.max_staff,
            "max_branches": plan.max_branches,
            "features": {"enabled": display_features},
            "is_current": plan.plan_type == current_plan_type,
            "is_upgrade": plan_order_val > current_order,
            "is_downgrade": plan_order_val < current_order
        })
    
    result.sort(key=lambda x: plan_order.get(x["plan_type"], 0))
    return result

@router.post("/{organization_id}/upgrade")
def upgrade_plan(organization_id: str, data: dict, auth = Depends(get_current_user), db: Session = Depends(get_db)):
    """Upgrade organization to a new plan"""
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if not auth.is_staff:
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == auth.user.id,
            OrganizationMember.is_owner == True
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Only organization owners can change the subscription plan")
    
    plan_id = data.get("plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="plan_id is required")
    
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    subscription = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == organization_id
    ).first()
    
    if not subscription:
        subscription = OrganizationSubscription(organization_id=organization_id)
        db.add(subscription)
    
    subscription.plan_id = plan.id
    subscription.status = "active"
    subscription.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": f"Successfully upgraded to {plan.name}",
        "plan": plan.plan_type
    }
