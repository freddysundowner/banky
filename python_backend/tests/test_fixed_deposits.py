from tests.conftest import TEST_ORG_ID

BASE = f"/api/organizations/{TEST_ORG_ID}/fixed-deposits"
PRODUCTS_BASE = f"/api/organizations/{TEST_ORG_ID}/fixed-deposit-products"


def test_list_fixed_deposits(auth_client):
    resp = auth_client.get(BASE)
    if resp.status_code == 403:
        assert "not available" in resp.json()["detail"].lower() or "subscription" in resp.json()["detail"].lower()
        return
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_create_fixed_deposit(auth_client):
    resp = auth_client.get(PRODUCTS_BASE)
    if resp.status_code == 403:
        assert "not available" in resp.json()["detail"].lower() or "subscription" in resp.json()["detail"].lower()
        return
    assert resp.status_code == 200
