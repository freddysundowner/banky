import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Time, JSON, Integer, Numeric, Enum as SQLEnum
from sqlalchemy.orm import relationship
from models.database import Base
import enum

def generate_uuid():
    return str(uuid.uuid4())

class PlanType(str, enum.Enum):
    STARTER = "starter"
    GROWTH = "growth"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"

class LicenseEdition(str, enum.Enum):
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"

class SubscriptionStatus(str, enum.Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    EXPIRED = "expired"

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    plan_type = Column(String(50), nullable=False)
    pricing_model = Column(String(20), default="saas")  # 'saas' or 'enterprise'
    monthly_price = Column(Numeric(10, 2), default=0)
    annual_price = Column(Numeric(10, 2), default=0)
    one_time_price = Column(Numeric(10, 2), default=0)  # For enterprise plans
    max_members = Column(Integer, default=500)
    max_staff = Column(Integer, default=3)
    max_branches = Column(Integer, default=1)
    sms_credits_monthly = Column(Integer, default=0)
    support_years = Column(Integer, default=1)  # For enterprise plans
    sort_order = Column(Integer, default=0)
    features = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class OrganizationSubscription(Base):
    __tablename__ = "organization_subscriptions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, unique=True)
    plan_id = Column(String, ForeignKey("subscription_plans.id"))
    status = Column(String(50), default="trial")
    trial_ends_at = Column(DateTime)
    current_period_start = Column(DateTime)
    current_period_end = Column(DateTime)
    sms_credits_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    organization = relationship("Organization", backref="subscription")
    plan = relationship("SubscriptionPlan")

class LicenseKey(Base):
    __tablename__ = "license_keys"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    license_key = Column(String(100), unique=True, nullable=False)
    edition = Column(String(50), nullable=False)
    organization_name = Column(String(255))
    contact_email = Column(String(255))
    features = Column(JSON, default=dict)
    max_members = Column(Integer)
    max_staff = Column(Integer)
    max_branches = Column(Integer)
    issued_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)

class PlatformSettings(Base):
    __tablename__ = "platform_settings"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    setting_key = Column(String(100), unique=True, nullable=False)
    setting_value = Column(Text)
    setting_type = Column(String(50), default="string")
    description = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

class AdminUser(Base):
    __tablename__ = "admin_users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(Text, nullable=False)
    name = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)

class AdminSession(Base):
    __tablename__ = "admin_sessions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    admin_id = Column(String, ForeignKey("admin_users.id"), nullable=False)
    token = Column(Text, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    admin = relationship("AdminUser")

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(Text, nullable=False)  # matches existing schema
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone = Column(String(50))
    is_email_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    memberships = relationship("OrganizationMember", back_populates="user")
    sessions = relationship("Session", back_populates="user")

class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    logo = Column(Text)
    email = Column(String(255))
    phone = Column(String(50))
    address = Column(Text)
    staff_email_domain = Column(String(255))
    deployment_mode = Column(String(50))
    working_hours_start = Column(Time)
    working_hours_end = Column(Time)
    working_days = Column(JSON)
    currency = Column(String(10))
    financial_year_start = Column(String(10))
    enforce_working_hours = Column(Boolean, default=False)
    auto_logout_minutes = Column(String(10))
    require_two_factor_auth = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    neon_project_id = Column(String(255))
    neon_branch_id = Column(String(255))
    connection_string = Column(Text)
    
    members = relationship("OrganizationMember", back_populates="organization")

class OrganizationMember(Base):
    __tablename__ = "organization_members"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String(50), default="member")
    is_owner = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="memberships")

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token = Column(Text, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="sessions")
