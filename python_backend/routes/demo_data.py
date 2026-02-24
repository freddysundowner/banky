from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, date, timedelta
import bcrypt
import os
import uuid

from models.database import get_db, get_tenant_session
from models.master import (
    Organization, OrganizationMember, User, OrganizationSubscription, SubscriptionPlan,
    Session as UserSession, MobileDeviceRegistry
)
from models.tenant import (
    TenantBase, Branch, Staff, Member, LoanProduct, LoanApplication,
    LoanRepayment, Transaction, OrganizationSettings, MobileSession
)
import hashlib
import secrets as sec_mod
from routes.admin import require_admin
from models.master import AdminUser

router = APIRouter(prefix="/admin/demo-data", tags=["admin"])

DEMO_CODE = "DEMO"
DEMO_OWNER_EMAIL = "demo@demo.bankykit"
DEMO_OWNER_PASSWORD = "Demo@1234"


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _uid() -> str:
    return str(uuid.uuid4())


def _get_demo_org(db: Session):
    return db.query(Organization).filter(Organization.code == DEMO_CODE).first()


def _get_connection_string() -> str:
    return os.environ.get("DATABASE_URL", "")


DEMO_BRANCH_CODE  = "DEMO"
DEMO_STAFF_PREFIX = "DMS"
DEMO_MEMBER_PREFIX = "DMB"
DEMO_TXN_PREFIX   = "DTXN"
DEMO_LOAN_PREFIX  = "DLN"
DEMO_REP_PREFIX   = "DREP"
DEMO_PROD_CODES   = ("DDEV", "DEMG")
DEMO_EMAIL_DOMAIN = "@demo.bankykit"
DEMO_MOBILE_ID_NUMBER = "DEMO000001"
DEMO_MOBILE_PIN = "123456"

_PBKDF2_ITERATIONS = 260000
_PBKDF2_HASH = "sha256"


def _hash_pin(pin: str) -> str:
    salt = sec_mod.token_hex(16)
    dk = hashlib.pbkdf2_hmac(_PBKDF2_HASH, pin.encode(), salt.encode(), _PBKDF2_ITERATIONS)
    return f"{salt}:{dk.hex()}"


def _seed_tenant(conn_str: str):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(conn_str, pool_pre_ping=True)
    TenantBase.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    tdb = Session()

    try:
        # Branch
        branch_id = _uid()
        branch = Branch(
            id=branch_id,
            name="Demo Head Office",
            code=DEMO_BRANCH_CODE,
            address="123 Main Street",
            phone="+1 555 000 0000",
            email=f"headoffice{DEMO_EMAIL_DOMAIN}",
            is_active=True,
        )
        tdb.add(branch)

        # Staff
        manager_id = _uid()
        manager = Staff(
            id=manager_id,
            staff_number=f"{DEMO_STAFF_PREFIX}001",
            first_name="Alice",
            last_name="Manager",
            email=f"alice{DEMO_EMAIL_DOMAIN}",
            phone="+1 555 000 0001",
            role="admin",
            branch_id=branch_id,
            password_hash=_hash("Demo@1234"),
            is_active=True,
        )
        tdb.add(manager)

        officer_id = _uid()
        officer = Staff(
            id=officer_id,
            staff_number=f"{DEMO_STAFF_PREFIX}002",
            first_name="Bob",
            last_name="Officer",
            email=f"bob{DEMO_EMAIL_DOMAIN}",
            phone="+1 555 000 0002",
            role="loan_officer",
            branch_id=branch_id,
            password_hash=_hash("Demo@1234"),
            is_active=True,
        )
        tdb.add(officer)

        teller_id = _uid()
        teller = Staff(
            id=teller_id,
            staff_number=f"{DEMO_STAFF_PREFIX}003",
            first_name="Carol",
            last_name="Teller",
            email=f"carol{DEMO_EMAIL_DOMAIN}",
            phone="+1 555 000 0003",
            role="teller",
            branch_id=branch_id,
            password_hash=_hash("Demo@1234"),
            is_active=True,
        )
        tdb.add(teller)

        hr_id = _uid()
        hr_staff = Staff(
            id=hr_id,
            staff_number=f"{DEMO_STAFF_PREFIX}004",
            first_name="Dave",
            last_name="HR",
            email=f"dave{DEMO_EMAIL_DOMAIN}",
            phone="+1 555 000 0004",
            role="hr",
            branch_id=branch_id,
            password_hash=_hash("Demo@1234"),
            is_active=True,
        )
        tdb.add(hr_staff)

        kiosk_id = _uid()
        kiosk_staff = Staff(
            id=kiosk_id,
            staff_number=f"{DEMO_STAFF_PREFIX}005",
            first_name="Eve",
            last_name="Kiosk",
            email=f"eve{DEMO_EMAIL_DOMAIN}",
            phone="+1 555 000 0005",
            role="kiosk_operator",
            branch_id=branch_id,
            password_hash=_hash("Demo@1234"),
            is_active=True,
        )
        tdb.add(kiosk_staff)

        tdb.flush()

        # Loan Products
        prod1_id = _uid()
        prod1 = LoanProduct(
            id=prod1_id,
            name="Demo Development Loan",
            code=DEMO_PROD_CODES[0],
            description="General-purpose development loan for members.",
            interest_rate=1.5,
            interest_rate_period="monthly",
            interest_type="reducing_balance",
            repayment_frequency="monthly",
            min_amount=500,
            max_amount=50000,
            min_term_months=3,
            max_term_months=36,
            processing_fee=2.0,
            requires_guarantor=False,
            is_active=True,
        )
        tdb.add(prod1)

        prod2_id = _uid()
        prod2 = LoanProduct(
            id=prod2_id,
            name="Demo Emergency Loan",
            code=DEMO_PROD_CODES[1],
            description="Quick-access emergency loan disbursed within 24 hours.",
            interest_rate=2.0,
            interest_rate_period="monthly",
            interest_type="flat_rate",
            repayment_frequency="monthly",
            min_amount=100,
            max_amount=5000,
            min_term_months=1,
            max_term_months=12,
            processing_fee=1.0,
            requires_guarantor=False,
            is_active=True,
        )
        tdb.add(prod2)

        tdb.flush()

        # Members
        member_data = [
            ("James",   "Anderson",  12000, 5000),
            ("Sarah",   "Mitchell",   8500, 3200),
            ("David",   "Thompson",  15000, 7500),
            ("Emily",   "Roberts",    6200, 2100),
            ("Michael", "Harris",    22000, 9800),
            ("Lisa",    "Clark",      4800, 1800),
            ("Robert",  "Lewis",     18500, 6400),
            ("Karen",   "Walker",     9300, 3700),
            ("William", "Hall",      31000, 12000),
            ("Nancy",   "Young",      7100, 2900),
            ("Charles", "King",      25500, 10500),
            ("Betty",   "Wright",     5600, 2400),
            ("Joseph",  "Scott",     19200, 8100),
            ("Sandra",  "Green",      3900, 1600),
            ("Thomas",  "Adams",     42000, 17000),
        ]

        member_ids = []
        for idx, (fn, ln, savings, shares) in enumerate(member_data):
            mid = _uid()
            member_ids.append(mid)
            slug = f"{fn.lower()}.{ln.lower()}"
            m = Member(
                id=mid,
                member_number=f"{DEMO_MEMBER_PREFIX}{str(idx+1).zfill(3)}",
                first_name=fn,
                last_name=ln,
                email=f"{slug}{DEMO_EMAIL_DOMAIN}",
                phone=f"+1 555 100 {str(idx+1).zfill(4)}",
                id_number=f"DEMO{str(10000 + idx + 1)}",
                id_type="national_id",
                gender="male" if fn in ("James","David","Michael","Robert","William","Charles","Joseph","Thomas") else "female",
                date_of_birth=date(1985, 6, 15),
                nationality="US",
                address="456 Example Avenue",
                city="Springfield",
                country="USA",
                employment_status="employed",
                monthly_income=5000,
                branch_id=branch_id,
                membership_type="ordinary",
                savings_balance=savings,
                shares_balance=shares,
                deposits_balance=0,
                status="active",
                is_active=True,
                joined_at=datetime.utcnow() - timedelta(days=365),
                created_by_id=manager_id,
            )
            tdb.add(m)

        tdb.flush()

        demo_mobile_id = _uid()
        demo_mobile_savings = 25000
        demo_mobile_shares = 10000
        demo_mobile_deposits = 5000
        demo_mobile = Member(
            id=demo_mobile_id,
            member_number=f"{DEMO_MEMBER_PREFIX}016",
            first_name="Demo",
            last_name="User",
            email=f"demo.user{DEMO_EMAIL_DOMAIN}",
            phone="+254700000000",
            id_number=DEMO_MOBILE_ID_NUMBER,
            id_type="national_id",
            gender="male",
            date_of_birth=date(1990, 1, 15),
            nationality="KE",
            address="456 Kenyatta Avenue",
            city="Nairobi",
            country="Kenya",
            employment_status="employed",
            monthly_income=75000,
            branch_id=branch_id,
            membership_type="ordinary",
            savings_balance=demo_mobile_savings,
            shares_balance=demo_mobile_shares,
            deposits_balance=demo_mobile_deposits,
            status="active",
            is_active=True,
            mobile_banking_active=True,
            pin_hash=_hash_pin(DEMO_MOBILE_PIN),
            mobile_device_id="demo-device",
            joined_at=datetime.utcnow() - timedelta(days=400),
            created_by_id=manager_id,
        )
        tdb.add(demo_mobile)
        member_ids.append(demo_mobile_id)
        member_data.append(("Demo", "User", demo_mobile_savings, demo_mobile_shares))
        tdb.flush()

        # Transactions — savings deposits for each member
        for idx, (mid, (fn, ln, savings, shares)) in enumerate(zip(member_ids, member_data)):
            tdb.add(Transaction(
                id=_uid(),
                transaction_number=f"{DEMO_TXN_PREFIX}{str(idx+1).zfill(4)}",
                member_id=mid,
                transaction_type="deposit",
                account_type="savings",
                amount=savings,
                balance_before=0,
                balance_after=savings,
                payment_method="cash",
                reference=f"DEMO-SAV-{idx+1}",
                description="Opening savings deposit",
                processed_by_id=teller_id,
                created_at=datetime.utcnow() - timedelta(days=300),
            ))
            tdb.add(Transaction(
                id=_uid(),
                transaction_number=f"{DEMO_TXN_PREFIX}{str(idx+100).zfill(4)}",
                member_id=mid,
                transaction_type="deposit",
                account_type="shares",
                amount=shares,
                balance_before=0,
                balance_after=shares,
                payment_method="cash",
                reference=f"DEMO-SHR-{idx+1}",
                description="Opening shares purchase",
                processed_by_id=teller_id,
                created_at=datetime.utcnow() - timedelta(days=300),
            ))

        tdb.flush()

        # Loans — various statuses
        loan_scenarios = [
            # (member_idx, product_id, amount, term, status, months_ago)
            (0,  prod1_id, 10000, 12, "disbursed", 8),
            (1,  prod2_id,  2000,  6, "disbursed", 5),
            (2,  prod1_id, 20000, 24, "disbursed", 12),
            (3,  prod2_id,  1500,  3, "closed",    10),
            (4,  prod1_id, 35000, 36, "disbursed",  2),
            (5,  prod2_id,  3000,  6, "approved",   1),
            (6,  prod1_id, 15000, 18, "pending",    0),
            (7,  prod2_id,  4500, 12, "disbursed",  4),
        ]

        for i, (midx, prod_id, amt, term, status, months_ago) in enumerate(loan_scenarios):
            loan_id = _uid()
            applied = datetime.utcnow() - timedelta(days=months_ago * 30)
            disbursed_at = applied + timedelta(days=3) if status in ("disbursed", "closed") else None
            approved_at = applied + timedelta(days=1) if status in ("approved", "disbursed", "closed") else None

            monthly_payment = round((amt * 0.015 * (1.015 ** term)) / ((1.015 ** term) - 1), 2)
            months_paid = months_ago if status in ("disbursed",) else term if status == "closed" else 0
            amount_repaid = round(monthly_payment * months_paid, 2)
            outstanding = max(0, round(amt - amount_repaid, 2))

            loan = LoanApplication(
                id=loan_id,
                application_number=f"{DEMO_LOAN_PREFIX}{str(i+1).zfill(4)}",
                member_id=member_ids[midx],
                loan_product_id=prod_id,
                amount=amt,
                term_months=term,
                interest_rate=1.5,
                total_interest=round(amt * 0.015 * term, 2),
                total_repayment=round(amt + amt * 0.015 * term, 2),
                monthly_repayment=monthly_payment,
                processing_fee=round(amt * 0.02, 2),
                status=status,
                purpose="Business expansion" if i % 2 == 0 else "Personal development",
                disbursement_method="bank" if status in ("disbursed", "closed") else None,
                amount_disbursed=amt if status in ("disbursed", "closed") else None,
                amount_repaid=amount_repaid,
                outstanding_balance=outstanding,
                next_payment_date=date.today() + timedelta(days=15) if status == "disbursed" else None,
                last_payment_date=date.today() - timedelta(days=15) if amount_repaid > 0 else None,
                created_by_id=officer_id,
                reviewed_by_id=manager_id if status != "pending" else None,
                applied_at=applied,
                approved_at=approved_at,
                disbursed_at=disbursed_at,
                closed_at=applied + timedelta(days=term * 30) if status == "closed" else None,
            )
            tdb.add(loan)
            tdb.flush()

            if status in ("disbursed", "closed") and months_paid > 0:
                for mo in range(min(months_paid, 6)):
                    tdb.add(LoanRepayment(
                        id=_uid(),
                        repayment_number=f"{DEMO_REP_PREFIX}-{i+1}-{mo+1}",
                        loan_id=loan_id,
                        amount=monthly_payment,
                        principal_amount=round(monthly_payment * 0.7, 2),
                        interest_amount=round(monthly_payment * 0.3, 2),
                        penalty_amount=0,
                        payment_method="cash",
                        reference=f"DEMO-REF-{i+1}-{mo+1}",
                        notes="Monthly repayment",
                        payment_date=disbursed_at + timedelta(days=30 * (mo + 1)),
                        received_by_id=teller_id,
                    ))

        # Extra transactions for demo mobile user (realistic history)
        demo_txn_base = 200
        demo_txn_history = [
            ("deposit",    "savings",  5000,  0,     5000,  "cash",   "Initial savings deposit",    350),
            ("deposit",    "savings",  3000,  5000,  8000,  "mpesa",  "M-Pesa savings top-up",      320),
            ("withdrawal", "savings",  2000,  8000,  6000,  "cash",   "Cash withdrawal",            290),
            ("deposit",    "savings",  7000,  6000,  13000, "bank",   "Bank transfer deposit",      260),
            ("deposit",    "shares",   4000,  0,     4000,  "cash",   "Shares purchase",            340),
            ("deposit",    "shares",   3000,  4000,  7000,  "mpesa",  "M-Pesa shares purchase",     280),
            ("deposit",    "shares",   3000,  7000,  10000, "bank",   "Additional shares",          200),
            ("deposit",    "savings",  5000,  13000, 18000, "mpesa",  "Monthly savings",            180),
            ("withdrawal", "savings",  3000,  18000, 15000, "mpesa",  "M-Pesa withdrawal",          150),
            ("deposit",    "savings",  8000,  15000, 23000, "bank",   "Salary deposit",             120),
            ("deposit",    "deposits", 5000,  0,     5000,  "cash",   "Fixed deposit placement",    300),
            ("deposit",    "savings",  2000,  23000, 25000, "mpesa",  "Monthly savings",            60),
        ]
        for t_idx, (t_type, acct, amt, bal_before, bal_after, method, desc, days_ago) in enumerate(demo_txn_history):
            tdb.add(Transaction(
                id=_uid(),
                transaction_number=f"{DEMO_TXN_PREFIX}{str(demo_txn_base + t_idx).zfill(4)}",
                member_id=demo_mobile_id,
                transaction_type=t_type,
                account_type=acct,
                amount=amt,
                balance_before=bal_before,
                balance_after=bal_after,
                payment_method=method,
                reference=f"DEMO-MOB-{t_idx+1}",
                description=desc,
                processed_by_id=teller_id,
                created_at=datetime.utcnow() - timedelta(days=days_ago),
            ))
        tdb.flush()

        # Loans for demo mobile user
        demo_mobile_idx = len(member_ids) - 1
        demo_loan_scenarios = [
            (demo_mobile_idx, prod1_id, 15000, 12, "disbursed", 6),
            (demo_mobile_idx, prod2_id,  3000,  6, "closed",     9),
        ]
        for di, (midx, prod_id, amt, term, status, months_ago) in enumerate(demo_loan_scenarios):
            loan_id = _uid()
            li = len(loan_scenarios) + di
            applied = datetime.utcnow() - timedelta(days=months_ago * 30)
            disbursed_at = applied + timedelta(days=3) if status in ("disbursed", "closed") else None
            approved_at = applied + timedelta(days=1) if status in ("approved", "disbursed", "closed") else None

            monthly_payment = round((amt * 0.015 * (1.015 ** term)) / ((1.015 ** term) - 1), 2)
            months_paid = months_ago if status == "disbursed" else term if status == "closed" else 0
            amount_repaid = round(monthly_payment * months_paid, 2)
            outstanding = max(0, round(amt - amount_repaid, 2))

            loan = LoanApplication(
                id=loan_id,
                application_number=f"{DEMO_LOAN_PREFIX}{str(li+1).zfill(4)}",
                member_id=member_ids[midx],
                loan_product_id=prod_id,
                amount=amt,
                term_months=term,
                interest_rate=1.5,
                total_interest=round(amt * 0.015 * term, 2),
                total_repayment=round(amt + amt * 0.015 * term, 2),
                monthly_repayment=monthly_payment,
                processing_fee=round(amt * 0.02, 2),
                status=status,
                purpose="Business expansion" if di % 2 == 0 else "Emergency medical expenses",
                disbursement_method="bank" if status in ("disbursed", "closed") else None,
                amount_disbursed=amt if status in ("disbursed", "closed") else None,
                amount_repaid=amount_repaid,
                outstanding_balance=outstanding,
                next_payment_date=date.today() + timedelta(days=15) if status == "disbursed" else None,
                last_payment_date=date.today() - timedelta(days=15) if amount_repaid > 0 else None,
                created_by_id=officer_id,
                reviewed_by_id=manager_id,
                applied_at=applied,
                approved_at=approved_at,
                disbursed_at=disbursed_at,
                closed_at=applied + timedelta(days=term * 30) if status == "closed" else None,
            )
            tdb.add(loan)
            tdb.flush()

            if status in ("disbursed", "closed") and months_paid > 0:
                for mo in range(min(months_paid, 6)):
                    tdb.add(LoanRepayment(
                        id=_uid(),
                        repayment_number=f"{DEMO_REP_PREFIX}-M{di+1}-{mo+1}",
                        loan_id=loan_id,
                        amount=monthly_payment,
                        principal_amount=round(monthly_payment * 0.7, 2),
                        interest_amount=round(monthly_payment * 0.3, 2),
                        penalty_amount=0,
                        payment_method="cash" if mo % 2 == 0 else "mpesa",
                        reference=f"DEMO-MREP-{di+1}-{mo+1}",
                        notes="Monthly repayment",
                        payment_date=disbursed_at + timedelta(days=30 * (mo + 1)),
                        received_by_id=teller_id,
                    ))
        tdb.flush()

        # Organization settings — currency and timezone
        for key, value in [("currency", "USD"), ("currency_symbol", "$"), ("timezone", "Africa/Nairobi")]:
            existing = tdb.query(OrganizationSettings).filter(OrganizationSettings.setting_key == key).first()
            if existing:
                existing.setting_value = value
            else:
                tdb.add(OrganizationSettings(setting_key=key, setting_value=value))

        tdb.commit()

    except Exception:
        tdb.rollback()
        raise
    finally:
        tdb.close()


def _table_exists(conn, table: str) -> bool:
    return conn.execute(
        text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=:t)"),
        {"t": table}
    ).scalar()


def _resolve_fk_refs(conn, parent_table: str, parent_col: str = "id"):
    return conn.execute(text(f"""
        SELECT DISTINCT tc.table_name, kcu.column_name, c.is_nullable
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
        JOIN information_schema.key_column_usage kcu2
            ON rc.unique_constraint_name = kcu2.constraint_name AND rc.unique_constraint_schema = kcu2.constraint_schema
        JOIN information_schema.columns c
            ON c.table_schema = tc.table_schema AND c.table_name = tc.table_name AND c.column_name = kcu.column_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND kcu2.table_name = '{parent_table}'
            AND kcu2.column_name = '{parent_col}'
            AND tc.table_schema = 'public'
    """)).fetchall()


def _cascade_delete(conn, table: str, where_clause: str, skip_tables=None):
    skip_tables = skip_tables or set()
    rows = conn.execute(text(f"SELECT id FROM {table} WHERE {where_clause}")).fetchall()
    if not rows:
        return
    ids = "'" + "','".join(r[0] for r in rows) + "'"
    fk_refs = _resolve_fk_refs(conn, table)
    for ref_table, ref_col, is_nullable in fk_refs:
        if ref_table in skip_tables:
            continue
        if _table_exists(conn, ref_table):
            if is_nullable == 'YES':
                conn.execute(text(f"UPDATE {ref_table} SET {ref_col} = NULL WHERE {ref_col} IN ({ids})"))
            else:
                _cascade_delete(conn, ref_table, f"{ref_col} IN ({ids})", skip_tables)
    conn.execute(text(f"DELETE FROM {table} WHERE id IN ({ids})"))


def _truncate_tenant(conn_str: str):
    """Delete only demo-specific records — safe on shared and dedicated databases."""
    from sqlalchemy import create_engine

    engine = create_engine(conn_str, pool_pre_ping=True)

    with engine.connect() as conn:
        with conn.begin():
            _cascade_delete(conn, "members", f"member_number LIKE '{DEMO_MEMBER_PREFIX}%' OR member_number LIKE 'DEMO-MOBILE-%' OR id_number = '{DEMO_MOBILE_ID_NUMBER}'")
            _cascade_delete(conn, "staff", f"staff_number LIKE '{DEMO_STAFF_PREFIX}%'")
            _cascade_delete(conn, "branches", f"code = '{DEMO_BRANCH_CODE}'")
            prod_codes = ",".join(f"'{c}'" for c in DEMO_PROD_CODES)
            _cascade_delete(conn, "loan_products", f"code IN ({prod_codes})")


@router.get("/status")
def demo_status(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    org = _get_demo_org(db)
    if not org:
        return {"exists": False, "member_count": 0, "loan_count": 0, "staff_count": 0}

    member_count = loan_count = staff_count = 0
    if org.connection_string:
        try:
            tdb = get_tenant_session(org.connection_string)
            member_count = tdb.execute(text("SELECT COUNT(*) FROM members")).scalar() or 0
            loan_count = tdb.execute(text("SELECT COUNT(*) FROM loan_applications")).scalar() or 0
            staff_count = tdb.execute(text("SELECT COUNT(*) FROM staff")).scalar() or 0
            tdb.close()
        except Exception:
            pass

    return {
        "exists": True,
        "org_id": org.id,
        "member_count": member_count,
        "loan_count": loan_count,
        "staff_count": staff_count,
    }


@router.post("/populate")
def populate_demo(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    org = _get_demo_org(db)
    if org:
        raise HTTPException(status_code=400, detail="Demo organization already exists. Use reset to refresh it.")

    conn_str = _get_connection_string()
    if not conn_str:
        raise HTTPException(status_code=500, detail="No database connection string available.")

    plan = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_active == True)
        .order_by(SubscriptionPlan.sort_order.desc(), SubscriptionPlan.max_members.desc())
        .first()
    )

    try:
        org = Organization(
            name="Demo Sacco",
            code=DEMO_CODE,
            email="demo@demosacco.com",
            phone="+1 555 000 0000",
            is_active=True,
            connection_string=conn_str,
        )
        db.add(org)
        db.flush()

        user = User(
            email=DEMO_OWNER_EMAIL,
            password=_hash(DEMO_OWNER_PASSWORD),
            first_name="Demo",
            last_name="Owner",
        )
        db.add(user)
        db.flush()

        db.add(OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            is_owner=True,
            role="owner",
        ))

        if plan:
            db.add(OrganizationSubscription(
                organization_id=org.id,
                plan_id=plan.id,
                status="active",
                trial_ends_at=None,
                current_period_start=datetime.utcnow(),
                current_period_end=datetime(2099, 12, 31),
            ))

        db.commit()

        _seed_tenant(conn_str)

        return {"success": True, "message": "Demo organization created with sample data.", "login_email": DEMO_OWNER_EMAIL, "login_password": DEMO_OWNER_PASSWORD}

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to populate demo data: {str(e)}")


@router.post("/reset")
def reset_demo(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    org = _get_demo_org(db)
    conn_str = _get_connection_string()

    if org:
        _truncate_tenant(org.connection_string or conn_str)
        _seed_tenant(org.connection_string or conn_str)
        return {"success": True, "message": "Demo data has been reset with fresh sample data."}
    else:
        return populate_demo(admin=admin, db=db)


@router.post("/clean")
def clean_demo(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    org = _get_demo_org(db)
    if not org:
        raise HTTPException(status_code=404, detail="Demo organization does not exist.")

    conn_str = org.connection_string or _get_connection_string()

    try:
        _truncate_tenant(conn_str)

        db.query(OrganizationSubscription).filter(
            OrganizationSubscription.organization_id == org.id
        ).delete()
        db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org.id
        ).delete()
        db.query(MobileDeviceRegistry).filter(
            MobileDeviceRegistry.org_id == org.id
        ).delete()

        owner = db.query(User).filter(User.email == DEMO_OWNER_EMAIL).first()
        if owner:
            db.query(UserSession).filter(UserSession.user_id == owner.id).delete()
            db.delete(owner)

        db.delete(org)
        db.commit()

        return {"success": True, "message": "Demo organization and all its data have been removed."}

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to clean demo data: {str(e)}")
