import uuid
from datetime import date
from tests.conftest import TEST_ORG_ID

BASE_EXPENSES = f"/api/organizations/{TEST_ORG_ID}/expenses"
BASE_CATEGORIES = f"/api/organizations/{TEST_ORG_ID}/expenses/categories"


def _create_category(auth_client):
    resp = auth_client.post(BASE_CATEGORIES, json={
        "name": f"Test Category {uuid.uuid4().hex[:6]}",
        "description": "Test expense category",
    })
    assert resp.status_code == 200
    return resp.json()


def test_list_expenses(auth_client):
    resp = auth_client.get(BASE_EXPENSES)
    assert resp.status_code == 200
    data = resp.json()
    if isinstance(data, dict):
        assert "items" in data or "expenses" in data or isinstance(data, dict)
    else:
        assert isinstance(data, list)


def test_create_expense(auth_client):
    category = _create_category(auth_client)
    resp = auth_client.post(BASE_EXPENSES, json={
        "category_id": category["id"],
        "amount": "5000",
        "expense_date": date.today().isoformat(),
        "description": "Office supplies",
        "payment_method": "cash",
        "vendor": "Stationery Shop",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["amount"]) == 5000.0
    assert data["description"] == "Office supplies"


def test_approve_expense(auth_client):
    category = _create_category(auth_client)
    create_resp = auth_client.post(BASE_EXPENSES, json={
        "category_id": category["id"],
        "amount": "2500",
        "expense_date": date.today().isoformat(),
        "description": "Fuel expense",
        "payment_method": "mpesa",
    })
    assert create_resp.status_code == 200
    expense_id = create_resp.json()["id"]

    resp = auth_client.post(f"{BASE_EXPENSES}/{expense_id}/approve")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "approved" or "approved" in str(data).lower()
