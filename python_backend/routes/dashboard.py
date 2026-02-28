from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.database import get_db
from models.tenant import Branch, Staff, Member, LoanApplication
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission

router = APIRouter()

@router.get("/{org_id}/dashboard/stats")
async def get_dashboard_stats(
    org_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "dashboard:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        total_members = tenant_session.query(Member).count()
        total_staff = tenant_session.query(Staff).count()
        total_branches = tenant_session.query(Branch).count()
        total_loans = tenant_session.query(LoanApplication).count()
        pending_loans = tenant_session.query(LoanApplication).filter(LoanApplication.status == 'pending').count()
        approved_loans = tenant_session.query(LoanApplication).filter(LoanApplication.status == 'approved').count()
        collateral_deficient_count = tenant_session.query(LoanApplication).filter(
            LoanApplication.collateral_deficient == True,
            LoanApplication.status.in_(['disbursed', 'defaulted', 'restructured', 'approved'])
        ).count()

        return {
            "total_members": total_members,
            "total_staff": total_staff,
            "total_branches": total_branches,
            "total_loans": total_loans,
            "pending_loans": pending_loans,
            "approved_loans": approved_loans,
            "collateral_deficient_count": collateral_deficient_count,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()
