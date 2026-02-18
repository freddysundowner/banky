from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime, date, time
from decimal import Decimal

# Branch schemas
class BranchCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class BranchResponse(BaseModel):
    id: str
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Staff schemas
class StaffCreate(BaseModel):
    first_name: str
    last_name: str
    username: str  # Will be combined with org domain to create email
    secondary_email: Optional[str] = None  # CC email for payslips
    phone: Optional[str] = None
    role: Optional[str] = "staff"
    branch_id: Optional[str] = None
    password: str
    national_id: str
    date_of_birth: str
    gender: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    next_of_kin_relationship: Optional[str] = None

class StaffUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    secondary_email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: Optional[bool] = None
    is_locked: Optional[bool] = None
    national_id: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    next_of_kin_relationship: Optional[str] = None

class StaffResponse(BaseModel):
    id: str
    staff_number: str
    first_name: str
    last_name: str
    email: str
    secondary_email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    branch_id: Optional[str] = None
    is_active: bool
    is_locked: bool = False
    last_login: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Member schemas
class MemberCreate(BaseModel):
    # Personal Information
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    phone_secondary: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    kra_pin: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = "Kenyan"
    
    # Address Information
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = "Kenya"
    
    # Next of Kin 1
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    next_of_kin_relationship: Optional[str] = None
    next_of_kin_id_number: Optional[str] = None
    next_of_kin_address: Optional[str] = None
    
    # Next of Kin 2
    next_of_kin_2_name: Optional[str] = None
    next_of_kin_2_phone: Optional[str] = None
    next_of_kin_2_relationship: Optional[str] = None
    
    # Employment Information
    employment_status: Optional[str] = None
    employer_name: Optional[str] = None
    employer_address: Optional[str] = None
    employer_phone: Optional[str] = None
    occupation: Optional[str] = None
    monthly_income: Optional[Decimal] = None
    employment_date: Optional[date] = None
    
    # Bank Details
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    
    # Membership Details
    branch_id: Optional[str] = None
    membership_type: Optional[str] = "ordinary"
    registration_fee_paid: Optional[Decimal] = None
    share_capital: Optional[Decimal] = None
    
    # Documents
    photo_url: Optional[str] = None
    id_document_url: Optional[str] = None
    signature_url: Optional[str] = None

class MemberUpdate(BaseModel):
    # Personal Information
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    phone_secondary: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    kra_pin: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    
    # Address Information
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    
    # Next of Kin 1
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    next_of_kin_relationship: Optional[str] = None
    next_of_kin_id_number: Optional[str] = None
    next_of_kin_address: Optional[str] = None
    
    # Next of Kin 2
    next_of_kin_2_name: Optional[str] = None
    next_of_kin_2_phone: Optional[str] = None
    next_of_kin_2_relationship: Optional[str] = None
    
    # Employment Information
    employment_status: Optional[str] = None
    employer_name: Optional[str] = None
    employer_address: Optional[str] = None
    employer_phone: Optional[str] = None
    occupation: Optional[str] = None
    monthly_income: Optional[Decimal] = None
    employment_date: Optional[date] = None
    
    # Bank Details
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    
    # Membership Details
    branch_id: Optional[str] = None
    membership_type: Optional[str] = None
    registration_fee_paid: Optional[Decimal] = None
    share_capital: Optional[Decimal] = None
    
    # Documents
    photo_url: Optional[str] = None
    id_document_url: Optional[str] = None
    signature_url: Optional[str] = None
    
    # Status
    status: Optional[str] = None
    is_active: Optional[bool] = None

class MemberResponse(BaseModel):
    id: str
    member_number: str
    
    # Personal Information
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    phone_secondary: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    kra_pin: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: Optional[str] = None
    
    # Address Information
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    country: Optional[str] = None
    
    # Next of Kin 1
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    next_of_kin_relationship: Optional[str] = None
    next_of_kin_id_number: Optional[str] = None
    next_of_kin_address: Optional[str] = None
    
    # Next of Kin 2
    next_of_kin_2_name: Optional[str] = None
    next_of_kin_2_phone: Optional[str] = None
    next_of_kin_2_relationship: Optional[str] = None
    
    # Employment Information
    employment_status: Optional[str] = None
    employer_name: Optional[str] = None
    employer_address: Optional[str] = None
    employer_phone: Optional[str] = None
    occupation: Optional[str] = None
    monthly_income: Optional[Decimal] = None
    employment_date: Optional[date] = None
    
    # Bank Details
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    
    # Membership Details
    branch_id: Optional[str] = None
    membership_type: Optional[str] = None
    registration_fee_paid: Optional[Decimal] = None
    share_capital: Optional[Decimal] = None
    
    # Account Balances
    savings_balance: Optional[Decimal] = Decimal("0")
    shares_balance: Optional[Decimal] = Decimal("0")
    deposits_balance: Optional[Decimal] = Decimal("0")
    
    # Status and Dates
    status: str = "active"
    is_active: bool
    joined_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    created_by_id: Optional[str] = None
    
    # Documents
    photo_url: Optional[str] = None
    id_document_url: Optional[str] = None
    signature_url: Optional[str] = None
    
    class Config:
        from_attributes = True

# Transaction schemas
class TransactionCreate(BaseModel):
    member_id: str
    transaction_type: str
    account_type: str
    amount: Decimal
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    description: Optional[str] = None
    teller_id: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str
    transaction_number: str
    member_id: str
    transaction_type: str
    account_type: str
    amount: Decimal
    balance_before: Optional[Decimal] = None
    balance_after: Optional[Decimal] = None
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    description: Optional[str] = None
    processed_by_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Loan Product schemas
class LoanProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    interest_rate: Decimal
    interest_rate_period: Optional[str] = "monthly"
    interest_type: Optional[str] = "reducing_balance"
    repayment_frequency: Optional[str] = "monthly"
    min_amount: Decimal
    max_amount: Decimal
    min_term_months: Optional[int] = 1
    max_term_months: Optional[int] = 60
    processing_fee: Optional[Decimal] = Decimal("0")
    insurance_fee: Optional[Decimal] = Decimal("0")
    appraisal_fee: Optional[Decimal] = Decimal("0")
    excise_duty_rate: Optional[Decimal] = Decimal("20")
    credit_life_insurance_rate: Optional[Decimal] = Decimal("0")
    credit_life_insurance_freq: Optional[str] = "annual"
    late_payment_penalty: Optional[Decimal] = Decimal("0")
    grace_period_days: Optional[int] = 0
    requires_guarantor: Optional[bool] = False
    min_guarantors: Optional[int] = 0
    max_guarantors: Optional[int] = 3
    shares_multiplier: Optional[Decimal] = Decimal("0")
    min_shares_required: Optional[Decimal] = Decimal("0")
    deduct_interest_upfront: Optional[bool] = False
    allow_multiple_loans: Optional[bool] = True
    require_good_standing: Optional[bool] = False

class LoanProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    interest_rate: Optional[Decimal] = None
    interest_rate_period: Optional[str] = None
    interest_type: Optional[str] = None
    repayment_frequency: Optional[str] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    min_term_months: Optional[int] = None
    max_term_months: Optional[int] = None
    processing_fee: Optional[Decimal] = None
    insurance_fee: Optional[Decimal] = None
    appraisal_fee: Optional[Decimal] = None
    excise_duty_rate: Optional[Decimal] = None
    credit_life_insurance_rate: Optional[Decimal] = None
    credit_life_insurance_freq: Optional[str] = None
    late_payment_penalty: Optional[Decimal] = None
    grace_period_days: Optional[int] = None
    requires_guarantor: Optional[bool] = None
    min_guarantors: Optional[int] = None
    max_guarantors: Optional[int] = None
    shares_multiplier: Optional[Decimal] = None
    min_shares_required: Optional[Decimal] = None
    deduct_interest_upfront: Optional[bool] = None
    allow_multiple_loans: Optional[bool] = None
    require_good_standing: Optional[bool] = None
    is_active: Optional[bool] = None

class LoanProductResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    interest_rate: Decimal
    interest_rate_period: str = "monthly"
    interest_type: str
    repayment_frequency: str = "monthly"
    min_amount: Decimal
    max_amount: Decimal
    min_term_months: int
    max_term_months: int
    processing_fee: Optional[Decimal] = Decimal("0")
    insurance_fee: Optional[Decimal] = Decimal("0")
    appraisal_fee: Optional[Decimal] = Decimal("0")
    excise_duty_rate: Optional[Decimal] = Decimal("20")
    credit_life_insurance_rate: Optional[Decimal] = Decimal("0")
    credit_life_insurance_freq: Optional[str] = "annual"
    late_payment_penalty: Optional[Decimal] = Decimal("0")
    grace_period_days: Optional[int] = 0
    requires_guarantor: Optional[bool] = False
    min_guarantors: Optional[int] = 0
    max_guarantors: Optional[int] = 3
    shares_multiplier: Optional[Decimal] = Decimal("0")
    min_shares_required: Optional[Decimal] = Decimal("0")
    deduct_interest_upfront: Optional[bool] = False
    allow_multiple_loans: Optional[bool] = True
    require_good_standing: Optional[bool] = False
    is_active: bool
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Loan Guarantor schemas
class LoanGuarantorCreate(BaseModel):
    guarantor_id: str
    amount_guaranteed: Decimal
    relationship_to_borrower: Optional[str] = None  # spouse, family, colleague, friend, business_partner, other

class LoanGuarantorReject(BaseModel):
    rejection_reason: str

class LoanGuarantorResponse(BaseModel):
    id: str
    loan_id: str
    guarantor_id: str
    amount_guaranteed: Decimal
    guarantee_percentage: Optional[Decimal] = None
    relationship_to_borrower: Optional[str] = None
    
    # Guarantor's financial snapshot
    guarantor_savings_at_guarantee: Optional[Decimal] = None
    guarantor_shares_at_guarantee: Optional[Decimal] = None
    guarantor_total_exposure_at_guarantee: Optional[Decimal] = None
    available_guarantee_capacity: Optional[Decimal] = None
    
    # Status
    status: str
    rejection_reason: Optional[str] = None
    
    # Timestamps
    accepted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    called_at: Optional[datetime] = None
    
    # Recovery
    amount_recovered: Optional[Decimal] = None
    
    # Consent
    consent_given: Optional[bool] = None
    consent_date: Optional[datetime] = None
    consent_method: Optional[str] = None
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    guarantor: Optional[MemberResponse] = None
    
    class Config:
        from_attributes = True

class MemberGuaranteeEligibility(BaseModel):
    member_id: str
    member_name: str
    member_number: str
    is_eligible: bool
    eligibility_reasons: List[str]
    
    # Financial position
    savings_balance: Decimal
    shares_balance: Decimal
    total_deposits: Decimal
    
    # Exposure
    current_guarantee_exposure: Decimal  # Total amount currently guaranteeing
    active_guarantees_count: int
    max_guarantee_capacity: Decimal  # Usually 3x savings
    available_guarantee_capacity: Decimal
    
    # Member status
    member_status: str
    has_defaulted_loans: bool
    has_active_loans: bool
    
    class Config:
        from_attributes = True

# Loan Application schemas
class LoanExtraChargeCreate(BaseModel):
    charge_name: str
    amount: Decimal

    @validator('charge_name')
    def charge_name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Charge name is required')
        return v.strip()

    @validator('amount')
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError('Charge amount must be greater than 0')
        return v

class LoanExtraChargeResponse(BaseModel):
    id: str
    loan_id: str
    charge_name: str
    amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True

class LoanApplicationCreate(BaseModel):
    member_id: str
    loan_product_id: str
    amount: Decimal
    term_months: int
    purpose: Optional[str] = None
    disbursement_method: Optional[str] = None
    disbursement_account: Optional[str] = None
    disbursement_phone: Optional[str] = None
    guarantors: Optional[List[LoanGuarantorCreate]] = None
    extra_charges: Optional[List[LoanExtraChargeCreate]] = None

class LoanApplicationUpdate(BaseModel):
    loan_product_id: Optional[str] = None
    amount: Optional[Decimal] = None
    term_months: Optional[int] = None
    purpose: Optional[str] = None
    disbursement_method: Optional[str] = None
    disbursement_account: Optional[str] = None
    disbursement_phone: Optional[str] = None

class LoanApplicationAction(BaseModel):
    action: str
    reason: Optional[str] = None

class LoanDisbursement(BaseModel):
    disbursement_method: str
    disbursement_account: Optional[str] = None
    disbursement_phone: Optional[str] = None

class LoanApplicationResponse(BaseModel):
    id: str
    application_number: str
    member_id: str
    loan_product_id: str
    amount: Decimal
    term_months: int
    interest_rate: Decimal
    total_interest: Optional[Decimal] = None
    total_repayment: Optional[Decimal] = None
    monthly_repayment: Optional[Decimal] = None
    processing_fee: Optional[Decimal] = None
    insurance_fee: Optional[Decimal] = None
    appraisal_fee: Optional[Decimal] = None
    excise_duty: Optional[Decimal] = None
    total_fees: Optional[Decimal] = None
    credit_life_insurance_rate: Optional[Decimal] = None
    credit_life_insurance_freq: Optional[str] = None
    total_insurance: Optional[Decimal] = None
    status: str
    purpose: Optional[str] = None
    rejection_reason: Optional[str] = None
    disbursement_method: Optional[str] = None
    disbursement_account: Optional[str] = None
    disbursement_phone: Optional[str] = None
    amount_disbursed: Optional[Decimal] = None
    amount_repaid: Optional[Decimal] = None
    outstanding_balance: Optional[Decimal] = None
    next_payment_date: Optional[date] = None
    last_payment_date: Optional[date] = None
    is_restructured: bool = False
    interest_deducted_upfront: bool = False
    applied_at: datetime
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    disbursed_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    created_by_id: Optional[str] = None
    reviewed_by_id: Optional[str] = None
    member: Optional[MemberResponse] = None
    loan_product: Optional[LoanProductResponse] = None
    guarantors: Optional[List[LoanGuarantorResponse]] = None
    extra_charges: Optional[List[LoanExtraChargeResponse]] = None
    
    class Config:
        from_attributes = True

# Loan Repayment schemas
class LoanRepaymentCreate(BaseModel):
    loan_id: str
    amount: Decimal
    payment_method: Optional[str] = None
    mpesa_phone: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

class LoanRepaymentResponse(BaseModel):
    id: str
    repayment_number: str
    loan_id: str
    amount: Decimal
    principal_amount: Decimal = Decimal("0")
    interest_amount: Decimal = Decimal("0")
    penalty_amount: Decimal = Decimal("0")
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    received_by_id: Optional[str] = None
    payment_date: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

# Loan Restructure schemas
class LoanRestructureCreate(BaseModel):
    restructure_type: str
    new_term_months: Optional[int] = None
    new_interest_rate: Optional[Decimal] = None
    new_monthly_repayment: Optional[Decimal] = None
    penalty_waived: Optional[Decimal] = None
    grace_period_days: Optional[int] = None
    reason: Optional[str] = None

class LoanRestructureResponse(BaseModel):
    id: str
    loan_id: str
    restructure_type: str
    old_term_months: Optional[int] = None
    new_term_months: Optional[int] = None
    old_interest_rate: Optional[Decimal] = None
    new_interest_rate: Optional[Decimal] = None
    old_monthly_repayment: Optional[Decimal] = None
    new_monthly_repayment: Optional[Decimal] = None
    penalty_waived: Decimal = Decimal("0")
    grace_period_days: int = 0
    reason: Optional[str] = None
    approved_by_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Loan Default schemas
class LoanDefaultMemberInfo(BaseModel):
    first_name: str
    last_name: str
    phone: Optional[str] = None
    member_number: Optional[str] = None

    class Config:
        from_attributes = True

class LoanDefaultLoanInfo(BaseModel):
    application_number: str
    amount: Decimal
    outstanding_balance: Optional[Decimal] = None
    member: Optional[LoanDefaultMemberInfo] = None

    class Config:
        from_attributes = True

class LoanDefaultResponse(BaseModel):
    id: str
    loan_id: str
    days_overdue: int
    amount_overdue: Decimal
    penalty_amount: Decimal = Decimal("0")
    status: str
    collection_notes: Optional[str] = None
    last_contact_date: Optional[datetime] = None
    next_action_date: Optional[datetime] = None
    assigned_to_id: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    loan: Optional[LoanDefaultLoanInfo] = None
    
    class Config:
        from_attributes = True

class LoanDefaultUpdate(BaseModel):
    status: Optional[str] = None
    collection_notes: Optional[str] = None
    next_action_date: Optional[datetime] = None
    assigned_to_id: Optional[str] = None

# SMS schemas
class SMSNotificationCreate(BaseModel):
    notification_type: str
    recipient_phone: str
    recipient_name: Optional[str] = None
    member_id: Optional[str] = None
    loan_id: Optional[str] = None
    message: str

class SMSNotificationResponse(BaseModel):
    id: str
    notification_type: str
    recipient_phone: str
    recipient_name: Optional[str] = None
    member_id: Optional[str] = None
    loan_id: Optional[str] = None
    message: str
    status: str
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class SMSTemplateCreate(BaseModel):
    name: str
    template_type: str
    message_template: str

class SMSTemplateResponse(BaseModel):
    id: str
    name: str
    template_type: str
    message_template: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class BulkSMSCreate(BaseModel):
    recipient_type: str
    branch_id: Optional[str] = None
    message: str

# Audit Log schemas
class AuditLogResponse(BaseModel):
    id: str
    staff_id: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Performance Review schemas
class PerformanceReviewCreate(BaseModel):
    staff_id: str
    review_period_start: date
    review_period_end: date
    rating: Optional[int] = None
    comments: Optional[str] = None

class PerformanceReviewResponse(BaseModel):
    id: str
    staff_id: str
    review_period_start: date
    review_period_end: date
    loans_processed: int = 0
    loans_approved: int = 0
    loans_rejected: int = 0
    total_disbursed: Decimal = Decimal("0")
    total_collected: Decimal = Decimal("0")
    default_rate: Decimal = Decimal("0")
    rating: Optional[int] = None
    comments: Optional[str] = None
    reviewed_by_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Organization Settings schemas
class OrganizationSettingCreate(BaseModel):
    setting_key: str
    setting_value: str
    setting_type: Optional[str] = "string"
    description: Optional[str] = None

class OrganizationSettingResponse(BaseModel):
    id: str
    setting_key: str
    setting_value: Optional[str] = None
    setting_type: str
    description: Optional[str] = None
    updated_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

# Working Hours schemas
class WorkingHoursCreate(BaseModel):
    day_of_week: int
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_working_day: bool = True

class WorkingHoursResponse(BaseModel):
    id: str
    day_of_week: int
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_working_day: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Report schemas
class MemberStatementRequest(BaseModel):
    member_id: str
    start_date: date
    end_date: date

class LoanReportRequest(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    branch_id: Optional[str] = None

class FinancialSummaryRequest(BaseModel):
    start_date: date
    end_date: date
    branch_id: Optional[str] = None

# Analytics schemas
class DashboardStats(BaseModel):
    total_members: int
    total_staff: int
    total_branches: int
    total_loans: int
    pending_loans: int
    approved_loans: int
    disbursed_loans: int
    total_savings: Decimal
    total_shares: Decimal
    total_disbursed: Decimal
    total_outstanding: Decimal
    total_repaid: Decimal
    default_count: int

class BranchPerformance(BaseModel):
    branch_id: str
    branch_name: str
    member_count: int
    loan_count: int
    total_disbursed: Decimal
    total_collected: Decimal
    default_rate: Decimal

class StaffPerformance(BaseModel):
    staff_id: str
    staff_name: str
    loans_processed: int
    loans_approved: int
    loans_rejected: int
    total_disbursed: Decimal
    total_collected: Decimal

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None

class RolePermissionResponse(BaseModel):
    id: str
    permission: str
    
    class Config:
        from_attributes = True

class RoleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_system: bool
    is_active: bool
    permissions: List[str] = []
    created_at: datetime
    
    class Config:
        from_attributes = True

# Fixed Deposit Product schemas
class FixedDepositProductCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    term_months: int
    interest_rate: Decimal
    min_amount: Optional[Decimal] = Decimal("1000")
    max_amount: Optional[Decimal] = None
    early_withdrawal_penalty: Optional[Decimal] = Decimal("0")

class FixedDepositProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    interest_rate: Optional[Decimal] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    early_withdrawal_penalty: Optional[Decimal] = None
    is_active: Optional[bool] = None

class FixedDepositProductResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    term_months: int
    interest_rate: Decimal
    min_amount: Decimal
    max_amount: Optional[Decimal] = None
    early_withdrawal_penalty: Decimal
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Member Fixed Deposit schemas
class MemberFixedDepositCreate(BaseModel):
    member_id: str
    product_id: str
    principal_amount: Decimal
    notes: Optional[str] = None
    funding_source: Optional[str] = "cash"
    payment_reference: Optional[str] = None
    auto_rollover: Optional[bool] = False

class MemberFixedDepositResponse(BaseModel):
    id: str
    deposit_number: str
    member_id: str
    product_id: str
    principal_amount: Decimal
    interest_rate: Decimal
    term_months: int
    start_date: date
    maturity_date: date
    expected_interest: Decimal
    maturity_amount: Decimal
    actual_interest_paid: Optional[Decimal] = None
    actual_amount_paid: Optional[Decimal] = None
    status: str
    closed_date: Optional[date] = None
    early_withdrawal: bool
    penalty_amount: Decimal
    auto_rollover: bool = False
    rollover_count: int = 0
    parent_deposit_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    member_name: Optional[str] = None
    member_number: Optional[str] = None
    product_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class FixedDepositCloseRequest(BaseModel):
    early_withdrawal: bool = False
    notes: Optional[str] = None

# Leave Management schemas
class LeaveTypeCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    days_per_year: int = 0
    is_paid: bool = True
    requires_approval: bool = True
    carry_over_allowed: bool = False
    max_carry_over_days: int = 0

class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    days_per_year: Optional[int] = None
    is_paid: Optional[bool] = None
    requires_approval: Optional[bool] = None
    carry_over_allowed: Optional[bool] = None
    max_carry_over_days: Optional[int] = None
    is_active: Optional[bool] = None

class LeaveTypeResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    days_per_year: int
    is_paid: bool
    requires_approval: bool
    carry_over_allowed: bool
    max_carry_over_days: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class LeaveRequestCreate(BaseModel):
    staff_id: Optional[str] = None
    leave_type_id: str
    start_date: date
    end_date: date
    days_requested: Decimal
    reason: Optional[str] = None
    relief_staff_id: Optional[str] = None

class LeaveRequestUpdate(BaseModel):
    status: Optional[str] = None
    rejection_reason: Optional[str] = None

class LeaveRequestResponse(BaseModel):
    id: str
    staff_id: str
    leave_type_id: str
    start_date: date
    end_date: date
    days_requested: Decimal
    reason: Optional[str] = None
    status: str
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    relief_staff_id: Optional[str] = None
    created_at: datetime
    staff_name: Optional[str] = None
    leave_type_name: Optional[str] = None
    approved_by_name: Optional[str] = None
    relief_staff_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class LeaveBalanceResponse(BaseModel):
    id: str
    staff_id: str
    leave_type_id: str
    year: int
    entitled_days: Decimal
    used_days: Decimal
    carried_over_days: Decimal
    remaining_days: Optional[Decimal] = None
    leave_type_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Attendance schemas
class AttendanceCreate(BaseModel):
    staff_id: str
    date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    status: str = "present"
    notes: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: str
    staff_id: str
    date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    status: str
    late_minutes: int
    overtime_minutes: int
    notes: Optional[str] = None
    staff_name: Optional[str] = None
    branch_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Payroll schemas
class PayrollConfigCreate(BaseModel):
    staff_id: str
    basic_salary: Decimal = Decimal("0")
    house_allowance: Decimal = Decimal("0")
    transport_allowance: Decimal = Decimal("0")
    other_allowances: Decimal = Decimal("0")
    nhif_deduction: Decimal = Decimal("0")
    nssf_deduction: Decimal = Decimal("0")
    paye_tax: Decimal = Decimal("0")
    other_deductions: Decimal = Decimal("0")
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_branch: Optional[str] = None
    payment_method: str = "bank_transfer"
    effective_date: Optional[date] = None

class PayrollConfigUpdate(BaseModel):
    basic_salary: Optional[Decimal] = None
    house_allowance: Optional[Decimal] = None
    transport_allowance: Optional[Decimal] = None
    other_allowances: Optional[Decimal] = None
    nhif_deduction: Optional[Decimal] = None
    nssf_deduction: Optional[Decimal] = None
    paye_tax: Optional[Decimal] = None
    other_deductions: Optional[Decimal] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_branch: Optional[str] = None
    payment_method: Optional[str] = None
    effective_date: Optional[date] = None
    is_active: Optional[bool] = None

class PayrollConfigResponse(BaseModel):
    id: str
    staff_id: str
    basic_salary: Decimal
    house_allowance: Decimal
    transport_allowance: Decimal
    other_allowances: Decimal
    gross_salary: Optional[Decimal] = None
    nhif_deduction: Decimal
    nssf_deduction: Decimal
    paye_tax: Decimal
    other_deductions: Decimal
    total_deductions: Optional[Decimal] = None
    net_salary: Optional[Decimal] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_branch: Optional[str] = None
    payment_method: str
    effective_date: Optional[date] = None
    is_active: bool
    staff_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class PayslipResponse(BaseModel):
    id: str
    staff_id: str
    pay_period: str
    pay_date: date
    basic_salary: Decimal
    house_allowance: Decimal
    transport_allowance: Decimal
    other_allowances: Decimal
    gross_salary: Decimal
    nhif_deduction: Decimal
    nssf_deduction: Decimal
    paye_tax: Decimal
    loan_deductions: Decimal
    shortage_deductions: Decimal
    other_deductions: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    days_worked: int
    days_absent: int
    overtime_hours: Decimal
    overtime_pay: Decimal
    status: str
    staff_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Employee Document schemas
class EmployeeDocumentCreate(BaseModel):
    staff_id: str
    document_type: str
    document_name: str
    file_url: Optional[str] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None

class EmployeeDocumentResponse(BaseModel):
    id: str
    staff_id: str
    document_type: str
    document_name: str
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    expiry_date: Optional[date] = None
    is_verified: bool
    verified_by_id: Optional[str] = None
    verified_at: Optional[datetime] = None
    notes: Optional[str] = None
    staff_name: Optional[str] = None
    verified_by_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Staff Profile schemas
class StaffProfileCreate(BaseModel):
    staff_id: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    national_id: Optional[str] = None
    kra_pin: Optional[str] = None
    nhif_number: Optional[str] = None
    nssf_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    next_of_kin_relationship: Optional[str] = None
    next_of_kin_address: Optional[str] = None
    employment_date: Optional[date] = None
    contract_type: Optional[str] = None
    contract_end_date: Optional[date] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    reporting_to_id: Optional[str] = None

class StaffProfileUpdate(BaseModel):
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    national_id: Optional[str] = None
    kra_pin: Optional[str] = None
    nhif_number: Optional[str] = None
    nssf_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    next_of_kin_relationship: Optional[str] = None
    next_of_kin_address: Optional[str] = None
    employment_date: Optional[date] = None
    contract_type: Optional[str] = None
    contract_end_date: Optional[date] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    reporting_to_id: Optional[str] = None

class StaffProfileResponse(BaseModel):
    id: str
    staff_id: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    national_id: Optional[str] = None
    kra_pin: Optional[str] = None
    nhif_number: Optional[str] = None
    nssf_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None
    next_of_kin_relationship: Optional[str] = None
    next_of_kin_address: Optional[str] = None
    employment_date: Optional[date] = None
    contract_type: Optional[str] = None
    contract_end_date: Optional[date] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    reporting_to_id: Optional[str] = None
    staff_name: Optional[str] = None
    reporting_to_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Disciplinary Record schemas
class DisciplinaryRecordCreate(BaseModel):
    staff_id: str
    action_type: str
    incident_date: date
    description: str
    action_taken: Optional[str] = None
    suspension_start_date: Optional[date] = None
    suspension_end_date: Optional[date] = None
    witness_id: Optional[str] = None
    follow_up_date: Optional[date] = None

class DisciplinaryRecordUpdate(BaseModel):
    staff_response: Optional[str] = None
    is_resolved: Optional[bool] = None
    resolution_notes: Optional[str] = None

class DisciplinaryRecordResponse(BaseModel):
    id: str
    staff_id: str
    action_type: str
    incident_date: date
    description: str
    action_taken: Optional[str] = None
    suspension_start_date: Optional[date] = None
    suspension_end_date: Optional[date] = None
    issued_by_id: Optional[str] = None
    witness_id: Optional[str] = None
    staff_response: Optional[str] = None
    follow_up_date: Optional[date] = None
    is_resolved: bool
    resolution_notes: Optional[str] = None
    staff_name: Optional[str] = None
    issued_by_name: Optional[str] = None
    witness_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Training Record schemas
class TrainingRecordCreate(BaseModel):
    staff_id: str
    training_name: str
    training_type: Optional[str] = None
    provider: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    duration_hours: Optional[int] = None
    cost: Decimal = Decimal("0")
    notes: Optional[str] = None

class TrainingRecordUpdate(BaseModel):
    status: Optional[str] = None
    score: Optional[Decimal] = None
    passed: Optional[bool] = None
    certificate_url: Optional[str] = None
    certificate_expiry: Optional[date] = None
    notes: Optional[str] = None

class TrainingRecordResponse(BaseModel):
    id: str
    staff_id: str
    training_name: str
    training_type: Optional[str] = None
    provider: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    duration_hours: Optional[int] = None
    status: str
    score: Optional[Decimal] = None
    passed: Optional[bool] = None
    certificate_url: Optional[str] = None
    certificate_expiry: Optional[date] = None
    cost: Decimal
    notes: Optional[str] = None
    staff_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Pay Period schemas
class PayPeriodCreate(BaseModel):
    name: str
    period_type: str = "monthly"
    start_date: date
    end_date: date
    pay_date: date
    notes: Optional[str] = None

class PayPeriodUpdate(BaseModel):
    name: Optional[str] = None
    pay_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PayPeriodResponse(BaseModel):
    id: str
    name: str
    period_type: str
    start_date: date
    end_date: date
    pay_date: date
    status: str
    total_gross: Decimal
    total_deductions: Decimal
    total_net: Decimal
    staff_count: int
    processed_by_name: Optional[str] = None
    processed_at: Optional[datetime] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Payroll Run schemas
class PayrollRunCreate(BaseModel):
    pay_period_id: str
    run_type: str = "regular"

class PayrollRunResponse(BaseModel):
    id: str
    pay_period_id: str
    run_number: int
    run_type: str
    status: str
    total_gross: Decimal
    total_deductions: Decimal
    total_net: Decimal
    staff_count: int
    disbursement_method: Optional[str] = None
    disbursed_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    pay_period_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Salary Advance schemas
class SalaryAdvanceCreate(BaseModel):
    staff_id: Optional[str] = None
    amount: Decimal
    reason: Optional[str] = None
    recovery_months: int = 1

class SalaryAdvanceUpdate(BaseModel):
    status: Optional[str] = None
    recovery_start_period: Optional[str] = None
    notes: Optional[str] = None

class SalaryAdvanceResponse(BaseModel):
    id: str
    staff_id: str
    amount: Decimal
    reason: Optional[str] = None
    request_date: date
    status: str
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    disbursed_at: Optional[datetime] = None
    recovery_start_period: Optional[str] = None
    recovery_months: int
    amount_recovered: Decimal
    is_fully_recovered: bool
    staff_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Payslip Response enhanced
class PayslipDetailResponse(BaseModel):
    id: str
    staff_id: str
    staff_name: Optional[str] = None
    staff_number: Optional[str] = None
    pay_period: str
    pay_date: date
    basic_salary: Decimal
    house_allowance: Decimal
    transport_allowance: Decimal
    other_allowances: Decimal
    gross_salary: Decimal
    nhif_deduction: Decimal
    nssf_deduction: Decimal
    paye_tax: Decimal
    loan_deductions: Decimal
    shortage_deductions: Decimal
    other_deductions: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    days_worked: int
    days_absent: int
    overtime_hours: Decimal
    overtime_pay: Decimal
    status: str
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Disbursement request
class DisbursementRequest(BaseModel):
    method: str  # savings_account, mpesa, bank_transfer
    notes: Optional[str] = None
