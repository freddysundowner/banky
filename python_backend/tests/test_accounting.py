from tests.conftest import TEST_ORG_ID

BASE = f"/api/organizations/{TEST_ORG_ID}/accounting"


def test_seed_accounts(auth_client):
    resp = auth_client.post(f"{BASE}/seed-accounts")
    assert resp.status_code == 200
    data = resp.json()
    assert "created" in data or "message" in data


def test_list_accounts(auth_client):
    auth_client.post(f"{BASE}/seed-accounts")
    resp = auth_client.get(f"{BASE}/accounts")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "code" in data[0]
    assert "name" in data[0]


def test_create_account(auth_client):
    auth_client.post(f"{BASE}/seed-accounts")
    resp = auth_client.post(f"{BASE}/accounts", json={
        "code": "9999",
        "name": "Test Custom Account",
        "account_type": "expense",
        "description": "A test account",
        "is_header": False,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Custom Account"
    assert data["code"] == "9999"


def test_trial_balance(auth_client):
    auth_client.post(f"{BASE}/seed-accounts")
    resp = auth_client.get(f"{BASE}/reports/trial-balance")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (dict, list))


def test_create_journal_entry(auth_client, tenant_db):
    auth_client.post(f"{BASE}/seed-accounts")

    accounts_resp = auth_client.get(f"{BASE}/accounts")
    accounts = accounts_resp.json()
    if len(accounts) < 2:
        return

    debit_account = accounts[0]
    credit_account = accounts[1]

    from datetime import date
    resp = auth_client.post(f"{BASE}/journal-entries", json={
        "entry_date": date.today().isoformat(),
        "description": "Test journal entry",
        "reference": "JE-TEST-001",
        "lines": [
            {
                "account_id": debit_account["id"],
                "debit": "1000",
                "credit": "0",
                "memo": "Debit leg",
            },
            {
                "account_id": credit_account["id"],
                "debit": "0",
                "credit": "1000",
                "memo": "Credit leg",
            },
        ],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Test journal entry"
