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
    COLLATERAL = "collateral"

BASELINE_FEATURES: Set[str] = {
    Feature.CORE_BANKING, Feature.MEMBERS, Feature.SAVINGS, Feature.SHARES, Feature.LOANS
}

ALL_FEATURES: Set[str] = {f.value for f in Feature}

UNLIMITED_LIMITS: Dict = {"max_members": None, "max_staff": None, "max_branches": None, "sms_monthly": None}

# Maps short codes in license keys to enterprise plan_type values in the DB
PLAN_CODE_MAP: Dict[str, str] = {
    "CHAS": "chama_small_licence",
    "CHAL": "chama_large_licence",
    "SACS": "sacco_small_licence",
    "SACL": "sacco_large_licence",
    "MFIS": "mfi_small_licence",
    "MFIL": "mfi_large_licence",
    "BNKS": "bank_small_licence",
    "BNKL": "bank_large_licence",
}

# Reverse: plan_type → key code
PLAN_CODE_REVERSE_MAP: Dict[str, str] = {v: k for k, v in PLAN_CODE_MAP.items()}

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

def _get_enterprise_plan_limits_from_db(plan_type: str, db=None) -> Dict:
    if db is None:
        return UNLIMITED_LIMITS.copy()
    from models.master import SubscriptionPlan
    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_type == plan_type,
        SubscriptionPlan.pricing_model == "enterprise"
    ).first()
    if plan:
        return {
            "max_members": plan.max_members,
            "max_staff": plan.max_staff,
            "max_branches": plan.max_branches,
            "sms_monthly": plan.sms_credits_monthly,
        }
    return UNLIMITED_LIMITS.copy()

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

def get_all_enterprise_plan_features_from_db(db) -> Dict[str, list]:
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
    "chama_small": {"max_members": 200, "max_staff": 2, "max_branches": 1, "sms_monthly": 0},
    "chama_large": {"max_members": 1000, "max_staff": 5, "max_branches": 3, "sms_monthly": 500},
    "sacco_small": {"max_members": 500, "max_staff": 5, "max_branches": 1, "sms_monthly": 0},
    "sacco_large": {"max_members": 5000, "max_staff": 30, "max_branches": 10, "sms_monthly": 2000},
    "mfi_small": {"max_members": 500, "max_staff": 10, "max_branches": 1, "sms_monthly": 0},
    "mfi_large": {"max_members": 5000, "max_staff": 50, "max_branches": 10, "sms_monthly": 2000},
    "bank_small": {"max_members": 2000, "max_staff": 20, "max_branches": 3, "sms_monthly": 500},
    "bank_large": {"max_members": 50000, "max_staff": 200, "max_branches": 50, "sms_monthly": None},
}

DEFAULT_PLAN_LIMITS: Dict = {"max_members": 200, "max_staff": 2, "max_branches": 1, "sms_monthly": 0}

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

    plan_code = parts[1].upper()
    plan_type = PLAN_CODE_MAP.get(plan_code)
    if not plan_type:
        return None

    perpetual = parts[2].upper() == "PERP"

    # Check the DB record for is_active and expires_at
    if db is not None:
        from models.master import LicenseKey as LicenseKeyModel
        from datetime import datetime
        record = db.query(LicenseKeyModel).filter(
            LicenseKeyModel.license_key == license_key,
        ).first()
        if record:
            if not record.is_active:
                return None
            if not perpetual and record.expires_at and record.expires_at < datetime.utcnow():
                return None

    # Always resolve features live from the enterprise plan in the DB
    features = _get_plan_features_from_db(plan_type, db)
    if not features or features == BASELINE_FEATURES:
        # Fallback: if plan has no features configured yet, use ALL_FEATURES for perpetual
        features = ALL_FEATURES if perpetual else BASELINE_FEATURES

    limits = _get_enterprise_plan_limits_from_db(plan_type, db)

    return {
        "plan_type": plan_type,
        "valid": True,
        "perpetual": perpetual,
        "features": features,
        "limits": limits,
    }

def get_feature_access_for_saas(plan_type: str = "none", db=None) -> FeatureAccess:
    plan = plan_type.lower()
    limits = PLAN_LIMITS.get(plan, DEFAULT_PLAN_LIMITS)
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
            logger.info(f"License validated: plan_type={license_info['plan_type']}, perpetual={license_info.get('perpetual', False)}")
            return FeatureAccess(
                enabled_features=license_info["features"],
                limits=license_info["limits"],
                mode="enterprise",
                plan_or_edition=license_info["plan_type"]
            )
        else:
            logger.warning(f"Invalid or expired license key: {license_key[:10]}...")

    logger.info("Enterprise mode: all features unlocked (no valid license key)")
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
        if license_key:
            return get_feature_access_for_enterprise(license_key, db)

    plan_type = "none"
    if organization_subscription and organization_subscription.get("plan"):
        plan_type = organization_subscription["plan"].get("plan_type", "none")
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
        "crm": [Feature.CRM],
        "collateral": [Feature.COLLATERAL]
    }

    for category, features in categories.items():
        if feature in features:
            return category
    return "other"

def generate_license_key(plan_type: str, org_name: str, perpetual: bool = False) -> str:
    plan_code = PLAN_CODE_REVERSE_MAP.get(plan_type, "CHAS")

    if perpetual:
        time_segment = "PERP"
    else:
        from datetime import datetime
        time_segment = datetime.now().strftime("%Y")

    import uuid
    unique = str(uuid.uuid4())[:8].upper()

    return f"BANKYKIT-{plan_code}-{time_segment}-{unique}"


def get_platform_license_key(db) -> Optional[str]:
    from models.master import LicenseKey
    lic = db.query(LicenseKey).filter(
        LicenseKey.organization_id.is_(None),
        LicenseKey.is_active == True,
    ).order_by(LicenseKey.issued_at.desc()).first()
    return lic.license_key if lic else None


def get_org_license_key(organization_id: str, db) -> Optional[str]:
    from models.master import LicenseKey
    lic = db.query(LicenseKey).filter(
        LicenseKey.organization_id == organization_id,
        LicenseKey.is_active == True,
    ).first()
    return lic.license_key if lic else None


def get_org_features(organization_id: str, db) -> Set[str]:
    from models.master import OrganizationSubscription

    mode = get_deployment_mode()

    if mode == "enterprise":
        license_key = get_org_license_key(organization_id, db) or get_platform_license_key(db)
        if license_key:
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
    from models.master import OrganizationSubscription

    mode = get_deployment_mode()

    if mode == "enterprise":
        license_key = get_org_license_key(organization_id, db) or get_platform_license_key(db)
        if license_key:
            access = get_feature_access_for_enterprise(license_key, db)
            return access.limits

    subscription = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == organization_id
    ).first()

    if subscription and subscription.plan:
        plan_type = subscription.plan.plan_type
        default_limits = PLAN_LIMITS.get(plan_type, DEFAULT_PLAN_LIMITS)
        return {
            "max_members": subscription.plan.max_members if subscription.plan.max_members is not None else default_limits.get("max_members"),
            "max_staff": subscription.plan.max_staff if subscription.plan.max_staff is not None else default_limits.get("max_staff"),
            "max_branches": subscription.plan.max_branches if subscription.plan.max_branches is not None else default_limits.get("max_branches"),
            "sms_monthly": subscription.plan.sms_credits_monthly if subscription.plan.sms_credits_monthly is not None else default_limits.get("sms_monthly")
        }

    return DEFAULT_PLAN_LIMITS.copy()


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
