from tests.conftest import TEST_ORG_ID

BASE = f"/api/organizations/{TEST_ORG_ID}/reports"


def test_financial_summary(auth_client):
    resp = auth_client.get(f"{BASE}/financial-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "member_deposits" in data
    assert "loan_portfolio" in data
    assert "period_activity" in data


def test_loan_report(auth_client):
    resp = auth_client.get(f"{BASE}/loans")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (dict, list))
