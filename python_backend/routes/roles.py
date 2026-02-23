from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db
from models.tenant import Role, RolePermission
from schemas.tenant import RoleCreate, RoleUpdate, RoleResponse
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_role, invalidate_permissions_cache
from middleware.demo_guard import require_not_demo

router = APIRouter()

AVAILABLE_PERMISSIONS = [
    "dashboard:read",
    "teller_station:read", "teller_station:write",
    "float_management:read", "float_management:write",
    "shortage_approval:write",
    "ticketing:access", "ticketing:display",
    "branches:read", "branches:write",
    "staff:read", "staff:write",
    "members:read", "members:write",
    "loan_products:read", "loan_products:write",
    "loans:read", "loans:write", "loans:process", "loans:approve", "loans:reject",
    "repayments:read", "repayments:write",
    "guarantors:read", "guarantors:write",
    "transactions:read", "transactions:write",
    "fixed_deposits:read", "fixed_deposits:write",
    "dividends:read", "dividends:write",
    "chart_of_accounts:read", "chart_of_accounts:write",
    "journal_entries:read", "journal_entries:write",
    "defaults:read", "defaults:write",
    "restructure:read", "restructure:write",
    "sms:read", "sms:write",
    "reports:read",
    "analytics:read",
    "audit:read",
    "hr:read", "hr:write",
    "leave:read", "leave:write", "leave:approve",
    "salary_deductions:read", "salary_deductions:write",
    "settings:read", "settings:write",
    "roles:read", "roles:write",
]

DEFAULT_ROLES = [
    {
        "name": "admin",
        "description": "Full access to all features",
        "is_system": True,
        "permissions": ["*"]
    },
    {
        "name": "manager",
        "description": "Branch/department management with loan approval",
        "is_system": True,
        "permissions": [
            "dashboard:read", "branches:read", "branches:write",
            "members:read", "members:write", "staff:read",
            "loan_products:read", "loans:read", "loans:write", "loans:process", "loans:approve", "loans:reject",
            "repayments:read", "repayments:write", "guarantors:read", "guarantors:write",
            "transactions:read", "transactions:write", "defaults:read", "defaults:write",
            "restructure:read", "restructure:write", "sms:read", "sms:write",
            "reports:read", "analytics:read",
            "float_management:read", "float_management:write", "shortage_approval:write",
            "salary_deductions:read"
        ]
    },
    {
        "name": "loan_officer",
        "description": "Loan processing and member management",
        "is_system": True,
        "permissions": [
            "loans:read", "loans:write", "loans:process",
            "members:read", "members:write",
            "transactions:read", "transactions:write",
            "repayments:read", "loan_products:read", "loan_products:write",
            "restructure:read", "restructure:write"
        ]
    },
    {
        "name": "teller",
        "description": "Day-to-day transactions",
        "is_system": True,
        "permissions": [
            "teller_station:read", "teller_station:write",
            "members:read",
            "repayments:read", "repayments:write",
            "transactions:read", "transactions:write"
        ]
    },
    {
        "name": "kiosk_operator",
        "description": "Queue ticketing kiosk operator",
        "is_system": True,
        "permissions": [
            "ticketing:access", "ticketing:display"
        ]
    },
    {
        "name": "reviewer",
        "description": "Loan review and approval",
        "is_system": True,
        "permissions": [
            "branches:read", "members:read", "staff:read", "loan_products:read",
            "loans:read", "loans:approve", "loans:reject",
            "repayments:read", "guarantors:read",
            "defaults:read", "restructure:read",
            "reports:read", "analytics:read"
        ]
    },
    {
        "name": "accountant",
        "description": "Financial transactions and reports",
        "is_system": True,
        "permissions": [
            "branches:read", "members:read", "staff:read", "loan_products:read",
            "loans:read", "transactions:read", "transactions:write",
            "repayments:read", "repayments:write",
            "defaults:read", "defaults:write",
            "reports:read", "analytics:read"
        ]
    },
    {
        "name": "auditor",
        "description": "Read-only access for auditing",
        "is_system": True,
        "permissions": [
            "branches:read", "members:read", "staff:read", "loan_products:read",
            "loans:read", "transactions:read", "repayments:read",
            "defaults:read", "restructure:read",
            "reports:read", "analytics:read", "audit:read"
        ]
    },
    {
        "name": "hr",
        "description": "Human resources management",
        "is_system": True,
        "permissions": [
            "branches:read", "staff:read", "staff:write",
            "hr:read", "hr:write", "analytics:read",
            "leave:read", "leave:write", "leave:approve",
            "salary_deductions:read", "salary_deductions:write"
        ]
    },
    {
        "name": "supervisor",
        "description": "Team supervisor with leave management",
        "is_system": True,
        "permissions": [
            "dashboard:read", "branches:read", "staff:read",
            "leave:read", "leave:write", "leave:approve"
        ]
    },
    {
        "name": "staff",
        "description": "Basic staff access",
        "is_system": True,
        "permissions": [
            "branches:read", "members:read",
            "staff:read", "loan_products:read", "loans:read",
            "leave:read", "leave:write"
        ]
    }
]

def seed_default_roles(tenant_session):
    for role_data in DEFAULT_ROLES:
        existing_role = tenant_session.query(Role).filter(Role.name == role_data["name"]).first()
        
        if not existing_role:
            role = Role(
                name=role_data["name"],
                description=role_data["description"],
                is_system=role_data["is_system"]
            )
            tenant_session.add(role)
            tenant_session.flush()
            
            for perm in role_data["permissions"]:
                role_perm = RolePermission(role_id=role.id, permission=perm)
                tenant_session.add(role_perm)
    
    tenant_session.commit()

@router.get("/permissions/available")
async def get_available_permissions():
    return AVAILABLE_PERMISSIONS

@router.get("/{org_id}/roles")
async def get_roles(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        seed_default_roles(tenant_session)
        
        roles = tenant_session.query(Role).filter(Role.is_active == True).all()
        result = []
        for role in roles:
            perms = [p.permission for p in role.permissions]
            result.append({
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "is_system": role.is_system,
                "is_active": role.is_active,
                "permissions": perms,
                "created_at": role.created_at
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/roles")
async def create_role(
    org_id: str,
    data: RoleCreate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        existing = tenant_session.query(Role).filter(Role.name == data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Role with this name already exists")
        
        role = Role(
            name=data.name,
            description=data.description,
            is_system=False
        )
        tenant_session.add(role)
        tenant_session.flush()
        
        for perm in data.permissions:
            role_perm = RolePermission(role_id=role.id, permission=perm)
            tenant_session.add(role_perm)
        
        tenant_session.commit()
        tenant_session.refresh(role)
        
        return {
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "is_system": role.is_system,
            "is_active": role.is_active,
            "permissions": data.permissions,
            "created_at": role.created_at
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.patch("/{org_id}/roles/{role_id}")
async def update_role(
    org_id: str,
    role_id: str,
    data: RoleUpdate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        role = tenant_session.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        
        if data.name is not None:
            role.name = data.name
        if data.description is not None:
            role.description = data.description
        if data.is_active is not None:
            role.is_active = data.is_active
        
        if data.permissions is not None:
            tenant_session.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
            for perm in data.permissions:
                role_perm = RolePermission(role_id=role.id, permission=perm)
                tenant_session.add(role_perm)
        
        tenant_session.commit()
        tenant_session.refresh(role)
        
        invalidate_permissions_cache(org_id, role.name)
        
        perms = [p.permission for p in role.permissions]
        return {
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "is_system": role.is_system,
            "is_active": role.is_active,
            "permissions": perms,
            "created_at": role.created_at
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.delete("/{org_id}/roles/{role_id}", dependencies=[Depends(require_not_demo)])
async def delete_role(
    org_id: str,
    role_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        role = tenant_session.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        
        if role.is_system:
            raise HTTPException(status_code=400, detail="Cannot delete system roles")
        
        role_name = role.name
        tenant_session.delete(role)
        tenant_session.commit()
        
        invalidate_permissions_cache(org_id, role_name)
        
        return {"message": "Role deleted successfully"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/roles/{role_id}/reset")
async def reset_role_to_default(
    org_id: str,
    role_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        role = tenant_session.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        
        if not role.is_system:
            raise HTTPException(status_code=400, detail="Can only reset system roles")
        
        default_role = next((r for r in DEFAULT_ROLES if r["name"] == role.name), None)
        if not default_role:
            raise HTTPException(status_code=404, detail="Default role definition not found")
        
        tenant_session.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
        
        for perm in default_role["permissions"]:
            role_perm = RolePermission(role_id=role.id, permission=perm)
            tenant_session.add(role_perm)
        
        role.description = default_role["description"]
        tenant_session.commit()
        
        invalidate_permissions_cache(org_id, role.name)
        
        return {"message": f"Role '{role.name}' reset to default permissions"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/roles/{role_name}/permissions")
async def get_role_permissions(
    org_id: str,
    role_name: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        seed_default_roles(tenant_session)
        
        role = tenant_session.query(Role).filter(Role.name == role_name, Role.is_active == True).first()
        if not role:
            return []
        
        return [p.permission for p in role.permissions]
    finally:
        tenant_session.close()
        tenant_ctx.close()
