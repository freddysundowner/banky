from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from decimal import Decimal
from models.database import get_db
from models.tenant import Member, Transaction, OrganizationSettings, LoanApplication, LoanGuarantor, AuditLog, Staff
from schemas.tenant import MemberCreate, MemberUpdate, MemberResponse
from routes.auth import get_current_user
from routes.common import generate_code, generate_account_number, get_tenant_session_context, require_permission, require_role

def try_send_sms(tenant_session, template_type: str, phone: str, name: str, context: dict, member_id=None, loan_id=None):
    """Try to send SMS, fail silently if SMS not configured"""
    try:
        from routes.sms import send_sms_with_template
        if phone:
            send_sms_with_template(tenant_session, template_type, phone, name, context, member_id=member_id, loan_id=loan_id)
    except Exception as e:
        print(f"[SMS] Failed to send {template_type}: {e}")

def create_audit_log(tenant_session, staff_id, action, entity_type, entity_id, old_values=None, new_values=None):
    audit_log = AuditLog(
        staff_id=staff_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values
    )
    tenant_session.add(audit_log)

def get_staff_id(tenant_session, user_email):
    staff = tenant_session.query(Staff).filter(Staff.email == user_email).first()
    return staff.id if staff else None

router = APIRouter()

def get_org_setting(tenant_session, key: str, default=None):
    """Get organization setting value"""
    setting = tenant_session.query(OrganizationSettings).filter(
        OrganizationSettings.setting_key == key
    ).first()
    if setting:
        if setting.setting_type == "boolean":
            return setting.setting_value.lower() == "true"
        elif setting.setting_type == "number":
            return Decimal(setting.setting_value) if setting.setting_value else default
        return setting.setting_value
    return default

@router.get("/{org_id}/members")
async def get_members(
    org_id: str,
    branch_id: str = None,
    search: str = Query(None, description="Search by name, member number, phone, ID, or email"),
    page: int = Query(None, ge=1, description="Page number (enables paginated response)"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from routes.common import get_branch_filter
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(Member)
        
        staff_branch_id = get_branch_filter(user)
        
        if staff_branch_id:
            query = query.filter(Member.branch_id == staff_branch_id)
        elif branch_id:
            query = query.filter(Member.branch_id == branch_id)
        
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    func.lower(Member.first_name).like(func.lower(term)),
                    func.lower(Member.last_name).like(func.lower(term)),
                    func.lower(Member.member_number).like(func.lower(term)),
                    func.lower(Member.phone).like(func.lower(term)),
                    func.lower(Member.id_number).like(func.lower(term)),
                    func.lower(Member.email).like(func.lower(term)),
                    func.lower(
                        Member.first_name + " " + Member.last_name
                    ).like(func.lower(term)),
                )
            )
        
        if page is not None:
            total = query.count()
            members = query.order_by(Member.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
            return {
                "items": [MemberResponse.model_validate(m) for m in members],
                "total": total,
                "page": page,
                "per_page": per_page,
                "total_pages": (total + per_page - 1) // per_page,
            }
        else:
            members = query.all()
            return [MemberResponse.model_validate(m) for m in members]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/members")
async def create_member(
    org_id: str,
    data: MemberCreate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from routes.common import get_branch_filter
    from services.feature_flags import check_plan_limit, PlanLimitExceededError
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        try:
            check_plan_limit(db, org_id, tenant_session, 'members')
        except PlanLimitExceededError as e:
            raise HTTPException(status_code=403, detail=e.message)
        
        member_data = data.model_dump()
        member_data['status'] = 'pending'
        
        # Server-side branch enforcement: override branch_id for restricted users
        staff_branch_id = get_branch_filter(user)
        if staff_branch_id:
            member_data['branch_id'] = staff_branch_id
        elif not member_data.get('branch_id'):
            raise HTTPException(status_code=400, detail="Branch is required")
        
        from models.tenant import Branch as TenantBranch
        branch = tenant_session.query(TenantBranch).filter(TenantBranch.id == member_data['branch_id']).first()
        branch_code = branch.code if branch else "BR01"
        member_number = generate_account_number(tenant_session, branch_code)
        member_data['member_number'] = member_number
        
        member = Member(**member_data)
        tenant_session.add(member)
        
        staff_id = get_staff_id(tenant_session, user.email)
        create_audit_log(
            tenant_session,
            staff_id=staff_id,
            action="member_created",
            entity_type="member",
            entity_id=member_number,
            new_values={"member_number": member_number, "first_name": data.first_name, "last_name": data.last_name}
        )
        
        tenant_session.commit()
        tenant_session.refresh(member)
        
        # Send welcome SMS to new member
        if member.phone:
            try_send_sms(
                tenant_session,
                "welcome",
                member.phone,
                f"{member.first_name} {member.last_name}",
                {
                    "name": member.first_name,
                    "member_number": member.member_number
                },
                member_id=member.id
            )
        
        return MemberResponse.model_validate(member)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.patch("/{org_id}/members/{member_id}")
async def update_member(
    org_id: str,
    member_id: str,
    data: MemberUpdate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        update_data = data.model_dump(exclude_unset=True)
        update_data.pop('member_number', None)
        
        old_values = {k: getattr(member, k) for k in update_data.keys() if hasattr(member, k)}
        
        for key, value in update_data.items():
            setattr(member, key, value)
        
        staff_id = get_staff_id(tenant_session, user.email)
        create_audit_log(
            tenant_session,
            staff_id=staff_id,
            action="member_updated",
            entity_type="member",
            entity_id=str(member.id),
            old_values={k: str(v) if v else None for k, v in old_values.items()},
            new_values={k: str(v) if v else None for k, v in update_data.items()}
        )
        
        tenant_session.commit()
        tenant_session.refresh(member)
        return MemberResponse.model_validate(member)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/members/{member_id}")
async def get_member(
    org_id: str,
    member_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        return MemberResponse.model_validate(member)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/members/{member_id}/activate")
async def activate_member(
    org_id: str,
    member_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually activate a pending member account"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:activate", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        if member.status == "active":
            raise HTTPException(status_code=400, detail="Member is already active")
        
        require_opening_deposit = get_org_setting(tenant_session, "require_opening_deposit", False)
        min_opening_deposit = get_org_setting(tenant_session, "minimum_opening_deposit", Decimal("0"))
        
        if require_opening_deposit and min_opening_deposit > 0:
            total_deposits = (member.savings_balance or Decimal("0")) + \
                           (member.shares_balance or Decimal("0")) + \
                           (member.deposits_balance or Decimal("0"))
            if total_deposits < min_opening_deposit:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Member must have minimum deposit of {min_opening_deposit} to activate. Current balance: {total_deposits}"
                )
        
        old_status = member.status
        member.status = "active"
        
        staff_id = get_staff_id(tenant_session, user.email)
        create_audit_log(
            tenant_session,
            staff_id=staff_id,
            action="member_activated",
            entity_type="member",
            entity_id=str(member.id),
            old_values={"status": old_status},
            new_values={"status": "active"}
        )
        
        tenant_session.commit()
        tenant_session.refresh(member)
        return MemberResponse.model_validate(member)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/members/{member_id}/suspend")
async def suspend_member(
    org_id: str,
    member_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Suspend an active member account"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:suspend", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        old_status = member.status
        member.status = "suspended"
        
        staff_id = get_staff_id(tenant_session, user.email)
        create_audit_log(
            tenant_session,
            staff_id=staff_id,
            action="member_suspended",
            entity_type="member",
            entity_id=str(member.id),
            old_values={"status": old_status},
            new_values={"status": "suspended"}
        )
        
        tenant_session.commit()
        tenant_session.refresh(member)
        return MemberResponse.model_validate(member)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.delete("/{org_id}/members/{member_id}")
async def delete_member(
    org_id: str,
    member_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # Check for active loans
        active_loans = tenant_session.query(LoanApplication).filter(
            LoanApplication.member_id == member_id,
            LoanApplication.status.in_(["pending", "approved", "disbursed"])
        ).count()
        if active_loans > 0:
            raise HTTPException(status_code=400, detail="Cannot delete member with active loans")
        
        # Check for transactions
        transactions = tenant_session.query(Transaction).filter(
            Transaction.member_id == member_id
        ).count()
        if transactions > 0:
            raise HTTPException(status_code=400, detail="Cannot delete member with transaction history. Consider suspending instead.")
        
        # Check for guarantor obligations
        guarantor_obligations = tenant_session.query(LoanGuarantor).filter(
            LoanGuarantor.guarantor_id == member_id,
            LoanGuarantor.status == "accepted"
        ).count()
        if guarantor_obligations > 0:
            raise HTTPException(status_code=400, detail="Cannot delete member with active guarantor obligations")
        
        # Delete any pending loan applications (rejected/cancelled)
        tenant_session.query(LoanApplication).filter(
            LoanApplication.member_id == member_id
        ).delete()
        
        # Delete any guarantor records where this member was a guarantor
        tenant_session.query(LoanGuarantor).filter(
            LoanGuarantor.guarantor_id == member_id
        ).delete()
        
        tenant_session.delete(member)
        tenant_session.commit()
        return {"message": "Member deleted successfully"}
    finally:
        tenant_session.close()
        tenant_ctx.close()
