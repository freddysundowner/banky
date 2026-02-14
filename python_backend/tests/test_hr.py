from tests.conftest import TEST_ORG_ID

BASE = f"/api/organizations/{TEST_ORG_ID}/hr"


def test_attendance_status(auth_client):
    resp = auth_client.get(f"{BASE}/attendance/my-status")
    assert resp.status_code == 200
    data = resp.json()
    assert "clocked_in" in data


def test_clock_in(auth_client):
    resp = auth_client.post(f"{BASE}/attendance/clock-in")
    assert resp.status_code in [200, 400]
    if resp.status_code == 400:
        assert "already clocked in" in resp.json()["detail"].lower()


def test_clock_out(auth_client):
    auth_client.post(f"{BASE}/attendance/clock-in")
    resp = auth_client.post(f"{BASE}/attendance/clock-out")
    assert resp.status_code in [200, 400]
    if resp.status_code == 400:
        detail = resp.json()["detail"].lower()
        assert "not clocked in" in detail or "already clocked out" in detail
