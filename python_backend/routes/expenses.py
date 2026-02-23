from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel

from models.database import get_db
from routes.auth import get_current_user
from middleware.demo_guard import require_not_demo
from routes.common import get_tenant_session_context, require_permission
from models.tenant import ExpenseCategory, Expense, Staff, Branch

router = APIRouter()

class ExpenseCategoryCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    account_id: Optional[str] = None
    is_active: bool = True

class ExpenseCategoryResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    account_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ExpenseCreate(BaseModel):
    category_id: str
    branch_id: Optional[str] = None
    amount: Decimal
    expense_date: date
    description: str
    vendor: Optional[str] = None
    receipt_number: Optional[str] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    is_recurring: bool = False
    recurrence_interval: Optional[str] = None  # daily, weekly, monthly, quarterly, yearly
    next_due_date: Optional[date] = None

class ExpenseUpdate(BaseModel):
    category_id: Optional[str] = None
    branch_id: Optional[str] = None
    amount: Optional[Decimal] = None
    expense_date: Optional[date] = None
    description: Optional[str] = None
    vendor: Optional[str] = None
    receipt_number: Optional[str] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_interval: Optional[str] = None
    next_due_date: Optional[date] = None

class ExpenseResponse(BaseModel):
    id: str
    expense_number: str
    category_id: str
    branch_id: Optional[str] = None
    amount: Decimal
    expense_date: date
    description: str
    vendor: Optional[str] = None
    receipt_number: Optional[str] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    status: str
    created_by_id: str
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    is_recurring: bool = False
    recurrence_interval: Optional[str] = None
    next_due_date: Optional[date] = None
    created_at: datetime
    category_name: Optional[str] = None
    branch_name: Optional[str] = None
    created_by_name: Optional[str] = None
    approved_by_name: Optional[str] = None
    
    class Config:
        from_attributes = True

def generate_expense_number(session) -> str:
    count = session.query(Expense).count()
    return f"EXP-{count + 1:05d}"

@router.get("/organizations/{org_id}/expenses/categories")
async def get_expense_categories(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "expenses:read", db)
    session = tenant_ctx.create_session()
    try:
        categories = session.query(ExpenseCategory).order_by(ExpenseCategory.name).all()
        return [ExpenseCategoryResponse.model_validate(c) for c in categories]
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/expenses/categories")
async def create_expense_category(org_id: str, data: ExpenseCategoryCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "expenses:write", db)
    session = tenant_ctx.create_session()
    try:
        import re
        code = data.code if data.code else re.sub(r'[^A-Z0-9]', '_', data.name.upper().strip())[:50]
        base_code = code
        counter = 1
        while session.query(ExpenseCategory).filter(ExpenseCategory.code == code).first():
            code = f"{base_code}_{counter}"
            counter += 1
        
        cat_data = data.model_dump()
        cat_data["code"] = code
        category = ExpenseCategory(**cat_data)
        session.add(category)
        session.commit()
        session.refresh(category)
        return ExpenseCategoryResponse.model_validate(category)
    finally:
        session.close()
        tenant_ctx.close()

@router.put("/organizations/{org_id}/expenses/categories/{category_id}")
async def update_expense_category(org_id: str, category_id: str, data: ExpenseCategoryCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "expenses:write", db)
    session = tenant_ctx.create_session()
    try:
        category = session.query(ExpenseCategory).filter(ExpenseCategory.id == category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        update_data = data.model_dump(exclude={"code"})
        for key, value in update_data.items():
            setattr(category, key, value)
        
        session.commit()
        session.refresh(category)
        return ExpenseCategoryResponse.model_validate(category)
    finally:
        session.close()
        tenant_ctx.close()

@router.delete("/organizations/{org_id}/expenses/categories/{category_id}", dependencies=[Depends(require_not_demo)])
async def delete_expense_category(org_id: str, category_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "expenses:write", db)
    session = tenant_ctx.create_session()
    try:
        category = session.query(ExpenseCategory).filter(ExpenseCategory.id == category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        expense_count = session.query(Expense).filter(Expense.category_id == category_id).count()
        if expense_count > 0:
            raise HTTPException(status_code=400, detail="Cannot delete category with existing expenses")
        
        session.delete(category)
        session.commit()
        return {"message": "Category deleted"}
    finally:
        session.close()
        tenant_ctx.close()

@router.get("/organizations/{org_id}/expenses")
async def get_expenses(
    org_id: str, 
    branch_id: Optional[str] = None,
    category_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    user=Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "expenses:read", db)
    session = tenant_ctx.create_session()
    try:
        query = session.query(Expense)
        
        if branch_id:
            query = query.filter(Expense.branch_id == branch_id)
        if category_id:
            query = query.filter(Expense.category_id == category_id)
        if start_date:
            try:
                parsed_start = date.fromisoformat(start_date)
                query = query.filter(Expense.expense_date >= parsed_start)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")
        if end_date:
            try:
                parsed_end = date.fromisoformat(end_date)
                query = query.filter(Expense.expense_date <= parsed_end)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")
        
        total_amount = float(query.with_entities(func.coalesce(func.sum(Expense.amount), 0)).scalar() or 0)
        pending_count = query.filter(Expense.status == "pending").count()
        approved_total = float(
            query.filter(Expense.status == "approved").with_entities(func.coalesce(func.sum(Expense.amount), 0)).scalar() or 0
        )
        
        if status:
            query = query.filter(Expense.status == status)
        
        total = query.count()
        
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size
        expenses = query.order_by(Expense.expense_date.desc()).offset(offset).limit(page_size).all()
        
        result = []
        for exp in expenses:
            category = session.query(ExpenseCategory).filter(ExpenseCategory.id == exp.category_id).first()
            branch = session.query(Branch).filter(Branch.id == exp.branch_id).first() if exp.branch_id else None
            created_by = session.query(Staff).filter(Staff.id == exp.created_by_id).first()
            approved_by = session.query(Staff).filter(Staff.id == exp.approved_by_id).first() if exp.approved_by_id else None
            
            result.append({
                **exp.__dict__,
                "category_name": category.name if category else None,
                "branch_name": branch.name if branch else None,
                "created_by_name": f"{created_by.first_name} {created_by.last_name}" if created_by else None,
                "approved_by_name": f"{approved_by.first_name} {approved_by.last_name}" if approved_by else None,
            })
        
        import math
        return {
            "items": result,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": math.ceil(total / page_size) if total > 0 else 1,
            "total_amount": total_amount,
            "pending_count": pending_count,
            "approved_total": approved_total,
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/expenses")
async def create_expense(org_id: str, data: ExpenseCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "expenses:write", db)
    session = tenant_ctx.create_session()
    try:
        staff = session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            from models.master import User
            master_user = db.query(User).filter(User.email == user.email).first()
            if master_user:
                count = session.query(Staff).count()
                staff = Staff(
                    staff_number=f"ADM{count + 1:02d}",
                    first_name=master_user.first_name or "Admin",
                    last_name=master_user.last_name or "",
                    email=master_user.email,
                    role="admin",
                    is_active=True,
                    phone=master_user.phone or "",
                )
                session.add(staff)
                session.commit()
                session.refresh(staff)
            else:
                raise HTTPException(status_code=404, detail="Staff not found")
        
        category = session.query(ExpenseCategory).filter(ExpenseCategory.id == data.category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        expense = Expense(
            expense_number=generate_expense_number(session),
            created_by_id=staff.id,
            **data.model_dump()
        )
        session.add(expense)
        session.commit()
        session.refresh(expense)
        
        return {
            **expense.__dict__,
            "category_name": category.name,
            "created_by_name": f"{staff.first_name} {staff.last_name}",
        }
    finally:
        session.close()
        tenant_ctx.close()

@router.put("/organizations/{org_id}/expenses/{expense_id}")
async def update_expense(org_id: str, expense_id: str, data: ExpenseUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "expenses:write", db)
    session = tenant_ctx.create_session()
    try:
        expense = session.query(Expense).filter(Expense.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        if expense.status not in ["pending", "rejected"]:
            raise HTTPException(status_code=400, detail="Cannot edit approved expense")
        
        for key, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(expense, key, value)
        
        expense.updated_at = datetime.utcnow()
        session.commit()
        session.refresh(expense)
        return expense
    finally:
        session.close()
        tenant_ctx.close()

@router.delete("/organizations/{org_id}/expenses/{expense_id}", dependencies=[Depends(require_not_demo)])
async def delete_expense(org_id: str, expense_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "expenses:write", db)
    session = tenant_ctx.create_session()
    try:
        expense = session.query(Expense).filter(Expense.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        if expense.status not in ["pending", "rejected"]:
            raise HTTPException(status_code=400, detail="Cannot delete approved expense")
        
        session.delete(expense)
        session.commit()
        return {"message": "Expense deleted"}
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/expenses/{expense_id}/approve")
async def approve_expense(org_id: str, expense_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "expenses:approve", db)
    session = tenant_ctx.create_session()
    try:
        expense = session.query(Expense).filter(Expense.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        if expense.status != "pending":
            raise HTTPException(status_code=400, detail="Expense is not pending")
        
        staff = session.query(Staff).filter(Staff.email == user.email).first()
        
        expense.status = "approved"
        expense.approved_by_id = staff.id if staff else None
        expense.approved_at = datetime.utcnow()
        
        session.commit()
        return {"message": "Expense approved"}
    finally:
        session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/expenses/{expense_id}/reject")
async def reject_expense(org_id: str, expense_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "expenses:approve", db)
    session = tenant_ctx.create_session()
    try:
        expense = session.query(Expense).filter(Expense.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        if expense.status != "pending":
            raise HTTPException(status_code=400, detail="Expense is not pending")
        
        staff = session.query(Staff).filter(Staff.email == user.email).first()
        
        expense.status = "rejected"
        expense.approved_by_id = staff.id if staff else None
        expense.approved_at = datetime.utcnow()
        
        session.commit()
        return {"message": "Expense rejected"}
    finally:
        session.close()
        tenant_ctx.close()
