import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Integer, ForeignKey, Date, Time, JSON, UniqueConstraint
from sqlalchemy.orm import relationship, declarative_base

TenantBase = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class Branch(TenantBase):
    __tablename__ = "branches"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    address = Column(Text)
    phone = Column(String(50))
    email = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff", back_populates="branch")
    members = relationship("Member", back_populates="branch")

class Staff(TenantBase):
    __tablename__ = "staff"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_number = Column(String(50), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    secondary_email = Column(String(255))
    phone = Column(String(50))
    role = Column(String(50), default="loan_officer")
    branch_id = Column(String, ForeignKey("branches.id"))
    password_hash = Column(String(255))
    is_active = Column(Boolean, default=True)
    is_locked = Column(Boolean, default=False)
    approval_pin = Column(String(255))  # Hashed PIN for shortage approvals
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    branch = relationship("Branch", back_populates="staff")
    loan_applications = relationship("LoanApplication", foreign_keys="LoanApplication.created_by_id", back_populates="created_by")
    reviewed_loans = relationship("LoanApplication", foreign_keys="LoanApplication.reviewed_by_id", back_populates="reviewed_by")
    audit_logs = relationship("AuditLog", back_populates="staff")
    performance_reviews = relationship("PerformanceReview", foreign_keys="PerformanceReview.staff_id", back_populates="staff")
    sessions = relationship("StaffSession", back_populates="staff")
    documents = relationship("StaffDocument", foreign_keys="StaffDocument.staff_id", back_populates="staff")

class StaffDocument(TenantBase):
    __tablename__ = "staff_documents"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    document_type = Column(String(50), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String(100))
    description = Column(Text)
    is_verified = Column(Boolean, default=False)
    verified_by_id = Column(String, ForeignKey("staff.id"))
    verified_at = Column(DateTime)
    uploaded_by_id = Column(String, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff", foreign_keys=[staff_id], back_populates="documents")
    verified_by = relationship("Staff", foreign_keys=[verified_by_id])
    uploaded_by = relationship("Staff", foreign_keys=[uploaded_by_id])

class StaffSession(TenantBase):
    """Staff sessions stored in tenant database for complete isolation"""
    __tablename__ = "staff_sessions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    
    staff = relationship("Staff", back_populates="sessions")

class Member(TenantBase):
    __tablename__ = "members"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    member_number = Column(String(50), unique=True, nullable=False)
    
    # Personal Information
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100))
    last_name = Column(String(100), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    phone_secondary = Column(String(50))
    id_type = Column(String(50))  # national_id, passport, alien_id
    id_number = Column(String(50))
    kra_pin = Column(String(50))
    date_of_birth = Column(Date)
    gender = Column(String(20))
    marital_status = Column(String(50))
    nationality = Column(String(100), default="Kenyan")
    
    # Address Information
    address = Column(Text)
    postal_code = Column(String(20))
    city = Column(String(100))
    county = Column(String(100))
    country = Column(String(100), default="Kenya")
    
    # Next of Kin 1
    next_of_kin_name = Column(String(255))
    next_of_kin_phone = Column(String(50))
    next_of_kin_relationship = Column(String(100))
    next_of_kin_id_number = Column(String(50))
    next_of_kin_address = Column(Text)
    
    # Next of Kin 2 (alternate)
    next_of_kin_2_name = Column(String(255))
    next_of_kin_2_phone = Column(String(50))
    next_of_kin_2_relationship = Column(String(100))
    
    # Employment Information
    employment_status = Column(String(50))  # employed, self_employed, business, unemployed, retired
    employer_name = Column(String(255))
    employer_address = Column(Text)
    employer_phone = Column(String(50))
    occupation = Column(String(255))
    monthly_income = Column(Numeric(15, 2))
    employment_date = Column(Date)
    
    # Bank Details
    bank_name = Column(String(255))
    bank_branch = Column(String(255))
    bank_account_number = Column(String(100))
    bank_account_name = Column(String(255))
    
    # Membership Details
    branch_id = Column(String, ForeignKey("branches.id"))
    membership_type = Column(String(50), default="ordinary")  # ordinary, premium, corporate
    registration_fee_paid = Column(Numeric(15, 2), default=0)
    share_capital = Column(Numeric(15, 2), default=0)
    
    # Account Balances (available)
    savings_balance = Column(Numeric(15, 2), default=0)
    shares_balance = Column(Numeric(15, 2), default=0)
    deposits_balance = Column(Numeric(15, 2), default=0)
    
    # Pending Balances (cheques awaiting clearance)
    savings_pending = Column(Numeric(15, 2), default=0)
    shares_pending = Column(Numeric(15, 2), default=0)
    deposits_pending = Column(Numeric(15, 2), default=0)
    
    # Status and Dates
    status = Column(String(50), default="active")
    is_active = Column(Boolean, default=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(String, ForeignKey("staff.id"))
    
    # Mobile Banking
    mobile_banking_active = Column(Boolean, default=False)
    pin_hash = Column(String(255))
    otp_code = Column(String(10))
    otp_expires_at = Column(DateTime)
    
    # Photo and Documents (store as file paths or URLs)
    photo_url = Column(String(500))
    id_document_url = Column(String(500))
    signature_url = Column(String(500))
    
    branch = relationship("Branch", back_populates="members")
    loan_applications = relationship("LoanApplication", back_populates="member")
    transactions = relationship("Transaction", back_populates="member")
    guarantor_records = relationship("LoanGuarantor", foreign_keys="LoanGuarantor.guarantor_id", back_populates="guarantor")
    created_by = relationship("Staff", foreign_keys=[created_by_id])
    documents = relationship("MemberDocument", back_populates="member")

class MemberDocument(TenantBase):
    __tablename__ = "member_documents"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    document_type = Column(String(50), nullable=False)  # passport_photo, id_front, id_back, signature, proof_of_address, payslip, other
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String(100))
    description = Column(Text)
    is_verified = Column(Boolean, default=False)
    verified_by_id = Column(String, ForeignKey("staff.id"))
    verified_at = Column(DateTime)
    uploaded_by_id = Column(String, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    member = relationship("Member", back_populates="documents")
    verified_by = relationship("Staff", foreign_keys=[verified_by_id])
    uploaded_by = relationship("Staff", foreign_keys=[uploaded_by_id])

class LoanProduct(TenantBase):
    __tablename__ = "loan_products"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    interest_rate = Column(Numeric(10, 4), nullable=False)
    interest_rate_period = Column(String(20), default="monthly")
    interest_type = Column(String(50), default="reducing_balance")
    repayment_frequency = Column(String(50), default="monthly")
    min_amount = Column(Numeric(15, 2), nullable=False)
    max_amount = Column(Numeric(15, 2), nullable=False)
    min_term_months = Column(Integer, default=1)
    max_term_months = Column(Integer, default=60)
    processing_fee = Column(Numeric(10, 4), default=0)
    insurance_fee = Column(Numeric(10, 4), default=0)
    appraisal_fee = Column(Numeric(10, 4), default=0)
    excise_duty_rate = Column(Numeric(10, 4), default=20)
    credit_life_insurance_rate = Column(Numeric(10, 4), default=0)
    credit_life_insurance_freq = Column(String(20), default="annual")
    late_payment_penalty = Column(Numeric(10, 4), default=0)
    grace_period_days = Column(Integer, default=0)
    requires_guarantor = Column(Boolean, default=False)
    min_guarantors = Column(Integer, default=0)
    max_guarantors = Column(Integer, default=3)
    
    # Shares-based eligibility
    shares_multiplier = Column(Numeric(5, 2), default=0)
    min_shares_required = Column(Numeric(15, 2), default=0)
    
    # Interest deduction option
    deduct_interest_upfront = Column(Boolean, default=False)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    loan_applications = relationship("LoanApplication", back_populates="loan_product")

class LoanApplication(TenantBase):
    __tablename__ = "loan_applications"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    application_number = Column(String(50), unique=True, nullable=False)
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    loan_product_id = Column(String, ForeignKey("loan_products.id"), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    term_months = Column(Integer, nullable=False)
    interest_rate = Column(Numeric(10, 4), nullable=False)
    total_interest = Column(Numeric(15, 2))
    total_repayment = Column(Numeric(15, 2))
    monthly_repayment = Column(Numeric(15, 2))
    processing_fee = Column(Numeric(15, 2), default=0)
    insurance_fee = Column(Numeric(15, 2), default=0)
    appraisal_fee = Column(Numeric(15, 2), default=0)
    excise_duty = Column(Numeric(15, 2), default=0)
    total_fees = Column(Numeric(15, 2), default=0)
    credit_life_insurance_rate = Column(Numeric(10, 4), default=0)
    credit_life_insurance_freq = Column(String(20), default="annual")
    total_insurance = Column(Numeric(15, 2), default=0)
    status = Column(String(50), default="pending")
    purpose = Column(Text)
    rejection_reason = Column(Text)
    disbursement_method = Column(String(50))
    disbursement_account = Column(String(255))
    disbursement_phone = Column(String(50))
    amount_disbursed = Column(Numeric(15, 2))
    amount_repaid = Column(Numeric(15, 2), default=0)
    outstanding_balance = Column(Numeric(15, 2))
    next_payment_date = Column(Date)
    last_payment_date = Column(Date)
    is_restructured = Column(Boolean, default=False)
    interest_deducted_upfront = Column(Boolean, default=False)  # Track if interest was deducted at disbursement
    original_loan_id = Column(String, ForeignKey("loan_applications.id"))
    created_by_id = Column(String, ForeignKey("staff.id"))
    reviewed_by_id = Column(String, ForeignKey("staff.id"))
    applied_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime)
    rejected_at = Column(DateTime)
    disbursed_at = Column(DateTime)
    closed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    member = relationship("Member", back_populates="loan_applications")
    loan_product = relationship("LoanProduct", back_populates="loan_applications")
    created_by = relationship("Staff", foreign_keys=[created_by_id], back_populates="loan_applications")
    reviewed_by = relationship("Staff", foreign_keys=[reviewed_by_id], back_populates="reviewed_loans")
    guarantors = relationship("LoanGuarantor", back_populates="loan")
    repayments = relationship("LoanRepayment", back_populates="loan")
    instalments = relationship("LoanInstalment", back_populates="loan", order_by="LoanInstalment.instalment_number")
    restructure_history = relationship("LoanRestructure", back_populates="loan")
    extra_charges = relationship("LoanExtraCharge", back_populates="loan", cascade="all, delete-orphan")

class LoanExtraCharge(TenantBase):
    __tablename__ = "loan_extra_charges"

    id = Column(String, primary_key=True, default=generate_uuid)
    loan_id = Column(String, ForeignKey("loan_applications.id"), nullable=False)
    charge_name = Column(String(255), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    loan = relationship("LoanApplication", back_populates="extra_charges")

class LoanGuarantor(TenantBase):
    __tablename__ = "loan_guarantors"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    loan_id = Column(String, ForeignKey("loan_applications.id"), nullable=False)
    guarantor_id = Column(String, ForeignKey("members.id"), nullable=False)
    amount_guaranteed = Column(Numeric(15, 2), nullable=False)
    guarantee_percentage = Column(Numeric(5, 2))  # Percentage of loan being guaranteed
    
    # Relationship to borrower
    relationship_to_borrower = Column(String(100))  # spouse, family, colleague, friend, business_partner, other
    
    # Guarantor's financial snapshot at time of guarantee
    guarantor_savings_at_guarantee = Column(Numeric(15, 2))  # Savings balance when added
    guarantor_shares_at_guarantee = Column(Numeric(15, 2))  # Shares balance when added
    guarantor_total_exposure_at_guarantee = Column(Numeric(15, 2))  # Total exposure when added
    available_guarantee_capacity = Column(Numeric(15, 2))  # Available capacity when added
    
    # Status tracking
    status = Column(String(50), default="pending")  # pending, accepted, rejected, released, called
    rejection_reason = Column(Text)  # Reason if guarantor rejects
    
    # Timestamps
    accepted_at = Column(DateTime)
    rejected_at = Column(DateTime)
    released_at = Column(DateTime)  # When guarantee is released (loan fully repaid)
    called_at = Column(DateTime)  # When guarantee was invoked due to default
    
    # Amount recovered from guarantor (in case of default)
    amount_recovered = Column(Numeric(15, 2), default=0)
    
    # Consent tracking
    consent_given = Column(Boolean, default=False)
    consent_date = Column(DateTime)
    consent_method = Column(String(50))  # in_person, phone, sms, app
    
    # Staff who added/verified
    added_by_id = Column(String, ForeignKey("staff.id"))
    verified_by_id = Column(String, ForeignKey("staff.id"))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    loan = relationship("LoanApplication", back_populates="guarantors")
    guarantor = relationship("Member", foreign_keys=[guarantor_id], back_populates="guarantor_records")

class LoanRepayment(TenantBase):
    __tablename__ = "loan_repayments"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    repayment_number = Column(String(50), unique=True, nullable=False)
    loan_id = Column(String, ForeignKey("loan_applications.id"), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    principal_amount = Column(Numeric(15, 2), default=0)
    interest_amount = Column(Numeric(15, 2), default=0)
    penalty_amount = Column(Numeric(15, 2), default=0)
    payment_method = Column(String(50))
    reference = Column(String(255))
    notes = Column(Text)
    received_by_id = Column(String, ForeignKey("staff.id"))
    payment_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    loan = relationship("LoanApplication", back_populates="repayments")

class LoanInstalment(TenantBase):
    __tablename__ = "loan_instalments"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    loan_id = Column(String, ForeignKey("loan_applications.id"), nullable=False)
    instalment_number = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)
    
    expected_principal = Column(Numeric(15, 2), nullable=False, default=0)
    expected_interest = Column(Numeric(15, 2), nullable=False, default=0)
    expected_penalty = Column(Numeric(15, 2), nullable=False, default=0)
    expected_insurance = Column(Numeric(15, 2), nullable=False, default=0)
    
    paid_principal = Column(Numeric(15, 2), nullable=False, default=0)
    paid_interest = Column(Numeric(15, 2), nullable=False, default=0)
    paid_penalty = Column(Numeric(15, 2), nullable=False, default=0)
    paid_insurance = Column(Numeric(15, 2), nullable=False, default=0)
    
    status = Column(String(20), default="pending")
    paid_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    loan = relationship("LoanApplication", back_populates="instalments")

class LoanRestructure(TenantBase):
    __tablename__ = "loan_restructures"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    loan_id = Column(String, ForeignKey("loan_applications.id"), nullable=False)
    restructure_type = Column(String(50), nullable=False)
    old_term_months = Column(Integer)
    new_term_months = Column(Integer)
    old_interest_rate = Column(Numeric(10, 4))
    new_interest_rate = Column(Numeric(10, 4))
    old_monthly_repayment = Column(Numeric(15, 2))
    new_monthly_repayment = Column(Numeric(15, 2))
    penalty_waived = Column(Numeric(15, 2), default=0)
    grace_period_days = Column(Integer, default=0)
    reason = Column(Text)
    approved_by_id = Column(String, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    loan = relationship("LoanApplication", back_populates="restructure_history")

class Transaction(TenantBase):
    __tablename__ = "transactions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    transaction_number = Column(String(50), unique=True, nullable=False)
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    transaction_type = Column(String(50), nullable=False)
    account_type = Column(String(50), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    balance_before = Column(Numeric(15, 2))
    balance_after = Column(Numeric(15, 2))
    payment_method = Column(String(50))
    reference = Column(String(255))
    description = Column(Text)
    processed_by_id = Column(String, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    member = relationship("Member", back_populates="transactions")

class SMSNotification(TenantBase):
    __tablename__ = "sms_notifications"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    notification_type = Column(String(50), nullable=False)
    recipient_phone = Column(String(50), nullable=False)
    recipient_name = Column(String(255))
    member_id = Column(String, ForeignKey("members.id"))
    loan_id = Column(String, ForeignKey("loan_applications.id"))
    message = Column(Text, nullable=False)
    status = Column(String(50), default="pending")
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class SMSTemplate(TenantBase):
    __tablename__ = "sms_templates"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    template_type = Column(String(50), nullable=False)
    message_template = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(TenantBase):
    __tablename__ = "audit_logs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100))
    entity_id = Column(String)
    old_values = Column(JSON)
    new_values = Column(JSON)
    ip_address = Column(String(50))
    user_agent = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff", back_populates="audit_logs")

class PerformanceReview(TenantBase):
    __tablename__ = "performance_reviews"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    review_period_start = Column(Date, nullable=False)
    review_period_end = Column(Date, nullable=False)
    loans_processed = Column(Integer, default=0)
    loans_approved = Column(Integer, default=0)
    loans_rejected = Column(Integer, default=0)
    total_disbursed = Column(Numeric(15, 2), default=0)
    total_collected = Column(Numeric(15, 2), default=0)
    default_rate = Column(Numeric(10, 4), default=0)
    rating = Column(Integer)
    comments = Column(Text)
    reviewed_by_id = Column(String, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff", foreign_keys=[staff_id], back_populates="performance_reviews")

class OrganizationSettings(TenantBase):
    __tablename__ = "organization_settings"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    setting_key = Column(String(100), unique=True, nullable=False)
    setting_value = Column(Text)
    setting_type = Column(String(50), default="string")
    description = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

class WorkingHours(TenantBase):
    __tablename__ = "working_hours"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(Time)
    end_time = Column(Time)
    is_working_day = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class LoanDefault(TenantBase):
    __tablename__ = "loan_defaults"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    loan_id = Column(String, ForeignKey("loan_applications.id"), nullable=False)
    days_overdue = Column(Integer, nullable=False)
    amount_overdue = Column(Numeric(15, 2), nullable=False)
    penalty_amount = Column(Numeric(15, 2), default=0)
    status = Column(String(50), default="overdue")
    collection_notes = Column(Text)
    last_contact_date = Column(DateTime)
    next_action_date = Column(DateTime)
    assigned_to_id = Column(String, ForeignKey("staff.id"))
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    loan = relationship("LoanApplication", foreign_keys=[loan_id], lazy="joined")

class Role(TenantBase):
    __tablename__ = "roles"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")

class RolePermission(TenantBase):
    __tablename__ = "role_permissions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    role_id = Column(String, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    role = relationship("Role", back_populates="permissions")

class TellerFloat(TenantBase):
    __tablename__ = "teller_floats"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    branch_id = Column(String, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False)
    opening_balance = Column(Numeric(15, 2), default=0)
    current_balance = Column(Numeric(15, 2), default=0)
    deposits_in = Column(Numeric(15, 2), default=0)
    withdrawals_out = Column(Numeric(15, 2), default=0)
    replenishments = Column(Numeric(15, 2), default=0)
    returns_to_vault = Column(Numeric(15, 2), default=0)
    closing_balance = Column(Numeric(15, 2))
    physical_count = Column(Numeric(15, 2))
    variance = Column(Numeric(15, 2))
    status = Column(String(50), default="open")
    reconciled_at = Column(DateTime)
    reconciled_by_id = Column(String, ForeignKey("staff.id"))
    notes = Column(Text)
    returned_to_vault = Column(Boolean, default=False)
    counter_number = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('staff_id', 'date', name='uq_teller_float_staff_date'),
    )
    
    staff = relationship("Staff", foreign_keys=[staff_id])
    branch = relationship("Branch")
    reconciled_by = relationship("Staff", foreign_keys=[reconciled_by_id])
    transactions = relationship("FloatTransaction", back_populates="teller_float")

class FloatTransaction(TenantBase):
    __tablename__ = "float_transactions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    teller_float_id = Column(String, ForeignKey("teller_floats.id"), nullable=False)
    transaction_type = Column(String(50), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    balance_after = Column(Numeric(15, 2), nullable=False)
    reference = Column(String(100))
    description = Column(Text)
    performed_by_id = Column(String, ForeignKey("staff.id"))
    approved_by_id = Column(String, ForeignKey("staff.id"))
    status = Column(String(50), default="completed")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    teller_float = relationship("TellerFloat", back_populates="transactions")
    performed_by = relationship("Staff", foreign_keys=[performed_by_id])
    approved_by = relationship("Staff", foreign_keys=[approved_by_id])

class ShortageRecord(TenantBase):
    __tablename__ = "shortage_records"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    teller_float_id = Column(String, ForeignKey("teller_floats.id"), nullable=False)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    date = Column(Date, nullable=False)
    shortage_amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(50), default="pending")  # pending, deducted, held
    resolution = Column(String(50))  # deduct_salary, hold
    approved_by_id = Column(String, ForeignKey("staff.id"))
    approved_at = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    teller_float = relationship("TellerFloat")
    staff = relationship("Staff", foreign_keys=[staff_id])
    approved_by = relationship("Staff", foreign_keys=[approved_by_id])

class SalaryDeduction(TenantBase):
    __tablename__ = "salary_deductions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    shortage_record_id = Column(String, ForeignKey("shortage_records.id"))
    amount = Column(Numeric(15, 2), nullable=False)
    reason = Column(String(255), nullable=False)
    deduction_date = Column(Date, nullable=False)
    pay_period = Column(String(20))  # e.g., "2026-02" - auto-set from deduction_date
    status = Column(String(50), default="pending")  # pending, processed, cancelled
    approved_by_id = Column(String, ForeignKey("staff.id"))
    processed_by_id = Column(String, ForeignKey("staff.id"))
    processed_at = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff", foreign_keys=[staff_id])
    shortage_record = relationship("ShortageRecord")
    approved_by = relationship("Staff", foreign_keys=[approved_by_id])
    processed_by = relationship("Staff", foreign_keys=[processed_by_id])

class BranchVault(TenantBase):
    __tablename__ = "branch_vaults"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    branch_id = Column(String, ForeignKey("branches.id"), nullable=False, unique=True)
    current_balance = Column(Numeric(15, 2), default=0)
    last_updated = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    branch = relationship("Branch")
    transactions = relationship("VaultTransaction", back_populates="vault")

class VaultTransaction(TenantBase):
    __tablename__ = "vault_transactions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    vault_id = Column(String, ForeignKey("branch_vaults.id"), nullable=False)
    transaction_type = Column(String(50), nullable=False)  # deposit, withdrawal, teller_allocation, teller_return
    amount = Column(Numeric(15, 2), nullable=False)
    balance_after = Column(Numeric(15, 2), nullable=False)
    source = Column(String(100))  # For deposits: bank_withdrawal, head_office, safe, other
    reference = Column(String(100))
    description = Column(Text)
    related_float_id = Column(String, ForeignKey("teller_floats.id"))
    performed_by_id = Column(String, ForeignKey("staff.id"))
    status = Column(String(50), default="completed")  # pending, completed, rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    
    vault = relationship("BranchVault", back_populates="transactions")
    performed_by = relationship("Staff")
    related_float = relationship("TellerFloat")

class PendingVaultReturn(TenantBase):
    __tablename__ = "pending_vault_returns"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    teller_float_id = Column(String, ForeignKey("teller_floats.id"), nullable=False)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    branch_id = Column(String, ForeignKey("branches.id"), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(50), default="pending")  # pending, accepted, rejected
    notes = Column(Text)
    rejected_reason = Column(Text)
    reviewed_by_id = Column(String, ForeignKey("staff.id"))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    teller_float = relationship("TellerFloat")
    staff = relationship("Staff", foreign_keys=[staff_id])
    branch = relationship("Branch")
    reviewed_by = relationship("Staff", foreign_keys=[reviewed_by_id])

class ShiftHandover(TenantBase):
    __tablename__ = "shift_handovers"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    from_staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    to_staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    branch_id = Column(String, ForeignKey("branches.id"), nullable=False)
    from_float_id = Column(String, ForeignKey("teller_floats.id"), nullable=False)
    to_float_id = Column(String, ForeignKey("teller_floats.id"))
    amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(50), default="pending")  # pending, accepted, rejected
    notes = Column(Text)
    from_acknowledged_at = Column(DateTime)
    to_acknowledged_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    from_staff = relationship("Staff", foreign_keys=[from_staff_id])
    to_staff = relationship("Staff", foreign_keys=[to_staff_id])
    branch = relationship("Branch")
    from_float = relationship("TellerFloat", foreign_keys=[from_float_id])
    to_float = relationship("TellerFloat", foreign_keys=[to_float_id])

class MpesaPayment(TenantBase):
    """Log of all incoming M-Pesa payments for verification"""
    __tablename__ = "mpesa_payments"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    trans_id = Column(String(100), unique=True, nullable=False)
    trans_time = Column(String(50))
    amount = Column(Numeric(15, 2), nullable=False)
    phone_number = Column(String(20))
    bill_ref_number = Column(String(100))
    first_name = Column(String(100))
    middle_name = Column(String(100))
    last_name = Column(String(100))
    org_account_balance = Column(Numeric(15, 2))
    transaction_type = Column(String(50))
    member_id = Column(String, ForeignKey("members.id"))
    status = Column(String(50), default="pending")  # pending, credited, failed, unmatched
    credited_by_id = Column(String, ForeignKey("staff.id"))
    credited_at = Column(DateTime)
    transaction_id = Column(String, ForeignKey("transactions.id"))
    notes = Column(Text)
    raw_payload = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    member = relationship("Member")
    credited_by = relationship("Staff")

class ChequeDeposit(TenantBase):
    """Track cheque deposits with pending clearance"""
    __tablename__ = "cheque_deposits"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    cheque_number = Column(String(50), nullable=False)
    bank_name = Column(String(100))
    bank_branch = Column(String(100))
    drawer_name = Column(String(200))
    amount = Column(Numeric(15, 2), nullable=False)
    account_type = Column(String(50), default="savings")
    status = Column(String(50), default="pending")  # pending, cleared, bounced, cancelled
    deposit_date = Column(Date, nullable=False)
    expected_clearance_date = Column(Date)
    cleared_date = Column(Date)
    bounced_reason = Column(Text)
    deposited_by_id = Column(String, ForeignKey("staff.id"))
    cleared_by_id = Column(String, ForeignKey("staff.id"))
    transaction_id = Column(String, ForeignKey("transactions.id"))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    member = relationship("Member")
    deposited_by = relationship("Staff", foreign_keys=[deposited_by_id])
    cleared_by = relationship("Staff", foreign_keys=[cleared_by_id])

class BankTransfer(TenantBase):
    """Track bank transfers requiring back-office verification"""
    __tablename__ = "bank_transfers"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    member_id = Column(String, ForeignKey("members.id"))
    transfer_type = Column(String(50), nullable=False)  # incoming, outgoing
    amount = Column(Numeric(15, 2), nullable=False)
    bank_name = Column(String(100))
    bank_account = Column(String(50))
    bank_reference = Column(String(100))
    account_type = Column(String(50), default="savings")
    status = Column(String(50), default="pending")  # pending, verified, credited, rejected
    transfer_date = Column(Date)
    verified_by_id = Column(String, ForeignKey("staff.id"))
    verified_at = Column(DateTime)
    credited_by_id = Column(String, ForeignKey("staff.id"))
    credited_at = Column(DateTime)
    transaction_id = Column(String, ForeignKey("transactions.id"))
    notes = Column(Text)
    rejection_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    member = relationship("Member")
    verified_by = relationship("Staff", foreign_keys=[verified_by_id])
    credited_by = relationship("Staff", foreign_keys=[credited_by_id])

class QueueTicket(TenantBase):
    """Queue management tickets for customer service"""
    __tablename__ = "queue_tickets"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    ticket_number = Column(String(20), nullable=False)
    branch_id = Column(String, ForeignKey("branches.id"), nullable=False)
    service_category = Column(String(50), nullable=False)  # deposits, loans, inquiries
    member_id = Column(String, ForeignKey("members.id"))
    member_name = Column(String(200))
    member_phone = Column(String(20))
    status = Column(String(50), default="waiting")  # waiting, serving, completed, cancelled, no_show
    priority = Column(Integer, default=0)  # 0=normal, 1=priority, 2=VIP
    teller_id = Column(String, ForeignKey("staff.id"))
    counter_number = Column(String(20))
    called_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    wait_time_seconds = Column(Integer)
    service_time_seconds = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    branch = relationship("Branch")
    member = relationship("Member")
    teller = relationship("Staff")

class TransactionReceipt(TenantBase):
    """Receipt records for transactions"""
    __tablename__ = "transaction_receipts"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    receipt_number = Column(String(50), unique=True, nullable=False)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    printed = Column(Boolean, default=False)
    printed_at = Column(DateTime)
    printed_by_id = Column(String, ForeignKey("staff.id"))
    sms_sent = Column(Boolean, default=False)
    sms_sent_at = Column(DateTime)
    sms_phone = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    member = relationship("Member")
    printed_by = relationship("Staff")

class FixedDepositProduct(TenantBase):
    """Fixed deposit product definitions with terms and interest rates"""
    __tablename__ = "fixed_deposit_products"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text)
    term_months = Column(Integer, nullable=False)  # 3, 6, 12, 24, etc.
    interest_rate = Column(Numeric(5, 2), nullable=False)  # Annual rate as percentage
    min_amount = Column(Numeric(15, 2), default=1000)
    max_amount = Column(Numeric(15, 2))
    early_withdrawal_penalty = Column(Numeric(5, 2), default=0)  # Penalty as percentage of interest
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    member_deposits = relationship("MemberFixedDeposit", back_populates="product")

class MemberFixedDeposit(TenantBase):
    """Individual member fixed deposit accounts"""
    __tablename__ = "member_fixed_deposits"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    deposit_number = Column(String(20), unique=True, nullable=False)
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    product_id = Column(String, ForeignKey("fixed_deposit_products.id"), nullable=False)
    principal_amount = Column(Numeric(15, 2), nullable=False)
    interest_rate = Column(Numeric(5, 2), nullable=False)  # Locked rate at time of deposit
    term_months = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    maturity_date = Column(Date, nullable=False)
    expected_interest = Column(Numeric(15, 2), nullable=False)
    maturity_amount = Column(Numeric(15, 2), nullable=False)
    actual_interest_paid = Column(Numeric(15, 2))
    actual_amount_paid = Column(Numeric(15, 2))
    status = Column(String(20), default="active")  # active, matured, withdrawn, closed
    closed_date = Column(Date)
    closed_by_id = Column(String, ForeignKey("staff.id"))
    early_withdrawal = Column(Boolean, default=False)
    penalty_amount = Column(Numeric(15, 2), default=0)
    auto_rollover = Column(Boolean, default=False)  # Rollover principal on maturity
    rollover_count = Column(Integer, default=0)  # Number of times rolled over
    parent_deposit_id = Column(String, ForeignKey("member_fixed_deposits.id"))  # Link to original deposit if rolled over
    notes = Column(Text)
    created_by_id = Column(String, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    member = relationship("Member")
    product = relationship("FixedDepositProduct", back_populates="member_deposits")
    created_by = relationship("Staff", foreign_keys=[created_by_id])
    closed_by = relationship("Staff", foreign_keys=[closed_by_id])

class DividendDeclaration(TenantBase):
    """Dividend declaration record - created when board declares dividend"""
    __tablename__ = "dividend_declarations"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    fiscal_year = Column(Integer, nullable=False)  # e.g., 2025
    declaration_date = Column(Date, nullable=False)  # Date board declared
    effective_date = Column(Date, nullable=False)  # Date to calculate member shares
    dividend_rate = Column(Numeric(8, 4), nullable=False)  # e.g., 0.12 for 12%
    total_shares_value = Column(Numeric(15, 2))  # Total member shares at effective date
    total_dividend_amount = Column(Numeric(15, 2))  # Total dividend to distribute
    distribution_type = Column(String(20), default="savings")  # savings, shares, cash
    status = Column(String(20), default="declared")  # declared, approved, processing, distributed, cancelled
    approved_by_id = Column(String, ForeignKey("staff.id"))
    approved_at = Column(DateTime)
    distributed_at = Column(DateTime)
    notes = Column(Text)
    created_by_id = Column(String, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    created_by = relationship("Staff", foreign_keys=[created_by_id])
    approved_by = relationship("Staff", foreign_keys=[approved_by_id])
    member_dividends = relationship("MemberDividend", back_populates="declaration")

class MemberDividend(TenantBase):
    """Individual member dividend record"""
    __tablename__ = "member_dividends"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    declaration_id = Column(String, ForeignKey("dividend_declarations.id"), nullable=False)
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    shares_balance = Column(Numeric(15, 2), nullable=False)  # Member's shares at effective date
    dividend_rate = Column(Numeric(8, 4), nullable=False)  # Rate applied
    dividend_amount = Column(Numeric(15, 2), nullable=False)  # Calculated dividend
    status = Column(String(20), default="pending")  # pending, credited, failed
    credited_to = Column(String(20))  # savings, shares
    credited_at = Column(DateTime)
    transaction_id = Column(String)  # Reference to the credit transaction
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    declaration = relationship("DividendDeclaration", back_populates="member_dividends")
    member = relationship("Member")

class TellerServiceAssignment(TenantBase):
    """Maps tellers to service types they can handle"""
    __tablename__ = "teller_service_assignments"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    service_type = Column(String(50), nullable=False)  # D=deposits, W=withdrawals, L=loans, I=inquiries, A=account_opening
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff")

class LeaveType(TenantBase):
    """Leave type definitions"""
    __tablename__ = "leave_types"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text)
    days_per_year = Column(Integer, default=0)
    is_paid = Column(Boolean, default=True)
    requires_approval = Column(Boolean, default=True)
    carry_over_allowed = Column(Boolean, default=False)
    max_carry_over_days = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class LeaveBalance(TenantBase):
    """Staff leave balances per leave type per year"""
    __tablename__ = "leave_balances"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    leave_type_id = Column(String, ForeignKey("leave_types.id"), nullable=False)
    year = Column(Integer, nullable=False)
    entitled_days = Column(Numeric(5, 1), default=0)
    used_days = Column(Numeric(5, 1), default=0)
    carried_over_days = Column(Numeric(5, 1), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    staff = relationship("Staff")
    leave_type = relationship("LeaveType")

class LeaveRequest(TenantBase):
    """Leave requests from staff"""
    __tablename__ = "leave_requests"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    leave_type_id = Column(String, ForeignKey("leave_types.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_requested = Column(Numeric(5, 1), nullable=False)
    reason = Column(Text)
    status = Column(String(50), default="pending")  # pending, approved, rejected, cancelled
    approved_by_id = Column(String, ForeignKey("staff.id"))
    approved_at = Column(DateTime)
    rejection_reason = Column(Text)
    relief_staff_id = Column(String, ForeignKey("staff.id"))
    attachment_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    staff = relationship("Staff", foreign_keys=[staff_id])
    leave_type = relationship("LeaveType")
    approved_by = relationship("Staff", foreign_keys=[approved_by_id])
    relief_staff = relationship("Staff", foreign_keys=[relief_staff_id])

class Attendance(TenantBase):
    """Daily attendance records"""
    __tablename__ = "attendance"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    date = Column(Date, nullable=False)
    clock_in = Column(DateTime)
    clock_out = Column(DateTime)
    status = Column(String(50), default="present")  # present, absent, late, half_day, on_leave
    late_minutes = Column(Integer, default=0)
    overtime_minutes = Column(Integer, default=0)
    notes = Column(Text)
    branch_id = Column(String, ForeignKey("branches.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff")
    branch = relationship("Branch")

class PayrollConfig(TenantBase):
    """Staff salary and payroll configuration"""
    __tablename__ = "payroll_configs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False, unique=True)
    basic_salary = Column(Numeric(15, 2), default=0)
    house_allowance = Column(Numeric(15, 2), default=0)
    transport_allowance = Column(Numeric(15, 2), default=0)
    other_allowances = Column(Numeric(15, 2), default=0)
    nhif_deduction = Column(Numeric(15, 2), default=0)
    nssf_deduction = Column(Numeric(15, 2), default=0)
    paye_tax = Column(Numeric(15, 2), default=0)
    other_deductions = Column(Numeric(15, 2), default=0)
    bank_name = Column(String(100))
    bank_account_number = Column(String(50))
    bank_branch = Column(String(100))
    payment_method = Column(String(50), default="bank_transfer")  # bank_transfer, cash, mpesa
    effective_date = Column(Date)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    staff = relationship("Staff")

class Payslip(TenantBase):
    """Generated payslips"""
    __tablename__ = "payslips"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    pay_period = Column(String(20), nullable=False)  # e.g., "2026-02"
    pay_date = Column(Date, nullable=False)
    basic_salary = Column(Numeric(15, 2), default=0)
    house_allowance = Column(Numeric(15, 2), default=0)
    transport_allowance = Column(Numeric(15, 2), default=0)
    other_allowances = Column(Numeric(15, 2), default=0)
    gross_salary = Column(Numeric(15, 2), default=0)
    nhif_deduction = Column(Numeric(15, 2), default=0)
    nssf_deduction = Column(Numeric(15, 2), default=0)
    paye_tax = Column(Numeric(15, 2), default=0)
    loan_deductions = Column(Numeric(15, 2), default=0)
    shortage_deductions = Column(Numeric(15, 2), default=0)
    other_deductions = Column(Numeric(15, 2), default=0)
    total_deductions = Column(Numeric(15, 2), default=0)
    net_salary = Column(Numeric(15, 2), default=0)
    days_worked = Column(Integer, default=0)
    days_absent = Column(Integer, default=0)
    overtime_hours = Column(Numeric(5, 1), default=0)
    overtime_pay = Column(Numeric(15, 2), default=0)
    status = Column(String(50), default="draft")  # draft, approved, paid
    approved_by_id = Column(String, ForeignKey("staff.id"))
    approved_at = Column(DateTime)
    paid_at = Column(DateTime)
    emailed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff", foreign_keys=[staff_id])
    approved_by = relationship("Staff", foreign_keys=[approved_by_id])

class EmployeeDocument(TenantBase):
    """Staff documents like contracts, IDs, certificates"""
    __tablename__ = "employee_documents"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    document_type = Column(String(50), nullable=False)  # contract, national_id, passport, certificate, resume, other
    document_name = Column(String(200), nullable=False)
    file_url = Column(String(500))
    file_size = Column(Integer)
    expiry_date = Column(Date)
    is_verified = Column(Boolean, default=False)
    verified_by_id = Column(String, ForeignKey("staff.id"))
    verified_at = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff", foreign_keys=[staff_id])
    verified_by = relationship("Staff", foreign_keys=[verified_by_id])

class StaffProfile(TenantBase):
    """Extended staff profile information"""
    __tablename__ = "staff_profiles"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False, unique=True)
    date_of_birth = Column(Date)
    gender = Column(String(20))
    marital_status = Column(String(50))
    national_id = Column(String(50))
    kra_pin = Column(String(50))
    nhif_number = Column(String(50))
    nssf_number = Column(String(50))
    address = Column(Text)
    city = Column(String(100))
    postal_code = Column(String(20))
    emergency_contact_name = Column(String(200))
    emergency_contact_phone = Column(String(50))
    emergency_contact_relationship = Column(String(100))
    next_of_kin_name = Column(String(200))
    next_of_kin_phone = Column(String(50))
    next_of_kin_relationship = Column(String(100))
    next_of_kin_address = Column(Text)
    employment_date = Column(Date)
    contract_type = Column(String(50))  # permanent, contract, probation, intern
    contract_end_date = Column(Date)
    department = Column(String(100))
    job_title = Column(String(100))
    reporting_to_id = Column(String, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    staff = relationship("Staff", foreign_keys=[staff_id])
    reporting_to = relationship("Staff", foreign_keys=[reporting_to_id])

class DisciplinaryRecord(TenantBase):
    """Disciplinary actions and records"""
    __tablename__ = "disciplinary_records"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    action_type = Column(String(50), nullable=False)  # verbal_warning, written_warning, suspension, termination
    incident_date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    action_taken = Column(Text)
    suspension_start_date = Column(Date)
    suspension_end_date = Column(Date)
    issued_by_id = Column(String, ForeignKey("staff.id"), nullable=True)
    witness_id = Column(String, ForeignKey("staff.id"))
    staff_response = Column(Text)
    follow_up_date = Column(Date)
    is_resolved = Column(Boolean, default=False)
    resolution_notes = Column(Text)
    attachment_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff", foreign_keys=[staff_id])
    issued_by = relationship("Staff", foreign_keys=[issued_by_id])
    witness = relationship("Staff", foreign_keys=[witness_id])

class TrainingRecord(TenantBase):
    """Training and certification records"""
    __tablename__ = "training_records"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    training_name = Column(String(200), nullable=False)
    training_type = Column(String(50))  # internal, external, online, certification
    provider = Column(String(200))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    duration_hours = Column(Integer)
    status = Column(String(50), default="scheduled")  # scheduled, in_progress, completed, cancelled
    score = Column(Numeric(5, 2))
    passed = Column(Boolean)
    certificate_url = Column(String(500))
    certificate_expiry = Column(Date)
    cost = Column(Numeric(15, 2), default=0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff")

class PayPeriod(TenantBase):
    """Pay period definitions for payroll processing"""
    __tablename__ = "pay_periods"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    period_type = Column(String(20), default="monthly")
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    pay_date = Column(Date, nullable=False)
    status = Column(String(50), default="open")
    total_gross = Column(Numeric(15, 2), default=0)
    total_deductions = Column(Numeric(15, 2), default=0)
    total_net = Column(Numeric(15, 2), default=0)
    staff_count = Column(Integer, default=0)
    processed_by_id = Column(String, ForeignKey("staff.id"))
    processed_at = Column(DateTime)
    approved_by_id = Column(String, ForeignKey("staff.id"))
    approved_at = Column(DateTime)
    paid_at = Column(DateTime)
    journal_entry_id = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    processed_by = relationship("Staff", foreign_keys=[processed_by_id])
    approved_by = relationship("Staff", foreign_keys=[approved_by_id])

class PayrollRun(TenantBase):
    """Individual payroll run records linking pay periods to payslips"""
    __tablename__ = "payroll_runs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    pay_period_id = Column(String, ForeignKey("pay_periods.id"), nullable=False)
    run_number = Column(Integer, default=1)
    run_type = Column(String(50), default="regular")
    status = Column(String(50), default="draft")
    total_gross = Column(Numeric(15, 2), default=0)
    total_deductions = Column(Numeric(15, 2), default=0)
    total_net = Column(Numeric(15, 2), default=0)
    staff_count = Column(Integer, default=0)
    disbursement_method = Column(String(50))
    disbursed_by_id = Column(String, ForeignKey("staff.id"))
    disbursed_at = Column(DateTime)
    created_by_id = Column(String, ForeignKey("staff.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    pay_period = relationship("PayPeriod")
    created_by = relationship("Staff", foreign_keys=[created_by_id])
    disbursed_by = relationship("Staff", foreign_keys=[disbursed_by_id])

class SalaryAdvance(TenantBase):
    """Salary advances requested by staff"""
    __tablename__ = "salary_advances"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id"), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    reason = Column(Text)
    request_date = Column(Date, default=date.today)
    status = Column(String(50), default="pending")
    approved_by_id = Column(String, ForeignKey("staff.id"))
    approved_at = Column(DateTime)
    disbursed_at = Column(DateTime)
    recovery_start_period = Column(String(20))
    recovery_months = Column(Integer, default=1)
    amount_recovered = Column(Numeric(15, 2), default=0)
    is_fully_recovered = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    staff = relationship("Staff", foreign_keys=[staff_id])
    approved_by = relationship("Staff", foreign_keys=[approved_by_id])


class ExpenseCategory(TenantBase):
    """Expense categories for organizing expenses"""
    __tablename__ = "expense_categories"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    account_id = Column(String)  # Link to Chart of Accounts expense account
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    expenses = relationship("Expense", back_populates="category")

class Expense(TenantBase):
    """Expense records"""
    __tablename__ = "expenses"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    expense_number = Column(String(50), unique=True, nullable=False)
    category_id = Column(String, ForeignKey("expense_categories.id"), nullable=False)
    branch_id = Column(String, ForeignKey("branches.id"))
    amount = Column(Numeric(15, 2), nullable=False)
    expense_date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    vendor = Column(String(200))
    receipt_number = Column(String(100))
    payment_method = Column(String(50))  # cash, bank_transfer, mpesa, cheque
    payment_reference = Column(String(100))
    status = Column(String(50), default="pending")  # pending, approved, rejected, paid
    created_by_id = Column(String, ForeignKey("staff.id"), nullable=True)
    created_by_admin_name = Column(String(200), nullable=True)
    approved_by_id = Column(String, ForeignKey("staff.id"))
    approved_at = Column(DateTime)
    journal_entry_id = Column(String)
    notes = Column(Text)
    is_recurring = Column(Boolean, default=False)
    recurrence_interval = Column(String(50))  # daily, weekly, monthly, quarterly, yearly
    next_due_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    category = relationship("ExpenseCategory", back_populates="expenses")
    branch = relationship("Branch")
    created_by = relationship("Staff", foreign_keys=[created_by_id])
    approved_by = relationship("Staff", foreign_keys=[approved_by_id])

