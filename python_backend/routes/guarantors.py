from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List
from datetime import datetime
from decimal import Decimal
from models.database import get_db
from models.tenant import LoanApplication, LoanGuarantor, Member
from schemas.tenant import LoanGuarantorCreate, LoanGuarantorResponse, LoanGuarantorReject, MemberGuaranteeEligibility
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission

router = APIRouter()

# Configuration: Guarantee capacity multiplier (typically 3x shares in Kenyan SACCOs)
GUARANTEE_CAPACITY_MULTIPLIER = 3.0
# Maximum number of active guarantees per member
MAX_ACTIVE_GUARANTEES = 5


def calculate_member_exposure(tenant_session, member_id: str) -> Decimal:
    """Calculate total guarantee exposure for a member (only active loans)"""
    exposure = tenant_session.query(func.coalesce(func.sum(LoanGuarantor.amount_guaranteed), 0)).filter(
        LoanGuarantor.guarantor_id == member_id,
        LoanGuarantor.status.in_(["pending", "accepted"]),
        # Only count exposure for active loans
        LoanGuarantor.loan_id.in_(
            tenant_session.query(LoanApplication.id).filter(
                LoanApplication.status.in_(["approved", "disbursed", "active"])
            )
        )
    ).scalar()
    return Decimal(str(exposure or 0))


def get_active_guarantees_count(tenant_session, member_id: str) -> int:
    """Get count of active guarantees for a member"""
    return tenant_session.query(LoanGuarantor).filter(
        LoanGuarantor.guarantor_id == member_id,
        LoanGuarantor.status.in_(["pending", "accepted"]),
        LoanGuarantor.loan_id.in_(
            tenant_session.query(LoanApplication.id).filter(
                LoanApplication.status.in_(["pending", "under_review", "approved", "disbursed", "active"])
            )
        )
    ).count()


def check_member_has_defaults(tenant_session, member_id: str) -> bool:
    """Check if member has any defaulted loans"""
    return tenant_session.query(LoanApplication).filter(
        LoanApplication.member_id == member_id,
        LoanApplication.status == "defaulted"
    ).first() is not None


def check_already_guaranteeing_borrower(tenant_session, guarantor_id: str, borrower_id: str, exclude_loan_id: str = None) -> bool:
    """Check if member is already guaranteeing another active loan for the same borrower
    
    Args:
        exclude_loan_id: Optional loan ID to exclude from the check (used when accepting a guarantee
                        to avoid counting the current loan's pending guarantee as existing)
    """
    if not borrower_id:
        return False
    
    # Get all active loans for the borrower
    borrower_active_loans = tenant_session.query(LoanApplication.id).filter(
        LoanApplication.member_id == borrower_id,
        LoanApplication.status.in_(["pending", "under_review", "approved", "disbursed", "active"])
    ).all()
    borrower_loan_ids = [l.id for l in borrower_active_loans]
    
    # Exclude the specified loan if provided
    if exclude_loan_id and exclude_loan_id in borrower_loan_ids:
        borrower_loan_ids.remove(exclude_loan_id)
    
    if not borrower_loan_ids:
        return False
    
    # Check if guarantor already has active guarantees for any of these loans
    existing_guarantee = tenant_session.query(LoanGuarantor).filter(
        LoanGuarantor.guarantor_id == guarantor_id,
        LoanGuarantor.loan_id.in_(borrower_loan_ids),
        LoanGuarantor.status.in_(["pending", "accepted"])
    ).first()
    
    return existing_guarantee is not None


def get_member_eligibility(tenant_session, member: Member, loan_amount: Decimal = Decimal("0"), borrower_id: str = None, loan_id: str = None) -> dict:
    """Calculate comprehensive eligibility for a member to act as guarantor"""
    reasons = []
    is_eligible = True
    
    # Get financial position
    savings = Decimal(str(member.savings_balance or 0))
    shares = Decimal(str(member.shares_balance or 0))
    deposits = Decimal(str(member.deposits_balance or 0))
    
    # Calculate exposure and capacity (based on SHARES - standard SACCO practice)
    current_exposure = calculate_member_exposure(tenant_session, member.id)
    active_guarantees = get_active_guarantees_count(tenant_session, member.id)
    max_capacity = shares * Decimal(str(GUARANTEE_CAPACITY_MULTIPLIER))
    available_capacity = max_capacity - current_exposure
    
    # Check member status
    if member.status != "active":
        is_eligible = False
        reasons.append(f"Member account is {member.status}, must be active")
    
    # Check for defaults
    has_defaults = check_member_has_defaults(tenant_session, member.id)
    if has_defaults:
        is_eligible = False
        reasons.append("Member has defaulted loans and cannot guarantee")
    
    # Check maximum guarantees limit
    if active_guarantees >= MAX_ACTIVE_GUARANTEES:
        is_eligible = False
        reasons.append(f"Member already has {active_guarantees} active guarantees (max: {MAX_ACTIVE_GUARANTEES})")
    
    # Check shares requirement (must have shares to guarantee - standard SACCO practice)
    if shares <= 0:
        is_eligible = False
        reasons.append("Member has no shares balance")
    
    # Check available capacity
    if available_capacity <= 0:
        is_eligible = False
        reasons.append(f"No available guarantee capacity (exposure: {current_exposure:,.2f}, max: {max_capacity:,.2f})")
    elif loan_amount > 0 and available_capacity < loan_amount:
        is_eligible = False
        reasons.append(f"Insufficient capacity. Available: {available_capacity:,.2f}, Required: {loan_amount:,.2f}")
    
    # Check if trying to guarantee own loan
    if borrower_id and member.id == borrower_id:
        is_eligible = False
        reasons.append("Member cannot guarantee their own loan")
    
    # Check if already guaranteeing another loan for the same borrower
    # Pass loan_id to exclude the current loan from the check (important when accepting a guarantee)
    if borrower_id and check_already_guaranteeing_borrower(tenant_session, member.id, borrower_id, loan_id):
        is_eligible = False
        reasons.append("Member is already guaranteeing another active loan for this borrower")
    
    # Check for active loans (some institutions don't allow borrowers to guarantee)
    has_active_loans = tenant_session.query(LoanApplication).filter(
        LoanApplication.member_id == member.id,
        LoanApplication.status.in_(["disbursed", "active"])
    ).first() is not None
    
    if is_eligible and len(reasons) == 0:
        reasons.append("Eligible to guarantee")
    
    return {
        "member_id": member.id,
        "member_name": f"{member.first_name} {member.last_name}",
        "member_number": member.member_number,
        "id_number": member.id_number,
        "phone": member.phone,
        "email": member.email,
        "is_eligible": is_eligible,
        "eligibility_reasons": reasons,
        "savings_balance": savings,
        "shares_balance": shares,
        "total_deposits": deposits,
        "current_guarantee_exposure": current_exposure,
        "active_guarantees_count": active_guarantees,
        "max_guarantee_capacity": max_capacity,
        "available_guarantee_capacity": available_capacity,
        "member_status": member.status,
        "has_defaulted_loans": has_defaults,
        "has_active_loans": has_active_loans
    }


@router.get("/{org_id}/loans/{loan_id}/guarantors")
async def list_loan_guarantors(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "guarantors:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        guarantors = tenant_session.query(LoanGuarantor).filter(LoanGuarantor.loan_id == loan_id).all()
        
        result = []
        for g in guarantors:
            guarantor_member = tenant_session.query(Member).filter(Member.id == g.guarantor_id).first()
            response = {
                "id": g.id,
                "loan_id": g.loan_id,
                "guarantor_id": g.guarantor_id,
                "amount_guaranteed": g.amount_guaranteed,
                "guarantee_percentage": g.guarantee_percentage,
                "relationship_to_borrower": g.relationship_to_borrower,
                "guarantor_savings_at_guarantee": g.guarantor_savings_at_guarantee,
                "guarantor_shares_at_guarantee": g.guarantor_shares_at_guarantee,
                "guarantor_total_exposure_at_guarantee": g.guarantor_total_exposure_at_guarantee,
                "available_guarantee_capacity": g.available_guarantee_capacity,
                "status": g.status,
                "rejection_reason": g.rejection_reason,
                "accepted_at": g.accepted_at,
                "rejected_at": g.rejected_at,
                "released_at": g.released_at,
                "called_at": g.called_at,
                "amount_recovered": g.amount_recovered,
                "consent_given": g.consent_given,
                "consent_date": g.consent_date,
                "consent_method": g.consent_method,
                "created_at": g.created_at,
                "updated_at": g.updated_at,
                "guarantor": {
                    "id": guarantor_member.id,
                    "member_number": guarantor_member.member_number,
                    "first_name": guarantor_member.first_name,
                    "last_name": guarantor_member.last_name,
                    "phone": guarantor_member.phone,
                    "email": guarantor_member.email,
                    "status": guarantor_member.status,
                    "savings_balance": guarantor_member.savings_balance,
                    "shares_balance": guarantor_member.shares_balance,
                } if guarantor_member else None
            }
            result.append(response)
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/loans/{loan_id}/eligible-guarantors")
async def get_eligible_guarantors(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get list of members eligible to guarantee a specific loan"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "guarantors:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        # Get all active members except the borrower
        members = tenant_session.query(Member).filter(
            Member.id != loan.member_id,
            Member.status == "active"
        ).all()
        
        # Get existing guarantors for this loan
        existing_guarantor_ids = [g.guarantor_id for g in tenant_session.query(LoanGuarantor).filter(
            LoanGuarantor.loan_id == loan_id
        ).all()]
        
        result = []
        for member in members:
            if member.id in existing_guarantor_ids:
                continue  # Skip existing guarantors
            
            eligibility = get_member_eligibility(
                tenant_session, 
                member, 
                Decimal(str(loan.amount)), 
                loan.member_id
            )
            result.append(eligibility)
        
        # Sort by eligibility (eligible first) then by available capacity
        result.sort(key=lambda x: (not x["is_eligible"], -float(x["available_guarantee_capacity"])))
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/members/{member_id}/guarantee-eligibility")
async def get_member_guarantee_eligibility(org_id: str, member_id: str, loan_amount: float = 0, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get detailed guarantee eligibility for a specific member"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "guarantors:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        eligibility = get_member_eligibility(tenant_session, member, Decimal(str(loan_amount)))
        return eligibility
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{org_id}/loans/{loan_id}/guarantors")
async def add_guarantor(org_id: str, loan_id: str, data: LoanGuarantorCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "guarantors:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        if loan.status not in ["pending", "under_review"]:
            raise HTTPException(status_code=400, detail="Cannot add guarantors to this loan - it has already been processed")
        
        guarantor_member = tenant_session.query(Member).filter(Member.id == data.guarantor_id).first()
        if not guarantor_member:
            raise HTTPException(status_code=404, detail="Guarantor member not found")
        
        # Check eligibility
        eligibility = get_member_eligibility(tenant_session, guarantor_member, data.amount_guaranteed, loan.member_id)
        if not eligibility["is_eligible"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Member is not eligible to guarantee: {'; '.join(eligibility['eligibility_reasons'])}"
            )
        
        # Check if amount is within available capacity
        if data.amount_guaranteed > eligibility["available_guarantee_capacity"]:
            raise HTTPException(
                status_code=400,
                detail=f"Amount exceeds available guarantee capacity of {eligibility['available_guarantee_capacity']:,.2f}"
            )
        
        # Check for existing guarantee
        existing = tenant_session.query(LoanGuarantor).filter(
            LoanGuarantor.loan_id == loan_id,
            LoanGuarantor.guarantor_id == data.guarantor_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="This member is already a guarantor for this loan")
        
        # Calculate guarantee percentage
        loan_amount = Decimal(str(loan.amount))
        guarantee_percentage = (data.amount_guaranteed / loan_amount * 100) if loan_amount > 0 else Decimal("0")
        
        guarantor = LoanGuarantor(
            loan_id=loan_id,
            guarantor_id=data.guarantor_id,
            amount_guaranteed=data.amount_guaranteed,
            guarantee_percentage=guarantee_percentage,
            relationship_to_borrower=data.relationship_to_borrower,
            guarantor_savings_at_guarantee=guarantor_member.savings_balance,
            guarantor_shares_at_guarantee=guarantor_member.shares_balance,
            guarantor_total_exposure_at_guarantee=eligibility["current_guarantee_exposure"],
            available_guarantee_capacity=eligibility["available_guarantee_capacity"],
            status="pending"
        )
        
        tenant_session.add(guarantor)
        tenant_session.commit()
        tenant_session.refresh(guarantor)
        
        return {
            "id": guarantor.id,
            "loan_id": guarantor.loan_id,
            "guarantor_id": guarantor.guarantor_id,
            "amount_guaranteed": guarantor.amount_guaranteed,
            "guarantee_percentage": guarantor.guarantee_percentage,
            "relationship_to_borrower": guarantor.relationship_to_borrower,
            "status": guarantor.status,
            "created_at": guarantor.created_at,
            "guarantor": {
                "id": guarantor_member.id,
                "member_number": guarantor_member.member_number,
                "first_name": guarantor_member.first_name,
                "last_name": guarantor_member.last_name,
            }
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.put("/{org_id}/guarantors/{guarantor_id}/accept")
async def accept_guarantee(org_id: str, guarantor_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "guarantors:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        guarantor = tenant_session.query(LoanGuarantor).filter(LoanGuarantor.id == guarantor_id).first()
        if not guarantor:
            raise HTTPException(status_code=404, detail="Guarantor record not found")
        
        if guarantor.status != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot accept - guarantee is already {guarantor.status}")
        
        # Re-check eligibility at time of acceptance
        guarantor_member = tenant_session.query(Member).filter(Member.id == guarantor.guarantor_id).first()
        if guarantor_member:
            loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == guarantor.loan_id).first()
            # Pass loan_id to exclude this loan from the "already guaranteeing borrower" check
            eligibility = get_member_eligibility(tenant_session, guarantor_member, guarantor.amount_guaranteed, loan.member_id if loan else None, loan.id if loan else None)
            if not eligibility["is_eligible"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Member is no longer eligible to guarantee: {'; '.join(eligibility['eligibility_reasons'])}"
                )
        
        guarantor.status = "accepted"
        guarantor.accepted_at = datetime.utcnow()
        guarantor.consent_given = True
        guarantor.consent_date = datetime.utcnow()
        guarantor.consent_method = "in_person"
        
        tenant_session.commit()
        tenant_session.refresh(guarantor)
        
        return {"message": "Guarantee accepted successfully", "guarantor_id": guarantor.id, "status": guarantor.status}
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.put("/{org_id}/guarantors/{guarantor_id}/reject")
async def reject_guarantee(org_id: str, guarantor_id: str, data: LoanGuarantorReject = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "guarantors:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        guarantor = tenant_session.query(LoanGuarantor).filter(LoanGuarantor.id == guarantor_id).first()
        if not guarantor:
            raise HTTPException(status_code=404, detail="Guarantor record not found")
        
        if guarantor.status not in ["pending"]:
            raise HTTPException(status_code=400, detail=f"Cannot reject - guarantee is already {guarantor.status}")
        
        guarantor.status = "rejected"
        guarantor.rejected_at = datetime.utcnow()
        if data and data.rejection_reason:
            guarantor.rejection_reason = data.rejection_reason
        
        tenant_session.commit()
        tenant_session.refresh(guarantor)
        
        return {"message": "Guarantee rejected", "guarantor_id": guarantor.id, "status": guarantor.status}
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.delete("/{org_id}/guarantors/{guarantor_id}")
async def remove_guarantor(org_id: str, guarantor_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "guarantors:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        guarantor = tenant_session.query(LoanGuarantor).filter(LoanGuarantor.id == guarantor_id).first()
        if not guarantor:
            raise HTTPException(status_code=404, detail="Guarantor record not found")
        
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == guarantor.loan_id).first()
        if loan and loan.status not in ["pending", "under_review", "rejected"]:
            raise HTTPException(status_code=400, detail="Cannot remove guarantors from a processed loan")
        
        tenant_session.delete(guarantor)
        tenant_session.commit()
        return {"message": "Guarantor removed successfully"}
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/members/{member_id}/guarantees")
async def get_member_guarantees(org_id: str, member_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all guarantees made by a specific member"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "guarantors:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        guarantees = tenant_session.query(LoanGuarantor).filter(LoanGuarantor.guarantor_id == member_id).all()
        
        result = []
        for g in guarantees:
            loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == g.loan_id).first()
            borrower = tenant_session.query(Member).filter(Member.id == loan.member_id).first() if loan else None
            result.append({
                "guarantee_id": g.id,
                "loan_id": g.loan_id,
                "loan_number": loan.application_number if loan else None,
                "loan_amount": float(loan.amount) if loan else 0,
                "loan_status": loan.status if loan else None,
                "amount_guaranteed": float(g.amount_guaranteed),
                "guarantee_percentage": float(g.guarantee_percentage) if g.guarantee_percentage else None,
                "guarantee_status": g.status,
                "relationship_to_borrower": g.relationship_to_borrower,
                "borrower_name": f"{borrower.first_name} {borrower.last_name}" if borrower else None,
                "borrower_member_number": borrower.member_number if borrower else None,
                "accepted_at": g.accepted_at.isoformat() if g.accepted_at else None,
                "rejected_at": g.rejected_at.isoformat() if g.rejected_at else None,
                "rejection_reason": g.rejection_reason,
                "created_at": g.created_at.isoformat() if g.created_at else None,
            })
        
        # Calculate summary
        total_exposure = sum(
            g["amount_guaranteed"] for g in result 
            if g["guarantee_status"] in ["pending", "accepted"] and g["loan_status"] in ["pending", "under_review", "approved", "disbursed", "active"]
        )
        active_count = len([g for g in result if g["guarantee_status"] in ["pending", "accepted"] and g["loan_status"] in ["pending", "under_review", "approved", "disbursed", "active"]])
        
        return {
            "member_id": member_id,
            "member_name": f"{member.first_name} {member.last_name}",
            "member_number": member.member_number,
            "total_exposure": total_exposure,
            "active_guarantees_count": active_count,
            "max_capacity": float(member.savings_balance or 0) * GUARANTEE_CAPACITY_MULTIPLIER,
            "available_capacity": float(member.savings_balance or 0) * GUARANTEE_CAPACITY_MULTIPLIER - total_exposure,
            "guarantees": result
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()
