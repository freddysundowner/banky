from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db
from models.tenant import Branch
from schemas.tenant import BranchCreate, BranchUpdate, BranchResponse
from routes.auth import get_current_user
from routes.common import generate_code, get_tenant_session_context, require_permission, require_role

router = APIRouter()

@router.get("/{org_id}/branches")
async def get_branches(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        branches = tenant_session.query(Branch).all()
        return [BranchResponse.model_validate(b) for b in branches]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/branches")
async def create_branch(
    org_id: str,
    data: BranchCreate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from services.feature_flags import check_plan_limit, PlanLimitExceededError
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        try:
            check_plan_limit(db, org_id, tenant_session, 'branches')
        except PlanLimitExceededError as e:
            raise HTTPException(status_code=403, detail=e.message)
        
        code = generate_code(tenant_session, Branch, 'code', 'BR')
        
        branch_data = data.model_dump()
        branch_data['code'] = code
        
        branch = Branch(**branch_data)
        tenant_session.add(branch)
        tenant_session.commit()
        tenant_session.refresh(branch)
        return BranchResponse.model_validate(branch)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.patch("/{org_id}/branches/{branch_id}")
async def update_branch(
    org_id: str,
    branch_id: str,
    data: BranchUpdate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        branch = tenant_session.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        
        update_data = data.model_dump(exclude_unset=True)
        update_data.pop('code', None)
        
        for key, value in update_data.items():
            setattr(branch, key, value)
        
        tenant_session.commit()
        tenant_session.refresh(branch)
        return BranchResponse.model_validate(branch)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.delete("/{org_id}/branches/{branch_id}")
async def delete_branch(
    org_id: str,
    branch_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        branch = tenant_session.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        
        tenant_session.delete(branch)
        tenant_session.commit()
        return {"message": "Branch deleted successfully"}
    finally:
        tenant_session.close()
        tenant_ctx.close()
