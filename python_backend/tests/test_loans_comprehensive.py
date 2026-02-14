import uuid
from decimal import Decimal
from datetime import datetime

import pytest
from tests.conftest import TEST_ORG_ID, TEST_BRANCH_ID, TEST_MEMBER_ID, TEST_STAFF_ID
from models.tenant import (
    LoanProduct, LoanApplication, LoanInstalment, LoanRepayment,
    LoanRestructure, LoanGuarantor, LoanExtraCharge, Member, Transaction, Staff
)

LOANS_BASE = f"/api/organizations/{TEST_ORG_ID}/loans"
PRODUCTS_BASE = f"/api/organizations/{TEST_ORG_ID}/loan-products"
REPAYMENTS_BASE = f"/api/organizations/{TEST_ORG_ID}/repayments"

_counter = 0

def _unique_code(prefix="LPCMP"):
    global _counter
    _counter += 1
    return f"{prefix}{_counter:04d}{uuid.uuid4().hex[:4]}"


def _make_product(tenant_db, **overrides):
    defaults = dict(
        id=str(uuid.uuid4()),
        name="Test Product",
        code=_unique_code(),
        interest_rate=Decimal("10"),
        interest_type="reducing_balance",
        repayment_frequency="monthly",
        min_amount=Decimal("1000"),
        max_amount=Decimal("1000000"),
        min_term_months=1,
        max_term_months=60,
        processing_fee=Decimal("0"),
        insurance_fee=Decimal("0"),
        appraisal_fee=Decimal("0"),
        excise_duty_rate=Decimal("20"),
        credit_life_insurance_rate=Decimal("0"),
        credit_life_insurance_freq="annual",
        shares_multiplier=Decimal("0"),
        min_shares_required=Decimal("0"),
        deduct_interest_upfront=False,
        requires_guarantor=False,
        is_active=True,
    )
    defaults.update(overrides)
    product = LoanProduct(**defaults)
    tenant_db.add(product)
    tenant_db.commit()
    tenant_db.refresh(product)
    return product


def _create_loan_via_api(auth_client, product_id, amount=50000, term=12, purpose="Test"):
    return auth_client.post(LOANS_BASE, json={
        "member_id": TEST_MEMBER_ID,
        "loan_product_id": product_id,
        "amount": str(amount),
        "term_months": term,
        "purpose": purpose,
    })


def _approve_loan(auth_client, loan_id):
    return auth_client.put(f"{LOANS_BASE}/{loan_id}/action", json={"action": "approve"})


def _disburse_loan(auth_client, loan_id, method="cash"):
    return auth_client.post(f"{LOANS_BASE}/{loan_id}/disburse", json={
        "disbursement_method": method,
    })


def _create_and_disburse(auth_client, tenant_db, product_overrides=None, amount=50000, term=12):
    overrides = product_overrides or {}
    product = _make_product(tenant_db, **overrides)
    resp = _create_loan_via_api(auth_client, product.id, amount=amount, term=term)
    assert resp.status_code == 200
    loan_id = resp.json()["id"]
    approve_resp = _approve_loan(auth_client, loan_id)
    assert approve_resp.status_code == 200
    disburse_resp = _disburse_loan(auth_client, loan_id)
    assert disburse_resp.status_code == 200
    return loan_id, product, resp.json()


class TestLoanCalculations:
    def test_calc_flat_rate_basic(self):
        from routes.loans import calculate_loan
        result = calculate_loan(Decimal("100000"), 12, Decimal("10"), "flat")
        assert result["total_interest"] == Decimal("120000")
        assert result["total_repayment"] == Decimal("220000")
        assert result["monthly_repayment"] == Decimal("18333.33")

    def test_calc_flat_rate_short_term(self):
        from routes.loans import calculate_loan
        result = calculate_loan(Decimal("50000"), 3, Decimal("5"), "flat")
        assert result["total_interest"] == Decimal("7500")
        assert result["total_repayment"] == Decimal("57500")
        assert result["monthly_repayment"] == Decimal("19166.67")

    def test_calc_reducing_balance_basic(self):
        from routes.loans import calculate_loan
        result = calculate_loan(Decimal("100000"), 12, Decimal("10"), "reducing_balance")
        assert result["total_interest"] > 0
        assert result["monthly_repayment"] > 0
        rate = Decimal("10") / Decimal("100")
        expected_pmt = Decimal("100000") * (rate * (1 + rate) ** 12) / ((1 + rate) ** 12 - 1)
        assert result["monthly_repayment"] == round(expected_pmt, 2)

    def test_calc_reducing_balance_zero_rate(self):
        from routes.loans import calculate_loan
        result = calculate_loan(Decimal("100000"), 12, Decimal("0"), "reducing_balance")
        assert result["monthly_repayment"] == round(Decimal("100000") / 12, 2)
        assert result["total_interest"] == Decimal("0")

    def test_calc_reducing_balance_long_term(self):
        from routes.loans import calculate_loan
        result = calculate_loan(Decimal("500000"), 36, Decimal("15"), "reducing_balance")
        assert result["total_interest"] > 0
        assert result["total_repayment"] > Decimal("500000")
        assert result["monthly_repayment"] > 0
        rate = Decimal("15") / Decimal("100")
        expected_pmt = Decimal("500000") * (rate * (1 + rate) ** 36) / ((1 + rate) ** 36 - 1)
        assert result["monthly_repayment"] == round(expected_pmt, 2)

    def test_calc_flat_vs_reducing_interest_comparison(self):
        from routes.loans import calculate_loan
        flat = calculate_loan(Decimal("100000"), 12, Decimal("10"), "flat")
        reducing = calculate_loan(Decimal("100000"), 12, Decimal("10"), "reducing_balance")
        assert flat["total_interest"] > reducing["total_interest"]

    def test_calc_single_period(self):
        from routes.loans import calculate_loan
        result = calculate_loan(Decimal("100000"), 1, Decimal("10"), "flat")
        assert result["total_interest"] == Decimal("10000")
        assert result["total_repayment"] == Decimal("110000")
        assert result["monthly_repayment"] == Decimal("110000")


class TestLoanProductCRUD:
    def test_create_loan_product_with_all_fees(self, auth_client):
        resp = auth_client.post(PRODUCTS_BASE, json={
            "name": "Full Fee Product",
            "interest_rate": "12",
            "interest_type": "flat",
            "min_amount": "5000",
            "max_amount": "500000",
            "min_term_months": 1,
            "max_term_months": 36,
            "processing_fee": "2.5",
            "insurance_fee": "1.0",
            "appraisal_fee": "0.5",
            "excise_duty_rate": "20",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert float(data["processing_fee"]) == 2.5
        assert float(data["insurance_fee"]) == 1.0
        assert float(data["appraisal_fee"]) == 0.5
        assert float(data["excise_duty_rate"]) == 20

    def test_create_loan_product_auto_code(self, auth_client):
        resp = auth_client.post(PRODUCTS_BASE, json={
            "name": "Auto Code Product",
            "interest_rate": "5",
            "min_amount": "1000",
            "max_amount": "100000",
        })
        assert resp.status_code == 200
        code = resp.json()["code"]
        assert code.startswith("LP")
        assert len(code) == 6

    def test_update_loan_product_code_immutable(self, auth_client):
        create_resp = auth_client.post(PRODUCTS_BASE, json={
            "name": "Immutable Code",
            "interest_rate": "5",
            "min_amount": "1000",
            "max_amount": "100000",
        })
        assert create_resp.status_code == 200
        product_id = create_resp.json()["id"]
        original_code = create_resp.json()["code"]

        patch_resp = auth_client.patch(f"{PRODUCTS_BASE}/{product_id}", json={
            "name": "Updated Name",
            "code": "HACKED",
        })
        assert patch_resp.status_code == 200
        assert patch_resp.json()["code"] == original_code
        assert patch_resp.json()["name"] == "Updated Name"

    def test_delete_product_no_loans(self, auth_client):
        create_resp = auth_client.post(PRODUCTS_BASE, json={
            "name": "Delete Me",
            "interest_rate": "5",
            "min_amount": "1000",
            "max_amount": "100000",
        })
        assert create_resp.status_code == 200
        product_id = create_resp.json()["id"]

        del_resp = auth_client.delete(f"{PRODUCTS_BASE}/{product_id}")
        assert del_resp.status_code == 200

    def test_delete_product_with_loans_blocked(self, auth_client, tenant_db):
        product = _make_product(tenant_db, name="Cannot Delete Product")
        _create_loan_via_api(auth_client, product.id, amount=10000, term=6)

        del_resp = auth_client.delete(f"{PRODUCTS_BASE}/{product.id}")
        assert del_resp.status_code == 400
        assert "cannot delete" in del_resp.json()["detail"].lower()


class TestLoanApplicationCreation:
    def test_create_loan_basic(self, auth_client, tenant_db):
        product = _make_product(tenant_db,
            processing_fee=Decimal("2"),
            insurance_fee=Decimal("1"),
            appraisal_fee=Decimal("0.5"),
            excise_duty_rate=Decimal("20"),
        )
        resp = _create_loan_via_api(auth_client, product.id, amount=100000, term=12)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"
        assert data["member_id"] == TEST_MEMBER_ID
        assert data["application_number"].startswith("LN")
        assert float(data["amount"]) == 100000

        processing = 100000 * 2 / 100
        insurance = 100000 * 1 / 100
        appraisal = 100000 * 0.5 / 100
        base_fees = processing + insurance + appraisal
        excise = round(base_fees * 20 / 100, 2)
        total_fees = round(base_fees + excise, 2)
        assert float(data["processing_fee"]) == processing
        assert float(data["insurance_fee"]) == insurance
        assert float(data["appraisal_fee"]) == appraisal
        assert float(data["excise_duty"]) == excise
        assert float(data["total_fees"]) == total_fees

    def test_create_loan_amount_below_min(self, auth_client, tenant_db):
        product = _make_product(tenant_db, min_amount=Decimal("10000"))
        resp = _create_loan_via_api(auth_client, product.id, amount=5000, term=6)
        assert resp.status_code == 400

    def test_create_loan_amount_above_max(self, auth_client, tenant_db):
        product = _make_product(tenant_db, max_amount=Decimal("50000"))
        resp = _create_loan_via_api(auth_client, product.id, amount=60000, term=6)
        assert resp.status_code == 400

    def test_create_loan_term_below_min(self, auth_client, tenant_db):
        product = _make_product(tenant_db, min_term_months=3)
        resp = _create_loan_via_api(auth_client, product.id, amount=10000, term=1)
        assert resp.status_code == 400

    def test_create_loan_term_above_max(self, auth_client, tenant_db):
        product = _make_product(tenant_db, max_term_months=12)
        resp = _create_loan_via_api(auth_client, product.id, amount=10000, term=24)
        assert resp.status_code == 400

    def test_create_loan_inactive_member(self, auth_client, tenant_db):
        member = tenant_db.query(Member).filter(Member.id == TEST_MEMBER_ID).first()
        member.is_active = False
        tenant_db.commit()
        try:
            product = _make_product(tenant_db)
            resp = _create_loan_via_api(auth_client, product.id, amount=10000, term=6)
            assert resp.status_code == 400
        finally:
            member.is_active = True
            tenant_db.commit()

    def test_create_loan_nonexistent_member(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        resp = auth_client.post(LOANS_BASE, json={
            "member_id": str(uuid.uuid4()),
            "loan_product_id": product.id,
            "amount": "10000",
            "term_months": 6,
        })
        assert resp.status_code == 404

    def test_create_loan_with_extra_charges(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        resp = auth_client.post(LOANS_BASE, json={
            "member_id": TEST_MEMBER_ID,
            "loan_product_id": product.id,
            "amount": "20000",
            "term_months": 6,
            "extra_charges": [
                {"charge_name": "Legal Fee", "amount": "500"},
                {"charge_name": "Valuation Fee", "amount": "1000"},
            ],
        })
        assert resp.status_code == 200
        loan_id = resp.json()["id"]
        charges = tenant_db.query(LoanExtraCharge).filter(LoanExtraCharge.loan_id == loan_id).all()
        assert len(charges) == 2
        charge_names = {c.charge_name for c in charges}
        assert "Legal Fee" in charge_names
        assert "Valuation Fee" in charge_names


class TestLoanLifecycleActions:
    def test_approve_loan(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id)
        loan_id = create_resp.json()["id"]

        resp = _approve_loan(auth_client, loan_id)
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"
        assert resp.json()["approved_at"] is not None

    def test_approve_already_approved(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id)
        loan_id = create_resp.json()["id"]
        _approve_loan(auth_client, loan_id)

        resp = _approve_loan(auth_client, loan_id)
        assert resp.status_code == 400

    def test_reject_loan_with_reason(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id)
        loan_id = create_resp.json()["id"]

        resp = auth_client.put(f"{LOANS_BASE}/{loan_id}/action", json={
            "action": "reject",
            "reason": "Insufficient collateral",
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"
        assert resp.json()["rejection_reason"] == "Insufficient collateral"
        assert resp.json()["rejected_at"] is not None

    def test_review_loan(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id)
        loan_id = create_resp.json()["id"]

        resp = auth_client.put(f"{LOANS_BASE}/{loan_id}/action", json={
            "action": "review",
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "under_review"

    def test_cancel_loan(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id)
        loan_id = create_resp.json()["id"]

        resp = auth_client.put(f"{LOANS_BASE}/{loan_id}/cancel")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    def test_cancel_disbursed_loan_blocked(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db)
        resp = auth_client.put(f"{LOANS_BASE}/{loan_id}/cancel")
        assert resp.status_code == 400

    def test_update_loan_resets_rejected_to_pending(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id, amount=20000)
        loan_id = create_resp.json()["id"]

        auth_client.put(f"{LOANS_BASE}/{loan_id}/action", json={
            "action": "reject", "reason": "Bad"
        })

        resp = auth_client.put(f"{LOANS_BASE}/{loan_id}", json={
            "amount": "30000",
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"
        assert float(resp.json()["amount"]) == 30000


class TestLoanDisbursement:
    def test_disburse_cash_success(self, auth_client, tenant_db):
        product = _make_product(tenant_db,
            processing_fee=Decimal("1"),
            insurance_fee=Decimal("0.5"),
        )
        create_resp = _create_loan_via_api(auth_client, product.id, amount=100000, term=12)
        loan_id = create_resp.json()["id"]
        total_fees = float(create_resp.json()["total_fees"])
        _approve_loan(auth_client, loan_id)

        resp = _disburse_loan(auth_client, loan_id)
        assert resp.status_code == 200
        loan_data = resp.json()["loan"]
        assert loan_data["status"] == "disbursed"
        assert float(loan_data["amount_disbursed"]) == 100000 - total_fees

        instalments = tenant_db.query(LoanInstalment).filter(
            LoanInstalment.loan_id == loan_id
        ).all()
        assert len(instalments) == 12

    def test_disburse_only_approved(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id)
        loan_id = create_resp.json()["id"]

        resp = _disburse_loan(auth_client, loan_id)
        assert resp.status_code == 400

    def test_disburse_bank_requires_account(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id)
        loan_id = create_resp.json()["id"]
        _approve_loan(auth_client, loan_id)

        resp = auth_client.post(f"{LOANS_BASE}/{loan_id}/disburse", json={
            "disbursement_method": "bank",
        })
        assert resp.status_code == 400

    def test_disburse_with_fees_deducted(self, auth_client, tenant_db):
        product = _make_product(tenant_db,
            processing_fee=Decimal("2"),
            insurance_fee=Decimal("1"),
            appraisal_fee=Decimal("0.5"),
            excise_duty_rate=Decimal("20"),
        )
        amount = 200000
        create_resp = _create_loan_via_api(auth_client, product.id, amount=amount, term=12)
        loan_id = create_resp.json()["id"]
        _approve_loan(auth_client, loan_id)

        resp = _disburse_loan(auth_client, loan_id)
        assert resp.status_code == 200

        processing = amount * 2 / 100
        insurance = amount * 1 / 100
        appraisal = amount * 0.5 / 100
        base_fees = processing + insurance + appraisal
        excise = round(base_fees * 20 / 100, 2)
        total_fees = round(base_fees + excise, 2)
        expected_net = amount - total_fees

        assert float(resp.json()["loan"]["amount_disbursed"]) == expected_net

    def test_disburse_interest_upfront(self, auth_client, tenant_db):
        product = _make_product(tenant_db, deduct_interest_upfront=True, interest_type="flat")
        amount = 100000
        term = 12
        create_resp = _create_loan_via_api(auth_client, product.id, amount=amount, term=term)
        loan_id = create_resp.json()["id"]
        total_interest = float(create_resp.json()["total_interest"])
        total_fees = float(create_resp.json()["total_fees"])
        _approve_loan(auth_client, loan_id)

        resp = _disburse_loan(auth_client, loan_id)
        assert resp.status_code == 200
        loan_data = resp.json()["loan"]

        expected_net = amount - total_fees - total_interest
        assert abs(float(loan_data["amount_disbursed"]) - expected_net) < 0.01
        assert loan_data["interest_deducted_upfront"] is True
        expected_monthly = round(amount / term, 2)
        assert abs(float(loan_data["monthly_repayment"]) - expected_monthly) < 0.01

    def test_disburse_shares_eligibility_block(self, auth_client, tenant_db):
        product = _make_product(tenant_db, min_shares_required=Decimal("50000"))
        create_resp = _create_loan_via_api(auth_client, product.id, amount=10000, term=6)
        loan_id = create_resp.json()["id"]
        _approve_loan(auth_client, loan_id)

        resp = _disburse_loan(auth_client, loan_id)
        assert resp.status_code == 400
        assert "shares" in resp.json()["detail"].lower()


class TestInstalmentSchedule:
    def test_instalment_schedule_flat(self, auth_client, tenant_db):
        loan_id, product, loan_data = _create_and_disburse(
            auth_client, tenant_db,
            product_overrides={"interest_type": "flat", "interest_rate": Decimal("5")},
            amount=60000, term=6
        )
        instalments = tenant_db.query(LoanInstalment).filter(
            LoanInstalment.loan_id == loan_id
        ).order_by(LoanInstalment.instalment_number).all()

        assert len(instalments) == 6
        principals = [float(i.expected_principal) for i in instalments]
        interests = [float(i.expected_interest) for i in instalments]
        total_principal = sum(principals)
        assert abs(total_principal - 60000) < 1

        for i in range(len(interests) - 1):
            assert abs(interests[i] - interests[i + 1]) < 1

    def test_instalment_schedule_reducing(self, auth_client, tenant_db):
        loan_id, product, loan_data = _create_and_disburse(
            auth_client, tenant_db,
            product_overrides={"interest_type": "reducing_balance", "interest_rate": Decimal("10")},
            amount=100000, term=12
        )
        instalments = tenant_db.query(LoanInstalment).filter(
            LoanInstalment.loan_id == loan_id
        ).order_by(LoanInstalment.instalment_number).all()

        assert len(instalments) == 12
        first_interest = float(instalments[0].expected_interest)
        mid_interest = float(instalments[5].expected_interest)
        assert first_interest > mid_interest

    def test_instalment_schedule_upfront(self, auth_client, tenant_db):
        loan_id, product, loan_data = _create_and_disburse(
            auth_client, tenant_db,
            product_overrides={"deduct_interest_upfront": True, "interest_type": "flat", "interest_rate": Decimal("5")},
            amount=60000, term=6
        )
        instalments = tenant_db.query(LoanInstalment).filter(
            LoanInstalment.loan_id == loan_id
        ).order_by(LoanInstalment.instalment_number).all()

        assert len(instalments) == 6
        for inst in instalments:
            assert float(inst.expected_interest) == 0

    def test_instalment_schedule_principal_sum_equals_loan_amount(self, auth_client, tenant_db):
        loan_id, product, loan_data = _create_and_disburse(
            auth_client, tenant_db,
            product_overrides={"interest_type": "reducing_balance", "interest_rate": Decimal("8")},
            amount=77777, term=7
        )
        instalments = tenant_db.query(LoanInstalment).filter(
            LoanInstalment.loan_id == loan_id
        ).order_by(LoanInstalment.instalment_number).all()

        total_principal = sum(Decimal(str(i.expected_principal)) for i in instalments)
        assert total_principal == Decimal("77777")

    def test_get_instalments_endpoint(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=50000, term=6)

        resp = auth_client.get(f"{LOANS_BASE}/{loan_id}/instalments")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 6
        first = data[0]
        assert "instalment_number" in first
        assert "due_date" in first
        assert "expected_principal" in first
        assert "expected_interest" in first
        assert "status" in first


class TestRepayments:
    def test_repayment_basic(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=60000, term=6)
        loan_before = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        outstanding_before = float(loan_before["outstanding_balance"])

        resp = auth_client.post(REPAYMENTS_BASE, json={
            "loan_id": loan_id,
            "amount": "5000",
            "payment_method": "cash",
        })
        assert resp.status_code == 200

        loan_after = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        assert float(loan_after["amount_repaid"]) > 0
        assert float(loan_after["outstanding_balance"]) < outstanding_before

    def test_repayment_only_disbursed(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id)
        loan_id = create_resp.json()["id"]

        resp = auth_client.post(REPAYMENTS_BASE, json={
            "loan_id": loan_id,
            "amount": "5000",
            "payment_method": "cash",
        })
        assert resp.status_code == 400

    def test_repayment_zero_amount(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=30000, term=6)

        resp = auth_client.post(REPAYMENTS_BASE, json={
            "loan_id": loan_id,
            "amount": "0",
            "payment_method": "cash",
        })
        assert resp.status_code == 400

    def test_repayment_completes_loan(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=10000, term=3)
        loan_data = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        outstanding = float(loan_data["outstanding_balance"])

        resp = auth_client.post(REPAYMENTS_BASE, json={
            "loan_id": loan_id,
            "amount": str(outstanding),
            "payment_method": "cash",
        })
        assert resp.status_code == 200

        loan_after = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        assert loan_after["status"] == "paid"
        assert loan_after["closed_at"] is not None
        assert float(loan_after["outstanding_balance"]) == 0

    def test_overpayment_credited_to_savings(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=10000, term=3)
        loan_data = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        outstanding = float(loan_data["outstanding_balance"])

        member_before = tenant_db.query(Member).filter(Member.id == TEST_MEMBER_ID).first()
        savings_before = float(member_before.savings_balance or 0)

        overpay_amount = outstanding + 500
        resp = auth_client.post(REPAYMENTS_BASE, json={
            "loan_id": loan_id,
            "amount": str(overpay_amount),
            "payment_method": "cash",
        })
        assert resp.status_code == 200

        tenant_db.expire_all()
        member_after = tenant_db.query(Member).filter(Member.id == TEST_MEMBER_ID).first()
        assert float(member_after.savings_balance or 0) >= savings_before + 500 - 1

    def test_repayment_updates_instalment_status(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(
            auth_client, tenant_db,
            product_overrides={"interest_type": "flat", "interest_rate": Decimal("5")},
            amount=30000, term=6
        )
        instalments = tenant_db.query(LoanInstalment).filter(
            LoanInstalment.loan_id == loan_id
        ).order_by(LoanInstalment.instalment_number).all()
        first_total = float(instalments[0].expected_principal) + float(instalments[0].expected_interest)

        resp = auth_client.post(REPAYMENTS_BASE, json={
            "loan_id": loan_id,
            "amount": str(first_total),
            "payment_method": "cash",
        })
        assert resp.status_code == 200

        tenant_db.expire_all()
        first_inst = tenant_db.query(LoanInstalment).filter(
            LoanInstalment.loan_id == loan_id,
            LoanInstalment.instalment_number == 1
        ).first()
        assert first_inst.status in ("paid", "partial")

    def test_multiple_partial_repayments(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=50000, term=6)

        resp1 = auth_client.post(REPAYMENTS_BASE, json={
            "loan_id": loan_id, "amount": "3000", "payment_method": "cash",
        })
        assert resp1.status_code == 200

        resp2 = auth_client.post(REPAYMENTS_BASE, json={
            "loan_id": loan_id, "amount": "4000", "payment_method": "cash",
        })
        assert resp2.status_code == 200

        loan_data = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        assert float(loan_data["amount_repaid"]) >= 7000 - 1


class TestRestructuring:
    def test_restructure_extend_term(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=100000, term=12)
        loan_before = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        old_monthly = float(loan_before["monthly_repayment"])

        resp = auth_client.post(f"{LOANS_BASE}/{loan_id}/restructure", json={
            "restructure_type": "extend_term",
            "new_term_months": 18,
            "reason": "Financial hardship",
        })
        assert resp.status_code == 200

        loan_after = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        assert loan_after["is_restructured"] is True
        assert float(loan_after["monthly_repayment"]) < old_monthly

    def test_restructure_reduce_installment(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=100000, term=12)
        loan_before = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        old_monthly = float(loan_before["monthly_repayment"])
        new_monthly = round(old_monthly * 0.7, 2)

        resp = auth_client.post(f"{LOANS_BASE}/{loan_id}/restructure", json={
            "restructure_type": "reduce_installment",
            "new_monthly_repayment": str(new_monthly),
            "reason": "Lower payments requested",
        })
        assert resp.status_code == 200

        loan_after = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        assert loan_after["term_months"] > 12

    def test_restructure_adjust_interest(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(
            auth_client, tenant_db,
            product_overrides={"interest_rate": Decimal("10")},
            amount=100000, term=12
        )
        loan_before = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()

        resp = auth_client.post(f"{LOANS_BASE}/{loan_id}/restructure", json={
            "restructure_type": "adjust_interest",
            "new_interest_rate": "5",
            "reason": "Rate reduction",
        })
        assert resp.status_code == 200

        loan_after = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        assert float(loan_after["interest_rate"]) == 5.0

    def test_restructure_waive_penalty(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=50000, term=6)
        loan_before = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        outstanding_before = float(loan_before["outstanding_balance"])

        resp = auth_client.post(f"{LOANS_BASE}/{loan_id}/restructure", json={
            "restructure_type": "waive_penalty",
            "penalty_waived": "1000",
            "reason": "Goodwill waiver",
        })
        assert resp.status_code == 200

        loan_after = auth_client.get(f"{LOANS_BASE}/{loan_id}").json()
        assert float(loan_after["outstanding_balance"]) < outstanding_before

    def test_restructure_only_disbursed(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id)
        loan_id = create_resp.json()["id"]

        resp = auth_client.post(f"{LOANS_BASE}/{loan_id}/restructure", json={
            "restructure_type": "extend_term",
            "new_term_months": 24,
            "reason": "Test",
        })
        assert resp.status_code == 400


class TestLoanSummaryAndDelete:
    def test_loan_summary_endpoint(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=80000, term=12)

        resp = auth_client.get(f"{LOANS_BASE}/{loan_id}/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "loan" in data
        assert "member" in data
        assert "product" in data
        assert "guarantors" in data
        assert "calculations" in data
        assert data["calculations"]["principal"] == 80000
        assert data["member"]["id"] == TEST_MEMBER_ID

    def test_delete_pending_loan(self, auth_client, tenant_db):
        product = _make_product(tenant_db)
        create_resp = _create_loan_via_api(auth_client, product.id, amount=10000, term=3)
        loan_id = create_resp.json()["id"]

        resp = auth_client.delete(f"{LOANS_BASE}/{loan_id}")
        assert resp.status_code == 200

        get_resp = auth_client.get(f"{LOANS_BASE}/{loan_id}")
        assert get_resp.status_code == 404

    def test_delete_disbursed_loan_blocked(self, auth_client, tenant_db):
        loan_id, _, _ = _create_and_disburse(auth_client, tenant_db, amount=20000, term=6)

        resp = auth_client.delete(f"{LOANS_BASE}/{loan_id}")
        assert resp.status_code == 400
