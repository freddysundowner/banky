from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timedelta
from models.database import get_db
from models.tenant import LoanApplication, LoanProduct, Member, LoanGuarantor, LoanExtraCharge, Transaction, Staff
from schemas.tenant import LoanApplicationCreate, LoanApplicationUpdate, LoanApplicationResponse, LoanApplicationAction, LoanDisbursement, LoanGuarantorCreate
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission, require_role
from services.code_generator import generate_txn_code

def try_send_sms(tenant_session, template_type: str, phone: str, name: str, context: dict, member_id=None, loan_id=None):
    """Try to send SMS, fail silently if SMS not configured"""
    try:
        from routes.sms import send_sms_with_template
        if phone:
            send_sms_with_template(tenant_session, template_type, phone, name, context, member_id=member_id, loan_id=loan_id)
    except Exception as e:
        print(f"[SMS] Failed to send {template_type}: {e}")

def post_disbursement_to_gl(tenant_session, loan, member, disbursement_method: str, interest_deducted_upfront: bool):
    """Post loan disbursement to the General Ledger"""
    try:
        from accounting.service import AccountingService, post_loan_disbursement
        
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        member_name = f"{member.first_name} {member.last_name}"
        
        print(f"[GL] Posting loan disbursement {loan.application_number}: amount={loan.amount}, net={loan.amount_disbursed}, interest_upfront={interest_deducted_upfront}")
        
        je = post_loan_disbursement(
            svc,
            member_id=str(member.id),
            loan_id=str(loan.id),
            principal_amount=loan.amount,
            net_disbursed=loan.amount_disbursed,
            interest_amount=loan.total_interest if interest_deducted_upfront else Decimal("0"),
            processing_fee=loan.processing_fee or Decimal("0"),
            insurance_fee=loan.insurance_fee or Decimal("0"),
            disbursement_method=disbursement_method,
            description=f"Loan disbursement - {member_name} - {loan.application_number}"
        )
        print(f"[GL] Posted disbursement to GL: {loan.application_number}, journal entry: {je.entry_number if je else 'None'}")
    except Exception as e:
        import traceback
        print(f"[GL] Failed to post disbursement {loan.application_number} to GL: {e}")
        traceback.print_exc()

router = APIRouter()

def calculate_loan(amount: Decimal, term: int, interest_rate: Decimal, interest_type: str = "reducing_balance", repayment_frequency: str = "monthly"):
    periodic_rate = interest_rate / Decimal("100")

    if interest_type == "flat":
        total_interest = amount * periodic_rate
        total_repayment = amount + total_interest
        periodic_payment = total_repayment / term if term > 0 else Decimal("0")
    else:
        if periodic_rate > 0:
            periodic_payment = amount * (periodic_rate * (1 + periodic_rate) ** term) / ((1 + periodic_rate) ** term - 1)
        else:
            periodic_payment = amount / term if term > 0 else Decimal("0")
        total_repayment = periodic_payment * term
        total_interest = total_repayment - amount

    return {
        "total_interest": round(total_interest, 2),
        "total_repayment": round(total_repayment, 2),
        "monthly_repayment": round(periodic_payment, 2)
    }

def generate_code(db: Session, prefix: str):
    count = db.query(func.count(LoanApplication.id)).scalar() or 0
    return f"{prefix}{count + 1:04d}"

@router.get("/{org_id}/loans")
async def list_loans(org_id: str, status: str = None, member_id: str = None, branch_id: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    from routes.common import get_branch_filter
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(LoanApplication)
        
        # Get branch filter based on user role
        staff_branch_id = get_branch_filter(user)
        
        # If staff has branch restriction, filter by member's branch
        if staff_branch_id:
            branch_member_ids = [m.id for m in tenant_session.query(Member).filter(Member.branch_id == staff_branch_id).all()]
            query = query.filter(LoanApplication.member_id.in_(branch_member_ids))
        elif branch_id:
            branch_member_ids = [m.id for m in tenant_session.query(Member).filter(Member.branch_id == branch_id).all()]
            query = query.filter(LoanApplication.member_id.in_(branch_member_ids))
        
        if status:
            query = query.filter(LoanApplication.status == status)
        if member_id:
            query = query.filter(LoanApplication.member_id == member_id)
        loans = query.order_by(LoanApplication.created_at.desc()).all()
        
        result = []
        for loan in loans:
            loan_dict = LoanApplicationResponse.model_validate(loan).model_dump()
            member = tenant_session.query(Member).filter(Member.id == loan.member_id).first()
            product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
            created_by = tenant_session.query(Staff).filter(Staff.id == loan.created_by_id).first() if loan.created_by_id else None
            reviewed_by = tenant_session.query(Staff).filter(Staff.id == loan.reviewed_by_id).first() if loan.reviewed_by_id else None
            
            loan_dict["member_name"] = f"{member.first_name} {member.last_name}" if member else ""
            loan_dict["member_first_name"] = member.first_name if member else ""
            loan_dict["member_last_name"] = member.last_name if member else ""
            loan_dict["product_name"] = product.name if product else ""
            loan_dict["created_by_name"] = f"{created_by.first_name} {created_by.last_name}" if created_by else None
            loan_dict["reviewed_by_name"] = f"{reviewed_by.first_name} {reviewed_by.last_name}" if reviewed_by else None
            result.append(loan_dict)
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/loans")
async def create_loan(org_id: str, data: LoanApplicationCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == data.member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        if not member.is_active:
            raise HTTPException(status_code=400, detail="Cannot apply for loan: Member is not active")
        
        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == data.loan_product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Loan product not found")
        
        # Shares-based eligibility checks (warning only - enforcement at disbursement)
        member_shares = Decimal(str(member.shares_balance or 0))
        shares_multiplier = Decimal(str(product.shares_multiplier or 0))
        min_shares_required = Decimal(str(product.min_shares_required or 0))
        
        eligibility_warning = None
        # Check minimum shares requirement (only if configured > 0)
        if min_shares_required > 0 and member_shares < min_shares_required:
            eligibility_warning = f"Warning: Member needs at least {min_shares_required:,.2f} in shares to qualify. Current shares: {member_shares:,.2f}. Disbursement will be blocked until this is met."
        # Check if loan amount exceeds shares-based limit (only if multiplier is configured > 0)
        elif shares_multiplier > 0:
            max_eligible_amount = member_shares * shares_multiplier
            if data.amount > max_eligible_amount:
                eligibility_warning = f"Warning: Loan amount exceeds eligible limit. Maximum ({member_shares:,.2f} × {shares_multiplier}x): {max_eligible_amount:,.2f}. Disbursement will be blocked until this is met."
        
        if data.amount < product.min_amount or data.amount > product.max_amount:
            raise HTTPException(status_code=400, detail=f"Amount must be between {product.min_amount} and {product.max_amount}")
        
        freq = getattr(product, 'repayment_frequency', 'monthly')
        period_labels = {"daily": "days", "weekly": "weeks", "bi_weekly": "bi-weeks", "monthly": "months"}
        period_label = period_labels.get(freq, "months")
        if data.term_months < product.min_term_months or data.term_months > product.max_term_months:
            raise HTTPException(status_code=400, detail=f"Term must be between {product.min_term_months} and {product.max_term_months} {period_label}")
        
        calc = calculate_loan(data.amount, data.term_months, product.interest_rate, product.interest_type, getattr(product, 'repayment_frequency', 'monthly'))
        
        processing_fee = data.amount * (product.processing_fee or Decimal("0")) / Decimal("100")
        insurance_fee = data.amount * (product.insurance_fee or Decimal("0")) / Decimal("100")
        
        code = generate_code(tenant_session, "LN")
        
        # Get current staff ID based on user email
        current_staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        loan = LoanApplication(
            application_number=code,
            member_id=data.member_id,
            loan_product_id=data.loan_product_id,
            amount=data.amount,
            term_months=data.term_months,
            interest_rate=product.interest_rate,
            total_interest=calc["total_interest"],
            total_repayment=calc["total_repayment"],
            monthly_repayment=calc["monthly_repayment"],
            processing_fee=processing_fee,
            insurance_fee=insurance_fee,
            purpose=data.purpose,
            disbursement_method=data.disbursement_method,
            disbursement_account=data.disbursement_account,
            disbursement_phone=data.disbursement_phone,
            status="pending",
            created_by_id=current_staff.id if current_staff else None
        )
        
        tenant_session.add(loan)
        tenant_session.commit()
        
        if data.guarantors and product.requires_guarantor:
            for g in data.guarantors:
                guarantor_member = tenant_session.query(Member).filter(Member.id == g.guarantor_id).first()
                if not guarantor_member:
                    continue
                
                guarantor = LoanGuarantor(
                    loan_id=loan.id,
                    guarantor_id=g.guarantor_id,
                    amount_guaranteed=g.amount_guaranteed,
                    status="pending"
                )
                tenant_session.add(guarantor)
            tenant_session.commit()

        if data.extra_charges:
            for ec in data.extra_charges:
                charge = LoanExtraCharge(
                    loan_id=loan.id,
                    charge_name=ec.charge_name,
                    amount=ec.amount
                )
                tenant_session.add(charge)
            tenant_session.commit()
        
        tenant_session.refresh(loan)
        response = LoanApplicationResponse.model_validate(loan).model_dump()
        if eligibility_warning:
            response["eligibility_warning"] = eligibility_warning
        return response
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/loans/{loan_id}")
async def get_loan(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        loan_dict = LoanApplicationResponse.model_validate(loan).model_dump()
        
        # Add member and product names
        member = tenant_session.query(Member).filter(Member.id == loan.member_id).first()
        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        created_by = tenant_session.query(Staff).filter(Staff.id == loan.created_by_id).first() if loan.created_by_id else None
        reviewed_by = tenant_session.query(Staff).filter(Staff.id == loan.reviewed_by_id).first() if loan.reviewed_by_id else None
        
        loan_dict["member_name"] = f"{member.first_name} {member.last_name}" if member else ""
        loan_dict["member_first_name"] = member.first_name if member else ""
        loan_dict["member_last_name"] = member.last_name if member else ""
        loan_dict["product_name"] = product.name if product else ""
        loan_dict["created_by_name"] = f"{created_by.first_name} {created_by.last_name}" if created_by else None
        loan_dict["reviewed_by_name"] = f"{reviewed_by.first_name} {reviewed_by.last_name}" if reviewed_by else None
        
        return loan_dict
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/loans/{loan_id}/action")
async def process_loan_action(org_id: str, loan_id: str, data: LoanApplicationAction, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "reviewer"])
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        # Get current staff for tracking who reviewed the loan
        current_staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        if data.action == "approve":
            if loan.status != "pending":
                raise HTTPException(status_code=400, detail="Loan is not pending")
            
            # Check guarantor requirements
            product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
            if product and product.requires_guarantor:
                accepted_guarantors = tenant_session.query(LoanGuarantor).filter(
                    LoanGuarantor.loan_id == loan.id,
                    LoanGuarantor.status == "accepted"
                ).count()
                if accepted_guarantors == 0:
                    raise HTTPException(
                        status_code=400, 
                        detail="This loan requires at least one accepted guarantor before approval. Please add and get guarantors to accept first."
                    )
            
            loan.status = "approved"
            loan.approved_at = datetime.utcnow()
            loan.reviewed_by_id = current_staff.id if current_staff else None
            
            # Send SMS notification for loan approval
            member = tenant_session.query(Member).filter(Member.id == loan.member_id).first()
            if member and member.phone:
                try_send_sms(
                    tenant_session, 
                    "loan_approved", 
                    member.phone, 
                    f"{member.first_name} {member.last_name}",
                    {"name": member.first_name, "amount": str(loan.amount)},
                    member_id=member.id,
                    loan_id=loan.id
                )
        
        elif data.action == "reject":
            if loan.status not in ["pending", "under_review"]:
                raise HTTPException(status_code=400, detail="Loan cannot be rejected in this status")
            loan.status = "rejected"
            loan.rejected_at = datetime.utcnow()
            loan.rejection_reason = data.reason
            loan.reviewed_by_id = current_staff.id if current_staff else None
            
            # Send SMS notification for loan rejection
            member = tenant_session.query(Member).filter(Member.id == loan.member_id).first()
            if member and member.phone:
                try_send_sms(
                    tenant_session, 
                    "loan_rejected", 
                    member.phone, 
                    f"{member.first_name} {member.last_name}",
                    {"name": member.first_name},
                    member_id=member.id,
                    loan_id=loan.id
                )
        
        elif data.action == "review":
            if loan.status != "pending":
                raise HTTPException(status_code=400, detail="Loan is not pending")
            loan.status = "under_review"
            loan.reviewed_by_id = current_staff.id if current_staff else None
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        tenant_session.commit()
        tenant_session.refresh(loan)
        
        # Return enriched response with staff names
        loan_dict = LoanApplicationResponse.model_validate(loan).model_dump()
        member = tenant_session.query(Member).filter(Member.id == loan.member_id).first()
        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        created_by = tenant_session.query(Staff).filter(Staff.id == loan.created_by_id).first() if loan.created_by_id else None
        reviewed_by = tenant_session.query(Staff).filter(Staff.id == loan.reviewed_by_id).first() if loan.reviewed_by_id else None
        
        loan_dict["member_name"] = f"{member.first_name} {member.last_name}" if member else ""
        loan_dict["member_first_name"] = member.first_name if member else ""
        loan_dict["member_last_name"] = member.last_name if member else ""
        loan_dict["product_name"] = product.name if product else ""
        loan_dict["created_by_name"] = f"{created_by.first_name} {created_by.last_name}" if created_by else None
        loan_dict["reviewed_by_name"] = f"{reviewed_by.first_name} {reviewed_by.last_name}" if reviewed_by else None
        
        return loan_dict
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/loans/{loan_id}/disburse")
async def disburse_loan(org_id: str, loan_id: str, data: LoanDisbursement, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin", "accountant"])
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        if loan.status != "approved":
            raise HTTPException(status_code=400, detail="Loan must be approved before disbursement")
        
        # Shares-based eligibility check - BLOCK disbursement if conditions not met
        member = tenant_session.query(Member).filter(Member.id == loan.member_id).first()
        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        
        if member and product:
            member_shares = Decimal(str(member.shares_balance or 0))
            shares_multiplier = Decimal(str(product.shares_multiplier or 0))
            min_shares_required = Decimal(str(product.min_shares_required or 0))
            
            # Check minimum shares requirement (only if configured > 0)
            if min_shares_required > 0 and member_shares < min_shares_required:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Cannot disburse: Member needs at least {min_shares_required:,.2f} in shares to qualify. Current shares: {member_shares:,.2f}"
                )
            
            # Check if loan amount exceeds shares-based limit (only if multiplier is configured > 0)
            if shares_multiplier > 0:
                max_eligible_amount = member_shares * shares_multiplier
                if loan.amount > max_eligible_amount:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot disburse: Loan amount exceeds eligible limit. Maximum ({member_shares:,.2f} × {shares_multiplier}x): {max_eligible_amount:,.2f}"
                    )
        
        if data.disbursement_method == "mpesa" and not data.disbursement_phone:
            raise HTTPException(status_code=400, detail="Phone number required for M-Pesa disbursement")
        
        if data.disbursement_method == "bank" and not data.disbursement_account:
            raise HTTPException(status_code=400, detail="Account number required for bank disbursement")
        
        net_amount = loan.amount - (loan.processing_fee or Decimal("0")) - (loan.insurance_fee or Decimal("0"))
        
        # Check if interest should be deducted upfront
        deduct_interest_upfront = getattr(product, 'deduct_interest_upfront', False) if product else False
        
        if deduct_interest_upfront:
            # Deduct interest from disbursement amount
            net_amount = net_amount - (loan.total_interest or Decimal("0"))
            # Outstanding balance is just the principal (interest already paid)
            outstanding_balance = loan.amount
            # Recalculate monthly repayment as principal only / term
            monthly_repayment = loan.amount / loan.term_months
        else:
            outstanding_balance = loan.total_repayment
            monthly_repayment = loan.monthly_repayment
        
        loan.disbursement_method = data.disbursement_method
        loan.disbursement_account = data.disbursement_account
        loan.disbursement_phone = data.disbursement_phone
        loan.amount_disbursed = net_amount
        loan.outstanding_balance = outstanding_balance
        loan.interest_deducted_upfront = deduct_interest_upfront
        loan.monthly_repayment = monthly_repayment
        loan.amount_repaid = Decimal("0")
        freq_days = {"daily": 1, "weekly": 7, "bi_weekly": 14, "monthly": 30}
        product_freq = getattr(product, 'repayment_frequency', 'monthly') if product else 'monthly'
        loan.next_payment_date = (datetime.utcnow() + timedelta(days=freq_days.get(product_freq, 30))).date()
        
        is_mpesa = data.disbursement_method == "mpesa" and data.disbursement_phone
        
        loan.disbursed_at = datetime.utcnow()
        if is_mpesa:
            loan.status = "pending_disbursement"
        else:
            loan.status = "disbursed"
        
        txn_code = generate_txn_code()
        
        transaction = Transaction(
            transaction_number=txn_code,
            member_id=loan.member_id,
            transaction_type="loan_disbursement",
            account_type="loan",
            amount=net_amount,
            description=f"Loan disbursement for {loan.application_number}"
        )
        
        if is_mpesa:
            transaction.description = f"Loan disbursement (pending M-Pesa) for {loan.application_number}"
        
        tenant_session.add(transaction)
        
        from services.instalment_service import generate_instalment_schedule
        generate_instalment_schedule(tenant_session, loan, product)
        
        tenant_session.commit()
        tenant_session.refresh(loan)
        
        if not is_mpesa and member:
            post_disbursement_to_gl(tenant_session, loan, member, data.disbursement_method, deduct_interest_upfront)
        
        mpesa_b2c_result = None
        if is_mpesa:
            try:
                from models.tenant import OrganizationSettings
                gateway_setting = tenant_session.query(OrganizationSettings).filter(
                    OrganizationSettings.setting_key == "mpesa_gateway"
                ).first()
                gateway = gateway_setting.setting_value if gateway_setting else "daraja"

                phone = data.disbursement_phone.replace("+", "").replace(" ", "")
                if phone.startswith("0"):
                    phone = "254" + phone[1:]

                import os
                public_domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
                if public_domain:
                    callback_url = f"https://{public_domain}/api/webhooks/sunpay/{org_id}"
                else:
                    callback_url = ""

                if gateway == "sunpay":
                    from services.sunpay import b2c_payment
                    mpesa_b2c_result = await b2c_payment(
                        tenant_session, phone, net_amount,
                        remarks=f"Loan disbursement {loan.application_number}",
                        occasion=f"DISBURSE:{loan.id}",
                        callback_url=callback_url
                    )
                else:
                    from routes.mpesa import initiate_b2c_disbursement
                    mpesa_b2c_result = initiate_b2c_disbursement(
                        tenant_session, phone, net_amount,
                        remarks=f"Loan disbursement {loan.application_number}",
                        occasion=loan.application_number
                    )
                    if mpesa_b2c_result and mpesa_b2c_result.get("success"):
                        loan.status = "disbursed"
                        loan.disbursed_at = datetime.utcnow()
                        transaction.description = f"Loan disbursement for {loan.application_number}"
                        tenant_session.commit()
                        if member:
                            post_disbursement_to_gl(tenant_session, loan, member, data.disbursement_method, deduct_interest_upfront)
                    
                print(f"[M-Pesa B2C] Disbursement for {loan.application_number}: {mpesa_b2c_result}")
                
                if mpesa_b2c_result and not mpesa_b2c_result.get("success"):
                    loan.status = "approved"
                    loan.disbursed_at = None
                    loan.amount_disbursed = None
                    loan.outstanding_balance = None
                    loan.amount_repaid = None
                    loan.next_payment_date = None
                    from models.tenant import LoanInstalment
                    tenant_session.query(LoanInstalment).filter(LoanInstalment.loan_id == loan.id).delete()
                    tenant_session.delete(transaction)
                    tenant_session.commit()
                    print(f"[M-Pesa B2C] Reverted loan {loan.application_number} back to approved due to B2C failure")
                    
            except Exception as e:
                print(f"[M-Pesa B2C] Failed to send disbursement for {loan.application_number}: {e}")
                loan.status = "approved"
                loan.disbursed_at = None
                loan.amount_disbursed = None
                loan.outstanding_balance = None
                loan.amount_repaid = None
                loan.next_payment_date = None
                from models.tenant import LoanInstalment
                tenant_session.query(LoanInstalment).filter(LoanInstalment.loan_id == loan.id).delete()
                tenant_session.delete(transaction)
                tenant_session.commit()
                mpesa_b2c_result = {"success": False, "error": str(e)}

        if not is_mpesa and member and member.phone:
            try_send_sms(
                tenant_session,
                "loan_disbursed",
                member.phone,
                f"{member.first_name} {member.last_name}",
                {
                    "name": member.first_name,
                    "amount": str(net_amount),
                    "monthly_repayment": str(loan.monthly_repayment or 0),
                    "due_date": str(loan.next_payment_date) if loan.next_payment_date else "N/A"
                },
                member_id=member.id,
                loan_id=loan.id
            )
        
        # Return enriched response with staff names
        loan_dict = LoanApplicationResponse.model_validate(loan).model_dump()
        member = tenant_session.query(Member).filter(Member.id == loan.member_id).first()
        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        created_by = tenant_session.query(Staff).filter(Staff.id == loan.created_by_id).first() if loan.created_by_id else None
        reviewed_by = tenant_session.query(Staff).filter(Staff.id == loan.reviewed_by_id).first() if loan.reviewed_by_id else None
        
        loan_dict["member_name"] = f"{member.first_name} {member.last_name}" if member else ""
        loan_dict["member_first_name"] = member.first_name if member else ""
        loan_dict["member_last_name"] = member.last_name if member else ""
        loan_dict["product_name"] = product.name if product else ""
        loan_dict["created_by_name"] = f"{created_by.first_name} {created_by.last_name}" if created_by else None
        loan_dict["reviewed_by_name"] = f"{reviewed_by.first_name} {reviewed_by.last_name}" if reviewed_by else None
        
        response = {
            "message": "Loan disbursed successfully",
            "loan": loan_dict,
            "disbursement": {
                "method": data.disbursement_method,
                "amount": float(net_amount),
                "processing_fee": float(loan.processing_fee or 0),
                "insurance_fee": float(loan.insurance_fee or 0),
                "interest_deducted_upfront": deduct_interest_upfront,
                "interest_deducted": float(loan.total_interest or 0) if deduct_interest_upfront else 0
            }
        }
        if mpesa_b2c_result is not None:
            response["mpesa_b2c"] = mpesa_b2c_result
        return response
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/loans/{loan_id}/summary")
async def get_loan_summary(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        member = tenant_session.query(Member).filter(Member.id == loan.member_id).first()
        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        guarantors = tenant_session.query(LoanGuarantor).filter(LoanGuarantor.loan_id == loan_id).all()
        
        interest_deducted_upfront = getattr(loan, 'interest_deducted_upfront', False)
        if interest_deducted_upfront:
            total_installments_due = float(loan.amount)
        else:
            total_installments_due = float(loan.total_repayment or 0)
        
        return {
            "loan": LoanApplicationResponse.model_validate(loan),
            "member": {
                "id": member.id,
                "member_number": member.member_number,
                "name": f"{member.first_name} {member.last_name}",
                "phone": member.phone,
                "savings": float(member.savings_balance or 0)
            } if member else None,
            "product": {
                "id": product.id,
                "name": product.name,
                "interest_rate": float(product.interest_rate),
                "interest_type": product.interest_type
            } if product else None,
            "guarantors": [
                {
                    "id": g.id,
                    "guarantor_id": g.guarantor_id,
                    "amount_guaranteed": float(g.amount_guaranteed),
                    "status": g.status
                } for g in guarantors
            ],
            "calculations": {
                "principal": float(loan.amount),
                "interest": float(loan.total_interest or 0),
                "interest_deducted_upfront": interest_deducted_upfront,
                "fees": float((loan.processing_fee or Decimal("0")) + (loan.insurance_fee or Decimal("0"))),
                "total_due": total_installments_due,
                "amount_paid": float(loan.amount_repaid or 0),
                "outstanding": float(loan.outstanding_balance or 0)
            }
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/loans/{loan_id}/instalments")
async def get_loan_instalments(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loans:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        from models.tenant import LoanInstalment
        instalments = tenant_session.query(LoanInstalment).filter(
            LoanInstalment.loan_id == loan_id
        ).order_by(LoanInstalment.instalment_number).all()
        
        return [{
            "id": str(i.id),
            "instalment_number": i.instalment_number,
            "due_date": str(i.due_date),
            "expected_principal": float(i.expected_principal),
            "expected_interest": float(i.expected_interest),
            "expected_penalty": float(i.expected_penalty),
            "paid_principal": float(i.paid_principal),
            "paid_interest": float(i.paid_interest),
            "paid_penalty": float(i.paid_penalty),
            "total_due": float(i.expected_principal + i.expected_interest + i.expected_penalty),
            "total_paid": float(i.paid_principal + i.paid_interest + i.paid_penalty),
            "balance": float(
                (i.expected_principal + i.expected_interest + i.expected_penalty) -
                (i.paid_principal + i.paid_interest + i.paid_penalty)
            ),
            "status": i.status,
            "paid_at": str(i.paid_at) if i.paid_at else None,
        } for i in instalments]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.delete("/{org_id}/loans/{loan_id}")
async def delete_loan(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        if loan.status in ["disbursed", "paid"]:
            raise HTTPException(status_code=400, detail="Cannot delete disbursed or paid loans")
        
        tenant_session.query(LoanGuarantor).filter(LoanGuarantor.loan_id == loan_id).delete()
        tenant_session.delete(loan)
        tenant_session.commit()
        return {"message": "Loan deleted"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/loans/{loan_id}")
async def update_loan(org_id: str, loan_id: str, data: LoanApplicationUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        if loan.status not in ["pending", "under_review", "cancelled", "rejected"]:
            raise HTTPException(status_code=400, detail="Can only edit loans with status pending, under_review, cancelled, or rejected")
        
        if data.loan_product_id:
            product = tenant_session.query(LoanProduct).filter(LoanProduct.id == data.loan_product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail="Loan product not found")
            loan.loan_product_id = data.loan_product_id
            loan.interest_rate = product.interest_rate
        else:
            product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        
        if data.amount is not None:
            if data.amount < product.min_amount or data.amount > product.max_amount:
                raise HTTPException(status_code=400, detail=f"Amount must be between {product.min_amount} and {product.max_amount}")
            loan.amount = data.amount
        
        if data.term_months is not None:
            edit_freq = getattr(product, 'repayment_frequency', 'monthly')
            edit_period_labels = {"daily": "days", "weekly": "weeks", "bi_weekly": "bi-weeks", "monthly": "months"}
            edit_period_label = edit_period_labels.get(edit_freq, "months")
            if data.term_months < product.min_term_months or data.term_months > product.max_term_months:
                raise HTTPException(status_code=400, detail=f"Term must be between {product.min_term_months} and {product.max_term_months} {edit_period_label}")
            loan.term_months = data.term_months
        
        if data.purpose is not None:
            loan.purpose = data.purpose
        if data.disbursement_method is not None:
            loan.disbursement_method = data.disbursement_method
        if data.disbursement_account is not None:
            loan.disbursement_account = data.disbursement_account
        if data.disbursement_phone is not None:
            loan.disbursement_phone = data.disbursement_phone
        
        calc = calculate_loan(loan.amount, loan.term_months, product.interest_rate, product.interest_type, getattr(product, 'repayment_frequency', 'monthly'))
        loan.total_interest = calc["total_interest"]
        loan.total_repayment = calc["total_repayment"]
        loan.monthly_repayment = calc["monthly_repayment"]
        
        processing_fee = loan.amount * (product.processing_fee or Decimal("0")) / Decimal("100")
        insurance_fee = loan.amount * (product.insurance_fee or Decimal("0")) / Decimal("100")
        loan.processing_fee = processing_fee
        loan.insurance_fee = insurance_fee
        
        if loan.status in ["under_review", "cancelled", "rejected"]:
            loan.status = "pending"
            loan.rejection_reason = None
            loan.rejected_at = None
        
        tenant_session.commit()
        tenant_session.refresh(loan)
        return LoanApplicationResponse.model_validate(loan)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/loans/{loan_id}/cancel")
async def cancel_loan(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "loans:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        if loan.status not in ["pending", "under_review"]:
            raise HTTPException(status_code=400, detail="Can only cancel loans with status pending or under_review")
        
        loan.status = "cancelled"
        tenant_session.commit()
        tenant_session.refresh(loan)
        return LoanApplicationResponse.model_validate(loan)
    finally:
        tenant_session.close()
        tenant_ctx.close()

# Alias routes for frontend compatibility - loan-applications maps to loans
@router.get("/{org_id}/loan-applications")
async def list_loan_applications(org_id: str, status: str = None, member_id: str = None, branch_id: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return await list_loans(org_id, status, member_id, branch_id, user, db)

@router.post("/{org_id}/loan-applications")
async def create_loan_application(org_id: str, data: LoanApplicationCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return await create_loan(org_id, data, user, db)

@router.get("/{org_id}/loan-applications/{loan_id}")
async def get_loan_application(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return await get_loan(org_id, loan_id, user, db)

@router.post("/{org_id}/loan-applications/{loan_id}/approve")
async def approve_loan_application(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return await process_loan_action(org_id, loan_id, LoanApplicationAction(action="approve"), user, db)

@router.post("/{org_id}/loan-applications/{loan_id}/reject")
async def reject_loan_application(org_id: str, loan_id: str, data: dict = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    reason = data.get("reason", "") if data else ""
    return await process_loan_action(org_id, loan_id, LoanApplicationAction(action="reject", reason=reason), user, db)

@router.post("/{org_id}/loan-applications/{loan_id}/disburse")
async def disburse_loan_application(org_id: str, loan_id: str, data: Optional[LoanDisbursement] = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if data is None:
        data = LoanDisbursement(disbursement_method="cash")
    return await disburse_loan(org_id, loan_id, data, user, db)

@router.put("/{org_id}/loan-applications/{loan_id}")
async def update_loan_application(org_id: str, loan_id: str, data: LoanApplicationUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return await update_loan(org_id, loan_id, data, user, db)

@router.put("/{org_id}/loan-applications/{loan_id}/cancel")
async def cancel_loan_application(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return await cancel_loan(org_id, loan_id, user, db)
