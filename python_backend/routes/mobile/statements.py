"""
Mobile Member API — Statements
GET  /api/mobile/me/statements/available
POST /api/mobile/me/statements
GET  /api/mobile/me/statements/{statement_id}/download
GET  /api/mobile/me/statements/history
"""

import io
import json
import base64
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import desc
from .deps import get_current_member

router = APIRouter()


def _encode_statement_id(params: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(params).encode()).decode()


def _decode_statement_id(statement_id: str) -> dict:
    try:
        return json.loads(base64.urlsafe_b64decode(statement_id.encode()).decode())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid statement ID")


def _get_transactions(ts, member_id: str, start_date: datetime, end_date: datetime):
    from models.tenant import Transaction
    return (
        ts.query(Transaction)
        .filter(
            Transaction.member_id == member_id,
            Transaction.created_at >= start_date,
            Transaction.created_at <= end_date,
        )
        .order_by(desc(Transaction.created_at))
        .all()
    )


def _generate_pdf(member, transactions: list, start_date: datetime, end_date: datetime, account_type: str) -> bytes:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        story = []

        title_style = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=16, spaceAfter=6)
        sub_style = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=10, textColor=colors.grey)
        normal = styles["Normal"]

        story.append(Paragraph("Account Statement", title_style))
        story.append(Paragraph(f"Member: {getattr(member, 'full_name', '') or getattr(member, 'first_name', '')} {getattr(member, 'last_name', '')}", sub_style))
        story.append(Paragraph(f"Account Type: {account_type.replace('_', ' ').title()}", sub_style))
        story.append(Paragraph(f"Period: {start_date.strftime('%d %b %Y')} — {end_date.strftime('%d %b %Y')}", sub_style))
        story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%d %b %Y %H:%M UTC')}", sub_style))
        story.append(Spacer(1, 0.5*cm))

        headers = ["Date", "Description", "Type", "Amount", "Balance"]
        data = [headers]

        running_balance = 0.0
        for txn in reversed(transactions):
            amount = float(getattr(txn, "amount", 0) or 0)
            txn_type = getattr(txn, "transaction_type", "") or ""
            if txn_type.lower() in ("credit", "deposit", "loan_disbursement"):
                running_balance += amount
            else:
                running_balance -= amount
            data.append([
                txn.created_at.strftime("%d/%m/%Y") if txn.created_at else "",
                (getattr(txn, "description", "") or "")[:50],
                txn_type.replace("_", " ").title(),
                f"{amount:,.2f}",
                f"{running_balance:,.2f}",
            ])

        if len(data) == 1:
            data.append(["No transactions found in this period", "", "", "", ""])

        table = Table(data, colWidths=[3*cm, 7*cm, 4*cm, 3*cm, 3*cm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a56db")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
            ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(table)

        doc.build(story)
        return buffer.getvalue()

    except ImportError:
        # Fallback: plain-text PDF-like content
        lines = [
            "ACCOUNT STATEMENT",
            f"Period: {start_date.strftime('%d %b %Y')} - {end_date.strftime('%d %b %Y')}",
            f"Account Type: {account_type}",
            "",
            "Date       | Description                | Type       | Amount",
            "-" * 60,
        ]
        for txn in transactions:
            lines.append(
                f"{txn.created_at.strftime('%d/%m/%Y') if txn.created_at else 'N/A':10} | "
                f"{(getattr(txn, 'description', '') or '')[:26]:26} | "
                f"{(getattr(txn, 'transaction_type', '') or ''):10} | "
                f"{float(getattr(txn, 'amount', 0) or 0):>10.2f}"
            )
        return "\n".join(lines).encode()


@router.get("/me/statements/available")
def get_available_statements(ctx: dict = Depends(get_current_member)):
    """Return the last 12 months as available statement periods."""
    now = datetime.utcnow()
    periods = []
    for i in range(12):
        # First day of each past month
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        if month_end > now:
            month_end = now
        periods.append({
            "label": month_start.strftime("%B %Y"),
            "start_date": month_start.isoformat(),
            "end_date": month_end.isoformat(),
            "account_types": ["savings", "shares", "fixed_deposit", "all"],
        })
    return periods


@router.post("/me/statements")
def request_statement(
    body: dict,
    ctx: dict = Depends(get_current_member),
):
    """Generate a statement for the requested period and return a downloadable token."""
    member = ctx["member"]
    ts = ctx["session"]

    account_type = body.get("account_type", "all")
    fmt = body.get("format", "pdf")

    try:
        start_date = datetime.fromisoformat(body.get("start_date", "").replace("Z", ""))
        end_date = datetime.fromisoformat(body.get("end_date", "").replace("Z", ""))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO 8601.")

    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    if (end_date - start_date).days > 366:
        raise HTTPException(status_code=400, detail="Date range cannot exceed one year")

    try:
        transactions = _get_transactions(ts, member.id, start_date, end_date)
        txn_count = len(transactions)
    finally:
        ts.close()

    statement_params = {
        "member_id": member.id,
        "account_type": account_type,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "format": fmt,
        "generated_at": datetime.utcnow().isoformat(),
    }
    statement_id = _encode_statement_id(statement_params)

    return {
        "id": statement_id,
        "account_type": account_type,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "format": fmt,
        "transaction_count": txn_count,
        "generated_at": statement_params["generated_at"],
        "message": f"Statement generated with {txn_count} transactions",
    }


@router.get("/me/statements/history")
def get_statement_history(
    page: int = 1,
    limit: int = 20,
    ctx: dict = Depends(get_current_member),
):
    """Returns an empty list — statements are generated on-demand and not persisted."""
    return {"items": [], "total": 0, "page": page, "limit": limit}


@router.get("/me/statements/{statement_id}/download")
def download_statement(
    statement_id: str,
    ctx: dict = Depends(get_current_member),
):
    """Generate and stream a PDF statement for the given statement token."""
    member = ctx["member"]
    ts = ctx["session"]

    params = _decode_statement_id(statement_id)

    if params.get("member_id") != member.id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        start_date = datetime.fromisoformat(params["start_date"])
        end_date = datetime.fromisoformat(params["end_date"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Malformed statement ID")

    account_type = params.get("account_type", "all")

    try:
        transactions = _get_transactions(ts, member.id, start_date, end_date)
        pdf_bytes = _generate_pdf(member, transactions, start_date, end_date, account_type)
    finally:
        ts.close()

    filename = f"statement_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
