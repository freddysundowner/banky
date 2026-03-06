import os
from services.feature_flags import (
    Feature, PLAN_LIMITS, BASELINE_FEATURES, ALL_FEATURES,
    PLAN_CODE_MAP, PLAN_CODE_REVERSE_MAP,
    get_feature_access_for_saas, is_feature_enabled,
    check_limit, validate_license_key, generate_license_key,
    FeatureAccess, DEFAULT_PLAN_LIMITS,
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
    access = get_feature_access_for_saas("chama_small")
    assert Feature.CORE_BANKING in access.enabled_features
    assert Feature.MEMBERS in access.enabled_features


def test_plan_limits():
    chama_small = PLAN_LIMITS["chama_small"]
    assert chama_small["max_members"] == 200
    assert chama_small["max_staff"] == 2
    assert chama_small["max_branches"] == 1

    bank_large = PLAN_LIMITS["bank_large"]
    assert bank_large["max_members"] == 50000
    assert bank_large["max_staff"] == 200
    assert bank_large["max_branches"] == 50

    sacco_large = PLAN_LIMITS["sacco_large"]
    assert sacco_large["max_members"] == 5000


def test_feature_enabled_check():
    access = FeatureAccess(
        enabled_features={Feature.CORE_BANKING, Feature.LOANS},
        limits=PLAN_LIMITS["chama_small"],
        mode="saas",
        plan_or_edition="chama_small"
    )
    assert is_feature_enabled(Feature.CORE_BANKING, access) is True
    assert is_feature_enabled(Feature.LOANS, access) is True
    assert is_feature_enabled(Feature.FIXED_DEPOSITS, access) is False
    assert is_feature_enabled(Feature.DIVIDENDS, access) is False


def test_check_limit():
    access = get_feature_access_for_saas("chama_small")
    assert check_limit("max_members", 100, access) is True
    assert check_limit("max_members", 199, access) is True
    assert check_limit("max_members", 200, access) is False

    bank_access = get_feature_access_for_saas("bank_large")
    assert check_limit("max_members", 49999, bank_access) is True


def test_plan_code_map_complete():
    expected_plan_types = {
        "chama_small_licence", "chama_large_licence",
        "sacco_small_licence", "sacco_large_licence",
        "mfi_small_licence", "mfi_large_licence",
        "bank_small_licence", "bank_large_licence",
    }
    assert set(PLAN_CODE_MAP.values()) == expected_plan_types
    assert set(PLAN_CODE_REVERSE_MAP.keys()) == expected_plan_types


def test_license_key_validation():
    result = validate_license_key("BANKYKIT-SACL-2025-ABCDEF01")
    assert result is not None
    assert result["valid"] is True
    assert result["plan_type"] == "sacco_large_licence"
    assert result["perpetual"] is False

    result_perp = validate_license_key("BANKYKIT-BNKL-PERP-ABCDEF01")
    assert result_perp is not None
    assert result_perp["perpetual"] is True
    assert result_perp["plan_type"] == "bank_large_licence"

    result_bad = validate_license_key("INVALID-KEY")
    assert result_bad is None

    result_none = validate_license_key("")
    assert result_none is None

    result_short = validate_license_key("BANKYKIT-XX")
    assert result_short is None

    result_unknown_code = validate_license_key("BANKYKIT-STD-2025-ABCDEF01")
    assert result_unknown_code is None


def test_generate_license_key():
    key = generate_license_key("sacco_small_licence", "Test SACCO")
    assert key.startswith("BANKYKIT-SACS-")
    parts = key.split("-")
    assert len(parts) == 4
    assert len(parts[3]) == 8

    key_perp = generate_license_key("bank_large_licence", "Big Bank", perpetual=True)
    assert "BNKL" in key_perp
    assert "PERP" in key_perp

    key_chama = generate_license_key("chama_large_licence", "Chama Group")
    assert key_chama.startswith("BANKYKIT-CHAL-")
