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
    Session as UserSession
)
from models.tenant import (
    TenantBase, Branch, Staff, Member, LoanProduct, LoanApplication,
    LoanRepayment, Transaction
)
from routes.admin import require_admin
from models.master import AdminUser

router = APIRouter(prefix="/admin/demo-data", tags=["admin"])

DEMO_CODE = "DEMO"
DEMO_OWNER_EMAIL = "demo@demo.banky"
DEMO_OWNER_PASSWORD = "Demo@1234"


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _uid() -> str:
    return str(uuid.uuid4())


def _get_demo_org(db: Session):
    return db.query(Organization).filter(Organization.code == DEMO_CODE).first()


def _get_connection_string() -> str:
    return os.environ.get("DATABASE_URL", "")


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
            name="Head Office",
            code="HO",
            address="123 Main Street",
            phone="+1 555 000 0000",
            email="headoffice@demosacco.com",
            is_active=True,
        )
        tdb.add(branch)

        # Staff
        manager_id = _uid()
        manager = Staff(
            id=manager_id,
            staff_number="STF001",
            first_name="Alice",
            last_name="Manager",
            email="alice@demosacco.com",
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
            staff_number="STF002",
            first_name="Bob",
            last_name="Officer",
            email="bob@demosacco.com",
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
            staff_number="STF003",
            first_name="Carol",
            last_name="Teller",
            email="carol@demosacco.com",
            phone="+1 555 000 0003",
            role="teller",
            branch_id=branch_id,
            password_hash=_hash("Demo@1234"),
            is_active=True,
        )
        tdb.add(teller)

        tdb.flush()

        # Loan Products
        prod1_id = _uid()
        prod1 = LoanProduct(
            id=prod1_id,
            name="Development Loan",
            code="DEV",
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
            name="Emergency Loan",
            code="EMG",
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
            ("MEM001", "James",   "Anderson",  "james.anderson@email.com",  "+1 555 100 0001", 12000, 5000),
            ("MEM002", "Sarah",   "Mitchell",  "sarah.mitchell@email.com",  "+1 555 100 0002",  8500, 3200),
            ("MEM003", "David",   "Thompson",  "david.thompson@email.com",  "+1 555 100 0003", 15000, 7500),
            ("MEM004", "Emily",   "Roberts",   "emily.roberts@email.com",   "+1 555 100 0004",  6200, 2100),
            ("MEM005", "Michael", "Harris",    "michael.harris@email.com",  "+1 555 100 0005", 22000, 9800),
            ("MEM006", "Lisa",    "Clark",     "lisa.clark@email.com",      "+1 555 100 0006",  4800, 1800),
            ("MEM007", "Robert",  "Lewis",     "robert.lewis@email.com",    "+1 555 100 0007", 18500, 6400),
            ("MEM008", "Karen",   "Walker",    "karen.walker@email.com",    "+1 555 100 0008",  9300, 3700),
            ("MEM009", "William", "Hall",      "william.hall@email.com",    "+1 555 100 0009", 31000, 12000),
            ("MEM010", "Nancy",   "Young",     "nancy.young@email.com",     "+1 555 100 0010",  7100, 2900),
            ("MEM011", "Charles", "King",      "charles.king@email.com",    "+1 555 100 0011", 25500, 10500),
            ("MEM012", "Betty",   "Wright",    "betty.wright@email.com",    "+1 555 100 0012",  5600, 2400),
            ("MEM013", "Joseph",  "Scott",     "joseph.scott@email.com",    "+1 555 100 0013", 19200, 8100),
            ("MEM014", "Sandra",  "Green",     "sandra.green@email.com",    "+1 555 100 0014",  3900, 1600),
            ("MEM015", "Thomas",  "Adams",     "thomas.adams@email.com",    "+1 555 100 0015", 42000, 17000),
        ]

        member_ids = []
        for num, fn, ln, email, phone, savings, shares in member_data:
            mid = _uid()
            member_ids.append(mid)
            m = Member(
                id=mid,
                member_number=num,
                first_name=fn,
                last_name=ln,
                email=email,
                phone=phone,
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

        # Transactions — savings deposits for each member
        for idx, (mid, savings, shares) in enumerate(
            zip(member_ids, [r[5] for r in member_data], [r[6] for r in member_data])
        ):
            txn = Transaction(
                id=_uid(),
                transaction_number=f"TXN{str(idx+1).zfill(4)}",
                member_id=mid,
                transaction_type="deposit",
                account_type="savings",
                amount=savings,
                balance_before=0,
                balance_after=savings,
                payment_method="cash",
                reference=f"OPENING-SAV-{idx+1}",
                description="Opening savings deposit",
                processed_by_id=teller_id,
                created_at=datetime.utcnow() - timedelta(days=300),
            )
            tdb.add(txn)
            txn2 = Transaction(
                id=_uid(),
                transaction_number=f"TXN{str(idx+100).zfill(4)}",
                member_id=mid,
                transaction_type="deposit",
                account_type="shares",
                amount=shares,
                balance_before=0,
                balance_after=shares,
                payment_method="cash",
                reference=f"OPENING-SHR-{idx+1}",
                description="Opening shares purchase",
                processed_by_id=teller_id,
                created_at=datetime.utcnow() - timedelta(days=300),
            )
            tdb.add(txn2)

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
                application_number=f"LN{str(i+1).zfill(4)}",
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

            # Repayments for disbursed/closed loans
            if status in ("disbursed", "closed") and months_paid > 0:
                for mo in range(min(months_paid, 6)):
                    rep = LoanRepayment(
                        id=_uid(),
                        repayment_number=f"REP-LN{i+1}-{mo+1}",
                        loan_id=loan_id,
                        amount=monthly_payment,
                        principal_amount=round(monthly_payment * 0.7, 2),
                        interest_amount=round(monthly_payment * 0.3, 2),
                        penalty_amount=0,
                        payment_method="cash",
                        reference=f"REF-{i+1}-{mo+1}",
                        notes="Monthly repayment",
                        payment_date=disbursed_at + timedelta(days=30 * (mo + 1)),
                        received_by_id=teller_id,
                    )
                    tdb.add(rep)

        tdb.commit()

    except Exception:
        tdb.rollback()
        raise
    finally:
        tdb.close()


def _truncate_tenant(conn_str: str):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(conn_str, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    tdb = Session()
    try:
        tables = [
            "loan_repayments", "loan_instalments", "loan_extra_charges",
            "loan_guarantors", "loan_applications",
            "transactions", "fixed_deposits", "dividends",
            "sms_notifications", "audit_logs", "expenses",
            "journal_lines", "journal_entries", "chart_of_accounts",
            "performance_reviews", "staff_documents", "staff_sessions",
            "members", "staff", "branches",
            "loan_products", "organization_settings",
        ]
        for t in tables:
            try:
                tdb.execute(text(f"DELETE FROM {t}"))
            except Exception:
                tdb.rollback()
        tdb.commit()
    finally:
        tdb.close()


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
