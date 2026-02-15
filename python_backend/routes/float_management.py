from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel

from models.tenant import TellerFloat, FloatTransaction, Staff, Branch, ShortageRecord, SalaryDeduction, BranchVault, VaultTransaction, PendingVaultReturn, ShiftHandover
from models.database import get_db
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from services.feature_flags import check_org_feature

router = APIRouter()

def get_org_currency(session):
    from models.tenant import OrganizationSettings
    try:
        setting = session.query(OrganizationSettings).filter(OrganizationSettings.setting_key == "currency").first()
        return setting.setting_value if setting else "KES"
    except:
        return "KES"

def post_float_allocation_to_gl(tenant_session, staff_name: str, amount: Decimal, txn_type: str, branch_name: str = ""):
    """Post float allocation/return to General Ledger. Returns error message if failed, None if successful."""
    try:
        from accounting.service import AccountingService
        
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        timestamp = datetime.utcnow().strftime("%H%M%S")
        
        if txn_type == "allocation":
            lines = [
                {"account_code": "1020", "debit": amount, "credit": Decimal("0"), "memo": f"Float to {staff_name}"},
                {"account_code": "1030", "debit": Decimal("0"), "credit": amount, "memo": f"From vault - {branch_name}"}
            ]
            description = f"Float allocation - {staff_name}"
        elif txn_type == "return":
            lines = [
                {"account_code": "1030", "debit": amount, "credit": Decimal("0"), "memo": f"To vault - {branch_name}"},
                {"account_code": "1020", "debit": Decimal("0"), "credit": amount, "memo": f"From {staff_name}"}
            ]
            description = f"Float return - {staff_name}"
        elif txn_type == "vault_deposit":
            lines = [
                {"account_code": "1030", "debit": amount, "credit": Decimal("0"), "memo": f"Vault deposit - {branch_name}"},
                {"account_code": "1010", "debit": Decimal("0"), "credit": amount, "memo": "From bank"}
            ]
            description = f"Vault deposit - {branch_name}"
        else:
            return None
        
        svc.create_journal_entry(
            entry_date=date.today(),
            description=description,
            source_type=f"float_{txn_type}",
            source_id=f"{staff_name}_{date.today()}_{timestamp}",
            lines=lines
        )
        print(f"[GL] Posted float {txn_type} to GL: {staff_name}")
        return None
    except Exception as e:
        error_msg = f"GL posting failed for float {txn_type}: {str(e)}"
        print(f"[GL] {error_msg}")
        return error_msg

class AllocateFloatRequest(BaseModel):
    staff_id: str
    amount: float
    notes: Optional[str] = None

class ReplenishFloatRequest(BaseModel):
    amount: float
    notes: Optional[str] = None

class ReturnToVaultRequest(BaseModel):
    amount: float
    notes: Optional[str] = None

class ReconcileFloatRequest(BaseModel):
    physical_count: float
    notes: Optional[str] = None
    return_to_vault: bool = True

class ShortageDistribution(BaseModel):
    action: str  # "deduct", "hold", or "expense"
    amount: float

class ShortageApprovalRequest(BaseModel):
    staff_number: Optional[str] = None
    pin: str
    action: Optional[str] = None  # single action (backward compat)
    distributions: Optional[List[ShortageDistribution]] = None  # split across multiple actions
    notes: Optional[str] = None

class ReplenishmentRequestCreate(BaseModel):
    amount: float
    reason: str

class VaultDepositRequest(BaseModel):
    branch_id: str
    amount: float
    source: str  # bank_withdrawal, head_office, safe, other
    reference: Optional[str] = None
    notes: Optional[str] = None

class VaultReturnReviewRequest(BaseModel):
    action: str  # accept, reject
    notes: Optional[str] = None

class ShiftHandoverRequest(BaseModel):
    to_staff_id: str
    amount: float
    notes: Optional[str] = None

class SetApprovalPinRequest(BaseModel):
    pin: str

class ShiftHandoverAcknowledgeRequest(BaseModel):
    action: str  # accept, reject
    notes: Optional[str] = None

def get_or_create_branch_vault(session: Session, branch_id: str) -> BranchVault:
    vault = session.query(BranchVault).filter(BranchVault.branch_id == branch_id).first()
    if not vault:
        vault = BranchVault(branch_id=branch_id, current_balance=Decimal("0"))
        session.add(vault)
        session.commit()
        session.refresh(vault)
    return vault

def get_or_create_today_float(session: Session, staff_id: str, branch_id: str) -> TellerFloat:
    today = date.today()
    teller_float = session.query(TellerFloat).filter(
        and_(
            TellerFloat.staff_id == staff_id,
            TellerFloat.date == today
        )
    ).first()
    
    if not teller_float:
        yesterday = session.query(TellerFloat).filter(
            and_(
                TellerFloat.staff_id == staff_id,
                TellerFloat.date < today,
                TellerFloat.status == "reconciled"
            )
        ).order_by(TellerFloat.date.desc()).first()
        
        opening = Decimal("0")
        # Only carry forward balance if they didn't return to vault
        if yesterday and yesterday.closing_balance and not yesterday.returned_to_vault:
            opening = yesterday.closing_balance
        
        teller_float = TellerFloat(
            staff_id=staff_id,
            branch_id=branch_id,
            date=today,
            opening_balance=opening,
            current_balance=opening,
            status="open"
        )
        try:
            session.add(teller_float)
            session.commit()
            session.refresh(teller_float)
        except Exception:
            session.rollback()
            teller_float = session.query(TellerFloat).filter(
                and_(
                    TellerFloat.staff_id == staff_id,
                    TellerFloat.date == today
                )
            ).first()
    
    return teller_float

@router.get("/organizations/{org_id}/floats")
async def get_all_floats(
    org_id: str, 
    date_filter: Optional[str] = None,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not check_org_feature(org_id, "float_management", db):
        raise HTTPException(status_code=403, detail="Float management is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:read", db)
    session = tenant_ctx.create_session()
    
    try:
        query = session.query(TellerFloat)
        
        if date_filter:
            filter_date = datetime.strptime(date_filter, "%Y-%m-%d").date()
            query = query.filter(TellerFloat.date == filter_date)
        else:
            query = query.filter(TellerFloat.date == date.today())
        
        floats = query.all()
        
        result = []
        for f in floats:
            staff = session.query(Staff).filter(Staff.id == f.staff_id).first()
            # Only show floats for tellers
            if staff and staff.role != "teller":
                continue
            branch = session.query(Branch).filter(Branch.id == f.branch_id).first()
            result.append({
                "id": f.id,
                "staff_id": f.staff_id,
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else "Unknown",
                "branch_id": f.branch_id,
                "branch_name": branch.name if branch else "Unknown",
                "date": str(f.date),
                "opening_balance": float(f.opening_balance or 0),
                "current_balance": float(f.current_balance or 0),
                "deposits_in": float(f.deposits_in or 0),
                "withdrawals_out": float(f.withdrawals_out or 0),
                "replenishments": float(f.replenishments or 0),
                "returns_to_vault": float(f.returns_to_vault or 0),
                "closing_balance": float(f.closing_balance) if f.closing_balance else None,
                "physical_count": float(f.physical_count) if f.physical_count else None,
                "variance": float(f.variance) if f.variance else None,
                "status": f.status,
                "reconciled_at": f.reconciled_at.isoformat() if f.reconciled_at else None,
                "notes": f.notes,
                "created_at": f.created_at.isoformat()
            })
        
        return result
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/floats/my")
async def get_my_float(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "teller_station:read", db)
    session = tenant_ctx.create_session()
    
    try:
        staff = session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            return None
        
        if not staff.branch_id:
            raise HTTPException(status_code=400, detail="You must be assigned to a branch before using the teller station")
        
        teller_float = get_or_create_today_float(session, staff.id, staff.branch_id)
        
        return {
            "id": teller_float.id,
            "staff_id": teller_float.staff_id,
            "branch_id": teller_float.branch_id,
            "date": str(teller_float.date),
            "opening_balance": float(teller_float.opening_balance or 0),
            "current_balance": float(teller_float.current_balance or 0),
            "deposits_in": float(teller_float.deposits_in or 0),
            "withdrawals_out": float(teller_float.withdrawals_out or 0),
            "replenishments": float(teller_float.replenishments or 0),
            "returns_to_vault": float(teller_float.returns_to_vault or 0),
            "closing_balance": float(teller_float.closing_balance) if teller_float.closing_balance else None,
            "physical_count": float(teller_float.physical_count) if teller_float.physical_count else None,
            "variance": float(teller_float.variance) if teller_float.variance else None,
            "status": teller_float.status,
            "reconciled_at": teller_float.reconciled_at.isoformat() if teller_float.reconciled_at else None,
            "notes": teller_float.notes
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/floats/active-counters")
async def get_active_counters(
    org_id: str,
    branch_id: str = None,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get currently active counter assignments for today"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "teller_station:read", db)
    session = tenant_ctx.create_session()
    
    try:
        today = date.today()
        query = session.query(TellerFloat).filter(
            TellerFloat.date == today,
            TellerFloat.status == "open",
            TellerFloat.counter_number.isnot(None)
        )
        if branch_id:
            query = query.filter(TellerFloat.branch_id == branch_id)
        
        floats = query.all()
        return [
            {
                "counter_number": f.counter_number,
                "staff_id": f.staff_id,
                "staff_name": f"{f.staff.first_name} {f.staff.last_name}" if f.staff else None,
                "branch_id": f.branch_id,
            }
            for f in floats
        ]
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/floats/set-counter")
async def set_counter_number(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db),
    counter_number: str = None,
    staff_id: str = None
):
    """Set counter number on teller's float for today"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "teller_station:write", db)
    session = tenant_ctx.create_session()
    
    try:
        if staff_id:
            staff = session.query(Staff).filter(Staff.id == staff_id).first()
        else:
            staff = session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        if counter_number:
            counter_number = counter_number.strip()
            if not counter_number.isdigit() or int(counter_number) < 1:
                raise HTTPException(status_code=400, detail="Counter number must be a positive number")
            counter_number = str(int(counter_number))
        
        today = date.today()
        if counter_number:
            existing = session.query(TellerFloat).filter(
                TellerFloat.date == today,
                TellerFloat.status == "open",
                TellerFloat.counter_number == counter_number,
                TellerFloat.branch_id == staff.branch_id,
                TellerFloat.staff_id != staff.id
            ).first()
            if existing:
                taken_by = f"{existing.staff.first_name} {existing.staff.last_name}" if existing.staff else "another teller"
                raise HTTPException(status_code=400, detail=f"Counter {counter_number} is already in use by {taken_by}")
        
        teller_float = get_or_create_today_float(session, staff.id, staff.branch_id)
        teller_float.counter_number = counter_number
        session.commit()
        
        return {"message": f"Counter {counter_number} assigned successfully"}
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/floats/teller/{staff_id}")
async def get_teller_float(
    org_id: str,
    staff_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific teller's float (for admins to operate as that teller)"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:read", db)
    session = tenant_ctx.create_session()
    
    try:
        staff = session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        teller_float = get_or_create_today_float(session, staff.id, staff.branch_id)
        
        return {
            "id": teller_float.id,
            "staff_id": teller_float.staff_id,
            "staff_name": f"{staff.first_name} {staff.last_name}",
            "branch_id": teller_float.branch_id,
            "date": str(teller_float.date),
            "opening_balance": float(teller_float.opening_balance or 0),
            "current_balance": float(teller_float.current_balance or 0),
            "deposits_in": float(teller_float.deposits_in or 0),
            "withdrawals_out": float(teller_float.withdrawals_out or 0),
            "replenishments": float(teller_float.replenishments or 0),
            "returns_to_vault": float(teller_float.returns_to_vault or 0),
            "closing_balance": float(teller_float.closing_balance) if teller_float.closing_balance else None,
            "physical_count": float(teller_float.physical_count) if teller_float.physical_count else None,
            "variance": float(teller_float.variance) if teller_float.variance else None,
            "status": teller_float.status,
            "reconciled_at": teller_float.reconciled_at.isoformat() if teller_float.reconciled_at else None,
            "notes": teller_float.notes
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/floats/allocate")
async def allocate_float(
    org_id: str, 
    request: AllocateFloatRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:write", db)
    session = tenant_ctx.create_session()
    
    try:
        staff = session.query(Staff).filter(Staff.id == request.staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        # Only tellers can receive float allocations
        if staff.role != "teller":
            raise HTTPException(status_code=400, detail="Only tellers can receive float allocations")
        
        allocator = session.query(Staff).filter(Staff.email == user.email).first()
        
        teller_float = get_or_create_today_float(session, staff.id, staff.branch_id)
        
        # If float was reconciled, reopen it for new allocation
        if teller_float.status == "reconciled":
            teller_float.status = "open"
            teller_float.closing_balance = None  # Clear closing balance since we're reopening
        
        amount = Decimal(str(request.amount))
        
        vault = session.query(BranchVault).filter(
            BranchVault.branch_id == staff.branch_id
        ).with_for_update().first()
        if vault:
            vault_balance = vault.current_balance or Decimal("0")
            if amount > vault_balance:
                raise HTTPException(status_code=400, detail=f"Insufficient vault balance. Available: {float(vault_balance):,.2f}")
            vault.current_balance = vault_balance - amount
            vault.last_updated = datetime.utcnow()
        
        new_balance = Decimal(str(teller_float.current_balance or 0)) + amount
        
        teller_float.current_balance = new_balance
        teller_float.replenishments = Decimal(str(teller_float.replenishments or 0)) + amount
        
        float_txn = FloatTransaction(
            teller_float_id=teller_float.id,
            transaction_type="allocation",
            amount=amount,
            balance_after=new_balance,
            description=request.notes or "Initial float allocation",
            performed_by_id=allocator.id if allocator else None,
            approved_by_id=allocator.id if allocator else None,
            status="completed"
        )
        session.add(float_txn)
        session.commit()
        
        branch = session.query(Branch).filter(Branch.id == staff.branch_id).first()
        gl_error = post_float_allocation_to_gl(session, f"{staff.first_name} {staff.last_name}", amount, "allocation", branch.name if branch else "")
        
        result = {"message": "Float allocated successfully", "new_balance": float(new_balance)}
        if gl_error:
            result["gl_warning"] = gl_error
        return result
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/floats/{float_id}/replenish")
async def replenish_float(
    org_id: str, 
    float_id: str, 
    request: ReplenishFloatRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:write", db)
    session = tenant_ctx.create_session()
    
    try:
        teller_float = session.query(TellerFloat).filter(TellerFloat.id == float_id).with_for_update().first()
        if not teller_float:
            raise HTTPException(status_code=404, detail="Float not found")
        
        if teller_float.status == "reconciled":
            raise HTTPException(status_code=400, detail="Cannot replenish a reconciled float")
        
        allocator = session.query(Staff).filter(Staff.email == user.email).first()
        
        amount = Decimal(str(request.amount))
        new_balance = Decimal(str(teller_float.current_balance or 0)) + amount
        
        teller_float.current_balance = new_balance
        teller_float.replenishments = Decimal(str(teller_float.replenishments or 0)) + amount
        
        float_txn = FloatTransaction(
            teller_float_id=teller_float.id,
            transaction_type="replenishment",
            amount=amount,
            balance_after=new_balance,
            description=request.notes or "Float replenishment",
            performed_by_id=allocator.id if allocator else None,
            approved_by_id=allocator.id if allocator else None,
            status="completed"
        )
        session.add(float_txn)
        session.commit()
        
        return {"message": "Float replenished successfully", "new_balance": float(new_balance)}
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/floats/{float_id}/reopen")
async def reopen_float(
    org_id: str, 
    float_id: str, 
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reopen a closed/reconciled teller float to allow further transactions"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    session = tenant_ctx.create_session()
    
    try:
        teller_float = session.query(TellerFloat).filter(TellerFloat.id == float_id).first()
        if not teller_float:
            raise HTTPException(status_code=404, detail="Float not found")
        
        if teller_float.status not in ["reconciled", "closed", "pending_vault_return", "pending_approval"]:
            raise HTTPException(status_code=400, detail="Float is not closed - cannot reopen")
        
        reopener = session.query(Staff).filter(Staff.email == user.email).first()
        is_own_float = reopener and teller_float.staff_id == reopener.id
        
        if is_own_float and teller_float.status == "pending_approval":
            pass
        else:
            require_permission(membership, "float_management:write", db)
        
        # Cancel any pending shortage records when reverting from pending_approval
        if teller_float.status == "pending_approval":
            pending_shortages = session.query(ShortageRecord).filter(
                ShortageRecord.teller_float_id == float_id,
                ShortageRecord.status == "pending"
            ).all()
            for s in pending_shortages:
                s.status = "cancelled"
                s.notes = (s.notes or "") + " | Cancelled - reconciliation reverted"
            
            pending_txns = session.query(FloatTransaction).filter(
                and_(
                    FloatTransaction.teller_float_id == float_id,
                    FloatTransaction.transaction_type == "reconciliation",
                    FloatTransaction.status == "pending"
                )
            ).all()
            for txn in pending_txns:
                txn.status = "cancelled"
        
        # Cancel any pending vault return
        pending_return = session.query(PendingVaultReturn).filter(
            PendingVaultReturn.teller_float_id == float_id,
            PendingVaultReturn.status == "pending"
        ).first()
        if pending_return:
            pending_return.status = "cancelled"
            pending_return.reviewed_by_id = reopener.id if reopener else None
            pending_return.reviewed_at = datetime.utcnow()
            pending_return.notes = "Cancelled due to float reopen"
        
        # Reopen the float
        old_status = teller_float.status
        teller_float.status = "open"
        teller_float.closing_balance = None
        teller_float.physical_count = None
        teller_float.variance = None
        teller_float.reconciled_at = None
        teller_float.reconciled_by_id = None
        teller_float.returned_to_vault = False
        
        # Log this action
        float_txn = FloatTransaction(
            teller_float_id=teller_float.id,
            transaction_type="reopen",
            amount=Decimal("0"),
            balance_after=teller_float.current_balance,
            description=f"Float reopened from status: {old_status}",
            performed_by_id=reopener.id if reopener else None,
            status="completed"
        )
        session.add(float_txn)
        session.commit()
        
        return {"message": "Float reopened successfully", "status": "active"}
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/floats/{float_id}/return-to-vault")
async def return_to_vault(
    org_id: str, 
    float_id: str, 
    request: ReturnToVaultRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:write", db)
    session = tenant_ctx.create_session()
    
    try:
        teller_float = session.query(TellerFloat).filter(TellerFloat.id == float_id).with_for_update().first()
        if not teller_float:
            raise HTTPException(status_code=404, detail="Float not found")
        
        if teller_float.status == "reconciled":
            raise HTTPException(status_code=400, detail="Cannot return from a reconciled float")
        
        amount = Decimal(str(request.amount))
        current = Decimal(str(teller_float.current_balance or 0))
        
        if amount > current:
            raise HTTPException(status_code=400, detail="Cannot return more than current balance")
        
        performer = session.query(Staff).filter(Staff.email == user.email).first()
        
        new_balance = current - amount
        teller_float.current_balance = new_balance
        teller_float.returns_to_vault = Decimal(str(teller_float.returns_to_vault or 0)) + amount
        
        float_txn = FloatTransaction(
            teller_float_id=teller_float.id,
            transaction_type="return_to_vault",
            amount=amount,
            balance_after=new_balance,
            description=request.notes or "Returned to vault",
            performed_by_id=performer.id if performer else None,
            status="completed"
        )
        session.add(float_txn)
        session.commit()
        
        # Post to General Ledger
        staff = session.query(Staff).filter(Staff.id == teller_float.staff_id).first()
        branch = session.query(Branch).filter(Branch.id == teller_float.branch_id).first()
        if staff:
            post_float_allocation_to_gl(session, f"{staff.first_name} {staff.last_name}", amount, "return", branch.name if branch else "")
        
        return {"message": "Cash returned to vault successfully", "new_balance": float(new_balance)}
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/floats/{float_id}/reconcile")
async def reconcile_float(
    org_id: str, 
    float_id: str, 
    request: ReconcileFloatRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    session = tenant_ctx.create_session()
    
    try:
        teller_float = session.query(TellerFloat).filter(TellerFloat.id == float_id).first()
        if not teller_float:
            raise HTTPException(status_code=404, detail="Float not found")
        
        if teller_float.status == "reconciled":
            raise HTTPException(status_code=400, detail="Float already reconciled")
        
        if teller_float.status == "pending_approval":
            raise HTTPException(status_code=400, detail="Float is pending manager approval for shortage")
        
        reconciler = session.query(Staff).filter(Staff.email == user.email).first()
        
        physical = Decimal(str(request.physical_count))
        expected = Decimal(str(teller_float.current_balance or 0))
        variance = physical - expected
        
        teller_float.physical_count = physical
        teller_float.closing_balance = physical
        teller_float.variance = variance
        teller_float.notes = request.notes
        
        if variance < 0:
            teller_float.status = "pending_approval"
            
            shortage_record = ShortageRecord(
                teller_float_id=teller_float.id,
                staff_id=teller_float.staff_id,
                date=teller_float.date,
                shortage_amount=abs(variance),
                status="pending",
                notes=request.notes
            )
            session.add(shortage_record)
            
            float_txn = FloatTransaction(
                teller_float_id=teller_float.id,
                transaction_type="reconciliation",
                amount=physical,
                balance_after=physical,
                description=f"End of day reconciliation. Shortage: {float(abs(variance))} - PENDING APPROVAL",
                performed_by_id=reconciler.id if reconciler else None,
                status="pending"
            )
            session.add(float_txn)
            session.flush()
            shortage_id = shortage_record.id
            session.commit()
            
            return {
                "message": "Shortage detected - Manager approval required",
                "expected_balance": float(expected),
                "physical_count": float(physical),
                "variance": float(variance),
                "status": "pending_approval",
                "requires_approval": True,
                "shortage_id": shortage_id
            }
        else:
            teller_float.status = "reconciled"
            teller_float.reconciled_at = datetime.utcnow()
            teller_float.reconciled_by_id = reconciler.id if reconciler else None
            
            teller_float.closing_balance = physical
            
            vault = get_or_create_branch_vault(session, teller_float.branch_id)
            vault.current_balance = Decimal(str(vault.current_balance or 0)) + physical
            vault.last_updated = datetime.utcnow()
            
            teller_float.returned_to_vault = True
            teller_float.returns_to_vault = Decimal(str(teller_float.returns_to_vault or 0)) + physical
            teller_float.current_balance = Decimal("0")
            
            vault_txn = VaultTransaction(
                vault_id=vault.id,
                transaction_type="vault_deposit",
                amount=physical,
                balance_after=vault.current_balance,
                description=f"End-of-day return from teller",
                performed_by_id=reconciler.id if reconciler else None,
                status="completed"
            )
            session.add(vault_txn)
            
            float_txn = FloatTransaction(
                teller_float_id=teller_float.id,
                transaction_type="reconciliation",
                amount=physical,
                balance_after=Decimal("0"),
                description=f"End of day reconciliation. Variance: {float(variance)}. Cash returned to vault.",
                performed_by_id=reconciler.id if reconciler else None,
                status="completed"
            )
            session.add(float_txn)
            
            staff = session.query(Staff).filter(Staff.id == teller_float.staff_id).first()
            branch = session.query(Branch).filter(Branch.id == teller_float.branch_id).first()
            if staff and physical > 0:
                post_float_allocation_to_gl(session, f"{staff.first_name} {staff.last_name}", physical, "return", branch.name if branch else "")
            
            session.commit()
            
            return {
                "message": "Float reconciled - cash returned to vault",
                "expected_balance": float(expected),
                "physical_count": float(physical),
                "variance": float(variance),
                "status": "overage" if variance > 0 else "balanced",
                "requires_approval": False,
                "returned_to_vault": True
            }
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/floats/{float_id}/transactions")
async def get_float_transactions(
    org_id: str, 
    float_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "teller_station:read", db)
    session = tenant_ctx.create_session()
    
    try:
        transactions = session.query(FloatTransaction).filter(
            FloatTransaction.teller_float_id == float_id
        ).order_by(FloatTransaction.created_at.desc()).all()
        
        result = []
        for t in transactions:
            performer = session.query(Staff).filter(Staff.id == t.performed_by_id).first() if t.performed_by_id else None
            result.append({
                "id": t.id,
                "transaction_type": t.transaction_type,
                "amount": float(t.amount),
                "balance_after": float(t.balance_after),
                "reference": t.reference,
                "description": t.description,
                "performed_by": f"{performer.first_name} {performer.last_name}" if performer else None,
                "status": t.status,
                "created_at": t.created_at.isoformat()
            })
        
        return result
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/floats/my/request-replenishment")
async def request_replenishment(
    org_id: str, 
    request: ReplenishmentRequestCreate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    session = tenant_ctx.create_session()
    
    try:
        staff = session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        teller_float = get_or_create_today_float(session, staff.id, staff.branch_id)
        
        float_txn = FloatTransaction(
            teller_float_id=teller_float.id,
            transaction_type="replenishment_request",
            amount=Decimal(str(request.amount)),
            balance_after=teller_float.current_balance,
            description=request.reason,
            performed_by_id=staff.id,
            status="pending"
        )
        session.add(float_txn)
        session.commit()
        
        return {"message": "Replenishment request submitted", "request_id": float_txn.id}
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/floats/pending-requests")
async def get_pending_requests(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:write", db)
    session = tenant_ctx.create_session()
    
    try:
        requests = session.query(FloatTransaction).filter(
            and_(
                FloatTransaction.transaction_type == "replenishment_request",
                FloatTransaction.status == "pending"
            )
        ).order_by(FloatTransaction.created_at.desc()).all()
        
        result = []
        for r in requests:
            teller_float = session.query(TellerFloat).filter(TellerFloat.id == r.teller_float_id).first()
            staff = session.query(Staff).filter(Staff.id == r.performed_by_id).first() if r.performed_by_id else None
            result.append({
                "id": r.id,
                "teller_float_id": r.teller_float_id,
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else "Unknown",
                "amount": float(r.amount),
                "reason": r.description,
                "current_balance": float(teller_float.current_balance) if teller_float else 0,
                "created_at": r.created_at.isoformat()
            })
        
        return result
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/floats/requests/{request_id}/approve")
async def approve_replenishment_request(
    org_id: str, 
    request_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:write", db)
    session = tenant_ctx.create_session()
    
    try:
        float_txn = session.query(FloatTransaction).filter(FloatTransaction.id == request_id).first()
        if not float_txn:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if float_txn.status != "pending":
            raise HTTPException(status_code=400, detail="Request already processed")
        
        approver = session.query(Staff).filter(Staff.email == user.email).first()
        
        teller_float = session.query(TellerFloat).filter(TellerFloat.id == float_txn.teller_float_id).first()
        if not teller_float:
            raise HTTPException(status_code=404, detail="Float not found")
        
        amount = float_txn.amount
        
        vault = session.query(BranchVault).filter(BranchVault.branch_id == teller_float.branch_id).first()
        if not vault:
            raise HTTPException(status_code=404, detail="Branch vault not found")
        
        vault_balance = Decimal(str(vault.current_balance or 0))
        if vault_balance < amount:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient vault balance. Available: {float(vault_balance):.2f}, Requested: {float(amount):.2f}"
            )
        
        new_vault_balance = vault_balance - amount
        vault.current_balance = new_vault_balance
        
        vault_txn = VaultTransaction(
            vault_id=vault.id,
            transaction_type="teller_allocation",
            amount=-amount,
            balance_after=new_vault_balance,
            description=f"Float replenishment to teller",
            performed_by_id=approver.id if approver else None,
            related_float_id=teller_float.id
        )
        session.add(vault_txn)
        
        new_balance = Decimal(str(teller_float.current_balance or 0)) + amount
        teller_float.current_balance = new_balance
        teller_float.replenishments = Decimal(str(teller_float.replenishments or 0)) + amount
        
        float_txn.status = "approved"
        float_txn.approved_by_id = approver.id if approver else None
        
        replenish_txn = FloatTransaction(
            teller_float_id=teller_float.id,
            transaction_type="replenishment",
            amount=amount,
            balance_after=new_balance,
            description=f"Approved replenishment request",
            performed_by_id=approver.id if approver else None,
            approved_by_id=approver.id if approver else None,
            status="completed"
        )
        session.add(replenish_txn)
        session.commit()
        
        return {"message": "Replenishment approved", "new_balance": float(new_balance)}
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/floats/requests/{request_id}/reject")
async def reject_replenishment_request(
    org_id: str, 
    request_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:write", db)
    session = tenant_ctx.create_session()
    
    try:
        float_txn = session.query(FloatTransaction).filter(FloatTransaction.id == request_id).first()
        if not float_txn:
            raise HTTPException(status_code=404, detail="Request not found")
        
        if float_txn.status != "pending":
            raise HTTPException(status_code=400, detail="Request already processed")
        
        approver = session.query(Staff).filter(Staff.email == user.email).first()
        
        float_txn.status = "rejected"
        float_txn.approved_by_id = approver.id if approver else None
        session.commit()
        
        return {"message": "Replenishment request rejected"}
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/shortages/pending/{staff_id}")
async def get_pending_shortages(
    org_id: str,
    staff_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all pending and held shortages for a staff member"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    session = tenant_ctx.create_session()
    
    try:
        shortages = session.query(ShortageRecord).filter(
            and_(
                ShortageRecord.staff_id == staff_id,
                ShortageRecord.status.in_(["pending", "held"])
            )
        ).order_by(ShortageRecord.date.desc()).all()
        
        result = []
        for s in shortages:
            staff = session.query(Staff).filter(Staff.id == s.staff_id).first()
            approved_by = session.query(Staff).filter(Staff.id == s.approved_by_id).first() if s.approved_by_id else None
            result.append({
                "id": s.id,
                "teller_float_id": s.teller_float_id,
                "staff_id": s.staff_id,
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                "date": s.date.isoformat(),
                "shortage_amount": float(s.shortage_amount),
                "status": s.status,
                "resolution": s.resolution,
                "approved_by": f"{approved_by.first_name} {approved_by.last_name}" if approved_by else None,
                "approved_at": s.approved_at.isoformat() if s.approved_at else None,
                "notes": s.notes,
                "created_at": s.created_at.isoformat()
            })
        
        total_pending = sum(s["shortage_amount"] for s in result if s["status"] == "pending")
        total_held = sum(s["shortage_amount"] for s in result if s["status"] == "held")
        
        return {
            "shortages": result,
            "total_pending": total_pending,
            "total_held": total_held,
            "total_outstanding": total_pending + total_held
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/shortages/my")
async def get_my_shortages(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pending/held shortages for the current user"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    session = tenant_ctx.create_session()
    
    try:
        staff = session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            return {"shortages": [], "total_pending": 0, "total_held": 0, "total_outstanding": 0}
        
        shortages = session.query(ShortageRecord).filter(
            and_(
                ShortageRecord.staff_id == staff.id,
                ShortageRecord.status.in_(["pending", "held"])
            )
        ).order_by(ShortageRecord.date.desc()).all()
        
        result = []
        for s in shortages:
            result.append({
                "id": s.id,
                "date": s.date.isoformat(),
                "shortage_amount": float(s.shortage_amount),
                "status": s.status,
                "notes": s.notes
            })
        
        total_pending = sum(s["shortage_amount"] for s in result if s["status"] == "pending")
        total_held = sum(s["shortage_amount"] for s in result if s["status"] == "held")
        
        return {
            "shortages": result,
            "total_pending": total_pending,
            "total_held": total_held,
            "total_outstanding": total_pending + total_held
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/shortages/{shortage_id}/approve")
async def approve_shortage(
    org_id: str,
    shortage_id: str,
    request: ShortageApprovalRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manager approves a shortage by entering their staff number and PIN at the teller station"""
    import bcrypt
    
    tenant_ctx, _ = get_tenant_session_context(org_id, user, db)
    session = tenant_ctx.create_session()
    
    try:
        approver_staff = None
        if request.staff_number:
            approver_staff = session.query(Staff).filter(Staff.staff_number == request.staff_number).first()
            if not approver_staff:
                raise HTTPException(status_code=401, detail="Invalid PIN")
            if not approver_staff.approval_pin:
                raise HTTPException(status_code=400, detail="This staff member has not set an approval PIN.")
            if not bcrypt.checkpw(request.pin.encode('utf-8'), approver_staff.approval_pin.encode('utf-8')):
                raise HTTPException(status_code=401, detail="Invalid PIN")
        else:
            candidates = session.query(Staff).filter(Staff.approval_pin.isnot(None)).all()
            for candidate in candidates:
                if bcrypt.checkpw(request.pin.encode('utf-8'), candidate.approval_pin.encode('utf-8')):
                    approver_staff = candidate
                    break
            if not approver_staff:
                raise HTTPException(status_code=401, detail="Invalid PIN")
        
        allowed_roles = ("manager", "admin", "supervisor", "branch_manager", "chief_teller")
        if not approver_staff.role or approver_staff.role.lower() not in allowed_roles:
            raise HTTPException(status_code=403, detail="You do not have permission to approve shortages")
        
        shortage = session.query(ShortageRecord).filter(ShortageRecord.id == shortage_id).first()
        if not shortage:
            raise HTTPException(status_code=404, detail="Shortage record not found")
        
        if shortage.status not in ["pending", "held"]:
            raise HTTPException(status_code=400, detail="Shortage already resolved")
        
        import json as json_module
        total_amount = float(shortage.shortage_amount)
        
        dists = request.distributions
        if not dists:
            if not request.action:
                raise HTTPException(status_code=400, detail="Either action or distributions is required")
            dists = [ShortageDistribution(action=request.action, amount=total_amount)]
        
        for d in dists:
            if d.action not in ("deduct", "hold", "expense"):
                raise HTTPException(status_code=400, detail=f"Invalid action '{d.action}'. Must be 'deduct', 'hold', or 'expense'")
            if d.amount <= 0:
                raise HTTPException(status_code=400, detail="Distribution amounts must be positive")
        
        dist_total = round(sum(d.amount for d in dists), 2)
        if abs(dist_total - total_amount) > 0.01:
            raise HTTPException(status_code=400, detail=f"Distribution amounts ({dist_total}) must equal the shortage ({total_amount})")
        
        is_split = len(dists) > 1
        
        if is_split:
            shortage.status = "resolved"
            shortage.resolution = "split"
            shortage.approved_by_id = approver_staff.id
            shortage.approved_at = datetime.utcnow()
            shortage.notes = request.notes
            shortage.distributions = json_module.dumps([{"action": d.action, "amount": d.amount} for d in dists])
        
        action_parts = []
        for d in dists:
            if is_split:
                child = ShortageRecord(
                    teller_float_id=shortage.teller_float_id,
                    staff_id=shortage.staff_id,
                    date=shortage.date,
                    shortage_amount=d.amount,
                    approved_by_id=approver_staff.id,
                    approved_at=datetime.utcnow(),
                    notes=request.notes,
                    parent_shortage_id=shortage.id,
                )
                target = child
                session.add(child)
            else:
                target = shortage
            
            if d.action == "deduct":
                target.status = "deducted"
                target.resolution = "deduct_salary"
                target.approved_by_id = approver_staff.id
                target.approved_at = datetime.utcnow()
                target.notes = request.notes
                salary_deduction = SalaryDeduction(
                    staff_id=shortage.staff_id,
                    shortage_record_id=target.id if not is_split else None,
                    amount=d.amount,
                    reason=f"Cash shortage on {shortage.date.isoformat()}",
                    deduction_date=date.today(),
                    pay_period=date.today().strftime("%Y-%m"),
                    status="pending",
                    approved_by_id=approver_staff.id,
                    notes=request.notes
                )
                session.add(salary_deduction)
                action_parts.append(f"{d.amount:,.0f} deducted from salary")
            elif d.action == "hold":
                target.status = "held"
                target.resolution = "hold"
                target.approved_by_id = approver_staff.id
                target.approved_at = datetime.utcnow()
                target.notes = request.notes
                action_parts.append(f"{d.amount:,.0f} put on hold")
            elif d.action == "expense":
                target.status = "expensed"
                target.resolution = "expense"
                target.approved_by_id = approver_staff.id
                target.approved_at = datetime.utcnow()
                target.notes = request.notes or "Written off as organizational expense"
                action_parts.append(f"{d.amount:,.0f} written off as expense")
            
            if is_split:
                session.flush()
                if d.action == "deduct":
                    salary_deduction.shortage_record_id = target.id
        
        has_hold_only = all(d.action == "hold" for d in dists)
        teller_float = session.query(TellerFloat).filter(TellerFloat.id == shortage.teller_float_id).first()
        if teller_float and not has_hold_only:
            remaining_cash = Decimal(str(teller_float.physical_count or teller_float.current_balance or 0))
            teller_float.closing_balance = remaining_cash
            teller_float.status = "reconciled"
            teller_float.reconciled_at = datetime.utcnow()
            teller_float.reconciled_by_id = approver_staff.id
            
            if remaining_cash > 0:
                vault = get_or_create_branch_vault(session, teller_float.branch_id)
                vault.current_balance = Decimal(str(vault.current_balance or 0)) + remaining_cash
                vault.last_updated = datetime.utcnow()
                
                teller_float.returned_to_vault = True
                teller_float.returns_to_vault = Decimal(str(teller_float.returns_to_vault or 0)) + remaining_cash
                teller_float.current_balance = Decimal("0")
                
                vault_txn = VaultTransaction(
                    vault_id=vault.id,
                    transaction_type="vault_deposit",
                    amount=remaining_cash,
                    balance_after=vault.current_balance,
                    description=f"End-of-day return after shortage approval",
                    performed_by_id=approver_staff.id,
                    status="completed"
                )
                session.add(vault_txn)
                
                staff_record = session.query(Staff).filter(Staff.id == teller_float.staff_id).first()
                branch = session.query(Branch).filter(Branch.id == teller_float.branch_id).first()
                if staff_record:
                    post_float_allocation_to_gl(session, f"{staff_record.first_name} {staff_record.last_name}", remaining_cash, "return", branch.name if branch else "")
            else:
                teller_float.current_balance = Decimal("0")
                teller_float.returned_to_vault = True
            
            float_txn = session.query(FloatTransaction).filter(
                and_(
                    FloatTransaction.teller_float_id == teller_float.id,
                    FloatTransaction.transaction_type == "reconciliation",
                    FloatTransaction.status == "pending"
                )
            ).first()
            if float_txn:
                float_txn.status = "completed"
                float_txn.approved_by_id = approver_staff.id
                float_txn.balance_after = Decimal("0")
                float_txn.description = (float_txn.description or "") + " Cash returned to vault."
        
        session.commit()
        
        teller = session.query(Staff).filter(Staff.id == shortage.staff_id).first()
        
        message = "; ".join(action_parts) if action_parts else "Shortage processed"
        return {
            "message": message,
            "shortage_id": shortage.id,
            "amount": total_amount,
            "distributions": [{"action": d.action, "amount": d.amount} for d in dists],
            "teller_name": f"{teller.first_name} {teller.last_name}" if teller else None,
            "approved_by": f"{approver_staff.first_name} {approver_staff.last_name}"
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/staff/set-approval-pin")
async def set_approval_pin(
    org_id: str,
    request: SetApprovalPinRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set or update the current user's approval PIN"""
    import bcrypt
    pin = request.pin
    
    if not pin or len(pin) < 4 or len(pin) > 6 or not pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be 4-6 digits")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    session = tenant_ctx.create_session()
    
    try:
        staff = session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        hashed = bcrypt.hashpw(pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        staff.approval_pin = hashed
        session.commit()
        
        return {"message": "Approval PIN set successfully"}
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/staff/{staff_id}/set-approval-pin")
async def set_staff_approval_pin(
    org_id: str,
    staff_id: str,
    request: SetApprovalPinRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin sets a staff member's approval PIN"""
    import bcrypt
    
    if not request.pin or len(request.pin) < 4 or len(request.pin) > 6 or not request.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be 4-6 digits")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "staff:write", db)
    session = tenant_ctx.create_session()
    
    try:
        staff = session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        hashed = bcrypt.hashpw(request.pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        staff.approval_pin = hashed
        session.commit()
        
        return {"message": f"Approval PIN set for {staff.first_name} {staff.last_name}"}
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/salary-deductions")
async def get_salary_deductions(
    org_id: str,
    staff_id: Optional[str] = None,
    status: Optional[str] = None,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get salary deductions (HR view)"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "salary_deductions:read", db)
    session = tenant_ctx.create_session()
    
    try:
        query = session.query(SalaryDeduction)
        
        if staff_id:
            query = query.filter(SalaryDeduction.staff_id == staff_id)
        if status:
            query = query.filter(SalaryDeduction.status == status)
        
        deductions = query.order_by(SalaryDeduction.created_at.desc()).all()
        
        result = []
        for d in deductions:
            staff = session.query(Staff).filter(Staff.id == d.staff_id).first()
            approved_by = session.query(Staff).filter(Staff.id == d.approved_by_id).first() if d.approved_by_id else None
            processed_by = session.query(Staff).filter(Staff.id == d.processed_by_id).first() if d.processed_by_id else None
            
            result.append({
                "id": d.id,
                "staff_id": d.staff_id,
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                "staff_number": staff.staff_number if staff else None,
                "amount": float(d.amount),
                "reason": d.reason,
                "deduction_date": d.deduction_date.isoformat(),
                "status": d.status,
                "approved_by": f"{approved_by.first_name} {approved_by.last_name}" if approved_by else None,
                "processed_by": f"{processed_by.first_name} {processed_by.last_name}" if processed_by else None,
                "processed_at": d.processed_at.isoformat() if d.processed_at else None,
                "notes": d.notes,
                "created_at": d.created_at.isoformat()
            })
        
        return result
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/salary-deductions/{deduction_id}/process")
async def process_salary_deduction(
    org_id: str,
    deduction_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a salary deduction as processed (HR action)"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "salary_deductions:write", db)
    session = tenant_ctx.create_session()
    
    try:
        deduction = session.query(SalaryDeduction).filter(SalaryDeduction.id == deduction_id).first()
        if not deduction:
            raise HTTPException(status_code=404, detail="Deduction not found")
        
        if deduction.status == "processed":
            raise HTTPException(status_code=400, detail="Deduction already processed")
        
        processor = session.query(Staff).filter(Staff.email == user.email).first()
        
        deduction.status = "processed"
        if not deduction.pay_period:
            deduction.pay_period = date.today().strftime("%Y-%m")
        deduction.processed_by_id = processor.id if processor else None
        deduction.processed_at = datetime.utcnow()
        
        session.commit()
        
        return {"message": "Deduction marked as processed"}
    finally:
        session.close()
        tenant_ctx.close()

# ==================== VAULT MANAGEMENT ENDPOINTS ====================

@router.get("/organizations/{org_id}/vaults")
async def get_all_vaults(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all branch vaults with their current balances"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:read", db)
    session = tenant_ctx.create_session()
    
    try:
        branches = session.query(Branch).filter(Branch.is_active == True).all()
        vaults_data = []
        
        for branch in branches:
            vault = get_or_create_branch_vault(session, branch.id)
            vaults_data.append({
                "id": vault.id,
                "branch_id": branch.id,
                "branch_name": branch.name,
                "current_balance": float(vault.current_balance or 0),
                "last_updated": vault.last_updated.isoformat() if vault.last_updated else None
            })
        
        return {"vaults": vaults_data}
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/vaults/{vault_id}")
async def get_vault_details(
    org_id: str,
    vault_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get vault details with recent transactions"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:read", db)
    session = tenant_ctx.create_session()
    
    try:
        vault = session.query(BranchVault).filter(BranchVault.id == vault_id).first()
        if not vault:
            raise HTTPException(status_code=404, detail="Vault not found")
        
        branch = session.query(Branch).filter(Branch.id == vault.branch_id).first()
        transactions = session.query(VaultTransaction).filter(
            VaultTransaction.vault_id == vault_id
        ).order_by(VaultTransaction.created_at.desc()).limit(50).all()
        
        return {
            "vault": {
                "id": vault.id,
                "branch_id": vault.branch_id,
                "branch_name": branch.name if branch else "Unknown",
                "current_balance": float(vault.current_balance or 0),
                "last_updated": vault.last_updated.isoformat() if vault.last_updated else None
            },
            "transactions": [{
                "id": t.id,
                "transaction_type": t.transaction_type,
                "amount": float(t.amount),
                "balance_after": float(t.balance_after),
                "source": t.source,
                "reference": t.reference,
                "description": t.description,
                "performed_by": f"{t.performed_by.first_name} {t.performed_by.last_name}" if t.performed_by else None,
                "status": t.status,
                "created_at": t.created_at.isoformat()
            } for t in transactions]
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/vaults/deposit")
async def deposit_to_vault(
    org_id: str,
    request: VaultDepositRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add money to a branch vault"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:write", db)
    session = tenant_ctx.create_session()
    
    try:
        vault = get_or_create_branch_vault(session, request.branch_id)
        vault = session.query(BranchVault).filter(BranchVault.id == vault.id).with_for_update().first()
        staff = session.query(Staff).filter(Staff.email == user.email).first()
        
        amount = Decimal(str(request.amount))
        new_balance = (vault.current_balance or Decimal("0")) + amount
        
        # Record transaction
        txn = VaultTransaction(
            vault_id=vault.id,
            transaction_type="deposit",
            amount=amount,
            balance_after=new_balance,
            source=request.source,
            reference=request.reference,
            description=request.notes or f"Vault deposit from {request.source}",
            performed_by_id=staff.id if staff else None,
            status="completed"
        )
        session.add(txn)
        
        # Update vault balance
        vault.current_balance = new_balance
        vault.last_updated = datetime.utcnow()
        
        session.commit()
        
        branch = session.query(Branch).filter(Branch.id == request.branch_id).first()
        
        # Post to General Ledger
        gl_error = post_float_allocation_to_gl(session, staff.first_name if staff else "Unknown", amount, "vault_deposit", branch.name if branch else "")
        
        result = {
            "message": f"Successfully deposited {get_org_currency(session)} {float(amount):,.2f} to {branch.name if branch else 'vault'}",
            "new_balance": float(new_balance),
            "transaction_id": txn.id
        }
        if gl_error:
            result["gl_warning"] = gl_error
        return result
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/pending-vault-returns")
async def get_pending_vault_returns(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all pending vault returns awaiting approval"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:read", db)
    session = tenant_ctx.create_session()
    
    try:
        pending = session.query(PendingVaultReturn).filter(
            PendingVaultReturn.status == "pending"
        ).order_by(PendingVaultReturn.created_at.desc()).all()
        
        return {
            "pending_returns": [{
                "id": p.id,
                "teller_float_id": p.teller_float_id,
                "staff_id": p.staff_id,
                "staff_name": f"{p.staff.first_name} {p.staff.last_name}" if p.staff else "Unknown",
                "branch_id": p.branch_id,
                "branch_name": p.branch.name if p.branch else "Unknown",
                "amount": float(p.amount),
                "notes": p.notes,
                "created_at": p.created_at.isoformat()
            } for p in pending],
            "count": len(pending)
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/pending-vault-returns/{return_id}/review")
async def review_vault_return(
    org_id: str,
    return_id: str,
    request: VaultReturnReviewRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept or reject a vault return request"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:write", db)
    session = tenant_ctx.create_session()
    
    try:
        pending = session.query(PendingVaultReturn).filter(PendingVaultReturn.id == return_id).first()
        if not pending:
            raise HTTPException(status_code=404, detail="Pending return not found")
        
        if pending.status != "pending":
            raise HTTPException(status_code=400, detail="This return has already been reviewed")
        
        reviewer = session.query(Staff).filter(Staff.email == user.email).first()
        teller_float = session.query(TellerFloat).filter(TellerFloat.id == pending.teller_float_id).first()
        
        if request.action == "accept":
            # Update vault balance
            vault = get_or_create_branch_vault(session, pending.branch_id)
            amount = Decimal(str(pending.amount))
            new_balance = (vault.current_balance or Decimal("0")) + amount
            
            # Record vault transaction
            vault_txn = VaultTransaction(
                vault_id=vault.id,
                transaction_type="teller_return",
                amount=amount,
                balance_after=new_balance,
                description=f"Teller return from {pending.staff.first_name} {pending.staff.last_name}" if pending.staff else "Teller return",
                related_float_id=pending.teller_float_id,
                performed_by_id=reviewer.id if reviewer else None,
                status="completed"
            )
            session.add(vault_txn)
            
            vault.current_balance = new_balance
            vault.last_updated = datetime.utcnow()
            
            # Update float status
            if teller_float:
                teller_float.status = "reconciled"
                teller_float.reconciled_at = datetime.utcnow()
                teller_float.reconciled_by_id = reviewer.id if reviewer else None
                teller_float.returns_to_vault = (teller_float.returns_to_vault or Decimal("0")) + amount
                teller_float.closing_balance = Decimal("0")
                teller_float.returned_to_vault = True
                
                # Update float transaction status
                float_txn = session.query(FloatTransaction).filter(
                    and_(
                        FloatTransaction.teller_float_id == teller_float.id,
                        FloatTransaction.transaction_type == "reconciliation",
                        FloatTransaction.status == "pending"
                    )
                ).first()
                if float_txn:
                    float_txn.status = "completed"
                    float_txn.description = float_txn.description.replace("Pending vault return approval", "Vault return approved")
            
            pending.status = "accepted"
            pending.reviewed_by_id = reviewer.id if reviewer else None
            pending.reviewed_at = datetime.utcnow()
            
            session.commit()
            
            return {
                "message": f"Vault return of {get_org_currency(session)} {float(amount):,.2f} accepted. Vault balance updated.",
                "new_vault_balance": float(new_balance)
            }
        
        elif request.action == "reject":
            # Reopen the float for teller
            if teller_float:
                teller_float.status = "open"
                
                # Update float transaction
                float_txn = session.query(FloatTransaction).filter(
                    and_(
                        FloatTransaction.teller_float_id == teller_float.id,
                        FloatTransaction.transaction_type == "reconciliation",
                        FloatTransaction.status == "pending"
                    )
                ).first()
                if float_txn:
                    float_txn.status = "rejected"
                    float_txn.description += f" - REJECTED: {request.notes or 'No reason provided'}"
            
            pending.status = "rejected"
            pending.rejected_reason = request.notes
            pending.reviewed_by_id = reviewer.id if reviewer else None
            pending.reviewed_at = datetime.utcnow()
            
            session.commit()
            
            return {
                "message": "Vault return rejected. Teller can reconcile again.",
                "reason": request.notes
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Must be 'accept' or 'reject'")
    finally:
        session.close()
        tenant_ctx.close()

# ==================== SHIFT HANDOVER ENDPOINTS ====================

@router.get("/organizations/{org_id}/shift-handovers")
async def get_shift_handovers(
    org_id: str,
    status: Optional[str] = None,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get shift handovers, optionally filtered by status"""
    from sqlalchemy import or_
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    session = tenant_ctx.create_session()
    
    try:
        current_staff = session.query(Staff).filter(Staff.email == user.email).first()
        
        query = session.query(ShiftHandover)
        if current_staff:
            has_float_perm = False
            try:
                require_permission(membership, "float_management:read", db)
                has_float_perm = True
            except:
                pass
            if not has_float_perm:
                query = query.filter(
                    or_(
                        ShiftHandover.from_staff_id == current_staff.id,
                        ShiftHandover.to_staff_id == current_staff.id
                    )
                )
        if status:
            query = query.filter(ShiftHandover.status == status)
        
        handovers = query.order_by(ShiftHandover.created_at.desc()).limit(100).all()
        
        return {
            "handovers": [{
                "id": h.id,
                "from_staff_id": h.from_staff_id,
                "from_staff_name": f"{h.from_staff.first_name} {h.from_staff.last_name}" if h.from_staff else None,
                "to_staff_id": h.to_staff_id,
                "to_staff_name": f"{h.to_staff.first_name} {h.to_staff.last_name}" if h.to_staff else None,
                "branch_name": h.branch.name if h.branch else None,
                "amount": float(h.amount),
                "status": h.status,
                "notes": h.notes,
                "from_acknowledged_at": h.from_acknowledged_at.isoformat() if h.from_acknowledged_at else None,
                "to_acknowledged_at": h.to_acknowledged_at.isoformat() if h.to_acknowledged_at else None,
                "created_at": h.created_at.isoformat()
            } for h in handovers]
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/shift-handovers")
async def create_shift_handover(
    org_id: str,
    request: ShiftHandoverRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initiate a shift handover from current teller to another"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "teller_station:write", db)
    session = tenant_ctx.create_session()
    
    try:
        from_staff = session.query(Staff).filter(Staff.email == user.email).first()
        if not from_staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        to_staff = session.query(Staff).filter(Staff.id == request.to_staff_id).first()
        if not to_staff:
            raise HTTPException(status_code=404, detail="Receiving staff not found")
        
        if from_staff.id == to_staff.id:
            raise HTTPException(status_code=400, detail="Cannot hand over to yourself")
        
        # Get sender's current float
        today = date.today()
        from_float = session.query(TellerFloat).filter(
            and_(
                TellerFloat.staff_id == from_staff.id,
                TellerFloat.date == today,
                TellerFloat.status == "open"
            )
        ).first()
        
        if not from_float:
            raise HTTPException(status_code=400, detail="You don't have an open float to handover")
        
        amount = Decimal(str(request.amount))
        if amount > (from_float.current_balance or Decimal("0")):
            raise HTTPException(status_code=400, detail="Insufficient balance for handover")
        
        from_float.current_balance = (from_float.current_balance or Decimal("0")) - amount
        
        reserve_txn = FloatTransaction(
            teller_float_id=from_float.id,
            transaction_type="handover_reserved",
            amount=amount,
            balance_after=from_float.current_balance,
            description=f"Funds reserved for shift handover to {to_staff.first_name} {to_staff.last_name}",
            performed_by_id=from_staff.id,
            status="pending"
        )
        session.add(reserve_txn)
        
        handover = ShiftHandover(
            from_staff_id=from_staff.id,
            to_staff_id=to_staff.id,
            branch_id=from_float.branch_id,
            from_float_id=from_float.id,
            amount=amount,
            status="pending",
            notes=request.notes,
            from_acknowledged_at=datetime.utcnow()
        )
        session.add(handover)
        session.commit()
        
        return {
            "message": f"Handover initiated to {to_staff.first_name} {to_staff.last_name}. Waiting for their acceptance.",
            "handover_id": handover.id,
            "amount": float(amount)
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/shift-handovers/{handover_id}/cancel")
async def cancel_shift_handover(
    org_id: str,
    handover_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a pending shift handover (only by the sender)"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    session = tenant_ctx.create_session()
    
    try:
        handover = session.query(ShiftHandover).filter(ShiftHandover.id == handover_id).first()
        if not handover:
            raise HTTPException(status_code=404, detail="Handover not found")
        
        current_staff = session.query(Staff).filter(Staff.email == user.email).first()
        if not current_staff or current_staff.id != handover.from_staff_id:
            raise HTTPException(status_code=403, detail="Only the sender can cancel this handover")
        
        if handover.status != "pending":
            raise HTTPException(status_code=400, detail="This handover has already been processed")
        
        handover.status = "cancelled"
        
        from_float = session.query(TellerFloat).filter(TellerFloat.id == handover.from_float_id).with_for_update().first()
        if from_float:
            from_float.current_balance = (from_float.current_balance or Decimal("0")) + Decimal(str(handover.amount))
            
            return_txn = FloatTransaction(
                teller_float_id=from_float.id,
                transaction_type="handover_returned",
                amount=Decimal(str(handover.amount)),
                balance_after=from_float.current_balance,
                description="Funds returned - handover cancelled",
                performed_by_id=current_staff.id,
                status="completed"
            )
            session.add(return_txn)
        
        session.commit()
        
        return {"message": "Handover cancelled successfully"}
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/shift-handovers/{handover_id}/acknowledge")
async def acknowledge_shift_handover(
    org_id: str,
    handover_id: str,
    request: ShiftHandoverAcknowledgeRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept or reject a shift handover"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "teller_station:write", db)
    session = tenant_ctx.create_session()
    
    try:
        handover = session.query(ShiftHandover).filter(ShiftHandover.id == handover_id).first()
        if not handover:
            raise HTTPException(status_code=404, detail="Handover not found")
        
        current_staff = session.query(Staff).filter(Staff.email == user.email).first()
        if not current_staff or current_staff.id != handover.to_staff_id:
            raise HTTPException(status_code=403, detail="Only the receiving staff can acknowledge this handover")
        
        if handover.status != "pending":
            raise HTTPException(status_code=400, detail="This handover has already been processed")
        
        if request.action == "accept":
            from_float = session.query(TellerFloat).filter(TellerFloat.id == handover.from_float_id).with_for_update().first()
            if not from_float:
                raise HTTPException(status_code=400, detail="Source float not found")
            
            to_float = get_or_create_today_float(session, handover.to_staff_id, handover.branch_id)
            
            amount = Decimal(str(handover.amount))
            
            from_txn = FloatTransaction(
                teller_float_id=from_float.id,
                transaction_type="handover_out",
                amount=amount,
                balance_after=from_float.current_balance,
                description=f"Shift handover to {current_staff.first_name} {current_staff.last_name}",
                performed_by_id=current_staff.id,
                status="completed"
            )
            session.add(from_txn)
            
            # Add to receiver
            to_float.current_balance = (to_float.current_balance or Decimal("0")) + amount
            to_float.replenishments = (to_float.replenishments or Decimal("0")) + amount
            to_txn = FloatTransaction(
                teller_float_id=to_float.id,
                transaction_type="handover_in",
                amount=amount,
                balance_after=to_float.current_balance,
                description=f"Shift handover from {handover.from_staff.first_name} {handover.from_staff.last_name}" if handover.from_staff else "Shift handover received",
                performed_by_id=current_staff.id,
                status="completed"
            )
            session.add(to_txn)
            
            handover.to_float_id = to_float.id
            handover.status = "accepted"
            handover.to_acknowledged_at = datetime.utcnow()
            
            session.commit()
            
            return {
                "message": f"Handover of {get_org_currency(session)} {float(amount):,.2f} accepted successfully",
                "your_new_balance": float(to_float.current_balance)
            }
        
        elif request.action == "reject":
            handover.status = "rejected"
            handover.notes = (handover.notes or "") + f" | Rejected: {request.notes or 'No reason'}"
            handover.to_acknowledged_at = datetime.utcnow()
            
            from_float = session.query(TellerFloat).filter(TellerFloat.id == handover.from_float_id).with_for_update().first()
            if from_float:
                from_float.current_balance = (from_float.current_balance or Decimal("0")) + Decimal(str(handover.amount))
                
                return_txn = FloatTransaction(
                    teller_float_id=from_float.id,
                    transaction_type="handover_returned",
                    amount=Decimal(str(handover.amount)),
                    balance_after=from_float.current_balance,
                    description=f"Funds returned - handover rejected by {current_staff.first_name} {current_staff.last_name}",
                    performed_by_id=current_staff.id,
                    status="completed"
                )
                session.add(return_txn)
            
            session.commit()
            
            return {"message": "Handover rejected"}
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Must be 'accept' or 'reject'")
    finally:
        session.close()
        tenant_ctx.close()

# ==================== DAILY REPORT ENDPOINTS ====================

@router.get("/organizations/{org_id}/daily-cash-position")
async def get_daily_cash_position(
    org_id: str,
    report_date: Optional[str] = None,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get daily cash position report for all branches"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "float_management:read", db)
    session = tenant_ctx.create_session()
    
    try:
        target_date = date.fromisoformat(report_date) if report_date else date.today()
        
        branches = session.query(Branch).filter(Branch.is_active == True).all()
        report_data = []
        
        totals = {
            "vault_balance": Decimal("0"),
            "float_allocated": Decimal("0"),
            "deposits_received": Decimal("0"),
            "withdrawals_paid": Decimal("0"),
            "total_cash_in_hand": Decimal("0")
        }
        
        for branch in branches:
            vault = session.query(BranchVault).filter(BranchVault.branch_id == branch.id).first()
            vault_balance = vault.current_balance if vault else Decimal("0")
            
            # Get all floats for this branch on target date
            floats = session.query(TellerFloat).filter(
                and_(
                    TellerFloat.branch_id == branch.id,
                    TellerFloat.date == target_date
                )
            ).all()
            
            branch_float_total = sum([f.current_balance or Decimal("0") for f in floats])
            branch_deposits = sum([f.deposits_in or Decimal("0") for f in floats])
            branch_withdrawals = sum([f.withdrawals_out or Decimal("0") for f in floats])
            
            branch_data = {
                "branch_id": branch.id,
                "branch_name": branch.name,
                "vault_balance": float(vault_balance),
                "float_allocated": float(branch_float_total),
                "deposits_received": float(branch_deposits),
                "withdrawals_paid": float(branch_withdrawals),
                "total_cash_in_hand": float(vault_balance + branch_float_total),
                "teller_count": len(floats),
                "tellers": [{
                    "staff_name": f"{f.staff.first_name} {f.staff.last_name}" if f.staff else "Unknown",
                    "opening_balance": float(f.opening_balance or 0),
                    "current_balance": float(f.current_balance or 0),
                    "deposits": float(f.deposits_in or 0),
                    "withdrawals": float(f.withdrawals_out or 0),
                    "status": f.status
                } for f in floats]
            }
            
            report_data.append(branch_data)
            
            totals["vault_balance"] += vault_balance
            totals["float_allocated"] += branch_float_total
            totals["deposits_received"] += branch_deposits
            totals["withdrawals_paid"] += branch_withdrawals
            totals["total_cash_in_hand"] += (vault_balance + branch_float_total)
        
        return {
            "report_date": target_date.isoformat(),
            "branches": report_data,
            "totals": {k: float(v) for k, v in totals.items()}
        }
    finally:
        session.close()
        tenant_ctx.close()
