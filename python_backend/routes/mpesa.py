from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from decimal import Decimal
from datetime import datetime
import httpx
import base64
import json
import os
import asyncio
import random
import string
from models.database import get_db
from models.tenant import Member, Transaction, OrganizationSettings, MpesaPayment, Staff, LoanApplication
from middleware.demo_guard import require_not_demo, is_demo_mode
from models.master import Organization
from services.tenant_context import TenantContext
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from services.feature_flags import check_org_feature
from services.mpesa_loan_service import apply_mpesa_payment_to_loan, find_loan_from_reference
from services.code_generator import generate_txn_code

SANDBOX_SHORTCODE = "174379"
SANDBOX_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
SANDBOX_BASE_URL = "https://sandbox.safaricom.co.ke"


def get_sandbox_consumer_credentials():
    """Return hardcoded sandbox consumer key/secret for demo mode."""
    key = "8PJZwnucqO2LHPJNS9vqFUAveA5znWGJbdvivQA9IReGIBnZ"
    secret = "gG5ZSVUtjmKjfTJAqV1tHa9h0qkJWCqSB7UJjGqLjQdHAOD1SAydF7W5Hju5jdwb"
    return key, secret

router = APIRouter()

def post_mpesa_deposit_to_gl(tenant_session, member, amount: Decimal, trans_id: str):
    """Post M-Pesa deposit to General Ledger"""
    try:
        from accounting.service import AccountingService, post_member_deposit
        
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        member_name = f"{member.first_name} {member.last_name}"
        
        post_member_deposit(
            svc,
            member_id=str(member.id),
            amount=amount,
            account_type="savings",
            payment_method="mpesa",
            transaction_id=trans_id,
            description=f"M-Pesa deposit - {member_name} - {trans_id}"
        )
        print(f"[GL] Posted M-Pesa deposit to GL: {trans_id}")
    except Exception as e:
        print(f"[GL] Failed to post M-Pesa deposit to GL: {e}")

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

@router.post("/mpesa/c2b/validation/{org_id}")
async def mpesa_validation(org_id: str, request: Request, db: Session = Depends(get_db)):
    """
    M-Pesa C2B Validation URL
    Called by Safaricom to validate a transaction before processing
    """
    try:
        data = await request.json()
        
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org or not org.connection_string:
            return {"ResultCode": "C2B00012", "ResultDesc": "Invalid organization"}
        
        tenant_ctx = TenantContext(org.connection_string)
        tenant_session = tenant_ctx.create_session()
        
        try:
            mpesa_enabled = get_org_setting(tenant_session, "mpesa_enabled", False)
            if not mpesa_enabled:
                return {"ResultCode": "C2B00012", "ResultDesc": "M-Pesa not enabled"}
            
            account_reference = data.get("BillRefNumber", "").strip().upper()
            
            member = tenant_session.query(Member).filter(
                func.upper(Member.member_number) == account_reference
            ).first()
            
            if not member:
                return {"ResultCode": "C2B00011", "ResultDesc": "Invalid account number"}
            
            if member.status == "suspended":
                return {"ResultCode": "C2B00012", "ResultDesc": "Account suspended"}
            
            return {"ResultCode": "0", "ResultDesc": "Accepted"}
        finally:
            tenant_session.close()
            tenant_ctx.close()
            
    except Exception as e:
        return {"ResultCode": "C2B00012", "ResultDesc": str(e)}

@router.post("/mpesa/c2b/confirmation/{org_id}")
async def mpesa_confirmation(org_id: str, request: Request, db: Session = Depends(get_db)):
    """
    M-Pesa C2B Confirmation URL
    Called by Safaricom after a successful transaction
    """
    try:
        data = await request.json()
        
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org or not org.connection_string:
            return {"ResultCode": "C2B00012", "ResultDesc": "Invalid organization"}
        
        tenant_ctx = TenantContext(org.connection_string)
        tenant_session = tenant_ctx.create_session()
        
        try:
            mpesa_enabled = get_org_setting(tenant_session, "mpesa_enabled", False)
            
            transaction_type = data.get("TransactionType", "")
            trans_id = data.get("TransID", "")
            trans_time = data.get("TransTime", "")
            amount = Decimal(str(data.get("TransAmount", 0)))
            account_reference = data.get("BillRefNumber", "").strip().upper()
            phone = data.get("MSISDN", "")
            first_name = data.get("FirstName", "")
            middle_name = data.get("MiddleName", "")
            last_name = data.get("LastName", "")
            org_balance = data.get("OrgAccountBalance")
            
            # Always log the M-Pesa payment first
            existing_mpesa = tenant_session.query(MpesaPayment).filter(
                MpesaPayment.trans_id == trans_id
            ).first()
            
            if existing_mpesa:
                return {"ResultCode": "0", "ResultDesc": "Duplicate transaction"}
            
            member = tenant_session.query(Member).filter(
                func.upper(Member.member_number) == account_reference
            ).first()
            
            loan_for_repayment = find_loan_from_reference(tenant_session, account_reference)
            if not member and loan_for_repayment:
                member = tenant_session.query(Member).filter(
                    Member.id == loan_for_repayment.member_id
                ).first()
            
            if not member and phone:
                member = tenant_session.query(Member).filter(
                    Member.phone_number.like(f"%{phone[-9:]}")
                ).first()
            
            mpesa_payment = MpesaPayment(
                trans_id=trans_id,
                trans_time=trans_time,
                amount=amount,
                phone_number=phone,
                bill_ref_number=data.get("BillRefNumber", ""),
                first_name=first_name,
                middle_name=middle_name,
                last_name=last_name,
                org_account_balance=Decimal(str(org_balance)) if org_balance else None,
                transaction_type=transaction_type,
                member_id=member.id if member else None,
                status="credited" if member and mpesa_enabled else ("unmatched" if not member else "pending"),
                raw_payload=data
            )
            tenant_session.add(mpesa_payment)
            
            if not mpesa_enabled:
                tenant_session.commit()
                return {"ResultCode": "0", "ResultDesc": "Accepted - M-Pesa disabled"}
            
            if not member:
                mpesa_payment.status = "unmatched"
                mpesa_payment.notes = f"No member found for account reference: {account_reference}"
                tenant_session.commit()
                return {"ResultCode": "0", "ResultDesc": "Accepted but member not found"}
            
            loan = loan_for_repayment or find_loan_from_reference(tenant_session, account_reference)

            if loan and loan.member_id == member.id:
                repayment, error = apply_mpesa_payment_to_loan(
                    tenant_session, loan, member, amount, trans_id, "Daraja"
                )
                if error:
                    mpesa_payment.notes = f"Loan repayment failed: {error}"
                    mpesa_payment.status = "pending"
                    tenant_session.commit()
                    return {"ResultCode": "0", "ResultDesc": f"Payment logged: {error}"}

                mpesa_payment.status = "credited"
                mpesa_payment.credited_at = datetime.utcnow()
                mpesa_payment.notes = f"Applied to loan {loan.application_number}"
                tenant_session.commit()
                return {"ResultCode": "0", "ResultDesc": "Accepted - loan repayment"}

            current_balance = member.savings_balance or Decimal("0")
            new_balance = current_balance + amount
            
            code = generate_txn_code()
            
            transaction = Transaction(
                transaction_number=code,
                member_id=member.id,
                transaction_type="deposit",
                account_type="savings",
                amount=amount,
                balance_before=current_balance,
                balance_after=new_balance,
                payment_method="mpesa",
                reference=trans_id,
                description=f"M-Pesa deposit from {phone} ({first_name})"
            )
            
            member.savings_balance = new_balance
            
            if member.status == "pending":
                auto_activate = get_org_setting(tenant_session, "auto_activate_on_deposit", True)
                require_opening_deposit = get_org_setting(tenant_session, "require_opening_deposit", False)
                min_opening_deposit = get_org_setting(tenant_session, "minimum_opening_deposit", Decimal("0"))
                
                if auto_activate:
                    total_deposits = (member.savings_balance or Decimal("0")) + \
                                   (member.shares_balance or Decimal("0")) + \
                                   (member.deposits_balance or Decimal("0"))
                    
                    if not require_opening_deposit or total_deposits >= min_opening_deposit:
                        member.status = "active"
            
            tenant_session.add(transaction)
            tenant_session.flush()
            
            mpesa_payment.transaction_id = transaction.id
            mpesa_payment.status = "credited"
            mpesa_payment.credited_at = datetime.utcnow()
            
            tenant_session.commit()
            
            post_mpesa_deposit_to_gl(tenant_session, member, amount, trans_id)
            
            try:
                from routes.sms import send_sms_with_template
                if member.phone:
                    send_sms_with_template(
                        tenant_session,
                        "deposit_received",
                        member.phone,
                        f"{member.first_name} {member.last_name}",
                        {
                            "name": member.first_name,
                            "amount": str(amount),
                            "balance": str(new_balance)
                        },
                        member_id=member.id
                    )
            except Exception as e:
                print(f"[SMS] Failed to send deposit notification: {e}")
            
            return {"ResultCode": "0", "ResultDesc": "Accepted"}
        finally:
            tenant_session.close()
            tenant_ctx.close()
            
    except Exception as e:
        return {"ResultCode": "0", "ResultDesc": str(e)}

@router.get("/mpesa/register-urls/{org_id}")
async def get_mpesa_urls(org_id: str, request: Request):
    """
    Returns the M-Pesa callback URLs to register with Safaricom
    """
    base_url = str(request.base_url).rstrip("/")
    
    return {
        "validation_url": f"{base_url}/api/mpesa/c2b/validation/{org_id}",
        "confirmation_url": f"{base_url}/api/mpesa/c2b/confirmation/{org_id}",
        "instructions": """
To register these URLs with Safaricom:
1. Go to Safaricom Daraja Portal (https://developer.safaricom.co.ke)
2. Navigate to your app > APIs > C2B
3. Register URLs using the provided validation and confirmation URLs
4. Set Response Type to 'Completed' for both URLs
        """
    }

@router.post("/mpesa/simulate/{org_id}")
async def simulate_mpesa_deposit(
    org_id: str,
    member_number: str,
    amount: float,
    phone: str = "254712345678",
    db: Session = Depends(get_db)
):
    """
    Simulate an M-Pesa C2B deposit (for testing in sandbox)
    """
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or not org.connection_string:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    tenant_ctx = TenantContext(org.connection_string)
    tenant_session = tenant_ctx.create_session()
    
    try:
        mpesa_enabled = get_org_setting(tenant_session, "mpesa_enabled", False)
        consumer_key = get_org_setting(tenant_session, "mpesa_consumer_key", "")
        consumer_secret = get_org_setting(tenant_session, "mpesa_consumer_secret", "")
        paybill = get_org_setting(tenant_session, "mpesa_paybill", "")
        environment = get_org_setting(tenant_session, "mpesa_environment", "sandbox")
        
        if not mpesa_enabled:
            raise HTTPException(status_code=400, detail="M-Pesa not enabled for this organization")
        
        if not consumer_key or not consumer_secret:
            raise HTTPException(status_code=400, detail="M-Pesa API credentials not configured")
        
        if environment == "sandbox":
            base_url = "https://sandbox.safaricom.co.ke"
        else:
            base_url = "https://api.safaricom.co.ke"
        
        auth_string = f"{consumer_key}:{consumer_secret}"
        auth_bytes = base64.b64encode(auth_string.encode()).decode()
        
        async with httpx.AsyncClient() as client:
            token_response = await client.get(
                f"{base_url}/oauth/v1/generate?grant_type=client_credentials",
                headers={"Authorization": f"Basic {auth_bytes}"}
            )
            
            if token_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get M-Pesa access token")
            
            access_token = token_response.json().get("access_token")
            
            simulate_response = await client.post(
                f"{base_url}/mpesa/c2b/v1/simulate",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "ShortCode": paybill,
                    "CommandID": "CustomerPayBillOnline",
                    "Amount": int(amount),
                    "Msisdn": phone,
                    "BillRefNumber": member_number
                }
            )
            
            return simulate_response.json()
    finally:
        tenant_session.close()
        tenant_ctx.close()

# M-Pesa Payment Log Endpoints
@router.get("/organizations/{org_id}/mpesa-payments")
async def list_mpesa_payments(
    org_id: str, 
    status: str = None,
    search: str = None,
    user=Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """List all M-Pesa payments with optional filtering"""
    if not check_org_feature(org_id, "mpesa_integration", db):
        raise HTTPException(status_code=403, detail="M-Pesa integration is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(MpesaPayment)
        
        if status:
            query = query.filter(MpesaPayment.status == status)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (MpesaPayment.trans_id.ilike(search_term)) |
                (MpesaPayment.phone_number.ilike(search_term)) |
                (MpesaPayment.bill_ref_number.ilike(search_term)) |
                (MpesaPayment.first_name.ilike(search_term)) |
                (MpesaPayment.last_name.ilike(search_term))
            )
        
        payments = query.order_by(desc(MpesaPayment.created_at)).limit(500).all()
        
        result = []
        for p in payments:
            member_name = None
            member_number = None
            if p.member_id:
                member = tenant_session.query(Member).filter(Member.id == p.member_id).first()
                if member:
                    member_name = f"{member.first_name} {member.last_name}"
                    member_number = member.member_number
            
            result.append({
                "id": p.id,
                "trans_id": p.trans_id,
                "trans_time": p.trans_time,
                "amount": float(p.amount) if p.amount else 0,
                "phone_number": p.phone_number,
                "bill_ref_number": p.bill_ref_number,
                "sender_name": f"{p.first_name or ''} {p.middle_name or ''} {p.last_name or ''}".strip(),
                "member_id": p.member_id,
                "member_name": member_name,
                "member_number": member_number,
                "status": p.status,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None
            })
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/organizations/{org_id}/mpesa-payments/{payment_id}/credit")
async def credit_mpesa_payment(
    org_id: str,
    payment_id: str,
    member_id: str,
    account_type: str = "savings",
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually credit an unmatched M-Pesa payment to a member"""
    if not check_org_feature(org_id, "mpesa_integration", db):
        raise HTTPException(status_code=403, detail="M-Pesa integration is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        payment = tenant_session.query(MpesaPayment).filter(MpesaPayment.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="M-Pesa payment not found")
        
        if payment.status == "credited":
            raise HTTPException(status_code=400, detail="Payment already credited")
        
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        # Create transaction
        balance_field = f"{account_type}_balance"
        current_balance = getattr(member, balance_field) or Decimal("0")
        new_balance = current_balance + payment.amount
        
        code = generate_txn_code()
        
        transaction = Transaction(
            transaction_number=code,
            member_id=member.id,
            transaction_type="deposit",
            account_type=account_type,
            amount=payment.amount,
            balance_before=current_balance,
            balance_after=new_balance,
            payment_method="mpesa",
            reference=payment.trans_id,
            description=f"M-Pesa deposit (manual credit) from {payment.phone_number}",
            processed_by_id=staff.id if staff else None
        )
        
        setattr(member, balance_field, new_balance)
        tenant_session.add(transaction)
        tenant_session.flush()
        
        # Update payment record
        payment.member_id = member.id
        payment.status = "credited"
        payment.transaction_id = transaction.id
        payment.credited_by_id = staff.id if staff else None
        payment.credited_at = datetime.utcnow()
        
        tenant_session.commit()
        
        return {"success": True, "message": "Payment credited successfully", "transaction_id": transaction.id}
    finally:
        tenant_session.close()
        tenant_ctx.close()

def get_mpesa_access_token(tenant_session) -> str:
    """Get M-Pesa OAuth access token. In demo mode, uses platform sandbox credentials."""
    if is_demo_mode():
        consumer_key, consumer_secret = get_sandbox_consumer_credentials()
        if not consumer_key or not consumer_secret:
            raise HTTPException(status_code=400, detail="Sandbox M-Pesa credentials not configured (set MPESA_SANDBOX_CONSUMER_KEY and MPESA_SANDBOX_CONSUMER_SECRET)")
        base_url = SANDBOX_BASE_URL
    else:
        consumer_key = get_org_setting(tenant_session, "mpesa_consumer_key", "")
        consumer_secret = get_org_setting(tenant_session, "mpesa_consumer_secret", "")
        if not consumer_key or not consumer_secret:
            raise HTTPException(status_code=400, detail="M-Pesa credentials not configured")
        environment = get_org_setting(tenant_session, "mpesa_environment", "sandbox")
        base_url = "https://api.safaricom.co.ke" if environment == "production" else "https://sandbox.safaricom.co.ke"

    credentials = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()

    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            f"{base_url}/oauth/v1/generate?grant_type=client_credentials",
            headers={"Authorization": f"Basic {credentials}"}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get M-Pesa access token")
        return response.json().get("access_token")

def initiate_b2c_disbursement(tenant_session, phone: str, amount: Decimal, remarks: str = "", occasion: str = "") -> dict:
    """Initiate M-Pesa B2C payment for loan disbursement via Daraja"""
    access_token = get_mpesa_access_token(tenant_session)

    shortcode = get_org_setting(tenant_session, "mpesa_paybill", "") or get_org_setting(tenant_session, "mpesa_shortcode", "")
    initiator_name = get_org_setting(tenant_session, "mpesa_initiator_name", "")
    security_credential = get_org_setting(tenant_session, "mpesa_security_credential", "")

    if not shortcode:
        return {"success": False, "error": "M-Pesa shortcode/paybill not configured"}

    environment = get_org_setting(tenant_session, "mpesa_environment", "sandbox")
    base_url = "https://api.safaricom.co.ke" if environment == "production" else "https://sandbox.safaricom.co.ke"

    payload = {
        "InitiatorName": initiator_name or "testapi",
        "SecurityCredential": security_credential or "",
        "CommandID": "BusinessPayment",
        "Amount": int(amount),
        "PartyA": shortcode,
        "PartyB": phone,
        "Remarks": remarks or "Payment",
        "QueueTimeOutURL": "",
        "ResultURL": "",
        "Occasion": occasion or ""
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{base_url}/mpesa/b2c/v3/paymentrequest",
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        result = response.json()
        if result.get("ResponseCode") == "0":
            return {"success": True, **result}
        return {"success": False, **result}


async def simulate_sandbox_callback(org_id: str, checkout_request_id: str, merchant_request_id: str, amount: float):
    """
    In sandbox/demo mode, auto-fire a successful STK callback after a short delay
    to mimic M-Pesa completing the payment — no real phone interaction needed.
    """
    await asyncio.sleep(4)
    receipt = "SB" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    payload = {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": merchant_request_id,
                "CheckoutRequestID": checkout_request_id,
                "ResultCode": 0,
                "ResultDesc": "The service request is processed successfully.",
                "CallbackMetadata": {
                    "Item": [
                        {"Name": "Amount", "Value": int(amount)},
                        {"Name": "MpesaReceiptNumber", "Value": receipt},
                        {"Name": "Balance"},
                        {"Name": "TransactionDate", "Value": int(datetime.now().strftime("%Y%m%d%H%M%S"))},
                        {"Name": "PhoneNumber", "Value": 254708374149}
                    ]
                }
            }
        }
    }
    public_domain = os.environ.get("REPLIT_DEV_DOMAIN", "") or os.environ.get("REPLIT_DOMAINS", "")
    callback_url = f"https://{public_domain}/api/mpesa/stk-callback/{org_id}"
    print(f"[Sandbox Simulation] Firing auto-callback to {callback_url} with receipt {receipt}")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(callback_url, json=payload)
            print(f"[Sandbox Simulation] Callback response: {response.status_code}")
        except Exception as e:
            print(f"[Sandbox Simulation] Error: {e}")


def initiate_stk_push(tenant_session, phone: str, amount: Decimal, account_reference: str, description: str, org_id: str = "", base_url_override: str = "") -> dict:
    """Initiate M-Pesa STK Push. In demo mode uses sandbox credentials automatically."""
    access_token = get_mpesa_access_token(tenant_session)

    if is_demo_mode():
        shortcode = SANDBOX_SHORTCODE
        passkey = SANDBOX_PASSKEY
        base_url = SANDBOX_BASE_URL
        public_domain = os.environ.get("REPLIT_DEV_DOMAIN", "") or os.environ.get("REPLIT_DOMAINS", "")
        if public_domain and org_id:
            callback_url = f"https://{public_domain}/api/mpesa/stk-callback/{org_id}"
        elif base_url_override and org_id:
            callback_url = f"{base_url_override.rstrip('/')}/api/mpesa/stk-callback/{org_id}"
        else:
            callback_url = ""
        print(f"[STK Push] Demo mode — using sandbox credentials, callback: {callback_url}")
    else:
        shortcode = get_org_setting(tenant_session, "mpesa_paybill", "") or get_org_setting(tenant_session, "mpesa_shortcode", "")
        passkey = get_org_setting(tenant_session, "mpesa_passkey", "")
        callback_url = get_org_setting(tenant_session, "mpesa_stk_callback_url", "")
        if not callback_url and org_id:
            public_domain = os.environ.get("REPLIT_DEV_DOMAIN", "") or os.environ.get("REPLIT_DOMAINS", "")
            if public_domain:
                callback_url = f"https://{public_domain}/api/mpesa/stk-callback/{org_id}"
            elif base_url_override:
                callback_url = f"{base_url_override.rstrip('/')}/api/mpesa/stk-callback/{org_id}"
        if not shortcode or not passkey:
            raise HTTPException(status_code=400, detail="M-Pesa STK Push not configured")
        environment = get_org_setting(tenant_session, "mpesa_environment", "sandbox")
        base_url = "https://api.safaricom.co.ke" if environment == "production" else "https://sandbox.safaricom.co.ke"

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()

    phone = phone.replace("+", "").replace(" ", "")
    if phone.startswith("0"):
        phone = "254" + phone[1:]

    if "sandbox" in base_url:
        phone = "254708374149"
        print(f"[STK Push] Sandbox mode — phone overridden to test number {phone}")

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": callback_url,
        "AccountReference": account_reference,
        "TransactionDesc": description
    }
    
    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{base_url}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        result = response.json()
        print(f"[STK Push] Response ({response.status_code}): {result}")
        return result


def query_stk_push_status(tenant_session, checkout_request_id: str) -> dict:
    """Query M-Pesa STK Push transaction status using Safaricom's Query API"""
    access_token = get_mpesa_access_token(tenant_session)
    
    shortcode = get_org_setting(tenant_session, "mpesa_paybill", "") or get_org_setting(tenant_session, "mpesa_shortcode", "")
    passkey = get_org_setting(tenant_session, "mpesa_passkey", "")
    
    if not shortcode or not passkey:
        return {"error": "M-Pesa STK Push not configured"}
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()
    
    environment = get_org_setting(tenant_session, "mpesa_environment", "sandbox")
    base_url = "https://api.safaricom.co.ke" if environment == "production" else "https://sandbox.safaricom.co.ke"
    
    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "CheckoutRequestID": checkout_request_id
    }
    
    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{base_url}/mpesa/stkpushquery/v1/query",
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        return response.json()


@router.post("/organizations/{org_id}/mpesa/stk-query")
async def check_stk_push_status(org_id: str, request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Query STK Push status and auto-credit member account if payment succeeded"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        data = await request.json()
        checkout_request_id = data.get("checkout_request_id", "")
        
        if not checkout_request_id:
            raise HTTPException(status_code=400, detail="Missing checkout_request_id")
        
        pending_record = tenant_session.query(MpesaPayment).filter(
            MpesaPayment.bill_ref_number == checkout_request_id
        ).first()
        
        if not pending_record:
            raise HTTPException(status_code=404, detail="No STK Push record found for this checkout request")
        
        if pending_record.status == "credited":
            return {"status": "already_credited", "message": "Payment already credited"}
        
        if pending_record.status in ("failed", "cancelled"):
            return {"status": pending_record.status, "message": f"Payment {pending_record.status}"}
        
        settings = tenant_session.query(OrganizationSettings).first()
        gateway = getattr(settings, "mpesa_gateway", "daraja") if settings else "daraja"
        
        if gateway == "sunpay":
            return {"status": "pending", "message": "SunPay payments are confirmed via webhook"}
        
        result = query_stk_push_status(tenant_session, checkout_request_id)
        print(f"[STK Query] Result for {checkout_request_id}: {result}")
        
        result_code = result.get("ResultCode")
        
        if result_code is None:
            error = result.get("errorMessage", result.get("errorCode", "Unknown error"))
            return {"status": "pending", "message": f"Query error: {error}"}
        
        result_code = str(result_code)
        
        if result_code == "1032":
            pending_record.status = "cancelled"
            pending_record.notes = (pending_record.notes or "") + " | Cancelled by user"
            tenant_session.commit()
            return {"status": "cancelled", "message": "Payment was cancelled by user"}
        
        if result_code == "1037":
            return {"status": "pending", "message": "Waiting for payment - phone may be unreachable, retrying..."}
        
        if result_code == "4999":
            return {"status": "pending", "message": "Payment is being processed by M-Pesa..."}
        
        if result_code != "0":
            pending_record.status = "failed"
            pending_record.notes = (pending_record.notes or "") + f" | {result.get('ResultDesc', 'Failed')}"
            tenant_session.commit()
            return {"status": "failed", "message": result.get("ResultDesc", "Payment failed")}
        
        amount = pending_record.amount
        member_id = pending_record.member_id
        notes_str = pending_record.notes or ""
        payment_type = "deposit"
        account_type = "savings"
        loan_id = None
        if "payment_type:loan_repayment" in notes_str:
            payment_type = "loan_repayment"
        if "loan_id:" in notes_str:
            loan_id = notes_str.split("loan_id:")[1].split("|")[0].strip()
        if "account_type:" in notes_str:
            account_type = notes_str.split("account_type:")[1].split("|")[0].strip()
        
        if not member_id:
            return {"status": "completed", "message": "Payment completed but no member linked"}
        
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            return {"status": "completed", "message": "Payment completed but member not found"}
        
        mpesa_receipt = result.get("MpesaReceiptNumber") or result.get("mpesaReceiptNumber") or ""
        ref = mpesa_receipt if mpesa_receipt else generate_txn_code()

        if payment_type == "loan_repayment" and loan_id:
            from services.mpesa_loan_service import apply_mpesa_payment_to_loan
            loan = tenant_session.query(LoanApplication).filter(
                LoanApplication.id == loan_id,
                LoanApplication.member_id == member.id,
                LoanApplication.status.in_(["disbursed", "active"])
            ).first()
            if loan:
                repayment, error = apply_mpesa_payment_to_loan(tenant_session, loan, member, amount, ref)
                if error:
                    print(f"[STK Query] Loan repayment error: {error}")
                    return {"status": "failed", "message": error}

                pending_record.status = "credited"
                pending_record.credited_at = datetime.utcnow()
                pending_record.raw_payload = result
                pending_record.first_name = "STK Push (Query Verified)"
                if mpesa_receipt:
                    pending_record.trans_id = mpesa_receipt

                tenant_session.commit()
                print(f"[STK Query] Loan repayment {amount} applied to loan {loan.application_number}")
                return {
                    "status": "credited",
                    "message": f"Loan repayment of {amount} applied to {loan.application_number}",
                    "outstanding_balance": str(loan.outstanding_balance or 0)
                }
            else:
                return {"status": "completed", "message": "Loan not found or not active"}

        if account_type == "savings":
            current_balance = member.savings_balance or Decimal("0")
        elif account_type == "shares":
            current_balance = member.shares_balance or Decimal("0")
        else:
            current_balance = member.savings_balance or Decimal("0")
        
        new_balance = current_balance + amount
        code = generate_txn_code()
        
        transaction = Transaction(
            transaction_number=code,
            member_id=member.id,
            transaction_type="deposit",
            account_type=account_type,
            amount=amount,
            balance_before=current_balance,
            balance_after=new_balance,
            payment_method="mpesa",
            reference=ref,
            description=f"M-Pesa STK Push deposit"
        )
        
        if account_type == "savings":
            member.savings_balance = new_balance
        elif account_type == "shares":
            member.shares_balance = new_balance
        
        tenant_session.add(transaction)
        tenant_session.flush()
        
        pending_record.status = "credited"
        pending_record.transaction_id = transaction.id
        pending_record.credited_at = datetime.utcnow()
        pending_record.raw_payload = result
        pending_record.first_name = "STK Push (Query Verified)"
        if mpesa_receipt:
            pending_record.trans_id = mpesa_receipt
        
        post_mpesa_deposit_to_gl(tenant_session, member, amount, ref)
        
        tenant_session.commit()
        print(f"[STK Query] Credited {amount} to member {member.member_number} ({account_type})")
        
        return {
            "status": "credited",
            "message": f"Payment of {amount} credited to {account_type} account",
            "transaction_number": code,
            "new_balance": str(new_balance)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[STK Query] Error: {e}")
        tenant_session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/organizations/{org_id}/mpesa/stk-push")
async def trigger_stk_push(org_id: str, request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Trigger M-Pesa STK Push for payment"""
    if not check_org_feature(org_id, "mpesa_integration", db):
        raise HTTPException(status_code=403, detail="M-Pesa integration is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "repayments:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        data = await request.json()
        phone = data.get("phone")
        amount = Decimal(str(data.get("amount", 0)))
        account_reference = data.get("account_reference", "Payment")
        description = data.get("description", "Loan Repayment")
        loan_id = data.get("loan_id", "")
        
        if not phone:
            raise HTTPException(status_code=400, detail="Phone number is required")
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        if loan_id:
            loan = tenant_session.query(LoanApplication).filter(
                LoanApplication.id == loan_id,
                LoanApplication.status.in_(["disbursed", "active"])
            ).first()
            if loan:
                account_reference = f"LOAN:{loan_id}"
                description = f"Loan repayment for {loan.application_number}"
            else:
                raise HTTPException(status_code=404, detail="Active loan not found")
        
        demo = is_demo_mode()
        if not demo:
            mpesa_enabled = get_org_setting(tenant_session, "mpesa_enabled", False)
            if not mpesa_enabled:
                raise HTTPException(status_code=400, detail="M-Pesa is not enabled for this organization")

        gateway = "daraja" if demo else get_org_setting(tenant_session, "mpesa_gateway", "daraja")

        phone = phone.replace("+", "").replace(" ", "")
        if phone.startswith("0"):
            phone = "254" + phone[1:]

        if gateway == "sunpay":
            from services.sunpay import stk_push as sunpay_stk_push
            import os
            public_domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
            if public_domain:
                callback_url = f"https://{public_domain}/api/webhooks/sunpay/{org_id}"
            else:
                callback_url = f"{str(request.base_url).rstrip('/')}/api/webhooks/sunpay/{org_id}"
            result = await sunpay_stk_push(tenant_session, phone, amount, account_reference, callback_url)
            if isinstance(result, dict) and result.get("success") is not None:
                return result
            return {
                "success": True if not (isinstance(result, dict) and result.get("error")) else False,
                "message": result.get("message", "STK push sent successfully. Please check your phone.") if isinstance(result, dict) else "STK push sent",
                **(result if isinstance(result, dict) else {})
            }
        
        request_base = str(request.base_url).rstrip("/")
        result = initiate_stk_push(tenant_session, phone, amount, account_reference, description, org_id=org_id, base_url_override=request_base)
        
        if result.get("ResponseCode") == "0":
            checkout_id = result.get("CheckoutRequestID", "")
            merchant_id = result.get("MerchantRequestID", "")

            notes_parts = []
            if loan_id:
                notes_parts.append(f"payment_type:loan_repayment")
                notes_parts.append(f"loan_id:{loan_id}")
            else:
                notes_parts.append(f"payment_type:deposit")
                notes_parts.append(f"account_type:savings")

            member = None
            if phone:
                phone_search = phone[-9:] if len(phone) > 9 else phone
                member = tenant_session.query(Member).filter(
                    Member.phone.like(f"%{phone_search}")
                ).first()

            pending_payment = MpesaPayment(
                trans_id=f"PENDING-{checkout_id}",
                trans_time=datetime.now().strftime("%Y%m%d%H%M%S"),
                amount=amount,
                phone_number=phone,
                bill_ref_number=checkout_id,
                first_name="STK Push",
                transaction_type="STK",
                member_id=member.id if member else None,
                status="pending",
                notes=" | ".join(notes_parts),
            )
            tenant_session.add(pending_payment)
            tenant_session.commit()

            if demo:
                asyncio.create_task(simulate_sandbox_callback(
                    org_id,
                    checkout_id,
                    merchant_id,
                    float(amount)
                ))
            return {
                "success": True,
                "message": "STK push sent successfully. Please check your phone.",
                "checkout_request_id": checkout_id,
                "merchant_request_id": merchant_id
            }
        else:
            return {
                "success": False,
                "message": result.get("ResponseDescription", "Failed to initiate STK push"),
                "error_code": result.get("ResponseCode")
            }
    except HTTPException:
        raise
    except Exception as e:
        tenant_session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/mpesa/stk-callback/{org_id}")
async def mpesa_stk_callback(org_id: str, request: Request, db: Session = Depends(get_db)):
    """
    M-Pesa STK Push Callback URL
    Called by Safaricom after STK Push payment is completed or cancelled
    """
    try:
        data = await request.json()
        print(f"[STK Callback] Received for org {org_id}: {json.dumps(data, default=str)}")

        body = data.get("Body", {}).get("stkCallback", {})
        result_code = body.get("ResultCode")
        result_desc = body.get("ResultDesc", "")
        checkout_request_id = body.get("CheckoutRequestID", "")
        merchant_request_id = body.get("MerchantRequestID", "")

        if result_code != 0:
            print(f"[STK Callback] Payment failed/cancelled: {result_desc}")
            if checkout_request_id:
                org = db.query(Organization).filter(Organization.id == org_id).first()
                if org and org.connection_string:
                    tc = TenantContext(org.connection_string)
                    ts = tc.create_session()
                    try:
                        pr = ts.query(MpesaPayment).filter(
                            MpesaPayment.bill_ref_number == checkout_request_id,
                            MpesaPayment.status == "pending"
                        ).first()
                        if pr:
                            pr.status = "cancelled" if result_code == 1032 else "failed"
                            pr.notes = (pr.notes or "") + f" | Callback: {result_desc}"
                            ts.commit()
                    finally:
                        ts.close()
                        tc.close()
            return {"ResultCode": 0, "ResultDesc": "Accepted"}

        metadata = body.get("CallbackMetadata", {}).get("Item", [])
        amount = None
        mpesa_receipt = None
        phone = None
        for item in metadata:
            name = item.get("Name", "")
            value = item.get("Value")
            if name == "Amount":
                amount = Decimal(str(value))
            elif name == "MpesaReceiptNumber":
                mpesa_receipt = str(value)
            elif name == "PhoneNumber":
                phone = str(value)

        if not amount or not mpesa_receipt:
            print(f"[STK Callback] Missing amount or receipt in metadata")
            return {"ResultCode": 0, "ResultDesc": "Accepted"}

        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org or not org.connection_string:
            print(f"[STK Callback] Organization not found: {org_id}")
            return {"ResultCode": 0, "ResultDesc": "Accepted"}

        tenant_ctx = TenantContext(org.connection_string)
        tenant_session = tenant_ctx.create_session()

        try:
            existing = tenant_session.query(MpesaPayment).filter(
                MpesaPayment.trans_id == mpesa_receipt
            ).first()
            if existing:
                print(f"[STK Callback] Duplicate receipt: {mpesa_receipt}")
                return {"ResultCode": 0, "ResultDesc": "Accepted"}

            pending_record = tenant_session.query(MpesaPayment).filter(
                MpesaPayment.bill_ref_number == checkout_request_id,
                MpesaPayment.status == "credited"
            ).first()
            if pending_record:
                print(f"[STK Callback] Already credited via query for {checkout_request_id}")
                return {"ResultCode": 0, "ResultDesc": "Accepted"}

            member = None
            if phone:
                phone_search = phone[-9:] if len(phone) > 9 else phone
                member = tenant_session.query(Member).filter(
                    Member.phone.like(f"%{phone_search}")
                ).first()

            pending_stk = tenant_session.query(MpesaPayment).filter(
                MpesaPayment.bill_ref_number == checkout_request_id,
                MpesaPayment.status == "pending"
            ).first()

            if pending_stk:
                pending_stk.trans_id = mpesa_receipt
                pending_stk.amount = amount
                pending_stk.phone_number = phone or ""
                pending_stk.first_name = "STK Push (Callback)"
                pending_stk.raw_payload = data
                mpesa_payment = pending_stk
                member = tenant_session.query(Member).filter(Member.id == pending_stk.member_id).first() if pending_stk.member_id else None
                notes_str = pending_stk.notes or ""
                payment_type = "deposit"
                account_type = "savings"
                loan_id = None
                if "payment_type:loan_repayment" in notes_str:
                    payment_type = "loan_repayment"
                if "loan_id:" in notes_str:
                    loan_id = notes_str.split("loan_id:")[1].split("|")[0].strip()
                if "account_type:" in notes_str:
                    account_type = notes_str.split("account_type:")[1].split("|")[0].strip()
            else:
                mpesa_payment = MpesaPayment(
                    trans_id=mpesa_receipt,
                    trans_time=datetime.utcnow().strftime("%Y%m%d%H%M%S"),
                    amount=amount,
                    phone_number=phone or "",
                    bill_ref_number=checkout_request_id,
                    first_name="STK Push",
                    transaction_type="STK",
                    member_id=member.id if member else None,
                    status="credited" if member else "unmatched",
                    raw_payload=data
                )
                tenant_session.add(mpesa_payment)
                payment_type = "deposit"
                account_type = "savings"
                loan_id = None

            if not member and phone:
                phone_search = phone[-9:] if len(phone) > 9 else phone
                member = tenant_session.query(Member).filter(
                    Member.phone.like(f"%{phone_search}")
                ).first()

            if member and payment_type == "loan_repayment" and loan_id:
                from models.tenant import LoanApplication, LoanRepayment, LoanInstalment, LoanProduct, LoanDefault
                from routes.repayments import calculate_payment_allocation, post_repayment_to_gl
                loan = tenant_session.query(LoanApplication).filter(
                    LoanApplication.id == loan_id,
                    LoanApplication.member_id == member.id,
                ).first()

                if loan and loan.status in ("disbursed", "active"):
                    has_instalments = tenant_session.query(LoanInstalment).filter(
                        LoanInstalment.loan_id == str(loan.id)
                    ).count() > 0

                    overpayment = Decimal("0")
                    if has_instalments:
                        from services.instalment_service import allocate_payment_to_instalments
                        principal_amount, interest_amount, penalty_amount, insurance_amount, overpayment = allocate_payment_to_instalments(
                            tenant_session, loan, amount
                        )
                    else:
                        principal_amount, interest_amount, penalty_amount = calculate_payment_allocation(loan, amount, tenant_session)
                        insurance_amount = Decimal("0")
                        outstanding = loan.outstanding_balance or Decimal("0")
                        total_allocated = principal_amount + interest_amount + penalty_amount
                        if total_allocated > outstanding and outstanding > 0:
                            overpayment = total_allocated - outstanding
                            principal_amount = principal_amount - overpayment

                    actual_loan_payment = amount - overpayment

                    repayment = LoanRepayment(
                        repayment_number=f"MPESA-{mpesa_receipt}",
                        loan_id=loan.id,
                        amount=amount,
                        principal_amount=principal_amount,
                        interest_amount=interest_amount,
                        penalty_amount=penalty_amount,
                        payment_method="mpesa",
                        reference=mpesa_receipt,
                        notes=f"M-Pesa STK Push loan repayment from {phone}",
                        payment_date=datetime.utcnow(),
                    )
                    tenant_session.add(repayment)

                    loan.amount_repaid = (loan.amount_repaid or Decimal("0")) + actual_loan_payment
                    loan.outstanding_balance = (loan.outstanding_balance or Decimal("0")) - actual_loan_payment
                    loan.last_payment_date = datetime.utcnow().date()

                    if has_instalments:
                        next_inst = tenant_session.query(LoanInstalment).filter(
                            LoanInstalment.loan_id == str(loan.id),
                            LoanInstalment.status.in_(["pending", "partial", "overdue"])
                        ).order_by(LoanInstalment.instalment_number).first()
                        if next_inst:
                            loan.next_payment_date = next_inst.due_date

                    if loan.outstanding_balance <= 0:
                        loan.status = "paid"
                        loan.closed_at = datetime.utcnow()
                        loan.outstanding_balance = Decimal("0")
                        tenant_session.query(LoanDefault).filter(
                            LoanDefault.loan_id == str(loan.id),
                            LoanDefault.status.in_(["overdue", "in_collection"])
                        ).update({"status": "resolved", "resolved_at": datetime.utcnow()}, synchronize_session="fetch")

                    txn_code = generate_txn_code()
                    transaction = Transaction(
                        transaction_number=txn_code,
                        member_id=member.id,
                        transaction_type="loan_repayment",
                        account_type="loan",
                        amount=actual_loan_payment,
                        payment_method="mpesa",
                        reference=mpesa_receipt,
                        description=f"M-Pesa loan repayment for {loan.application_number}"
                    )
                    tenant_session.add(transaction)

                    if overpayment > 0:
                        balance_before = member.savings_balance or Decimal("0")
                        member.savings_balance = balance_before + overpayment
                        overpay_txn = Transaction(
                            transaction_number=generate_txn_code(),
                            member_id=member.id,
                            transaction_type="deposit",
                            account_type="savings",
                            amount=overpayment,
                            balance_before=balance_before,
                            balance_after=member.savings_balance,
                            reference=mpesa_receipt,
                            description=f"Overpayment from loan {loan.application_number} credited to savings"
                        )
                        tenant_session.add(overpay_txn)

                    tenant_session.flush()

                    mpesa_payment.status = "credited"
                    mpesa_payment.member_id = member.id
                    mpesa_payment.credited_at = datetime.utcnow()

                    try:
                        post_repayment_to_gl(tenant_session, repayment, loan, member)
                    except Exception as gl_err:
                        print(f"[STK Callback] GL posting warning: {gl_err}")

                    print(f"[STK Callback] Loan repayment {amount} applied to loan {loan.application_number} for member {member.member_number} (P:{principal_amount} I:{interest_amount} Pen:{penalty_amount} Over:{overpayment})")
                else:
                    mpesa_payment.status = "unmatched"
                    mpesa_payment.notes = (mpesa_payment.notes or "") + f" | Loan {loan_id} not found or not active"
                    print(f"[STK Callback] Loan {loan_id} not found/active for member {member.member_number}")

            elif member:
                if account_type == "savings":
                    current_balance = member.savings_balance or Decimal("0")
                elif account_type == "shares":
                    current_balance = member.shares_balance or Decimal("0")
                else:
                    current_balance = member.savings_balance or Decimal("0")
                new_balance = current_balance + amount
                code = generate_txn_code()

                transaction = Transaction(
                    transaction_number=code,
                    member_id=member.id,
                    transaction_type="deposit",
                    account_type=account_type,
                    amount=amount,
                    balance_before=current_balance,
                    balance_after=new_balance,
                    payment_method="mpesa",
                    reference=mpesa_receipt,
                    description=f"M-Pesa STK Push deposit from {phone}"
                )
                if account_type == "savings":
                    member.savings_balance = new_balance
                elif account_type == "shares":
                    member.shares_balance = new_balance
                tenant_session.add(transaction)
                tenant_session.flush()

                mpesa_payment.status = "credited"
                mpesa_payment.member_id = member.id
                mpesa_payment.transaction_id = transaction.id
                mpesa_payment.credited_at = datetime.utcnow()

                post_mpesa_deposit_to_gl(tenant_session, member, amount, mpesa_receipt)

                print(f"[STK Callback] Credited {amount} to member {member.member_number} ({account_type})")
            else:
                mpesa_payment.status = "unmatched"
                mpesa_payment.notes = (mpesa_payment.notes or "") + f" | STK Push payment - no member matched for phone {phone}"
                print(f"[STK Callback] Unmatched payment from {phone}")

            tenant_session.commit()
            return {"ResultCode": 0, "ResultDesc": "Accepted"}
        finally:
            tenant_session.close()
            tenant_ctx.close()

    except Exception as e:
        print(f"[STK Callback] Error: {e}")
        return {"ResultCode": 0, "ResultDesc": "Accepted"}
