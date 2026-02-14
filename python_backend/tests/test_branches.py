from tests.conftest import TEST_ORG_ID, TEST_BRANCH_ID

BASE = f"/api/organizations/{TEST_ORG_ID}/branches"


def _upgrade_to_growth(master_db):
    from models.master import OrganizationSubscription, SubscriptionPlan
    sub = master_db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == TEST_ORG_ID,
    ).first()
    if sub:
        growth = master_db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_type == "growth",
        ).first()
        if growth:
            sub.plan_id = growth.id
            master_db.commit()


def _downgrade_to_starter(master_db):
    from models.master import OrganizationSubscription, SubscriptionPlan
    sub = master_db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == TEST_ORG_ID,
    ).first()
    if sub:
        starter = master_db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_type == "starter",
        ).first()
        if starter:
            sub.plan_id = starter.id
            master_db.commit()


def test_list_branches(auth_client):
    resp = auth_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(b["id"] == TEST_BRANCH_ID for b in data)


def test_create_branch(auth_client, master_db):
    _upgrade_to_growth(master_db)
    try:
        resp = auth_client.post(BASE, json={
            "name": "Test Branch Two",
            "address": "456 Test Street",
            "phone": "+254700999999",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Branch Two"
        assert "code" in data
        assert data["code"].startswith("BR")
        assert data["is_active"] is True
    finally:
        _downgrade_to_starter(master_db)


def test_update_branch(auth_client):
    resp = auth_client.patch(f"{BASE}/{TEST_BRANCH_ID}", json={
        "name": "Main Branch Updated",
        "address": "Updated Address",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Main Branch Updated"
    assert data["address"] == "Updated Address"

    auth_client.patch(f"{BASE}/{TEST_BRANCH_ID}", json={
        "name": "Main Branch",
        "address": "Nairobi CBD",
    })


def test_delete_branch(auth_client, master_db):
    _upgrade_to_growth(master_db)
    try:
        create_resp = auth_client.post(BASE, json={
            "name": "Branch To Delete",
        })
        assert create_resp.status_code == 200
        branch_id = create_resp.json()["id"]

        resp = auth_client.delete(f"{BASE}/{branch_id}")
        assert resp.status_code == 200
        assert "deleted" in resp.json().get("message", "").lower()
    finally:
        _downgrade_to_starter(master_db)


def test_create_branch_unauthenticated(app):
    from fastapi.testclient import TestClient
    with TestClient(app, cookies={}) as c:
        resp = c.post(BASE, json={
            "name": "Should Fail",
        })
        assert resp.status_code == 401
