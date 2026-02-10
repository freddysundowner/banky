"""
Accounting Database Models - Chart of Accounts, Journal Entries, General Ledger
"""

import uuid
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Integer, ForeignKey, Date, Index
from sqlalchemy.orm import relationship
from models.tenant import TenantBase

def generate_uuid():
    return str(uuid.uuid4())

class AccountType(str, Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    INCOME = "income"
    EXPENSE = "expense"

ACCOUNT_TYPES = {
    AccountType.ASSET: {"normal_balance": "debit", "label": "Assets"},
    AccountType.LIABILITY: {"normal_balance": "credit", "label": "Liabilities"},
    AccountType.EQUITY: {"normal_balance": "credit", "label": "Equity"},
    AccountType.INCOME: {"normal_balance": "credit", "label": "Income"},
    AccountType.EXPENSE: {"normal_balance": "debit", "label": "Expenses"},
}

class ChartOfAccounts(TenantBase):
    """Chart of Accounts - All ledger accounts for the organization"""
    __tablename__ = "chart_of_accounts"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    code = Column(String(20), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    account_type = Column(String(20), nullable=False)  # asset, liability, equity, income, expense
    parent_id = Column(String, ForeignKey("chart_of_accounts.id"))
    description = Column(Text)
    normal_balance = Column(String(10), default="debit")  # debit or credit
    is_system = Column(Boolean, default=False)  # System accounts cannot be deleted
    is_active = Column(Boolean, default=True)
    is_header = Column(Boolean, default=False)  # Header accounts group sub-accounts
    current_balance = Column(Numeric(15, 2), default=0)  # Running balance
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    parent = relationship("ChartOfAccounts", remote_side=[id], backref="children")
    journal_lines = relationship("JournalLine", back_populates="account")
    
    __table_args__ = (
        Index("idx_coa_code", "code"),
        Index("idx_coa_type", "account_type"),
    )

class JournalEntry(TenantBase):
    """Journal Entry - A complete transaction with balanced debits and credits"""
    __tablename__ = "journal_entries"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    entry_number = Column(String(50), nullable=False, unique=True)
    entry_date = Column(Date, nullable=False, default=date.today)
    description = Column(Text, nullable=False)
    reference = Column(String(255))  # External reference (transaction number, loan ID, etc.)
    source_type = Column(String(50))  # transaction, loan, repayment, fixed_deposit, manual, etc.
    source_id = Column(String(255))  # ID of the source record
    is_reversed = Column(Boolean, default=False)
    reversed_by_id = Column(String, ForeignKey("journal_entries.id"))
    reversal_of_id = Column(String, ForeignKey("journal_entries.id"))
    status = Column(String(20), default="posted")  # draft, posted, reversed
    total_debit = Column(Numeric(15, 2), default=0)
    total_credit = Column(Numeric(15, 2), default=0)
    fiscal_period_id = Column(String, ForeignKey("fiscal_periods.id"))
    created_by_id = Column(String)  # Staff ID who created
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    lines = relationship("JournalLine", back_populates="journal_entry", cascade="all, delete-orphan")
    fiscal_period = relationship("FiscalPeriod", back_populates="journal_entries")
    
    __table_args__ = (
        Index("idx_je_date", "entry_date"),
        Index("idx_je_source", "source_type", "source_id"),
        Index("idx_je_number", "entry_number"),
    )

class JournalLine(TenantBase):
    """Journal Line - Individual debit or credit line in a journal entry"""
    __tablename__ = "journal_lines"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    journal_entry_id = Column(String, ForeignKey("journal_entries.id"), nullable=False)
    account_id = Column(String, ForeignKey("chart_of_accounts.id"), nullable=False)
    debit = Column(Numeric(15, 2), default=0)
    credit = Column(Numeric(15, 2), default=0)
    memo = Column(Text)  # Line-level description
    member_id = Column(String)  # Optional: for member-specific entries
    loan_id = Column(String)  # Optional: for loan-specific entries
    created_at = Column(DateTime, default=datetime.utcnow)
    
    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("ChartOfAccounts", back_populates="journal_lines")
    
    __table_args__ = (
        Index("idx_jl_account", "account_id"),
        Index("idx_jl_entry", "journal_entry_id"),
    )

class FiscalPeriod(TenantBase):
    """Fiscal Period - Accounting periods for reporting"""
    __tablename__ = "fiscal_periods"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)  # e.g., "January 2026", "Q1 2026", "FY 2026"
    period_type = Column(String(20), default="month")  # month, quarter, year
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), default="open")  # open, closed, locked
    closed_at = Column(DateTime)
    closed_by_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    journal_entries = relationship("JournalEntry", back_populates="fiscal_period")
    
    __table_args__ = (
        Index("idx_fp_dates", "start_date", "end_date"),
    )
