from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.database import get_db
from routes.auth import get_current_user
from services.tenant_context import get_tenant_context, get_tenant_context_simple

def generate_code(db: Session, model, column_name: str, prefix: str) -> str:
    """Generate a code like BR01, ST01, MB01, etc."""
    column = getattr(model, column_name)
    max_code = db.query(func.max(column)).scalar()
    
    if max_code and max_code.startswith(prefix):
        try:
            max_num = int(max_code[len(prefix):])
            return f"{prefix}{max_num + 1:02d}"
        except ValueError:
            pass
    
    count = db.query(func.count(getattr(model, 'id'))).scalar() or 0
    return f"{prefix}{count + 1:02d}"


def _luhn_check_digit(number_str: str) -> int:
    """Calculate a Luhn check digit for the given numeric string."""
    digits = [int(d) for d in number_str]
    odd_sum = sum(digits[-1::-2])
    even_digits = digits[-2::-2]
    even_sum = 0
    for d in even_digits:
        doubled = d * 2
        even_sum += doubled - 9 if doubled > 9 else doubled
    total = odd_sum + even_sum
    return (10 - (total % 10)) % 10


def _extract_branch_number(branch_code: str) -> str:
    """Extract numeric part from branch code (e.g. 'BR01' -> '01', 'BR12' -> '12')."""
    nums = ''.join(c for c in branch_code if c.isdigit())
    if nums:
        return nums.zfill(2)[-2:]
    return "01"


def generate_account_number(db: Session, branch_code: str) -> str:
    """
    Generate a bank-style 10-digit account number.
    
    Format: BB-SSSSSSS-C
      BB      = 2-digit branch code (from branch code field)
      SSSSSSS = 7-digit sequential number (per-branch)
      C       = 1-digit Luhn check digit
    
    Example: 0100000015  (branch 01, member 1, check digit 5)
    """
    from models.tenant import Member
    
    branch_num = _extract_branch_number(branch_code)
    
    prefix = branch_num
    existing = db.query(Member.member_number).filter(
        Member.member_number.like(f"{prefix}%")
    ).all()
    
    max_seq = 0
    for (mn,) in existing:
        if mn and len(mn) == 10 and mn[:2] == prefix:
            try:
                seq = int(mn[2:9])
                if seq > max_seq:
                    max_seq = seq
            except ValueError:
                continue
    
    next_seq = max_seq + 1
    base = f"{prefix}{next_seq:07d}"
    check = _luhn_check_digit(base)
    return f"{base}{check}"

class StaffMembership:
    """Synthetic membership object for staff users."""
    def __init__(self, staff, organization_id=None):
        self.role = staff.role if hasattr(staff, 'role') else 'staff'
        self.user_id = staff.id
        self.organization_id = organization_id

def get_tenant_session_context(org_id: str, user, db: Session):
    """Get tenant context and session, raising 403 if not authorized."""
    # Check if this is a staff user (tenant-only authentication)
    if hasattr(user, 'is_staff') and user.is_staff:
        # Staff users are already authenticated via tenant database
        # Verify they belong to this organization
        if hasattr(user, 'organization_id') and str(user.organization_id) != str(org_id):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get tenant context without membership lookup
        tenant_ctx = get_tenant_context_simple(org_id, db)
        if not tenant_ctx:
            raise HTTPException(status_code=403, detail="Organization not found")
        
        # Create a synthetic membership from staff record with org_id for permission lookup
        membership = StaffMembership(user.staff, organization_id=org_id)
        return tenant_ctx, membership
    
    # Master user authentication - lookup organization membership
    tenant_ctx, membership = get_tenant_context(org_id, user.id, db)
    if not tenant_ctx:
        raise HTTPException(status_code=403, detail="Access denied")
    return tenant_ctx, membership

ROLE_PERMISSIONS = {
    "owner": ["*"],
    "admin": ["*"],
    "manager": [
        "branches:read", "branches:write",
        "members:read", "members:write", "members:activate", "members:suspend",
        "staff:read",
        "loan_products:read",
        "loans:read", "loans:write", "loans:process", "loans:approve", "loans:reject",
        "repayments:read", "repayments:write",
        "guarantors:read", "guarantors:write",
        "transactions:read", "transactions:write",
        "defaults:read", "defaults:write",
        "restructure:read", "restructure:write",
        "sms:read", "sms:write",
        "reports:read", "analytics:read",
        "float_management:read", "float_management:write",
        "teller_station:read", "teller_station:write",
        "shortage_approval:write", "salary_deductions:read",
        "dashboard:read"
    ],
    "loan_officer": [
        "branches:read", "members:read", "members:write", "members:activate",
        "staff:read", "loan_products:read",
        "loans:read", "loans:write", "loans:process",
        "repayments:read", "repayments:write",
        "guarantors:read", "guarantors:write",
        "transactions:read", "transactions:write",
        "defaults:read", "restructure:read", "restructure:write",
        "sms:read", "sms:write", "dashboard:read"
    ],
    "teller": [
        "branches:read", "members:read",
        "staff:read", "loan_products:read",
        "loans:read",
        "repayments:read", "repayments:write",
        "transactions:read", "transactions:write",
        "teller_station:read", "teller_station:write",
        "dashboard:read"
    ],
    "reviewer": [
        "branches:read", "members:read", "staff:read", "loan_products:read",
        "loans:read", "loans:approve", "loans:reject",
        "repayments:read", "guarantors:read",
        "defaults:read", "restructure:read",
        "dashboard:read", "reports:read", "analytics:read"
    ],
    "accountant": [
        "branches:read", "members:read", "staff:read", "loan_products:read",
        "loans:read", "transactions:read", "transactions:write",
        "repayments:read", "repayments:write",
        "defaults:read", "defaults:write",
        "reports:read", "analytics:read", "dashboard:read"
    ],
    "auditor": [
        "branches:read", "members:read", "staff:read", "loan_products:read",
        "loans:read", "transactions:read", "repayments:read",
        "defaults:read", "restructure:read",
        "reports:read", "analytics:read", "audit:read", "dashboard:read"
    ],
    "hr": [
        "branches:read", "staff:read", "staff:write",
        "hr:read", "hr:write", "dashboard:read", "analytics:read",
        "salary_deductions:read", "salary_deductions:write"
    ],
    "staff": [
        "branches:read", "members:read",
        "staff:read", "loan_products:read",
        "loans:read",
        "dashboard:read"
    ],
    "member": ["dashboard:read"]
}

_permissions_cache = {}

def get_branch_filter(user) -> str | None:
    """
    Returns the branch_id to filter by if the user is a staff member.
    Returns None for owners/admins who can see all branches.
    """
    # Check if user is staff with branch restriction
    if hasattr(user, 'is_staff') and user.is_staff:
        # Owners and admins can see all branches
        if hasattr(user, 'staff') and user.staff:
            role = user.staff.role if hasattr(user.staff, 'role') else None
            if role in ['owner', 'admin']:
                return None
            # Return staff's branch_id
            return user.branch_id
    return None

def get_role_permissions_from_db(org_id: str, role_name: str, db: Session) -> list:
    """Get permissions for a role from the database."""
    from services.tenant_context import get_tenant_context_simple
    from models.tenant import Role
    
    cache_key = f"{org_id}:{role_name}"
    if cache_key in _permissions_cache:
        return _permissions_cache[cache_key]
    
    if role_name in ["owner", "admin"]:
        return ["*"]
    
    fallback = ROLE_PERMISSIONS.get(role_name, [])
    
    try:
        tenant_ctx = get_tenant_context_simple(org_id, db)
        if not tenant_ctx:
            return fallback
        
        tenant_session = tenant_ctx.create_session()
        try:
            role = tenant_session.query(Role).filter(Role.name == role_name, Role.is_active == True).first()
            if role:
                perms = [p.permission for p in role.permissions]
                _permissions_cache[cache_key] = perms
                return perms
            return fallback
        finally:
            tenant_session.close()
            tenant_ctx.close()
    except Exception:
        return fallback

def check_permission(membership, permission: str, db: Session = None) -> bool:
    """Check if user has a specific permission based on their role."""
    if not membership:
        return False
    
    role = membership.role
    if role in ["owner", "admin"]:
        return True
    
    if db:
        permissions = get_role_permissions_from_db(membership.organization_id, role, db)
    else:
        permissions = ROLE_PERMISSIONS.get(role, [])
    
    if "*" in permissions:
        return True
    
    if permission in permissions:
        return True
    
    resource = permission.split(":")[0] if ":" in permission else permission
    if f"{resource}:*" in permissions:
        return True
    
    return False

def invalidate_permissions_cache(org_id: str = None, role_name: str = None):
    """Invalidate cached permissions for an organization or role."""
    global _permissions_cache
    if org_id is None:
        _permissions_cache = {}
    elif role_name:
        cache_key = f"{org_id}:{role_name}"
        _permissions_cache.pop(cache_key, None)
    else:
        keys_to_remove = [k for k in _permissions_cache if k.startswith(f"{org_id}:")]
        for k in keys_to_remove:
            _permissions_cache.pop(k, None)

def require_permission(membership, permission: str, db: Session = None):
    """Raise 403 if user doesn't have the required permission."""
    if not check_permission(membership, permission, db):
        raise HTTPException(
            status_code=403, 
            detail=f"You don't have permission to perform this action"
        )

def require_any_permission(membership, permissions: list, db: Session = None):
    """Raise 403 if user doesn't have any of the required permissions."""
    for perm in permissions:
        if check_permission(membership, perm, db):
            return
    raise HTTPException(
        status_code=403, 
        detail=f"You don't have permission to perform this action"
    )

def require_role(membership, roles: list):
    """Raise 403 if user doesn't have one of the required roles."""
    if not membership or membership.role not in roles:
        raise HTTPException(
            status_code=403,
            detail=f"This action requires one of these roles: {', '.join(roles)}"
        )
