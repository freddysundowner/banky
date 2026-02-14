import uuid
from datetime import date
from decimal import Decimal
from tests.conftest import TEST_ORG_ID, TEST_MEMBER_ID, TEST_STAFF_ID, TEST_BRANCH_ID
from models.tenant import TellerFloat, Member

BASE = f"/api/organizations/{TEST_ORG_ID}/transactions"


def _ensure_teller_float(tenant_db):
    existing = tenant_db.query(TellerFloat).filter(
        TellerFloat.staff_id == TEST_STAFF_ID,
        TellerFloat.date == date.today(),
        TellerFloat.status == "open",
    ).first()
    if not existing:
        tf = TellerFloat(
            id=str(uuid.uuid4()),
            staff_id=TEST_STAFF_ID,
            branch_id=TEST_BRANCH_ID,
            date=date.today(),
            opening_balance=Decimal("500000"),
            current_balance=Decimal("500000"),
            status="open",
        )
        tenant_db.add(tf)
        tenant_db.commit()


def test_list_transactions(auth_client):
    resp = auth_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


def test_deposit_requires_float(auth_client):
    resp = auth_client.post(BASE, json={
        "member_id": TEST_MEMBER_ID,
        "transaction_type": "deposit",
        "account_type": "savings",
        "amount": "1000",
        "payment_method": "cash",
    })
    assert resp.status_code == 400
    detail = resp.json()["detail"].lower()
    assert "float" in detail or "teller" in detail


def test_deposit_with_float(auth_client, tenant_db):
    _ensure_teller_float(tenant_db)

    member = tenant_db.query(Member).filter(Member.id == TEST_MEMBER_ID).first()
    balance_before = member.savings_balance or Decimal("0")

    resp = auth_client.post(BASE, json={
        "member_id": TEST_MEMBER_ID,
        "transaction_type": "deposit",
        "account_type": "savings",
        "amount": "5000",
        "payment_method": "cash",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["transaction_type"] == "deposit"

    tenant_db.refresh(member)
    assert member.savings_balance >= balance_before + Decimal("5000")


def test_withdrawal_insufficient_balance(auth_client, tenant_db):
    _ensure_teller_float(tenant_db)

    from models.tenant import Member as M
    import uuid as _uuid

    member = M(
        id=str(_uuid.uuid4()),
        member_number=f"MBR{_uuid.uuid4().hex[:6]}",
        first_name="Broke",
        last_name="Tester",
        phone="+254700000001",
        branch_id=TEST_BRANCH_ID,
        savings_balance=Decimal("0"),
        shares_balance=Decimal("0"),
        deposits_balance=Decimal("0"),
        is_active=True,
        status="active",
    )
    tenant_db.add(member)
    tenant_db.commit()

    resp = auth_client.post(BASE, json={
        "member_id": member.id,
        "transaction_type": "withdrawal",
        "account_type": "savings",
        "amount": "10000",
        "payment_method": "cash",
    })
    assert resp.status_code == 400


def test_transaction_detail(auth_client, tenant_db):
    _ensure_teller_float(tenant_db)

    create_resp = auth_client.post(BASE, json={
        "member_id": TEST_MEMBER_ID,
        "transaction_type": "deposit",
        "account_type": "savings",
        "amount": "2000",
        "payment_method": "cash",
    })
    assert create_resp.status_code == 200
    txn_id = create_resp.json()["id"]

    resp = auth_client.get(f"{BASE}/{txn_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == txn_id
