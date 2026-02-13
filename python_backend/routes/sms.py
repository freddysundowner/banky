from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import httpx
import re
from models.database import get_db
from models.tenant import SMSNotification, SMSTemplate, Member, LoanApplication, Branch, OrganizationSettings, Transaction
from schemas.tenant import SMSNotificationCreate, SMSNotificationResponse, SMSTemplateCreate, SMSTemplateResponse, BulkSMSCreate
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from services.feature_flags import check_org_feature

router = APIRouter()

def get_sms_settings(tenant_session) -> dict:
    """Get SMS settings from organization settings"""
    settings = {}
    for key in ["sms_enabled", "sms_api_key", "sms_endpoint", "sms_sender_id"]:
        setting = tenant_session.query(OrganizationSettings).filter(
            OrganizationSettings.setting_key == key
        ).first()
        if setting:
            if key == "sms_enabled":
                settings[key] = setting.setting_value.lower() == "true"
            else:
                settings[key] = setting.setting_value
        else:
            settings[key] = "" if key != "sms_enabled" else False
    return settings

def send_sms(phone: str, message: str, tenant_session) -> dict:
    """Send SMS using organization's configured SMS provider"""
    settings = get_sms_settings(tenant_session)
    
    if not settings.get("sms_enabled"):
        print(f"[SMS] SMS disabled - would send to {phone}: {message}")
        return {"success": False, "error": "SMS notifications are disabled"}
    
    api_key = settings.get("sms_api_key", "")
    endpoint = settings.get("sms_endpoint", "")
    sender_id = settings.get("sms_sender_id", "")
    
    if not api_key or not endpoint:
        print(f"[SMS] Missing credentials - would send to {phone}: {message}")
        return {"success": False, "error": "SMS credentials not configured"}
    
    if not re.match(r'^\+?\d{10,15}$', phone.replace(" ", "")):
        return {"success": False, "error": "Invalid phone number format"}
    
    try:
        data = {
            "phone": phone,
            "sender_id": sender_id,
            "message": message,
            "api_key": api_key
        }
        
        with httpx.Client(timeout=30.0) as client:
            response = client.post(endpoint, json=data)
            result = response.json()
        
        if isinstance(result, list):
            result = result[0] if result else {}
        
        if response.status_code == 200 or (isinstance(result, dict) and result.get("status_desc") == "Success"):
            print(f"[SMS] Sent to {phone}: {message[:50]}...")
            return {"success": True}
        else:
            error_msg = result.get("status_desc", "Unknown error") if isinstance(result, dict) else str(result)
            print(f"[SMS] Failed to send to {phone}: {error_msg}")
            return {"success": False, "error": error_msg}
    except Exception as e:
        print(f"[SMS] Error sending to {phone}: {str(e)}")
        return {"success": False, "error": str(e)}

def process_template(template: str, context: dict) -> str:
    result = template
    for key, value in context.items():
        result = result.replace(f"{{{{{key}}}}}", str(value) if value else "")
    return result

@router.get("/{org_id}/sms")
async def list_sms_notifications(org_id: str, status: str = None, notification_type: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "sms:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(SMSNotification)
        if status:
            query = query.filter(SMSNotification.status == status)
        if notification_type:
            query = query.filter(SMSNotification.notification_type == notification_type)
        notifications = query.order_by(SMSNotification.created_at.desc()).limit(100).all()
        return [SMSNotificationResponse.model_validate(n) for n in notifications]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/sms")
async def send_sms_notification(org_id: str, data: SMSNotificationCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "sms:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        if not data.recipient_phone:
            raise HTTPException(status_code=400, detail="Recipient phone is required")
        
        notification = SMSNotification(
            notification_type=data.notification_type,
            recipient_phone=data.recipient_phone,
            recipient_name=data.recipient_name,
            member_id=data.member_id,
            loan_id=data.loan_id,
            message=data.message,
            status="pending"
        )
        
        tenant_session.add(notification)
        tenant_session.commit()
        
        try:
            result = send_sms(data.recipient_phone, data.message, tenant_session)
            if result.get("success"):
                notification.status = "sent"
                notification.sent_at = datetime.utcnow()
            else:
                notification.status = "failed"
                notification.error_message = result.get("error", "Failed to send SMS")
        except Exception as e:
            notification.status = "failed"
            notification.error_message = str(e)
        
        tenant_session.commit()
        tenant_session.refresh(notification)
        return SMSNotificationResponse.model_validate(notification)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/sms/bulk")
async def send_bulk_sms(org_id: str, data: BulkSMSCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_org_feature(org_id, "bulk_sms", db):
        raise HTTPException(status_code=403, detail="Bulk SMS is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "sms:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        if data.recipient_type == "all_members":
            query = tenant_session.query(Member).filter(Member.is_active == True, Member.phone.isnot(None))
        elif data.recipient_type == "branch_members" and data.branch_id:
            query = tenant_session.query(Member).filter(
                Member.is_active == True, 
                Member.phone.isnot(None),
                Member.branch_id == data.branch_id
            )
        elif data.recipient_type in ["overdue_borrowers", "overdue_loans"]:
            query = tenant_session.query(Member).join(LoanApplication).filter(
                Member.is_active == True,
                Member.phone.isnot(None),
                LoanApplication.status == "disbursed",
                LoanApplication.outstanding_balance > 0
            ).distinct()
        elif data.recipient_type == "pending_payments":
            query = tenant_session.query(Member).join(LoanApplication).filter(
                Member.is_active == True,
                Member.phone.isnot(None),
                LoanApplication.status == "disbursed"
            ).distinct()
        elif data.recipient_type == "new_members":
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            query = tenant_session.query(Member).filter(
                Member.is_active == True,
                Member.phone.isnot(None),
                Member.created_at >= thirty_days_ago
            )
        elif data.recipient_type == "recent_deposits":
            seven_days_ago = datetime.utcnow() - timedelta(days=7)
            member_ids = tenant_session.query(Transaction.member_id).filter(
                Transaction.transaction_type == "deposit",
                Transaction.created_at >= seven_days_ago
            ).distinct().subquery()
            query = tenant_session.query(Member).filter(
                Member.is_active == True,
                Member.phone.isnot(None),
                Member.id.in_(member_ids)
            )
        elif data.recipient_type == "recent_withdrawals":
            seven_days_ago = datetime.utcnow() - timedelta(days=7)
            member_ids = tenant_session.query(Transaction.member_id).filter(
                Transaction.transaction_type == "withdrawal",
                Transaction.created_at >= seven_days_ago
            ).distinct().subquery()
            query = tenant_session.query(Member).filter(
                Member.is_active == True,
                Member.phone.isnot(None),
                Member.id.in_(member_ids)
            )
        else:
            raise HTTPException(status_code=400, detail=f"Invalid recipient type: {data.recipient_type}")
        
        members = query.all()
        sent_count = 0
        failed_count = 0
        
        for member in members:
            member_full_name = f"{member.first_name} {member.last_name}"
            message = process_template(data.message, {
                "name": member_full_name,
                "member_name": member_full_name,
                "member_number": member.member_number,
                "savings": str(member.savings_balance or 0),
                "shares": str(member.shares_balance or 0),
            })
            
            notification = SMSNotification(
                notification_type="bulk",
                recipient_phone=member.phone,
                recipient_name=f"{member.first_name} {member.last_name}",
                member_id=member.id,
                message=message,
                status="pending"
            )
            tenant_session.add(notification)
            
            try:
                result = send_sms(member.phone, message, tenant_session)
                if result.get("success"):
                    notification.status = "sent"
                    notification.sent_at = datetime.utcnow()
                    sent_count += 1
                else:
                    notification.status = "failed"
                    notification.error_message = result.get("error", "Failed to send")
                    failed_count += 1
            except Exception as e:
                notification.status = "failed"
                notification.error_message = str(e)
                failed_count += 1
        
        tenant_session.commit()
        
        return {
            "total_recipients": len(members),
            "sent_count": sent_count,
            "failed_count": failed_count
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/sms/templates")
async def list_sms_templates(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "sms:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        templates = tenant_session.query(SMSTemplate).filter(SMSTemplate.is_active == True).all()
        return [SMSTemplateResponse.model_validate(t) for t in templates]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/sms/templates")
async def create_sms_template(org_id: str, data: SMSTemplateCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "sms:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        template = SMSTemplate(
            name=data.name,
            template_type=data.template_type,
            message_template=data.message_template
        )
        
        tenant_session.add(template)
        tenant_session.commit()
        tenant_session.refresh(template)
        return SMSTemplateResponse.model_validate(template)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/sms/templates/{template_id}")
async def update_sms_template(org_id: str, template_id: str, data: SMSTemplateCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "sms:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        template = tenant_session.query(SMSTemplate).filter(SMSTemplate.id == template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        template.name = data.name
        template.template_type = data.template_type
        template.message_template = data.message_template
        
        tenant_session.commit()
        tenant_session.refresh(template)
        return SMSTemplateResponse.model_validate(template)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.delete("/{org_id}/sms/templates/{template_id}")
async def delete_sms_template(org_id: str, template_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "sms:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        template = tenant_session.query(SMSTemplate).filter(SMSTemplate.id == template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        template.is_active = False
        tenant_session.commit()
        return {"message": "Template deleted"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

DEFAULT_SMS_TEMPLATES = [
    {
        "name": "Loan Approved",
        "template_type": "loan_approved",
        "message_template": "Dear {{name}}, congratulations! Your loan application of {{currency}} {{amount}} has been approved. Disbursement will be processed shortly. Thank you for banking with us."
    },
    {
        "name": "Loan Disbursed",
        "template_type": "loan_disbursed",
        "message_template": "Dear {{name}}, your loan of {{currency}} {{amount}} has been disbursed to your account. Monthly repayment is {{currency}} {{monthly_repayment}} starting {{due_date}}. Thank you."
    },
    {
        "name": "Payment Reminder",
        "template_type": "payment_reminder",
        "message_template": "Dear {{name}}, your loan payment of {{currency}} {{amount}} is due on {{due_date}}. Please ensure timely payment. Thank you for banking with us."
    },
    {
        "name": "Overdue Notice",
        "template_type": "overdue_notice",
        "message_template": "Dear {{name}}, your loan payment of {{currency}} {{amount}} is overdue. Please make payment immediately to avoid penalties and interest accrual. Contact us for assistance."
    },
    {
        "name": "Repayment Received",
        "template_type": "repayment_received",
        "message_template": "Dear {{name}}, we have received your payment of {{currency}} {{amount}}. Your new loan balance is {{currency}} {{balance}}. Thank you for your timely payment."
    },
    {
        "name": "Deposit Received",
        "template_type": "deposit_received",
        "message_template": "Dear {{name}}, your deposit of {{currency}} {{amount}} has been received and credited to your account. Your new balance is {{currency}} {{balance}}. Thank you for saving with us."
    },
    {
        "name": "Withdrawal Processed",
        "template_type": "withdrawal_processed",
        "message_template": "Dear {{name}}, your withdrawal of {{currency}} {{amount}} has been processed successfully. Your new balance is {{currency}} {{balance}}. Thank you for banking with us."
    },
    {
        "name": "Welcome Message",
        "template_type": "welcome",
        "message_template": "Welcome to {{org_name}}, {{name}}! Your member number is {{member_number}}. We're excited to have you. For any assistance, please contact us."
    },
    {
        "name": "Loan Rejected",
        "template_type": "loan_rejected",
        "message_template": "Dear {{name}}, we regret to inform you that your loan application has not been approved at this time. Please contact us for more information."
    },
    {
        "name": "Account Statement",
        "template_type": "statement",
        "message_template": "Dear {{name}}, your account statement has been generated. Savings: {{currency}} {{savings}}, Shares: {{currency}} {{shares}}, Loan Balance: {{currency}} {{loan_balance}}. Thank you."
    }
]

@router.post("/{org_id}/sms/templates/seed-defaults")
async def seed_default_templates(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Create default SMS templates if they don't exist"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "sms:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        created = 0
        skipped = 0
        for tpl in DEFAULT_SMS_TEMPLATES:
            existing = tenant_session.query(SMSTemplate).filter(
                SMSTemplate.template_type == tpl["template_type"],
                SMSTemplate.is_active == True
            ).first()
            if not existing:
                template = SMSTemplate(
                    name=tpl["name"],
                    template_type=tpl["template_type"],
                    message_template=tpl["message_template"]
                )
                tenant_session.add(template)
                created += 1
            else:
                skipped += 1
        tenant_session.commit()
        return {"created": created, "skipped": skipped, "message": f"Created {created} templates, skipped {skipped} existing"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

def send_sms_with_template(tenant_session, template_type: str, recipient_phone: str, recipient_name: str, 
                           context: dict, member_id=None, loan_id=None, notification_type=None):
    """Helper function to send SMS using a template"""
    template = tenant_session.query(SMSTemplate).filter(
        SMSTemplate.template_type == template_type,
        SMSTemplate.is_active == True
    ).first()
    
    if template:
        if "currency" not in context:
            from models.tenant import OrganizationSettings
            currency_setting = tenant_session.query(OrganizationSettings).filter(
                OrganizationSettings.setting_key == "currency"
            ).first()
            context["currency"] = currency_setting.setting_value if currency_setting else "KES"
        message = process_template(template.message_template, context)
    else:
        return {"success": False, "error": f"Template {template_type} not found"}
    
    notification = SMSNotification(
        notification_type=notification_type or template_type,
        recipient_phone=recipient_phone,
        recipient_name=recipient_name,
        member_id=member_id,
        loan_id=loan_id,
        message=message,
        status="pending"
    )
    tenant_session.add(notification)
    
    result = send_sms(recipient_phone, message, tenant_session)
    if result.get("success"):
        notification.status = "sent"
        notification.sent_at = datetime.utcnow()
    else:
        notification.status = "failed"
        notification.error_message = result.get("error", "Failed to send")
    
    try:
        tenant_session.commit()
    except Exception as e:
        print(f"[SMS] Failed to save notification: {e}")
    
    return result

@router.post("/{org_id}/loans/{loan_id}/send-reminder")
async def send_payment_reminder(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "sms:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        member = tenant_session.query(Member).filter(Member.id == loan.member_id).first()
        if not member or not member.phone:
            raise HTTPException(status_code=400, detail="Member has no phone number")
        
        context = {
            "name": member.first_name,
            "amount": str(loan.monthly_repayment or 0),
            "due_date": str(loan.next_payment_date) if loan.next_payment_date else "N/A"
        }
        
        result = send_sms_with_template(
            tenant_session,
            "payment_reminder",
            member.phone,
            f"{member.first_name} {member.last_name}",
            context,
            member_id=member.id,
            loan_id=loan.id
        )
        
        tenant_session.commit()
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()
