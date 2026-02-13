from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from decimal import Decimal
from datetime import datetime, timedelta
import logging
from models.database import get_db
from models.tenant import LoanApplication, LoanRepayment, LoanProduct, Transaction, Member, LoanInstalment, LoanDefault
from schemas.tenant import LoanRepaymentCreate, LoanRepaymentResponse
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from services.code_generator import generate_txn_code, generate_repayment_code

gl_logger = logging.getLogger("accounting.gl")

router = APIRouter()

def post_repayment_to_gl(tenant_session, repayment, loan, member):
    """Post a loan repayment to the General Ledger"""
    try:
        from accounting.service import AccountingService, post_loan_repayment
        
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        member_name = f"{member.first_name} {member.last_name}"
        
        print(f"[GL] Posting repayment {repayment.repayment_number}: principal={repayment.principal_amount}, interest={repayment.interest_amount}")
        
        je = post_loan_repayment(
            svc,
            member_id=str(member.id),
            loan_id=str(loan.id),
            principal_amount=repayment.principal_amount or Decimal("0"),
            interest_amount=repayment.interest_amount or Decimal("0"),
            penalty_amount=repayment.penalty_amount or Decimal("0"),
            payment_method=repayment.payment_method or "cash",
            repayment_id=str(repayment.id),
            description=f"Loan repayment - {member_name} - {loan.application_number}"
        )
        print(f"[GL] Posted repayment to GL: {repayment.repayment_number}, journal entry: {je.entry_number if je else 'None'}")
        gl_logger.info(f"Posted repayment to GL: {repayment.repayment_number}")
    except Exception as e:
        import traceback
        print(f"[GL] Failed to post repayment {repayment.repayment_number} to GL: {e}")
        traceback.print_exc()
        gl_logger.warning(f"Failed to post repayment {repayment.repayment_number} to GL: {e}")

def try_send_sms(tenant_session, template_type: str, phone: str, name: str, context: dict, member_id=None, loan_id=None):
    """Try to send SMS, fail silently if SMS not configured"""
    try:
        from routes.sms import send_sms_with_template
        if phone:
            send_sms_with_template(tenant_session, template_type, phone, name, context, member_id=member_id, loan_id=loan_id)
    except Exception as e:
        print(f"[SMS] Failed to send {template_type}: {e}")

def calculate_payment_allocation(loan: LoanApplication, amount: Decimal, tenant_session=None):
    if getattr(loan, 'interest_deducted_upfront', False):
        principal_portion = amount
        interest_portion = Decimal("0")
        penalty_portion = Decimal("0")
    else:
        product = None
        if tenant_session:
            product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        interest_type = getattr(product, 'interest_type', 'reducing_balance') if product else 'reducing_balance'

        if interest_type == "flat":
            interest_per_period = (loan.total_interest or Decimal("0")) / loan.term_months if loan.term_months > 0 else Decimal("0")
            interest_portion = min(amount, interest_per_period)
        else:
            periodic_rate = loan.interest_rate / Decimal("100")
            interest_portion = min(amount, (loan.outstanding_balance or Decimal("0")) * periodic_rate)
        principal_portion = amount - interest_portion
        penalty_portion = Decimal("0")
    return principal_portion, interest_portion, penalty_portion

@router.get("/{org_id}/repayments")
async def list_repayments(org_id: str, loan_id: str = None, start_date: str = None, end_date: str = None, page: int = 1, page_size: int = 20, user=Depends(get_current_user), db: Session = Depends(get_db)):
    from datetime import date as date_type
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "repayments:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(LoanRepayment)
        if loan_id:
            query = query.filter(LoanRepayment.loan_id == loan_id)
        if start_date:
            try:
                sd = date_type.fromisoformat(start_date)
                query = query.filter(func.date(LoanRepayment.payment_date) >= sd)
            except ValueError:
                pass
        if end_date:
            try:
                ed = date_type.fromisoformat(end_date)
                query = query.filter(func.date(LoanRepayment.payment_date) <= ed)
            except ValueError:
                pass
        
        total = query.count()
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        total_pages = max(1, (total + page_size - 1) // page_size)
        offset = (page - 1) * page_size
        
        repayments = query.order_by(LoanRepayment.payment_date.desc()).offset(offset).limit(page_size).all()
        return {
            "items": [LoanRepaymentResponse.model_validate(r) for r in repayments],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/repayments")
async def create_repayment(org_id: str, data: LoanRepaymentCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "repayments:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == data.loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        if loan.status != "disbursed":
            raise HTTPException(status_code=400, detail="Loan is not active for repayment")
        
        if data.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        from models.tenant import LoanInstalment
        has_instalments = tenant_session.query(LoanInstalment).filter(
            LoanInstalment.loan_id == str(loan.id)
        ).count() > 0
        
        overpayment = Decimal("0")
        if has_instalments:
            from services.instalment_service import allocate_payment_to_instalments
            principal_amount, interest_amount, penalty_amount, overpayment = allocate_payment_to_instalments(
                tenant_session, loan, data.amount
            )
        else:
            principal_amount, interest_amount, penalty_amount = calculate_payment_allocation(loan, data.amount, tenant_session)
            outstanding = loan.outstanding_balance or Decimal("0")
            total_allocated = principal_amount + interest_amount + penalty_amount
            if total_allocated > outstanding and outstanding > 0:
                overpayment = total_allocated - outstanding
                principal_amount = principal_amount - overpayment
        
        actual_loan_payment = data.amount - overpayment
        
        code = generate_repayment_code()
        
        repayment = LoanRepayment(
            repayment_number=code,
            loan_id=data.loan_id,
            amount=data.amount,
            principal_amount=principal_amount,
            interest_amount=interest_amount,
            penalty_amount=penalty_amount,
            payment_method=data.payment_method,
            reference=data.reference,
            notes=data.notes,
            payment_date=datetime.utcnow()
        )
        
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
        else:
            if loan.monthly_repayment:
                product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
                rep_freq = getattr(product, 'repayment_frequency', 'monthly') if product else 'monthly'
                freq_days_map = {"daily": 1, "weekly": 7, "bi_weekly": 14, "monthly": 30}
                loan.next_payment_date = (datetime.utcnow() + timedelta(days=freq_days_map.get(rep_freq, 30))).date()
        
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
            member_id=loan.member_id,
            transaction_type="loan_repayment",
            account_type="loan",
            amount=actual_loan_payment,
            reference=data.reference,
            description=f"Loan repayment for {loan.application_number}"
        )
        
        tenant_session.add(repayment)
        tenant_session.add(transaction)
        
        member = tenant_session.query(Member).filter(Member.id == loan.member_id).first()
        
        if overpayment > 0 and member:
            balance_before = member.savings_balance or Decimal("0")
            member.savings_balance = balance_before + overpayment
            
            overpay_txn = Transaction(
                transaction_number=generate_txn_code(),
                member_id=loan.member_id,
                transaction_type="deposit",
                account_type="savings",
                amount=overpayment,
                balance_before=balance_before,
                balance_after=member.savings_balance,
                reference=data.reference,
                description=f"Overpayment from loan {loan.application_number} credited to savings"
            )
            tenant_session.add(overpay_txn)
        
        tenant_session.commit()
        tenant_session.refresh(repayment)
        
        if member:
            post_repayment_to_gl(tenant_session, repayment, loan, member)
        
        if member and member.phone:
            sms_vars = {
                "name": member.first_name,
                "amount": str(data.amount),
                "balance": str(loan.outstanding_balance or 0)
            }
            try_send_sms(
                tenant_session,
                "repayment_received",
                member.phone,
                f"{member.first_name} {member.last_name}",
                sms_vars,
                member_id=member.id,
                loan_id=loan.id
            )
        
        result = LoanRepaymentResponse.model_validate(repayment)
        response_data = result.model_dump()
        if overpayment > 0:
            response_data["overpayment_credited_to_savings"] = float(overpayment)
        return response_data
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/repayments/{repayment_id}")
async def get_repayment(org_id: str, repayment_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "repayments:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        repayment = tenant_session.query(LoanRepayment).filter(LoanRepayment.id == repayment_id).first()
        if not repayment:
            raise HTTPException(status_code=404, detail="Repayment not found")
        return LoanRepaymentResponse.model_validate(repayment)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/loans/{loan_id}/schedule")
async def get_loan_schedule(org_id: str, loan_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "repayments:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        loan = tenant_session.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        product = tenant_session.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        frequency = getattr(product, 'repayment_frequency', 'monthly') if product else 'monthly'
        interest_type = getattr(product, 'interest_type', 'reducing_balance') if product else 'reducing_balance'
        interest_deducted_upfront = getattr(loan, 'interest_deducted_upfront', False)

        instalments = tenant_session.query(LoanInstalment).filter(
            LoanInstalment.loan_id == loan_id
        ).order_by(LoanInstalment.instalment_number).all()

        schedule = []
        total_expected_principal = sum(i.expected_principal for i in instalments)
        running_balance = total_expected_principal
        now = datetime.utcnow().date()
        total_expected = Decimal("0")
        total_paid = Decimal("0")
        total_paid_principal = Decimal("0")
        total_paid_interest = Decimal("0")
        total_paid_penalty = Decimal("0")
        amount_overdue = Decimal("0")
        overdue_count = 0
        next_due_amount = None
        next_due_date = None

        for inst in instalments:
            running_balance = max(Decimal("0"), running_balance - inst.expected_principal)
            inst_total = inst.expected_principal + inst.expected_interest
            inst_paid = inst.paid_principal + inst.paid_interest + inst.paid_penalty
            total_expected += inst_total
            total_paid += inst_paid
            total_paid_principal += inst.paid_principal
            total_paid_interest += inst.paid_interest
            total_paid_penalty += inst.paid_penalty

            if inst.due_date <= now and inst.status in ("pending", "partial", "overdue"):
                remaining = inst_total - inst_paid
                if remaining > 0:
                    amount_overdue += remaining
                    overdue_count += 1

            if next_due_date is None and inst.status in ("pending", "partial", "overdue"):
                next_due_amount = float(inst_total - inst_paid)
                next_due_date = str(inst.due_date)

            schedule.append({
                "installment_number": inst.instalment_number,
                "due_date": str(inst.due_date),
                "principal": float(inst.expected_principal),
                "interest": float(inst.expected_interest),
                "total_payment": float(inst_total),
                "balance_after": float(round(running_balance, 2)),
                "paid_principal": float(inst.paid_principal),
                "paid_interest": float(inst.paid_interest),
                "paid_penalty": float(inst.paid_penalty),
                "status": inst.status
            })

        outstanding_balance = float(max(Decimal("0"), total_expected - total_paid))

        summary = {
            "total_expected": float(total_expected),
            "total_paid": float(total_paid),
            "total_paid_principal": float(total_paid_principal),
            "total_paid_interest": float(total_paid_interest),
            "total_paid_penalty": float(total_paid_penalty),
            "outstanding_balance": outstanding_balance,
            "amount_overdue": float(amount_overdue),
            "overdue_count": overdue_count,
            "next_due_amount": next_due_amount,
            "next_due_date": next_due_date,
        }

        return {
            "loan_id": loan.id,
            "application_number": loan.application_number,
            "amount": float(loan.amount),
            "term_months": loan.term_months,
            "interest_rate": float(loan.interest_rate),
            "monthly_payment": float(loan.monthly_repayment or 0),
            "repayment_frequency": frequency,
            "interest_type": interest_type,
            "interest_deducted_upfront": interest_deducted_upfront,
            "summary": summary,
            "schedule": schedule
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()
