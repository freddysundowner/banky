from decimal import Decimal
from datetime import timedelta, date, datetime
from models.tenant import LoanInstalment, LoanApplication, LoanProduct

FREQ_DAYS = {"daily": 1, "weekly": 7, "bi_weekly": 14, "monthly": 30}
PERIODS_PER_YEAR = {"daily": 365, "weekly": 52, "bi_weekly": 26, "monthly": 12}

def _calc_insurance_for_period(balance, cli_rate, cli_freq, freq):
    if not cli_rate or cli_rate <= 0:
        return Decimal("0")
    rate = Decimal(str(cli_rate)) / Decimal("100")
    if cli_freq == "annual":
        periods_yr = PERIODS_PER_YEAR.get(freq, 12)
        return round(balance * rate / Decimal(str(periods_yr)), 2)
    else:
        return round(balance * rate, 2)

def generate_instalment_schedule(tenant_session, loan: LoanApplication, product: LoanProduct):
    term = int(loan.term_months)
    if term <= 0:
        return []
    
    freq = getattr(product, 'repayment_frequency', 'monthly') or 'monthly'
    period_days = FREQ_DAYS.get(freq, 30)
    
    deduct_upfront = bool(getattr(loan, 'interest_deducted_upfront', False))
    interest_type = getattr(product, 'interest_type', 'reducing_balance')
    
    cli_rate = Decimal(str(getattr(loan, 'credit_life_insurance_rate', None) or 0))
    cli_freq = getattr(loan, 'credit_life_insurance_freq', None) or "annual"
    
    disbursed_date = loan.disbursed_at
    if hasattr(disbursed_date, 'date'):
        disbursed_date = disbursed_date.date()
    
    loan_amount = Decimal(str(loan.amount or 0))
    instalments = []
    total_insurance = Decimal("0")
    
    if deduct_upfront:
        principal_per_period = loan_amount / term
        balance = loan_amount
        for i in range(term):
            due = disbursed_date + timedelta(days=period_days * (i + 1))
            ins_amount = _calc_insurance_for_period(balance, cli_rate, cli_freq, freq)
            total_insurance += ins_amount
            inst = LoanInstalment(
                loan_id=str(loan.id),
                instalment_number=i + 1,
                due_date=due,
                expected_principal=round(principal_per_period, 2),
                expected_interest=Decimal("0"),
                expected_insurance=ins_amount,
                status="pending"
            )
            instalments.append(inst)
            balance -= principal_per_period
    elif interest_type == "flat":
        total_interest = Decimal(str(loan.total_interest or 0))
        interest_per_period = total_interest / term
        principal_per_period = loan_amount / term
        balance = loan_amount
        for i in range(term):
            due = disbursed_date + timedelta(days=period_days * (i + 1))
            ins_amount = _calc_insurance_for_period(balance, cli_rate, cli_freq, freq)
            total_insurance += ins_amount
            inst = LoanInstalment(
                loan_id=str(loan.id),
                instalment_number=i + 1,
                due_date=due,
                expected_principal=round(principal_per_period, 2),
                expected_interest=round(interest_per_period, 2),
                expected_insurance=ins_amount,
                status="pending"
            )
            instalments.append(inst)
            balance -= principal_per_period
    else:
        periodic_rate = Decimal(str(loan.interest_rate or 0)) / Decimal("100")
        balance = loan_amount
        monthly_repayment = Decimal(str(loan.monthly_repayment or 0))
        total_payment = monthly_repayment if monthly_repayment > 0 else (loan_amount / term)
        for i in range(term):
            due = disbursed_date + timedelta(days=period_days * (i + 1))
            interest_portion = round(balance * periodic_rate, 2)
            ins_amount = _calc_insurance_for_period(balance, cli_rate, cli_freq, freq)
            total_insurance += ins_amount
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
                expected_insurance=ins_amount,
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
    
    if total_insurance > 0:
        loan.total_insurance = round(total_insurance, 2)
    
    for inst in instalments:
        tenant_session.add(inst)
    
    return instalments


def regenerate_instalments_after_restructure(tenant_session, loan: LoanApplication, product: LoanProduct):
    from sqlalchemy import and_

    completed_instalments = tenant_session.query(LoanInstalment).filter(
        LoanInstalment.loan_id == str(loan.id),
        LoanInstalment.status.in_(["paid", "partial"])
    ).order_by(LoanInstalment.instalment_number).all()

    preserved_principal = sum(Decimal(str(i.expected_principal)) for i in completed_instalments)
    preserved_interest = sum(Decimal(str(i.expected_interest)) for i in completed_instalments)
    preserved_insurance = sum(Decimal(str(getattr(i, 'expected_insurance', None) or 0)) for i in completed_instalments)
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

    cli_rate = Decimal(str(getattr(loan, 'credit_life_insurance_rate', None) or 0))
    cli_freq = getattr(loan, 'credit_life_insurance_freq', None) or "annual"

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
    new_insurance_total = Decimal("0")

    if deduct_upfront:
        principal_per_period = remaining_principal / remaining_term
        balance = remaining_principal
        for i in range(remaining_term):
            due = last_due_date + timedelta(days=period_days * (i + 1))
            ins_amount = _calc_insurance_for_period(balance, cli_rate, cli_freq, freq)
            new_insurance_total += ins_amount
            inst = LoanInstalment(
                loan_id=str(loan.id),
                instalment_number=paid_count + i + 1,
                due_date=due,
                expected_principal=round(principal_per_period, 2),
                expected_interest=Decimal("0"),
                expected_insurance=ins_amount,
                status="pending"
            )
            new_instalments.append(inst)
            balance -= principal_per_period
    elif interest_type == "flat":
        interest_per_period = remaining_interest / remaining_term if remaining_term > 0 else Decimal("0")
        principal_per_period = remaining_principal / remaining_term if remaining_term > 0 else Decimal("0")
        balance = remaining_principal
        for i in range(remaining_term):
            due = last_due_date + timedelta(days=period_days * (i + 1))
            ins_amount = _calc_insurance_for_period(balance, cli_rate, cli_freq, freq)
            new_insurance_total += ins_amount
            inst = LoanInstalment(
                loan_id=str(loan.id),
                instalment_number=paid_count + i + 1,
                due_date=due,
                expected_principal=round(principal_per_period, 2),
                expected_interest=round(interest_per_period, 2),
                expected_insurance=ins_amount,
                status="pending"
            )
            new_instalments.append(inst)
            balance -= principal_per_period
    else:
        periodic_rate = Decimal(str(loan.interest_rate or 0)) / Decimal("100")
        balance = remaining_principal
        monthly_repayment = Decimal(str(loan.monthly_repayment or 0))
        total_payment = monthly_repayment if monthly_repayment > 0 else (remaining_principal / remaining_term)
        for i in range(remaining_term):
            due = last_due_date + timedelta(days=period_days * (i + 1))
            interest_portion = round(balance * periodic_rate, 2)
            ins_amount = _calc_insurance_for_period(balance, cli_rate, cli_freq, freq)
            new_insurance_total += ins_amount
            if i == remaining_term - 1:
                principal_portion = balance
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
                expected_insurance=ins_amount,
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

    loan.total_insurance = round(preserved_insurance + new_insurance_total, 2)

    for inst in new_instalments:
        tenant_session.add(inst)

    tenant_session.flush()


def allocate_payment_to_instalments(tenant_session, loan: LoanApplication, payment_amount: Decimal):
    remaining = payment_amount
    total_principal = Decimal("0")
    total_interest = Decimal("0")
    total_penalty = Decimal("0")
    total_insurance = Decimal("0")
    
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
        
        insurance_due = Decimal(str(getattr(inst, 'expected_insurance', None) or 0)) - Decimal(str(getattr(inst, 'paid_insurance', None) or 0))
        if insurance_due > 0 and remaining > 0:
            pay_insurance = min(remaining, insurance_due)
            inst.paid_insurance = Decimal(str(getattr(inst, 'paid_insurance', None) or 0)) + pay_insurance
            remaining -= pay_insurance
            total_insurance += pay_insurance
        
        principal_due = Decimal(str(inst.expected_principal or 0)) - Decimal(str(inst.paid_principal or 0))
        if principal_due > 0 and remaining > 0:
            pay_principal = min(remaining, principal_due)
            inst.paid_principal = Decimal(str(inst.paid_principal or 0)) + pay_principal
            remaining -= pay_principal
            total_principal += pay_principal
        
        total_due = (Decimal(str(inst.expected_principal or 0)) + Decimal(str(inst.expected_interest or 0)) + 
                     Decimal(str(inst.expected_penalty or 0)) + Decimal(str(getattr(inst, 'expected_insurance', None) or 0)))
        total_paid = (Decimal(str(inst.paid_principal or 0)) + Decimal(str(inst.paid_interest or 0)) + 
                      Decimal(str(inst.paid_penalty or 0)) + Decimal(str(getattr(inst, 'paid_insurance', None) or 0)))
        if total_paid >= total_due:
            inst.status = "paid"
            inst.paid_at = datetime.utcnow()
        elif total_paid > 0:
            inst.status = "partial"
    
    return total_principal, total_interest, total_penalty, total_insurance, remaining


def backfill_instalments_for_loan(tenant_session, loan: LoanApplication, product: LoanProduct):
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
            
            insurance_due = Decimal(str(getattr(inst, 'expected_insurance', None) or 0)) - Decimal(str(getattr(inst, 'paid_insurance', None) or 0))
            if insurance_due > 0 and remaining > 0:
                pay = min(remaining, insurance_due)
                inst.paid_insurance = Decimal(str(getattr(inst, 'paid_insurance', None) or 0)) + pay
                remaining -= pay
            
            principal_due = Decimal(str(inst.expected_principal or 0)) - Decimal(str(inst.paid_principal or 0))
            if principal_due > 0 and remaining > 0:
                pay = min(remaining, principal_due)
                inst.paid_principal = Decimal(str(inst.paid_principal or 0)) + pay
                remaining -= pay
            
            total_due = (Decimal(str(inst.expected_principal or 0)) + Decimal(str(inst.expected_interest or 0)) + 
                         Decimal(str(inst.expected_penalty or 0)) + Decimal(str(getattr(inst, 'expected_insurance', None) or 0)))
            total_paid = (Decimal(str(inst.paid_principal or 0)) + Decimal(str(inst.paid_interest or 0)) + 
                          Decimal(str(inst.paid_penalty or 0)) + Decimal(str(getattr(inst, 'paid_insurance', None) or 0)))
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
