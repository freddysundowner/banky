"""
Real Loan Lifecycle Verification Script

Tests loan calculations against the LIVE API with real data:
- Creates members, loan products
- Applies for loans (flat, reducing balance, upfront interest)
- Verifies all fee calculations
- Approves, disburses, and checks instalment schedules
- Makes repayments and verifies balance tracking
- Restructures loans and verifies recalculations
- Validates every number against manual calculations

Run: python -m pytest python_backend/tests/test_real_loan_lifecycle.py -v -s
"""

import requests
import json
import math
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime

BASE_URL = "http://localhost:8000"
ORG_ID = "bee869c2-9a96-411a-9e71-4faee5471e58"
BRANCH_ID = "c931d693-22ed-40a3-951b-8ecc538f3176"
AUTH_COOKIE = {"session_token": "master:vkisBCq-YX0WMII6_0pB-OKcWmdzJXkjhBFcNxNy8XA"}

PASS = "\033[92m✓ PASS\033[0m"
FAIL = "\033[91m✗ FAIL\033[0m"
INFO = "\033[94mℹ\033[0m"

created_ids = {
    "members": [],
    "loan_products": [],
    "loans": [],
}


def api(method, path, data=None, params=None):
    url = f"{BASE_URL}/api/organizations/{ORG_ID}{path}"
    r = getattr(requests, method)(url, json=data, params=params, cookies=AUTH_COOKIE, timeout=30)
    return r


def check(label, actual, expected, tolerance=0.01):
    actual_f = float(actual) if actual is not None else 0
    expected_f = float(expected)
    diff = abs(actual_f - expected_f)
    ok = diff <= tolerance
    status = PASS if ok else FAIL
    if ok:
        print(f"  {status} {label}: {actual_f:.2f} (expected {expected_f:.2f})")
    else:
        print(f"  {status} {label}: {actual_f:.2f} != expected {expected_f:.2f} (diff={diff:.4f})")
    return ok


def check_eq(label, actual, expected):
    ok = actual == expected
    status = PASS if ok else FAIL
    print(f"  {status} {label}: {actual} (expected {expected})")
    return ok


def calc_flat(amount, rate, term):
    periodic_rate = Decimal(str(rate)) / Decimal("100")
    total_interest = Decimal(str(amount)) * periodic_rate * Decimal(str(term))
    total_repayment = Decimal(str(amount)) + total_interest
    monthly = total_repayment / Decimal(str(term))
    return {
        "total_interest": float(round(total_interest, 2)),
        "total_repayment": float(round(total_repayment, 2)),
        "monthly_repayment": float(round(monthly, 2)),
    }


def calc_reducing(amount, rate, term):
    amt = Decimal(str(amount))
    r = Decimal(str(rate)) / Decimal("100")
    t = int(term)
    if r > 0:
        monthly = amt * (r * (1 + r) ** t) / ((1 + r) ** t - 1)
    else:
        monthly = amt / t
    total_repayment = monthly * t
    total_interest = total_repayment - amt
    return {
        "total_interest": float(round(total_interest, 2)),
        "total_repayment": float(round(total_repayment, 2)),
        "monthly_repayment": float(round(monthly, 2)),
    }


def calc_fees(amount, processing_pct, insurance_pct, appraisal_pct, excise_pct):
    amt = Decimal(str(amount))
    proc = amt * Decimal(str(processing_pct)) / Decimal("100")
    ins = amt * Decimal(str(insurance_pct)) / Decimal("100")
    app = amt * Decimal(str(appraisal_pct)) / Decimal("100")
    base_fees = proc + ins + app
    excise = base_fees * Decimal(str(excise_pct)) / Decimal("100")
    total = base_fees + excise
    return {
        "processing_fee": float(round(proc, 2)),
        "insurance_fee": float(round(ins, 2)),
        "appraisal_fee": float(round(app, 2)),
        "excise_duty": float(round(excise, 2)),
        "total_fees": float(round(total, 2)),
    }


import time as _time
_RUN_SUFFIX = str(int(_time.time()))[-6:]

results_summary = {"passed": 0, "failed": 0, "tests": []}


def record(test_name, passed):
    results_summary["tests"].append({"name": test_name, "passed": passed})
    if passed:
        results_summary["passed"] += 1
    else:
        results_summary["failed"] += 1


class TestRealLoanLifecycle:

    def test_01_create_members(self):
        print("\n" + "=" * 70)
        print("STEP 1: Creating test members")
        print("=" * 70)

        members_data = [
            {
                "first_name": "Alice",
                "last_name": "Wanjiku",
                "email": f"alice.{_RUN_SUFFIX}@test.com",
                "phone": "+254715363474",
                "id_number": f"3{_RUN_SUFFIX}01",
                "gender": "female",
                "branch_id": BRANCH_ID,
                "savings_balance": 50000,
                "shares_balance": 20000,
            },
            {
                "first_name": "Bob",
                "last_name": "Ochieng",
                "email": f"bob.{_RUN_SUFFIX}@test.com",
                "phone": "+254715363474",
                "id_number": f"3{_RUN_SUFFIX}02",
                "gender": "male",
                "branch_id": BRANCH_ID,
                "savings_balance": 100000,
                "shares_balance": 5000,
            },
            {
                "first_name": "Carol",
                "last_name": "Muthoni",
                "email": f"carol.{_RUN_SUFFIX}@test.com",
                "phone": "+254715363474",
                "id_number": f"3{_RUN_SUFFIX}03",
                "gender": "female",
                "branch_id": BRANCH_ID,
                "savings_balance": 30000,
                "shares_balance": 10000,
            },
        ]

        all_ok = True
        for m in members_data:
            r = api("post", "/members", m)
            if r.status_code == 201 or r.status_code == 200:
                member = r.json()
                created_ids["members"].append(member["id"])
                print(f"  {PASS} Created member: {member['first_name']} {member['last_name']} (ID: {member['id']}, Member#: {member.get('member_number', '?')})")
            else:
                print(f"  {FAIL} Failed to create {m['first_name']}: {r.status_code} - {r.text[:200]}")
                all_ok = False

        assert len(created_ids["members"]) >= 3, "Need at least 3 members"
        record("create_members", all_ok)

    def test_02_create_loan_products(self):
        print("\n" + "=" * 70)
        print("STEP 2: Creating loan products with different configurations")
        print("=" * 70)

        products = [
            {
                "name": f"Flat Rate Standard Loan {_RUN_SUFFIX}",
                "description": "Standard flat rate loan for calculation verification",
                "interest_rate": 10,
                "interest_type": "flat",
                "repayment_frequency": "monthly",
                "min_amount": 5000,
                "max_amount": 500000,
                "min_term_months": 1,
                "max_term_months": 36,
                "processing_fee": 3,
                "insurance_fee": 1,
                "appraisal_fee": 0.5,
                "excise_duty_rate": 20,
                "requires_guarantor": False,
            },
            {
                "name": f"Reducing Balance Premium Loan {_RUN_SUFFIX}",
                "description": "Reducing balance with credit life insurance",
                "interest_rate": 12,
                "interest_type": "reducing_balance",
                "repayment_frequency": "monthly",
                "min_amount": 10000,
                "max_amount": 1000000,
                "min_term_months": 3,
                "max_term_months": 48,
                "processing_fee": 2,
                "insurance_fee": 1.5,
                "appraisal_fee": 1,
                "excise_duty_rate": 20,
                "credit_life_insurance_rate": 0.5,
                "credit_life_insurance_freq": "annual",
                "requires_guarantor": False,
            },
            {
                "name": f"Upfront Interest Loan {_RUN_SUFFIX}",
                "description": "Interest deducted at disbursement",
                "interest_rate": 8,
                "interest_type": "flat",
                "repayment_frequency": "monthly",
                "min_amount": 5000,
                "max_amount": 200000,
                "min_term_months": 1,
                "max_term_months": 24,
                "processing_fee": 2,
                "insurance_fee": 0,
                "appraisal_fee": 0,
                "excise_duty_rate": 20,
                "deduct_interest_upfront": True,
                "requires_guarantor": False,
            },
            {
                "name": f"Shares-Based Loan {_RUN_SUFFIX}",
                "description": "Loan limited by member shares balance",
                "interest_rate": 10,
                "interest_type": "reducing_balance",
                "repayment_frequency": "monthly",
                "min_amount": 5000,
                "max_amount": 500000,
                "min_term_months": 1,
                "max_term_months": 24,
                "processing_fee": 1,
                "insurance_fee": 0,
                "appraisal_fee": 0,
                "excise_duty_rate": 0,
                "shares_multiplier": 3,
                "min_shares_required": 10000,
                "requires_guarantor": False,
            },
        ]

        all_ok = True
        for p in products:
            r = api("post", "/loan-products", p)
            if r.status_code in (200, 201):
                prod = r.json()
                created_ids["loan_products"].append(prod["id"])
                print(f"  {PASS} Created: {prod['name']} (Code: {prod.get('code', '?')}, ID: {prod['id']})")
            else:
                print(f"  {FAIL} Failed to create {p['name']}: {r.status_code} - {r.text[:200]}")
                all_ok = False

        assert len(created_ids["loan_products"]) >= 4, "Need 4 loan products"
        record("create_loan_products", all_ok)

    def test_03_flat_rate_loan_creation_and_calculations(self):
        print("\n" + "=" * 70)
        print("STEP 3: FLAT RATE LOAN - Apply and verify calculations")
        print("=" * 70)

        amount = 100000
        term = 12
        rate = 10
        proc_pct, ins_pct, app_pct, excise_pct = 3, 1, 0.5, 20

        expected_calc = calc_flat(amount, rate, term)
        expected_fees = calc_fees(amount, proc_pct, ins_pct, app_pct, excise_pct)

        print(f"\n  {INFO} Loan: KES {amount:,} at {rate}% flat for {term} months")
        print(f"  {INFO} Expected interest: {expected_calc['total_interest']:,.2f}")
        print(f"  {INFO} Expected total repayment: {expected_calc['total_repayment']:,.2f}")
        print(f"  {INFO} Expected monthly payment: {expected_calc['monthly_repayment']:,.2f}")
        print(f"  {INFO} Expected fees: proc={expected_fees['processing_fee']:,.2f} ins={expected_fees['insurance_fee']:,.2f} app={expected_fees['appraisal_fee']:,.2f} excise={expected_fees['excise_duty']:,.2f} total={expected_fees['total_fees']:,.2f}")
        print()

        loan_data = {
            "member_id": created_ids["members"][0],
            "loan_product_id": created_ids["loan_products"][0],
            "amount": amount,
            "term_months": term,
            "purpose": "Flat rate calc verification",
            "disbursement_method": "cash",
        }
        r = api("post", "/loan-applications", loan_data)
        assert r.status_code in (200, 201), f"Failed to create loan: {r.status_code} - {r.text[:300]}"

        loan = r.json()
        created_ids["loans"].append(loan["id"])
        print(f"  {INFO} Loan created: {loan['application_number']} (ID: {loan['id']})")
        print(f"  {INFO} Status: {loan['status']}")
        print()

        all_ok = True
        all_ok &= check("Total Interest", loan["total_interest"], expected_calc["total_interest"])
        all_ok &= check("Total Repayment", loan["total_repayment"], expected_calc["total_repayment"])
        all_ok &= check("Monthly Payment", loan["monthly_repayment"], expected_calc["monthly_repayment"])
        all_ok &= check("Processing Fee", loan["processing_fee"], expected_fees["processing_fee"])
        all_ok &= check("Insurance Fee", loan["insurance_fee"], expected_fees["insurance_fee"])
        all_ok &= check("Appraisal Fee", loan["appraisal_fee"], expected_fees["appraisal_fee"])
        all_ok &= check("Excise Duty", loan["excise_duty"], expected_fees["excise_duty"])
        all_ok &= check("Total Fees", loan["total_fees"], expected_fees["total_fees"])
        all_ok &= check_eq("Status", loan["status"], "pending")

        print(f"\n  --- Manual verification ---")
        print(f"  Interest = {amount} x ({rate}/100) x {term} = {amount * rate / 100 * term:,.2f}")
        print(f"  Total = {amount} + {amount * rate / 100 * term:,.0f} = {amount + amount * rate / 100 * term:,.2f}")
        print(f"  Monthly = {amount + amount * rate / 100 * term:,.0f} / {term} = {(amount + amount * rate / 100 * term) / term:,.2f}")
        proc_val = amount * proc_pct / 100
        ins_val = amount * ins_pct / 100
        app_val = amount * app_pct / 100
        base = proc_val + ins_val + app_val
        excise_val = base * excise_pct / 100
        print(f"  Fees: {proc_val:,.0f} + {ins_val:,.0f} + {app_val:,.0f} = {base:,.0f} base, excise = {base:,.0f} x {excise_pct}% = {excise_val:,.0f}, total = {base + excise_val:,.0f}")

        assert all_ok, "Flat rate calculations failed"
        record("flat_rate_creation_calcs", all_ok)

    def test_04_reducing_balance_loan_creation(self):
        print("\n" + "=" * 70)
        print("STEP 4: REDUCING BALANCE LOAN - Apply and verify calculations")
        print("=" * 70)

        amount = 200000
        term = 24
        rate = 12
        proc_pct, ins_pct, app_pct, excise_pct = 2, 1.5, 1, 20

        expected_calc = calc_reducing(amount, rate, term)
        expected_fees = calc_fees(amount, proc_pct, ins_pct, app_pct, excise_pct)

        print(f"\n  {INFO} Loan: KES {amount:,} at {rate}% reducing for {term} months")
        print(f"  {INFO} Expected monthly (PMT): {expected_calc['monthly_repayment']:,.2f}")
        print(f"  {INFO} Expected total interest: {expected_calc['total_interest']:,.2f}")
        print()

        loan_data = {
            "member_id": created_ids["members"][0],
            "loan_product_id": created_ids["loan_products"][1],
            "amount": amount,
            "term_months": term,
            "purpose": "Reducing balance calc verification",
            "disbursement_method": "cash",
        }
        r = api("post", "/loan-applications", loan_data)
        assert r.status_code in (200, 201), f"Failed: {r.status_code} - {r.text[:300]}"

        loan = r.json()
        created_ids["loans"].append(loan["id"])

        all_ok = True
        all_ok &= check("Monthly (PMT)", loan["monthly_repayment"], expected_calc["monthly_repayment"])
        all_ok &= check("Total Interest", loan["total_interest"], expected_calc["total_interest"])
        all_ok &= check("Total Repayment", loan["total_repayment"], expected_calc["total_repayment"])
        all_ok &= check("Processing Fee", loan["processing_fee"], expected_fees["processing_fee"])
        all_ok &= check("Total Fees", loan["total_fees"], expected_fees["total_fees"])

        r_val = Decimal("12") / Decimal("100")
        pmt = float(Decimal("200000") * (r_val * (1 + r_val) ** 24) / ((1 + r_val) ** 24 - 1))
        print(f"\n  --- Manual PMT verification ---")
        print(f"  r = {rate}/100 = {float(r_val)}")
        print(f"  PMT = {amount} x ({float(r_val)} x (1+{float(r_val)})^{term}) / ((1+{float(r_val)})^{term} - 1)")
        print(f"  PMT = {pmt:,.2f}")

        assert all_ok, "Reducing balance calculations failed"
        record("reducing_balance_creation_calcs", all_ok)

    def test_05_upfront_interest_loan_creation(self):
        print("\n" + "=" * 70)
        print("STEP 5: UPFRONT INTEREST LOAN - Apply and verify calculations")
        print("=" * 70)

        amount = 50000
        term = 6
        rate = 8
        proc_pct, ins_pct, app_pct, excise_pct = 2, 0, 0, 20

        expected_calc = calc_flat(amount, rate, term)
        expected_fees = calc_fees(amount, proc_pct, ins_pct, app_pct, excise_pct)

        print(f"\n  {INFO} Loan: KES {amount:,} at {rate}% flat (upfront) for {term} months")
        print(f"  {INFO} Interest to deduct upfront: {expected_calc['total_interest']:,.2f}")
        print(f"  {INFO} Fees to deduct: {expected_fees['total_fees']:,.2f}")
        total_deductions = expected_calc["total_interest"] + expected_fees["total_fees"]
        net = amount - total_deductions
        print(f"  {INFO} Expected net disbursement: {amount:,} - {total_deductions:,.2f} = {net:,.2f}")
        print()

        loan_data = {
            "member_id": created_ids["members"][1],
            "loan_product_id": created_ids["loan_products"][2],
            "amount": amount,
            "term_months": term,
            "purpose": "Upfront interest calc verification",
            "disbursement_method": "cash",
        }
        r = api("post", "/loan-applications", loan_data)
        assert r.status_code in (200, 201), f"Failed: {r.status_code} - {r.text[:300]}"

        loan = r.json()
        created_ids["loans"].append(loan["id"])

        all_ok = True
        all_ok &= check("Total Interest", loan["total_interest"], expected_calc["total_interest"])
        all_ok &= check("Total Fees", loan["total_fees"], expected_fees["total_fees"])
        all_ok &= check_eq("Status", loan["status"], "pending")

        assert all_ok, "Upfront interest calculations failed"
        record("upfront_interest_creation_calcs", all_ok)

    def test_06_shares_eligibility_check(self):
        print("\n" + "=" * 70)
        print("STEP 6: SHARES-BASED ELIGIBILITY - Verify share limits at disbursement")
        print("=" * 70)

        member_r = api("get", f"/members/{created_ids['members'][1]}")
        member = member_r.json()
        shares = float(member.get("shares_balance", 0))
        multiplier = 3
        max_eligible = shares * multiplier
        print(f"  {INFO} Member Bob shares: KES {shares:,.2f}")
        print(f"  {INFO} Max eligible (shares x {multiplier}): KES {max_eligible:,.2f}")

        amount_over = max_eligible + 10000
        loan_data = {
            "member_id": created_ids["members"][1],
            "loan_product_id": created_ids["loan_products"][3],
            "amount": amount_over,
            "term_months": 12,
            "purpose": "Should be blocked at disbursement - exceeds share limit",
            "disbursement_method": "cash",
        }
        r = api("post", "/loan-applications", loan_data)
        print(f"\n  Creating loan for KES {amount_over:,.0f} (over limit):")
        all_ok = True
        if r.status_code in (200, 201):
            over_loan = r.json()
            print(f"  {INFO} Loan created (warning only at application): {over_loan['application_number']}")

            r_approve = api("post", f"/loan-applications/{over_loan['id']}/approve")
            if r_approve.status_code == 200:
                print(f"  {INFO} Loan approved")

                r_disburse = api("post", f"/loans/{over_loan['id']}/disburse", {"disbursement_method": "cash"})
                block_ok = r_disburse.status_code == 400
                detail = r_disburse.json().get("detail", "") if r_disburse.status_code == 400 else ""
                print(f"  {'✓ PASS' if block_ok else '✗ FAIL'} Disbursement blocked: {r_disburse.status_code} - {detail[:100]}")
                all_ok &= block_ok
            else:
                print(f"  {FAIL} Approve failed: {r_approve.status_code}")
                all_ok = False
        else:
            print(f"  {INFO} Loan creation response: {r.status_code} - {r.text[:200]}")

        amount_ok = max_eligible - 1000
        if amount_ok >= 5000:
            loan_data2 = {
                "member_id": created_ids["members"][1],
                "loan_product_id": created_ids["loan_products"][3],
                "amount": amount_ok,
                "term_months": 12,
                "purpose": "Should succeed - within share limit",
                "disbursement_method": "cash",
            }
            r2 = api("post", "/loan-applications", loan_data2)
            if r2.status_code in (200, 201):
                ok_loan = r2.json()
                r_approve2 = api("post", f"/loan-applications/{ok_loan['id']}/approve")
                if r_approve2.status_code == 200:
                    r_disburse2 = api("post", f"/loans/{ok_loan['id']}/disburse", {"disbursement_method": "cash"})
                    allow_ok = r_disburse2.status_code == 200
                    print(f"  Requesting KES {amount_ok:,.0f} (within limit):")
                    print(f"  {'✓ PASS' if allow_ok else '✗ FAIL'} Disbursement allowed: {r_disburse2.status_code}")
                    all_ok &= allow_ok
                else:
                    print(f"  {FAIL} Approve failed for within-limit loan")
                    all_ok = False
            else:
                print(f"  {FAIL} Could not create within-limit loan: {r2.status_code}")
                all_ok = False

        assert all_ok, "Shares eligibility check failed"
        record("shares_eligibility", all_ok)

    def test_07_approve_loans(self):
        print("\n" + "=" * 70)
        print("STEP 7: APPROVE LOANS (first 3 main loans)")
        print("=" * 70)

        all_ok = True
        for i, loan_id in enumerate(created_ids["loans"][:3]):
            r_check = api("get", f"/loan-applications/{loan_id}")
            if r_check.status_code == 200:
                current_status = r_check.json().get("status", "")
                if current_status == "approved":
                    print(f"  {PASS} Loan {i + 1} already approved")
                    continue
                if current_status != "pending":
                    print(f"  {INFO} Loan {i + 1} status is '{current_status}', skipping")
                    continue

            r = api("post", f"/loan-applications/{loan_id}/approve")
            if r.status_code == 200:
                loan = r.json()
                print(f"  {PASS} Loan {i + 1} approved: {loan.get('application_number', '?')} -> status={loan['status']}")
                all_ok &= loan["status"] == "approved"
            else:
                print(f"  {FAIL} Failed to approve loan {i + 1}: {r.status_code} - {r.text[:200]}")
                all_ok = False

        assert all_ok, "Loan approvals failed"
        record("approve_loans", all_ok)

    def test_08_disburse_flat_rate_loan_and_verify(self):
        print("\n" + "=" * 70)
        print("STEP 8: DISBURSE FLAT RATE LOAN - Verify net amount and instalments")
        print("=" * 70)

        loan_id = created_ids["loans"][0]
        r = api("post", f"/loans/{loan_id}/disburse", {"disbursement_method": "cash"})
        assert r.status_code == 200, f"Disbursement failed: {r.status_code} - {r.text[:300]}"

        resp = r.json()
        loan = resp.get("loan", resp)
        disbursement = resp.get("disbursement", {})
        amount = 100000
        expected_fees = calc_fees(amount, 3, 1, 0.5, 20)
        expected_calc = calc_flat(amount, 10, 12)
        expected_net = amount - expected_fees["total_fees"]

        print(f"  {INFO} Loan amount: {amount:,}")
        print(f"  {INFO} Total fees: {expected_fees['total_fees']:,.2f}")
        print(f"  {INFO} Expected net disbursed: {expected_net:,.2f}")
        print(f"  {INFO} Expected outstanding: {expected_calc['total_repayment']:,.2f}")
        print()

        all_ok = True
        all_ok &= check_eq("Status", loan.get("status"), "disbursed")
        all_ok &= check("Net Disbursed", loan.get("amount_disbursed") or disbursement.get("amount"), expected_net)
        all_ok &= check("Outstanding Balance", loan.get("outstanding_balance"), expected_calc["total_repayment"])
        all_ok &= check("Monthly Payment", loan.get("monthly_repayment"), expected_calc["monthly_repayment"])

        r_sched = api("get", f"/loans/{loan_id}/schedule")
        if r_sched.status_code == 200:
            schedule = r_sched.json()
            instalments = schedule.get("schedule", [])
            print(f"\n  {INFO} Instalment schedule ({len(instalments)} instalments):")

            total_inst_principal = sum(inst["principal"] for inst in instalments)
            total_inst_interest = sum(inst["interest"] for inst in instalments)
            first = instalments[0] if instalments else {}
            last = instalments[-1] if instalments else {}

            print(f"  {INFO} First instalment: principal={first.get('principal', 0):,.2f}, interest={first.get('interest', 0):,.2f}, total={first.get('total_payment', 0):,.2f}")
            print(f"  {INFO} Last instalment:  principal={last.get('principal', 0):,.2f}, interest={last.get('interest', 0):,.2f}, total={last.get('total_payment', 0):,.2f}")

            all_ok &= check("Total Schedule Principal", total_inst_principal, amount, tolerance=1.0)
            all_ok &= check("Total Schedule Interest", total_inst_interest, expected_calc["total_interest"], tolerance=1.0)
            all_ok &= check_eq("Number of Instalments", len(instalments), 12)

            interest_values = [inst["interest"] for inst in instalments]
            max_diff = max(interest_values) - min(interest_values) if interest_values else 0
            flat_ok = max_diff < 2
            print(f"  {'✓ PASS' if flat_ok else '✗ FAIL'} Flat rate: interest is equal across all instalments (max diff={max_diff:.2f})")
            all_ok &= flat_ok

        assert all_ok, "Flat rate disbursement verification failed"
        record("disburse_flat_rate_verify", all_ok)

    def test_09_disburse_reducing_balance_and_verify(self):
        print("\n" + "=" * 70)
        print("STEP 9: DISBURSE REDUCING BALANCE LOAN - Verify instalment pattern")
        print("=" * 70)

        loan_id = created_ids["loans"][1]
        r = api("post", f"/loans/{loan_id}/disburse", {"disbursement_method": "cash"})
        assert r.status_code == 200, f"Disbursement failed: {r.status_code} - {r.text[:300]}"

        resp = r.json()
        loan = resp.get("loan", resp)
        disbursement = resp.get("disbursement", {})
        amount = 200000
        expected_calc = calc_reducing(amount, 12, 24)
        expected_fees = calc_fees(amount, 2, 1.5, 1, 20)
        expected_net = amount - expected_fees["total_fees"]

        all_ok = True
        all_ok &= check_eq("Status", loan.get("status"), "disbursed")
        all_ok &= check("Net Disbursed", loan.get("amount_disbursed") or disbursement.get("amount"), expected_net)

        r_sched = api("get", f"/loans/{loan_id}/schedule")
        if r_sched.status_code == 200:
            schedule = r_sched.json()
            instalments = schedule.get("schedule", [])
            print(f"\n  {INFO} Instalment schedule ({len(instalments)} instalments):")

            first = instalments[0] if instalments else {}
            last = instalments[-1] if instalments else {}

            print(f"  {INFO} First: principal={first.get('principal', 0):,.2f}, interest={first.get('interest', 0):,.2f}")
            print(f"  {INFO} Last:  principal={last.get('principal', 0):,.2f}, interest={last.get('interest', 0):,.2f}")

            total_inst_principal = sum(inst["principal"] for inst in instalments)
            all_ok &= check("Total Schedule Principal", total_inst_principal, amount, tolerance=1.0)

            if len(instalments) >= 2:
                first_interest = instalments[0]["interest"]
                last_interest = instalments[-1]["interest"]
                decreasing = first_interest > last_interest
                print(f"  {'✓ PASS' if decreasing else '✗ FAIL'} Reducing balance: interest decreases ({first_interest:,.2f} -> {last_interest:,.2f})")
                all_ok &= decreasing

                first_principal = instalments[0]["principal"]
                last_principal = instalments[-1]["principal"]
                increasing_p = first_principal < last_principal
                print(f"  {'✓ PASS' if increasing_p else '✗ FAIL'} Reducing balance: principal increases ({first_principal:,.2f} -> {last_principal:,.2f})")
                all_ok &= increasing_p

        assert all_ok, "Reducing balance disbursement verification failed"
        record("disburse_reducing_verify", all_ok)

    def test_10_disburse_upfront_interest_and_verify(self):
        print("\n" + "=" * 70)
        print("STEP 10: DISBURSE UPFRONT INTEREST LOAN - Verify deductions")
        print("=" * 70)

        loan_id = created_ids["loans"][2]
        r = api("post", f"/loans/{loan_id}/disburse", {"disbursement_method": "cash"})
        assert r.status_code == 200, f"Disbursement failed: {r.status_code} - {r.text[:300]}"

        resp = r.json()
        loan = resp.get("loan", resp)
        disbursement = resp.get("disbursement", {})
        amount = 50000
        term = 6
        rate = 8
        expected_calc = calc_flat(amount, rate, term)
        expected_fees = calc_fees(amount, 2, 0, 0, 20)

        total_interest = expected_calc["total_interest"]
        total_fees = expected_fees["total_fees"]
        expected_net = amount - total_interest - total_fees
        expected_monthly = amount / term

        print(f"  {INFO} Loan amount: {amount:,}")
        print(f"  {INFO} Interest deducted upfront: {total_interest:,.2f}")
        print(f"  {INFO} Fees deducted: {total_fees:,.2f}")
        print(f"  {INFO} Expected net: {amount:,} - {total_interest:,.2f} - {total_fees:,.2f} = {expected_net:,.2f}")
        print(f"  {INFO} Monthly (principal only): {amount:,} / {term} = {expected_monthly:,.2f}")
        print()

        all_ok = True
        all_ok &= check_eq("Status", loan.get("status"), "disbursed")
        all_ok &= check("Net Disbursed", loan.get("amount_disbursed") or disbursement.get("amount"), expected_net)
        all_ok &= check("Monthly Payment", loan.get("monthly_repayment"), expected_monthly, tolerance=1.0)

        r_sched = api("get", f"/loans/{loan_id}/schedule")
        if r_sched.status_code == 200:
            schedule = r_sched.json()
            instalments = schedule.get("schedule", [])

            zero_interest = all(inst["interest"] == 0 for inst in instalments)
            print(f"  {'✓ PASS' if zero_interest else '✗ FAIL'} Upfront: all instalments have zero interest")
            all_ok &= zero_interest

            total_inst_principal = sum(inst["principal"] for inst in instalments)
            all_ok &= check("Total Schedule Principal", total_inst_principal, amount, tolerance=1.0)

        assert all_ok, "Upfront interest disbursement verification failed"
        record("disburse_upfront_interest_verify", all_ok)

    def test_11_repayment_flat_rate_and_balance_tracking(self):
        print("\n" + "=" * 70)
        print("STEP 11: REPAYMENTS - Make payments on flat rate loan and track balances")
        print("=" * 70)

        loan_id = created_ids["loans"][0]

        r_loan = api("get", f"/loan-applications/{loan_id}")
        loan_before = r_loan.json()
        outstanding_before = float(loan_before.get("outstanding_balance") or 0)
        monthly_payment = float(loan_before.get("monthly_repayment") or 0)

        print(f"  {INFO} Outstanding before: {outstanding_before:,.2f}")
        print(f"  {INFO} Monthly payment: {monthly_payment:,.2f}")

        all_ok = True

        print(f"\n  --- Payment 1: Exact monthly payment ---")
        r = api("post", "/repayments", {
            "loan_id": loan_id,
            "amount": monthly_payment,
            "payment_method": "cash",
            "reference": f"REP-VERIFY-001-{_RUN_SUFFIX}",
            "notes": "First payment verification",
        })
        assert r.status_code in (200, 201), f"Repayment failed: {r.status_code} - {r.text[:300]}"
        rep1 = r.json()
        print(f"  {INFO} Repayment: {rep1.get('repayment_number', '?')}")
        print(f"  {INFO} Principal: {float(rep1.get('principal_amount') or 0):,.2f}, Interest: {float(rep1.get('interest_amount') or 0):,.2f}")

        r_loan = api("get", f"/loan-applications/{loan_id}")
        loan_after1 = r_loan.json()
        outstanding_after1 = float(loan_after1.get("outstanding_balance") or 0)
        amount_repaid_1 = float(loan_after1.get("amount_repaid") or 0)

        expected_outstanding_after1 = outstanding_before - monthly_payment
        all_ok &= check("Outstanding after 1st payment", outstanding_after1, expected_outstanding_after1, tolerance=1.0)
        all_ok &= check("Amount repaid", amount_repaid_1, monthly_payment, tolerance=1.0)

        print(f"\n  --- Payment 2: Another monthly payment ---")
        r2 = api("post", "/repayments", {
            "loan_id": loan_id,
            "amount": monthly_payment,
            "payment_method": "cash",
            "reference": f"REP-VERIFY-002-{_RUN_SUFFIX}",
        })
        assert r2.status_code in (200, 201), f"2nd repayment failed: {r2.status_code}"

        r_loan = api("get", f"/loan-applications/{loan_id}")
        loan_after2 = r_loan.json()
        outstanding_after2 = float(loan_after2.get("outstanding_balance") or 0)
        amount_repaid_2 = float(loan_after2.get("amount_repaid") or 0)

        expected_outstanding_after2 = outstanding_before - (monthly_payment * 2)
        all_ok &= check("Outstanding after 2nd payment", outstanding_after2, expected_outstanding_after2, tolerance=1.0)
        all_ok &= check("Total amount repaid", amount_repaid_2, monthly_payment * 2, tolerance=1.0)

        r_sched = api("get", f"/loans/{loan_id}/schedule")
        if r_sched.status_code == 200:
            schedule = r_sched.json()
            instalments = schedule.get("schedule", [])
            paid_count = sum(1 for i in instalments if i["status"] == "paid")
            print(f"\n  {INFO} Instalments paid: {paid_count} / {len(instalments)}")
            all_ok &= check_eq("Paid instalments", paid_count, 2)

        assert all_ok, "Repayment balance tracking failed"
        record("repayment_balance_tracking", all_ok)

    def test_12_repayment_reducing_balance_allocation(self):
        print("\n" + "=" * 70)
        print("STEP 12: REDUCING BALANCE REPAYMENT - Verify allocation pattern")
        print("=" * 70)

        loan_id = created_ids["loans"][1]
        r_loan = api("get", f"/loan-applications/{loan_id}")
        loan = r_loan.json()
        monthly = float(loan.get("monthly_repayment") or 0)
        outstanding_before = float(loan.get("outstanding_balance") or 0)

        print(f"  {INFO} Monthly payment: {monthly:,.2f}")
        print(f"  {INFO} Outstanding: {outstanding_before:,.2f}")

        all_ok = True

        r = api("post", "/repayments", {
            "loan_id": loan_id,
            "amount": monthly,
            "payment_method": "cash",
            "reference": f"RED-REP-001-{_RUN_SUFFIX}",
        })
        assert r.status_code in (200, 201), f"Failed: {r.status_code} - {r.text[:200]}"
        rep = r.json()

        principal = float(rep.get("principal_amount") or 0)
        interest = float(rep.get("interest_amount") or 0)
        penalty = float(rep.get("penalty_amount") or 0)
        print(f"  {INFO} Payment 1: principal={principal:,.2f}, interest={interest:,.2f}, penalty={penalty:,.2f}")
        rep1_allocated = principal + interest + penalty
        all_ok &= check("Payment 1 allocated <= payment", rep1_allocated, monthly, tolerance=monthly * 0.05)

        r2 = api("post", "/repayments", {
            "loan_id": loan_id,
            "amount": monthly,
            "payment_method": "cash",
            "reference": f"RED-REP-002-{_RUN_SUFFIX}",
        })
        assert r2.status_code in (200, 201)
        rep2 = r2.json()

        principal2 = float(rep2.get("principal_amount") or 0)
        interest2 = float(rep2.get("interest_amount") or 0)
        print(f"  {INFO} Payment 2: principal={principal2:,.2f}, interest={interest2:,.2f}")

        r_sched = api("get", f"/loans/{loan_id}/schedule")
        if r_sched.status_code == 200:
            schedule = r_sched.json()
            instalments = schedule.get("schedule", [])
            paid_insts = [i for i in instalments if i["status"] == "paid"]
            if len(paid_insts) >= 2:
                i1_interest = paid_insts[0]["interest"]
                i2_interest = paid_insts[1]["interest"]
                if i2_interest < i1_interest:
                    print(f"  {PASS} Reducing: schedule interest decreases ({i1_interest:,.2f} -> {i2_interest:,.2f})")
                else:
                    print(f"  {FAIL} Reducing: schedule interest should decrease ({i1_interest:,.2f} -> {i2_interest:,.2f})")
                    all_ok = False

                i1_principal = paid_insts[0]["principal"]
                i2_principal = paid_insts[1]["principal"]
                if i2_principal > i1_principal:
                    print(f"  {PASS} Reducing: schedule principal increases ({i1_principal:,.2f} -> {i2_principal:,.2f})")
                else:
                    print(f"  {FAIL} Reducing: schedule principal should increase ({i1_principal:,.2f} -> {i2_principal:,.2f})")
                    all_ok = False

        r_loan2 = api("get", f"/loan-applications/{loan_id}")
        loan2 = r_loan2.json()
        expected_outstanding = outstanding_before - monthly * 2
        all_ok &= check("Outstanding after 2 payments", float(loan2.get("outstanding_balance") or 0), expected_outstanding, tolerance=monthly * 0.1)

        assert all_ok, "Reducing balance repayment allocation failed"
        record("reducing_balance_repayment", all_ok)

    def test_13_full_loan_payoff(self):
        print("\n" + "=" * 70)
        print("STEP 13: FULL PAYOFF - Pay off upfront interest loan completely")
        print("=" * 70)

        loan_id = created_ids["loans"][2]
        r_loan = api("get", f"/loan-applications/{loan_id}")
        loan = r_loan.json()
        outstanding = float(loan.get("outstanding_balance") or 0)

        print(f"  {INFO} Loan: {loan['application_number']}")
        print(f"  {INFO} Outstanding: {outstanding:,.2f}")
        print(f"  {INFO} Paying full outstanding amount")

        all_ok = True

        r = api("post", "/repayments", {
            "loan_id": loan_id,
            "amount": outstanding,
            "payment_method": "cash",
            "reference": f"PAYOFF-001-{_RUN_SUFFIX}",
            "notes": "Full loan payoff",
        })
        assert r.status_code in (200, 201), f"Payoff failed: {r.status_code} - {r.text[:300]}"

        r_loan2 = api("get", f"/loan-applications/{loan_id}")
        loan2 = r_loan2.json()

        all_ok &= check_eq("Status after payoff", loan2["status"], "paid")
        all_ok &= check("Outstanding after payoff", float(loan2.get("outstanding_balance") or 0), 0)
        closed = loan2.get("closed_at") is not None
        print(f"  {'✓ PASS' if closed else '✗ FAIL'} closed_at is set: {loan2.get('closed_at', 'None')}")
        all_ok &= closed

        assert all_ok, "Full payoff verification failed"
        record("full_loan_payoff", all_ok)

    def test_14_overpayment_to_savings(self):
        print("\n" + "=" * 70)
        print("STEP 14: OVERPAYMENT - Excess goes to member savings")
        print("=" * 70)

        member_id = created_ids["members"][0]
        r_mem = api("get", f"/members/{member_id}")
        member_before = r_mem.json()
        savings_before = float(member_before.get("savings_balance") or 0)

        loan_data = {
            "member_id": member_id,
            "loan_product_id": created_ids["loan_products"][0],
            "amount": 10000,
            "term_months": 2,
            "purpose": "Overpayment test",
            "disbursement_method": "cash",
        }
        r = api("post", "/loan-applications", loan_data)
        assert r.status_code in (200, 201), f"Failed: {r.text[:200]}"
        overpay_loan = r.json()
        overpay_loan_id = overpay_loan["id"]
        created_ids["loans"].append(overpay_loan_id)

        r_approve = api("post", f"/loan-applications/{overpay_loan_id}/approve")
        assert r_approve.status_code == 200, f"Approve failed: {r_approve.text[:200]}"

        r_disburse = api("post", f"/loans/{overpay_loan_id}/disburse", {"disbursement_method": "cash"})
        assert r_disburse.status_code == 200, f"Disburse failed: {r_disburse.text[:200]}"

        r_loan = api("get", f"/loan-applications/{overpay_loan_id}")
        loan = r_loan.json()
        outstanding = float(loan.get("outstanding_balance") or 0)

        overpay_amount = outstanding + 5000
        print(f"  {INFO} Outstanding: {outstanding:,.2f}")
        print(f"  {INFO} Paying: {overpay_amount:,.2f} (overpayment of 5,000)")
        print(f"  {INFO} Savings before: {savings_before:,.2f}")

        r_rep = api("post", "/repayments", {
            "loan_id": overpay_loan_id,
            "amount": overpay_amount,
            "payment_method": "cash",
            "reference": f"OVERPAY-001-{_RUN_SUFFIX}",
        })
        assert r_rep.status_code in (200, 201), f"Repayment failed: {r_rep.status_code} - {r_rep.text[:300]}"
        rep = r_rep.json()

        all_ok = True
        overpay_credited = rep.get("overpayment_credited_to_savings", 0)
        print(f"  {INFO} Overpayment credited: {float(overpay_credited):,.2f}")
        all_ok &= check("Overpayment credited", overpay_credited, 5000, tolerance=1.0)

        r_loan2 = api("get", f"/loan-applications/{overpay_loan_id}")
        loan2 = r_loan2.json()
        all_ok &= check_eq("Status", loan2["status"], "paid")
        all_ok &= check("Outstanding", float(loan2.get("outstanding_balance") or 0), 0)

        r_mem2 = api("get", f"/members/{member_id}")
        member_after = r_mem2.json()
        savings_after = float(member_after.get("savings_balance") or 0)
        print(f"  {INFO} Savings after: {savings_after:,.2f}")
        all_ok &= check("Savings increase", savings_after - savings_before, 5000, tolerance=1.0)

        assert all_ok, "Overpayment verification failed"
        record("overpayment_to_savings", all_ok)

    def test_15_restructure_extend_term(self):
        print("\n" + "=" * 70)
        print("STEP 15: RESTRUCTURE - Extend term on reducing balance loan")
        print("=" * 70)

        loan_id = created_ids["loans"][1]
        r_loan = api("get", f"/loan-applications/{loan_id}")
        loan = r_loan.json()

        old_term = loan["term_months"]
        old_monthly = float(loan.get("monthly_repayment") or 0)
        outstanding = float(loan.get("outstanding_balance") or 0)
        new_term = old_term + 12

        print(f"  {INFO} Current: term={old_term}mo, monthly={old_monthly:,.2f}, outstanding={outstanding:,.2f}")
        print(f"  {INFO} Extending to: {new_term} months")

        r = api("post", f"/loans/{loan_id}/restructure", {
            "restructure_type": "extend_term",
            "new_term_months": new_term,
            "reason": "Member requested reduced payments",
        })
        assert r.status_code == 200, f"Restructure failed: {r.status_code} - {r.text[:300]}"

        r_loan2 = api("get", f"/loan-applications/{loan_id}")
        loan2 = r_loan2.json()

        new_monthly = float(loan2.get("monthly_repayment") or 0)

        all_ok = True
        all_ok &= check_eq("New term", loan2["term_months"], new_term)
        monthly_reduced = new_monthly < old_monthly
        print(f"  {'✓ PASS' if monthly_reduced else '✗ FAIL'} Monthly reduced: {old_monthly:,.2f} -> {new_monthly:,.2f}")
        all_ok &= monthly_reduced

        restructured = loan2.get("is_restructured", False)
        print(f"  {'✓ PASS' if restructured else '✗ FAIL'} is_restructured = {restructured}")
        all_ok &= restructured

        r_sched = api("get", f"/loans/{loan_id}/schedule")
        if r_sched.status_code == 200:
            schedule = r_sched.json()
            instalments = schedule.get("schedule", [])
            unpaid = [i for i in instalments if i["status"] != "paid"]
            print(f"  {INFO} Schedule now has {len(instalments)} total instalments ({len(unpaid)} unpaid)")

        assert all_ok, "Extend term restructure failed"
        record("restructure_extend_term", all_ok)

    def test_16_restructure_adjust_interest(self):
        print("\n" + "=" * 70)
        print("STEP 16: RESTRUCTURE - Adjust interest rate")
        print("=" * 70)

        loan_id = created_ids["loans"][1]
        r_loan = api("get", f"/loan-applications/{loan_id}")
        loan = r_loan.json()

        old_rate = float(loan.get("interest_rate") or 0)
        old_monthly = float(loan.get("monthly_repayment") or 0)
        new_rate = 8

        print(f"  {INFO} Current rate: {old_rate}%, monthly: {old_monthly:,.2f}")
        print(f"  {INFO} Adjusting to: {new_rate}%")

        r = api("post", f"/loans/{loan_id}/restructure", {
            "restructure_type": "adjust_interest",
            "new_interest_rate": new_rate,
            "reason": "Rate reduction for good payment history",
        })
        assert r.status_code == 200, f"Restructure failed: {r.status_code} - {r.text[:300]}"

        r_loan2 = api("get", f"/loan-applications/{loan_id}")
        loan2 = r_loan2.json()

        new_monthly_actual = float(loan2.get("monthly_repayment") or 0)

        all_ok = True
        all_ok &= check("New interest rate", float(loan2.get("interest_rate") or 0), new_rate)
        monthly_reduced = new_monthly_actual < old_monthly
        print(f"  {'✓ PASS' if monthly_reduced else '✗ FAIL'} Monthly reduced: {old_monthly:,.2f} -> {new_monthly_actual:,.2f}")
        all_ok &= monthly_reduced

        assert all_ok, "Adjust interest restructure failed"
        record("restructure_adjust_interest", all_ok)

    def test_17_restructure_waive_penalty(self):
        print("\n" + "=" * 70)
        print("STEP 17: RESTRUCTURE - Waive penalty")
        print("=" * 70)

        loan_id = created_ids["loans"][1]
        r_loan = api("get", f"/loan-applications/{loan_id}")
        loan = r_loan.json()
        outstanding_before = float(loan.get("outstanding_balance") or 0)
        waive_amount = 5000

        print(f"  {INFO} Outstanding before: {outstanding_before:,.2f}")
        print(f"  {INFO} Waiving: {waive_amount:,.2f}")

        r = api("post", f"/loans/{loan_id}/restructure", {
            "restructure_type": "waive_penalty",
            "penalty_waived": waive_amount,
            "reason": "Goodwill penalty waiver",
        })
        assert r.status_code == 200, f"Waiver failed: {r.status_code} - {r.text[:300]}"

        r_loan2 = api("get", f"/loan-applications/{loan_id}")
        loan2 = r_loan2.json()
        outstanding_after = float(loan2.get("outstanding_balance") or 0)

        all_ok = True
        expected = outstanding_before - waive_amount
        all_ok &= check("Outstanding after waiver", outstanding_after, expected, tolerance=1.0)

        assert all_ok, "Penalty waiver failed"
        record("restructure_waive_penalty", all_ok)

    def test_18_restructure_grace_period(self):
        print("\n" + "=" * 70)
        print("STEP 18: RESTRUCTURE - Grace period")
        print("=" * 70)

        loan_id = created_ids["loans"][1]
        r_loan = api("get", f"/loan-applications/{loan_id}")
        loan = r_loan.json()
        next_payment = loan.get("next_payment_date")

        print(f"  {INFO} Next payment date before: {next_payment}")

        r = api("post", f"/loans/{loan_id}/restructure", {
            "restructure_type": "grace_period",
            "grace_period_days": 30,
            "reason": "Financial hardship - 30 day grace",
        })
        assert r.status_code == 200, f"Grace period failed: {r.status_code} - {r.text[:300]}"

        r_loan2 = api("get", f"/loan-applications/{loan_id}")
        loan2 = r_loan2.json()
        new_next_payment = loan2.get("next_payment_date")

        print(f"  {INFO} Next payment date after: {new_next_payment}")

        all_ok = True
        if next_payment and new_next_payment:
            from datetime import date as date_cls
            old_d = date_cls.fromisoformat(str(next_payment)[:10])
            new_d = date_cls.fromisoformat(str(new_next_payment)[:10])
            diff = (new_d - old_d).days
            all_ok &= check("Grace period days shift", diff, 30, tolerance=1)
        else:
            print(f"  {INFO} Could not compare dates (before={next_payment}, after={new_next_payment})")

        assert all_ok, "Grace period restructure failed"
        record("restructure_grace_period", all_ok)

    def test_19_loan_schedule_summary_verification(self):
        print("\n" + "=" * 70)
        print("STEP 19: SCHEDULE SUMMARY - Verify computed summary matches schedule")
        print("=" * 70)

        loan_id = created_ids["loans"][0]
        r_sched = api("get", f"/loans/{loan_id}/schedule")
        assert r_sched.status_code == 200, f"Schedule failed: {r_sched.status_code}"
        schedule = r_sched.json()

        summary = schedule.get("summary", {})
        instalments = schedule.get("schedule", [])

        computed_total_expected = sum(i["total_payment"] for i in instalments)
        computed_total_paid = sum(i["paid_principal"] + i["paid_interest"] + i["paid_penalty"] + i.get("paid_insurance", 0) for i in instalments)
        computed_paid_count = sum(1 for i in instalments if i["status"] == "paid")

        print(f"  {INFO} Instalments: {len(instalments)}")
        print(f"  {INFO} Summary total_expected: {summary.get('total_expected', 0):,.2f}")
        print(f"  {INFO} Computed total_expected: {computed_total_expected:,.2f}")
        print(f"  {INFO} Summary total_paid: {summary.get('total_paid', 0):,.2f}")
        print(f"  {INFO} Computed total_paid: {computed_total_paid:,.2f}")
        print(f"  {INFO} Paid instalments: {computed_paid_count}")

        all_ok = True
        all_ok &= check("Summary total_expected matches schedule", summary.get("total_expected", 0), computed_total_expected, tolerance=1.0)
        all_ok &= check("Summary total_paid matches schedule", summary.get("total_paid", 0), computed_total_paid, tolerance=1.0)
        all_ok &= check("Summary outstanding", summary.get("outstanding_balance", 0), computed_total_expected - computed_total_paid, tolerance=1.0)

        assert all_ok, "Schedule summary verification failed"
        record("schedule_summary_verification", all_ok)

    def test_20_create_loan_with_extra_charges(self):
        print("\n" + "=" * 70)
        print("STEP 20: EXTRA CHARGES - Verify extra charges on loan")
        print("=" * 70)

        loan_data = {
            "member_id": created_ids["members"][2],
            "loan_product_id": created_ids["loan_products"][1],
            "amount": 100000,
            "term_months": 12,
            "purpose": "Extra charges test",
            "disbursement_method": "cash",
            "extra_charges": [
                {"charge_name": "Legal Fee", "amount": 5000},
                {"charge_name": "Valuation Fee", "amount": 3000},
            ],
        }
        r = api("post", "/loan-applications", loan_data)
        assert r.status_code in (200, 201), f"Failed: {r.status_code} - {r.text[:300]}"
        loan = r.json()
        created_ids["loans"].append(loan["id"])

        all_ok = True
        extra = loan.get("extra_charges", [])
        print(f"  {INFO} Extra charges returned: {len(extra)}")
        for c in extra:
            print(f"    - {c.get('charge_name', '?')}: {float(c.get('amount', 0)):,.2f}")

        has_legal = any(c.get("charge_name") == "Legal Fee" and float(c.get("amount", 0)) == 5000 for c in extra)
        has_valuation = any(c.get("charge_name") == "Valuation Fee" and float(c.get("amount", 0)) == 3000 for c in extra)

        print(f"  {'✓ PASS' if has_legal else '✗ FAIL'} Legal Fee found: {has_legal}")
        print(f"  {'✓ PASS' if has_valuation else '✗ FAIL'} Valuation Fee found: {has_valuation}")
        all_ok &= has_legal and has_valuation

        record("extra_charges", all_ok)
        assert all_ok

    def test_21_reject_and_cancel_workflows(self):
        print("\n" + "=" * 70)
        print("STEP 21: REJECT & CANCEL - Verify status transitions")
        print("=" * 70)

        all_ok = True

        loan_data = {
            "member_id": created_ids["members"][2],
            "loan_product_id": created_ids["loan_products"][0],
            "amount": 15000,
            "term_months": 6,
            "purpose": "To be rejected",
            "disbursement_method": "cash",
        }
        r = api("post", "/loan-applications", loan_data)
        assert r.status_code in (200, 201)
        reject_loan = r.json()

        r_reject = api("post", f"/loan-applications/{reject_loan['id']}/reject", {
            "reason": "Insufficient income documentation",
        })
        if r_reject.status_code == 200:
            rejected = r_reject.json()
            all_ok &= check_eq("Reject status", rejected["status"], "rejected")
            all_ok &= check_eq("Rejection reason", rejected.get("rejection_reason"), "Insufficient income documentation")
            print(f"  {PASS} Loan rejected with reason")
        else:
            r_reject2 = api("put", f"/loans/{reject_loan['id']}/action", {
                "action": "reject",
                "reason": "Insufficient income documentation",
            })
            assert r_reject2.status_code == 200, f"Reject failed: {r_reject2.status_code} - {r_reject2.text[:200]}"
            rejected = r_reject2.json()
            all_ok &= check_eq("Reject status", rejected["status"], "rejected")
            print(f"  {PASS} Loan rejected via action endpoint")

        loan_data2 = {
            "member_id": created_ids["members"][2],
            "loan_product_id": created_ids["loan_products"][0],
            "amount": 20000,
            "term_months": 4,
            "purpose": "To be cancelled",
            "disbursement_method": "cash",
        }
        r2 = api("post", "/loan-applications", loan_data2)
        assert r2.status_code in (200, 201)
        cancel_loan = r2.json()

        r_cancel = api("put", f"/loan-applications/{cancel_loan['id']}/cancel")
        if r_cancel.status_code == 200:
            cancelled = r_cancel.json()
            all_ok &= check_eq("Cancel status", cancelled["status"], "cancelled")
            print(f"  {PASS} Loan cancelled")
        else:
            r_cancel2 = api("put", f"/loans/{cancel_loan['id']}/cancel")
            if r_cancel2.status_code == 200:
                cancelled = r_cancel2.json()
                all_ok &= check_eq("Cancel status", cancelled["status"], "cancelled")
                print(f"  {PASS} Loan cancelled via loans endpoint")
            else:
                print(f"  {INFO} Cancel returned {r_cancel.status_code}: {r_cancel.text[:100]}")
                r_del = api("delete", f"/loans/{cancel_loan['id']}")
                print(f"  {INFO} Delete instead: {r_del.status_code}")

        record("reject_and_cancel", all_ok)
        assert all_ok

    def test_22_final_summary(self):
        print("\n" + "=" * 70)
        print("=" * 70)
        print("  FINAL VERIFICATION SUMMARY")
        print("=" * 70)

        total = results_summary["passed"] + results_summary["failed"]
        print(f"\n  Total tests: {total}")
        print(f"  Passed: {results_summary['passed']}")
        print(f"  Failed: {results_summary['failed']}")
        print()

        for t in results_summary["tests"]:
            status = PASS if t["passed"] else FAIL
            print(f"  {status} {t['name']}")

        print("\n" + "=" * 70)

        if results_summary["failed"] > 0:
            print(f"\n  WARNING: {results_summary['failed']} test(s) had calculation mismatches!")
        else:
            print(f"\n  All {results_summary['passed']} verification checks passed!")
        print("=" * 70)
