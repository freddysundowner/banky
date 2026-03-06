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
    LicenseKey, Session as UserSession, MobileDeviceRegistry
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

DEMO_PASSWORD = "Demo@1234"
DEMO_EMAIL_DOMAIN = "@demo.bankykit"
DEMO_MOBILE_PIN = "123456"

DEMO_ORGS = [
    {
        "code": "DEMO-MFI",
        "name": "Demo MFI",
        "institution_type": "mfi",
        "owner_email": "mfi@demo.bankykit",
        "owner_first": "MFI",
        "owner_last": "Owner",
        "org_email": "demo@demomfi.com",
        "currency": "KES",
        "currency_symbol": "KSh",
    },
    {
        "code": "DEMO-SACCO",
        "name": "Demo SACCO",
        "institution_type": "sacco",
        "owner_email": "sacco@demo.bankykit",
        "owner_first": "SACCO",
        "owner_last": "Owner",
        "org_email": "demo@demosacco.com",
        "currency": "KES",
        "currency_symbol": "KSh",
    },
    {
        "code": "DEMO-BANK",
        "name": "Demo Bank",
        "institution_type": "bank",
        "owner_email": "bank@demo.bankykit",
        "owner_first": "Bank",
        "owner_last": "Owner",
        "org_email": "demo@demobank.com",
        "currency": "KES",
        "currency_symbol": "KSh",
    },
    {
        "code": "DEMO-CHAMA",
        "name": "Demo Chama",
        "institution_type": "chama",
        "owner_email": "chama@demo.bankykit",
        "owner_first": "Chama",
        "owner_last": "Owner",
        "org_email": "demo@demochama.com",
        "currency": "KES",
        "currency_symbol": "KSh",
    },
]

DEMO_CODES = [d["code"] for d in DEMO_ORGS]
DEMO_OWNER_EMAILS = [d["owner_email"] for d in DEMO_ORGS]

LEGACY_DEMO_CODE = "DEMO"
LEGACY_DEMO_EMAIL = "demo@demo.bankykit"


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _uid() -> str:
    return str(uuid.uuid4())


def _get_connection_string() -> str:
    return os.environ.get("DATABASE_URL", "")


def _get_demo_orgs(db: Session):
    return db.query(Organization).filter(Organization.code.in_(DEMO_CODES)).all()


def _get_legacy_demo_org(db: Session):
    return db.query(Organization).filter(Organization.code == LEGACY_DEMO_CODE).first()


_PBKDF2_ITERATIONS = 260000
_PBKDF2_HASH = "sha256"


def _hash_pin(pin: str) -> str:
    salt = sec_mod.token_hex(16)
    dk = hashlib.pbkdf2_hmac(_PBKDF2_HASH, pin.encode(), salt.encode(), _PBKDF2_ITERATIONS)
    return f"{salt}:{dk.hex()}"


def _get_best_plan_for_type(db: Session, institution_type: str):
    return (
        db.query(SubscriptionPlan)
        .filter(
            SubscriptionPlan.business_type == institution_type,
            SubscriptionPlan.is_active == True,
        )
        .order_by(SubscriptionPlan.sort_order.desc(), SubscriptionPlan.max_members.desc())
        .first()
    )


def _seed_tenant(conn_str: str, org_config: dict):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(conn_str, pool_pre_ping=True)
    TenantBase.metadata.create_all(bind=engine)
    TSession = sessionmaker(bind=engine)
    tdb = TSession()

    itype = org_config["institution_type"]
    prefix = itype.upper()[:3]

    try:
        branch_id = _uid()
        branch = Branch(
            id=branch_id,
            name=f"{org_config['name']} Head Office",
            code=f"{prefix}HQ",
            address="123 Main Street, Nairobi",
            phone="+254 700 000 000",
            email=f"headoffice.{itype}{DEMO_EMAIL_DOMAIN}",
            is_active=True,
        )
        tdb.add(branch)

        manager_id = _uid()
        manager = Staff(
            id=manager_id,
            staff_number=f"{prefix}S001",
            first_name="Alice",
            last_name="Manager",
            email=f"alice.{itype}{DEMO_EMAIL_DOMAIN}",
            phone=f"+254 700 {itype[:3].upper()} 001",
            role="admin",
            branch_id=branch_id,
            password_hash=_hash(DEMO_PASSWORD),
            is_active=True,
        )
        tdb.add(manager)

        officer_id = _uid()
        officer = Staff(
            id=officer_id,
            staff_number=f"{prefix}S002",
            first_name="Bob",
            last_name="Officer",
            email=f"bob.{itype}{DEMO_EMAIL_DOMAIN}",
            phone=f"+254 700 {itype[:3].upper()} 002",
            role="loan_officer",
            branch_id=branch_id,
            password_hash=_hash(DEMO_PASSWORD),
            is_active=True,
        )
        tdb.add(officer)

        teller_id = _uid()
        teller = Staff(
            id=teller_id,
            staff_number=f"{prefix}S003",
            first_name="Carol",
            last_name="Teller",
            email=f"carol.{itype}{DEMO_EMAIL_DOMAIN}",
            phone=f"+254 700 {itype[:3].upper()} 003",
            role="teller",
            branch_id=branch_id,
            password_hash=_hash(DEMO_PASSWORD),
            is_active=True,
        )
        tdb.add(teller)

        tdb.flush()

        prod_code_1 = f"{prefix}DEV"
        prod_code_2 = f"{prefix}EMG"

        prod1_id = _uid()
        prod1 = LoanProduct(
            id=prod1_id,
            name=f"{org_config['name']} Development Loan",
            code=prod_code_1,
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
            name=f"{org_config['name']} Emergency Loan",
            code=prod_code_2,
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
                member_number=f"{prefix}M{str(idx+1).zfill(3)}",
                first_name=fn,
                last_name=ln,
                email=f"{slug}.{itype}{DEMO_EMAIL_DOMAIN}",
                phone=f"+254 710 {str(idx+1).zfill(4)}",
                id_number=f"{prefix}{str(10000 + idx + 1)}",
                id_type="national_id",
                gender="male" if fn in ("James","David","Michael","Robert","William","Charles","Joseph","Thomas") else "female",
                date_of_birth=date(1985, 6, 15),
                nationality="KE",
                address="456 Kenyatta Avenue",
                city="Nairobi",
                country="Kenya",
                employment_status="employed",
                monthly_income=75000,
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
        demo_mobile = Member(
            id=demo_mobile_id,
            member_number=f"{prefix}M016",
            first_name="Demo",
            last_name="User",
            email=f"demo.user.{itype}{DEMO_EMAIL_DOMAIN}",
            phone="+254700000000",
            id_number=f"{prefix}MOB001",
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
            savings_balance=25000,
            shares_balance=10000,
            deposits_balance=5000,
            status="active",
            is_active=True,
            mobile_banking_active=True,
            pin_hash=_hash_pin(DEMO_MOBILE_PIN),
            mobile_device_id=f"demo-device-{itype}",
            joined_at=datetime.utcnow() - timedelta(days=400),
            created_by_id=manager_id,
        )
        tdb.add(demo_mobile)
        member_ids.append(demo_mobile_id)
        member_data.append(("Demo", "User", 25000, 10000))
        tdb.flush()

        for idx, (mid, (fn, ln, savings, shares)) in enumerate(zip(member_ids, member_data)):
            tdb.add(Transaction(
                id=_uid(),
                transaction_number=f"{prefix}TXN{str(idx+1).zfill(4)}",
                member_id=mid,
                transaction_type="deposit",
                account_type="savings",
                amount=savings,
                balance_before=0,
                balance_after=savings,
                payment_method="cash",
                reference=f"{prefix}-SAV-{idx+1}",
                description="Opening savings deposit",
                processed_by_id=teller_id,
                created_at=datetime.utcnow() - timedelta(days=300),
            ))
            tdb.add(Transaction(
                id=_uid(),
                transaction_number=f"{prefix}TXN{str(idx+100).zfill(4)}",
                member_id=mid,
                transaction_type="deposit",
                account_type="shares",
                amount=shares,
                balance_before=0,
                balance_after=shares,
                payment_method="cash",
                reference=f"{prefix}-SHR-{idx+1}",
                description="Opening shares purchase",
                processed_by_id=teller_id,
                created_at=datetime.utcnow() - timedelta(days=300),
            ))

        tdb.flush()

        loan_scenarios = [
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
                application_number=f"{prefix}LN{str(i+1).zfill(4)}",
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
                        repayment_number=f"{prefix}REP-{i+1}-{mo+1}",
                        loan_id=loan_id,
                        amount=monthly_payment,
                        principal_amount=round(monthly_payment * 0.7, 2),
                        interest_amount=round(monthly_payment * 0.3, 2),
                        penalty_amount=0,
                        payment_method="cash",
                        reference=f"{prefix}-REF-{i+1}-{mo+1}",
                        notes="Monthly repayment",
                        payment_date=disbursed_at + timedelta(days=30 * (mo + 1)),
                        received_by_id=teller_id,
                    ))

        tdb.flush()

        currency = org_config.get("currency", "KES")
        currency_symbol = org_config.get("currency_symbol", "KSh")
        for key, value in [("currency", currency), ("currency_symbol", currency_symbol), ("timezone", "Africa/Nairobi")]:
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


def _truncate_tenant(conn_str: str, prefixes: list[str]):
    from sqlalchemy import create_engine

    engine = create_engine(conn_str, pool_pre_ping=True)

    with engine.connect() as conn:
        with conn.begin():
            for prefix in prefixes:
                if _table_exists(conn, "members"):
                    _cascade_delete(conn, "members", f"member_number LIKE '{prefix}M%' OR id_number LIKE '{prefix}%'")
                if _table_exists(conn, "staff"):
                    _cascade_delete(conn, "staff", f"staff_number LIKE '{prefix}S%'")
                if _table_exists(conn, "branches"):
                    _cascade_delete(conn, "branches", f"code = '{prefix}HQ'")
                if _table_exists(conn, "loan_products"):
                    _cascade_delete(conn, "loan_products", f"code LIKE '{prefix}%'")


def _truncate_legacy_tenant(conn_str: str):
    from sqlalchemy import create_engine

    engine = create_engine(conn_str, pool_pre_ping=True)

    with engine.connect() as conn:
        with conn.begin():
            old_prefixes = ["DMS", "DMB", "DEMO"]
            for tbl, col, patterns in [
                ("members", "member_number", ["DMB%"]),
                ("members", "id_number", ["DEMO%"]),
                ("staff", "staff_number", ["DMS%"]),
                ("branches", "code", ["DEMO"]),
                ("loan_products", "code", ["DDEV", "DEMG"]),
            ]:
                if _table_exists(conn, tbl):
                    for pat in patterns:
                        if "%" in pat:
                            _cascade_delete(conn, tbl, f"{col} LIKE '{pat}'")
                        else:
                            _cascade_delete(conn, tbl, f"{col} = '{pat}'")


@router.get("/status")
def demo_status(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    orgs = _get_demo_orgs(db)
    if not orgs:
        return {"exists": False, "orgs": [], "member_count": 0, "loan_count": 0, "staff_count": 0}

    total_members = 0
    total_loans = 0
    total_staff = 0
    org_list = []

    for org in orgs:
        m_count = l_count = s_count = 0
        if org.connection_string:
            try:
                tdb = get_tenant_session(org.connection_string)
                prefix = org.institution_type.upper()[:3] if org.institution_type else "DEM"
                m_count = tdb.execute(text(f"SELECT COUNT(*) FROM members WHERE member_number LIKE '{prefix}M%'")).scalar() or 0
                l_count = tdb.execute(text(f"SELECT COUNT(*) FROM loan_applications WHERE application_number LIKE '{prefix}LN%'")).scalar() or 0
                s_count = tdb.execute(text(f"SELECT COUNT(*) FROM staff WHERE staff_number LIKE '{prefix}S%'")).scalar() or 0
                tdb.close()
            except Exception:
                pass
        total_members += m_count
        total_loans += l_count
        total_staff += s_count
        org_list.append({
            "org_id": org.id,
            "code": org.code,
            "name": org.name,
            "institution_type": org.institution_type,
            "member_count": m_count,
            "loan_count": l_count,
            "staff_count": s_count,
        })

    return {
        "exists": True,
        "orgs": org_list,
        "member_count": total_members,
        "loan_count": total_loans,
        "staff_count": total_staff,
    }


@router.post("/populate")
def populate_demo(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    existing = _get_demo_orgs(db)
    if existing:
        raise HTTPException(status_code=400, detail="Demo organizations already exist. Use reset to refresh them.")

    conn_str = _get_connection_string()
    if not conn_str:
        raise HTTPException(status_code=500, detail="No database connection string available.")

    _clean_legacy(db)

    try:
        created = []
        for org_config in DEMO_ORGS:
            plan = _get_best_plan_for_type(db, org_config["institution_type"])

            org = Organization(
                name=org_config["name"],
                code=org_config["code"],
                email=org_config["org_email"],
                phone="+254 700 000 000",
                institution_type=org_config["institution_type"],
                is_active=True,
                connection_string=conn_str,
            )
            db.add(org)
            db.flush()

            user = User(
                email=org_config["owner_email"],
                password=_hash(DEMO_PASSWORD),
                first_name=org_config["owner_first"],
                last_name=org_config["owner_last"],
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

            # Generate and assign a demo license key for this org
            # Map SaaS plan_type to the corresponding enterprise plan_type
            from services.feature_flags import generate_license_key
            saas_plan_type = plan.plan_type if plan else None
            if saas_plan_type and not saas_plan_type.endswith("_licence"):
                enterprise_plan_type = saas_plan_type + "_licence"
            elif saas_plan_type:
                enterprise_plan_type = saas_plan_type
            else:
                enterprise_plan_type = org_config["institution_type"] + "_small_licence"
            demo_license_key = generate_license_key(
                enterprise_plan_type,
                org_config["name"],
                perpetual=False,
            )
            db.add(LicenseKey(
                license_key=demo_license_key,
                edition=enterprise_plan_type,
                organization_name=org_config["name"],
                organization_id=org.id,
                features={},
                expires_at=datetime(2099, 12, 31),
                is_active=True,
                notes="Auto-generated demo license",
            ))

            db.flush()
            created.append(org_config["institution_type"])

        db.commit()

        for org_config in DEMO_ORGS:
            _seed_tenant(conn_str, org_config)

        return {
            "success": True,
            "message": f"Created {len(created)} demo organizations: {', '.join(created)}.",
            "orgs": [{"type": c["institution_type"], "email": c["owner_email"]} for c in DEMO_ORGS],
            "password": DEMO_PASSWORD,
        }

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to populate demo data: {str(e)}")


@router.post("/reset")
def reset_demo(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    orgs = _get_demo_orgs(db)
    conn_str = _get_connection_string()

    if orgs:
        prefixes = []
        for org in orgs:
            prefix = org.institution_type.upper()[:3] if org.institution_type else "DEM"
            prefixes.append(prefix)
        actual_conn = orgs[0].connection_string or conn_str
        _truncate_tenant(actual_conn, prefixes)
        for org_config in DEMO_ORGS:
            _seed_tenant(actual_conn, org_config)
        return {"success": True, "message": "Demo data has been reset with fresh sample data."}
    else:
        return populate_demo(admin=admin, db=db)


def _clean_legacy(db: Session):
    legacy = _get_legacy_demo_org(db)
    if not legacy:
        return

    conn_str = legacy.connection_string or _get_connection_string()
    try:
        _truncate_legacy_tenant(conn_str)
    except Exception:
        pass

    db.query(LicenseKey).filter(
        LicenseKey.organization_id == legacy.id
    ).delete()
    db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == legacy.id
    ).delete()
    db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == legacy.id
    ).delete()
    try:
        db.query(MobileDeviceRegistry).filter(
            MobileDeviceRegistry.org_id == legacy.id
        ).delete()
    except Exception:
        pass

    legacy_owner = db.query(User).filter(User.email == LEGACY_DEMO_EMAIL).first()
    if legacy_owner:
        db.query(UserSession).filter(UserSession.user_id == legacy_owner.id).delete()
        db.delete(legacy_owner)

    db.delete(legacy)
    db.flush()


@router.post("/clean")
def clean_demo(admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    orgs = _get_demo_orgs(db)
    if not orgs:
        raise HTTPException(status_code=404, detail="Demo organizations do not exist.")

    conn_str = _get_connection_string()

    try:
        prefixes = []
        actual_conn = conn_str
        for org in orgs:
            prefix = org.institution_type.upper()[:3] if org.institution_type else "DEM"
            prefixes.append(prefix)
            if org.connection_string:
                actual_conn = org.connection_string

        _truncate_tenant(actual_conn, prefixes)

        for org in orgs:
            db.query(LicenseKey).filter(
                LicenseKey.organization_id == org.id
            ).delete()
            db.query(OrganizationSubscription).filter(
                OrganizationSubscription.organization_id == org.id
            ).delete()
            db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id
            ).delete()
            try:
                db.query(MobileDeviceRegistry).filter(
                    MobileDeviceRegistry.org_id == org.id
                ).delete()
            except Exception:
                pass
            db.delete(org)

        for email in DEMO_OWNER_EMAILS:
            owner = db.query(User).filter(User.email == email).first()
            if owner:
                db.query(UserSession).filter(UserSession.user_id == owner.id).delete()
                db.delete(owner)

        _clean_legacy(db)

        db.commit()

        return {"success": True, "message": "All demo organizations and their data have been removed."}

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to clean demo data: {str(e)}")
