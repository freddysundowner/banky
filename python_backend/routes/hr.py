from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List
from decimal import Decimal
from datetime import datetime, date, timedelta
from pydantic import BaseModel
from models.database import get_db
from accounting.service import AccountingService, post_payroll_disbursement
from models.tenant import (
    Staff, PerformanceReview, LoanApplication, LoanInstalment, LoanRepayment,
    Branch, Member, Transaction,
    LeaveType, LeaveBalance, LeaveRequest, Attendance,
    PayrollConfig, Payslip, EmployeeDocument, StaffProfile,
    DisciplinaryRecord, TrainingRecord, PayPeriod, PayrollRun, SalaryAdvance,
    SalaryDeduction, OrganizationSettings
)
from schemas.tenant import (
    PerformanceReviewCreate, PerformanceReviewResponse,
    LeaveTypeCreate, LeaveTypeUpdate, LeaveTypeResponse,
    LeaveRequestCreate, LeaveRequestUpdate, LeaveRequestResponse,
    LeaveBalanceResponse, AttendanceCreate, AttendanceResponse,
    PayrollConfigCreate, PayrollConfigUpdate, PayrollConfigResponse,
    PayslipResponse, EmployeeDocumentCreate, EmployeeDocumentResponse,
    StaffProfileCreate, StaffProfileUpdate, StaffProfileResponse,
    DisciplinaryRecordCreate, DisciplinaryRecordUpdate, DisciplinaryRecordResponse,
    TrainingRecordCreate, TrainingRecordUpdate, TrainingRecordResponse,
    PayPeriodCreate, PayPeriodResponse, SalaryAdvanceCreate, DisbursementRequest
)
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission, require_role

router = APIRouter()

@router.get("/{org_id}/hr/staff")
async def get_hr_staff_list(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff_list = tenant_session.query(Staff).all()
        
        result = []
        for staff in staff_list:
            branch = tenant_session.query(Branch).filter(Branch.id == staff.branch_id).first() if staff.branch_id else None
            
            loans_created = tenant_session.query(func.count(LoanApplication.id)).filter(
                LoanApplication.created_by_id == staff.id
            ).scalar() or 0
            
            result.append({
                "id": staff.id,
                "staff_number": staff.staff_number,
                "first_name": staff.first_name,
                "last_name": staff.last_name,
                "email": staff.email,
                "phone": staff.phone,
                "role": staff.role,
                "branch_name": branch.name if branch else None,
                "is_active": staff.is_active,
                "is_locked": staff.is_locked,
                "last_login": staff.last_login.isoformat() if staff.last_login else None,
                "loans_processed": loans_created,
                "created_at": staff.created_at.isoformat() if staff.created_at else None
            })
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/staff/{staff_id}")
async def get_staff_hr_details(org_id: str, staff_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        branch = tenant_session.query(Branch).filter(Branch.id == staff.branch_id).first() if staff.branch_id else None
        
        created_loans = tenant_session.query(LoanApplication).filter(LoanApplication.created_by_id == staff_id).all()
        reviewed_loans = tenant_session.query(LoanApplication).filter(LoanApplication.reviewed_by_id == staff_id).all()
        
        reviews = tenant_session.query(PerformanceReview).filter(
            PerformanceReview.staff_id == staff_id
        ).order_by(PerformanceReview.review_period_end.desc()).all()
        
        return {
            "staff": {
                "id": staff.id,
                "staff_number": staff.staff_number,
                "first_name": staff.first_name,
                "last_name": staff.last_name,
                "email": staff.email,
                "phone": staff.phone,
                "role": staff.role,
                "branch_id": staff.branch_id,
                "branch_name": branch.name if branch else None,
                "is_active": staff.is_active,
                "is_locked": staff.is_locked,
                "last_login": staff.last_login.isoformat() if staff.last_login else None,
                "created_at": staff.created_at.isoformat() if staff.created_at else None
            },
            "performance_summary": {
                "loans_created": len(created_loans),
                "loans_reviewed": len(reviewed_loans),
                "loans_approved": sum(1 for l in reviewed_loans if l.status in ["approved", "disbursed", "paid"]),
                "loans_rejected": sum(1 for l in reviewed_loans if l.status == "rejected"),
                "total_disbursed": float(sum(l.amount_disbursed or Decimal("0") for l in created_loans if l.status in ["disbursed", "paid"])),
                "total_collected": float(sum(l.amount_repaid or Decimal("0") for l in created_loans))
            },
            "reviews": [PerformanceReviewResponse.model_validate(r) for r in reviews]
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/performance-reviews")
async def list_performance_reviews(org_id: str, staff_id: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(PerformanceReview)
        if staff_id:
            query = query.filter(PerformanceReview.staff_id == staff_id)
        
        reviews = query.order_by(PerformanceReview.review_period_end.desc()).all()
        return [PerformanceReviewResponse.model_validate(r) for r in reviews]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/performance-reviews")
async def create_performance_review(org_id: str, data: PerformanceReviewCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == data.staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        loans_created = tenant_session.query(LoanApplication).filter(
            LoanApplication.created_by_id == data.staff_id,
            func.date(LoanApplication.applied_at) >= data.review_period_start,
            func.date(LoanApplication.applied_at) <= data.review_period_end
        ).all()
        
        loans_reviewed = tenant_session.query(LoanApplication).filter(
            LoanApplication.reviewed_by_id == data.staff_id,
            func.date(LoanApplication.approved_at) >= data.review_period_start,
            func.date(LoanApplication.approved_at) <= data.review_period_end
        ).all()
        
        loans_processed = len(loans_created)
        loans_approved = sum(1 for l in loans_reviewed if l.status in ["approved", "disbursed", "paid"])
        loans_rejected = sum(1 for l in loans_reviewed if l.status == "rejected")
        total_disbursed = sum(l.amount_disbursed or Decimal("0") for l in loans_created if l.status in ["disbursed", "paid"])
        total_collected = sum(l.amount_repaid or Decimal("0") for l in loans_created)
        
        default_rate = Decimal("0")
        
        review = PerformanceReview(
            staff_id=data.staff_id,
            review_period_start=data.review_period_start,
            review_period_end=data.review_period_end,
            loans_processed=loans_processed,
            loans_approved=loans_approved,
            loans_rejected=loans_rejected,
            total_disbursed=total_disbursed,
            total_collected=total_collected,
            default_rate=default_rate,
            rating=data.rating,
            comments=data.comments
        )
        
        tenant_session.add(review)
        tenant_session.commit()
        tenant_session.refresh(review)
        return PerformanceReviewResponse.model_validate(review)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/performance-reviews/{review_id}")
async def get_performance_review(org_id: str, review_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        review = tenant_session.query(PerformanceReview).filter(PerformanceReview.id == review_id).first()
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        return PerformanceReviewResponse.model_validate(review)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/staff/{staff_id}/lock")
async def lock_staff_account(org_id: str, staff_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "hr"])
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        staff.is_locked = True
        tenant_session.commit()
        return {"message": "Staff account locked", "staff_id": staff_id}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/staff/{staff_id}/unlock")
async def unlock_staff_account(org_id: str, staff_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "hr"])
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        staff.is_locked = False
        tenant_session.commit()
        return {"message": "Staff account unlocked", "staff_id": staff_id}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/staff/{staff_id}/deactivate")
async def deactivate_staff(org_id: str, staff_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "hr"])
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        staff.is_active = False
        tenant_session.commit()
        return {"message": "Staff deactivated", "staff_id": staff_id}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/staff/{staff_id}/activate")
async def activate_staff(org_id: str, staff_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "hr"])
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        staff.is_active = True
        tenant_session.commit()
        return {"message": "Staff activated", "staff_id": staff_id}
    finally:
        tenant_session.close()
        tenant_ctx.close()

class ResetPasswordRequest(BaseModel):
    new_password: str

@router.put("/{org_id}/hr/staff/{staff_id}/reset-password")
async def reset_staff_password(org_id: str, staff_id: str, request: ResetPasswordRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    from services.auth import hash_password
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        if len(request.new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        # Update password in Staff table (tenant database only)
        staff.password_hash = hash_password(request.new_password)
        tenant_session.commit()
        
        return {"message": "Password reset successfully", "staff_id": staff_id}
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== LEAVE MANAGEMENT ====================

def seed_default_leave_types(tenant_session):
    """Seed default leave types if none exist"""
    existing = tenant_session.query(LeaveType).first()
    if existing:
        return
    
    default_types = [
        {"name": "Annual Leave", "code": "ANNUAL", "days_per_year": 21, "is_paid": True, "carry_over_allowed": True, "max_carry_over_days": 5},
        {"name": "Sick Leave", "code": "SICK", "days_per_year": 14, "is_paid": True, "carry_over_allowed": False},
        {"name": "Maternity Leave", "code": "MATERNITY", "days_per_year": 90, "is_paid": True, "carry_over_allowed": False},
        {"name": "Paternity Leave", "code": "PATERNITY", "days_per_year": 14, "is_paid": True, "carry_over_allowed": False},
        {"name": "Compassionate Leave", "code": "COMPASSIONATE", "days_per_year": 5, "is_paid": True, "carry_over_allowed": False},
        {"name": "Study Leave", "code": "STUDY", "days_per_year": 10, "is_paid": False, "carry_over_allowed": False},
        {"name": "Unpaid Leave", "code": "UNPAID", "days_per_year": 30, "is_paid": False, "carry_over_allowed": False},
    ]
    
    for lt in default_types:
        leave_type = LeaveType(**lt)
        tenant_session.add(leave_type)
    tenant_session.commit()

@router.get("/{org_id}/hr/leave-types")
async def list_leave_types(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "leave:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        seed_default_leave_types(tenant_session)
        leave_types = tenant_session.query(LeaveType).filter(LeaveType.is_active == True).all()
        return [LeaveTypeResponse.model_validate(lt) for lt in leave_types]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/leave-types")
async def create_leave_type(org_id: str, data: LeaveTypeCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        existing = tenant_session.query(LeaveType).filter(LeaveType.code == data.code).first()
        if existing:
            raise HTTPException(status_code=400, detail="Leave type code already exists")
        
        leave_type = LeaveType(**data.model_dump())
        tenant_session.add(leave_type)
        tenant_session.commit()
        tenant_session.refresh(leave_type)
        return LeaveTypeResponse.model_validate(leave_type)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/leave-types/{leave_type_id}")
async def update_leave_type(org_id: str, leave_type_id: str, data: LeaveTypeUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        leave_type = tenant_session.query(LeaveType).filter(LeaveType.id == leave_type_id).first()
        if not leave_type:
            raise HTTPException(status_code=404, detail="Leave type not found")
        
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(leave_type, key, value)
        
        tenant_session.commit()
        tenant_session.refresh(leave_type)
        return LeaveTypeResponse.model_validate(leave_type)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/leave-balances")
async def list_leave_balances(org_id: str, staff_id: str = None, year: int = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "leave:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        current_year = year or date.today().year
        query = tenant_session.query(LeaveBalance).filter(LeaveBalance.year == current_year)
        if staff_id:
            query = query.filter(LeaveBalance.staff_id == staff_id)
        
        balances = query.all()
        result = []
        for bal in balances:
            staff = tenant_session.query(Staff).filter(Staff.id == bal.staff_id).first()
            leave_type = tenant_session.query(LeaveType).filter(LeaveType.id == bal.leave_type_id).first()
            remaining = float(bal.entitled_days) + float(bal.carried_over_days) - float(bal.used_days)
            result.append({
                **LeaveBalanceResponse.model_validate(bal).model_dump(),
                "remaining_days": remaining,
                "leave_type_name": leave_type.name if leave_type else None,
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/leave-balances/initialize")
async def initialize_leave_balances(org_id: str, year: int = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Initialize leave balances for all staff for a given year"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        current_year = year or date.today().year
        seed_default_leave_types(tenant_session)
        
        staff_list = tenant_session.query(Staff).filter(Staff.is_active == True).all()
        leave_types = tenant_session.query(LeaveType).filter(LeaveType.is_active == True).all()
        
        created = 0
        for staff in staff_list:
            for lt in leave_types:
                existing = tenant_session.query(LeaveBalance).filter(
                    LeaveBalance.staff_id == staff.id,
                    LeaveBalance.leave_type_id == lt.id,
                    LeaveBalance.year == current_year
                ).first()
                
                if not existing:
                    balance = LeaveBalance(
                        staff_id=staff.id,
                        leave_type_id=lt.id,
                        year=current_year,
                        entitled_days=lt.days_per_year,
                        used_days=0,
                        carried_over_days=0
                    )
                    tenant_session.add(balance)
                    created += 1
        
        tenant_session.commit()
        return {"message": f"Initialized {created} leave balances for {len(staff_list)} staff"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/leave-requests")
async def list_leave_requests(org_id: str, status: str = None, staff_id: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "leave:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(LeaveRequest)
        if status:
            query = query.filter(LeaveRequest.status == status)
        if staff_id:
            query = query.filter(LeaveRequest.staff_id == staff_id)
        
        requests = query.order_by(LeaveRequest.created_at.desc()).all()
        result = []
        for req in requests:
            staff = tenant_session.query(Staff).filter(Staff.id == req.staff_id).first()
            leave_type = tenant_session.query(LeaveType).filter(LeaveType.id == req.leave_type_id).first()
            approved_by = tenant_session.query(Staff).filter(Staff.id == req.approved_by_id).first() if req.approved_by_id else None
            relief = tenant_session.query(Staff).filter(Staff.id == req.relief_staff_id).first() if req.relief_staff_id else None
            
            result.append({
                **LeaveRequestResponse.model_validate(req).model_dump(),
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                "leave_type_name": leave_type.name if leave_type else None,
                "approved_by_name": f"{approved_by.first_name} {approved_by.last_name}" if approved_by else None,
                "relief_staff_name": f"{relief.first_name} {relief.last_name}" if relief else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/leave-requests")
async def create_leave_request(org_id: str, data: LeaveRequestCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "leave:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff_id = data.staff_id.strip() if data.staff_id else None
        if staff_id:
            staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
            if not staff:
                raise HTTPException(status_code=404, detail="Selected staff member not found")
        else:
            staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
            if not staff:
                from models.master import User
                master_user = db.query(User).filter(User.email == user.email).first()
                if master_user:
                    count = tenant_session.query(Staff).count()
                    staff = Staff(
                        staff_number=f"ADM{count + 1:02d}",
                        first_name=master_user.first_name or "Admin",
                        last_name=master_user.last_name or "",
                        email=master_user.email,
                        role="admin",
                        is_active=True,
                        phone=master_user.phone or "",
                    )
                    tenant_session.add(staff)
                    tenant_session.commit()
                    tenant_session.refresh(staff)
                else:
                    raise HTTPException(status_code=400, detail="Staff profile not found. Please add yourself as staff first.")
        
        leave_type = tenant_session.query(LeaveType).filter(LeaveType.id == data.leave_type_id).first()
        if not leave_type:
            raise HTTPException(status_code=404, detail="Leave type not found")
        
        if data.end_date < data.start_date:
            raise HTTPException(status_code=400, detail="End date must be after start date")
        
        if float(data.days_requested) <= 0:
            raise HTTPException(status_code=400, detail="Days requested must be greater than 0")
        
        current_year = data.start_date.year
        balance = tenant_session.query(LeaveBalance).filter(
            LeaveBalance.staff_id == staff.id,
            LeaveBalance.leave_type_id == data.leave_type_id,
            LeaveBalance.year == current_year
        ).first()
        
        if not balance:
            balance = LeaveBalance(
                staff_id=staff.id,
                leave_type_id=data.leave_type_id,
                year=current_year,
                entitled_days=leave_type.days_per_year,
                used_days=0,
                carried_over_days=0
            )
            tenant_session.add(balance)
            tenant_session.flush()
        
        available = float(balance.entitled_days) + float(balance.carried_over_days) - float(balance.used_days)
        if float(data.days_requested) > available:
            raise HTTPException(status_code=400, detail=f"Insufficient leave balance. Available: {available} days, Requested: {float(data.days_requested)} days")
        
        request_data = data.model_dump(exclude={"staff_id"})
        leave_request = LeaveRequest(
            staff_id=staff.id,
            **request_data
        )
        tenant_session.add(leave_request)
        tenant_session.commit()
        
        staff_obj = tenant_session.query(Staff).filter(Staff.id == leave_request.staff_id).first()
        leave_type_obj = tenant_session.query(LeaveType).filter(LeaveType.id == leave_request.leave_type_id).first()
        
        result = LeaveRequestResponse.model_validate(leave_request).model_dump()
        result["staff_name"] = f"{staff_obj.first_name} {staff_obj.last_name}" if staff_obj else None
        result["leave_type_name"] = leave_type_obj.name if leave_type_obj else None
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/leave-requests/{request_id}/approve")
async def approve_leave_request(org_id: str, request_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "leave:approve", db)
    tenant_session = tenant_ctx.create_session()
    try:
        leave_request = tenant_session.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
        if not leave_request:
            raise HTTPException(status_code=404, detail="Leave request not found")
        
        if leave_request.status != "pending":
            raise HTTPException(status_code=400, detail="Leave request is not pending")
        
        approver = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        leave_request.status = "approved"
        leave_request.approved_by_id = approver.id if approver else None
        leave_request.approved_at = datetime.utcnow()
        
        balance = tenant_session.query(LeaveBalance).filter(
            LeaveBalance.staff_id == leave_request.staff_id,
            LeaveBalance.leave_type_id == leave_request.leave_type_id,
            LeaveBalance.year == leave_request.start_date.year
        ).first()
        
        if balance:
            balance.used_days = float(balance.used_days) + float(leave_request.days_requested)
        
        tenant_session.commit()
        return {"message": "Leave request approved"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/leave-requests/{request_id}/reject")
async def reject_leave_request(org_id: str, request_id: str, data: LeaveRequestUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "leave:approve", db)
    tenant_session = tenant_ctx.create_session()
    try:
        leave_request = tenant_session.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
        if not leave_request:
            raise HTTPException(status_code=404, detail="Leave request not found")
        
        if leave_request.status != "pending":
            raise HTTPException(status_code=400, detail="Leave request is not pending")
        
        approver = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        leave_request.status = "rejected"
        leave_request.approved_by_id = approver.id if approver else None
        leave_request.approved_at = datetime.utcnow()
        leave_request.rejection_reason = data.rejection_reason
        
        tenant_session.commit()
        return {"message": "Leave request rejected"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== ATTENDANCE ====================

@router.get("/{org_id}/hr/attendance")
async def list_attendance(org_id: str, date_from: str = None, date_to: str = None, staff_id: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(Attendance)
        
        if date_from:
            query = query.filter(Attendance.date >= datetime.strptime(date_from, "%Y-%m-%d").date())
        if date_to:
            query = query.filter(Attendance.date <= datetime.strptime(date_to, "%Y-%m-%d").date())
        if staff_id:
            query = query.filter(Attendance.staff_id == staff_id)
        
        records = query.order_by(Attendance.date.desc()).all()
        result = []
        for rec in records:
            staff = tenant_session.query(Staff).filter(Staff.id == rec.staff_id).first()
            branch = tenant_session.query(Branch).filter(Branch.id == rec.branch_id).first() if rec.branch_id else None
            result.append({
                **AttendanceResponse.model_validate(rec).model_dump(),
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                "branch_name": branch.name if branch else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/attendance/my-status")
async def get_my_attendance_status(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        require_setting = tenant_session.query(OrganizationSettings).filter(
            OrganizationSettings.setting_key == "require_clock_in"
        ).first()
        require_clock_in = require_setting and require_setting.setting_value.lower() == "true"

        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            return {"clocked_in": False, "clocked_out": False, "clock_in_time": None, "clock_out_time": None, "require_clock_in": require_clock_in}
        
        today = date.today()
        record = tenant_session.query(Attendance).filter(
            Attendance.staff_id == staff.id,
            Attendance.date == today
        ).first()
        
        if not record:
            return {"clocked_in": False, "clocked_out": False, "clock_in_time": None, "clock_out_time": None, "require_clock_in": require_clock_in}
        
        return {
            "clocked_in": record.clock_in is not None,
            "clocked_out": record.clock_out is not None,
            "clock_in_time": record.clock_in.isoformat() if record.clock_in else None,
            "clock_out_time": record.clock_out.isoformat() if record.clock_out else None,
            "require_clock_in": require_clock_in,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/attendance/clock-in")
async def clock_in(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        today = date.today()
        existing = tenant_session.query(Attendance).filter(
            Attendance.staff_id == staff.id,
            Attendance.date == today
        ).first()
        
        if existing and existing.clock_in:
            raise HTTPException(status_code=400, detail="Already clocked in today")
        
        now = datetime.now()
        
        if existing:
            existing.clock_in = now
            existing.status = "present"
            record = existing
        else:
            record = Attendance(
                staff_id=staff.id,
                date=today,
                clock_in=now,
                status="present",
                branch_id=staff.branch_id
            )
            tenant_session.add(record)
        
        tenant_session.commit()
        return {"message": "Clocked in successfully", "time": now.isoformat()}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/attendance/clock-out")
async def clock_out(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        today = date.today()
        record = tenant_session.query(Attendance).filter(
            Attendance.staff_id == staff.id,
            Attendance.date == today
        ).first()
        
        if not record or not record.clock_in:
            raise HTTPException(status_code=400, detail="Not clocked in today")
        
        if record.clock_out:
            raise HTTPException(status_code=400, detail="Already clocked out today")
        
        now = datetime.now()
        record.clock_out = now
        
        if record.clock_in:
            work_duration = (now - record.clock_in).total_seconds() / 60
            standard_hours = 8 * 60
            if work_duration > standard_hours:
                record.overtime_minutes = int(work_duration - standard_hours)
        
        tenant_session.commit()
        return {"message": "Clocked out successfully", "time": now.isoformat()}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/attendance")
async def create_attendance_record(org_id: str, data: AttendanceCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        existing = tenant_session.query(Attendance).filter(
            Attendance.staff_id == data.staff_id,
            Attendance.date == data.date
        ).first()
        
        if existing:
            for key, value in data.model_dump(exclude_unset=True).items():
                if value is not None:
                    setattr(existing, key, value)
            tenant_session.commit()
            return AttendanceResponse.model_validate(existing)
        
        staff = tenant_session.query(Staff).filter(Staff.id == data.staff_id).first()
        record = Attendance(
            **data.model_dump(),
            branch_id=staff.branch_id if staff else None
        )
        tenant_session.add(record)
        tenant_session.commit()
        tenant_session.refresh(record)
        return AttendanceResponse.model_validate(record)
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== PAYROLL ====================

@router.get("/{org_id}/hr/payroll-configs")
async def list_payroll_configs(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        configs = tenant_session.query(PayrollConfig).filter(PayrollConfig.is_active == True).all()
        result = []
        for config in configs:
            staff = tenant_session.query(Staff).filter(Staff.id == config.staff_id).first()
            gross = float(config.basic_salary) + float(config.house_allowance) + float(config.transport_allowance) + float(config.other_allowances)
            total_ded = float(config.nhif_deduction) + float(config.nssf_deduction) + float(config.paye_tax) + float(config.other_deductions)
            result.append({
                **PayrollConfigResponse.model_validate(config).model_dump(),
                "gross_salary": gross,
                "total_deductions": total_ded,
                "net_salary": gross - total_ded,
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/payroll-configs/{staff_id}")
async def get_payroll_config(org_id: str, staff_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        config = tenant_session.query(PayrollConfig).filter(PayrollConfig.staff_id == staff_id).first()
        if not config:
            return None
        
        staff = tenant_session.query(Staff).filter(Staff.id == config.staff_id).first()
        gross = float(config.basic_salary) + float(config.house_allowance) + float(config.transport_allowance) + float(config.other_allowances)
        total_ded = float(config.nhif_deduction) + float(config.nssf_deduction) + float(config.paye_tax) + float(config.other_deductions)
        return {
            **PayrollConfigResponse.model_validate(config).model_dump(),
            "gross_salary": gross,
            "total_deductions": total_ded,
            "net_salary": gross - total_ded,
            "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/payroll-configs")
async def create_payroll_config(org_id: str, data: PayrollConfigCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        existing = tenant_session.query(PayrollConfig).filter(PayrollConfig.staff_id == data.staff_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Payroll config already exists for this staff")
        
        config = PayrollConfig(**data.model_dump())
        tenant_session.add(config)
        tenant_session.commit()
        tenant_session.refresh(config)
        return PayrollConfigResponse.model_validate(config)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/payroll-configs/{staff_id}")
async def update_payroll_config(org_id: str, staff_id: str, data: PayrollConfigUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        config = tenant_session.query(PayrollConfig).filter(PayrollConfig.staff_id == staff_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="Payroll config not found")
        
        for key, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(config, key, value)
        
        config.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(config)
        return PayrollConfigResponse.model_validate(config)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/payslips")
async def list_payslips(org_id: str, pay_period: str = None, staff_id: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(Payslip)
        if pay_period:
            query = query.filter(Payslip.pay_period == pay_period)
        if staff_id:
            query = query.filter(Payslip.staff_id == staff_id)
        
        payslips = query.order_by(Payslip.pay_date.desc()).all()
        result = []
        for slip in payslips:
            staff = tenant_session.query(Staff).filter(Staff.id == slip.staff_id).first()
            result.append({
                **PayslipResponse.model_validate(slip).model_dump(),
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/payslips/generate")
async def generate_payslips(org_id: str, pay_period: str, pay_date: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate payslips for all active staff for a pay period"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        pay_date_parsed = datetime.strptime(pay_date, "%Y-%m-%d").date()
        
        configs = tenant_session.query(PayrollConfig).filter(PayrollConfig.is_active == True).all()
        generated = 0
        
        for config in configs:
            existing = tenant_session.query(Payslip).filter(
                Payslip.staff_id == config.staff_id,
                Payslip.pay_period == pay_period
            ).first()
            
            if existing:
                continue
            
            from models.tenant import SalaryDeduction
            pending_deductions = tenant_session.query(SalaryDeduction).filter(
                SalaryDeduction.staff_id == config.staff_id,
                SalaryDeduction.status == "pending"
            ).all()
            shortage_deductions = sum(Decimal(str(d.amount)) for d in pending_deductions) if pending_deductions else Decimal("0")
            for d in pending_deductions:
                d.pay_period = pay_period
                d.status = "processing"
            
            gross = Decimal(config.basic_salary) + Decimal(config.house_allowance) + Decimal(config.transport_allowance) + Decimal(config.other_allowances)
            total_ded = Decimal(config.nhif_deduction) + Decimal(config.nssf_deduction) + Decimal(config.paye_tax) + Decimal(config.other_deductions) + shortage_deductions
            net = gross - total_ded
            
            payslip = Payslip(
                staff_id=config.staff_id,
                pay_period=pay_period,
                pay_date=pay_date_parsed,
                basic_salary=config.basic_salary,
                house_allowance=config.house_allowance,
                transport_allowance=config.transport_allowance,
                other_allowances=config.other_allowances,
                gross_salary=gross,
                nhif_deduction=config.nhif_deduction,
                nssf_deduction=config.nssf_deduction,
                paye_tax=config.paye_tax,
                shortage_deductions=shortage_deductions,
                other_deductions=config.other_deductions,
                total_deductions=total_ded,
                net_salary=net,
                status="draft"
            )
            tenant_session.add(payslip)
            generated += 1
        
        tenant_session.commit()
        return {"message": f"Generated {generated} payslips for period {pay_period}"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== EMPLOYEE DOCUMENTS ====================

@router.get("/{org_id}/hr/documents")
async def list_employee_documents(org_id: str, staff_id: str = None, document_type: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(EmployeeDocument)
        if staff_id:
            query = query.filter(EmployeeDocument.staff_id == staff_id)
        if document_type:
            query = query.filter(EmployeeDocument.document_type == document_type)
        
        docs = query.order_by(EmployeeDocument.created_at.desc()).all()
        result = []
        for doc in docs:
            staff = tenant_session.query(Staff).filter(Staff.id == doc.staff_id).first()
            verified_by = tenant_session.query(Staff).filter(Staff.id == doc.verified_by_id).first() if doc.verified_by_id else None
            result.append({
                **EmployeeDocumentResponse.model_validate(doc).model_dump(),
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                "verified_by_name": f"{verified_by.first_name} {verified_by.last_name}" if verified_by else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/documents")
async def create_employee_document(org_id: str, data: EmployeeDocumentCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        doc = EmployeeDocument(**data.model_dump())
        tenant_session.add(doc)
        tenant_session.commit()
        tenant_session.refresh(doc)
        return EmployeeDocumentResponse.model_validate(doc)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/documents/{doc_id}/verify")
async def verify_document(org_id: str, doc_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        doc = tenant_session.query(EmployeeDocument).filter(EmployeeDocument.id == doc_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        verifier = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        doc.is_verified = True
        doc.verified_by_id = verifier.id if verifier else None
        doc.verified_at = datetime.utcnow()
        
        tenant_session.commit()
        return {"message": "Document verified"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== STAFF PROFILES ====================

@router.get("/{org_id}/hr/profiles")
async def list_staff_profiles(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        profiles = tenant_session.query(StaffProfile).all()
        result = []
        for profile in profiles:
            staff = tenant_session.query(Staff).filter(Staff.id == profile.staff_id).first()
            reporting_to = tenant_session.query(Staff).filter(Staff.id == profile.reporting_to_id).first() if profile.reporting_to_id else None
            result.append({
                **StaffProfileResponse.model_validate(profile).model_dump(),
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                "reporting_to_name": f"{reporting_to.first_name} {reporting_to.last_name}" if reporting_to else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/profiles/{staff_id}")
async def get_staff_profile(org_id: str, staff_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        profile = tenant_session.query(StaffProfile).filter(StaffProfile.staff_id == staff_id).first()
        if not profile:
            return None
        
        staff = tenant_session.query(Staff).filter(Staff.id == profile.staff_id).first()
        reporting_to = tenant_session.query(Staff).filter(Staff.id == profile.reporting_to_id).first() if profile.reporting_to_id else None
        return {
            **StaffProfileResponse.model_validate(profile).model_dump(),
            "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
            "reporting_to_name": f"{reporting_to.first_name} {reporting_to.last_name}" if reporting_to else None
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/profiles")
async def create_staff_profile(org_id: str, data: StaffProfileCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        existing = tenant_session.query(StaffProfile).filter(StaffProfile.staff_id == data.staff_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Profile already exists for this staff")
        
        profile = StaffProfile(**data.model_dump())
        tenant_session.add(profile)
        tenant_session.commit()
        tenant_session.refresh(profile)
        return StaffProfileResponse.model_validate(profile)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/profiles/{staff_id}")
async def update_staff_profile(org_id: str, staff_id: str, data: StaffProfileUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        profile = tenant_session.query(StaffProfile).filter(StaffProfile.staff_id == staff_id).first()
        if not profile:
            profile = StaffProfile(staff_id=staff_id)
            tenant_session.add(profile)
        
        for key, value in data.model_dump(exclude_unset=True).items():
            if key != "staff_id" and value is not None:
                setattr(profile, key, value)
        
        profile.updated_at = datetime.utcnow()
        tenant_session.commit()
        tenant_session.refresh(profile)
        return StaffProfileResponse.model_validate(profile)
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== DISCIPLINARY RECORDS ====================

@router.get("/{org_id}/hr/disciplinary")
async def list_disciplinary_records(org_id: str, staff_id: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(DisciplinaryRecord)
        if staff_id:
            query = query.filter(DisciplinaryRecord.staff_id == staff_id)
        
        records = query.order_by(DisciplinaryRecord.incident_date.desc()).all()
        result = []
        for rec in records:
            staff = tenant_session.query(Staff).filter(Staff.id == rec.staff_id).first()
            issued_by = tenant_session.query(Staff).filter(Staff.id == rec.issued_by_id).first()
            witness = tenant_session.query(Staff).filter(Staff.id == rec.witness_id).first() if rec.witness_id else None
            result.append({
                **DisciplinaryRecordResponse.model_validate(rec).model_dump(),
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                "issued_by_name": f"{issued_by.first_name} {issued_by.last_name}" if issued_by else None,
                "witness_name": f"{witness.first_name} {witness.last_name}" if witness else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/disciplinary")
async def create_disciplinary_record(org_id: str, data: DisciplinaryRecordCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "manager"])
    tenant_session = tenant_ctx.create_session()
    try:
        issuer = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        issuer_id = issuer.id if issuer else None
        
        record = DisciplinaryRecord(
            **data.model_dump(),
            issued_by_id=issuer_id
        )
        tenant_session.add(record)
        tenant_session.commit()
        tenant_session.refresh(record)
        return DisciplinaryRecordResponse.model_validate(record)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/disciplinary/{record_id}")
async def update_disciplinary_record(org_id: str, record_id: str, data: DisciplinaryRecordUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "manager"])
    tenant_session = tenant_ctx.create_session()
    try:
        record = tenant_session.query(DisciplinaryRecord).filter(DisciplinaryRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")
        
        for key, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(record, key, value)
        
        tenant_session.commit()
        tenant_session.refresh(record)
        return DisciplinaryRecordResponse.model_validate(record)
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== TRAINING RECORDS ====================

@router.get("/{org_id}/hr/training")
async def list_training_records(org_id: str, staff_id: str = None, status: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(TrainingRecord)
        if staff_id:
            query = query.filter(TrainingRecord.staff_id == staff_id)
        if status:
            query = query.filter(TrainingRecord.status == status)
        
        records = query.order_by(TrainingRecord.start_date.desc()).all()
        result = []
        for rec in records:
            staff = tenant_session.query(Staff).filter(Staff.id == rec.staff_id).first()
            result.append({
                **TrainingRecordResponse.model_validate(rec).model_dump(),
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/training")
async def create_training_record(org_id: str, data: TrainingRecordCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        record = TrainingRecord(**data.model_dump())
        tenant_session.add(record)
        tenant_session.commit()
        tenant_session.refresh(record)
        return TrainingRecordResponse.model_validate(record)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/training/{record_id}")
async def update_training_record(org_id: str, record_id: str, data: TrainingRecordUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        record = tenant_session.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")
        
        for key, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(record, key, value)
        
        tenant_session.commit()
        tenant_session.refresh(record)
        return TrainingRecordResponse.model_validate(record)
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== HR REPORTS ====================

@router.get("/{org_id}/hr/reports/summary")
async def get_hr_summary(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        total_staff = tenant_session.query(func.count(Staff.id)).scalar() or 0
        active_staff = tenant_session.query(func.count(Staff.id)).filter(Staff.is_active == True).scalar() or 0
        locked_staff = tenant_session.query(func.count(Staff.id)).filter(Staff.is_locked == True).scalar() or 0
        
        pending_leave = tenant_session.query(func.count(LeaveRequest.id)).filter(
            LeaveRequest.status == "pending"
        ).scalar() or 0
        
        on_leave_today = tenant_session.query(func.count(LeaveRequest.id)).filter(
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= date.today(),
            LeaveRequest.end_date >= date.today()
        ).scalar() or 0
        
        today_attendance = tenant_session.query(func.count(Attendance.id)).filter(
            Attendance.date == date.today(),
            Attendance.clock_in != None
        ).scalar() or 0
        
        pending_trainings = tenant_session.query(func.count(TrainingRecord.id)).filter(
            TrainingRecord.status.in_(["scheduled", "in_progress"])
        ).scalar() or 0
        
        unresolved_disciplinary = tenant_session.query(func.count(DisciplinaryRecord.id)).filter(
            DisciplinaryRecord.is_resolved == False
        ).scalar() or 0
        
        return {
            "total_staff": total_staff,
            "active_staff": active_staff,
            "inactive_staff": total_staff - active_staff,
            "locked_staff": locked_staff,
            "pending_leave_requests": pending_leave,
            "staff_on_leave_today": on_leave_today,
            "clocked_in_today": today_attendance,
            "pending_trainings": pending_trainings,
            "unresolved_disciplinary": unresolved_disciplinary
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/reports/leave-balances")
async def get_leave_balance_report(org_id: str, year: int = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "leave:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        current_year = year or date.today().year
        
        staff_list = tenant_session.query(Staff).filter(Staff.is_active == True).all()
        leave_types = tenant_session.query(LeaveType).filter(LeaveType.is_active == True).all()
        
        result = []
        for staff in staff_list:
            staff_balances = {"staff_id": staff.id, "staff_name": f"{staff.first_name} {staff.last_name}", "balances": []}
            
            for lt in leave_types:
                balance = tenant_session.query(LeaveBalance).filter(
                    LeaveBalance.staff_id == staff.id,
                    LeaveBalance.leave_type_id == lt.id,
                    LeaveBalance.year == current_year
                ).first()
                
                if balance:
                    remaining = float(balance.entitled_days) + float(balance.carried_over_days) - float(balance.used_days)
                    staff_balances["balances"].append({
                        "leave_type": lt.name,
                        "entitled": float(balance.entitled_days),
                        "used": float(balance.used_days),
                        "remaining": remaining
                    })
                else:
                    staff_balances["balances"].append({
                        "leave_type": lt.name,
                        "entitled": lt.days_per_year,
                        "used": 0,
                        "remaining": lt.days_per_year
                    })
            
            result.append(staff_balances)
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/reports/attendance")
async def get_attendance_report(org_id: str, month: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        if month:
            year, month_num = map(int, month.split("-"))
            start_date = date(year, month_num, 1)
            if month_num == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, month_num + 1, 1) - timedelta(days=1)
        else:
            today = date.today()
            start_date = date(today.year, today.month, 1)
            end_date = today
        
        staff_list = tenant_session.query(Staff).filter(Staff.is_active == True).all()
        
        result = []
        for staff in staff_list:
            records = tenant_session.query(Attendance).filter(
                Attendance.staff_id == staff.id,
                Attendance.date.between(start_date, end_date)
            ).all()
            
            present = sum(1 for r in records if r.status == "present")
            absent = sum(1 for r in records if r.status == "absent")
            late = sum(1 for r in records if r.status == "late")
            on_leave = sum(1 for r in records if r.status == "on_leave")
            total_overtime = sum(r.overtime_minutes or 0 for r in records)
            
            result.append({
                "staff_id": staff.id,
                "staff_name": f"{staff.first_name} {staff.last_name}",
                "days_present": present,
                "days_absent": absent,
                "days_late": late,
                "days_on_leave": on_leave,
                "total_overtime_hours": round(total_overtime / 60, 1)
            })
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== PAY PERIOD MANAGEMENT ====================

@router.get("/{org_id}/hr/pay-periods")
async def list_pay_periods(org_id: str, year: int = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(PayPeriod).order_by(PayPeriod.start_date.desc())
        if year:
            query = query.filter(func.extract('year', PayPeriod.start_date) == year)
        periods = query.limit(24).all()
        
        result = []
        for p in periods:
            processed_by = tenant_session.query(Staff).filter(Staff.id == p.processed_by_id).first() if p.processed_by_id else None
            approved_by = tenant_session.query(Staff).filter(Staff.id == p.approved_by_id).first() if p.approved_by_id else None
            result.append({
                "id": p.id,
                "name": p.name,
                "period_type": p.period_type,
                "start_date": p.start_date,
                "end_date": p.end_date,
                "pay_date": p.pay_date,
                "status": p.status,
                "total_gross": float(p.total_gross or 0),
                "total_deductions": float(p.total_deductions or 0),
                "total_net": float(p.total_net or 0),
                "staff_count": p.staff_count or 0,
                "processed_by_name": f"{processed_by.first_name} {processed_by.last_name}" if processed_by else None,
                "processed_at": p.processed_at,
                "approved_by_name": f"{approved_by.first_name} {approved_by.last_name}" if approved_by else None,
                "approved_at": p.approved_at,
                "paid_at": p.paid_at,
                "notes": p.notes,
                "created_at": p.created_at
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/pay-periods")
async def create_pay_period(org_id: str, data: PayPeriodCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        period = PayPeriod(
            name=data.name,
            period_type=data.period_type,
            start_date=data.start_date,
            end_date=data.end_date,
            pay_date=data.pay_date,
            notes=data.notes
        )
        tenant_session.add(period)
        tenant_session.commit()
        tenant_session.refresh(period)
        return {"id": period.id, "message": "Pay period created"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/pay-periods/generate-monthly")
async def generate_monthly_periods(org_id: str, year: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate all 12 monthly pay periods for a given year"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        from calendar import monthrange
        import calendar
        
        created = 0
        for month in range(1, 13):
            month_name = calendar.month_name[month]
            _, last_day = monthrange(year, month)
            
            existing = tenant_session.query(PayPeriod).filter(
                PayPeriod.name == f"{month_name} {year}"
            ).first()
            
            if not existing:
                period = PayPeriod(
                    name=f"{month_name} {year}",
                    period_type="monthly",
                    start_date=date(year, month, 1),
                    end_date=date(year, month, last_day),
                    pay_date=date(year, month, 25) if month < 12 else date(year, month, 24)
                )
                tenant_session.add(period)
                created += 1
        
        tenant_session.commit()
        return {"message": f"Generated {created} monthly pay periods for {year}"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/pay-periods/{period_id}")
async def get_pay_period(org_id: str, period_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        period = tenant_session.query(PayPeriod).filter(PayPeriod.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Pay period not found")
        
        payslips = tenant_session.query(Payslip).filter(
            Payslip.pay_period == f"{period.start_date.year}-{period.start_date.month:02d}"
        ).all()
        
        payslip_list = []
        for ps in payslips:
            staff = tenant_session.query(Staff).filter(Staff.id == ps.staff_id).first()
            payslip_list.append({
                "id": ps.id,
                "staff_id": ps.staff_id,
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                "staff_number": staff.staff_number if staff else None,
                "gross_salary": float(ps.gross_salary or 0),
                "total_deductions": float(ps.total_deductions or 0),
                "net_salary": float(ps.net_salary or 0),
                "status": ps.status
            })
        
        return {
            "period": {
                "id": period.id,
                "name": period.name,
                "status": period.status,
                "start_date": period.start_date,
                "end_date": period.end_date,
                "pay_date": period.pay_date,
                "total_gross": float(period.total_gross or 0),
                "total_deductions": float(period.total_deductions or 0),
                "total_net": float(period.total_net or 0),
                "staff_count": period.staff_count
            },
            "payslips": payslip_list
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== PAYROLL PROCESSING ====================

def calculate_staff_loan_deduction(tenant_session, member_id: str) -> Decimal:
    """Calculate total due loan instalment amount for a member linked to staff.
    Returns the sum of all due/overdue instalment remaining amounts across active loans.
    Uses deterministic ordering: earliest due date first across all loans."""
    from datetime import date as date_type
    today = date_type.today()
    
    due_instalments = tenant_session.query(LoanInstalment).join(
        LoanApplication, LoanInstalment.loan_id == LoanApplication.id
    ).filter(
        LoanApplication.member_id == member_id,
        LoanApplication.status.in_(["disbursed", "defaulted"]),
        LoanInstalment.status.in_(["pending", "partial", "overdue"]),
        LoanInstalment.due_date <= today
    ).order_by(LoanInstalment.due_date, LoanInstalment.instalment_number).all()
    
    total_due = Decimal("0")
    for inst in due_instalments:
        remaining = (
            (Decimal(str(inst.expected_principal or 0)) - Decimal(str(inst.paid_principal or 0))) +
            (Decimal(str(inst.expected_interest or 0)) - Decimal(str(inst.paid_interest or 0))) +
            (Decimal(str(inst.expected_penalty or 0)) - Decimal(str(inst.paid_penalty or 0))) +
            (Decimal(str(getattr(inst, 'expected_insurance', None) or 0)) - Decimal(str(getattr(inst, 'paid_insurance', None) or 0)))
        )
        if remaining > 0:
            total_due += remaining
    
    return total_due


def process_payroll_loan_repayment(tenant_session, member_id: str, amount: Decimal, period_name: str):
    """Process actual loan repayment during payroll disbursement.
    Allocates payment across active loans for the linked member using
    deterministic ordering (earliest due date first) to match run_payroll calculation."""
    import logging
    logger = logging.getLogger(__name__)
    from services.code_generator import generate_txn_code
    from services.instalment_service import allocate_payment_to_instalments
    from datetime import date as date_type
    
    active_loans = tenant_session.query(LoanApplication).filter(
        LoanApplication.member_id == member_id,
        LoanApplication.status.in_(["disbursed", "defaulted"])
    ).order_by(LoanApplication.applied_at).all()
    
    remaining_amount = amount
    today = date_type.today()
    total_actually_paid = Decimal("0")
    member = tenant_session.query(Member).filter(Member.id == member_id).first()
    
    for loan in active_loans:
        if remaining_amount <= 0:
            break
        
        due_instalments = tenant_session.query(LoanInstalment).filter(
            LoanInstalment.loan_id == str(loan.id),
            LoanInstalment.status.in_(["pending", "partial", "overdue"]),
            LoanInstalment.due_date <= today
        ).order_by(LoanInstalment.due_date, LoanInstalment.instalment_number).all()
        
        loan_due = Decimal("0")
        for inst in due_instalments:
            r = (
                (Decimal(str(inst.expected_principal or 0)) - Decimal(str(inst.paid_principal or 0))) +
                (Decimal(str(inst.expected_interest or 0)) - Decimal(str(inst.paid_interest or 0))) +
                (Decimal(str(inst.expected_penalty or 0)) - Decimal(str(inst.paid_penalty or 0))) +
                (Decimal(str(getattr(inst, 'expected_insurance', None) or 0)) - Decimal(str(getattr(inst, 'paid_insurance', None) or 0)))
            )
            loan_due += max(r, Decimal("0"))
        
        if loan_due <= 0:
            continue
        
        pay_this_loan = min(remaining_amount, loan_due)
        
        total_principal, total_interest, total_penalty, total_insurance, leftover = allocate_payment_to_instalments(
            tenant_session, loan, pay_this_loan
        )
        
        actual_paid = pay_this_loan - leftover
        if actual_paid <= 0:
            continue
        
        repayment = LoanRepayment(
            loan_id=str(loan.id),
            amount=actual_paid,
            principal_amount=total_principal,
            interest_amount=total_interest,
            penalty_amount=total_penalty,
            payment_method="payroll_deduction",
            payment_date=datetime.utcnow(),
            notes=f"Auto-deducted from payroll: {period_name}"
        )
        tenant_session.add(repayment)
        
        if member:
            balance_before = member.loan_balance or Decimal("0")
            member.loan_balance = max(Decimal("0"), balance_before - total_principal)
        
        loan.amount_paid = (loan.amount_paid or Decimal("0")) + actual_paid
        total_repayable = loan.total_amount or loan.amount
        if loan.amount_paid >= total_repayable:
            loan.status = "fully_paid"
        
        tx = Transaction(
            transaction_number=generate_txn_code(),
            member_id=member_id,
            transaction_type="loan_repayment",
            account_type="loan",
            amount=actual_paid,
            balance_before=balance_before if member else Decimal("0"),
            balance_after=member.loan_balance if member else Decimal("0"),
            payment_method="payroll_deduction",
            reference=f"PAYROLL-LOAN-{period_name}",
            description=f"Loan repayment deducted from payroll: {period_name}"
        )
        tenant_session.add(tx)
        
        remaining_amount -= actual_paid
        total_actually_paid += actual_paid
    
    if total_actually_paid < amount:
        logger.warning(
            f"Payroll loan deduction mismatch for member {member_id}: "
            f"expected={amount}, actual={total_actually_paid}, "
            f"unallocated={amount - total_actually_paid}, period={period_name}"
        )


@router.post("/{org_id}/hr/pay-periods/{period_id}/run-payroll")
async def run_payroll(org_id: str, period_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Process payroll for all active staff with payroll configs"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        period = tenant_session.query(PayPeriod).filter(PayPeriod.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Pay period not found")
        
        if period.status not in ["open", "processing"]:
            raise HTTPException(status_code=400, detail=f"Cannot run payroll for {period.status} period")
        
        pay_period_str = f"{period.start_date.year}-{period.start_date.month:02d}"
        
        existing_payslips = tenant_session.query(Payslip).filter(
            Payslip.pay_period == pay_period_str
        ).all()
        for ps in existing_payslips:
            tenant_session.delete(ps)
        
        configs = tenant_session.query(PayrollConfig).filter(PayrollConfig.is_active == True).all()
        
        total_gross = Decimal("0")
        total_deductions = Decimal("0")
        total_net = Decimal("0")
        staff_count = 0
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        for config in configs:
            staff_member = tenant_session.query(Staff).filter(Staff.id == config.staff_id).first()
            if not staff_member or not staff_member.is_active:
                continue
            
            advances = tenant_session.query(SalaryAdvance).filter(
                SalaryAdvance.staff_id == config.staff_id,
                SalaryAdvance.status == "disbursed",
                SalaryAdvance.is_fully_recovered == False
            ).all()
            
            advance_deduction = Decimal("0")
            for adv in advances:
                monthly_recovery = adv.amount / adv.recovery_months
                remaining = adv.amount - (adv.amount_recovered or Decimal("0"))
                deduct = min(monthly_recovery, remaining)
                advance_deduction += deduct
            
            loan_deduction = Decimal("0")
            if staff_member.linked_member_id:
                loan_deduction = calculate_staff_loan_deduction(tenant_session, staff_member.linked_member_id)
            
            pending_shortage_deds = tenant_session.query(SalaryDeduction).filter(
                SalaryDeduction.staff_id == config.staff_id,
                SalaryDeduction.status == "pending",
                SalaryDeduction.pay_period == pay_period_str
            ).all()
            shortage_deduction = sum(Decimal(str(sd.amount)) for sd in pending_shortage_deds)
            
            basic = config.basic_salary or Decimal("0")
            house = config.house_allowance or Decimal("0")
            transport = config.transport_allowance or Decimal("0")
            other_allow = config.other_allowances or Decimal("0")
            gross = basic + house + transport + other_allow
            
            nhif = config.nhif_deduction or Decimal("0")
            nssf = config.nssf_deduction or Decimal("0")
            paye = config.paye_tax or Decimal("0")
            other_ded = config.other_deductions or Decimal("0")
            base_deductions = nhif + nssf + paye + other_ded
            deductions = base_deductions + advance_deduction + loan_deduction + shortage_deduction
            net = gross - deductions
            
            payslip = Payslip(
                staff_id=config.staff_id,
                pay_period=pay_period_str,
                pay_date=period.pay_date,
                basic_salary=config.basic_salary or Decimal("0"),
                house_allowance=config.house_allowance or Decimal("0"),
                transport_allowance=config.transport_allowance or Decimal("0"),
                other_allowances=config.other_allowances or Decimal("0"),
                gross_salary=gross,
                nhif_deduction=config.nhif_deduction or Decimal("0"),
                nssf_deduction=config.nssf_deduction or Decimal("0"),
                paye_tax=config.paye_tax or Decimal("0"),
                loan_deductions=loan_deduction,
                advance_deductions=advance_deduction,
                shortage_deductions=shortage_deduction,
                other_deductions=config.other_deductions or Decimal("0"),
                total_deductions=deductions,
                net_salary=net,
                status="draft"
            )
            tenant_session.add(payslip)
            
            total_gross += gross
            total_deductions += deductions
            total_net += net
            staff_count += 1
        
        period.status = "processing"
        period.total_gross = total_gross
        period.total_deductions = total_deductions
        period.total_net = total_net
        period.staff_count = staff_count
        period.processed_by_id = staff.id if staff else None
        period.processed_at = datetime.utcnow()
        
        all_pending_deds = tenant_session.query(SalaryDeduction).filter(
            SalaryDeduction.status == "pending",
            SalaryDeduction.pay_period == pay_period_str
        ).all()
        for sd in all_pending_deds:
            sd.status = "processed"
            sd.processed_at = datetime.utcnow()
        
        tenant_session.commit()
        
        return {
            "message": f"Payroll processed for {staff_count} staff",
            "total_gross": float(total_gross),
            "total_deductions": float(total_deductions),
            "total_net": float(total_net),
            "staff_count": staff_count
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/pay-periods/{period_id}/approve")
async def approve_payroll(org_id: str, period_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Approve payroll for disbursement"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["admin", "owner"])
    tenant_session = tenant_ctx.create_session()
    try:
        period = tenant_session.query(PayPeriod).filter(PayPeriod.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Pay period not found")
        
        if period.status != "processing":
            raise HTTPException(status_code=400, detail="Payroll must be processed before approval")
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        pay_period_str = f"{period.start_date.year}-{period.start_date.month:02d}"
        payslips = tenant_session.query(Payslip).filter(Payslip.pay_period == pay_period_str).all()
        for ps in payslips:
            ps.status = "approved"
            ps.approved_by_id = staff.id if staff else None
            ps.approved_at = datetime.utcnow()
        
        period.status = "approved"
        period.approved_by_id = staff.id if staff else None
        period.approved_at = datetime.utcnow()
        
        tenant_session.commit()
        
        return {"message": "Payroll approved"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/pay-periods/{period_id}/disburse")
async def disburse_payroll(org_id: str, period_id: str, data: DisbursementRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Disburse salaries to staff accounts"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["admin", "owner"])
    tenant_session = tenant_ctx.create_session()
    try:
        period = tenant_session.query(PayPeriod).filter(PayPeriod.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Pay period not found")
        
        if period.status != "approved":
            raise HTTPException(status_code=400, detail="Payroll must be approved before disbursement")
        
        pay_period_str = f"{period.start_date.year}-{period.start_date.month:02d}"
        payslips = tenant_session.query(Payslip).filter(
            Payslip.pay_period == pay_period_str,
            Payslip.status == "approved"
        ).all()
        
        disbursed_count = 0
        total_disbursed = Decimal("0")
        total_gross = Decimal("0")
        total_paye = Decimal("0")
        total_nhif = Decimal("0")
        total_nssf = Decimal("0")
        total_loan_deductions = Decimal("0")
        total_other_deductions = Decimal("0")
        
        from routes.staff import ensure_staff_has_member_account
        
        for ps in payslips:
            if data.method == "savings_account":
                staff_member = tenant_session.query(Staff).filter(Staff.id == ps.staff_id).first()
                if staff_member:
                    member = ensure_staff_has_member_account(tenant_session, staff_member)
                    from services.code_generator import generate_txn_code
                    savings_before = member.savings_balance or Decimal("0")
                    member.savings_balance = savings_before + ps.net_salary
                    
                    tx = Transaction(
                        transaction_number=generate_txn_code(),
                        member_id=member.id,
                        transaction_type="salary_credit",
                        account_type="savings",
                        amount=ps.net_salary,
                        balance_before=savings_before,
                        balance_after=member.savings_balance,
                        payment_method="internal",
                        reference=f"PAYROLL-{period.name}",
                        description=f"Salary for {period.name}",
                        processed_by_id=staff_member.id
                    )
                    tenant_session.add(tx)
            
            ps.status = "paid"
            ps.paid_at = datetime.utcnow()
            disbursed_count += 1
            total_disbursed += ps.net_salary
            total_gross += ps.gross_salary or Decimal("0")
            total_paye += ps.paye_tax or Decimal("0")
            total_nhif += ps.nhif_deduction or Decimal("0")
            total_nssf += ps.nssf_deduction or Decimal("0")
            total_loan_deductions += ps.loan_deductions or Decimal("0")
            total_other_deductions += (ps.other_deductions or Decimal("0")) + (ps.shortage_deductions or Decimal("0"))
            
            advances = tenant_session.query(SalaryAdvance).filter(
                SalaryAdvance.staff_id == ps.staff_id,
                SalaryAdvance.status == "disbursed",
                SalaryAdvance.is_fully_recovered == False
            ).all()
            
            for adv in advances:
                monthly_recovery = adv.amount / adv.recovery_months
                remaining = adv.amount - (adv.amount_recovered or Decimal("0"))
                deduct = min(monthly_recovery, remaining)
                adv.amount_recovered = (adv.amount_recovered or Decimal("0")) + deduct
                if adv.amount_recovered >= adv.amount:
                    adv.is_fully_recovered = True
            
            loan_ded_amount = ps.loan_deductions or Decimal("0")
            if loan_ded_amount > 0:
                staff_for_loan = tenant_session.query(Staff).filter(Staff.id == ps.staff_id).first()
                if staff_for_loan and staff_for_loan.linked_member_id:
                    process_payroll_loan_repayment(
                        tenant_session, staff_for_loan.linked_member_id, loan_ded_amount, period.name or pay_period_str
                    )
        
        period.status = "paid"
        period.paid_at = datetime.utcnow()
        
        from models.tenant import SalaryDeduction as SD
        processing_deductions = tenant_session.query(SD).filter(
            SD.pay_period == pay_period_str,
            SD.status.in_(["pending", "processing"])
        ).all()
        for sd in processing_deductions:
            sd.status = "processed"
            sd.processed_at = datetime.utcnow()
        
        acct_service = AccountingService(tenant_session)
        acct_service.seed_default_accounts()
        
        staff_user = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        created_by = staff_user.id if staff_user else None
        
        try:
            post_payroll_disbursement(
                accounting_service=acct_service,
                period_id=period_id,
                period_name=period.name or pay_period_str,
                total_gross=total_gross,
                total_paye=total_paye,
                total_nhif=total_nhif,
                total_nssf=total_nssf,
                total_loan_deductions=total_loan_deductions,
                total_other_deductions=total_other_deductions,
                total_net=total_disbursed,
                disbursement_method=data.method,
                created_by_id=created_by
            )
        except Exception as e:
            print(f"Warning: Payroll accounting entry failed: {e}")
        
        tenant_session.commit()
        
        return {
            "message": f"Disbursed salaries to {disbursed_count} staff",
            "total_disbursed": float(total_disbursed),
            "total_gross": float(total_gross),
            "method": data.method
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== PAYSLIPS ====================

@router.get("/{org_id}/hr/payslips")
async def list_payslips(org_id: str, pay_period: str = None, staff_id: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(Payslip).order_by(Payslip.pay_date.desc())
        if pay_period:
            query = query.filter(Payslip.pay_period == pay_period)
        if staff_id:
            query = query.filter(Payslip.staff_id == staff_id)
        
        payslips = query.limit(100).all()
        
        result = []
        for ps in payslips:
            staff = tenant_session.query(Staff).filter(Staff.id == ps.staff_id).first()
            result.append({
                "id": ps.id,
                "staff_id": ps.staff_id,
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                "staff_number": staff.staff_number if staff else None,
                "pay_period": ps.pay_period,
                "pay_date": ps.pay_date,
                "basic_salary": float(ps.basic_salary or 0),
                "house_allowance": float(ps.house_allowance or 0),
                "transport_allowance": float(ps.transport_allowance or 0),
                "other_allowances": float(ps.other_allowances or 0),
                "gross_salary": float(ps.gross_salary or 0),
                "nhif_deduction": float(ps.nhif_deduction or 0),
                "nssf_deduction": float(ps.nssf_deduction or 0),
                "paye_tax": float(ps.paye_tax or 0),
                "loan_deductions": float(ps.loan_deductions or 0),
                "advance_deductions": float(ps.advance_deductions or 0),
                "other_deductions": float(ps.other_deductions or 0),
                "total_deductions": float(ps.total_deductions or 0),
                "net_salary": float(ps.net_salary or 0),
                "status": ps.status,
                "paid_at": ps.paid_at,
                "emailed_at": ps.emailed_at
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/hr/payslips/{payslip_id}")
async def get_payslip_detail(org_id: str, payslip_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        ps = tenant_session.query(Payslip).filter(Payslip.id == payslip_id).first()
        if not ps:
            raise HTTPException(status_code=404, detail="Payslip not found")
        
        staff = tenant_session.query(Staff).filter(Staff.id == ps.staff_id).first()
        approved_by = tenant_session.query(Staff).filter(Staff.id == ps.approved_by_id).first() if ps.approved_by_id else None
        
        return {
            "id": ps.id,
            "staff_id": ps.staff_id,
            "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
            "staff_number": staff.staff_number if staff else None,
            "pay_period": ps.pay_period,
            "pay_date": ps.pay_date,
            "basic_salary": float(ps.basic_salary or 0),
            "house_allowance": float(ps.house_allowance or 0),
            "transport_allowance": float(ps.transport_allowance or 0),
            "other_allowances": float(ps.other_allowances or 0),
            "gross_salary": float(ps.gross_salary or 0),
            "nhif_deduction": float(ps.nhif_deduction or 0),
            "nssf_deduction": float(ps.nssf_deduction or 0),
            "paye_tax": float(ps.paye_tax or 0),
            "loan_deductions": float(ps.loan_deductions or 0),
            "advance_deductions": float(ps.advance_deductions or 0),
            "shortage_deductions": float(ps.shortage_deductions or 0),
            "other_deductions": float(ps.other_deductions or 0),
            "total_deductions": float(ps.total_deductions or 0),
            "net_salary": float(ps.net_salary or 0),
            "days_worked": ps.days_worked or 0,
            "days_absent": ps.days_absent or 0,
            "overtime_hours": float(ps.overtime_hours or 0),
            "overtime_pay": float(ps.overtime_pay or 0),
            "status": ps.status,
            "approved_by_name": f"{approved_by.first_name} {approved_by.last_name}" if approved_by else None,
            "approved_at": ps.approved_at,
            "paid_at": ps.paid_at
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/payslips/{payslip_id}/email")
async def email_payslip(org_id: str, payslip_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Email payslip to staff member via Brevo"""
    from services.email_service import send_payslip_email
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        ps = tenant_session.query(Payslip).filter(Payslip.id == payslip_id).first()
        if not ps:
            raise HTTPException(status_code=404, detail="Payslip not found")
        
        staff = tenant_session.query(Staff).filter(Staff.id == ps.staff_id).first()
        if not staff or not staff.email:
            raise HTTPException(status_code=400, detail="Staff email not found")
        
        # Fetch national_id from staff profile for password protection
        from models.tenant import StaffProfile
        profile = tenant_session.query(StaffProfile).filter(StaffProfile.staff_id == ps.staff_id).first()
        national_id = profile.national_id if profile else None
        
        from models.master import Organization
        org = db.query(Organization).filter(Organization.id == org_id).first()
        org_name = org.name if org else "Your Organization"
        
        payslip_data = {
            "pay_period": ps.pay_period,
            "pay_date": str(ps.pay_date) if ps.pay_date else "N/A",
            "basic_salary": float(ps.basic_salary or 0),
            "house_allowance": float(ps.house_allowance or 0),
            "transport_allowance": float(ps.transport_allowance or 0),
            "other_allowances": float(ps.other_allowances or 0),
            "gross_salary": float(ps.gross_salary or 0),
            "nhif_deduction": float(ps.nhif_deduction or 0),
            "nssf_deduction": float(ps.nssf_deduction or 0),
            "paye_tax": float(ps.paye_tax or 0),
            "loan_deductions": float(ps.loan_deductions or 0),
            "advance_deductions": float(ps.advance_deductions or 0),
            "other_deductions": float(ps.other_deductions or 0),
            "total_deductions": float(ps.total_deductions or 0),
            "net_salary": float(ps.net_salary or 0)
        }
        
        staff_name = f"{staff.first_name} {staff.last_name}"
        
        try:
            result = await send_payslip_email(
                tenant_session=tenant_session,
                staff_email=staff.email,
                staff_name=staff_name,
                org_name=org_name,
                payslip_data=payslip_data,
                cc_email=staff.secondary_email,
                national_id=national_id
            )
            
            ps.emailed_at = datetime.utcnow()
            tenant_session.commit()
            
            cc_msg = f" (CC: {staff.secondary_email})" if staff.secondary_email else ""
            return {"message": f"Payslip emailed to {staff.email}{cc_msg}", "email": staff.email, "success": True}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
    finally:
        tenant_session.close()
        tenant_ctx.close()

# ==================== SALARY ADVANCES ====================

@router.get("/{org_id}/hr/salary-advances")
async def list_salary_advances(org_id: str, status: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(SalaryAdvance).order_by(SalaryAdvance.created_at.desc())
        if status:
            query = query.filter(SalaryAdvance.status == status)
        advances = query.limit(100).all()
        
        result = []
        for adv in advances:
            staff = tenant_session.query(Staff).filter(Staff.id == adv.staff_id).first()
            approved_by = tenant_session.query(Staff).filter(Staff.id == adv.approved_by_id).first() if adv.approved_by_id else None
            result.append({
                "id": adv.id,
                "staff_id": adv.staff_id,
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else None,
                "amount": float(adv.amount or 0),
                "reason": adv.reason,
                "request_date": adv.request_date,
                "status": adv.status,
                "approved_by_name": f"{approved_by.first_name} {approved_by.last_name}" if approved_by else None,
                "approved_at": adv.approved_at,
                "disbursed_at": adv.disbursed_at,
                "recovery_months": adv.recovery_months,
                "amount_recovered": float(adv.amount_recovered or 0),
                "is_fully_recovered": adv.is_fully_recovered
            })
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/hr/salary-advances")
async def request_salary_advance(org_id: str, data: SalaryAdvanceCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "hr:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        if data.staff_id:
            staff = tenant_session.query(Staff).filter(Staff.id == data.staff_id).first()
        else:
            staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff record not found")
        
        advance = SalaryAdvance(
            staff_id=staff.id,
            amount=data.amount,
            reason=data.reason,
            recovery_months=data.recovery_months
        )
        tenant_session.add(advance)
        tenant_session.commit()
        
        return {"id": advance.id, "message": "Salary advance request submitted"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/salary-advances/{advance_id}/approve")
async def approve_salary_advance(org_id: str, advance_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["admin", "owner"])
    tenant_session = tenant_ctx.create_session()
    try:
        advance = tenant_session.query(SalaryAdvance).filter(SalaryAdvance.id == advance_id).first()
        if not advance:
            raise HTTPException(status_code=404, detail="Advance not found")
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        advance.status = "approved"
        advance.approved_by_id = staff.id if staff else None
        advance.approved_at = datetime.utcnow()
        
        tenant_session.commit()
        return {"message": "Salary advance approved"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/hr/salary-advances/{advance_id}/disburse")
async def disburse_salary_advance(org_id: str, advance_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["admin", "owner"])
    tenant_session = tenant_ctx.create_session()
    try:
        advance = tenant_session.query(SalaryAdvance).filter(SalaryAdvance.id == advance_id).first()
        if not advance:
            raise HTTPException(status_code=404, detail="Advance not found")
        
        if advance.status != "approved":
            raise HTTPException(status_code=400, detail="Advance must be approved before disbursement")
        
        advance.status = "disbursed"
        advance.disbursed_at = datetime.utcnow()
        
        tenant_session.commit()
        return {"message": "Salary advance disbursed"}
    finally:
        tenant_session.close()
        tenant_ctx.close()
