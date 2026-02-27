import os
from enum import Enum
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
import hashlib
import base64

class Feature(str, Enum):
    CORE_BANKING = "core_banking"
    MEMBERS = "members"
    SAVINGS = "savings"
    SHARES = "shares"
    LOANS = "loans"
    TELLER_STATION = "teller_station"
    FLOAT_MANAGEMENT = "float_management"
    FIXED_DEPOSITS = "fixed_deposits"
    DIVIDENDS = "dividends"
    ANALYTICS = "analytics"
    ANALYTICS_EXPORT = "analytics_export"
    SMS_NOTIFICATIONS = "sms_notifications"
    BULK_SMS = "bulk_sms"
    EXPENSES = "expenses"
    LEAVE_MANAGEMENT = "leave_management"
    PAYROLL = "payroll"
    ACCOUNTING = "accounting"
    AUDIT_LOGS = "audit_logs"
    MULTIPLE_BRANCHES = "multiple_branches"
    API_ACCESS = "api_access"
    WHITE_LABEL = "white_label"
    CUSTOM_REPORTS = "custom_reports"
    MPESA_INTEGRATION = "mpesa_integration"
    BANK_INTEGRATION = "bank_integration"
    CRM = "crm"

BASELINE_FEATURES: Set[str] = {
    Feature.CORE_BANKING, Feature.MEMBERS, Feature.SAVINGS, Feature.SHARES, Feature.LOANS
}

ALL_FEATURES: Set[str] = {f.value for f in Feature}

UNLIMITED_LIMITS: Dict = {"max_members": None, "max_staff": None, "max_branches": None, "sms_monthly": None}

def _get_plan_features_from_db(plan_type: str, db=None) -> Set[str]:
    if db is None:
        return BASELINE_FEATURES
    from models.master import SubscriptionPlan
    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_type == plan_type
    ).first()
    if plan and plan.features and plan.features.get("enabled"):
        return set(plan.features["enabled"])
    return BASELINE_FEATURES

def _get_edition_features_from_db(edition: str, db=None) -> Set[str]:
    if db is None:
        return BASELINE_FEATURES
    from models.master import SubscriptionPlan
    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_type == edition,
        SubscriptionPlan.pricing_model == "enterprise"
    ).first()
    if plan and plan.features and plan.features.get("enabled"):
        return set(plan.features["enabled"])
    return BASELINE_FEATURES

def get_all_plan_features_from_db(db) -> Dict[str, list]:
    from models.master import SubscriptionPlan
    plans = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.pricing_model == "saas"
    ).all()
    result = {}
    for plan in plans:
        features = plan.features.get("enabled", []) if plan.features else []
        result[plan.plan_type] = features
    return result

def get_all_edition_features_from_db(db) -> Dict[str, list]:
    from models.master import SubscriptionPlan
    plans = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.pricing_model == "enterprise"
    ).all()
    result = {}
    for plan in plans:
        features = plan.features.get("enabled", []) if plan.features else []
        result[plan.plan_type] = features
    return result

PLAN_LIMITS: Dict[str, Dict] = {
    "starter": {"max_members": 500, "max_staff": 3, "max_branches": 1, "sms_monthly": 0},
    "growth": {"max_members": 2000, "max_staff": 10, "max_branches": 5, "sms_monthly": 500},
    "professional": {"max_members": 10000, "max_staff": 50, "max_branches": 20, "sms_monthly": 2000},
    "enterprise": {"max_members": None, "max_staff": None, "max_branches": None, "sms_monthly": None}
}

EDITION_LIMITS: Dict[str, Dict] = {
    "basic": {"max_members": 1000, "max_staff": 5, "max_branches": 1},
    "standard": {"max_members": 5000, "max_staff": 20, "max_branches": 10},
    "premium": {"max_members": 20000, "max_staff": 100, "max_branches": 50},
    "enterprise": {"max_members": None, "max_staff": None, "max_branches": None}
}

@dataclass
class FeatureAccess:
    enabled_features: Set[str]
    limits: Dict
    mode: str
    plan_or_edition: str

def get_deployment_mode() -> str:
    return os.environ.get("DEPLOYMENT_MODE", "saas")

def get_license_key() -> Optional[str]:
    return os.environ.get("LICENSE_KEY")

def is_perpetual_license(license_key: str) -> bool:
    if not license_key:
        return False
    parts = license_key.split("-")
    return len(parts) >= 4 and parts[2].upper() == "PERP"

def validate_license_key(license_key: str, db=None) -> Optional[Dict]:
    if not license_key or not license_key.startswith("BANKYKIT-"):
        return None
    
    parts = license_key.split("-")
    if len(parts) < 4:
        return None
    
    edition_map = {"BAS": "basic", "STD": "standard", "PRE": "premium", "ENT": "enterprise", "FUL": "enterprise"}
    edition = edition_map.get(parts[1].upper(), "basic")
    
    perpetual = parts[2].upper() == "PERP"
    
    if perpetual:
        features = ALL_FEATURES
        limits = UNLIMITED_LIMITS
    else:
        db_features = _get_edition_features_from_db(edition, db)
        features = db_features if db_features != BASELINE_FEATURES else ALL_FEATURES if edition == "enterprise" else db_features
        limits = EDITION_LIMITS.get(edition, EDITION_LIMITS["basic"])
    
    return {
        "edition": edition,
        "valid": True,
        "perpetual": perpetual,
        "features": features,
        "limits": limits
    }

def get_feature_access_for_saas(plan_type: str = "starter", db=None) -> FeatureAccess:
    plan = plan_type.lower()
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["starter"])
    features = _get_plan_features_from_db(plan, db)
    
    return FeatureAccess(
        enabled_features=features,
        limits=limits,
        mode="saas",
        plan_or_edition=plan
    )

def get_feature_access_for_enterprise(license_key: Optional[str] = None, db=None) -> FeatureAccess:
    import logging
    logger = logging.getLogger("bankykit.license")
    
    if license_key:
        license_info = validate_license_key(license_key, db)
        if license_info:
            logger.info(f"License validated: edition={license_info['edition']}, perpetual={license_info.get('perpetual', False)}")
            return FeatureAccess(
                enabled_features=license_info["features"],
                limits=license_info["limits"],
                mode="enterprise",
                plan_or_edition=license_info["edition"]
            )
        else:
            logger.warning(f"Invalid license key format: {license_key[:10]}...")
    
    logger.info("Enterprise mode: all features unlocked (no license key required)")
    return FeatureAccess(
        enabled_features=ALL_FEATURES,
        limits=UNLIMITED_LIMITS,
        mode="enterprise",
        plan_or_edition="enterprise"
    )

def get_feature_access(organization_subscription: Optional[Dict] = None, db=None) -> FeatureAccess:
    mode = get_deployment_mode()
    
    if mode == "enterprise":
        license_key = get_license_key()
        return get_feature_access_for_enterprise(license_key, db)
    else:
        plan_type = "starter"
        if organization_subscription and organization_subscription.get("plan"):
            plan_type = organization_subscription["plan"].get("plan_type", "starter")
        return get_feature_access_for_saas(plan_type, db)

def is_feature_enabled(feature: str, feature_access: FeatureAccess) -> bool:
    return feature in feature_access.enabled_features

def check_limit(limit_name: str, current_value: int, feature_access: FeatureAccess) -> bool:
    limit = feature_access.limits.get(limit_name)
    if limit is None:
        return True
    return current_value < limit

def get_all_features() -> List[Dict]:
    return [
        {"id": f.value, "name": f.value.replace("_", " ").title(), "category": get_feature_category(f)}
        for f in Feature
    ]

def get_feature_category(feature: Feature) -> str:
    categories = {
        "core": [Feature.CORE_BANKING, Feature.MEMBERS, Feature.SAVINGS, Feature.SHARES],
        "loans": [Feature.LOANS],
        "operations": [Feature.TELLER_STATION, Feature.FLOAT_MANAGEMENT],
        "products": [Feature.FIXED_DEPOSITS, Feature.DIVIDENDS],
        "communication": [Feature.SMS_NOTIFICATIONS, Feature.BULK_SMS],
        "hr": [Feature.EXPENSES, Feature.LEAVE_MANAGEMENT, Feature.PAYROLL],
        "finance": [Feature.ACCOUNTING],
        "reporting": [Feature.ANALYTICS, Feature.ANALYTICS_EXPORT, Feature.CUSTOM_REPORTS],
        "advanced": [Feature.MULTIPLE_BRANCHES, Feature.API_ACCESS, Feature.WHITE_LABEL],
        "integrations": [Feature.MPESA_INTEGRATION, Feature.BANK_INTEGRATION],
        "security": [Feature.AUDIT_LOGS],
        "crm": [Feature.CRM]
    }
    
    for category, features in categories.items():
        if feature in features:
            return category
    return "other"

def generate_license_key(edition: str, org_name: str, perpetual: bool = False) -> str:
    edition_codes = {"basic": "BAS", "standard": "STD", "premium": "PRE", "enterprise": "ENT"}
    edition_code = edition_codes.get(edition.lower(), "BAS")
    
    if perpetual:
        time_segment = "PERP"
    else:
        from datetime import datetime
        time_segment = datetime.now().strftime("%Y")
    
    import uuid
    unique = str(uuid.uuid4())[:8].upper()
    
    return f"BANKYKIT-{edition_code}-{time_segment}-{unique}"


def get_org_features(organization_id: str, db) -> Set[str]:
    from models.master import OrganizationSubscription
    
    mode = get_deployment_mode()
    
    if mode == "enterprise":
        license_key = get_license_key()
        access = get_feature_access_for_enterprise(license_key, db)
        return access.enabled_features
    
    subscription = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == organization_id
    ).first()
    
    if subscription and subscription.plan:
        if subscription.plan.features and subscription.plan.features.get("enabled"):
            return set(subscription.plan.features.get("enabled"))
        return _get_plan_features_from_db(subscription.plan.plan_type, db)
    
    return BASELINE_FEATURES


def check_org_feature(organization_id: str, feature: str, db) -> bool:
    features = get_org_features(organization_id, db)
    return feature in features


def get_org_limits(organization_id: str, db) -> Dict:
    """Get limits for an organization based on deployment mode and subscription/license."""
    from models.master import OrganizationSubscription
    
    mode = get_deployment_mode()
    
    if mode == "enterprise":
        license_key = get_license_key()
        access = get_feature_access_for_enterprise(license_key)
        return access.limits
    
    subscription = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == organization_id
    ).first()
    
    plan_type = "starter"
    if subscription and subscription.plan:
        plan_type = subscription.plan.plan_type
        default_limits = PLAN_LIMITS.get(plan_type, PLAN_LIMITS["starter"])
        return {
            "max_members": subscription.plan.max_members if subscription.plan.max_members is not None else default_limits.get("max_members"),
            "max_staff": subscription.plan.max_staff if subscription.plan.max_staff is not None else default_limits.get("max_staff"),
            "max_branches": subscription.plan.max_branches if subscription.plan.max_branches is not None else default_limits.get("max_branches"),
            "sms_monthly": subscription.plan.sms_credits_monthly if subscription.plan.sms_credits_monthly is not None else default_limits.get("sms_monthly")
        }
    
    return PLAN_LIMITS.get(plan_type, PLAN_LIMITS["starter"])


class FeatureNotEnabledError(Exception):
    def __init__(self, feature: str):
        self.feature = feature
        self.message = f"Feature '{feature}' is not enabled for your subscription plan"
        super().__init__(self.message)


class PlanLimitExceededError(Exception):
    def __init__(self, resource: str, current: int, limit: int):
        self.resource = resource
        self.current = current
        self.limit = limit
        self.message = f"{resource} limit reached ({current}/{limit}). Please upgrade your plan to add more."
        super().__init__(self.message)


def check_plan_limit(master_db, org_id: str, tenant_session, resource_type: str):
    """
    Check if adding a new resource would exceed plan limits.
    Works for both SaaS (subscription-based) and enterprise (license-based) deployments.
    Uses the centralized get_org_limits function for consistent limit resolution.
    
    Args:
        master_db: Master database session
        org_id: Organization ID
        tenant_session: Tenant database session
        resource_type: One of 'members', 'staff', 'branches'
    
    Raises:
        PlanLimitExceededError if limit would be exceeded
    """
    from models.tenant import Member, Staff, Branch
    
    resource_map = {
        'members': {'model': Member, 'limit_key': 'max_members', 'display': 'Member'},
        'staff': {'model': Staff, 'limit_key': 'max_staff', 'display': 'Staff'},
        'branches': {'model': Branch, 'limit_key': 'max_branches', 'display': 'Branch'}
    }
    
    if resource_type not in resource_map:
        return
    
    config = resource_map[resource_type]
    
    limits = get_org_limits(org_id, master_db)
    limit = limits.get(config['limit_key'])
    
    if limit is None:
        return
    
    current_count = tenant_session.query(config['model']).count()
    
    if current_count >= limit:
        raise PlanLimitExceededError(config['display'], current_count, limit)
