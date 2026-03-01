"""
Mobile Soft Loan API
GET  /me/soft-loan/eligibility  — returns member's personal limit + breakdown
POST /me/soft-loan/apply        — instant-approve a soft loan
"""

from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import secrets

from .deps import get_current_member

router = APIRouter()


def _calculate_eligibility(member, config, ts):
    from models.tenant import LoanApplication, LoanInstalment, Transaction

    result = {
        "eligible": False,
        "limit": 0.0,
        "base_amount": float(config.base_amount or 0),
        "global_max": float(config.global_max_amount or 0),
        "breakdown": [],
        "gates_passed": True,
        "gate_failures": [],
        "interest_rate": float(config.interest_rate or 10),
        "term_months": 1,
    }

    # Hard Gates
    if config.gate_active_member and member.status != "active":
        result["gate_failures"].append("Your account must be active")
        result["gates_passed"] = False

    if config.gate_no_active_soft_loan:
        active_soft = ts.query(LoanApplication).filter(
            LoanApplication.member_id == member.id,
            LoanApplication.is_soft_loan == True,
            LoanApplication.status.in_(["pending", "approved", "active", "disbursed"]),
        ).first()
        if active_soft:
            result["gate_failures"].append("You already have an active soft loan")
            result["gates_passed"] = False

    if config.gate_min_membership_months and config.gate_min_membership_months > 0:
        joined = member.joined_at or member.created_at or datetime.utcnow()
        months_as_member = (datetime.utcnow() - joined).days / 30.44
        if months_as_member < config.gate_min_membership_months:
            result["gate_failures"].append(
                f"Must be a member for at least {config.gate_min_membership_months} months"
            )
            result["gates_passed"] = False

    if not result["gates_passed"]:
        return result

    limit = float(config.base_amount or 0)

    # F1: Savings balance threshold
    if config.f1_enabled:
        savings = float(member.savings_balance or 0)
        qualifies = savings >= float(config.f1_min_savings or 0)
        contribution = float(config.f1_contribution or 0) if qualifies else 0.0
        result["breakdown"].append({
            "formula": "Savings Balance",
            "description": f"Savings ≥ {_fmt(config.f1_min_savings)}",
            "qualifies": qualifies,
            "contribution": contribution,
        })
        limit += contribution

    # F2: Share capital threshold
    if config.f2_enabled:
        shares = float(member.shares_balance or 0)
        qualifies = shares >= float(config.f2_min_shares or 0)
        contribution = float(config.f2_contribution or 0) if qualifies else 0.0
        result["breakdown"].append({
            "formula": "Share Capital",
            "description": f"Shares ≥ {_fmt(config.f2_min_shares)}",
            "qualifies": qualifies,
            "contribution": contribution,
        })
        limit += contribution

    # F3: No overdue instalments
    if config.f3_enabled:
        overdue = ts.query(LoanInstalment).join(
            LoanApplication, LoanInstalment.loan_id == LoanApplication.id
        ).filter(
            LoanApplication.member_id == member.id,
            LoanInstalment.status == "overdue",
        ).first()
        qualifies = overdue is None
        contribution = float(config.f3_contribution or 0) if qualifies else 0.0
        result["breakdown"].append({
            "formula": "No Overdue Instalments",
            "description": "No missed or overdue loan payments",
            "qualifies": qualifies,
            "contribution": contribution,
        })
        limit += contribution

    # F4: Has fully repaid at least one loan
    if config.f4_enabled:
        repaid = ts.query(LoanApplication).filter(
            LoanApplication.member_id == member.id,
            LoanApplication.status == "completed",
        ).first()
        qualifies = repaid is not None
        contribution = float(config.f4_contribution or 0) if qualifies else 0.0
        result["breakdown"].append({
            "formula": "Good Repayment History",
            "description": "Has fully repaid at least one loan",
            "qualifies": qualifies,
            "contribution": contribution,
        })
        limit += contribution

    # F5: Consistent monthly savings deposits
    if config.f5_enabled:
        months_to_check = int(config.f5_months or 3)
        today = date.today()
        qualifies = True
        for i in range(1, months_to_check + 1):
            month_start = (today - relativedelta(months=i)).replace(day=1)
            month_end = (today - relativedelta(months=i - 1)).replace(day=1)
            deposit = ts.query(Transaction).filter(
                Transaction.member_id == member.id,
                Transaction.transaction_type.in_(["savings_deposit", "deposit", "saving"]),
                Transaction.created_at >= datetime.combine(month_start, datetime.min.time()),
                Transaction.created_at < datetime.combine(month_end, datetime.min.time()),
            ).first()
            if not deposit:
                qualifies = False
                break
        contribution = float(config.f5_contribution or 0) if qualifies else 0.0
        result["breakdown"].append({
            "formula": "Consistent Savings",
            "description": f"Deposited savings every month for last {months_to_check} months",
            "qualifies": qualifies,
            "contribution": contribution,
        })
        limit += contribution

    # F6: Long-term member
    if config.f6_enabled:
        joined = member.joined_at or member.created_at or datetime.utcnow()
        months_as_member = (datetime.utcnow() - joined).days / 30.44
        required_months = int(config.f6_months or 12)
        qualifies = months_as_member >= required_months
        contribution = float(config.f6_contribution or 0) if qualifies else 0.0
        result["breakdown"].append({
            "formula": "Long-term Member",
            "description": f"Member for {required_months}+ months",
            "qualifies": qualifies,
            "contribution": contribution,
        })
        limit += contribution

    # F7: High transaction activity (last 3 months)
    if config.f7_enabled:
        three_months_ago = datetime.utcnow() - relativedelta(months=3)
        tx_count = ts.query(Transaction).filter(
            Transaction.member_id == member.id,
            Transaction.created_at >= three_months_ago,
        ).count()
        min_tx = int(config.f7_min_transactions or 5)
        qualifies = tx_count >= min_tx
        contribution = float(config.f7_contribution or 0) if qualifies else 0.0
        result["breakdown"].append({
            "formula": "Active Member",
            "description": f"At least {min_tx} transactions in the last 3 months",
            "qualifies": qualifies,
            "contribution": contribution,
        })
        limit += contribution

    # Cap at global max
    limit = min(limit, float(config.global_max_amount or 0))
    result["eligible"] = limit > 0
    result["limit"] = round(limit, 2)
    return result


def _fmt(value):
    try:
        return f"{float(value):,.0f}"
    except Exception:
        return str(value)


@router.get("/me/soft-loan/eligibility")
def get_soft_loan_eligibility(ctx: dict = Depends(get_current_member)):
    from models.tenant import SoftLoanConfig

    member = ctx["member"]
    ts = ctx["session"]

    try:
        config = ts.query(SoftLoanConfig).first()
        if not config or not config.is_enabled:
            return {
                "enabled": False,
                "eligible": False,
                "limit": 0,
                "breakdown": [],
                "gate_failures": [],
                "message": "Soft loans are not available for this organisation.",
            }

        eligibility = _calculate_eligibility(member, config, ts)
        eligibility["enabled"] = True
        return eligibility
    finally:
        ts.close()


class SoftLoanApplyRequest(BaseModel):
    amount: float
    purpose: Optional[str] = None
    disbursement_method: Optional[str] = "mpesa"
    disbursement_phone: Optional[str] = None
    disbursement_account: Optional[str] = None


@router.post("/me/soft-loan/apply")
def apply_soft_loan(data: SoftLoanApplyRequest, ctx: dict = Depends(get_current_member)):
    from models.tenant import SoftLoanConfig, LoanApplication, LoanProduct

    member = ctx["member"]
    ts = ctx["session"]

    try:
        config = ts.query(SoftLoanConfig).first()
        if not config or not config.is_enabled:
            raise HTTPException(status_code=400, detail="Soft loans are not enabled")

        eligibility = _calculate_eligibility(member, config, ts)
        if not eligibility["gates_passed"]:
            raise HTTPException(
                status_code=400,
                detail=eligibility["gate_failures"][0] if eligibility["gate_failures"] else "Not eligible",
            )

        if data.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0")

        if data.amount > eligibility["limit"]:
            raise HTTPException(
                status_code=400,
                detail=f"Amount exceeds your soft loan limit of {eligibility['limit']:,.2f}",
            )

        # Re-check for an existing active soft loan inside the transaction
        # (guards against concurrent requests slipping through the eligibility check)
        duplicate = ts.query(LoanApplication).filter(
            LoanApplication.member_id == member.id,
            LoanApplication.is_soft_loan == True,
            LoanApplication.status.in_(["pending", "approved", "active", "disbursed"]),
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="You already have an active soft loan")

        # Find or use any active loan product — soft loans are standalone
        soft_product = ts.query(LoanProduct).filter(
            LoanProduct.is_active == True
        ).first()
        if not soft_product:
            raise HTTPException(status_code=400, detail="No active loan product configured")

        interest_rate = float(config.interest_rate or 10)
        term_months = 1
        total_interest = round((data.amount * interest_rate / 100) * term_months, 2)
        total_repayment = round(data.amount + total_interest, 2)
        monthly_repayment = total_repayment

        app_number = f"SL-{secrets.token_hex(4).upper()}"

        loan = LoanApplication(
            application_number=app_number,
            member_id=member.id,
            loan_product_id=soft_product.id,
            amount=data.amount,
            term_months=term_months,
            interest_rate=interest_rate,
            total_interest=total_interest,
            total_repayment=total_repayment,
            monthly_repayment=monthly_repayment,
            purpose=data.purpose or "Soft Loan",
            disbursement_method=data.disbursement_method,
            disbursement_phone=data.disbursement_phone or member.phone,
            disbursement_account=data.disbursement_account,
            status="approved",
            is_soft_loan=True,
            applied_at=datetime.utcnow(),
            approved_at=datetime.utcnow(),
        )
        ts.add(loan)
        ts.commit()
        ts.refresh(loan)

        return {
            "success": True,
            "message": "Soft loan approved instantly.",
            "application_number": loan.application_number,
            "id": loan.id,
            "amount": data.amount,
            "interest_rate": interest_rate,
            "total_interest": total_interest,
            "total_repayment": total_repayment,
            "monthly_repayment": monthly_repayment,
            "term_months": term_months,
            "status": "approved",
        }
    except HTTPException:
        ts.rollback()
        raise
    except Exception as e:
        ts.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        ts.close()
