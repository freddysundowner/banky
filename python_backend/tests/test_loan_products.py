from tests.conftest import TEST_ORG_ID

BASE = f"/api/organizations/{TEST_ORG_ID}/loan-products"


def test_list_loan_products(auth_client):
    resp = auth_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_create_loan_product(auth_client):
    resp = auth_client.post(BASE, json={
        "name": "Emergency Loan",
        "interest_rate": "2.5",
        "interest_type": "reducing_balance",
        "min_amount": "1000",
        "max_amount": "500000",
        "min_term_months": 1,
        "max_term_months": 24,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Emergency Loan"
    assert data["code"].startswith("LP")
    assert data["is_active"] is True


def test_update_loan_product(auth_client):
    create = auth_client.post(BASE, json={
        "name": "Update Test Product",
        "interest_rate": "3.0",
        "min_amount": "5000",
        "max_amount": "1000000",
        "min_term_months": 1,
        "max_term_months": 36,
    })
    assert create.status_code == 200
    product_id = create.json()["id"]

    resp = auth_client.patch(f"{BASE}/{product_id}", json={
        "name": "Updated Product Name",
        "interest_rate": "3.5",
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Product Name"


def test_delete_loan_product_with_loans(auth_client, tenant_db):
    from models.tenant import LoanProduct, LoanApplication, Member
    import uuid
    from datetime import datetime

    product = LoanProduct(
        id=str(uuid.uuid4()),
        name="Cannot Delete",
        code=f"LPDEL{uuid.uuid4().hex[:4]}",
        interest_rate=5.0,
        interest_type="flat",
        min_amount=1000,
        max_amount=100000,
        min_term_months=1,
        max_term_months=12,
        is_active=True,
    )
    tenant_db.add(product)
    tenant_db.flush()

    member = tenant_db.query(Member).first()

    loan = LoanApplication(
        id=str(uuid.uuid4()),
        application_number=f"LN{uuid.uuid4().hex[:8]}",
        member_id=member.id,
        loan_product_id=product.id,
        amount=10000,
        term_months=6,
        interest_rate=5.0,
        status="pending",
        applied_at=datetime.utcnow(),
    )
    tenant_db.add(loan)
    tenant_db.commit()

    resp = auth_client.delete(f"{BASE}/{product.id}")
    assert resp.status_code == 400
    assert "cannot delete" in resp.json()["detail"].lower()
