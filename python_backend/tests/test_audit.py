from tests.conftest import TEST_ORG_ID, TEST_BRANCH_ID

BASE = f"/api/organizations/{TEST_ORG_ID}/audit-logs"
MEMBERS_BASE = f"/api/organizations/{TEST_ORG_ID}/members"


def test_list_audit_logs(auth_client):
    resp = auth_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    if isinstance(data, dict):
        assert "items" in data or "logs" in data or "audit_logs" in data
    else:
        assert isinstance(data, list)


def test_audit_log_created_on_action(auth_client):
    auth_client.post(MEMBERS_BASE, json={
        "first_name": "AuditTest",
        "last_name": "Member",
        "phone": "+254700999111",
        "branch_id": TEST_BRANCH_ID,
    })

    resp = auth_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    logs = data if isinstance(data, list) else data.get("items", data.get("logs", data.get("audit_logs", [])))
    member_logs = [l for l in logs if l.get("action") == "member_created" or l.get("entity_type") == "member"]
    assert len(member_logs) >= 1
