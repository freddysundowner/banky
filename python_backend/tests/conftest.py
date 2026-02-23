import os
import sys
import uuid
import secrets
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("DATABASE_URL", "sqlite:///test_master.db")
os.environ.setdefault("DEPLOYMENT_MODE", "saas")

from models.master import Base as MasterBase, User, Organization, OrganizationMember, Session as UserSession, SubscriptionPlan, OrganizationSubscription
from models.tenant import TenantBase, Branch, Staff, Member, LoanProduct, LoanApplication, Transaction, TellerFloat, FloatTransaction, AuditLog, OrganizationSettings, Role, RolePermission, SMSNotification, Expense, MemberFixedDeposit, Attendance, PerformanceReview, LeaveRequest, LoanGuarantor, LoanExtraCharge
import accounting.models  # noqa: F401 - ensure accounting tables are registered in TenantBase
from services.auth import hash_password


TEST_ORG_ID = str(uuid.uuid4())
TEST_USER_ID = str(uuid.uuid4())
TEST_BRANCH_ID = str(uuid.uuid4())
TEST_STAFF_ID = str(uuid.uuid4())
TEST_MEMBER_ID = str(uuid.uuid4())
TEST_SESSION_TOKEN = secrets.token_urlsafe(32)


def _enable_sqlite_fk(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


@pytest.fixture(scope="session")
def master_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    event.listen(engine, "connect", _enable_sqlite_fk)
    MasterBase.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="session")
def tenant_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    event.listen(engine, "connect", _enable_sqlite_fk)
    TenantBase.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="session")
def MasterSession(master_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=master_engine)


@pytest.fixture(scope="session")
def TenantSession(tenant_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=tenant_engine)


@pytest.fixture(scope="session")
def seed_master_data(MasterSession):
    db = MasterSession()
    try:
        plan = SubscriptionPlan(
            id=str(uuid.uuid4()),
            name="Starter",
            plan_type="starter",
            pricing_model="saas",
            monthly_price=0,
            max_members=500,
            max_staff=3,
            max_branches=1,
            sms_credits_monthly=50,
            features={"enabled": ["core_banking", "members", "savings", "shares", "loans", "teller_station", "audit_logs", "mpesa_integration"]},
            is_active=True,
        )
        db.add(plan)

        growth_plan = SubscriptionPlan(
            id=str(uuid.uuid4()),
            name="Growth",
            plan_type="growth",
            pricing_model="saas",
            monthly_price=2500,
            max_members=2000,
            max_staff=10,
            max_branches=5,
            sms_credits_monthly=500,
            features={"enabled": ["core_banking", "members", "savings", "shares", "loans", "teller_station", "float_management", "analytics", "sms_notifications", "expenses", "leave_management", "multiple_branches", "audit_logs", "accounting"]},
            is_active=True,
        )
        db.add(growth_plan)

        user = User(
            id=TEST_USER_ID,
            email="test@bankykit.test",
            password=hash_password("TestPass123!"),
            first_name="Test",
            last_name="User",
            is_active=True,
        )
        db.add(user)

        org = Organization(
            id=TEST_ORG_ID,
            name="Test SACCO",
            code="TSACCO",
            email="info@testsacco.co.ke",
            phone="+254700111111",
            deployment_mode="saas",
            currency="KES",
            connection_string="sqlite:///:memory:",
            is_active=True,
        )
        db.add(org)

        membership = OrganizationMember(
            id=str(uuid.uuid4()),
            organization_id=TEST_ORG_ID,
            user_id=TEST_USER_ID,
            role="owner",
            is_owner=True,
        )
        db.add(membership)

        session = UserSession(
            id=str(uuid.uuid4()),
            user_id=TEST_USER_ID,
            token=TEST_SESSION_TOKEN,
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        db.add(session)

        sub = OrganizationSubscription(
            id=str(uuid.uuid4()),
            organization_id=TEST_ORG_ID,
            plan_id=plan.id,
            status="trial",
            trial_ends_at=datetime.utcnow() + timedelta(days=30),
        )
        db.add(sub)

        db.commit()
        return {"plan": plan, "growth_plan": growth_plan, "user": user, "org": org, "membership": membership}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@pytest.fixture(scope="session")
def seed_tenant_data(TenantSession):
    db = TenantSession()
    try:
        branch = Branch(
            id=TEST_BRANCH_ID,
            name="Main Branch",
            code="BR01",
            address="Nairobi CBD",
            phone="+254700222222",
            is_active=True,
        )
        db.add(branch)

        staff = Staff(
            id=TEST_STAFF_ID,
            staff_number="ST01",
            first_name="Test",
            last_name="Admin",
            email="test@bankykit.test",
            phone="+254700333333",
            role="admin",
            branch_id=TEST_BRANCH_ID,
            password_hash=hash_password("TestPass123!"),
            is_active=True,
        )
        db.add(staff)

        member = Member(
            id=TEST_MEMBER_ID,
            member_number="0100000015",
            first_name="Alice",
            last_name="Wanjiku",
            email="alice@example.com",
            phone="+254711222333",
            branch_id=TEST_BRANCH_ID,
            savings_balance=Decimal("0"),
            shares_balance=Decimal("0"),
            deposits_balance=Decimal("0"),
            is_active=True,
        )
        db.add(member)

        db.commit()
        return {"branch": branch, "staff": staff, "member": member}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


class FakeTenantContext:
    def __init__(self, session_factory):
        self._session_factory = session_factory

    def create_session(self):
        return self._session_factory()

    def close(self):
        pass


@pytest.fixture(scope="session")
def app(master_engine, tenant_engine, MasterSession, TenantSession, seed_master_data, seed_tenant_data):
    from models.database import get_db

    MasterSessionLocal = MasterSession
    TenantSessionLocal = TenantSession

    def override_get_db():
        db = MasterSessionLocal()
        try:
            yield db
        finally:
            db.close()

    original_get_tenant_context = None
    original_get_tenant_context_simple = None

    import routes.common as common_mod
    import services.tenant_context as ctx_mod
    import accounting.routes as acct_routes_mod

    original_get_tenant_context = ctx_mod.get_tenant_context
    original_get_tenant_context_simple = ctx_mod.get_tenant_context_simple
    original_acct_get_tenant_context = acct_routes_mod.get_tenant_context

    def mock_get_tenant_context(org_id, user_id, db):
        if org_id != TEST_ORG_ID:
            return None, None
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        ).first()
        if not membership:
            return None, None
        return FakeTenantContext(TenantSessionLocal), membership

    def mock_get_tenant_context_simple(org_id, db):
        if org_id != TEST_ORG_ID:
            return None
        return FakeTenantContext(TenantSessionLocal)

    ctx_mod.get_tenant_context = mock_get_tenant_context
    ctx_mod.get_tenant_context_simple = mock_get_tenant_context_simple
    common_mod.get_tenant_context = mock_get_tenant_context
    common_mod.get_tenant_context_simple = mock_get_tenant_context_simple
    acct_routes_mod.get_tenant_context = mock_get_tenant_context

    from main import app as fastapi_app

    fastapi_app.dependency_overrides[get_db] = override_get_db

    yield fastapi_app

    fastapi_app.dependency_overrides.clear()
    ctx_mod.get_tenant_context = original_get_tenant_context
    ctx_mod.get_tenant_context_simple = original_get_tenant_context_simple
    common_mod.get_tenant_context = original_get_tenant_context
    common_mod.get_tenant_context_simple = original_get_tenant_context_simple
    acct_routes_mod.get_tenant_context = original_acct_get_tenant_context


@pytest.fixture(scope="session")
def client(app):
    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth_client(client):
    client.cookies.set("session_token", TEST_SESSION_TOKEN)
    return client


@pytest.fixture
def master_db(MasterSession):
    db = MasterSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def tenant_db(TenantSession):
    db = TenantSession()
    try:
        yield db
    finally:
        db.close()
