import uuid
from decimal import Decimal
from datetime import datetime
from tests.conftest import TEST_ORG_ID, TEST_MEMBER_ID
from models.tenant import LoanProduct

BASE = f"/api/organizations/{TEST_ORG_ID}/loans"

LOAN_PRODUCT_DATA = {
    "name": "Test Loan Product",
    "interest_rate": 2.0,
    "interest_type": "reducing_balance",
    "min_amount": 1000,
    "max_amount": 500000,
    "min_term_months": 1,
    "max_term_months": 36,
    "is_active": True,
}


def _create_loan_product(tenant_db):
    product = LoanProduct(
        id=str(uuid.uuid4()),
        code=f"LPTST{uuid.uuid4().hex[:4]}",
        **LOAN_PRODUCT_DATA,
    )
    tenant_db.add(product)
    tenant_db.commit()
    tenant_db.refresh(product)
    return product


def test_create_loan_application(auth_client, tenant_db):
    product = _create_loan_product(tenant_db)
    resp = auth_client.post(BASE, json={
        "member_id": TEST_MEMBER_ID,
        "loan_product_id": product.id,
        "amount": "50000",
        "term_months": 12,
        "purpose": "Business expansion",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["member_id"] == TEST_MEMBER_ID
    assert data["status"] == "pending"
    assert "application_number" in data


def test_list_loans(auth_client, tenant_db):
    product = _create_loan_product(tenant_db)
    auth_client.post(BASE, json={
        "member_id": TEST_MEMBER_ID,
        "loan_product_id": product.id,
        "amount": "20000",
        "term_months": 6,
    })
    resp = auth_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    if isinstance(data, dict):
        items = data.get("items", data.get("loans", []))
    else:
        items = data
    assert len(items) >= 1


def test_get_loan_detail(auth_client, tenant_db):
    product = _create_loan_product(tenant_db)
    create_resp = auth_client.post(BASE, json={
        "member_id": TEST_MEMBER_ID,
        "loan_product_id": product.id,
        "amount": "30000",
        "term_months": 12,
    })
    assert create_resp.status_code == 200
    loan_id = create_resp.json()["id"]

    resp = auth_client.get(f"{BASE}/{loan_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == loan_id


def test_loan_calculation():
    from routes.loans import calculate_loan

    flat = calculate_loan(Decimal("100000"), 12, Decimal("2"), "flat")
    assert flat["total_interest"] > 0
    assert flat["total_repayment"] > flat["total_interest"]
    assert flat["monthly_repayment"] > 0

    reducing = calculate_loan(Decimal("100000"), 12, Decimal("2"), "reducing_balance")
    assert reducing["total_interest"] > 0
    assert reducing["monthly_repayment"] > 0
