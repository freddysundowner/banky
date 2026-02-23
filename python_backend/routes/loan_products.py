from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db
from models.tenant import LoanProduct, LoanApplication
from schemas.tenant import LoanProductCreate, LoanProductUpdate, LoanProductResponse
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission, require_role
from middleware.demo_guard import require_not_demo
from sqlalchemy import func

router = APIRouter()

@router.get("/{org_id}/loan-products")
async def get_loan_products(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loan_products:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        products = tenant_session.query(LoanProduct).all()
        return [LoanProductResponse.model_validate(p) for p in products]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/loan-products")
async def create_loan_product(
    org_id: str,
    data: LoanProductCreate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loan_products:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        count = tenant_session.query(func.count(LoanProduct.id)).scalar() or 0
        code = f"LP{count + 1:04d}"
        
        product_data = data.model_dump()
        product_data['code'] = code
        
        product = LoanProduct(**product_data)
        tenant_session.add(product)
        tenant_session.commit()
        tenant_session.refresh(product)
        return LoanProductResponse.model_validate(product)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.patch("/{org_id}/loan-products/{product_id}")
async def update_loan_product(
    org_id: str,
    product_id: str,
    data: LoanProductUpdate,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loan_products:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Loan product not found")
        
        update_data = data.model_dump(exclude_unset=True)
        update_data.pop('code', None)
        
        for key, value in update_data.items():
            setattr(product, key, value)
        
        tenant_session.commit()
        tenant_session.refresh(product)
        return LoanProductResponse.model_validate(product)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.delete("/{org_id}/loan-products/{product_id}", dependencies=[Depends(require_not_demo)])
async def delete_loan_product(
    org_id: str,
    product_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loan_products:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Loan product not found")
        
        # Check if any loans are using this product
        loan_count = tenant_session.query(func.count(LoanApplication.id)).filter(
            LoanApplication.loan_product_id == product_id
        ).scalar()
        
        if loan_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete this product. It has {loan_count} loan application(s) associated with it. Deactivate the product instead."
            )
        
        tenant_session.delete(product)
        tenant_session.commit()
        return {"message": "Loan product deleted successfully"}
    finally:
        tenant_session.close()
        tenant_ctx.close()
