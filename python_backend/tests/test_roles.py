from tests.conftest import TEST_ORG_ID

BASE = f"/api/organizations/{TEST_ORG_ID}/roles"


def test_list_roles(auth_client):
    resp = auth_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_create_role(auth_client):
    resp = auth_client.post(BASE, json={
        "name": "custom_auditor",
        "description": "Custom auditor role",
        "permissions": ["audit:read", "reports:read", "members:read"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "custom_auditor"
    assert "audit:read" in data.get("permissions", [])
