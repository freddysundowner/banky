import uuid
from tests.conftest import TEST_ORG_ID, TEST_BRANCH_ID, TEST_MEMBER_ID

BASE = f"/api/organizations/{TEST_ORG_ID}/members"


def test_list_members(auth_client):
    resp = auth_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_create_member(auth_client):
    resp = auth_client.post(BASE, json={
        "first_name": "Bob",
        "last_name": "Kamau",
        "phone": "+254722111222",
        "branch_id": TEST_BRANCH_ID,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "Bob"
    assert data["last_name"] == "Kamau"
    assert "member_number" in data
    assert len(data["member_number"]) > 0


def test_get_member_detail(auth_client):
    resp = auth_client.get(f"{BASE}/{TEST_MEMBER_ID}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == TEST_MEMBER_ID
    assert data["first_name"] == "Alice"


def test_update_member(auth_client):
    resp = auth_client.patch(f"{BASE}/{TEST_MEMBER_ID}", json={
        "phone": "+254799888777",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["phone"] == "+254799888777"


def test_search_members(auth_client):
    resp = auth_client.get(BASE, params={"search": "Alice"})
    assert resp.status_code == 200
    data = resp.json()
    if isinstance(data, dict):
        items = data.get("items", [])
    else:
        items = data
    assert any(m["first_name"] == "Alice" for m in items)


def test_member_statement(auth_client):
    resp = auth_client.get(
        f"/api/organizations/{TEST_ORG_ID}/reports/member-statement/{TEST_MEMBER_ID}"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "member" in data
    assert data["member"]["id"] == TEST_MEMBER_ID
