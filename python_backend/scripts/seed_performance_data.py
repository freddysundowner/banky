"""
Seed realistic staff performance dummy data for the demo org.
Run once: python3 python_backend/scripts/seed_performance_data.py
"""
import sys, random, uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

sys.path.insert(0, '/home/runner/workspace/python_backend')
from models.database import SessionLocal
from services.tenant_context import get_tenant_context_simple
from models.tenant import (
    Staff, LoanApplication, LoanRepayment,
    Transaction, Attendance, DisciplinaryRecord, Member, LoanProduct
)

ORG_ID     = "21c7e234-c868-4f7c-a40d-7079a828899b"
BRANCH_ID  = "77bd7910-ab7c-4146-b73c-c0569ecf492c"
PRODUCT_ID = "758b6374-9f50-47d6-9fdb-18d4d5d12817"

random.seed(42)

def gen_id():
    return str(uuid.uuid4())

def workdays(start: date, end: date):
    d = start
    while d <= end:
        if d.weekday() < 5:
            yield d
        d += timedelta(days=1)

db = SessionLocal()
ctx = get_tenant_context_simple(ORG_ID, db)
s = ctx.create_session()

members    = s.query(Member).filter(Member.is_active == True).limit(4).all()
member_ids = [m.id for m in members]
print(f"Members available: {[m.first_name for m in members]}")

# ── 1. Create additional staff ────────────────────────────────────────────────
new_staff_defs = [
    {"first_name": "Alice",  "last_name": "Kamau",    "role": "teller",       "staff_number": "ST02", "email": "alice@realavail.com"},
    {"first_name": "Bob",    "last_name": "Odhiambo", "role": "loan_officer", "staff_number": "ST03", "email": "bob@realavail.com"},
    {"first_name": "Carol",  "last_name": "Mutua",    "role": "reviewer",     "staff_number": "ST04", "email": "carol@realavail.com"},
    {"first_name": "Dave",   "last_name": "Njoroge",  "role": "hr",           "staff_number": "ST05", "email": "dave@realavail.com"},
    {"first_name": "Eve",    "last_name": "Wanjiku",  "role": "teller",       "staff_number": "ST06", "email": "eve@realavail.com"},
    {"first_name": "Frank",  "last_name": "Otieno",   "role": "loan_officer", "staff_number": "ST07", "email": "frank@realavail.com"},
]

print("\nCreating staff...")
for defn in new_staff_defs:
    existing = s.query(Staff).filter(Staff.email == defn["email"]).first()
    if existing:
        print(f"  {defn['first_name']} already exists — skipping.")
        continue
    st = Staff(
        id=gen_id(),
        staff_number=defn["staff_number"],
        first_name=defn["first_name"],
        last_name=defn["last_name"],
        email=defn["email"],
        role=defn["role"],
        branch_id=BRANCH_ID,
        is_active=True,
    )
    s.add(st)
    print(f"  Created: {st.first_name} {st.last_name} [{st.role}]")

s.flush()

all_staff     = s.query(Staff).filter(Staff.is_active == True).all()
loan_officers = [st for st in all_staff if st.role == "loan_officer"]
tellers       = [st for st in all_staff if st.role == "teller"]
reviewers     = [st for st in all_staff if st.role == "reviewer"]
hr_staff      = [st for st in all_staff if st.role == "hr"]
print(f"\nAll staff ({len(all_staff)}): {', '.join(f'{s.first_name} [{s.role}]' for s in all_staff)}")

# ── 2. Attendance Jan 5 – Mar 3, 2026 ────────────────────────────────────────
print("\nGenerating attendance records...")
ATT_START = date(2026, 1, 5)
ATT_END   = date(2026, 3, 3)

attendance_profiles = {
    "hr":           {"present_prob": 0.97, "late_prob": 0.03},
    "teller":       {"present_prob": 0.90, "late_prob": 0.12},
    "loan_officer": {"present_prob": 0.92, "late_prob": 0.08},
    "reviewer":     {"present_prob": 0.94, "late_prob": 0.06},
    "admin":        {"present_prob": 0.95, "late_prob": 0.04},
}

att_count = 0
for work_day in workdays(ATT_START, ATT_END):
    for st in all_staff:
        existing = s.query(Attendance).filter(
            Attendance.staff_id == st.id,
            Attendance.date == work_day
        ).first()
        if existing:
            continue

        prof = attendance_profiles.get(st.role, {"present_prob": 0.90, "late_prob": 0.08})
        roll = random.random()

        if roll > prof["present_prob"]:
            status    = "absent"
            clock_in  = None
            clock_out = None
            late_min  = 0
        elif roll < prof["present_prob"] * prof["late_prob"]:
            status    = "late"
            late_min  = random.randint(12, 50)
            base      = datetime.combine(work_day, datetime.min.time()).replace(hour=8, minute=0)
            clock_in  = base + timedelta(minutes=late_min)
            clock_out = base + timedelta(hours=9, minutes=random.randint(0, 30))
        else:
            status    = "present"
            late_min  = 0
            base      = datetime.combine(work_day, datetime.min.time()).replace(hour=7, minute=45)
            clock_in  = base + timedelta(minutes=random.randint(0, 30))
            clock_out = base + timedelta(hours=9, minutes=random.randint(0, 60))

        s.add(Attendance(
            id=gen_id(), staff_id=st.id, date=work_day,
            status=status, clock_in=clock_in, clock_out=clock_out,
            late_minutes=late_min, branch_id=BRANCH_ID,
        ))
        att_count += 1

print(f"  Added {att_count} attendance records")

# ── 3. Loan applications ──────────────────────────────────────────────────────
print("\nGenerating loan applications...")
LOAN_START = date(2026, 1, 5)
LOAN_END   = date(2026, 3, 3)

# Target volume per officer: Fredrick=12, Bob=18, Frank=8
officer_targets = {
    lo.first_name: {"Fredrick": 12, "Bob": 18, "Frank": 8}.get(lo.first_name, 10)
    for lo in loan_officers
}

loan_count = 0
used_loan_numbers = set(r[0] for r in s.query(LoanApplication.application_number).all())

for officer in loan_officers:
    target = officer_targets.get(officer.first_name, 10)
    # Give Frank a higher default rate (2 of his 8 loans defaulted)
    default_quota = 2 if officer.first_name == "Frank" else 0

    for i in range(target):
        applied_days_ago = random.randint(0, 55)
        applied_dt = datetime.combine(
            LOAN_END - timedelta(days=applied_days_ago),
            datetime.min.time()
        ).replace(hour=random.randint(8, 16), minute=random.randint(0, 59))
        if applied_dt.date() < LOAN_START:
            applied_dt = applied_dt.replace(month=LOAN_START.month, day=LOAN_START.day)

        amount     = Decimal(str(random.choice([50000, 80000, 100000, 150000, 200000])))
        reviewer   = random.choice(reviewers) if reviewers else None
        is_default = (i < default_quota)

        roll = random.random()
        if is_default:
            status = "defaulted"
        elif roll < 0.05:
            status = "pending"
        elif roll < 0.10:
            status = "rejected"
        elif roll < 0.15:
            status = "approved"
        else:
            status = "disbursed"

        disbursed_at     = (applied_dt + timedelta(days=random.randint(1, 3))) if status in ("disbursed", "defaulted") else None
        amount_disbursed = amount if status in ("disbursed", "defaulted") else None

        ln = f"LN{random.randint(100000, 999999)}"
        while ln in used_loan_numbers:
            ln = f"LN{random.randint(100000, 999999)}"
        used_loan_numbers.add(ln)

        s.add(LoanApplication(
            id=gen_id(),
            application_number=ln,
            member_id=random.choice(member_ids),
            loan_product_id=PRODUCT_ID,
            amount=amount,
            amount_disbursed=amount_disbursed,
            term_months=random.choice([12, 24, 36]),
            interest_rate=Decimal("18.00"),
            purpose=random.choice(["Business expansion", "School fees", "Asset purchase", "Working capital"]),
            status=status,
            applied_at=applied_dt,
            approved_at=(applied_dt + timedelta(days=1)) if status not in ("pending", "rejected") else None,
            disbursed_at=disbursed_at,
            created_by_id=officer.id,
            reviewed_by_id=reviewer.id if reviewer and status != "pending" else None,
            outstanding_balance=amount_disbursed * Decimal("0.65") if amount_disbursed else None,
            is_restructured=False,
            interest_deducted_upfront=False,
            collateral_deficient=False,
        ))
        loan_count += 1

print(f"  Added {loan_count} loan applications")

# ── 4. Transactions for tellers ───────────────────────────────────────────────
print("\nGenerating teller transactions...")
# Alice: high volume (65 txns), Eve: moderate (38 txns)
teller_targets = {"Alice": 65, "Eve": 38}
used_txn_numbers = set(r[0] for r in s.query(Transaction.transaction_number).all())
txn_count = 0

for teller in tellers:
    target = teller_targets.get(teller.first_name, 45)
    for _ in range(target):
        days_ago = random.randint(0, 55)
        txn_dt   = datetime.combine(LOAN_END - timedelta(days=days_ago), datetime.min.time()).replace(
            hour=random.randint(8, 17), minute=random.randint(0, 59)
        )
        if txn_dt.date() < LOAN_START:
            continue

        tn = f"TXN{random.randint(1000000, 9999999)}"
        while tn in used_txn_numbers:
            tn = f"TXN{random.randint(1000000, 9999999)}"
        used_txn_numbers.add(tn)

        s.add(Transaction(
            id=gen_id(),
            transaction_number=tn,
            member_id=random.choice(member_ids),
            transaction_type=random.choice(["deposit", "withdrawal", "savings_deposit", "savings_withdrawal"]),
            account_type=random.choice(["savings", "shares"]),
            amount=Decimal(str(random.choice([500, 1000, 2000, 5000, 10000, 20000, 50000]))),
            payment_method=random.choice(["cash", "mpesa", "bank_transfer"]),
            processed_by_id=teller.id,
            created_at=txn_dt,
        ))
        txn_count += 1

print(f"  Added {txn_count} transactions")

# ── 5. Disciplinary records ───────────────────────────────────────────────────
print("\nGenerating disciplinary records...")
hr = hr_staff[0] if hr_staff else None
disc_cases = [
    (tellers[0] if tellers else None,       "verbal_warning",  "Repeated tardiness in morning shift", False),
    (loan_officers[-1] if loan_officers else None, "written_warning", "Incomplete loan file documentation submitted for disbursement", False),
]
disc_count = 0
for subject, action, desc, resolved in disc_cases:
    if not subject:
        continue
    exists = s.query(DisciplinaryRecord).filter(
        DisciplinaryRecord.staff_id == subject.id,
        DisciplinaryRecord.action_type == action
    ).first()
    if exists:
        print(f"  Disciplinary for {subject.first_name} already exists — skipping.")
        continue
    s.add(DisciplinaryRecord(
        id=gen_id(),
        staff_id=subject.id,
        action_type=action,
        incident_date=date(2026, 2, 14),
        description=desc,
        action_taken="Counselling session conducted. Staff acknowledged the issue.",
        issued_by_id=hr.id if hr else None,
        is_resolved=resolved,
    ))
    disc_count += 1
    print(f"  Added disciplinary ({action}) for {subject.first_name}")

# ── Commit ─────────────────────────────────────────────────────────────────────
s.commit()
print("\n✓ All dummy data committed successfully.")
print(f"\nFinal counts:")
print(f"  Staff:        {s.query(Staff).filter(Staff.is_active==True).count()}")
print(f"  Loans:        {s.query(LoanApplication).count()}")
print(f"  Transactions: {s.query(Transaction).count()}")
print(f"  Attendance:   {s.query(Attendance).count()}")
print(f"  Disciplinary: {s.query(DisciplinaryRecord).count()}")

s.close(); ctx.close(); db.close()
