from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy import func
from models.tenant import (
    LoanApplication, LoanRepayment, LoanInstalment, LoanProduct,
    Transaction, Member, LoanDefault
)


def calculate_payment_allocation(loan, amount, tenant_session=None):
    if getattr(loan, 'interest_deducted_upfront', False):
        return amount, Decimal("0"), Decimal("0")

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
    return principal_portion, interest_portion, Decimal("0")


def apply_mpesa_payment_to_loan(tenant_session, loan, member, amount: Decimal, mpesa_ref: str, payment_source: str = "mpesa"):
    if loan.status != "disbursed":
        return None, "Loan is not active for repayment"

    existing_repayment = tenant_session.query(LoanRepayment).filter(
        LoanRepayment.reference == mpesa_ref,
        LoanRepayment.loan_id == str(loan.id)
    ).first()
    if existing_repayment:
        return existing_repayment, None

    has_instalments = tenant_session.query(LoanInstalment).filter(
        LoanInstalment.loan_id == str(loan.id)
    ).count() > 0

    overpayment = Decimal("0")
    if has_instalments:
        from services.instalment_service import allocate_payment_to_instalments
        principal_amount, interest_amount, penalty_amount, overpayment = allocate_payment_to_instalments(
            tenant_session, loan, amount
        )
    else:
        principal_amount, interest_amount, penalty_amount = calculate_payment_allocation(loan, amount, tenant_session)

    actual_loan_payment = amount - overpayment

    count = tenant_session.query(func.count(LoanRepayment.id)).scalar() or 0
    code = f"REP{count + 1:04d}"

    repayment = LoanRepayment(
        repayment_number=code,
        loan_id=str(loan.id),
        amount=amount,
        principal_amount=principal_amount,
        interest_amount=interest_amount,
        penalty_amount=penalty_amount,
        payment_method="mpesa",
        reference=mpesa_ref,
        notes=f"Auto-applied from {payment_source} M-Pesa payment",
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

    txn_count = tenant_session.query(func.count(Transaction.id)).scalar() or 0
    txn_code = f"TXN{txn_count + 1:04d}"
    transaction = Transaction(
        transaction_number=txn_code,
        member_id=loan.member_id,
        transaction_type="loan_repayment",
        account_type="loan",
        amount=actual_loan_payment,
        payment_method="mpesa",
        reference=mpesa_ref,
        description=f"M-Pesa loan repayment for {loan.application_number}"
    )

    tenant_session.add(repayment)
    tenant_session.add(transaction)

    if overpayment > 0 and member:
        balance_before = member.savings_balance or Decimal("0")
        member.savings_balance = balance_before + overpayment
        txn_count2 = tenant_session.query(func.count(Transaction.id)).scalar() or 0
        overpay_txn = Transaction(
            transaction_number=f"TXN{txn_count2 + 2:04d}",
            member_id=loan.member_id,
            transaction_type="deposit",
            account_type="savings",
            amount=overpayment,
            reference=mpesa_ref,
            description=f"Overpayment from loan {loan.application_number} credited to savings"
        )
        tenant_session.add(overpay_txn)

    try:
        from accounting.service import AccountingService, post_loan_repayment
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        member_name = f"{member.first_name} {member.last_name}"
        post_loan_repayment(
            svc,
            member_id=str(member.id),
            loan_id=str(loan.id),
            principal_amount=principal_amount,
            interest_amount=interest_amount,
            penalty_amount=penalty_amount,
            payment_method="mpesa",
            repayment_id=str(repayment.repayment_number),
            description=f"M-Pesa loan repayment - {member_name} - {loan.application_number}"
        )
    except Exception as e:
        print(f"[GL] Failed to post M-Pesa loan repayment to GL: {e}")

    try:
        from routes.repayments import try_send_sms
        if member and member.phone:
            try_send_sms(
                tenant_session,
                "repayment_received",
                member.phone,
                f"{member.first_name} {member.last_name}",
                {
                    "name": member.first_name,
                    "amount": str(amount),
                    "balance": str(loan.outstanding_balance or 0)
                },
                member_id=member.id,
                loan_id=loan.id
            )
    except Exception as e:
        print(f"[SMS] Failed to send repayment SMS: {e}")

    return repayment, None


def find_loan_from_reference(tenant_session, account_ref: str, member=None):
    if not account_ref:
        return None

    ref_upper = account_ref.upper()
    if ref_upper.startswith("LOAN:"):
        loan_id = ref_upper[5:]
        loan = tenant_session.query(LoanApplication).filter(
            LoanApplication.id == loan_id,
            LoanApplication.status == "disbursed"
        ).first()
        if loan:
            return loan

    loan = tenant_session.query(LoanApplication).filter(
        func.upper(LoanApplication.application_number) == ref_upper,
        LoanApplication.status == "disbursed"
    ).first()
    if loan:
        return loan

    if member:
        loan = tenant_session.query(LoanApplication).filter(
            LoanApplication.member_id == member.id,
            LoanApplication.status == "disbursed"
        ).order_by(LoanApplication.created_at.desc()).first()
        return loan

    return None
