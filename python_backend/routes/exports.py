import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from models.database import get_db
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission

router = APIRouter()


@router.get("/{org_id}/export/members")
def export_members_csv(
    org_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.tenant import Member

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members.view", db)
    tenant_session = tenant_ctx.create_session()

    try:
        members = tenant_session.query(Member).order_by(Member.created_at.desc()).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Member Number", "First Name", "Last Name", "Email", "Phone",
            "ID Number", "Gender", "Date of Birth", "KRA PIN",
            "Savings Balance", "Shares Balance", "Status", "Join Date"
        ])

        for m in members:
            writer.writerow([
                m.member_number or "",
                m.first_name or "",
                m.last_name or "",
                m.email or "",
                m.phone or "",
                m.id_number or "",
                m.gender or "",
                m.date_of_birth.isoformat() if m.date_of_birth else "",
                getattr(m, "kra_pin", "") or "",
                str(m.savings_balance or 0),
                str(m.shares_balance or 0),
                "Active" if m.is_active else "Inactive",
                m.created_at.strftime("%Y-%m-%d") if m.created_at else "",
            ])

        output.seek(0)
        filename = f"members_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    finally:
        tenant_session.close()


@router.get("/{org_id}/export/transactions")
def export_transactions_csv(
    org_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.tenant import Transaction, Member

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions.view", db)
    tenant_session = tenant_ctx.create_session()

    try:
        transactions = (
            tenant_session.query(Transaction)
            .order_by(Transaction.created_at.desc())
            .limit(10000)
            .all()
        )

        member_ids = set(t.member_id for t in transactions if t.member_id)
        members_map = {}
        if member_ids:
            members = tenant_session.query(Member).filter(Member.id.in_(member_ids)).all()
            members_map = {m.id: f"{m.first_name} {m.last_name}" for m in members}

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Transaction ID", "Reference", "Member", "Type",
            "Amount", "Running Balance", "Description", "Method",
            "Status", "Date"
        ])

        for t in transactions:
            writer.writerow([
                t.id or "",
                getattr(t, "reference", "") or "",
                members_map.get(t.member_id, "") if t.member_id else "",
                t.transaction_type or "",
                str(t.amount or 0),
                str(getattr(t, "running_balance", "") or ""),
                getattr(t, "description", "") or getattr(t, "narration", "") or "",
                getattr(t, "method", "") or getattr(t, "payment_method", "") or "",
                getattr(t, "status", "completed") or "",
                t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "",
            ])

        output.seek(0)
        filename = f"transactions_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    finally:
        tenant_session.close()


@router.get("/{org_id}/export/loans")
def export_loans_csv(
    org_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.tenant import Loan, Member, LoanProduct

    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loans.view", db)
    tenant_session = tenant_ctx.create_session()

    try:
        loans = tenant_session.query(Loan).order_by(Loan.created_at.desc()).all()

        member_ids = set(l.member_id for l in loans if l.member_id)
        members_map = {}
        if member_ids:
            members = tenant_session.query(Member).filter(Member.id.in_(member_ids)).all()
            members_map = {m.id: f"{m.first_name} {m.last_name}" for m in members}

        product_ids = set(l.loan_product_id for l in loans if l.loan_product_id)
        products_map = {}
        if product_ids:
            products = tenant_session.query(LoanProduct).filter(LoanProduct.id.in_(product_ids)).all()
            products_map = {p.id: p.name for p in products}

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Loan Number", "Member", "Product", "Principal",
            "Interest Rate (%)", "Term (months)", "Total Due",
            "Amount Paid", "Outstanding", "Status", "Disbursed Date", "Created Date"
        ])

        for l in loans:
            writer.writerow([
                l.loan_number or "",
                members_map.get(l.member_id, "") if l.member_id else "",
                products_map.get(l.loan_product_id, "") if l.loan_product_id else "",
                str(l.principal_amount or 0),
                str(l.interest_rate or 0),
                str(l.term_months or 0),
                str(getattr(l, "total_due", "") or ""),
                str(getattr(l, "amount_paid", 0) or 0),
                str(getattr(l, "outstanding_balance", "") or ""),
                l.status or "",
                l.disbursed_at.strftime("%Y-%m-%d") if getattr(l, "disbursed_at", None) else "",
                l.created_at.strftime("%Y-%m-%d") if l.created_at else "",
            ])

        output.seek(0)
        filename = f"loans_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    finally:
        tenant_session.close()
