from tests.conftest import TEST_ORG_ID

BASE = f"/api/organizations/{TEST_ORG_ID}/sms"


def test_list_sms(auth_client):
    resp = auth_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_sms_templates(auth_client):
    resp = auth_client.get(f"{BASE}/templates")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
