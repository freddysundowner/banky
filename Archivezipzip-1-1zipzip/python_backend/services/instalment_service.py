from decimal import Decimal
from datetime import timedelta, date, datetime
from models.tenant import LoanInstalment, LoanApplication, LoanProduct

FREQ_DAYS = {"daily": 1, "weekly": 7, "bi_weekly": 14, "monthly": 30}

def generate_instalment_schedule(tenant_session, loan: LoanApplication, product: LoanProduct):
    """Generate instalment records when a loan is disbursed."""
    term = loan.term_months
    if term <= 0:
        return []
    
    freq = getattr(product, 'repayment_frequency', 'monthly') or 'monthly'
    period_days = FREQ_DAYS.get(freq, 30)
    
    deduct_upfront = getattr(loan, 'interest_deducted_upfront', False)
    interest_type = getattr(product, 'interest_type', 'reducing_balance')
    
    disbursed_date = loan.disbursed_at
    if hasattr(disbursed_date, 'date'):
        disbursed_date = disbursed_date.date()
    
    instalments = []
    
    if deduct_upfront:
        principal_per_period = loan.amount / term
        for i in range(term):
            due = disbursed_date + timedelta(days=period_days * (i + 1))
            inst = LoanInstalment(
                loan_id=str(loan.id),
                instalment_number=i + 1,
                due_date=due,
                expected_principal=round(principal_per_period, 2),
                expected_interest=Decimal("0"),
                status="pending"
            )
            instalments.append(inst)
    elif interest_type == "flat":
        total_interest = loan.total_interest or Decimal("0")
        interest_per_period = total_interest / term
        principal_per_period = loan.amount / term
        for i in range(term):
            due = disbursed_date + timedelta(days=period_days * (i + 1))
            inst = LoanInstalment(
                loan_id=str(loan.id),
                instalment_number=i + 1,
                due_date=due,
                expected_principal=round(principal_per_period, 2),
                expected_interest=round(interest_per_period, 2),
                status="pending"
            )
            instalments.append(inst)
    else:
        periodic_rate = loan.interest_rate / Decimal("100")
        balance = loan.amount
        total_payment = loan.monthly_repayment or (loan.amount / term)
        for i in range(term):
            due = disbursed_date + timedelta(days=period_days * (i + 1))
            interest_portion = round(balance * periodic_rate, 2)
            if i == term - 1:
                principal_portion = balance
                interest_portion = max(total_payment - balance, Decimal("0"))
            else:
                principal_portion = total_payment - interest_portion
                if principal_portion > balance:
                    principal_portion = balance
                    interest_portion = total_payment - principal_portion
            inst = LoanInstalment(
                loan_id=str(loan.id),
                instalment_number=i + 1,
                due_date=due,
                expected_principal=round(max(principal_portion, Decimal("0")), 2),
                expected_interest=round(max(interest_portion, Decimal("0")), 2),
                status="pending"
            )
            instalments.append(inst)
            balance -= principal_portion
    
    if instalments:
        total_expected_principal = sum(i.expected_principal for i in instalments)
        principal_diff = loan.amount - total_expected_principal
        if principal_diff != 0:
            instalments[-1].expected_principal += principal_diff
        
        if not deduct_upfront:
            total_expected_interest = sum(i.expected_interest for i in instalments)
            expected_total_interest = loan.total_interest or Decimal("0")
            interest_diff = expected_total_interest - total_expected_interest
            if interest_diff != 0 and abs(interest_diff) < instalments[-1].expected_interest:
                instalments[-1].expected_interest += interest_diff
    
    for inst in instalments:
        tenant_session.add(inst)
    
    return instalments


def regenerate_instalments_after_restructure(tenant_session, loan: LoanApplication, product: LoanProduct):
    """Delete unpaid instalments and regenerate them for the new loan terms after restructuring.
    Preserves paid/partial instalments and creates new ones for the remaining balance."""
    from sqlalchemy import and_

    completed_instalments = tenant_session.query(LoanInstalment).filter(
        LoanInstalment.loan_id == str(loan.id),
        LoanInstalment.status.in_(["paid", "partial"])
    ).order_by(LoanInstalment.instalment_number).all()

    preserved_principal = sum(i.expected_principal for i in completed_instalments)
    preserved_interest = sum(i.expected_interest for i in completed_instalments)
    paid_count = len(completed_instalments)

    tenant_session.query(LoanInstalment).filter(
        LoanInstalment.loan_id == str(loan.id),
        LoanInstalment.status.in_(["pending", "overdue"])
    ).delete(synchronize_session="fetch")

    remaining_term = loan.term_months - paid_count
    if remaining_term <= 0:
        return

    freq = getattr(product, 'repayment_frequency', 'monthly') or 'monthly'
    period_days = FREQ_DAYS.get(freq, 30)
    interest_type = getattr(product, 'interest_type', 'reducing_balance')
    deduct_upfront = getattr(loan, 'interest_deducted_upfront', False)

    remaining_principal = loan.amount - preserved_principal
    remaining_interest = (loan.total_interest or Decimal("0")) - preserved_interest

    last_due_date = completed_instalments[-1].due_date if completed_instalments else None
    if last_due_date is None:
        disbursed_date = loan.disbursed_at
        if hasattr(disbursed_date, 'date'):
            disbursed_date = disbursed_date.date()
        last_due_date = disbursed_date

    new_instalments = []
    if deduct_upfront:
        principal_per_period = remaining_principal / remaining_term
        for i in range(remaining_term):
            due = last_due_date + timedelta(days=period_days * (i + 1))
            inst = LoanInstalment(
                loan_id=str(loan.id),
                instalment_number=paid_count + i + 1,
                due_date=due,
                expected_principal=round(principal_per_period, 2),
                expected_interest=Decimal("0"),
                status="pending"
            )
            new_instalments.append(inst)
    elif interest_type == "flat":
        interest_per_period = remaining_interest / remaining_term if remaining_term > 0 else Decimal("0")
        principal_per_period = remaining_principal / remaining_term if remaining_term > 0 else Decimal("0")
        for i in range(remaining_term):
            due = last_due_date + timedelta(days=period_days * (i + 1))
            inst = LoanInstalment(
                loan_id=str(loan.id),
                instalment_number=paid_count + i + 1,
                due_date=due,
                expected_principal=round(principal_per_period, 2),
                expected_interest=round(interest_per_period, 2),
                status="pending"
            )
            new_instalments.append(inst)
    else:
        periodic_rate = loan.interest_rate / Decimal("100")
        balance = remaining_principal
        total_payment = loan.monthly_repayment or (remaining_principal / remaining_term)
        for i in range(remaining_term):
            due = last_due_date + timedelta(days=period_days * (i + 1))
            interest_portion = round(balance * periodic_rate, 2)
            if i == remaining_term - 1:
                principal_portion = balance
                interest_portion = max(total_payment - balance, Decimal("0"))
            else:
                principal_portion = total_payment - interest_portion
                if principal_portion > balance:
                    principal_portion = balance
                    interest_portion = total_payment - principal_portion
            inst = LoanInstalment(
                loan_id=str(loan.id),
                instalment_number=paid_count + i + 1,
                due_date=due,
                expected_principal=round(max(principal_portion, Decimal("0")), 2),
                expected_interest=round(max(interest_portion, Decimal("0")), 2),
                status="pending"
            )
            new_instalments.append(inst)
            balance -= principal_portion

    if new_instalments:
        total_expected_principal = sum(i.expected_principal for i in new_instalments)
        principal_diff = remaining_principal - total_expected_principal
        if principal_diff != 0:
            new_instalments[-1].expected_principal += principal_diff

        if not deduct_upfront and remaining_interest > 0:
            total_expected_interest = sum(i.expected_interest for i in new_instalments)
            interest_diff = remaining_interest - total_expected_interest
            if interest_diff != 0 and abs(interest_diff) < abs(new_instalments[-1].expected_interest or Decimal("1")):
                new_instalments[-1].expected_interest += interest_diff

    for inst in new_instalments:
        tenant_session.add(inst)

    tenant_session.flush()


def allocate_payment_to_instalments(tenant_session, loan: LoanApplication, payment_amount: Decimal):
    """Allocate a payment to the earliest unpaid instalments.
    Priority: penalties -> interest -> principal.
    Returns (total_principal, total_interest, total_penalty) allocated."""
    remaining = payment_amount
    total_principal = Decimal("0")
    total_interest = Decimal("0")
    total_penalty = Decimal("0")
    
    unpaid = tenant_session.query(LoanInstalment).filter(
        LoanInstalment.loan_id == str(loan.id),
        LoanInstalment.status.in_(["pending", "partial", "overdue"])
    ).order_by(LoanInstalment.instalment_number).all()
    
    for inst in unpaid:
        if remaining <= 0:
            break
        
        penalty_due = inst.expected_penalty - inst.paid_penalty
        if penalty_due > 0:
            pay_penalty = min(remaining, penalty_due)
            inst.paid_penalty += pay_penalty
            remaining -= pay_penalty
            total_penalty += pay_penalty
        
        interest_due = inst.expected_interest - inst.paid_interest
        if interest_due > 0 and remaining > 0:
            pay_interest = min(remaining, interest_due)
            inst.paid_interest += pay_interest
            remaining -= pay_interest
            total_interest += pay_interest
        
        principal_due = inst.expected_principal - inst.paid_principal
        if principal_due > 0 and remaining > 0:
            pay_principal = min(remaining, principal_due)
            inst.paid_principal += pay_principal
            remaining -= pay_principal
            total_principal += pay_principal
        
        total_due = inst.expected_principal + inst.expected_interest + inst.expected_penalty
        total_paid = inst.paid_principal + inst.paid_interest + inst.paid_penalty
        if total_paid >= total_due:
            inst.status = "paid"
            inst.paid_at = datetime.utcnow()
        elif total_paid > 0:
            inst.status = "partial"
    
    return total_principal, total_interest, total_penalty, remaining


def backfill_instalments_for_loan(tenant_session, loan: LoanApplication, product: LoanProduct):
    """Generate instalment schedule for an existing disbursed loan and apply historical repayments."""
    from models.tenant import LoanRepayment
    
    existing = tenant_session.query(LoanInstalment).filter(
        LoanInstalment.loan_id == str(loan.id)
    ).count()
    if existing > 0:
        return
    
    instalments = generate_instalment_schedule(tenant_session, loan, product)
    tenant_session.flush()
    
    repayments = tenant_session.query(LoanRepayment).filter(
        LoanRepayment.loan_id == str(loan.id)
    ).order_by(LoanRepayment.payment_date).all()
    
    for rep in repayments:
        remaining = rep.amount
        unpaid = tenant_session.query(LoanInstalment).filter(
            LoanInstalment.loan_id == str(loan.id),
            LoanInstalment.status.in_(["pending", "partial", "overdue"])
        ).order_by(LoanInstalment.instalment_number).all()
        
        for inst in unpaid:
            if remaining <= 0:
                break
            
            penalty_due = inst.expected_penalty - inst.paid_penalty
            if penalty_due > 0:
                pay = min(remaining, penalty_due)
                inst.paid_penalty += pay
                remaining -= pay
            
            interest_due = inst.expected_interest - inst.paid_interest
            if interest_due > 0 and remaining > 0:
                pay = min(remaining, interest_due)
                inst.paid_interest += pay
                remaining -= pay
            
            principal_due = inst.expected_principal - inst.paid_principal
            if principal_due > 0 and remaining > 0:
                pay = min(remaining, principal_due)
                inst.paid_principal += pay
                remaining -= pay
            
            total_due = inst.expected_principal + inst.expected_interest + inst.expected_penalty
            total_paid = inst.paid_principal + inst.paid_interest + inst.paid_penalty
            if total_paid >= total_due:
                inst.status = "paid"
                inst.paid_at = rep.payment_date
            elif total_paid > 0:
                inst.status = "partial"
    
    today = date.today()
    for inst in instalments:
        if inst.status in ("pending", "partial") and inst.due_date < today:
            inst.status = "overdue"
    
    tenant_session.flush()
