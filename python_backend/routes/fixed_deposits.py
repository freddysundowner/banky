from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from decimal import Decimal
import logging

from models.database import get_db
from models.tenant import FixedDepositProduct, MemberFixedDeposit, Member, Staff, AuditLog, Transaction
from schemas.tenant import (
    FixedDepositProductCreate, FixedDepositProductUpdate, FixedDepositProductResponse,
    MemberFixedDepositCreate, MemberFixedDepositResponse, FixedDepositCloseRequest
)
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission
from services.feature_flags import check_org_feature
from services.code_generator import generate_txn_code, generate_fd_code

gl_logger = logging.getLogger("accounting.gl")

def get_org_currency(session):
    from models.tenant import OrganizationSettings
    try:
        setting = session.query(OrganizationSettings).filter(OrganizationSettings.setting_key == "currency").first()
        return setting.setting_value if setting else "USD"
    except:
        return "USD"

router = APIRouter()

def post_fd_creation_to_gl(tenant_session, deposit, member, funding_source, staff_id=None):
    """Post fixed deposit creation to General Ledger"""
    try:
        from accounting.service import AccountingService, post_fixed_deposit_creation
        
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        member_name = f"{member.first_name} {member.last_name}"
        
        post_fixed_deposit_creation(
            svc,
            member_id=member.id,
            deposit_id=str(deposit.id),
            amount=deposit.principal_amount,
            funding_source=funding_source,
            description=f"Fixed Deposit Opening - {member_name} - {deposit.deposit_number}",
            created_by_id=staff_id
        )
        gl_logger.info(f"Posted FD creation to GL: {deposit.deposit_number}")
    except Exception as e:
        gl_logger.warning(f"Failed to post FD creation {deposit.deposit_number} to GL: {e}")

def post_fd_closure_to_gl(tenant_session, deposit, member, interest_earned, staff_id=None):
    """Post fixed deposit closure/maturity to General Ledger"""
    try:
        from accounting.service import AccountingService, post_fixed_deposit_maturity
        
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        member_name = f"{member.first_name} {member.last_name}"
        
        post_fixed_deposit_maturity(
            svc,
            member_id=member.id,
            deposit_id=str(deposit.id),
            principal_amount=deposit.principal_amount,
            interest_amount=interest_earned,
            description=f"Fixed Deposit Maturity - {member_name} - {deposit.deposit_number}",
            created_by_id=staff_id
        )
        gl_logger.info(f"Posted FD closure to GL: {deposit.deposit_number}")
    except Exception as e:
        gl_logger.warning(f"Failed to post FD closure {deposit.deposit_number} to GL: {e}")

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
    tenant_session.commit()

@router.get("/{org_id}/fixed-deposit-products")
async def list_products(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_org_feature(org_id, "fixed_deposits", db):
        raise HTTPException(status_code=403, detail="Fixed deposits is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        products = tenant_session.query(FixedDepositProduct).order_by(FixedDepositProduct.term_months).all()
        return [FixedDepositProductResponse.model_validate(p) for p in products]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/fixed-deposit-products")
async def create_product(org_id: str, data: FixedDepositProductCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_org_feature(org_id, "fixed_deposits", db):
        raise HTTPException(status_code=403, detail="Fixed deposits is not available in your subscription plan")
    
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        existing = tenant_session.query(FixedDepositProduct).filter(FixedDepositProduct.code == data.code).first()
        if existing:
            raise HTTPException(status_code=400, detail="Product code already exists")
        
        product = FixedDepositProduct(
            name=data.name,
            code=data.code,
            description=data.description,
            term_months=data.term_months,
            interest_rate=data.interest_rate,
            min_amount=data.min_amount,
            max_amount=data.max_amount,
            early_withdrawal_penalty=data.early_withdrawal_penalty
        )
        tenant_session.add(product)
        tenant_session.commit()
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        create_audit_log(
            tenant_session,
            staff_id=staff.id if staff else None,
            action="create_fixed_deposit_product",
            entity_type="fixed_deposit_product",
            entity_id=product.id,
            new_values={"name": product.name, "term_months": product.term_months, "interest_rate": str(product.interest_rate)}
        )
        
        return FixedDepositProductResponse.model_validate(product)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/fixed-deposit-products/{product_id}")
async def update_product(org_id: str, product_id: str, data: FixedDepositProductUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        product = tenant_session.query(FixedDepositProduct).filter(FixedDepositProduct.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(product, field, value)
        
        tenant_session.commit()
        return FixedDepositProductResponse.model_validate(product)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/fixed-deposits")
async def list_deposits(org_id: str, member_id: str = None, status: str = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        query = tenant_session.query(MemberFixedDeposit)
        if member_id:
            query = query.filter(MemberFixedDeposit.member_id == member_id)
        if status:
            query = query.filter(MemberFixedDeposit.status == status)
        
        deposits = query.order_by(MemberFixedDeposit.created_at.desc()).all()
        
        result = []
        for d in deposits:
            member = tenant_session.query(Member).filter(Member.id == d.member_id).first()
            product = tenant_session.query(FixedDepositProduct).filter(FixedDepositProduct.id == d.product_id).first()
            
            resp = MemberFixedDepositResponse.model_validate(d)
            resp.member_name = f"{member.first_name} {member.last_name}" if member else None
            resp.member_number = member.member_number if member else None
            resp.product_name = product.name if product else None
            result.append(resp)
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/fixed-deposits")
async def create_deposit(org_id: str, data: MemberFixedDepositCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == data.member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        product = tenant_session.query(FixedDepositProduct).filter(FixedDepositProduct.id == data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Fixed deposit product not found")
        
        if not product.is_active:
            raise HTTPException(status_code=400, detail="This product is not active")
        
        if data.principal_amount < product.min_amount:
            raise HTTPException(status_code=400, detail=f"Minimum amount is {get_org_currency(tenant_session)} {product.min_amount}")
        
        if product.max_amount and data.principal_amount > product.max_amount:
            raise HTTPException(status_code=400, detail=f"Maximum amount is {get_org_currency(tenant_session)} {product.max_amount}")
        
        deposit_number = generate_fd_code()
        
        start_date = date.today()
        maturity_date = start_date + relativedelta(months=product.term_months)
        
        term_years = Decimal(str(product.term_months)) / Decimal("12")
        expected_interest = (data.principal_amount * product.interest_rate * term_years) / Decimal("100")
        maturity_amount = data.principal_amount + expected_interest
        
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        funding_source = data.funding_source or "cash"
        
        if funding_source == "savings":
            if (member.savings_balance or Decimal("0")) < data.principal_amount:
                raise HTTPException(status_code=400, detail="Insufficient savings balance")
            member.savings_balance = (member.savings_balance or Decimal("0")) - data.principal_amount
            
            withdrawal_tx_number = generate_txn_code()
            
            withdrawal_tx = Transaction(
                transaction_number=withdrawal_tx_number,
                member_id=data.member_id,
                transaction_type="withdrawal",
                account_type="savings",
                amount=data.principal_amount,
                balance_before=member.savings_balance + data.principal_amount,
                balance_after=member.savings_balance,
                payment_method="transfer",
                reference=data.payment_reference,
                description=f"Transfer to Fixed Deposit",
                processed_by_id=staff.id if staff else None
            )
            tenant_session.add(withdrawal_tx)
        
        deposit = MemberFixedDeposit(
            deposit_number=deposit_number,
            member_id=data.member_id,
            product_id=data.product_id,
            principal_amount=data.principal_amount,
            interest_rate=product.interest_rate,
            term_months=product.term_months,
            start_date=start_date,
            maturity_date=maturity_date,
            expected_interest=expected_interest,
            maturity_amount=maturity_amount,
            auto_rollover=data.auto_rollover or False,
            notes=data.notes,
            created_by_id=staff.id if staff else None
        )
        tenant_session.add(deposit)
        
        member.deposits_balance = (member.deposits_balance or Decimal("0")) + data.principal_amount
        
        fd_tx_number = generate_txn_code()
        
        fd_transaction = Transaction(
            transaction_number=fd_tx_number,
            member_id=data.member_id,
            transaction_type="deposit",
            account_type="deposits",
            amount=data.principal_amount,
            balance_before=member.deposits_balance - data.principal_amount,
            balance_after=member.deposits_balance,
            payment_method=funding_source if funding_source != "savings" else "transfer",
            reference=data.payment_reference or deposit_number,
            description=f"Fixed Deposit Opening - {deposit_number}",
            processed_by_id=staff.id if staff else None
        )
        tenant_session.add(fd_transaction)
        
        tenant_session.commit()
        
        # Post to General Ledger
        post_fd_creation_to_gl(tenant_session, deposit, member, funding_source=funding_source, staff_id=staff.id if staff else None)
        
        create_audit_log(
            tenant_session,
            staff_id=staff.id if staff else None,
            action="create_fixed_deposit",
            entity_type="member_fixed_deposit",
            entity_id=deposit.id,
            new_values={
                "deposit_number": deposit_number,
                "member": f"{member.first_name} {member.last_name}",
                "amount": str(data.principal_amount),
                "term_months": product.term_months
            }
        )
        
        resp = MemberFixedDepositResponse.model_validate(deposit)
        resp.member_name = f"{member.first_name} {member.last_name}"
        resp.member_number = member.member_number
        resp.product_name = product.name
        
        return resp
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/fixed-deposits/maturing-soon")
async def get_maturing_deposits(org_id: str, days: int = 30, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        from datetime import timedelta
        today = date.today()
        future_date = today + timedelta(days=days)
        
        deposits = tenant_session.query(MemberFixedDeposit).filter(
            MemberFixedDeposit.status == "active",
            MemberFixedDeposit.maturity_date >= today,
            MemberFixedDeposit.maturity_date <= future_date
        ).order_by(MemberFixedDeposit.maturity_date).all()
        
        result = []
        for d in deposits:
            member = tenant_session.query(Member).filter(Member.id == d.member_id).first()
            product = tenant_session.query(FixedDepositProduct).filter(FixedDepositProduct.id == d.product_id).first()
            
            resp = MemberFixedDepositResponse.model_validate(d)
            resp.member_name = f"{member.first_name} {member.last_name}" if member else None
            resp.member_number = member.member_number if member else None
            resp.product_name = product.name if product else None
            result.append(resp)
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/fixed-deposits/{deposit_id}")
async def get_deposit(org_id: str, deposit_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        deposit = tenant_session.query(MemberFixedDeposit).filter(MemberFixedDeposit.id == deposit_id).first()
        if not deposit:
            raise HTTPException(status_code=404, detail="Fixed deposit not found")
        
        member = tenant_session.query(Member).filter(Member.id == deposit.member_id).first()
        product = tenant_session.query(FixedDepositProduct).filter(FixedDepositProduct.id == deposit.product_id).first()
        
        resp = MemberFixedDepositResponse.model_validate(deposit)
        resp.member_name = f"{member.first_name} {member.last_name}" if member else None
        resp.member_number = member.member_number if member else None
        resp.product_name = product.name if product else None
        
        return resp
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/fixed-deposits/{deposit_id}/close")
async def close_deposit(org_id: str, deposit_id: str, data: FixedDepositCloseRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        deposit = tenant_session.query(MemberFixedDeposit).filter(MemberFixedDeposit.id == deposit_id).first()
        if not deposit:
            raise HTTPException(status_code=404, detail="Fixed deposit not found")
        
        if deposit.status != "active":
            raise HTTPException(status_code=400, detail=f"Cannot close deposit with status: {deposit.status}")
        
        member = tenant_session.query(Member).filter(Member.id == deposit.member_id).first()
        product = tenant_session.query(FixedDepositProduct).filter(FixedDepositProduct.id == deposit.product_id).first()
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        today = date.today()
        is_early = today < deposit.maturity_date
        
        if is_early and not data.early_withdrawal:
            raise HTTPException(status_code=400, detail="Maturity date not reached. Set early_withdrawal=true to proceed with penalty.")
        
        penalty = Decimal("0")
        
        if is_early:
            days_held = (today - deposit.start_date).days
            total_days = (deposit.maturity_date - deposit.start_date).days
            
            if days_held <= 0 or total_days <= 0:
                interest_to_pay = Decimal("0")
            else:
                prorated_interest = (deposit.expected_interest * Decimal(str(days_held))) / Decimal(str(total_days))
                
                if product:
                    penalty_rate = product.early_withdrawal_penalty or Decimal("0")
                    penalty = (prorated_interest * penalty_rate) / Decimal("100")
                
                interest_to_pay = prorated_interest - penalty
                if interest_to_pay < 0:
                    interest_to_pay = Decimal("0")
        else:
            interest_to_pay = deposit.expected_interest
        
        actual_amount = deposit.principal_amount + interest_to_pay
        
        deposit.status = "closed"
        deposit.closed_date = today
        deposit.closed_by_id = staff.id if staff else None
        deposit.early_withdrawal = is_early
        deposit.penalty_amount = penalty
        deposit.actual_interest_paid = interest_to_pay
        deposit.actual_amount_paid = actual_amount
        if data.notes:
            deposit.notes = (deposit.notes or "") + f"\nClosure: {data.notes}"
        
        member.deposits_balance = (member.deposits_balance or Decimal("0")) - deposit.principal_amount
        if member.deposits_balance < 0:
            member.deposits_balance = Decimal("0")
        
        member.savings_balance = (member.savings_balance or Decimal("0")) + actual_amount
        
        close_tx_number = generate_txn_code()
        
        close_tx = Transaction(
            transaction_number=close_tx_number,
            member_id=deposit.member_id,
            transaction_type="deposit",
            account_type="savings",
            amount=actual_amount,
            balance_before=member.savings_balance - actual_amount,
            balance_after=member.savings_balance,
            payment_method="transfer",
            reference=deposit.deposit_number,
            description=f"Fixed Deposit Maturity - {deposit.deposit_number}" + (f" (Early withdrawal, penalty: {get_org_currency(tenant_session)} {penalty})" if is_early else ""),
            processed_by_id=staff.id if staff else None
        )
        tenant_session.add(close_tx)
        
        tenant_session.commit()
        
        # Post to General Ledger
        post_fd_closure_to_gl(tenant_session, deposit, member, interest_to_pay, staff_id=staff.id if staff else None)
        
        create_audit_log(
            tenant_session,
            staff_id=staff.id if staff else None,
            action="close_fixed_deposit",
            entity_type="member_fixed_deposit",
            entity_id=deposit.id,
            new_values={
                "actual_amount_paid": str(actual_amount),
                "interest_paid": str(interest_to_pay),
                "penalty": str(penalty),
                "early_withdrawal": is_early
            }
        )
        
        resp = MemberFixedDepositResponse.model_validate(deposit)
        resp.member_name = f"{member.first_name} {member.last_name}" if member else None
        resp.member_number = member.member_number if member else None
        resp.product_name = product.name if product else None
        
        return resp
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/fixed-deposits/process-matured")
async def process_matured_deposits(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Process all matured fixed deposits - pay out or rollover as configured"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "transactions:write", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        today = date.today()
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        matured_deposits = tenant_session.query(MemberFixedDeposit).filter(
            MemberFixedDeposit.status == "active",
            MemberFixedDeposit.maturity_date <= today
        ).all()
        
        processed = []
        rolled_over = []
        errors = []
        
        for deposit in matured_deposits:
            try:
                member = tenant_session.query(Member).filter(Member.id == deposit.member_id).first()
                product = tenant_session.query(FixedDepositProduct).filter(FixedDepositProduct.id == deposit.product_id).first()
                
                if not member or not product:
                    errors.append({"deposit_id": deposit.id, "error": "Member or product not found"})
                    continue
                
                interest_to_pay = deposit.expected_interest
                
                if deposit.auto_rollover:
                    member.savings_balance = (member.savings_balance or Decimal("0")) + interest_to_pay
                    
                    interest_tx = Transaction(
                        transaction_number=generate_txn_code(),
                        member_id=deposit.member_id,
                        transaction_type="deposit",
                        account_type="savings",
                        amount=interest_to_pay,
                        balance_before=member.savings_balance - interest_to_pay,
                        balance_after=member.savings_balance,
                        payment_method="transfer",
                        reference=deposit.deposit_number,
                        description=f"Fixed Deposit Interest Payout - {deposit.deposit_number} (Rolled Over)",
                        processed_by_id=staff.id if staff else None
                    )
                    tenant_session.add(interest_tx)
                    
                    deposit.status = "matured"
                    deposit.closed_date = today
                    deposit.actual_interest_paid = interest_to_pay
                    deposit.actual_amount_paid = interest_to_pay
                    deposit.notes = (deposit.notes or "") + f"\nMatured and rolled over on {today}"
                    
                    new_deposit_number = generate_fd_code()
                    
                    new_start_date = today
                    new_maturity_date = new_start_date + relativedelta(months=product.term_months)
                    term_years = Decimal(str(product.term_months)) / Decimal("12")
                    new_expected_interest = (deposit.principal_amount * product.interest_rate * term_years) / Decimal("100")
                    new_maturity_amount = deposit.principal_amount + new_expected_interest
                    
                    new_deposit = MemberFixedDeposit(
                        deposit_number=new_deposit_number,
                        member_id=deposit.member_id,
                        product_id=deposit.product_id,
                        principal_amount=deposit.principal_amount,
                        interest_rate=product.interest_rate,
                        term_months=product.term_months,
                        start_date=new_start_date,
                        maturity_date=new_maturity_date,
                        expected_interest=new_expected_interest,
                        maturity_amount=new_maturity_amount,
                        auto_rollover=deposit.auto_rollover,
                        rollover_count=(deposit.rollover_count or 0) + 1,
                        parent_deposit_id=deposit.id,
                        notes=f"Rolled over from {deposit.deposit_number}",
                        created_by_id=staff.id if staff else None
                    )
                    tenant_session.add(new_deposit)
                    
                    create_audit_log(
                        tenant_session,
                        staff_id=staff.id if staff else None,
                        action="rollover_fixed_deposit",
                        entity_type="member_fixed_deposit",
                        entity_id=deposit.id,
                        new_values={
                            "old_deposit": deposit.deposit_number,
                            "new_deposit": new_deposit_number,
                            "interest_paid": str(interest_to_pay),
                            "principal": str(deposit.principal_amount)
                        }
                    )
                    
                    rolled_over.append({
                        "old_deposit": deposit.deposit_number,
                        "new_deposit": new_deposit_number,
                        "member_name": f"{member.first_name} {member.last_name}",
                        "principal": str(deposit.principal_amount),
                        "interest_paid": str(interest_to_pay)
                    })
                else:
                    actual_amount = deposit.principal_amount + interest_to_pay
                    
                    member.deposits_balance = (member.deposits_balance or Decimal("0")) - deposit.principal_amount
                    if member.deposits_balance < 0:
                        member.deposits_balance = Decimal("0")
                    
                    member.savings_balance = (member.savings_balance or Decimal("0")) + actual_amount
                    
                    payout_tx = Transaction(
                        transaction_number=generate_txn_code(),
                        member_id=deposit.member_id,
                        transaction_type="deposit",
                        account_type="savings",
                        amount=actual_amount,
                        balance_before=member.savings_balance - actual_amount,
                        balance_after=member.savings_balance,
                        payment_method="transfer",
                        reference=deposit.deposit_number,
                        description=f"Fixed Deposit Maturity Payout - {deposit.deposit_number}",
                        processed_by_id=staff.id if staff else None
                    )
                    tenant_session.add(payout_tx)
                    
                    deposit.status = "matured"
                    deposit.closed_date = today
                    deposit.actual_interest_paid = interest_to_pay
                    deposit.actual_amount_paid = actual_amount
                    deposit.notes = (deposit.notes or "") + f"\nMatured and paid out on {today}"
                    
                    create_audit_log(
                        tenant_session,
                        staff_id=staff.id if staff else None,
                        action="mature_fixed_deposit",
                        entity_type="member_fixed_deposit",
                        entity_id=deposit.id,
                        new_values={
                            "deposit_number": deposit.deposit_number,
                            "principal": str(deposit.principal_amount),
                            "interest_paid": str(interest_to_pay),
                            "total_paid": str(actual_amount)
                        }
                    )
                    
                    processed.append({
                        "deposit_number": deposit.deposit_number,
                        "member_name": f"{member.first_name} {member.last_name}",
                        "principal": str(deposit.principal_amount),
                        "interest_paid": str(interest_to_pay),
                        "total_paid": str(actual_amount)
                    })
                
            except Exception as e:
                errors.append({"deposit_id": deposit.id, "error": str(e)})
        
        tenant_session.commit()
        
        return {
            "processed_count": len(processed),
            "rolled_over_count": len(rolled_over),
            "error_count": len(errors),
            "processed": processed,
            "rolled_over": rolled_over,
            "errors": errors
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()
