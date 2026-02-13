from decimal import Decimal
from datetime import timedelta, date, datetime
from models.tenant import LoanInstalment, LoanApplication, LoanProduct

FREQ_DAYS = {"daily": 1, "weekly": 7, "bi_weekly": 14, "monthly": 30}

def generate_instalment_schedule(tenant_session, loan: LoanApplication, product: LoanProduct):
    """Generate instalment records when a loan is disbursed."""
    term = int(loan.term_months)
    if term <= 0:
        return []
    
    freq = getattr(product, 'repayment_frequency', 'monthly') or 'monthly'
    period_days = FREQ_DAYS.get(freq, 30)
    
    deduct_upfront = bool(getattr(loan, 'interest_deducted_upfront', False))
    interest_type = getattr(product, 'interest_type', 'reducing_balance')
    
    disbursed_date = loan.disbursed_at
    if hasattr(disbursed_date, 'date'):
        disbursed_date = disbursed_date.date()
    
    loan_amount = Decimal(str(loan.amount or 0))
    instalments = []
    
    if deduct_upfront:
        principal_per_period = loan_amount / term
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
        total_interest = Decimal(str(loan.total_interest or 0))
        interest_per_period = total_interest / term
        principal_per_period = loan_amount / term
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
        periodic_rate = Decimal(str(loan.interest_rate or 0)) / Decimal("100")
        balance = loan_amount
        monthly_repayment = Decimal(str(loan.monthly_repayment or 0))
        total_payment = monthly_repayment if monthly_repayment > 0 else (loan_amount / term)
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
        total_expected_principal = sum(Decimal(str(i.expected_principal)) for i in instalments)
        principal_diff = loan_amount - total_expected_principal
        if principal_diff != 0:
            instalments[-1].expected_principal = Decimal(str(instalments[-1].expected_principal)) + principal_diff
        
        if not deduct_upfront:
            total_expected_interest = sum(Decimal(str(i.expected_interest)) for i in instalments)
            expected_total_interest = Decimal(str(loan.total_interest or 0))
            interest_diff = expected_total_interest - total_expected_interest
            last_interest = Decimal(str(instalments[-1].expected_interest))
            if interest_diff != 0 and abs(interest_diff) < last_interest:
                instalments[-1].expected_interest = last_interest + interest_diff
    
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

    preserved_principal = sum(Decimal(str(i.expected_principal)) for i in completed_instalments)
    preserved_interest = sum(Decimal(str(i.expected_interest)) for i in completed_instalments)
    paid_count = len(completed_instalments)

    tenant_session.query(LoanInstalment).filter(
        LoanInstalment.loan_id == str(loan.id),
        LoanInstalment.status.in_(["pending", "overdue"])
    ).delete(synchronize_session="fetch")

    remaining_term = int(loan.term_months) - paid_count
    if remaining_term <= 0:
        return

    freq = getattr(product, 'repayment_frequency', 'monthly') or 'monthly'
    period_days = FREQ_DAYS.get(freq, 30)
    interest_type = getattr(product, 'interest_type', 'reducing_balance')
    deduct_upfront = bool(getattr(loan, 'interest_deducted_upfront', False))

    loan_amount = Decimal(str(loan.amount or 0))
    remaining_principal = loan_amount - preserved_principal
    remaining_interest = Decimal(str(loan.total_interest or 0)) - preserved_interest

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
        periodic_rate = Decimal(str(loan.interest_rate or 0)) / Decimal("100")
        balance = remaining_principal
        monthly_repayment = Decimal(str(loan.monthly_repayment or 0))
        total_payment = monthly_repayment if monthly_repayment > 0 else (remaining_principal / remaining_term)
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
        total_expected_principal = sum(Decimal(str(i.expected_principal)) for i in new_instalments)
        principal_diff = remaining_principal - total_expected_principal
        if principal_diff != 0:
            new_instalments[-1].expected_principal = Decimal(str(new_instalments[-1].expected_principal)) + principal_diff

        if not deduct_upfront and remaining_interest > 0:
            total_expected_interest = sum(Decimal(str(i.expected_interest)) for i in new_instalments)
            interest_diff = remaining_interest - total_expected_interest
            last_interest = Decimal(str(new_instalments[-1].expected_interest or 0))
            if interest_diff != 0 and abs(interest_diff) < abs(last_interest or Decimal("1")):
                new_instalments[-1].expected_interest = last_interest + interest_diff

    for inst in new_instalments:
        tenant_session.add(inst)

    tenant_session.flush()


def allocate_payment_to_instalments(tenant_session, loan: LoanApplication, payment_amount: Decimal):
    """Allocate a payment to the earliest unpaid instalments.
    Priority: penalties -> interest -> principal.
    Returns (total_principal, total_interest, total_penalty, overpayment) allocated."""
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
        
        penalty_due = Decimal(str(inst.expected_penalty or 0)) - Decimal(str(inst.paid_penalty or 0))
        if penalty_due > 0:
            pay_penalty = min(remaining, penalty_due)
            inst.paid_penalty = Decimal(str(inst.paid_penalty or 0)) + pay_penalty
            remaining -= pay_penalty
            total_penalty += pay_penalty
        
        interest_due = Decimal(str(inst.expected_interest or 0)) - Decimal(str(inst.paid_interest or 0))
        if interest_due > 0 and remaining > 0:
            pay_interest = min(remaining, interest_due)
            inst.paid_interest = Decimal(str(inst.paid_interest or 0)) + pay_interest
            remaining -= pay_interest
            total_interest += pay_interest
        
        principal_due = Decimal(str(inst.expected_principal or 0)) - Decimal(str(inst.paid_principal or 0))
        if principal_due > 0 and remaining > 0:
            pay_principal = min(remaining, principal_due)
            inst.paid_principal = Decimal(str(inst.paid_principal or 0)) + pay_principal
            remaining -= pay_principal
            total_principal += pay_principal
        
        total_due = Decimal(str(inst.expected_principal or 0)) + Decimal(str(inst.expected_interest or 0)) + Decimal(str(inst.expected_penalty or 0))
        total_paid = Decimal(str(inst.paid_principal or 0)) + Decimal(str(inst.paid_interest or 0)) + Decimal(str(inst.paid_penalty or 0))
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
        remaining = Decimal(str(rep.amount or 0))
        unpaid = tenant_session.query(LoanInstalment).filter(
            LoanInstalment.loan_id == str(loan.id),
            LoanInstalment.status.in_(["pending", "partial", "overdue"])
        ).order_by(LoanInstalment.instalment_number).all()
        
        for inst in unpaid:
            if remaining <= 0:
                break
            
            penalty_due = Decimal(str(inst.expected_penalty or 0)) - Decimal(str(inst.paid_penalty or 0))
            if penalty_due > 0:
                pay = min(remaining, penalty_due)
                inst.paid_penalty = Decimal(str(inst.paid_penalty or 0)) + pay
                remaining -= pay
            
            interest_due = Decimal(str(inst.expected_interest or 0)) - Decimal(str(inst.paid_interest or 0))
            if interest_due > 0 and remaining > 0:
                pay = min(remaining, interest_due)
                inst.paid_interest = Decimal(str(inst.paid_interest or 0)) + pay
                remaining -= pay
            
            principal_due = Decimal(str(inst.expected_principal or 0)) - Decimal(str(inst.paid_principal or 0))
            if principal_due > 0 and remaining > 0:
                pay = min(remaining, principal_due)
                inst.paid_principal = Decimal(str(inst.paid_principal or 0)) + pay
                remaining -= pay
            
            total_due = Decimal(str(inst.expected_principal or 0)) + Decimal(str(inst.expected_interest or 0)) + Decimal(str(inst.expected_penalty or 0))
            total_paid = Decimal(str(inst.paid_principal or 0)) + Decimal(str(inst.paid_interest or 0)) + Decimal(str(inst.paid_penalty or 0))
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
