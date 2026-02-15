import os
from services.feature_flags import (
    Feature, PLAN_LIMITS, BASELINE_FEATURES,
    get_feature_access_for_saas, is_feature_enabled,
    check_limit, validate_license_key, generate_license_key,
    FeatureAccess,
)


def test_baseline_features():
    assert Feature.CORE_BANKING in BASELINE_FEATURES
    assert Feature.MEMBERS in BASELINE_FEATURES
    assert Feature.SAVINGS in BASELINE_FEATURES
    assert Feature.SHARES in BASELINE_FEATURES
    assert Feature.LOANS in BASELINE_FEATURES
    assert Feature.TELLER_STATION not in BASELINE_FEATURES
    assert Feature.FIXED_DEPOSITS not in BASELINE_FEATURES


def test_feature_access_without_db_returns_baseline():
    access = get_feature_access_for_saas("starter")
    assert Feature.CORE_BANKING in access.enabled_features
    assert Feature.MEMBERS in access.enabled_features
    assert Feature.SAVINGS in access.enabled_features
    assert Feature.SHARES in access.enabled_features
    assert Feature.LOANS in access.enabled_features


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
    access = FeatureAccess(
        enabled_features={Feature.CORE_BANKING, Feature.LOANS},
        limits=PLAN_LIMITS["starter"],
        mode="saas",
        plan_or_edition="starter"
    )
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
