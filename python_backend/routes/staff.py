from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional
from models.database import get_db
from models.tenant import Staff, Branch, Member
from schemas.tenant import StaffCreate, StaffUpdate, StaffResponse
from routes.auth import get_current_user
from routes.common import generate_code, generate_account_number, get_tenant_session_context, require_permission, require_role, invalidate_permissions_cache
from middleware.demo_guard import require_not_demo

router = APIRouter()


def ensure_staff_has_member_account(tenant_session: Session, staff: Staff) -> Member:
    existing = tenant_session.query(Member).filter(Member.email == staff.email).first()
    if existing:
        return existing
    
    branch = tenant_session.query(Branch).filter(Branch.id == staff.branch_id).first()
    branch_code = branch.code if branch else "BR01"
    member_number = generate_account_number(tenant_session, branch_code)
    
    member = Member(
        member_number=member_number,
        first_name=staff.first_name,
        last_name=staff.last_name,
        email=staff.email,
        phone=staff.phone,
        branch_id=staff.branch_id,
        status="active",
        membership_type="staff"
    )
    tenant_session.add(member)
    tenant_session.flush()
    return member

@router.get("/{org_id}/staff")
async def get_staff(
    org_id: str,
    branch_id: str = None,
    search: str = None,
    page: int = None,
    per_page: int = 15,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from routes.common import get_branch_filter
    from sqlalchemy import func, or_
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "staff:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(Staff).options(joinedload(Staff.branch))
        query = query.filter(~Staff.role.in_(["owner", "admin"]))
        
        staff_branch_id = get_branch_filter(user)
        
        if staff_branch_id:
            query = query.filter(Staff.branch_id == staff_branch_id)
        elif branch_id:
            query = query.filter(Staff.branch_id == branch_id)
        
        if search:
            search_lower = f"%{search.lower()}%"
            query = query.filter(
                or_(
                    func.lower(Staff.first_name + ' ' + Staff.last_name).like(search_lower),
                    func.lower(Staff.first_name).like(search_lower),
                    func.lower(Staff.last_name).like(search_lower),
                    func.lower(Staff.email).like(search_lower),
                    func.lower(func.coalesce(Staff.staff_number, '')).like(search_lower),
                    func.lower(func.coalesce(Staff.phone, '')).like(search_lower),
                )
            )
        
        total = query.count()
        
        if page is not None:
            offset = (page - 1) * per_page
            staff_list = query.order_by(Staff.first_name).offset(offset).limit(per_page).all()
        else:
            staff_list = query.all()
        
        from models.tenant import StaffProfile
        staff_ids = [s.id for s in staff_list]
        profiles = tenant_session.query(StaffProfile).filter(StaffProfile.staff_id.in_(staff_ids)).all()
        profile_map = {p.staff_id: p for p in profiles}
        
        member_ids = [s.linked_member_id for s in staff_list if s.linked_member_id]
        linked_members = {}
        if member_ids:
            members = tenant_session.query(Member).filter(Member.id.in_(member_ids)).all()
            linked_members = {m.id: m for m in members}

        result = []
        for s in staff_list:
            staff_dict = StaffResponse.model_validate(s).model_dump()
            staff_dict['branch_name'] = s.branch.name if s.branch else None
            
            lm = linked_members.get(s.linked_member_id) if s.linked_member_id else None
            staff_dict['linked_member_number'] = lm.member_number if lm else None
            staff_dict['linked_member_name'] = f"{lm.first_name} {lm.last_name}" if lm else None

            profile = profile_map.get(s.id)
            if profile:
                staff_dict['profile'] = {
                    'national_id': profile.national_id,
                    'date_of_birth': str(profile.date_of_birth) if profile.date_of_birth else None,
                    'gender': profile.gender,
                    'next_of_kin_name': profile.next_of_kin_name,
                    'next_of_kin_phone': profile.next_of_kin_phone,
                    'next_of_kin_relationship': profile.next_of_kin_relationship
                }
            else:
                staff_dict['profile'] = None
            
            result.append(staff_dict)
        
        if page is not None:
            import math
            return {
                "items": result,
                "total": total,
                "page": page,
                "per_page": per_page,
                "total_pages": math.ceil(total / per_page) if per_page > 0 else 0
            }
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/staff/tellers")
async def get_tellers(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff_list = tenant_session.query(Staff).filter(
            Staff.role == "teller",
            Staff.is_active == True
        ).order_by(Staff.first_name).all()
        return [
            {
                "id": s.id,
                "first_name": s.first_name,
                "last_name": s.last_name,
                "email": s.email,
                "role": s.role,
                "branch_id": s.branch_id,
                "phone": s.phone,
                "staff_number": s.staff_number,
            }
            for s in staff_list
        ]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/staff/me")
async def get_my_staff_info(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's staff record, or admin profile if no staff record exists"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        if staff:
            staff_dict = StaffResponse.model_validate(staff).model_dump()
            staff_dict['branch_name'] = staff.branch.name if staff.branch else None
            return staff_dict
        else:
            # For master users (admin/owner), get profile from user.user object
            master_user = user.user if hasattr(user, 'user') and user.user else None
            return {
                "id": str(user.id),
                "staff_number": "ADMIN",
                "first_name": getattr(master_user, 'first_name', '') or "" if master_user else "",
                "last_name": getattr(master_user, 'last_name', '') or "" if master_user else "",
                "email": user.email,
                "phone": getattr(master_user, 'phone', '') or "" if master_user else "",
                "role": membership.role,
                "branch_name": None,
                "is_admin_profile": True
            }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.patch("/{org_id}/staff/me")
async def update_my_profile(
    org_id: str,
    data: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the current user's profile (staff or admin)"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        allowed_fields = ['first_name', 'last_name', 'phone']
        
        if staff:
            for field in allowed_fields:
                if field in data and data[field] is not None:
                    setattr(staff, field, data[field])
            tenant_session.commit()
            tenant_session.refresh(staff)
            staff_dict = StaffResponse.model_validate(staff).model_dump()
            staff_dict['branch_name'] = staff.branch.name if staff.branch else None
            return staff_dict
        else:
            # For master users, update the underlying user object
            master_user = user.user if hasattr(user, 'user') and user.user else None
            if master_user:
                for field in allowed_fields:
                    if field in data and data[field] is not None:
                        setattr(master_user, field, data[field])
                db.commit()
                db.refresh(master_user)
            return {
                "id": str(user.id),
                "staff_number": "ADMIN",
                "first_name": getattr(master_user, 'first_name', '') or "" if master_user else "",
                "last_name": getattr(master_user, 'last_name', '') or "" if master_user else "",
                "email": user.email,
                "phone": getattr(master_user, 'phone', '') or "" if master_user else "",
                "role": membership.role,
                "branch_name": None,
                "is_admin_profile": True
            }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/staff/me/password", dependencies=[Depends(require_not_demo)])
async def change_my_password(
    org_id: str,
    data: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change the current user's password (staff or admin)"""
    from services.auth import hash_password, verify_password
    
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current password and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        if staff:
            if not verify_password(current_password, staff.password_hash):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
            staff.password_hash = hash_password(new_password)
            tenant_session.commit()
        else:
            # For master users, update the underlying user object
            master_user = user.user if hasattr(user, 'user') and user.user else None
            if not master_user:
                raise HTTPException(status_code=400, detail="User profile not found")
            if not verify_password(current_password, master_user.password_hash):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
            master_user.password_hash = hash_password(new_password)
            db.commit()
        
        return {"message": "Password changed successfully"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

def sanitize_org_name_for_domain(name: str) -> str:
    """Convert organization name to domain-safe string"""
    import re
    # Remove special chars, replace spaces with nothing, lowercase
    sanitized = re.sub(r'[^a-zA-Z0-9]', '', name.lower())
    return sanitized or 'org'

@router.post("/{org_id}/staff")
async def create_staff(
    org_id: str,
    data: StaffCreate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.master import User, OrganizationMember, Organization
    from services.auth import get_user_by_email, hash_password
    from services.feature_flags import check_plan_limit, PlanLimitExceededError
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "staff:write", db)
    
    # Get organization for email domain
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Generate email from username + org's staff email domain
    # Use configured domain if set, otherwise fallback to sanitized org name
    if org.staff_email_domain:
        domain = org.staff_email_domain.lstrip('@')
    else:
        domain = f"{sanitize_org_name_for_domain(org.name)}.bankykit.local"
    email = f"{data.username.lower().strip()}@{domain}"
    
    tenant_session = tenant_ctx.create_session()
    try:
        try:
            check_plan_limit(db, org_id, tenant_session, 'staff')
        except PlanLimitExceededError as e:
            raise HTTPException(status_code=403, detail=e.message)
        
        # Check if username already exists in this org
        existing = tenant_session.query(Staff).filter(Staff.email == email).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Username '{data.username}' already exists in this organization")
        
        code = generate_code(tenant_session, Staff, "staff_number", "ST")
        
        staff_data = data.model_dump()
        staff_data['staff_number'] = code
        staff_data.pop('username', None)  # Remove username, we'll use email
        staff_data['email'] = email  # Set generated email
        
        # Server-side branch enforcement: override branch_id for restricted users
        from routes.common import get_branch_filter
        staff_branch_id = get_branch_filter(user)
        if staff_branch_id:
            staff_data['branch_id'] = staff_branch_id
        elif not staff_data.get('branch_id'):
            raise HTTPException(status_code=400, detail="Branch is required")
        
        password = staff_data.pop('password', None)
        if password:
            staff_data['password_hash'] = hash_password(password)  # Use proper bcrypt
        
        # Extract profile fields
        profile_fields = ['national_id', 'date_of_birth', 'gender', 'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_relationship']
        profile_data = {}
        for field in profile_fields:
            if field in staff_data:
                profile_data[field] = staff_data.pop(field)
        
        staff = Staff(**staff_data)
        tenant_session.add(staff)
        tenant_session.flush()
        
        from models.tenant import StaffProfile
        from datetime import datetime
        profile = StaffProfile(
            staff_id=staff.id,
            national_id=profile_data.get('national_id'),
            date_of_birth=datetime.strptime(profile_data['date_of_birth'], '%Y-%m-%d').date() if profile_data.get('date_of_birth') else None,
            gender=profile_data.get('gender'),
            next_of_kin_name=profile_data.get('next_of_kin_name'),
            next_of_kin_phone=profile_data.get('next_of_kin_phone'),
            next_of_kin_relationship=profile_data.get('next_of_kin_relationship')
        )
        tenant_session.add(profile)
        
        ensure_staff_has_member_account(tenant_session, staff)
        
        tenant_session.commit()
        tenant_session.refresh(staff)
        
        return StaffResponse.model_validate(staff)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.patch("/{org_id}/staff/{staff_id}")
async def update_staff(
    org_id: str,
    staff_id: str,
    data: StaffUpdate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.master import User, OrganizationMember
    from services.auth import get_user_by_email
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "staff:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        update_data = data.model_dump(exclude_unset=True)
        update_data.pop('staff_number', None)
        
        # Extract profile fields
        profile_fields = ['national_id', 'date_of_birth', 'gender', 'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_relationship']
        profile_data = {}
        for field in profile_fields:
            if field in update_data:
                profile_data[field] = update_data.pop(field)
        
        new_role = update_data.get('role')
        
        for key, value in update_data.items():
            setattr(staff, key, value)
        
        # Update or create profile
        if profile_data:
            from models.tenant import StaffProfile
            from datetime import datetime
            profile = tenant_session.query(StaffProfile).filter(StaffProfile.staff_id == staff_id).first()
            if not profile:
                profile = StaffProfile(staff_id=staff_id)
                tenant_session.add(profile)
            
            for key, value in profile_data.items():
                if key == 'date_of_birth' and value:
                    value = datetime.strptime(value, '%Y-%m-%d').date()
                setattr(profile, key, value)
        
        tenant_session.commit()
        tenant_session.refresh(staff)
        
        if new_role:
            existing_user = get_user_by_email(db, staff.email)
            if existing_user:
                org_member = db.query(OrganizationMember).filter(
                    OrganizationMember.user_id == existing_user.id,
                    OrganizationMember.organization_id == org_id
                ).first()
                if org_member:
                    org_member.role = new_role
                    db.commit()
                else:
                    new_member = OrganizationMember(
                        user_id=existing_user.id,
                        organization_id=org_id,
                        role=new_role
                    )
                    db.add(new_member)
                    db.commit()
            else:
                pass
        
        return StaffResponse.model_validate(staff)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.delete("/{org_id}/staff/{staff_id}", dependencies=[Depends(require_not_demo)])
async def delete_staff(
    org_id: str,
    staff_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.tenant import TellerFloat
    from sqlalchemy.exc import IntegrityError
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        # Check for related records that would prevent deletion
        has_floats = tenant_session.query(TellerFloat).filter(TellerFloat.staff_id == staff_id).first()
        if has_floats:
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete staff with transaction history. Please deactivate instead."
            )
        
        try:
            tenant_session.delete(staff)
            tenant_session.commit()
            return {"message": "Staff deleted successfully"}
        except IntegrityError:
            tenant_session.rollback()
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete staff with related records. Please deactivate instead."
            )
    finally:
        tenant_session.close()
        tenant_ctx.close()


class CreateMemberAccountData(BaseModel):
    id_type: Optional[str] = "national_id"
    id_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    next_of_kin_relationship: Optional[str] = None


@router.post("/{org_id}/staff/{staff_id}/create-member-account")
async def create_member_account_for_staff(
    org_id: str,
    staff_id: str,
    data: CreateMemberAccountData,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")

        if staff.linked_member_id:
            existing_member = tenant_session.query(Member).filter(Member.id == staff.linked_member_id).first()
            if existing_member:
                raise HTTPException(
                    status_code=400,
                    detail=f"Staff already has a linked member account ({existing_member.member_number})"
                )

        existing_by_email = tenant_session.query(Member).filter(Member.email == staff.email).first()
        if existing_by_email:
            staff.linked_member_id = existing_by_email.id
            tenant_session.commit()
            return {
                "message": f"Staff linked to existing member account {existing_by_email.member_number}",
                "member": {
                    "id": existing_by_email.id,
                    "member_number": existing_by_email.member_number,
                    "first_name": existing_by_email.first_name,
                    "last_name": existing_by_email.last_name,
                }
            }

        branch = tenant_session.query(Branch).filter(Branch.id == staff.branch_id).first()
        branch_code = branch.code if branch else "BR01"
        member_number = generate_account_number(tenant_session, branch_code)

        from datetime import date as date_type
        from sqlalchemy.exc import IntegrityError
        dob = None
        if data.date_of_birth:
            try:
                dob = date_type.fromisoformat(data.date_of_birth)
            except ValueError:
                pass

        try:
            member = Member(
                member_number=member_number,
                first_name=staff.first_name,
                last_name=staff.last_name,
                email=staff.email,
                phone=staff.phone,
                branch_id=staff.branch_id,
                id_type=data.id_type,
                id_number=data.id_number,
                date_of_birth=dob,
                gender=data.gender,
                marital_status=data.marital_status,
                address=data.address,
                city=data.city,
                county=data.county,
                next_of_kin_name=data.next_of_kin_name,
                next_of_kin_phone=data.next_of_kin_phone,
                next_of_kin_relationship=data.next_of_kin_relationship,
                employment_status="employed",
                status="active",
                is_active=True,
                membership_type="staff"
            )
            tenant_session.add(member)
            tenant_session.flush()

            staff.linked_member_id = member.id
            tenant_session.commit()
            tenant_session.refresh(member)

            return {
                "message": f"Member account {member_number} created and linked to staff",
                "member": {
                    "id": member.id,
                    "member_number": member.member_number,
                    "first_name": member.first_name,
                    "last_name": member.last_name,
                }
            }
        except IntegrityError:
            tenant_session.rollback()
            raise HTTPException(
                status_code=400,
                detail="Could not create member account. A member with this email or ID may already exist."
            )
    finally:
        tenant_session.close()
        tenant_ctx.close()
