"""
Accounting Schemas - Pydantic models for API requests/responses
"""

from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

class AccountType(str, Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    INCOME = "income"
    EXPENSE = "expense"

class AccountCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=255)
    account_type: AccountType
    parent_id: Optional[str] = None
    description: Optional[str] = None
    is_header: bool = False

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    is_active: Optional[bool] = None

class AccountResponse(BaseModel):
    id: str
    code: str
    name: str
    account_type: str
    parent_id: Optional[str] = None
    description: Optional[str] = None
    normal_balance: str
    is_system: bool
    is_active: bool
    is_header: bool
    current_balance: Decimal
    created_at: datetime
    
    class Config:
        from_attributes = True

class JournalLineCreate(BaseModel):
    account_id: str
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    memo: Optional[str] = None
    member_id: Optional[str] = None
    loan_id: Optional[str] = None
    
    @model_validator(mode="after")
    def validate_debit_credit(self):
        if self.debit == 0 and self.credit == 0:
            raise ValueError("Either debit or credit must be non-zero")
        if self.debit != 0 and self.credit != 0:
            raise ValueError("A line cannot have both debit and credit")
        return self

class JournalEntryCreate(BaseModel):
    entry_date: date
    description: str
    reference: Optional[str] = None
    lines: List[JournalLineCreate] = Field(..., min_length=2)
    
    @model_validator(mode="after")
    def validate_balanced(self):
        total_debit = sum(line.debit for line in self.lines)
        total_credit = sum(line.credit for line in self.lines)
        if total_debit != total_credit:
            raise ValueError(f"Entry must be balanced. Debit: {total_debit}, Credit: {total_credit}")
        return self

class JournalLineResponse(BaseModel):
    id: str
    account_id: str
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    debit: Decimal
    credit: Decimal
    memo: Optional[str] = None
    member_id: Optional[str] = None
    loan_id: Optional[str] = None
    
    class Config:
        from_attributes = True

class JournalEntryResponse(BaseModel):
    id: str
    entry_number: str
    entry_date: date
    description: str
    reference: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    status: str
    total_debit: Decimal
    total_credit: Decimal
    is_reversed: bool
    lines: List[JournalLineResponse] = []
    created_at: datetime
    
    class Config:
        from_attributes = True

class FiscalPeriodCreate(BaseModel):
    name: str
    period_type: str = "month"
    start_date: date
    end_date: date

class FiscalPeriodResponse(BaseModel):
    id: str
    name: str
    period_type: str
    start_date: date
    end_date: date
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class TrialBalanceEntry(BaseModel):
    account_id: str
    account_code: str
    account_name: str
    account_type: str
    debit_balance: Decimal
    credit_balance: Decimal

class TrialBalanceResponse(BaseModel):
    as_of_date: date
    entries: List[TrialBalanceEntry]
    total_debits: Decimal
    total_credits: Decimal
    is_balanced: bool

class IncomeStatementEntry(BaseModel):
    account_id: str
    account_code: str
    account_name: str
    amount: Decimal

class IncomeStatementResponse(BaseModel):
    start_date: date
    end_date: date
    income: List[IncomeStatementEntry]
    expenses: List[IncomeStatementEntry]
    total_income: Decimal
    total_expenses: Decimal
    net_income: Decimal

class BalanceSheetEntry(BaseModel):
    account_id: str
    account_code: str
    account_name: str
    balance: Decimal

class BalanceSheetResponse(BaseModel):
    as_of_date: date
    assets: List[BalanceSheetEntry]
    liabilities: List[BalanceSheetEntry]
    equity: List[BalanceSheetEntry]
    total_assets: Decimal
    total_liabilities: Decimal
    total_equity: Decimal
    retained_earnings: Decimal

class AccountBalanceResponse(BaseModel):
    account_id: str
    account_code: str
    account_name: str
    opening_balance: Decimal
    total_debits: Decimal
    total_credits: Decimal
    closing_balance: Decimal
