from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, String
from typing import List
from decimal import Decimal
from datetime import datetime, date, timedelta
from models.database import get_db
from models.tenant import Member, LoanApplication, LoanRepayment, LoanInstalment, Transaction, Branch, Staff, LoanDefault, CollateralItem, LoanProduct, Attendance, DisciplinaryRecord
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission

router = APIRouter()

@router.get("/{org_id}/analytics/dashboard")
async def get_dashboard_analytics(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "dashboard:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        total_members = tenant_session.query(func.count(Member.id)).filter(Member.is_active == True).scalar() or 0
        total_staff = tenant_session.query(func.count(Staff.id)).filter(Staff.is_active == True).scalar() or 0
        total_branches = tenant_session.query(func.count(Branch.id)).filter(Branch.is_active == True).scalar() or 0
        
        loans = tenant_session.query(LoanApplication).all()
        total_loans = len(loans)
        pending_loans = sum(1 for l in loans if l.status == "pending")
        approved_loans = sum(1 for l in loans if l.status == "approved")
        disbursed_loans = sum(1 for l in loans if l.status == "disbursed")
        
        members = tenant_session.query(Member).all()
        total_savings = sum(m.savings_balance or Decimal("0") for m in members)
        total_shares = sum(m.shares_balance or Decimal("0") for m in members)
        
        total_disbursed = sum(l.amount_disbursed or Decimal("0") for l in loans if l.status in ["disbursed", "paid"])
        total_outstanding = sum(l.outstanding_balance or Decimal("0") for l in loans if l.status == "disbursed")
        repayment_sums = tenant_session.query(
            func.coalesce(func.sum(LoanRepayment.principal_amount), 0),
            func.coalesce(func.sum(LoanRepayment.interest_amount), 0),
            func.coalesce(func.sum(LoanRepayment.penalty_amount), 0)
        ).first()
        total_repaid = Decimal(str(repayment_sums[0])) + Decimal(str(repayment_sums[1])) + Decimal(str(repayment_sums[2]))
        
        tenant_session.query(LoanDefault).filter(
            LoanDefault.status.in_(["overdue", "in_collection"]),
            LoanDefault.loan_id.in_(
                tenant_session.query(LoanApplication.id.cast(String)).filter(LoanApplication.status == "paid")
            )
        ).update({"status": "resolved", "resolved_at": datetime.utcnow()}, synchronize_session="fetch")
        tenant_session.commit()
        
        default_count = tenant_session.query(func.count(LoanDefault.id)).filter(
            LoanDefault.status.in_(["overdue", "in_collection"])
        ).scalar() or 0

        collateral_deficient_count = tenant_session.query(func.count(LoanApplication.id)).filter(
            LoanApplication.collateral_deficient == True,
            LoanApplication.status.in_(["disbursed", "approved", "defaulted", "restructured"])
        ).scalar() or 0

        return {
            "total_members": total_members,
            "total_staff": total_staff,
            "total_branches": total_branches,
            "total_loans": total_loans,
            "pending_loans": pending_loans,
            "approved_loans": approved_loans,
            "disbursed_loans": disbursed_loans,
            "total_savings": float(total_savings),
            "total_shares": float(total_shares),
            "total_disbursed": float(total_disbursed),
            "total_outstanding": float(total_outstanding),
            "total_repaid": float(total_repaid),
            "default_count": default_count,
            "collateral_deficient_count": collateral_deficient_count,
            "collection_rate": float(total_repaid / total_disbursed * 100) if total_disbursed else 0
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/analytics/branches")
async def get_branch_performance(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "analytics:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        branches = tenant_session.query(Branch).filter(Branch.is_active == True).all()
        
        result = []
        for branch in branches:
            member_count = tenant_session.query(func.count(Member.id)).filter(Member.branch_id == branch.id).scalar() or 0
            
            loans = tenant_session.query(LoanApplication).join(Member).filter(Member.branch_id == branch.id).all()
            loan_count = len(loans)
            total_disbursed = sum(l.amount_disbursed or Decimal("0") for l in loans if l.status in ["disbursed", "paid"])
            loan_ids = [str(l.id) for l in loans]
            if loan_ids:
                branch_rep_sums = tenant_session.query(
                    func.coalesce(func.sum(LoanRepayment.principal_amount), 0),
                    func.coalesce(func.sum(LoanRepayment.interest_amount), 0),
                    func.coalesce(func.sum(LoanRepayment.penalty_amount), 0)
                ).filter(LoanRepayment.loan_id.in_(loan_ids)).first()
                total_collected = Decimal(str(branch_rep_sums[0])) + Decimal(str(branch_rep_sums[1])) + Decimal(str(branch_rep_sums[2]))
            else:
                total_collected = Decimal("0")
            
            active_loans = [l for l in loans if l.status == "disbursed"]
            if active_loans:
                defaulted = tenant_session.query(func.count(LoanDefault.id)).join(LoanApplication).join(Member).filter(
                    Member.branch_id == branch.id,
                    LoanDefault.status.in_(["overdue", "in_collection"])
                ).scalar() or 0
                default_rate = float(defaulted / len(active_loans) * 100) if active_loans else 0
            else:
                default_rate = 0
            
            result.append({
                "branch_id": branch.id,
                "branch_name": branch.name,
                "branch_code": branch.code,
                "member_count": member_count,
                "loan_count": loan_count,
                "total_disbursed": float(total_disbursed),
                "total_collected": float(total_collected),
                "default_rate": default_rate
            })
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

def _get_period_dates(period: str):
    today = date.today()
    if period == "this_month":
        start = today.replace(day=1)
        end = today
    elif period == "last_month":
        first_of_this_month = today.replace(day=1)
        end = first_of_this_month - timedelta(days=1)
        start = end.replace(day=1)
    elif period == "this_quarter":
        q = (today.month - 1) // 3
        start = today.replace(month=q * 3 + 1, day=1)
        end = today
    elif period == "this_year":
        start = today.replace(month=1, day=1)
        end = today
    else:
        start = None
        end = None
    return start, end

def _compute_score(role: str, loans_processed: int, loans_approved: int, loans_rejected: int,
                   default_count: int, disbursed_loan_count: int,
                   transactions_processed: int, attendance_days: int, attendance_rate: float,
                   disciplinary_count: int) -> dict:
    import math

    def clamp(v, lo=0, hi=100):
        return max(lo, min(hi, v))

    # ── Sub-metric scores (each 0–100) ─────────────────────────────────────────
    # Portfolio Quality: penalises 5 points per 1% default rate.
    # Formula: 100 − (defaults / disbursed_loans × 100) × 5, clamped 0–100.
    # If no disbursed loans exist the officer has a clean (100) portfolio.
    default_rate_pct = (default_count / disbursed_loan_count * 100) if disbursed_loan_count > 0 else 0
    portfolio_quality = clamp(100 - default_rate_pct * 5)

    # Loan Throughput: logarithmic scale benchmarked at 50 loans = 100 points.
    # Formula: ln(1 + loans) / ln(1 + 50) × 100, clamped 0–100.
    loan_throughput = clamp(math.log1p(loans_processed) / math.log1p(50) * 100) if loans_processed > 0 else 0

    # Transaction Throughput: logarithmic scale benchmarked at 200 txns = 100 pts.
    # Formula: ln(1 + txns) / ln(1 + 200) × 100, clamped 0–100.
    txn_throughput = clamp(math.log1p(transactions_processed) / math.log1p(200) * 100) if transactions_processed > 0 else 0

    # Attendance: direct percentage — present+late+half_day days / total recorded days × 100.
    # If no attendance records exist the component is treated as "not tracked" and
    # its weight is redistributed to the remaining components proportionally.
    has_attendance = attendance_days > 0
    attendance_score = clamp(attendance_rate) if has_attendance else None

    # Disciplinary: 25-point deduction per open (unresolved) incident.
    # Formula: 100 − (open_incidents × 25), clamped 0–100.
    disciplinary_score = clamp(100 - disciplinary_count * 25)

    # ── Role-based weights (must sum to 1.00) ──────────────────────────────────
    role_lower = (role or "").lower()
    if role_lower == "loan_officer":
        base_weights = {"portfolio": 0.35, "loan_vol": 0.30, "txn": 0.05, "attendance": 0.20, "disciplinary": 0.10}
    elif role_lower == "teller":
        base_weights = {"portfolio": 0.05, "loan_vol": 0.10, "txn": 0.45, "attendance": 0.25, "disciplinary": 0.15}
    elif role_lower == "reviewer":
        base_weights = {"portfolio": 0.30, "loan_vol": 0.25, "txn": 0.05, "attendance": 0.25, "disciplinary": 0.15}
    elif role_lower in ("hr", "admin"):
        base_weights = {"portfolio": 0.00, "loan_vol": 0.00, "txn": 0.10, "attendance": 0.55, "disciplinary": 0.35}
    else:
        base_weights = {"portfolio": 0.15, "loan_vol": 0.15, "txn": 0.15, "attendance": 0.40, "disciplinary": 0.15}

    # Redistribute the attendance weight if attendance is not tracked this period
    if not has_attendance and base_weights["attendance"] > 0:
        freed = base_weights["attendance"]
        remaining_keys = [k for k in base_weights if k != "attendance"]
        remaining_total = sum(base_weights[k] for k in remaining_keys)
        weights = {}
        for k in base_weights:
            if k == "attendance":
                weights[k] = 0.0
            else:
                # Distribute freed weight proportionally among remaining components
                weights[k] = round(base_weights[k] + freed * (base_weights[k] / remaining_total) if remaining_total > 0 else base_weights[k], 4)
    else:
        weights = base_weights

    # ── Final weighted score ────────────────────────────────────────────────────
    score = (
        portfolio_quality   * weights["portfolio"] +
        loan_throughput     * weights["loan_vol"] +
        txn_throughput      * weights["txn"] +
        (attendance_score if attendance_score is not None else 0) * weights["attendance"] +
        disciplinary_score  * weights["disciplinary"]
    )

    return {
        "score": round(clamp(score), 1),
        "breakdown": {
            "portfolio_quality": round(portfolio_quality, 1),
            "loan_throughput": round(loan_throughput, 1),
            "txn_throughput": round(txn_throughput, 1),
            "attendance": round(attendance_score, 1) if attendance_score is not None else None,
            "disciplinary": round(disciplinary_score, 1),
        },
        "weights": {k: round(v * 100) for k, v in weights.items()},
        "base_weights": {k: round(v * 100) for k, v in base_weights.items()},
        "attendance_tracked": has_attendance,
        "default_rate": round(default_rate_pct, 1),
    }

@router.get("/{org_id}/analytics/staff")
async def get_staff_performance(org_id: str, period: str = "this_month", user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "analytics:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        start_date, end_date = _get_period_dates(period)
        staff_list = tenant_session.query(Staff).filter(Staff.is_active == True).all()

        result = []
        for staff in staff_list:
            loan_q = tenant_session.query(LoanApplication).filter(LoanApplication.created_by_id == staff.id)
            if start_date:
                loan_q = loan_q.filter(func.date(LoanApplication.applied_at) >= start_date)
            if end_date:
                loan_q = loan_q.filter(func.date(LoanApplication.applied_at) <= end_date)
            created_loans = loan_q.all()

            reviewed_q = tenant_session.query(LoanApplication).filter(LoanApplication.reviewed_by_id == staff.id)
            if start_date:
                reviewed_q = reviewed_q.filter(func.date(LoanApplication.applied_at) >= start_date)
            if end_date:
                reviewed_q = reviewed_q.filter(func.date(LoanApplication.applied_at) <= end_date)
            reviewed_loans = reviewed_q.all()

            loans_processed = len(created_loans)
            loans_approved = sum(1 for l in reviewed_loans if l.status in ["approved", "disbursed", "paid"])
            loans_rejected = sum(1 for l in reviewed_loans if l.status == "rejected")
            disbursed_by_staff = [l for l in created_loans if l.status in ["disbursed", "paid", "defaulted", "written_off"]]
            disbursed_loan_count = len(disbursed_by_staff)
            default_count = sum(1 for l in disbursed_by_staff if l.status in ["defaulted", "written_off"])
            total_disbursed = sum(l.amount_disbursed or Decimal("0") for l in disbursed_by_staff)

            staff_loan_ids = [str(l.id) for l in created_loans]
            if staff_loan_ids:
                rep_q = tenant_session.query(
                    func.coalesce(func.sum(LoanRepayment.principal_amount), 0),
                    func.coalesce(func.sum(LoanRepayment.interest_amount), 0),
                    func.coalesce(func.sum(LoanRepayment.penalty_amount), 0)
                ).filter(LoanRepayment.loan_id.in_(staff_loan_ids))
                if start_date:
                    rep_q = rep_q.filter(func.date(LoanRepayment.payment_date) >= start_date)
                if end_date:
                    rep_q = rep_q.filter(func.date(LoanRepayment.payment_date) <= end_date)
                rep_sums = rep_q.first()
                total_collected = Decimal(str(rep_sums[0])) + Decimal(str(rep_sums[1])) + Decimal(str(rep_sums[2]))
            else:
                total_collected = Decimal("0")

            txn_q = tenant_session.query(Transaction).filter(Transaction.processed_by_id == staff.id)
            if start_date:
                txn_q = txn_q.filter(func.date(Transaction.created_at) >= start_date)
            if end_date:
                txn_q = txn_q.filter(func.date(Transaction.created_at) <= end_date)
            txns = txn_q.all()
            transactions_processed = len(txns)
            transaction_volume = float(sum(t.amount or Decimal("0") for t in txns))

            att_q = tenant_session.query(Attendance).filter(Attendance.staff_id == staff.id)
            if start_date:
                att_q = att_q.filter(Attendance.date >= start_date)
            if end_date:
                att_q = att_q.filter(Attendance.date <= end_date)
            att_records = att_q.all()
            attendance_days = len(att_records)
            present_days = sum(1 for a in att_records if a.status in ("present", "late", "half_day"))
            late_count = sum(1 for a in att_records if a.status == "late")
            attendance_rate = round((present_days / attendance_days * 100) if attendance_days > 0 else 0, 1)

            disc_q = tenant_session.query(DisciplinaryRecord).filter(
                DisciplinaryRecord.staff_id == staff.id,
                DisciplinaryRecord.is_resolved == False
            )
            if start_date:
                disc_q = disc_q.filter(DisciplinaryRecord.incident_date >= start_date)
            if end_date:
                disc_q = disc_q.filter(DisciplinaryRecord.incident_date <= end_date)
            disciplinary_count = disc_q.count()

            score_data = _compute_score(
                role=staff.role,
                loans_processed=loans_processed,
                loans_approved=loans_approved,
                loans_rejected=loans_rejected,
                default_count=default_count,
                disbursed_loan_count=disbursed_loan_count,
                transactions_processed=transactions_processed,
                attendance_days=attendance_days,
                attendance_rate=attendance_rate,
                disciplinary_count=disciplinary_count,
            )

            result.append({
                "staff_id": staff.id,
                "staff_name": f"{staff.first_name} {staff.last_name}",
                "staff_number": staff.staff_number,
                "role": staff.role,
                "loans_processed": loans_processed,
                "loans_approved": loans_approved,
                "loans_rejected": loans_rejected,
                "disbursed_loan_count": disbursed_loan_count,
                "default_count": default_count,
                "total_disbursed": float(total_disbursed),
                "total_collected": float(total_collected),
                "transactions_processed": transactions_processed,
                "transaction_volume": transaction_volume,
                "attendance_days": attendance_days,
                "present_days": present_days,
                "late_count": late_count,
                "attendance_rate": attendance_rate,
                "disciplinary_count": disciplinary_count,
                "performance_score": score_data["score"],
                "score_breakdown": score_data["breakdown"],
                "score_weights": score_data["weights"],
                "base_weights": score_data["base_weights"],
                "attendance_tracked": score_data["attendance_tracked"],
                "default_rate": score_data["default_rate"],
            })

        result.sort(key=lambda x: x["performance_score"], reverse=True)
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/analytics/trends")
async def get_trends(org_id: str, period: str = "monthly", user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "analytics:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        today = date.today()
        
        if period == "daily":
            start_date = today - timedelta(days=30)
            date_format = "%Y-%m-%d"
        elif period == "weekly":
            start_date = today - timedelta(weeks=12)
            date_format = "%Y-W%W"
        else:
            start_date = today - timedelta(days=365)
            date_format = "%Y-%m"
        
        loans = tenant_session.query(LoanApplication).filter(
            func.date(LoanApplication.applied_at) >= start_date
        ).all()
        
        applications_by_period = {}
        disbursements_by_period = {}
        
        for loan in loans:
            period_key = loan.applied_at.strftime(date_format)
            applications_by_period[period_key] = applications_by_period.get(period_key, 0) + 1
            
            if loan.disbursed_at:
                disb_period = loan.disbursed_at.strftime(date_format)
                if disb_period not in disbursements_by_period:
                    disbursements_by_period[disb_period] = {"count": 0, "amount": Decimal("0")}
                disbursements_by_period[disb_period]["count"] += 1
                disbursements_by_period[disb_period]["amount"] += loan.amount_disbursed or Decimal("0")
        
        repayments = tenant_session.query(LoanRepayment).filter(
            func.date(LoanRepayment.payment_date) >= start_date
        ).all()
        
        collections_by_period = {}
        for rep in repayments:
            period_key = rep.payment_date.strftime(date_format)
            if period_key not in collections_by_period:
                collections_by_period[period_key] = {"count": 0, "amount": Decimal("0")}
            collections_by_period[period_key]["count"] += 1
            collections_by_period[period_key]["amount"] += rep.amount
        
        return {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": today.isoformat(),
            "applications": applications_by_period,
            "disbursements": {k: {"count": v["count"], "amount": float(v["amount"])} for k, v in disbursements_by_period.items()},
            "collections": {k: {"count": v["count"], "amount": float(v["amount"])} for k, v in collections_by_period.items()}
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/analytics/institution-health")
async def get_institution_health(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "analytics:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        members = tenant_session.query(Member).filter(Member.is_active == True).all()
        total_member_funds = sum(
            (m.savings_balance or Decimal("0")) + 
            (m.shares_balance or Decimal("0")) + 
            (m.deposits_balance or Decimal("0")) 
            for m in members
        )
        
        loans = tenant_session.query(LoanApplication).filter(LoanApplication.status == "disbursed").all()
        total_loan_portfolio = sum(l.outstanding_balance or Decimal("0") for l in loans)
        
        defaults = tenant_session.query(LoanDefault).filter(LoanDefault.status.in_(["overdue", "in_collection"])).all()
        total_at_risk = sum(d.amount_overdue for d in defaults)
        
        if total_loan_portfolio > 0:
            par_ratio = float(total_at_risk / total_loan_portfolio * 100)
        else:
            par_ratio = 0
        
        if total_member_funds > 0:
            loan_to_deposit_ratio = float(total_loan_portfolio / total_member_funds * 100)
        else:
            loan_to_deposit_ratio = 0
        
        today = date.today()

        # Collection efficiency based on instalments that were actually due up to today
        loan_ids = [l.id for l in loans]
        if loan_ids:
            due_row = tenant_session.query(
                func.sum(LoanInstalment.expected_principal + LoanInstalment.expected_interest),
                func.sum(LoanInstalment.paid_principal + LoanInstalment.paid_interest),
            ).filter(
                LoanInstalment.loan_id.in_(loan_ids),
                LoanInstalment.due_date <= today,
            ).first()
            expected_due = Decimal(str(due_row[0] or 0))
            actually_paid = Decimal(str(due_row[1] or 0))
            if expected_due > 0:
                collection_efficiency = float(actually_paid / expected_due * 100)
            else:
                # Loans exist but no instalments are due yet (e.g. freshly disbursed) — neutral
                collection_efficiency = 80
        else:
            # No active loans — nothing to collect, neutral
            collection_efficiency = 80

        health_score = 100
        if par_ratio > 5:
            # No cap: higher PAR = proportionally larger hit (max theoretical loss = 200pts, clamped to 0)
            health_score -= par_ratio * 2
        if loan_to_deposit_ratio > 80:
            health_score -= (loan_to_deposit_ratio - 80) / 2
        if collection_efficiency < 80:
            health_score -= (80 - collection_efficiency) / 2

        health_score = max(0, min(100, health_score))
        
        return {
            "health_score": round(health_score, 1),
            "health_status": "excellent" if health_score >= 80 else "good" if health_score >= 60 else "fair" if health_score >= 40 else "poor",
            "metrics": {
                "total_member_funds": float(total_member_funds),
                "total_loan_portfolio": float(total_loan_portfolio),
                "portfolio_at_risk": float(total_at_risk),
                "par_ratio": round(par_ratio, 2),
                "loan_to_deposit_ratio": round(loan_to_deposit_ratio, 2),
                "collection_efficiency": round(collection_efficiency, 2)
            },
            "member_stats": {
                "total_active": len(members),
                "average_savings": float(sum(m.savings_balance or Decimal("0") for m in members) / len(members)) if members else 0
            },
            "loan_stats": {
                "active_loans": len(loans),
                "average_loan_size": float(sum(l.amount for l in loans) / len(loans)) if loans else 0,
                "default_count": len(defaults)
            }
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()
