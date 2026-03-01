"""
Admin endpoints for Soft Loan configuration.
GET  /{org_id}/soft-loan-config
PUT  /{org_id}/soft-loan-config
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from models.database import get_db
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_role

router = APIRouter()


class SoftLoanConfigUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    global_max_amount: Optional[float] = None
    base_amount: Optional[float] = None
    interest_rate: Optional[float] = None

    gate_active_member: Optional[bool] = None
    gate_no_active_soft_loan: Optional[bool] = None
    gate_min_membership_months: Optional[int] = None

    f1_enabled: Optional[bool] = None
    f1_min_savings: Optional[float] = None
    f1_contribution: Optional[float] = None

    f2_enabled: Optional[bool] = None
    f2_min_shares: Optional[float] = None
    f2_contribution: Optional[float] = None

    f3_enabled: Optional[bool] = None
    f3_contribution: Optional[float] = None

    f4_enabled: Optional[bool] = None
    f4_contribution: Optional[float] = None

    f5_enabled: Optional[bool] = None
    f5_months: Optional[int] = None
    f5_contribution: Optional[float] = None

    f6_enabled: Optional[bool] = None
    f6_months: Optional[int] = None
    f6_contribution: Optional[float] = None

    f7_enabled: Optional[bool] = None
    f7_min_transactions: Optional[int] = None
    f7_contribution: Optional[float] = None


def _config_to_dict(c):
    return {
        "is_enabled": c.is_enabled,
        "global_max_amount": float(c.global_max_amount or 0),
        "base_amount": float(c.base_amount or 0),
        "interest_rate": float(c.interest_rate or 10),
        "gate_active_member": c.gate_active_member,
        "gate_no_active_soft_loan": c.gate_no_active_soft_loan,
        "gate_min_membership_months": c.gate_min_membership_months or 0,
        "f1_enabled": c.f1_enabled,
        "f1_min_savings": float(c.f1_min_savings or 0),
        "f1_contribution": float(c.f1_contribution or 0),
        "f2_enabled": c.f2_enabled,
        "f2_min_shares": float(c.f2_min_shares or 0),
        "f2_contribution": float(c.f2_contribution or 0),
        "f3_enabled": c.f3_enabled,
        "f3_contribution": float(c.f3_contribution or 0),
        "f4_enabled": c.f4_enabled,
        "f4_contribution": float(c.f4_contribution or 0),
        "f5_enabled": c.f5_enabled,
        "f5_months": c.f5_months or 3,
        "f5_contribution": float(c.f5_contribution or 0),
        "f6_enabled": c.f6_enabled,
        "f6_months": c.f6_months or 12,
        "f6_contribution": float(c.f6_contribution or 0),
        "f7_enabled": c.f7_enabled,
        "f7_min_transactions": c.f7_min_transactions or 5,
        "f7_contribution": float(c.f7_contribution or 0),
    }


@router.get("/{org_id}/soft-loan-config")
def get_soft_loan_config(
    org_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from models.tenant import SoftLoanConfig

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    ts = tenant_ctx.session()
    try:
        config = ts.query(SoftLoanConfig).first()
        if not config:
            config = SoftLoanConfig()
            ts.add(config)
            ts.commit()
            ts.refresh(config)
        return _config_to_dict(config)
    finally:
        ts.close()


@router.put("/{org_id}/soft-loan-config")
def update_soft_loan_config(
    org_id: str,
    data: SoftLoanConfigUpdate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from models.tenant import SoftLoanConfig

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    ts = tenant_ctx.session()
    try:
        config = ts.query(SoftLoanConfig).first()
        if not config:
            config = SoftLoanConfig()
            ts.add(config)

        for field, value in data.dict(exclude_none=True).items():
            setattr(config, field, value)
        config.updated_at = datetime.utcnow()

        ts.commit()
        ts.refresh(config)
        return _config_to_dict(config)
    except Exception as e:
        ts.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        ts.close()
