from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from decimal import Decimal
from datetime import date, datetime
from models.database import get_db
from models.tenant import Member, Transaction, OrganizationSettings, Staff, AuditLog, TellerFloat, FloatTransaction
from schemas.tenant import TransactionCreate, TransactionResponse
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from services.code_generator import generate_txn_code
import logging
import io

gl_logger = logging.getLogger("accounting.gl")

def post_transaction_to_gl(tenant_session, transaction, member, staff_id=None):
    """Post a transaction to the General Ledger (fail silently if GL not available)"""
    try:
        from accounting.service import AccountingService, post_member_deposit, post_member_withdrawal
        
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        amount = Decimal(str(transaction.amount))
        member_name = f"{member.first_name} {member.last_name}"
        
        if transaction.transaction_type == "deposit":
            post_member_deposit(
                svc,
                member_id=member.id,
                amount=amount,
                account_type=transaction.account_type,
                payment_method=transaction.payment_method or "cash",
                transaction_id=str(transaction.id),
                description=f"Deposit - {member_name} - {transaction.account_type.title()}",
                created_by_id=staff_id
            )
            gl_logger.info(f"Posted deposit to GL: {transaction.transaction_number}")
        elif transaction.transaction_type == "withdrawal":
            post_member_withdrawal(
                svc,
                member_id=member.id,
                amount=amount,
                account_type=transaction.account_type,
                payment_method=transaction.payment_method or "cash",
                transaction_id=str(transaction.id),
                description=f"Withdrawal - {member_name} - {transaction.account_type.title()}",
                created_by_id=staff_id
            )
            gl_logger.info(f"Posted withdrawal to GL: {transaction.transaction_number}")
    except Exception as e:
        gl_logger.warning(f"Failed to post transaction {transaction.transaction_number} to GL: {e}")

def try_send_sms(tenant_session, template_type: str, phone: str, name: str, context: dict, member_id=None, loan_id=None):
    """Try to send SMS, fail silently if SMS not configured"""
    try:
        from routes.sms import send_sms_with_template
        if phone:
            send_sms_with_template(tenant_session, template_type, phone, name, context, member_id=member_id, loan_id=loan_id)
    except Exception as e:
        print(f"[SMS] Failed to send {template_type}: {e}")

def create_audit_log(tenant_session, staff_id, action, entity_type, entity_id, old_values=None, new_values=None):
    audit_log = AuditLog(
        staff_id=staff_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values
    )
    tenant_session.add(audit_log)

def check_teller_float_balance(tenant_session, staff_id: str, amount: Decimal, payment_method: str) -> tuple[bool, str]:
    """Check if teller has sufficient float balance for cash withdrawal"""
    if payment_method != "cash":
        return True, ""
    
    today = date.today()
    teller_float = tenant_session.query(TellerFloat).filter(
        and_(
            TellerFloat.staff_id == staff_id,
            TellerFloat.date == today,
            TellerFloat.status == "open"
        )
    ).first()
    
    if not teller_float:
        return False, "No cash float allocated for today. Please request a cash float from your supervisor."
    
    current_balance = Decimal(str(teller_float.current_balance or 0))
    if amount > current_balance:
        return False, f"Insufficient cash float balance. Available: {float(current_balance)}, Required: {float(amount)}"
    
    return True, ""

def update_teller_float(tenant_session, staff_id: str, transaction_type: str, amount: Decimal, payment_method: str):
    """Update teller float for cash transactions"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"update_teller_float called: staff_id={staff_id}, type={transaction_type}, amount={amount}, payment={payment_method}")
    
    if payment_method != "cash":
        logger.info("Skipping - not a cash transaction")
        return
    
    today = date.today()
    teller_float = tenant_session.query(TellerFloat).filter(
        and_(
            TellerFloat.staff_id == staff_id,
            TellerFloat.date == today,
            TellerFloat.status == "open"
        )
    ).first()
    
    if not teller_float:
        logger.warning(f"No open float found for staff {staff_id} on {today}")
        return
    
    logger.info(f"Found float {teller_float.id}, current_balance={teller_float.current_balance}")
    
    current_balance = Decimal(str(teller_float.current_balance or 0))
    
    if transaction_type == "deposit":
        new_balance = current_balance + amount
        teller_float.current_balance = new_balance
        teller_float.deposits_in = Decimal(str(teller_float.deposits_in or 0)) + amount
    elif transaction_type == "withdrawal":
        new_balance = current_balance - amount
        teller_float.current_balance = new_balance
        teller_float.withdrawals_out = Decimal(str(teller_float.withdrawals_out or 0)) + amount
    else:
        return
    
    float_txn = FloatTransaction(
        teller_float_id=teller_float.id,
        transaction_type=f"member_{transaction_type}",
        amount=amount,
        balance_after=new_balance,
        description=f"Member {transaction_type}",
        performed_by_id=staff_id,
        status="completed"
    )
    tenant_session.add(float_txn)

router = APIRouter()

def get_org_setting(tenant_session, key: str, default=None):
    """Get organization setting value"""
    setting = tenant_session.query(OrganizationSettings).filter(
        OrganizationSettings.setting_key == key
    ).first()
    if setting:
        if setting.setting_type == "boolean":
            return setting.setting_value.lower() == "true"
        elif setting.setting_type == "number":
            return Decimal(setting.setting_value) if setting.setting_value else default
        return setting.setting_value
    return default

@router.get("/{org_id}/transactions")
async def list_transactions(org_id: str, member_id: str = None, account_type: str = None, today: bool = False, teller_id: str = None, branch_id: str = None, start_date: str = None, end_date: str = None, page: int = 1, page_size: int = 20, user=Depends(get_current_user), db: Session = Depends(get_db)):
    from routes.common import get_branch_filter
    from datetime import datetime, date as date_type
    from sqlalchemy import func as sqlfunc
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(Transaction)
        
        staff_branch_id = get_branch_filter(user)
        
        if staff_branch_id:
            branch_member_ids = [m.id for m in tenant_session.query(Member).filter(Member.branch_id == staff_branch_id).all()]
            query = query.filter(Transaction.member_id.in_(branch_member_ids))
        elif branch_id:
            branch_member_ids = [m.id for m in tenant_session.query(Member).filter(Member.branch_id == branch_id).all()]
            query = query.filter(Transaction.member_id.in_(branch_member_ids))
        
        if member_id:
            query = query.filter(Transaction.member_id == member_id)
        if account_type:
            query = query.filter(Transaction.account_type == account_type)
        
        if start_date:
            try:
                sd = date_type.fromisoformat(start_date)
                query = query.filter(sqlfunc.date(Transaction.created_at) >= sd)
            except ValueError:
                pass
        if end_date:
            try:
                ed = date_type.fromisoformat(end_date)
                query = query.filter(sqlfunc.date(Transaction.created_at) <= ed)
            except ValueError:
                pass
        
        if today:
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(Transaction.created_at >= today_start)
            
            if teller_id:
                query = query.filter(Transaction.processed_by_id == teller_id)
        elif teller_id:
            query = query.filter(Transaction.processed_by_id == teller_id)
        
        total = query.count()
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        total_pages = max(1, (total + page_size - 1) // page_size)
        offset = (page - 1) * page_size
        
        transactions = query.order_by(Transaction.created_at.desc()).offset(offset).limit(page_size).all()
        return {
            "items": [TransactionResponse.model_validate(t) for t in transactions],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/transactions")
async def create_transaction(org_id: str, data: TransactionCreate, request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == data.member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        if data.account_type not in ["savings", "shares", "deposits"]:
            raise HTTPException(status_code=400, detail="Invalid account type")
        
        if data.transaction_type not in ["deposit", "withdrawal", "transfer", "fee", "interest"]:
            raise HTTPException(status_code=400, detail="Invalid transaction type")
        
        if data.payment_method == "mpesa" and data.transaction_type == "deposit":
            from services.feature_flags import check_org_feature
            has_mpesa = check_org_feature(org_id, "mpesa_integration", db)
            if not has_mpesa:
                raise HTTPException(status_code=403, detail="M-Pesa integration is not available in your subscription plan")
            
            mpesa_enabled = get_org_setting(tenant_session, "mpesa_enabled", False)
            if not mpesa_enabled:
                raise HTTPException(status_code=400, detail="M-Pesa is not enabled. Go to Settings > M-Pesa to enable it.")
            
            phone = member.phone
            if not phone:
                raise HTTPException(status_code=400, detail="Member does not have a phone number for M-Pesa")
            
            gateway = get_org_setting(tenant_session, "mpesa_gateway", "daraja")
            account_ref = member.member_number or f"DEP-{member.id[:8]}"
            description = f"Deposit to {data.account_type} for {member.first_name} {member.last_name}"
            request_base = str(request.base_url).rstrip("/")
            
            try:
                if gateway == "sunpay":
                    from services.sunpay import stk_push as sunpay_stk_push
                    callback_url = f"{request_base}/api/webhooks/sunpay/{org_id}"
                    result = await sunpay_stk_push(tenant_session, phone, data.amount, account_ref, callback_url)
                    success = isinstance(result, dict) and (result.get("success") or result.get("ResponseCode") == "0")
                    message = result.get("message", "STK Push sent") if isinstance(result, dict) else "STK Push sent"
                else:
                    from routes.mpesa import initiate_stk_push
                    result = initiate_stk_push(tenant_session, phone, data.amount, account_ref, description, org_id=org_id, base_url_override=request_base)
                    success = result.get("ResponseCode") == "0"
                    message = "STK Push sent successfully. Please check member's phone to complete payment."
                
                if success:
                    return {
                        "stk_push": True,
                        "success": True,
                        "message": message,
                        "checkout_request_id": result.get("CheckoutRequestID", ""),
                    }
                else:
                    error_msg = result.get("ResponseDescription") or result.get("errorMessage") or result.get("message", "STK Push failed")
                    raise HTTPException(status_code=400, detail=f"M-Pesa STK Push failed: {error_msg}")
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"M-Pesa STK Push error: {str(e)}")
        
        if member.status == "suspended":
            raise HTTPException(status_code=400, detail="Member account is suspended")
        
        if member.status != "active" and data.transaction_type == "withdrawal":
            raise HTTPException(status_code=400, detail="Cannot withdraw from inactive account. Activate account first.")
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        processed_by_id = staff.id if staff else None
        
        from services.feature_flags import check_org_feature
        has_teller_station = check_org_feature(org_id, "teller_station", db)
        
        teller_for_float = processed_by_id
        if has_teller_station and data.teller_id:
            teller_staff = tenant_session.query(Staff).filter(Staff.id == data.teller_id).first()
            if not teller_staff:
                raise HTTPException(status_code=400, detail="Selected teller not found")
            teller_for_float = data.teller_id
        elif not has_teller_station:
            teller_for_float = None
        
        if has_teller_station:
            if data.transaction_type in ["deposit", "withdrawal"]:
                if not teller_for_float:
                    raise HTTPException(status_code=400, detail="Transactions require a teller with an active float")
                
                today = date.today()
                teller_float = tenant_session.query(TellerFloat).filter(
                    and_(
                        TellerFloat.staff_id == teller_for_float,
                        TellerFloat.date == today,
                        TellerFloat.status == "open"
                    )
                ).first()
                
                if not teller_float:
                    raise HTTPException(status_code=400, detail="Your teller station is closed for the day. You cannot process transactions until a new float is allocated.")
                
                if data.transaction_type == "withdrawal" and data.payment_method == "cash":
                    current_float_balance = Decimal(str(teller_float.current_balance or 0))
                    if data.amount > current_float_balance:
                        raise HTTPException(status_code=400, detail=f"Insufficient cash float balance. Available: {float(current_float_balance)}, Required: {float(data.amount)}")
        
        balance_field = f"{data.account_type}_balance"
        current_balance = getattr(member, balance_field) or Decimal("0")
        
        if data.transaction_type == "withdrawal" and current_balance < data.amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        if data.transaction_type in ["deposit", "interest"]:
            new_balance = current_balance + data.amount
        else:
            new_balance = current_balance - data.amount
        
        code = generate_txn_code()
        
        effective_processor_id = teller_for_float if teller_for_float else processed_by_id
        
        transaction = Transaction(
            transaction_number=code,
            member_id=data.member_id,
            transaction_type=data.transaction_type,
            account_type=data.account_type,
            amount=data.amount,
            balance_before=current_balance,
            balance_after=new_balance,
            payment_method=data.payment_method,
            reference=data.reference,
            description=data.description,
            processed_by_id=effective_processor_id
        )
        
        setattr(member, balance_field, new_balance)
        
        member_activated = False
        if member.status == "pending" and data.transaction_type == "deposit":
            auto_activate = get_org_setting(tenant_session, "auto_activate_on_deposit", True)
            require_opening_deposit = get_org_setting(tenant_session, "require_opening_deposit", False)
            min_opening_deposit = get_org_setting(tenant_session, "minimum_opening_deposit", Decimal("0"))
            
            if auto_activate:
                total_deposits = (member.savings_balance or Decimal("0")) + \
                               (member.shares_balance or Decimal("0")) + \
                               (member.deposits_balance or Decimal("0"))
                
                if not require_opening_deposit or total_deposits >= min_opening_deposit:
                    member.status = "active"
                    member_activated = True
        
        tenant_session.add(transaction)
        
        if has_teller_station and teller_for_float and data.payment_method == "cash":
            update_teller_float(
                tenant_session, 
                teller_for_float, 
                data.transaction_type, 
                data.amount, 
                data.payment_method
            )
        
        # Get new balance for audit
        new_balance = Decimal("0")
        if data.account_type == "savings":
            new_balance = member.savings_balance or Decimal("0")
        elif data.account_type == "shares":
            new_balance = member.shares_balance or Decimal("0")
        elif data.account_type == "deposits":
            new_balance = member.deposits_balance or Decimal("0")
        
        # Create audit log - record both effective processor and admin if applicable
        audit_values = {
            "member_id": data.member_id,
            "member_name": f"{member.first_name} {member.last_name}",
            "member_number": member.member_number,
            "amount": float(data.amount),
            "account_type": data.account_type,
            "transaction_type": data.transaction_type,
            "payment_method": data.payment_method,
            "transaction_code": code,
            "new_balance": float(new_balance),
            "processed_by": effective_processor_id
        }
        if data.teller_id and processed_by_id != effective_processor_id:
            audit_values["initiated_by_admin"] = processed_by_id
            audit_values["operating_as_teller"] = data.teller_id
        
        create_audit_log(
            tenant_session,
            staff_id=effective_processor_id,
            action=f"{data.transaction_type}_{data.account_type}",
            entity_type="transaction",
            entity_id=str(transaction.id) if transaction.id else code,
            new_values=audit_values
        )
        
        tenant_session.commit()
        tenant_session.refresh(transaction)
        
        # Post to General Ledger
        if data.transaction_type in ["deposit", "withdrawal"]:
            post_transaction_to_gl(tenant_session, transaction, member, staff_id=effective_processor_id)
        
        # Send SMS notification for deposit/withdrawal
        if member.phone and data.transaction_type in ["deposit", "withdrawal"]:
            currency_setting = tenant_session.query(OrganizationSettings).filter(
                OrganizationSettings.setting_key == "currency"
            ).first()
            currency = currency_setting.setting_value if currency_setting else "KES"
            sms_template = "deposit_received" if data.transaction_type == "deposit" else "withdrawal_processed"
            try_send_sms(
                tenant_session,
                sms_template,
                member.phone,
                f"{member.first_name} {member.last_name}",
                {
                    "name": member.first_name,
                    "amount": str(data.amount),
                    "balance": str(new_balance),
                    "currency": currency
                },
                member_id=member.id
            )
        
        result = TransactionResponse.model_validate(transaction)
        return {
            **result.model_dump(),
            "member_activated": member_activated,
            "member_status": member.status
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/transactions/{transaction_id}")
async def get_transaction(org_id: str, transaction_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        transaction = tenant_session.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return TransactionResponse.model_validate(transaction)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/members/{member_id}/statement")
async def get_member_statement(org_id: str, member_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        transactions = tenant_session.query(Transaction).filter(
            Transaction.member_id == member_id
        ).order_by(Transaction.created_at.desc()).all()
        
        return {
            "member": {
                "id": member.id,
                "member_number": member.member_number,
                "name": f"{member.first_name} {member.last_name}",
                "savings_balance": float(member.savings_balance or 0),
                "shares_balance": float(member.shares_balance or 0),
                "deposits_balance": float(member.deposits_balance or 0)
            },
            "transactions": [TransactionResponse.model_validate(t) for t in transactions]
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/{org_id}/members/{member_id}/statement/pdf")
async def get_member_statement_pdf(
    org_id: str,
    member_id: str,
    account_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

        query = tenant_session.query(Transaction).filter(Transaction.member_id == member_id)
        if account_type and account_type != "all":
            query = query.filter(Transaction.account_type == account_type)
        if start_date:
            query = query.filter(Transaction.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
        if end_date:
            query = query.filter(Transaction.created_at <= datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S"))

        transactions = query.order_by(Transaction.created_at.desc()).all()

        currency_setting = tenant_session.query(OrganizationSettings).filter(
            OrganizationSettings.setting_key == "currency_symbol"
        ).first()
        symbol = currency_setting.setting_value if currency_setting else "KES"

        org_name_setting = tenant_session.query(OrganizationSettings).filter(
            OrganizationSettings.setting_key == "organization_name"
        ).first()
        org_name = org_name_setting.setting_value if org_name_setting else "BANKY"

        pdf_buffer = generate_statement_pdf(member, transactions, symbol, org_name, account_type, start_date, end_date)

        filename = f"statement_{member.member_number}_{datetime.now().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    finally:
        tenant_session.close()
        tenant_ctx.close()


def generate_statement_pdf(member, transactions, symbol, org_name, account_type=None, start_date=None, end_date=None):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=15*mm, bottomMargin=15*mm, leftMargin=15*mm, rightMargin=15*mm)
    styles = getSampleStyleSheet()
    elements = []

    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=18, spaceAfter=2, textColor=colors.HexColor('#1e3a5f'))
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.grey)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=12, spaceAfter=6, textColor=colors.HexColor('#1e3a5f'))
    normal_style = ParagraphStyle('NormalCustom', parent=styles['Normal'], fontSize=9)
    small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, textColor=colors.grey)
    right_style = ParagraphStyle('Right', parent=styles['Normal'], fontSize=9, alignment=TA_RIGHT)

    elements.append(Paragraph(org_name.upper(), title_style))
    elements.append(Paragraph("Account Statement", subtitle_style))
    elements.append(Spacer(1, 4*mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1e3a5f')))
    elements.append(Spacer(1, 4*mm))

    member_name = f"{member.first_name} {member.last_name}"
    info_data = [
        [Paragraph(f"<b>Member:</b> {member_name}", normal_style),
         Paragraph(f"<b>Member No:</b> {member.member_number}", normal_style)],
        [Paragraph(f"<b>Phone:</b> {member.phone or 'N/A'}", normal_style),
         Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}", normal_style)],
    ]
    if account_type and account_type != "all":
        info_data.append([Paragraph(f"<b>Account:</b> {account_type.capitalize()}", normal_style), Paragraph("", normal_style)])
    if start_date or end_date:
        period = f"{start_date or 'Start'} to {end_date or 'Present'}"
        info_data.append([Paragraph(f"<b>Period:</b> {period}", normal_style), Paragraph("", normal_style)])

    info_table = Table(info_data, colWidths=[doc.width/2]*2)
    info_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 4*mm))

    elements.append(Paragraph("Transaction History", heading_style))
    elements.append(Spacer(1, 2*mm))

    tx_type_labels = {
        "deposit": "Deposit", "withdrawal": "Withdrawal", "transfer": "Transfer",
        "loan_disbursement": "Loan Disbursement", "loan_repayment": "Loan Repayment",
        "penalty_charge": "Late Penalty", "auto_deduction": "Auto Deduction",
        "interest_posting": "Interest", "dividend_payment": "Dividend",
        "share_purchase": "Share Purchase", "share_sale": "Share Sale",
        "fixed_deposit": "Fixed Deposit", "fd_withdrawal": "FD Withdrawal",
        "fd_interest": "FD Interest",
    }

    credit_types = {"deposit", "loan_disbursement", "dividend_payment", "fd_interest", "interest_posting"}

    header = [
        Paragraph("<b>Date</b>", small_style),
        Paragraph("<b>Tx No.</b>", small_style),
        Paragraph("<b>Type</b>", small_style),
        Paragraph("<b>Account</b>", small_style),
        Paragraph("<b>Debit</b>", ParagraphStyle('rh', parent=small_style, alignment=TA_RIGHT)),
        Paragraph("<b>Credit</b>", ParagraphStyle('rh', parent=small_style, alignment=TA_RIGHT)),
        Paragraph("<b>Balance</b>", ParagraphStyle('rh', parent=small_style, alignment=TA_RIGHT)),
        Paragraph("<b>Reference</b>", small_style),
    ]
    tx_data = [header]

    total_debit = 0
    total_credit = 0

    for tx in transactions:
        amt = float(tx.amount or 0)
        tx_type = tx.transaction_type or ""
        label = tx_type_labels.get(tx_type, tx_type.replace("_", " ").title())
        is_credit = tx_type in credit_types

        if is_credit:
            debit_str = ""
            credit_str = f"{symbol} {amt:,.2f}"
            total_credit += amt
        else:
            debit_str = f"{symbol} {amt:,.2f}"
            credit_str = ""
            total_debit += amt

        balance_after = float(tx.balance_after or 0)
        tx_date = tx.created_at.strftime("%d/%m/%Y") if tx.created_at else ""

        row = [
            Paragraph(tx_date, small_style),
            Paragraph(str(tx.transaction_number or ""), small_style),
            Paragraph(label, small_style),
            Paragraph((tx.account_type or "").capitalize(), small_style),
            Paragraph(debit_str, ParagraphStyle('rd', parent=small_style, alignment=TA_RIGHT)),
            Paragraph(credit_str, ParagraphStyle('rc', parent=small_style, alignment=TA_RIGHT)),
            Paragraph(f"{symbol} {balance_after:,.2f}", ParagraphStyle('rb', parent=small_style, alignment=TA_RIGHT)),
            Paragraph(str(tx.reference or ""), small_style),
        ]
        tx_data.append(row)

    totals_row = [
        Paragraph("", small_style),
        Paragraph("", small_style),
        Paragraph("", small_style),
        Paragraph("<b>Totals</b>", ParagraphStyle('tb', parent=small_style, alignment=TA_RIGHT)),
        Paragraph(f"<b>{symbol} {total_debit:,.2f}</b>", ParagraphStyle('td', parent=small_style, alignment=TA_RIGHT)),
        Paragraph(f"<b>{symbol} {total_credit:,.2f}</b>", ParagraphStyle('tc', parent=small_style, alignment=TA_RIGHT)),
        Paragraph("", small_style),
        Paragraph("", small_style),
    ]
    tx_data.append(totals_row)

    col_widths = [55, 70, 65, 45, 60, 60, 60, 55]
    total_w = sum(col_widths)
    scale = doc.width / total_w
    col_widths = [w * scale for w in col_widths]

    tx_table = Table(tx_data, colWidths=col_widths, repeatRows=1)
    tx_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTSIZE', (0,0), (-1,-1), 7),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('GRID', (0,0), (-1,-2), 0.25, colors.lightgrey),
        ('LINEABOVE', (0,-1), (-1,-1), 1, colors.HexColor('#1e3a5f')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f0f4f8')),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor('#fafafa')]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(tx_table)

    elements.append(Spacer(1, 8*mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    elements.append(Spacer(1, 2*mm))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=TA_CENTER)
    elements.append(Paragraph(f"Total Transactions: {len(transactions)}", footer_style))
    elements.append(Paragraph("This is a computer-generated statement and does not require a signature.", footer_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer
