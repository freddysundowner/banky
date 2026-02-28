from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, date, timedelta
from models.database import get_db
from models.tenant import AuditLog, Staff
from schemas.tenant import AuditLogResponse
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission, require_role

router = APIRouter()

def create_audit_log(
    tenant_session, 
    staff_id: str = None, 
    action: str = "", 
    entity_type: str = None, 
    entity_id: str = None,
    old_values: dict = None,
    new_values: dict = None,
    ip_address: str = None,
    user_agent: str = None
):
    audit_log = AuditLog(
        staff_id=staff_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent
    )
    tenant_session.add(audit_log)
    tenant_session.commit()
    return audit_log

def format_audit_details(log: AuditLog) -> str:
    """Generate human-readable details from audit log values"""
    details = []
    values = log.new_values or {}
    old_values = log.old_values or {}
    currency = values.get('currency', 'KES')
    
    if 'member_name' in values:
        details.append(f"Member: {values['member_name']}")
    elif 'member_number' in values:
        details.append(f"Member #: {values['member_number']}")
    
    if 'first_name' in values and 'last_name' in values:
        details.append(f"Name: {values['first_name']} {values['last_name']}")
    elif 'name' in values:
        details.append(f"Name: {values['name']}")

    if 'loan_number' in values:
        details.append(f"Loan #: {values['loan_number']}")
    if 'application_number' in values:
        details.append(f"Application #: {values['application_number']}")
    if 'deposit_number' in values:
        details.append(f"Deposit #: {values['deposit_number']}")

    if 'amount' in values:
        amount = values.get('amount', 0)
        details.append(f"Amount: {currency} {amount:,.2f}" if isinstance(amount, (int, float)) else f"Amount: {currency} {amount}")
    if 'principal' in values:
        principal = values.get('principal', 0)
        details.append(f"Principal: {currency} {principal:,.2f}" if isinstance(principal, (int, float)) else f"Principal: {principal}")

    if 'transaction_type' in values:
        details.append(f"Type: {values['transaction_type']}")
    if 'account_type' in values:
        details.append(f"Account: {values['account_type']}")
    if 'disbursement_method' in values:
        details.append(f"Method: {values['disbursement_method']}")

    if 'status' in values:
        if 'status' in old_values:
            details.append(f"Status: {old_values['status']} → {values['status']}")
        else:
            details.append(f"Status: {values['status']}")

    if 'interest_rate' in values:
        details.append(f"Rate: {values['interest_rate']}%")

    if 'new_balance' in values:
        balance = values.get('new_balance', 0)
        details.append(f"New Balance: {currency} {balance:,.2f}" if isinstance(balance, (int, float)) else f"New Balance: {balance}")

    if 'reference' in values:
        details.append(f"Ref: {values['reference']}")
    elif 'transaction_code' in values:
        details.append(f"Code: {values['transaction_code']}")

    if 'email' in values and log.action in ['LOGIN', 'LOGOUT']:
        details.append(f"Email: {values['email']}")
        if 'branch' in values and values['branch']:
            details.append(f"Branch: {values['branch']}")

    if 'phone' in values:
        details.append(f"Phone: {values['phone']}")
    if 'reason' in values:
        details.append(f"Reason: {values['reason']}")

    return " | ".join(details) if details else "-"

@router.get("/{org_id}/audit-logs")
async def list_audit_logs(
    org_id: str, 
    staff_id: str = None,
    entity_type: str = None,
    action: str = None,
    search: str = None,
    start_date: date = None,
    end_date: date = None,
    limit: int = 20,
    page: int = 1,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from routes.common import get_branch_filter
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "audit:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        # Validate pagination params
        page = max(1, page)
        limit = max(1, min(100, limit))
        
        query = tenant_session.query(AuditLog)
        
        # Filter audit logs by branch - staff can only see logs from their branch's staff
        user_branch_id = get_branch_filter(user)
        if user_branch_id:
            # Get staff IDs from user's branch
            branch_staff_ids = [s.id for s in tenant_session.query(Staff).filter(Staff.branch_id == user_branch_id).all()]
            query = query.filter(AuditLog.staff_id.in_(branch_staff_ids))
        
        if staff_id:
            query = query.filter(AuditLog.staff_id == staff_id)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if action:
            query = query.filter(AuditLog.action.ilike(f"%{action}%"))
        if search:
            search_pattern = f"%{search}%"
            from sqlalchemy import or_, cast, String
            query = query.filter(
                or_(
                    AuditLog.action.ilike(search_pattern),
                    AuditLog.entity_type.ilike(search_pattern),
                    AuditLog.entity_id.ilike(search_pattern),
                    cast(AuditLog.new_values, String).ilike(search_pattern)
                )
            )
        if start_date:
            query = query.filter(func.date(AuditLog.created_at) >= start_date)
        if end_date:
            query = query.filter(func.date(AuditLog.created_at) <= end_date)
        
        # Get total count for pagination
        total = query.count()
        
        # Calculate offset from page
        offset = (page - 1) * limit
        
        logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
        
        # Build response with staff info and details
        result = []
        for log in logs:
            staff = tenant_session.query(Staff).filter(Staff.id == log.staff_id).first() if log.staff_id else None
            result.append({
                "id": log.id,
                "staff_id": log.staff_id,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "old_values": log.old_values,
                "new_values": log.new_values,
                "details": format_audit_details(log),
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "staff": {
                    "first_name": staff.first_name,
                    "last_name": staff.last_name
                } if staff else None
            })
        
        return {
            "logs": result,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/audit-logs/entity/{entity_type}/{entity_id}")
async def get_entity_audit_trail(org_id: str, entity_type: str, entity_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "audit:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        logs = tenant_session.query(AuditLog).filter(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id
        ).order_by(AuditLog.created_at.desc()).all()
        
        result = []
        for log in logs:
            staff = tenant_session.query(Staff).filter(Staff.id == log.staff_id).first() if log.staff_id else None
            result.append({
                "id": log.id,
                "action": log.action,
                "staff_name": f"{staff.first_name} {staff.last_name}" if staff else "System",
                "old_values": log.old_values,
                "new_values": log.new_values,
                "created_at": log.created_at.isoformat() if log.created_at else None
            })
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/audit-logs/summary")
async def get_audit_summary(org_id: str, days: int = 30, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "audit:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        start_date = date.today() - timedelta(days=days)
        
        total_logs = tenant_session.query(func.count(AuditLog.id)).filter(
            func.date(AuditLog.created_at) >= start_date
        ).scalar() or 0
        
        by_action = tenant_session.query(
            AuditLog.action,
            func.count(AuditLog.id)
        ).filter(
            func.date(AuditLog.created_at) >= start_date
        ).group_by(AuditLog.action).all()
        
        by_entity = tenant_session.query(
            AuditLog.entity_type,
            func.count(AuditLog.id)
        ).filter(
            func.date(AuditLog.created_at) >= start_date,
            AuditLog.entity_type.isnot(None)
        ).group_by(AuditLog.entity_type).all()
        
        by_staff = tenant_session.query(
            Staff.first_name,
            Staff.last_name,
            func.count(AuditLog.id)
        ).join(Staff, AuditLog.staff_id == Staff.id).filter(
            func.date(AuditLog.created_at) >= start_date
        ).group_by(Staff.id, Staff.first_name, Staff.last_name).limit(10).all()
        
        return {
            "period_days": days,
            "total_logs": total_logs,
            "by_action": {action: count for action, count in by_action},
            "by_entity": {entity: count for entity, count in by_entity if entity},
            "top_staff": [
                {"name": f"{first} {last}", "actions": count}
                for first, last, count in by_staff
            ]
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/audit-logs/staff/{staff_id}/activity")
async def get_staff_activity(org_id: str, staff_id: str, days: int = 30, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "audit:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        start_date = date.today() - timedelta(days=days)
        
        logs = tenant_session.query(AuditLog).filter(
            AuditLog.staff_id == staff_id,
            func.date(AuditLog.created_at) >= start_date
        ).order_by(AuditLog.created_at.desc()).all()
        
        by_date = {}
        for log in logs:
            date_key = log.created_at.strftime("%Y-%m-%d")
            by_date[date_key] = by_date.get(date_key, 0) + 1
        
        return {
            "staff": {
                "id": staff.id,
                "name": f"{staff.first_name} {staff.last_name}",
                "role": staff.role
            },
            "period_days": days,
            "total_actions": len(logs),
            "activity_by_date": by_date,
            "recent_activity": [AuditLogResponse.model_validate(l) for l in logs[:20]]
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/audit-logs/{log_id}")
async def get_audit_log(org_id: str, log_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "audit:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        log = tenant_session.query(AuditLog).filter(AuditLog.id == log_id).first()
        if not log:
            raise HTTPException(status_code=404, detail="Audit log not found")
        return AuditLogResponse.model_validate(log)
    finally:
        tenant_session.close()
        tenant_ctx.close()
