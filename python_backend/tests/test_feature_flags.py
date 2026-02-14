import os
from services.feature_flags import (
    Feature, PLAN_FEATURES, PLAN_LIMITS,
    get_feature_access_for_saas, is_feature_enabled,
    check_limit, validate_license_key, generate_license_key,
    FeatureAccess,
)


def test_starter_plan_features():
    features = PLAN_FEATURES["starter"]
    expected = {
        Feature.CORE_BANKING, Feature.MEMBERS, Feature.SAVINGS, Feature.SHARES,
        Feature.LOANS, Feature.TELLER_STATION, Feature.AUDIT_LOGS, Feature.MPESA_INTEGRATION,
    }
    assert expected == features


def test_growth_plan_features():
    features = PLAN_FEATURES["growth"]
    assert Feature.FLOAT_MANAGEMENT in features
    assert Feature.ANALYTICS in features
    assert Feature.SMS_NOTIFICATIONS in features
    assert Feature.EXPENSES in features
    assert Feature.LEAVE_MANAGEMENT in features
    assert Feature.MULTIPLE_BRANCHES in features
    assert Feature.ACCOUNTING in features


def test_professional_plan_features():
    features = PLAN_FEATURES["professional"]
    assert Feature.FIXED_DEPOSITS in features
    assert Feature.DIVIDENDS in features
    assert Feature.ANALYTICS_EXPORT in features
    assert Feature.BULK_SMS in features
    assert Feature.PAYROLL in features
    assert Feature.API_ACCESS in features
    assert Feature.WHITE_LABEL in features
    assert Feature.CUSTOM_REPORTS in features


def test_enterprise_has_all_features():
    features = PLAN_FEATURES["enterprise"]
    for f in Feature:
        assert f in features


def test_plan_limits():
    starter = PLAN_LIMITS["starter"]
    assert starter["max_members"] == 500
    assert starter["max_staff"] == 3
    assert starter["max_branches"] == 1

    enterprise = PLAN_LIMITS["enterprise"]
    assert enterprise["max_members"] is None
    assert enterprise["max_staff"] is None
    assert enterprise["max_branches"] is None


def test_feature_enabled_check():
    access = get_feature_access_for_saas("starter")
    assert is_feature_enabled(Feature.CORE_BANKING, access) is True
    assert is_feature_enabled(Feature.LOANS, access) is True
    assert is_feature_enabled(Feature.FIXED_DEPOSITS, access) is False
    assert is_feature_enabled(Feature.DIVIDENDS, access) is False


def test_check_limit():
    access = get_feature_access_for_saas("starter")
    assert check_limit("max_members", 100, access) is True
    assert check_limit("max_members", 499, access) is True
    assert check_limit("max_members", 500, access) is False
    assert check_limit("max_members", 501, access) is False

    enterprise_access = get_feature_access_for_saas("enterprise")
    assert check_limit("max_members", 999999, enterprise_access) is True


def test_license_key_validation():
    result = validate_license_key("BANKY-STD-2025-ABCDEF01")
    assert result is not None
    assert result["valid"] is True
    assert result["edition"] == "standard"

    result_bad = validate_license_key("INVALID-KEY")
    assert result_bad is None

    result_none = validate_license_key("")
    assert result_none is None

    result_short = validate_license_key("BANKY-XX")
    assert result_short is None


def test_generate_license_key():
    key = generate_license_key("standard", "Test Org")
    assert key.startswith("BANKY-STD-")
    parts = key.split("-")
    assert len(parts) == 4
    assert len(parts[3]) == 8

    key_ent = generate_license_key("enterprise", "Big Corp")
    assert "ENT" in key_ent
