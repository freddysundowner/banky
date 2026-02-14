import uuid
from fastapi.testclient import TestClient
from tests.conftest import TEST_ORG_ID, TEST_USER_ID, TEST_SESSION_TOKEN


def test_health_check(auth_client):
    resp = auth_client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "BANKY API"


def test_get_current_user(auth_client):
    resp = auth_client.get("/api/auth/user")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@banky.test"


def test_get_user_unauthenticated(app):
    with TestClient(app, cookies={}) as c:
        c.cookies.clear()
        resp = c.get("/api/auth/user")
        assert resp.status_code == 200
        assert resp.json() is None


def test_register_user(app):
    with TestClient(app) as c:
        email = f"newuser_{uuid.uuid4().hex[:8]}@bankytest.com"
        resp = c.post("/api/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "firstName": "New",
            "lastName": "User",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == email
        assert "id" in data


def test_register_duplicate_email(app):
    with TestClient(app) as c:
        email = f"dup_{uuid.uuid4().hex[:8]}@bankytest.com"
        c.post("/api/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "firstName": "Dup",
            "lastName": "User",
        })
        resp = c.post("/api/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "firstName": "Dup",
            "lastName": "User",
        })
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"].lower()


def test_login_success(app):
    with TestClient(app) as c:
        email = f"login_{uuid.uuid4().hex[:8]}@bankytest.com"
        c.post("/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "firstName": "Login",
            "lastName": "Test",
        })
        resp = c.post("/api/auth/login", json={
            "email": email,
            "password": "TestPass123!",
        })
        assert resp.status_code == 200
        assert "session_token" in resp.cookies or "id" in resp.json()


def test_login_wrong_password(app):
    with TestClient(app) as c:
        email = f"wrongpw_{uuid.uuid4().hex[:8]}@bankytest.com"
        c.post("/api/auth/register", json={
            "email": email,
            "password": "CorrectPass123!",
            "firstName": "WrongPW",
            "lastName": "Test",
        })
        resp = c.post("/api/auth/login", json={
            "email": email,
            "password": "WrongPassword!",
        })
        assert resp.status_code == 401


def test_login_nonexistent_user(app):
    with TestClient(app) as c:
        resp = c.post("/api/auth/login", json={
            "email": f"nonexistent_{uuid.uuid4().hex[:8]}@bankytest.com",
            "password": "AnyPass123!",
        })
        assert resp.status_code == 401


def test_logout(app):
    with TestClient(app) as c:
        email = f"logout_{uuid.uuid4().hex[:8]}@bankytest.com"
        c.post("/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "firstName": "Logout",
            "lastName": "Test",
        })
        login_resp = c.post("/api/auth/login", json={
            "email": email,
            "password": "TestPass123!",
        })
        assert login_resp.status_code == 200
        resp = c.post("/api/auth/logout")
        assert resp.status_code in [200, 204]


def test_working_hours_check():
    from routes.auth import check_working_hours

    class FakeOrg:
        enforce_working_hours = False
        working_hours_start = None
        working_hours_end = None
        working_days = None

    result = check_working_hours(FakeOrg(), "admin")
    assert result["allowed"] is True

    result2 = check_working_hours(FakeOrg(), "teller")
    assert result2["allowed"] is True

    result3 = check_working_hours(None, "teller")
    assert result3["allowed"] is True
