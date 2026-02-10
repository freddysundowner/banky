"""
Accounting Module - Full Double-Entry Bookkeeping System

This module provides:
- Chart of Accounts management
- Journal entries with debit/credit lines
- General Ledger tracking
- Financial reports (Trial Balance, Income Statement, Balance Sheet)
"""

from .models import (
    ChartOfAccounts,
    JournalEntry,
    JournalLine,
    FiscalPeriod,
    AccountType,
    ACCOUNT_TYPES
)
from .service import AccountingService
from .routes import router as accounting_router

__all__ = [
    "ChartOfAccounts",
    "JournalEntry",
    "JournalLine",
    "FiscalPeriod",
    "AccountType",
    "ACCOUNT_TYPES",
    "AccountingService",
    "accounting_router"
]
