from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, date
from pydantic import BaseModel

from models.database import get_db
from models.tenant import DividendDeclaration, MemberDividend, Member, Staff, Transaction
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from routes.sms import send_sms
from services.feature_flags import check_org_feature

router = APIRouter()

def get_org_currency(session):
    from models.tenant import OrganizationSettings
    try:
        setting = session.query(OrganizationSettings).filter(OrganizationSettings.setting_key == "currency").first()
        return setting.setting_value if setting else "KES"
    except:
        return "KES"

class DividendDeclareRequest(BaseModel):
    fiscal_year: int
    declaration_date: date
    effective_date: date
    dividend_rate: float
    distribution_type: str = "savings"
    notes: Optional[str] = None

class DividendApproveRequest(BaseModel):
    notes: Optional[str] = None

class DividendResponse(BaseModel):
    id: str
    fiscal_year: int
    declaration_date: date
    effective_date: date
    dividend_rate: float
    total_shares_value: Optional[float] = None
    total_dividend_amount: Optional[float] = None
    distribution_type: str
    status: str
    approved_at: Optional[datetime] = None
    distributed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    member_count: Optional[int] = None
    
    class Config:
        from_attributes = True

class MemberDividendResponse(BaseModel):
    id: str
    member_id: str
    member_name: str
    member_number: str
    shares_balance: float
    dividend_rate: float
    dividend_amount: float
    status: str
    credited_to: Optional[str] = None
    credited_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

def post_dividend_to_gl(tenant_session, declaration, total_amount: Decimal, distribution_type: str):
    """Post dividend distribution to General Ledger. Raises exception on failure to ensure atomic transaction."""
    from accounting.service import AccountingService
    
    svc = AccountingService(tenant_session)
    svc.seed_default_accounts()
    
    if distribution_type == "savings":
        credit_account = "2000"
        memo = "Dividend credited to member savings"
    else:
        credit_account = "2010"
        memo = "Dividend credited to member shares"
    
    lines = [
        {"account_code": "3100", "debit": total_amount, "credit": Decimal("0"), "memo": f"Dividend distribution FY{declaration.fiscal_year}"},
        {"account_code": credit_account, "debit": Decimal("0"), "credit": total_amount, "memo": memo}
    ]
    
    svc.create_journal_entry(
        entry_date=date.today(),
        description=f"Dividend distribution - FY{declaration.fiscal_year} @ {declaration.dividend_rate}%",
        source_type="dividend",
        source_id=str(declaration.id),
        lines=lines
    )
    print(f"[GL] Posted dividend distribution to GL: FY{declaration.fiscal_year}")

@router.get("/{org_id}/dividends")
async def list_dividends(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """List all dividend declarations"""
    if not check_org_feature(org_id, "dividends", db):
        raise HTTPException(status_code=403, detail="Dividends is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        declarations = tenant_session.query(DividendDeclaration).order_by(DividendDeclaration.fiscal_year.desc()).all()
        
        result = []
        for d in declarations:
            member_count = tenant_session.query(func.count(MemberDividend.id)).filter(
                MemberDividend.declaration_id == d.id
            ).scalar() or 0
            
            result.append({
                "id": d.id,
                "fiscal_year": d.fiscal_year,
                "declaration_date": d.declaration_date,
                "effective_date": d.effective_date,
                "dividend_rate": float(d.dividend_rate or 0),
                "total_shares_value": float(d.total_shares_value or 0),
                "total_dividend_amount": float(d.total_dividend_amount or 0),
                "distribution_type": d.distribution_type,
                "status": d.status,
                "approved_at": d.approved_at,
                "distributed_at": d.distributed_at,
                "notes": d.notes,
                "created_at": d.created_at,
                "member_count": member_count
            })
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/dividends/declare")
async def declare_dividend(org_id: str, data: DividendDeclareRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Declare a new dividend. Member share balances are captured at declaration time
    and stored for each member. The effective_date is used as the reference date for
    record-keeping purposes. For accurate dividends, declare on or shortly after the effective date.
    """
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    
    if data.dividend_rate <= 0:
        raise HTTPException(status_code=400, detail="Dividend rate must be greater than 0")
    
    if data.effective_date > data.declaration_date:
        raise HTTPException(status_code=400, detail="Effective date cannot be after declaration date")
    
    tenant_session = tenant_ctx.create_session()
    try:
        existing = tenant_session.query(DividendDeclaration).filter(
            DividendDeclaration.fiscal_year == data.fiscal_year,
            DividendDeclaration.status != "cancelled"
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail=f"Dividend already declared for fiscal year {data.fiscal_year}")
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        members = tenant_session.query(Member).filter(
            Member.is_active == True,
            Member.shares_balance > 0
        ).all()
        
        if not members:
            raise HTTPException(status_code=400, detail="No eligible members found with share balance > 0")
        
        total_shares = sum(Decimal(str(m.shares_balance or 0)) for m in members)
        dividend_rate = Decimal(str(data.dividend_rate))
        total_dividend = total_shares * dividend_rate / Decimal("100")
        
        declaration = DividendDeclaration(
            fiscal_year=data.fiscal_year,
            declaration_date=data.declaration_date,
            effective_date=data.effective_date,
            dividend_rate=dividend_rate,
            total_shares_value=total_shares,
            total_dividend_amount=total_dividend,
            distribution_type=data.distribution_type,
            status="declared",
            notes=data.notes,
            created_by_id=staff.id if staff else None
        )
        tenant_session.add(declaration)
        tenant_session.flush()
        
        for member in members:
            member_shares = Decimal(str(member.shares_balance or 0))
            member_dividend = member_shares * dividend_rate / Decimal("100")
            
            md = MemberDividend(
                declaration_id=declaration.id,
                member_id=member.id,
                shares_balance=member_shares,
                dividend_rate=dividend_rate,
                dividend_amount=member_dividend,
                status="pending"
            )
            tenant_session.add(md)
        
        tenant_session.commit()
        tenant_session.refresh(declaration)
        
        return {
            "id": declaration.id,
            "fiscal_year": declaration.fiscal_year,
            "dividend_rate": float(declaration.dividend_rate),
            "total_shares_value": float(declaration.total_shares_value),
            "total_dividend_amount": float(declaration.total_dividend_amount),
            "member_count": len(members),
            "status": declaration.status,
            "message": f"Dividend declared for {len(members)} members. Total: {get_org_currency(tenant_session)} {float(total_dividend):,.2f}"
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/dividends/{dividend_id}")
async def get_dividend(org_id: str, dividend_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get dividend declaration details"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        declaration = tenant_session.query(DividendDeclaration).filter(
            DividendDeclaration.id == dividend_id
        ).first()
        
        if not declaration:
            raise HTTPException(status_code=404, detail="Dividend declaration not found")
        
        member_dividends = tenant_session.query(MemberDividend).filter(
            MemberDividend.declaration_id == dividend_id
        ).all()
        
        members_data = []
        for md in member_dividends:
            member = tenant_session.query(Member).filter(Member.id == md.member_id).first()
            members_data.append({
                "id": md.id,
                "member_id": md.member_id,
                "member_name": f"{member.first_name} {member.last_name}" if member else "Unknown",
                "member_number": member.member_number if member else "",
                "shares_balance": float(md.shares_balance),
                "dividend_rate": float(md.dividend_rate),
                "dividend_amount": float(md.dividend_amount),
                "status": md.status,
                "credited_to": md.credited_to,
                "credited_at": md.credited_at
            })
        
        return {
            "declaration": {
                "id": declaration.id,
                "fiscal_year": declaration.fiscal_year,
                "declaration_date": declaration.declaration_date,
                "effective_date": declaration.effective_date,
                "dividend_rate": float(declaration.dividend_rate),
                "total_shares_value": float(declaration.total_shares_value or 0),
                "total_dividend_amount": float(declaration.total_dividend_amount or 0),
                "distribution_type": declaration.distribution_type,
                "status": declaration.status,
                "approved_at": declaration.approved_at,
                "distributed_at": declaration.distributed_at,
                "notes": declaration.notes,
                "created_at": declaration.created_at
            },
            "members": members_data
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/dividends/{dividend_id}/approve")
async def approve_dividend(org_id: str, dividend_id: str, data: DividendApproveRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Approve a dividend declaration (simulates AGM approval)"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        declaration = tenant_session.query(DividendDeclaration).filter(
            DividendDeclaration.id == dividend_id
        ).first()
        
        if not declaration:
            raise HTTPException(status_code=404, detail="Dividend declaration not found")
        
        if declaration.status != "declared":
            raise HTTPException(status_code=400, detail=f"Cannot approve dividend in status: {declaration.status}")
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        declaration.status = "approved"
        declaration.approved_by_id = staff.id if staff else None
        declaration.approved_at = datetime.utcnow()
        if data.notes:
            declaration.notes = f"{declaration.notes or ''}\n[Approved] {data.notes}".strip()
        
        tenant_session.commit()
        
        return {"message": "Dividend approved successfully", "status": "approved"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/dividends/{dividend_id}/distribute")
async def distribute_dividend(org_id: str, dividend_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Distribute dividend to all members (credit to savings/shares)"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        declaration = tenant_session.query(DividendDeclaration).filter(
            DividendDeclaration.id == dividend_id
        ).first()
        
        if not declaration:
            raise HTTPException(status_code=404, detail="Dividend declaration not found")
        
        if declaration.status != "approved":
            raise HTTPException(status_code=400, detail=f"Dividend must be approved before distribution. Current status: {declaration.status}")
        
        declaration.status = "processing"
        tenant_session.commit()
        
        member_dividends = tenant_session.query(MemberDividend).filter(
            MemberDividend.declaration_id == dividend_id,
            MemberDividend.status == "pending"
        ).all()
        
        credited_count = 0
        total_credited = Decimal("0")
        
        for md in member_dividends:
            member = tenant_session.query(Member).filter(Member.id == md.member_id).first()
            if not member:
                md.status = "failed"
                md.notes = "Member not found"
                continue
            
            dividend_amount = Decimal(str(md.dividend_amount))
            
            if declaration.distribution_type == "savings":
                balance_before = member.savings_balance or Decimal("0")
                member.savings_balance = balance_before + dividend_amount
                balance_after = member.savings_balance
                account_type = "savings"
                md.credited_to = "savings"
            else:
                balance_before = member.shares_balance or Decimal("0")
                member.shares_balance = balance_before + dividend_amount
                balance_after = member.shares_balance
                account_type = "shares"
                md.credited_to = "shares"
            
            txn_number = f"DIV-{declaration.fiscal_year}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{credited_count + 1}"
            transaction = Transaction(
                transaction_number=txn_number,
                member_id=member.id,
                transaction_type="dividend",
                account_type=account_type,
                amount=dividend_amount,
                balance_before=balance_before,
                balance_after=balance_after,
                payment_method="system",
                reference=f"DIV-FY{declaration.fiscal_year}",
                description=f"Dividend FY{declaration.fiscal_year} @ {declaration.dividend_rate}%"
            )
            tenant_session.add(transaction)
            
            md.status = "credited"
            md.credited_at = datetime.utcnow()
            credited_count += 1
            total_credited += dividend_amount
        
        declaration.status = "distributed"
        declaration.distributed_at = datetime.utcnow()
        
        post_dividend_to_gl(tenant_session, declaration, total_credited, declaration.distribution_type)
        
        tenant_session.commit()
        
        sms_sent = 0
        for md in member_dividends:
            if md.status == "credited":
                member = tenant_session.query(Member).filter(Member.id == md.member_id).first()
                if member and member.phone:
                    try:
                        credited_to = "savings account" if md.credited_to == "savings" else "share capital"
                        currency = get_org_currency(tenant_session)
                        message = f"Dear {member.first_name}, your dividend of {currency} {float(md.dividend_amount):,.2f} for FY{declaration.fiscal_year} has been credited to your {credited_to}. Thank you for being a valued member."
                        send_sms(member.phone_number, message, tenant_session)
                        sms_sent += 1
                    except Exception as e:
                        print(f"[SMS] Failed to send dividend SMS to {member.phone_number}: {e}")
        
        return {
            "message": f"Dividend distributed to {credited_count} members. {sms_sent} SMS notifications sent.",
            "credited_count": credited_count,
            "total_credited": float(total_credited),
            "distribution_type": declaration.distribution_type,
            "sms_sent": sms_sent,
            "status": "distributed"
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/dividends/{dividend_id}/cancel")
async def cancel_dividend(org_id: str, dividend_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Cancel a dividend declaration (only if not distributed)"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        declaration = tenant_session.query(DividendDeclaration).filter(
            DividendDeclaration.id == dividend_id
        ).first()
        
        if not declaration:
            raise HTTPException(status_code=404, detail="Dividend declaration not found")
        
        if declaration.status == "distributed":
            raise HTTPException(status_code=400, detail="Cannot cancel a distributed dividend")
        
        declaration.status = "cancelled"
        
        tenant_session.query(MemberDividend).filter(
            MemberDividend.declaration_id == dividend_id
        ).delete()
        
        tenant_session.commit()
        
        return {"message": "Dividend cancelled successfully", "status": "cancelled"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/dividends/member/{member_id}")
async def get_member_dividend_history(org_id: str, member_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get dividend history for a specific member"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        dividends = tenant_session.query(MemberDividend).filter(
            MemberDividend.member_id == member_id
        ).order_by(MemberDividend.created_at.desc()).all()
        
        result = []
        for md in dividends:
            declaration = tenant_session.query(DividendDeclaration).filter(
                DividendDeclaration.id == md.declaration_id
            ).first()
            
            result.append({
                "id": md.id,
                "fiscal_year": declaration.fiscal_year if declaration else None,
                "shares_balance": float(md.shares_balance),
                "dividend_rate": float(md.dividend_rate),
                "dividend_amount": float(md.dividend_amount),
                "status": md.status,
                "credited_to": md.credited_to,
                "credited_at": md.credited_at
            })
        
        return {
            "member_id": member_id,
            "member_name": f"{member.first_name} {member.last_name}",
            "current_shares": float(member.shares_balance or 0),
            "dividends": result
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()
