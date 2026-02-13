from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from decimal import Decimal
from datetime import datetime, date, timedelta
from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from models.database import get_db
from models.tenant import (
    Member, Transaction, Staff, ChequeDeposit, BankTransfer, 
    QueueTicket, TransactionReceipt, OrganizationSettings, TellerServiceAssignment
)
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from services.feature_flags import check_org_feature
from services.code_generator import generate_txn_code

router = APIRouter()

# Pydantic models
class ChequeDepositCreate(BaseModel):
    member_id: str
    cheque_number: str
    bank_name: str
    bank_branch: Optional[str] = None
    drawer_name: Optional[str] = None
    amount: float
    account_type: Literal["savings", "shares", "deposits"] = "savings"
    notes: Optional[str] = None

class ChequeActionRequest(BaseModel):
    action: Literal["clear", "bounce", "cancel"]
    reason: Optional[str] = None

class BankTransferCreate(BaseModel):
    member_id: Optional[str] = None
    transfer_type: Literal["incoming", "outgoing"] = "incoming"
    amount: float
    bank_name: str
    bank_account: Optional[str] = None
    bank_reference: Optional[str] = None
    account_type: Literal["savings", "shares", "deposits"] = "savings"
    transfer_date: Optional[str] = None
    notes: Optional[str] = None

class BankTransferAction(BaseModel):
    action: Literal["verify", "credit", "reject"]
    member_id: Optional[str] = None
    reason: Optional[str] = None

class QueueTicketCreate(BaseModel):
    branch_id: str
    service_category: Literal["transactions", "loans", "account_opening", "inquiries"]
    member_id: Optional[str] = None
    member_name: Optional[str] = None
    member_phone: Optional[str] = None
    priority: int = 0

# Cheque Deposit Endpoints
@router.get("/organizations/{org_id}/cheque-deposits")
async def list_cheque_deposits(
    org_id: str,
    status: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(ChequeDeposit)
        if status:
            query = query.filter(ChequeDeposit.status == status)
        cheques = query.order_by(desc(ChequeDeposit.created_at)).limit(500).all()
        
        result = []
        for c in cheques:
            member = tenant_session.query(Member).filter(Member.id == c.member_id).first()
            result.append({
                "id": c.id,
                "member_id": c.member_id,
                "member_name": f"{member.first_name} {member.last_name}" if member else None,
                "member_number": member.member_number if member else None,
                "cheque_number": c.cheque_number,
                "bank_name": c.bank_name,
                "bank_branch": c.bank_branch,
                "drawer_name": c.drawer_name,
                "amount": float(c.amount) if c.amount else 0,
                "account_type": c.account_type,
                "status": c.status,
                "deposit_date": c.deposit_date.isoformat() if c.deposit_date else None,
                "expected_clearance_date": c.expected_clearance_date.isoformat() if c.expected_clearance_date else None,
                "cleared_date": c.cleared_date.isoformat() if c.cleared_date else None,
                "bounced_reason": c.bounced_reason,
                "notes": c.notes,
                "created_at": c.created_at.isoformat() if c.created_at else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/cheque-deposits")
async def create_cheque_deposit(
    org_id: str,
    data: ChequeDepositCreate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == data.member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        today = date.today()
        expected_clearance = today + timedelta(days=3)
        
        cheque = ChequeDeposit(
            member_id=data.member_id,
            cheque_number=data.cheque_number,
            bank_name=data.bank_name,
            bank_branch=data.bank_branch,
            drawer_name=data.drawer_name,
            amount=Decimal(str(data.amount)),
            account_type=data.account_type,
            status="pending",
            deposit_date=today,
            expected_clearance_date=expected_clearance,
            deposited_by_id=staff.id if staff else None,
            notes=data.notes
        )
        tenant_session.add(cheque)
        
        # Add to pending balance
        pending_field = f"{data.account_type}_pending"
        current_pending = getattr(member, pending_field) or Decimal("0")
        setattr(member, pending_field, current_pending + Decimal(str(data.amount)))
        
        tenant_session.commit()
        return {"success": True, "id": cheque.id, "message": "Cheque deposit recorded. Awaiting clearance."}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/cheque-deposits/{cheque_id}/action")
async def cheque_deposit_action(
    org_id: str,
    cheque_id: str,
    data: ChequeActionRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        cheque = tenant_session.query(ChequeDeposit).filter(ChequeDeposit.id == cheque_id).first()
        if not cheque:
            raise HTTPException(status_code=404, detail="Cheque deposit not found")
        
        if cheque.status != "pending":
            raise HTTPException(status_code=400, detail=f"Cheque already {cheque.status}")
        
        member = tenant_session.query(Member).filter(Member.id == cheque.member_id).first()
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        pending_field = f"{cheque.account_type}_pending"
        balance_field = f"{cheque.account_type}_balance"
        
        if data.action == "clear":
            # Move from pending to available
            current_pending = getattr(member, pending_field) or Decimal("0")
            current_balance = getattr(member, balance_field) or Decimal("0")
            
            setattr(member, pending_field, current_pending - cheque.amount)
            setattr(member, balance_field, current_balance + cheque.amount)
            
            # Create transaction
            code = generate_txn_code()
            
            transaction = Transaction(
                transaction_number=code,
                member_id=cheque.member_id,
                transaction_type="deposit",
                account_type=cheque.account_type,
                amount=cheque.amount,
                balance_before=current_balance,
                balance_after=current_balance + cheque.amount,
                payment_method="cheque",
                reference=cheque.cheque_number,
                description=f"Cheque deposit cleared - {cheque.bank_name}",
                processed_by_id=staff.id if staff else None
            )
            tenant_session.add(transaction)
            tenant_session.flush()
            
            cheque.status = "cleared"
            cheque.cleared_date = date.today()
            cheque.cleared_by_id = staff.id if staff else None
            cheque.transaction_id = transaction.id
            
            message = "Cheque cleared and credited to member"
            
        elif data.action == "bounce":
            # Remove from pending
            current_pending = getattr(member, pending_field) or Decimal("0")
            setattr(member, pending_field, current_pending - cheque.amount)
            
            cheque.status = "bounced"
            cheque.bounced_reason = data.reason
            cheque.cleared_by_id = staff.id if staff else None
            
            message = "Cheque marked as bounced"
            
        elif data.action == "cancel":
            # Remove from pending
            current_pending = getattr(member, pending_field) or Decimal("0")
            setattr(member, pending_field, current_pending - cheque.amount)
            
            cheque.status = "cancelled"
            cheque.bounced_reason = data.reason
            cheque.cleared_by_id = staff.id if staff else None
            
            message = "Cheque deposit cancelled"
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        tenant_session.commit()
        return {"success": True, "message": message}
    finally:
        tenant_session.close()
        tenant_ctx.close()

# Bank Transfer Endpoints
@router.get("/organizations/{org_id}/bank-transfers")
async def list_bank_transfers(
    org_id: str,
    status: str = None,
    transfer_type: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not check_org_feature(org_id, "bank_integration", db):
        raise HTTPException(status_code=403, detail="Bank integration is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(BankTransfer)
        if status:
            query = query.filter(BankTransfer.status == status)
        if transfer_type:
            query = query.filter(BankTransfer.transfer_type == transfer_type)
        transfers = query.order_by(desc(BankTransfer.created_at)).limit(500).all()
        
        result = []
        for t in transfers:
            member = None
            if t.member_id:
                member = tenant_session.query(Member).filter(Member.id == t.member_id).first()
            result.append({
                "id": t.id,
                "member_id": t.member_id,
                "member_name": f"{member.first_name} {member.last_name}" if member else None,
                "member_number": member.member_number if member else None,
                "transfer_type": t.transfer_type,
                "amount": float(t.amount) if t.amount else 0,
                "bank_name": t.bank_name,
                "bank_account": t.bank_account,
                "bank_reference": t.bank_reference,
                "account_type": t.account_type,
                "status": t.status,
                "transfer_date": t.transfer_date.isoformat() if t.transfer_date else None,
                "notes": t.notes,
                "rejection_reason": t.rejection_reason,
                "created_at": t.created_at.isoformat() if t.created_at else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/bank-transfers")
async def create_bank_transfer(
    org_id: str,
    data: BankTransferCreate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not check_org_feature(org_id, "bank_integration", db):
        raise HTTPException(status_code=403, detail="Bank integration is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        transfer = BankTransfer(
            member_id=data.member_id,
            transfer_type=data.transfer_type,
            amount=Decimal(str(data.amount)),
            bank_name=data.bank_name,
            bank_account=data.bank_account,
            bank_reference=data.bank_reference,
            account_type=data.account_type,
            status="pending",
            transfer_date=datetime.strptime(data.transfer_date, "%Y-%m-%d").date() if data.transfer_date else date.today(),
            notes=data.notes
        )
        tenant_session.add(transfer)
        tenant_session.commit()
        return {"success": True, "id": transfer.id, "message": "Bank transfer recorded. Awaiting verification."}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/bank-transfers/{transfer_id}/action")
async def bank_transfer_action(
    org_id: str,
    transfer_id: str,
    data: BankTransferAction,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not check_org_feature(org_id, "bank_integration", db):
        raise HTTPException(status_code=403, detail="Bank integration is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        transfer = tenant_session.query(BankTransfer).filter(BankTransfer.id == transfer_id).first()
        if not transfer:
            raise HTTPException(status_code=404, detail="Bank transfer not found")
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        if data.action == "verify":
            if transfer.status != "pending":
                raise HTTPException(status_code=400, detail=f"Transfer already {transfer.status}")
            transfer.status = "verified"
            transfer.verified_by_id = staff.id if staff else None
            transfer.verified_at = datetime.utcnow()
            message = "Transfer verified"
            
        elif data.action == "credit":
            if transfer.status not in ["pending", "verified"]:
                raise HTTPException(status_code=400, detail=f"Transfer already {transfer.status}")
            
            member_id = data.member_id or transfer.member_id
            if not member_id:
                raise HTTPException(status_code=400, detail="Member ID required")
            
            member = tenant_session.query(Member).filter(Member.id == member_id).first()
            if not member:
                raise HTTPException(status_code=404, detail="Member not found")
            
            # Credit member
            balance_field = f"{transfer.account_type}_balance"
            current_balance = getattr(member, balance_field) or Decimal("0")
            new_balance = current_balance + transfer.amount
            
            code = generate_txn_code()
            
            transaction = Transaction(
                transaction_number=code,
                member_id=member.id,
                transaction_type="deposit",
                account_type=transfer.account_type,
                amount=transfer.amount,
                balance_before=current_balance,
                balance_after=new_balance,
                payment_method="bank_transfer",
                reference=transfer.bank_reference,
                description=f"Bank transfer from {transfer.bank_name}",
                processed_by_id=staff.id if staff else None
            )
            
            setattr(member, balance_field, new_balance)
            tenant_session.add(transaction)
            tenant_session.flush()
            
            transfer.member_id = member.id
            transfer.status = "credited"
            transfer.credited_by_id = staff.id if staff else None
            transfer.credited_at = datetime.utcnow()
            transfer.transaction_id = transaction.id
            
            message = "Transfer credited to member"
            
        elif data.action == "reject":
            transfer.status = "rejected"
            transfer.rejection_reason = data.reason
            transfer.verified_by_id = staff.id if staff else None
            transfer.verified_at = datetime.utcnow()
            message = "Transfer rejected"
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        tenant_session.commit()
        return {"success": True, "message": message}
    finally:
        tenant_session.close()
        tenant_ctx.close()

# Queue Ticket Endpoints
@router.get("/organizations/{org_id}/queue-tickets")
async def list_queue_tickets(
    org_id: str,
    branch_id: str = None,
    status: str = None,
    today_only: bool = True,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(QueueTicket)
        
        if branch_id:
            query = query.filter(QueueTicket.branch_id == branch_id)
        if status:
            status_list = [s.strip() for s in status.split(",")]
            query = query.filter(QueueTicket.status.in_(status_list))
        if today_only:
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(QueueTicket.created_at >= today_start)
        
        tickets = query.order_by(QueueTicket.priority.desc(), QueueTicket.created_at).limit(200).all()
        
        result = []
        for t in tickets:
            teller_name = None
            if t.teller_id:
                teller = tenant_session.query(Staff).filter(Staff.id == t.teller_id).first()
                if teller:
                    teller_name = f"{teller.first_name} {teller.last_name}"
            
            result.append({
                "id": t.id,
                "ticket_number": t.ticket_number,
                "branch_id": t.branch_id,
                "service_category": t.service_category,
                "member_id": t.member_id,
                "member_name": t.member_name,
                "member_phone": t.member_phone,
                "status": t.status,
                "priority": t.priority,
                "teller_id": t.teller_id,
                "teller_name": teller_name,
                "counter_number": t.counter_number,
                "called_at": t.called_at.isoformat() if t.called_at else None,
                "started_at": t.started_at.isoformat() if t.started_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "wait_time_seconds": t.wait_time_seconds,
                "service_time_seconds": t.service_time_seconds,
                "created_at": t.created_at.isoformat() if t.created_at else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/queue-tickets")
async def create_queue_ticket(
    org_id: str,
    data: QueueTicketCreate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new queue ticket (kiosk endpoint)"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        # Generate ticket number
        today = date.today()
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Count today's tickets for this branch and category
        prefix = data.service_category[0].upper()  # D for deposits, L for loans, I for inquiries
        count = tenant_session.query(func.count(QueueTicket.id)).filter(
            QueueTicket.branch_id == data.branch_id,
            QueueTicket.service_category == data.service_category,
            QueueTicket.created_at >= today_start
        ).scalar() or 0
        
        ticket_number = f"{prefix}{count + 1:03d}"
        
        ticket = QueueTicket(
            ticket_number=ticket_number,
            branch_id=data.branch_id,
            service_category=data.service_category,
            member_id=data.member_id,
            member_name=data.member_name,
            member_phone=data.member_phone,
            status="waiting",
            priority=data.priority
        )
        tenant_session.add(ticket)
        tenant_session.commit()
        
        # Count people ahead
        ahead = tenant_session.query(func.count(QueueTicket.id)).filter(
            QueueTicket.branch_id == data.branch_id,
            QueueTicket.status == "waiting",
            QueueTicket.created_at < ticket.created_at
        ).scalar() or 0
        
        return {
            "success": True,
            "ticket_number": ticket_number,
            "service_category": data.service_category,
            "ahead_in_queue": ahead,
            "message": f"Your ticket number is {ticket_number}. {ahead} people ahead."
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/queue-tickets/call-next")
async def call_next_ticket(
    org_id: str,
    branch_id: str,
    counter_number: str = None,
    service_category: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Teller calls next ticket based on assigned service types"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            raise HTTPException(status_code=400, detail="Staff record not found")
        
        # Get teller's assigned service types
        assignments = tenant_session.query(TellerServiceAssignment).filter(
            TellerServiceAssignment.staff_id == staff.id,
            TellerServiceAssignment.is_active == True
        ).all()
        
        assigned_services = [a.service_type for a in assignments]
        
        # Find next waiting ticket
        query = tenant_session.query(QueueTicket).filter(
            QueueTicket.branch_id == branch_id,
            QueueTicket.status == "waiting"
        )
        
        # Filter by specific category if provided, otherwise by assigned services (if any)
        if service_category:
            query = query.filter(QueueTicket.service_category == service_category)
        elif assigned_services:
            # Only filter by assigned services if teller has specific assignments
            query = query.filter(QueueTicket.service_category.in_(assigned_services))
        # If no assignments, teller can call any waiting ticket (default behavior)
        
        ticket = query.order_by(
            QueueTicket.priority.desc(),
            QueueTicket.created_at
        ).first()
        
        if not ticket:
            return {"success": False, "message": "No waiting tickets in queue"}
        
        # Update ticket
        ticket.status = "serving"
        ticket.teller_id = staff.id
        ticket.counter_number = counter_number or staff.staff_number
        ticket.called_at = datetime.utcnow()
        ticket.started_at = datetime.utcnow()
        
        # Calculate wait time
        if ticket.created_at:
            wait_delta = datetime.utcnow() - ticket.created_at
            ticket.wait_time_seconds = int(wait_delta.total_seconds())
        
        tenant_session.commit()
        
        return {
            "success": True,
            "ticket": {
                "id": ticket.id,
                "ticket_number": ticket.ticket_number,
                "service_category": ticket.service_category,
                "member_name": ticket.member_name,
                "counter_number": ticket.counter_number,
                "teller_name": f"{staff.first_name} {staff.last_name}",
                "teller_number": staff.staff_number
            }
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/queue-tickets/{ticket_id}/complete")
async def complete_ticket(
    org_id: str,
    ticket_id: str,
    notes: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark ticket as completed"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        ticket = tenant_session.query(QueueTicket).filter(QueueTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        ticket.status = "completed"
        ticket.completed_at = datetime.utcnow()
        ticket.notes = notes
        
        if ticket.started_at:
            service_delta = datetime.utcnow() - ticket.started_at
            ticket.service_time_seconds = int(service_delta.total_seconds())
        
        tenant_session.commit()
        return {"success": True, "message": "Ticket completed"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/queue-stats")
async def get_queue_stats(
    org_id: str,
    branch_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get queue statistics for the kiosk"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        waiting_counts = {}
        for category in ["transactions", "loans", "account_opening", "inquiries"]:
            count = tenant_session.query(func.count(QueueTicket.id)).filter(
                QueueTicket.branch_id == branch_id,
                QueueTicket.service_category == category,
                QueueTicket.status == "waiting",
                QueueTicket.created_at >= today_start
            ).scalar() or 0
            waiting_counts[category] = count
        
        return {"waiting_counts": waiting_counts}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/queue-display")
async def get_queue_display(
    org_id: str,
    branch_id: str,
    db: Session = Depends(get_db)
):
    """Public endpoint for queue display screen"""
    from models.master import Organization
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or not org.connection_string:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    tenant_ctx = TenantContext(org.connection_string)
    tenant_session = tenant_ctx.create_session()
    try:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Currently serving
        serving = tenant_session.query(QueueTicket).filter(
            QueueTicket.branch_id == branch_id,
            QueueTicket.status == "serving",
            QueueTicket.created_at >= today_start
        ).all()
        
        # Waiting tickets
        waiting = tenant_session.query(QueueTicket).filter(
            QueueTicket.branch_id == branch_id,
            QueueTicket.status == "waiting",
            QueueTicket.created_at >= today_start
        ).order_by(QueueTicket.priority.desc(), QueueTicket.created_at).limit(10).all()
        
        return {
            "serving": [
                {
                    "ticket_number": t.ticket_number,
                    "counter_number": t.counter_number,
                    "service_category": t.service_category
                }
                for t in serving
            ],
            "waiting": [
                {
                    "ticket_number": t.ticket_number,
                    "service_category": t.service_category
                }
                for t in waiting
            ]
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

# Receipt Endpoints
@router.post("/organizations/{org_id}/transactions/{transaction_id}/receipt")
async def generate_receipt(
    org_id: str,
    transaction_id: str,
    send_sms: bool = False,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate receipt for a transaction"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        transaction = tenant_session.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        member = tenant_session.query(Member).filter(Member.id == transaction.member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        # Check for existing receipt
        existing = tenant_session.query(TransactionReceipt).filter(
            TransactionReceipt.transaction_id == transaction_id
        ).first()
        
        if existing:
            receipt = existing
        else:
            # Generate receipt number
            count = tenant_session.query(func.count(TransactionReceipt.id)).scalar() or 0
            receipt_number = f"RCP{datetime.now().strftime('%Y%m%d')}{count + 1:04d}"
            
            receipt = TransactionReceipt(
                receipt_number=receipt_number,
                transaction_id=transaction_id,
                member_id=member.id
            )
            tenant_session.add(receipt)
        
        receipt.printed = True
        receipt.printed_at = datetime.utcnow()
        receipt.printed_by_id = staff.id if staff else None
        
        # Get organization settings for receipt
        org_name = tenant_session.query(OrganizationSettings).filter(
            OrganizationSettings.setting_key == "organization_name"
        ).first()
        
        teller_name = None
        if transaction.processed_by_id:
            teller = tenant_session.query(Staff).filter(Staff.id == transaction.processed_by_id).first()
            if teller:
                teller_name = f"{teller.first_name} {teller.last_name}"
        
        receipt_data = {
            "receipt_number": receipt.receipt_number,
            "organization_name": org_name.setting_value if org_name else "SACCO",
            "date": transaction.created_at.strftime("%Y-%m-%d %H:%M:%S") if transaction.created_at else None,
            "member_name": f"{member.first_name} {member.last_name}",
            "member_number": member.member_number,
            "transaction_number": transaction.transaction_number,
            "transaction_type": transaction.transaction_type,
            "account_type": transaction.account_type,
            "amount": float(transaction.amount) if transaction.amount else 0,
            "payment_method": transaction.payment_method,
            "balance_after": float(transaction.balance_after) if transaction.balance_after else 0,
            "teller_name": teller_name,
            "reference": transaction.reference
        }
        
        if send_sms and member.phone:
            # TODO: Send SMS receipt
            receipt.sms_sent = True
            receipt.sms_sent_at = datetime.utcnow()
            receipt.sms_phone = member.phone
        
        tenant_session.commit()
        
        return {"success": True, "receipt": receipt_data}
    finally:
        tenant_session.close()
        tenant_ctx.close()

# Teller Service Assignments
class TellerServiceAssignmentRequest(BaseModel):
    staff_id: str
    service_types: list[str]  # List of service types: deposits, withdrawals, loans, inquiries, account_opening

@router.get("/organizations/{org_id}/teller-service-assignments")
async def list_teller_service_assignments(
    org_id: str,
    staff_id: str = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List teller service assignments"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "staff:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(TellerServiceAssignment).filter(
            TellerServiceAssignment.is_active == True
        )
        if staff_id:
            query = query.filter(TellerServiceAssignment.staff_id == staff_id)
        
        assignments = query.all()
        
        result = {}
        for a in assignments:
            if a.staff_id not in result:
                staff = tenant_session.query(Staff).filter(Staff.id == a.staff_id).first()
                result[a.staff_id] = {
                    "staff_id": a.staff_id,
                    "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                    "staff_number": staff.staff_number if staff else None,
                    "service_types": []
                }
            result[a.staff_id]["service_types"].append(a.service_type)
        
        return list(result.values())
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/teller-service-assignments")
async def update_teller_service_assignments(
    org_id: str,
    data: TellerServiceAssignmentRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update teller's service type assignments (replaces existing)"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "staff:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        # Deactivate existing assignments
        tenant_session.query(TellerServiceAssignment).filter(
            TellerServiceAssignment.staff_id == data.staff_id
        ).update({"is_active": False})
        
        # Create new assignments
        for service_type in data.service_types:
            assignment = TellerServiceAssignment(
                staff_id=data.staff_id,
                service_type=service_type,
                is_active=True
            )
            tenant_session.add(assignment)
        
        tenant_session.commit()
        return {"success": True, "message": "Service assignments updated"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

# Display Board Endpoint
@router.get("/organizations/{org_id}/queue-display")
async def get_queue_display(
    org_id: str,
    branch_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get display board data - currently called tickets"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Get currently serving tickets
        serving = tenant_session.query(QueueTicket).filter(
            QueueTicket.branch_id == branch_id,
            QueueTicket.status == "serving",
            QueueTicket.created_at >= today_start
        ).order_by(desc(QueueTicket.called_at)).limit(10).all()
        
        # Get waiting counts by category
        waiting_counts = tenant_session.query(
            QueueTicket.service_category,
            func.count(QueueTicket.id)
        ).filter(
            QueueTicket.branch_id == branch_id,
            QueueTicket.status == "waiting",
            QueueTicket.created_at >= today_start
        ).group_by(QueueTicket.service_category).all()
        
        # Get recently called (last 5 completed)
        recent = tenant_session.query(QueueTicket).filter(
            QueueTicket.branch_id == branch_id,
            QueueTicket.status == "completed",
            QueueTicket.created_at >= today_start
        ).order_by(desc(QueueTicket.completed_at)).limit(5).all()
        
        serving_data = []
        for t in serving:
            teller = tenant_session.query(Staff).filter(Staff.id == t.teller_id).first() if t.teller_id else None
            serving_data.append({
                "ticket_number": t.ticket_number,
                "service_category": t.service_category,
                "counter_number": t.counter_number,
                "teller_name": f"{teller.first_name} {teller.last_name}" if teller else None,
                "teller_number": teller.staff_number if teller else t.counter_number,
                "called_at": t.called_at.isoformat() if t.called_at else None
            })
        
        return {
            "serving": serving_data,
            "waiting_counts": {cat: count for cat, count in waiting_counts},
            "recent_completed": [
                {"ticket_number": t.ticket_number, "service_category": t.service_category}
                for t in recent
            ],
            "timestamp": datetime.now().isoformat()
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

# Import TenantContext for queue display
from services.tenant_context import TenantContext
