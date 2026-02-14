from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List
from decimal import Decimal
from datetime import datetime, timedelta, date
from models.database import get_db
from models.tenant import LoanApplication, LoanDefault, Member, LoanRepayment
from schemas.tenant import LoanDefaultResponse, LoanDefaultUpdate, LoanDefaultLoanInfo, LoanDefaultMemberInfo
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission

router = APIRouter()

def post_write_off_to_gl(tenant_session, loan, amount: Decimal, reason: str):
    """Post loan write-off to General Ledger"""
    try:
        from accounting.service import AccountingService
        
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        lines = [
            {"account_code": "5030", "debit": amount, "credit": Decimal("0"), "loan_id": str(loan.id), "memo": "Bad debt expense"},
            {"account_code": "1100", "debit": Decimal("0"), "credit": amount, "loan_id": str(loan.id), "memo": "Loan written off"}
        ]
        
        svc.create_journal_entry(
            entry_date=date.today(),
            description=f"Loan write-off - {loan.application_number} - {reason}",
            source_type="loan_write_off",
            source_id=str(loan.id),
            lines=lines
        )
        print(f"[GL] Posted loan write-off to GL: {loan.application_number}")
    except Exception as e:
        print(f"[GL] Failed to post loan write-off to GL: {e}")

def calculate_overdue_for_loan(loan):
    """Calculate overdue using stored data: instalment minus partial payments.
    Uses amount_repaid modulo instalment to find what's left on the current period."""
    instalment = loan.monthly_repayment or Decimal("0")
    if instalment <= 0:
        return Decimal("0")
    
    amount_repaid = loan.amount_repaid or Decimal("0")
    outstanding = loan.outstanding_balance or Decimal("0")
    
    partial_payment = amount_repaid % instalment
    amount_owed = instalment - partial_payment if partial_payment > 0 else instalment
    
    return min(amount_owed, outstanding)

def check_and_create_defaults(tenant_session):
    """Detect overdue loans and create/update default records.
    Uses batched queries to avoid N+1 performance issues."""
    today = date.today()
    from models.tenant import LoanInstalment
    from collections import defaultdict

    active_loans = tenant_session.query(LoanApplication).options(
        joinedload(LoanApplication.loan_product)
    ).filter(
        LoanApplication.status.in_(["disbursed", "defaulted", "restructured"]),
        LoanApplication.outstanding_balance > 0
    ).all()

    if not active_loans:
        return

    all_loan_ids_str = [str(loan.id) for loan in active_loans]

    past_due_pending = tenant_session.query(LoanInstalment).filter(
        LoanInstalment.loan_id.in_(all_loan_ids_str),
        LoanInstalment.due_date < today,
        LoanInstalment.status.in_(["pending", "partial"])
    ).all()
    for inst in past_due_pending:
        if inst.status == "pending":
            inst.status = "overdue"
    if past_due_pending:
        tenant_session.flush()

    all_overdue_insts = tenant_session.query(LoanInstalment).filter(
        LoanInstalment.loan_id.in_(all_loan_ids_str),
        LoanInstalment.due_date < today,
        LoanInstalment.status.in_(["overdue", "partial"])
    ).order_by(LoanInstalment.due_date.asc()).all()

    insts_by_loan = defaultdict(list)
    for inst in all_overdue_insts:
        insts_by_loan[inst.loan_id].append(inst)

    overdue_loans = [l for l in active_loans if str(l.id) in insts_by_loan]

    if not overdue_loans:
        return

    loan_ids = [loan.id for loan in overdue_loans]
    existing_defaults = tenant_session.query(LoanDefault).filter(
        LoanDefault.loan_id.in_(loan_ids),
        LoanDefault.status.in_(["overdue", "in_collection"])
    ).all()
    defaults_by_loan = {d.loan_id: d for d in existing_defaults}

    for loan in overdue_loans:
        existing_default = defaults_by_loan.get(loan.id)
        loan_insts = insts_by_loan.get(str(loan.id), [])

        if loan_insts:
            earliest_date = loan_insts[0].due_date
            days_overdue = (today - earliest_date).days
            amount_overdue = sum(
                (i.expected_principal + i.expected_interest + i.expected_penalty) -
                (i.paid_principal + i.paid_interest + i.paid_penalty)
                for i in loan_insts
            )
        else:
            days_overdue = (today - loan.next_payment_date).days if loan.next_payment_date and loan.next_payment_date < today else 0
            amount_overdue = calculate_overdue_for_loan(loan)

        if amount_overdue <= 0:
            if existing_default:
                existing_default.status = "resolved"
                existing_default.resolved_at = datetime.utcnow()
            continue

        penalty_rate = Decimal("0")
        if loan.loan_product and loan.loan_product.late_payment_penalty:
            penalty_rate = loan.loan_product.late_payment_penalty

        penalty_amount = amount_overdue * penalty_rate / Decimal("100")

        if not existing_default:
            default_record = LoanDefault(
                loan_id=loan.id,
                days_overdue=days_overdue,
                amount_overdue=amount_overdue,
                penalty_amount=penalty_amount,
                status="overdue"
            )
            tenant_session.add(default_record)
        else:
            existing_default.days_overdue = days_overdue
            existing_default.amount_overdue = amount_overdue
            existing_default.penalty_amount = penalty_amount

    tenant_session.commit()

def serialize_default_with_loan(d):
    data = {
        "id": str(d.id),
        "loan_id": str(d.loan_id),
        "days_overdue": d.days_overdue,
        "amount_overdue": d.amount_overdue,
        "penalty_amount": d.penalty_amount or Decimal("0"),
        "status": d.status,
        "collection_notes": d.collection_notes,
        "last_contact_date": d.last_contact_date,
        "next_action_date": d.next_action_date,
        "assigned_to_id": d.assigned_to_id,
        "resolved_at": d.resolved_at,
        "created_at": d.created_at,
        "loan": None,
    }
    if d.loan:
        loan_info = {
            "application_number": d.loan.application_number,
            "amount": d.loan.amount,
            "outstanding_balance": d.loan.outstanding_balance,
            "member": None,
        }
        if d.loan.member:
            loan_info["member"] = {
                "first_name": d.loan.member.first_name,
                "last_name": d.loan.member.last_name,
                "phone": getattr(d.loan.member, "phone", None),
                "member_number": getattr(d.loan.member, "member_number", None),
            }
        data["loan"] = loan_info
    return data

@router.get("/{org_id}/defaults")
async def list_defaults(org_id: str, status: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "defaults:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        check_and_create_defaults(tenant_session)
        
        query = tenant_session.query(LoanDefault).options(
            joinedload(LoanDefault.loan).joinedload(LoanApplication.member)
        )
        if status:
            query = query.filter(LoanDefault.status == status)
        
        defaults = query.order_by(LoanDefault.days_overdue.desc()).all()
        return [serialize_default_with_loan(d) for d in defaults]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/defaults/summary")
async def get_defaults_summary(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "defaults:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        check_and_create_defaults(tenant_session)
        
        active_filter = LoanDefault.status.in_(["overdue", "in_collection"])
        
        results = tenant_session.query(
            func.count(LoanDefault.id).filter(LoanDefault.status == "overdue").label("total_overdue"),
            func.count(LoanDefault.id).filter(LoanDefault.status == "in_collection").label("total_in_collection"),
            func.coalesce(func.sum(LoanDefault.amount_overdue).filter(active_filter), 0).label("total_amount_overdue"),
            func.coalesce(func.sum(LoanDefault.penalty_amount).filter(active_filter), 0).label("total_penalties"),
            func.count(LoanDefault.id).filter(active_filter, LoanDefault.days_overdue > 90).label("critical"),
            func.count(LoanDefault.id).filter(active_filter, LoanDefault.days_overdue.between(1, 30)).label("aging_1_30"),
            func.count(LoanDefault.id).filter(active_filter, LoanDefault.days_overdue.between(31, 60)).label("aging_31_60"),
            func.count(LoanDefault.id).filter(active_filter, LoanDefault.days_overdue.between(61, 90)).label("aging_61_90"),
            func.count(LoanDefault.id).filter(active_filter, LoanDefault.days_overdue > 90).label("aging_over_90"),
        ).first()
        
        return {
            "total_defaulted": (results.total_overdue or 0) + (results.total_in_collection or 0),
            "total_overdue": results.total_overdue or 0,
            "total_in_collection": results.total_in_collection or 0,
            "total_amount_overdue": float(results.total_amount_overdue or 0),
            "total_penalties": float(results.total_penalties or 0),
            "critical_defaults": results.critical or 0,
            "by_aging": {
                "1_30_days": results.aging_1_30 or 0,
                "31_60_days": results.aging_31_60 or 0,
                "61_90_days": results.aging_61_90 or 0,
                "over_90_days": results.aging_over_90 or 0,
            }
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/defaults/due-today")
async def get_due_today(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "defaults:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        today = date.today()
        
        from models.tenant import LoanInstalment
        
        active_statuses = ["disbursed", "defaulted", "restructured"]
        
        active_loans = tenant_session.query(LoanApplication).options(
            joinedload(LoanApplication.member),
            joinedload(LoanApplication.loan_product)
        ).filter(
            LoanApplication.status.in_(active_statuses),
            LoanApplication.outstanding_balance > 0
        ).all()
        
        active_loan_ids = [str(l.id) for l in active_loans]
        
        due_today_insts = []
        overdue_insts_list = []
        if active_loan_ids:
            due_today_insts = tenant_session.query(LoanInstalment).filter(
                LoanInstalment.loan_id.in_(active_loan_ids),
                LoanInstalment.due_date == today,
                LoanInstalment.status.in_(["pending", "partial", "overdue"])
            ).all()
            
            overdue_insts_list = tenant_session.query(LoanInstalment).filter(
                LoanInstalment.loan_id.in_(active_loan_ids),
                LoanInstalment.due_date < today,
                LoanInstalment.status.in_(["pending", "partial", "overdue"])
            ).all()
        
        due_today_loan_ids = set(i.loan_id for i in due_today_insts)
        overdue_loan_ids = set(i.loan_id for i in overdue_insts_list)
        
        loans_by_id = {str(l.id): l for l in active_loans}
        due_today_loans = [loans_by_id[lid] for lid in due_today_loan_ids if lid in loans_by_id]
        overdue_loans = [loans_by_id[lid] for lid in overdue_loan_ids if lid in loans_by_id]
        
        def serialize_loan(loan, is_overdue):
            instalment = loan.monthly_repayment or Decimal("0")
            
            freq = "monthly"
            if loan.loan_product:
                freq = getattr(loan.loan_product, "repayment_frequency", "monthly") or "monthly"
            
            if is_overdue:
                overdue_insts = tenant_session.query(LoanInstalment).filter(
                    LoanInstalment.loan_id == str(loan.id),
                    LoanInstalment.status.in_(["overdue", "partial"]),
                    LoanInstalment.due_date < today
                ).order_by(LoanInstalment.instalment_number).all()
                
                if overdue_insts:
                    amount_due = sum(
                        (i.expected_principal + i.expected_interest + i.expected_penalty) -
                        (i.paid_principal + i.paid_interest + i.paid_penalty)
                        for i in overdue_insts
                    )
                    days_overdue = (today - overdue_insts[0].due_date).days if overdue_insts else 0
                else:
                    amount_due = float(instalment)
                    days_overdue = (today - loan.next_payment_date).days if loan.next_payment_date and loan.next_payment_date < today else 0
            else:
                days_overdue = 0
                due_inst = tenant_session.query(LoanInstalment).filter(
                    LoanInstalment.loan_id == str(loan.id),
                    LoanInstalment.due_date == today,
                    LoanInstalment.status.in_(["pending", "partial", "overdue"])
                ).first()
                
                if due_inst:
                    amount_due = float(
                        (due_inst.expected_principal + due_inst.expected_interest + due_inst.expected_penalty) -
                        (due_inst.paid_principal + due_inst.paid_interest + due_inst.paid_penalty)
                    )
                else:
                    amount_due = float(instalment)
            
            member_info = None
            if loan.member:
                member_info = {
                    "first_name": loan.member.first_name,
                    "last_name": loan.member.last_name,
                    "phone": getattr(loan.member, "phone", None),
                    "member_number": getattr(loan.member, "member_number", None),
                }
            
            return {
                "loan_id": str(loan.id),
                "application_number": loan.application_number,
                "member": member_info,
                "instalment_amount": float(instalment),
                "amount_due": float(amount_due),
                "outstanding_balance": float(loan.outstanding_balance or 0),
                "next_payment_date": str(loan.next_payment_date),
                "frequency": freq,
                "is_overdue": is_overdue,
                "days_overdue": days_overdue,
                "total_paid": float(loan.amount_repaid or 0),
            }
        
        result = {
            "due_today": [serialize_loan(l, False) for l in due_today_loans],
            "overdue": [serialize_loan(l, True) for l in overdue_loans],
        }
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/defaults/{default_id}")
async def get_default(org_id: str, default_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "defaults:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        default = tenant_session.query(LoanDefault).filter(LoanDefault.id == default_id).first()
        if not default:
            raise HTTPException(status_code=404, detail="Default record not found")
        return LoanDefaultResponse.model_validate(default)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/defaults/{default_id}")
async def update_default(org_id: str, default_id: str, data: LoanDefaultUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "defaults:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        default = tenant_session.query(LoanDefault).filter(LoanDefault.id == default_id).first()
        if not default:
            raise HTTPException(status_code=404, detail="Default record not found")
        
        if data.status:
            default.status = data.status
            if data.status == "resolved":
                default.resolved_at = datetime.utcnow()
        
        if data.collection_notes:
            default.collection_notes = data.collection_notes
            default.last_contact_date = datetime.utcnow()
        
        if data.next_action_date:
            default.next_action_date = data.next_action_date
        
        if data.assigned_to_id:
            default.assigned_to_id = data.assigned_to_id
        
        tenant_session.commit()
        tenant_session.refresh(default)
        return LoanDefaultResponse.model_validate(default)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/loans/{loan_id}/defaults")
async def get_loan_defaults(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        defaults = tenant_session.query(LoanDefault).filter(LoanDefault.loan_id == loan_id).order_by(LoanDefault.created_at.desc()).all()
        return [LoanDefaultResponse.model_validate(d) for d in defaults]
    finally:
        tenant_session.close()
        tenant_ctx.close()

from pydantic import BaseModel

class WriteOffRequest(BaseModel):
    reason: str

@router.post("/{org_id}/defaults/{default_id}/write-off")
async def write_off_loan(org_id: str, default_id: str, data: WriteOffRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Write off a defaulted loan as uncollectible"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "defaults:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        default = tenant_session.query(LoanDefault).filter(LoanDefault.id == default_id).first()
        if not default:
            raise HTTPException(status_code=404, detail="Default record not found")
        
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == default.loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        if loan.status == "written_off":
            raise HTTPException(status_code=400, detail="Loan has already been written off")
        
        write_off_amount = Decimal(str(loan.outstanding_balance or 0))
        
        default.status = "written_off"
        existing_notes = str(default.collection_notes or "")
        default.collection_notes = f"{existing_notes}\n[Write-off] {data.reason}".strip()
        default.resolved_at = datetime.utcnow()
        
        loan.status = "written_off"
        loan.outstanding_balance = Decimal("0")
        
        tenant_session.commit()
        
        post_write_off_to_gl(tenant_session, loan, write_off_amount, data.reason)
        
        return {
            "message": f"Loan {loan.application_number} written off successfully",
            "write_off_amount": float(write_off_amount)
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()
