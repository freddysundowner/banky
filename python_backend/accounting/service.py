"""
Accounting Service - Core business logic for double-entry bookkeeping
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from .models import ChartOfAccounts, JournalEntry, JournalLine, FiscalPeriod, AccountType, ACCOUNT_TYPES
from services.code_generator import generate_journal_code

DEFAULT_ACCOUNTS = [
    {"code": "1000", "name": "Cash on Hand", "type": "asset", "is_system": True},
    {"code": "1010", "name": "Cash at Bank", "type": "asset", "is_system": True},
    {"code": "1020", "name": "Teller Float", "type": "asset", "is_system": True},
    {"code": "1030", "name": "Branch Vault", "type": "asset", "is_system": True},
    {"code": "1100", "name": "Loans Receivable", "type": "asset", "is_system": True},
    {"code": "1110", "name": "Interest Receivable", "type": "asset", "is_system": True},
    {"code": "1120", "name": "Loan Loss Provision", "type": "asset", "is_system": True},
    {"code": "1200", "name": "Prepaid Expenses", "type": "asset", "is_system": True},
    {"code": "1300", "name": "Fixed Assets", "type": "asset", "is_system": True},
    {"code": "1310", "name": "Accumulated Depreciation", "type": "asset", "is_system": True},
    
    {"code": "2000", "name": "Member Savings", "type": "liability", "is_system": True},
    {"code": "2010", "name": "Member Shares", "type": "liability", "is_system": True},
    {"code": "2020", "name": "Member Fixed Deposits", "type": "liability", "is_system": True},
    {"code": "2100", "name": "Interest Payable", "type": "liability", "is_system": True},
    {"code": "2200", "name": "Accounts Payable", "type": "liability", "is_system": True},
    {"code": "2300", "name": "Accrued Expenses", "type": "liability", "is_system": True},
    
    {"code": "3000", "name": "Share Capital", "type": "equity", "is_system": True},
    {"code": "3100", "name": "Retained Earnings", "type": "equity", "is_system": True},
    {"code": "3200", "name": "Statutory Reserves", "type": "equity", "is_system": True},
    {"code": "3300", "name": "Other Reserves", "type": "equity", "is_system": True},
    
    {"code": "4000", "name": "Loan Interest Income", "type": "income", "is_system": True},
    {"code": "4010", "name": "Processing Fee Income", "type": "income", "is_system": True},
    {"code": "4020", "name": "Penalty Income", "type": "income", "is_system": True},
    {"code": "4030", "name": "Insurance Fee Income", "type": "income", "is_system": True},
    {"code": "4100", "name": "Registration Fee Income", "type": "income", "is_system": True},
    {"code": "4200", "name": "Other Income", "type": "income", "is_system": True},
    
    {"code": "5000", "name": "Interest Expense - Fixed Deposits", "type": "expense", "is_system": True},
    {"code": "5010", "name": "Interest Expense - Savings", "type": "expense", "is_system": True},
    {"code": "5100", "name": "Salaries & Wages", "type": "expense", "is_system": True},
    {"code": "5200", "name": "Rent Expense", "type": "expense", "is_system": True},
    {"code": "5300", "name": "Utilities Expense", "type": "expense", "is_system": True},
    {"code": "5400", "name": "Office Supplies", "type": "expense", "is_system": True},
    {"code": "5500", "name": "Depreciation Expense", "type": "expense", "is_system": True},
    {"code": "5600", "name": "Bad Debt Expense", "type": "expense", "is_system": True},
    {"code": "5700", "name": "Bank Charges", "type": "expense", "is_system": True},
    {"code": "5800", "name": "SMS & Communication", "type": "expense", "is_system": True},
    {"code": "5900", "name": "Other Expenses", "type": "expense", "is_system": True},
    
    {"code": "5030", "name": "Bad Debt Write-offs", "type": "expense", "is_system": True},
    {"code": "5040", "name": "Penalty Waiver Expense", "type": "expense", "is_system": True},
]

class AccountingService:
    """Core accounting service for double-entry bookkeeping"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def seed_default_accounts(self) -> int:
        """Create default chart of accounts if not exists"""
        created = 0
        for acc in DEFAULT_ACCOUNTS:
            existing = self.session.query(ChartOfAccounts).filter(
                ChartOfAccounts.code == acc["code"]
            ).first()
            if not existing:
                normal_balance = ACCOUNT_TYPES[AccountType(acc["type"])]["normal_balance"]
                account = ChartOfAccounts(
                    code=acc["code"],
                    name=acc["name"],
                    account_type=acc["type"],
                    normal_balance=normal_balance,
                    is_system=acc.get("is_system", False),
                    is_active=True
                )
                self.session.add(account)
                created += 1
        if created > 0:
            self.session.commit()
        return created
    
    def get_account_by_code(self, code: str) -> Optional[ChartOfAccounts]:
        """Get account by code"""
        return self.session.query(ChartOfAccounts).filter(
            ChartOfAccounts.code == code
        ).first()
    
    def get_next_entry_number(self) -> str:
        """Generate next journal entry number"""
        return generate_journal_code()
    
    def create_journal_entry(
        self,
        entry_date: date,
        description: str,
        lines: List[Dict[str, Any]],
        reference: Optional[str] = None,
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
        created_by_id: Optional[str] = None
    ) -> JournalEntry:
        """
        Create a balanced journal entry with debit/credit lines.
        
        Args:
            entry_date: Date of the entry
            description: Description of the transaction
            lines: List of dicts with keys: account_code or account_id, debit, credit, memo
            reference: External reference number
            source_type: Type of source (transaction, loan, repayment, fixed_deposit, etc.)
            source_id: ID of the source record
            created_by_id: Staff ID who created the entry
        
        Returns:
            Created JournalEntry object
        
        Raises:
            ValueError if entry is not balanced
        """
        total_debit = Decimal("0")
        total_credit = Decimal("0")
        
        resolved_lines = []
        for line in lines:
            account = None
            if "account_code" in line:
                account = self.get_account_by_code(line["account_code"])
            elif "account_id" in line:
                account = self.session.query(ChartOfAccounts).filter(
                    ChartOfAccounts.id == line["account_id"]
                ).first()
            
            if not account:
                raise ValueError(f"Account not found: {line.get('account_code') or line.get('account_id')}")
            
            debit = Decimal(str(line.get("debit", 0)))
            credit = Decimal(str(line.get("credit", 0)))
            
            if debit < 0 or credit < 0:
                raise ValueError("Debit and credit amounts must be non-negative")
            
            total_debit += debit
            total_credit += credit
            
            resolved_lines.append({
                "account": account,
                "debit": debit,
                "credit": credit,
                "memo": line.get("memo"),
                "member_id": line.get("member_id"),
                "loan_id": line.get("loan_id")
            })
        
        if total_debit != total_credit:
            raise ValueError(f"Journal entry must be balanced. Debit: {total_debit}, Credit: {total_credit}")
        
        if total_debit == 0:
            raise ValueError("Journal entry cannot have zero amounts")
        
        entry = JournalEntry(
            entry_number=self.get_next_entry_number(),
            entry_date=entry_date,
            description=description,
            reference=reference,
            source_type=source_type,
            source_id=source_id,
            total_debit=total_debit,
            total_credit=total_credit,
            created_by_id=created_by_id,
            status="posted"
        )
        self.session.add(entry)
        self.session.flush()
        
        for line_data in resolved_lines:
            account = line_data["account"]
            debit = line_data["debit"]
            credit = line_data["credit"]
            
            journal_line = JournalLine(
                journal_entry_id=entry.id,
                account_id=account.id,
                debit=debit,
                credit=credit,
                memo=line_data.get("memo"),
                member_id=line_data.get("member_id"),
                loan_id=line_data.get("loan_id")
            )
            self.session.add(journal_line)
            
            if account.normal_balance == "debit":
                account.current_balance = (account.current_balance or Decimal("0")) + debit - credit
            else:
                account.current_balance = (account.current_balance or Decimal("0")) + credit - debit
        
        self.session.commit()
        return entry
    
    def reverse_journal_entry(self, entry_id: str, created_by_id: Optional[str] = None) -> JournalEntry:
        """Reverse a journal entry by creating an opposite entry"""
        original = self.session.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
        if not original:
            raise ValueError("Journal entry not found")
        
        if original.is_reversed:
            raise ValueError("Entry has already been reversed")
        
        reversal_lines = []
        for line in original.lines:
            reversal_lines.append({
                "account_id": line.account_id,
                "debit": line.credit,
                "credit": line.debit,
                "memo": f"Reversal of {original.entry_number}"
            })
        
        reversal = self.create_journal_entry(
            entry_date=date.today(),
            description=f"Reversal of {original.entry_number}: {original.description}",
            lines=reversal_lines,
            reference=original.reference,
            source_type="reversal",
            source_id=original.id,
            created_by_id=created_by_id
        )
        
        original.is_reversed = True
        original.reversed_by_id = reversal.id
        reversal.reversal_of_id = original.id
        
        self.session.commit()
        return reversal
    
    def get_trial_balance(self, as_of_date: date) -> Dict[str, Any]:
        """Generate trial balance as of a specific date"""
        accounts = self.session.query(ChartOfAccounts).filter(
            ChartOfAccounts.is_active == True,
            ChartOfAccounts.is_header == False
        ).order_by(ChartOfAccounts.code).all()
        
        entries = []
        total_debits = Decimal("0")
        total_credits = Decimal("0")
        
        for account in accounts:
            debit_sum = self.session.query(func.sum(JournalLine.debit)).join(
                JournalEntry
            ).filter(
                JournalLine.account_id == account.id,
                JournalEntry.entry_date <= as_of_date,
                JournalEntry.status == "posted"
            ).scalar() or Decimal("0")
            
            credit_sum = self.session.query(func.sum(JournalLine.credit)).join(
                JournalEntry
            ).filter(
                JournalLine.account_id == account.id,
                JournalEntry.entry_date <= as_of_date,
                JournalEntry.status == "posted"
            ).scalar() or Decimal("0")
            
            if debit_sum == 0 and credit_sum == 0:
                continue
            
            if account.normal_balance == "debit":
                balance = debit_sum - credit_sum
                if balance >= 0:
                    debit_balance = balance
                    credit_balance = Decimal("0")
                else:
                    debit_balance = Decimal("0")
                    credit_balance = abs(balance)
            else:
                balance = credit_sum - debit_sum
                if balance >= 0:
                    credit_balance = balance
                    debit_balance = Decimal("0")
                else:
                    credit_balance = Decimal("0")
                    debit_balance = abs(balance)
            
            total_debits += debit_balance
            total_credits += credit_balance
            
            entries.append({
                "account_id": account.id,
                "account_code": account.code,
                "account_name": account.name,
                "account_type": account.account_type,
                "debit_balance": debit_balance,
                "credit_balance": credit_balance
            })
        
        return {
            "as_of_date": as_of_date,
            "entries": entries,
            "total_debits": total_debits,
            "total_credits": total_credits,
            "is_balanced": total_debits == total_credits
        }
    
    def get_income_statement(self, start_date: date, end_date: date) -> Dict[str, Any]:
        """Generate income statement for a period"""
        income_accounts = self.session.query(ChartOfAccounts).filter(
            ChartOfAccounts.account_type == "income",
            ChartOfAccounts.is_active == True,
            ChartOfAccounts.is_header == False
        ).order_by(ChartOfAccounts.code).all()
        
        expense_accounts = self.session.query(ChartOfAccounts).filter(
            ChartOfAccounts.account_type == "expense",
            ChartOfAccounts.is_active == True,
            ChartOfAccounts.is_header == False
        ).order_by(ChartOfAccounts.code).all()
        
        income_entries = []
        total_income = Decimal("0")
        
        for account in income_accounts:
            credit_sum = self.session.query(func.sum(JournalLine.credit)).join(
                JournalEntry
            ).filter(
                JournalLine.account_id == account.id,
                JournalEntry.entry_date >= start_date,
                JournalEntry.entry_date <= end_date,
                JournalEntry.status == "posted"
            ).scalar() or Decimal("0")
            
            debit_sum = self.session.query(func.sum(JournalLine.debit)).join(
                JournalEntry
            ).filter(
                JournalLine.account_id == account.id,
                JournalEntry.entry_date >= start_date,
                JournalEntry.entry_date <= end_date,
                JournalEntry.status == "posted"
            ).scalar() or Decimal("0")
            
            amount = credit_sum - debit_sum
            if amount != 0:
                income_entries.append({
                    "account_id": account.id,
                    "account_code": account.code,
                    "account_name": account.name,
                    "amount": amount
                })
                total_income += amount
        
        expense_entries = []
        total_expenses = Decimal("0")
        
        for account in expense_accounts:
            debit_sum = self.session.query(func.sum(JournalLine.debit)).join(
                JournalEntry
            ).filter(
                JournalLine.account_id == account.id,
                JournalEntry.entry_date >= start_date,
                JournalEntry.entry_date <= end_date,
                JournalEntry.status == "posted"
            ).scalar() or Decimal("0")
            
            credit_sum = self.session.query(func.sum(JournalLine.credit)).join(
                JournalEntry
            ).filter(
                JournalLine.account_id == account.id,
                JournalEntry.entry_date >= start_date,
                JournalEntry.entry_date <= end_date,
                JournalEntry.status == "posted"
            ).scalar() or Decimal("0")
            
            amount = debit_sum - credit_sum
            if amount != 0:
                expense_entries.append({
                    "account_id": account.id,
                    "account_code": account.code,
                    "account_name": account.name,
                    "amount": amount
                })
                total_expenses += amount
        
        return {
            "start_date": start_date,
            "end_date": end_date,
            "income": income_entries,
            "expenses": expense_entries,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_income": total_income - total_expenses
        }
    
    def get_balance_sheet(self, as_of_date: date) -> Dict[str, Any]:
        """Generate balance sheet as of a specific date"""
        def get_accounts_with_balance(account_type: str) -> List[Dict]:
            accounts = self.session.query(ChartOfAccounts).filter(
                ChartOfAccounts.account_type == account_type,
                ChartOfAccounts.is_active == True,
                ChartOfAccounts.is_header == False
            ).order_by(ChartOfAccounts.code).all()
            
            result = []
            for account in accounts:
                debit_sum = self.session.query(func.sum(JournalLine.debit)).join(
                    JournalEntry
                ).filter(
                    JournalLine.account_id == account.id,
                    JournalEntry.entry_date <= as_of_date,
                    JournalEntry.status == "posted"
                ).scalar() or Decimal("0")
                
                credit_sum = self.session.query(func.sum(JournalLine.credit)).join(
                    JournalEntry
                ).filter(
                    JournalLine.account_id == account.id,
                    JournalEntry.entry_date <= as_of_date,
                    JournalEntry.status == "posted"
                ).scalar() or Decimal("0")
                
                if account.normal_balance == "debit":
                    balance = debit_sum - credit_sum
                else:
                    balance = credit_sum - debit_sum
                
                if balance != 0:
                    result.append({
                        "account_id": account.id,
                        "account_code": account.code,
                        "account_name": account.name,
                        "balance": balance
                    })
            return result
        
        assets = get_accounts_with_balance("asset")
        liabilities = get_accounts_with_balance("liability")
        equity = get_accounts_with_balance("equity")
        
        total_assets = sum(a["balance"] for a in assets)
        total_liabilities = sum(a["balance"] for a in liabilities)
        total_equity = sum(a["balance"] for a in equity)
        
        income_stmt = self.get_income_statement(date(as_of_date.year, 1, 1), as_of_date)
        retained_earnings = income_stmt["net_income"]
        
        return {
            "as_of_date": as_of_date,
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity,
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity": total_equity,
            "retained_earnings": retained_earnings
        }
    
    def get_account_ledger(
        self,
        account_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get ledger entries for a specific account"""
        account = self.session.query(ChartOfAccounts).filter(
            ChartOfAccounts.id == account_id
        ).first()
        
        if not account:
            raise ValueError("Account not found")
        
        query = self.session.query(JournalLine).join(JournalEntry).filter(
            JournalLine.account_id == account_id,
            JournalEntry.status == "posted"
        )
        
        if start_date:
            query = query.filter(JournalEntry.entry_date >= start_date)
        if end_date:
            query = query.filter(JournalEntry.entry_date <= end_date)
        
        lines = query.order_by(JournalEntry.entry_date, JournalEntry.created_at).all()
        
        opening_balance = Decimal("0")
        if start_date:
            opening_debit = self.session.query(func.sum(JournalLine.debit)).join(
                JournalEntry
            ).filter(
                JournalLine.account_id == account_id,
                JournalEntry.entry_date < start_date,
                JournalEntry.status == "posted"
            ).scalar() or Decimal("0")
            
            opening_credit = self.session.query(func.sum(JournalLine.credit)).join(
                JournalEntry
            ).filter(
                JournalLine.account_id == account_id,
                JournalEntry.entry_date < start_date,
                JournalEntry.status == "posted"
            ).scalar() or Decimal("0")
            
            if account.normal_balance == "debit":
                opening_balance = opening_debit - opening_credit
            else:
                opening_balance = opening_credit - opening_debit
        
        total_debits = Decimal("0")
        total_credits = Decimal("0")
        entries = []
        running_balance = opening_balance
        
        for line in lines:
            total_debits += line.debit
            total_credits += line.credit
            
            if account.normal_balance == "debit":
                running_balance += line.debit - line.credit
            else:
                running_balance += line.credit - line.debit
            
            entries.append({
                "date": line.journal_entry.entry_date,
                "entry_number": line.journal_entry.entry_number,
                "description": line.journal_entry.description,
                "reference": line.journal_entry.reference,
                "debit": line.debit,
                "credit": line.credit,
                "balance": running_balance,
                "memo": line.memo
            })
        
        return {
            "account_id": account.id,
            "account_code": account.code,
            "account_name": account.name,
            "opening_balance": opening_balance,
            "total_debits": total_debits,
            "total_credits": total_credits,
            "closing_balance": running_balance,
            "entries": entries
        }

def post_member_deposit(
    accounting_service: AccountingService,
    member_id: str,
    amount: Decimal,
    account_type: str,
    payment_method: str,
    transaction_id: str,
    description: str,
    created_by_id: Optional[str] = None
) -> JournalEntry:
    """Post journal entry for member deposit (savings/shares)"""
    
    if payment_method == "cash":
        debit_account = "1000"
    elif payment_method == "bank_transfer":
        debit_account = "1010"
    elif payment_method == "mpesa":
        debit_account = "1010"
    else:
        debit_account = "1000"
    
    if account_type == "savings":
        credit_account = "2000"
    elif account_type == "shares":
        credit_account = "2010"
    else:
        credit_account = "2000"
    
    return accounting_service.create_journal_entry(
        entry_date=date.today(),
        description=description,
        reference=transaction_id,
        source_type="transaction",
        source_id=transaction_id,
        created_by_id=created_by_id,
        lines=[
            {"account_code": debit_account, "debit": amount, "credit": Decimal("0"), "member_id": member_id},
            {"account_code": credit_account, "debit": Decimal("0"), "credit": amount, "member_id": member_id}
        ]
    )

def post_member_withdrawal(
    accounting_service: AccountingService,
    member_id: str,
    amount: Decimal,
    account_type: str,
    payment_method: str,
    transaction_id: str,
    description: str,
    created_by_id: Optional[str] = None
) -> JournalEntry:
    """Post journal entry for member withdrawal"""
    
    if account_type == "savings":
        debit_account = "2000"
    elif account_type == "shares":
        debit_account = "2010"
    else:
        debit_account = "2000"
    
    if payment_method == "cash":
        credit_account = "1000"
    else:
        credit_account = "1010"
    
    return accounting_service.create_journal_entry(
        entry_date=date.today(),
        description=description,
        reference=transaction_id,
        source_type="transaction",
        source_id=transaction_id,
        created_by_id=created_by_id,
        lines=[
            {"account_code": debit_account, "debit": amount, "credit": Decimal("0"), "member_id": member_id},
            {"account_code": credit_account, "debit": Decimal("0"), "credit": amount, "member_id": member_id}
        ]
    )

def post_loan_disbursement(
    accounting_service: AccountingService,
    member_id: str,
    loan_id: str,
    principal_amount: Decimal,
    net_disbursed: Decimal,
    interest_amount: Decimal,
    processing_fee: Decimal,
    insurance_fee: Decimal,
    disbursement_method: str,
    description: str,
    created_by_id: Optional[str] = None
) -> JournalEntry:
    """Post journal entry for loan disbursement.
    
    For upfront interest deduction:
    - Debit Loans Receivable (1100) = principal
    - Credit Cash/Bank = net_disbursed (what member actually receives)
    - Credit Interest Income (4000) = interest_amount (if deducted upfront)
    - Credit Fee Income (4010) = processing_fee
    - Credit Insurance Income (4030) = insurance_fee
    """
    
    lines = [
        {"account_code": "1100", "debit": principal_amount, "credit": Decimal("0"), "member_id": member_id, "loan_id": loan_id, "memo": "Loan principal"},
    ]
    
    if disbursement_method == "cash":
        lines.append({"account_code": "1000", "debit": Decimal("0"), "credit": net_disbursed, "member_id": member_id, "loan_id": loan_id, "memo": "Cash disbursed"})
    else:
        lines.append({"account_code": "1010", "debit": Decimal("0"), "credit": net_disbursed, "member_id": member_id, "loan_id": loan_id, "memo": "Bank/Mpesa disbursed"})
    
    if interest_amount > 0:
        lines.append({"account_code": "4000", "debit": Decimal("0"), "credit": interest_amount, "member_id": member_id, "loan_id": loan_id, "memo": "Interest income (upfront)"})
    
    if processing_fee > 0:
        lines.append({"account_code": "4010", "debit": Decimal("0"), "credit": processing_fee, "member_id": member_id, "loan_id": loan_id, "memo": "Processing fee"})
    
    if insurance_fee > 0:
        lines.append({"account_code": "4030", "debit": Decimal("0"), "credit": insurance_fee, "member_id": member_id, "loan_id": loan_id, "memo": "Insurance fee"})
    
    return accounting_service.create_journal_entry(
        entry_date=date.today(),
        description=description,
        source_type="loan_disbursement",
        source_id=loan_id,
        created_by_id=created_by_id,
        lines=lines
    )

def post_loan_repayment(
    accounting_service: AccountingService,
    member_id: str,
    loan_id: str,
    principal_amount: Decimal,
    interest_amount: Decimal,
    penalty_amount: Decimal,
    payment_method: str,
    repayment_id: str,
    description: str,
    created_by_id: Optional[str] = None
) -> JournalEntry:
    """Post journal entry for loan repayment"""
    
    total_amount = principal_amount + interest_amount + penalty_amount
    
    if payment_method == "cash":
        debit_account = "1000"
    else:
        debit_account = "1010"
    
    lines = [
        {"account_code": debit_account, "debit": total_amount, "credit": Decimal("0"), "member_id": member_id, "loan_id": loan_id}
    ]
    
    if principal_amount > 0:
        lines.append({"account_code": "1100", "debit": Decimal("0"), "credit": principal_amount, "member_id": member_id, "loan_id": loan_id, "memo": "Principal repayment"})
    
    if interest_amount > 0:
        lines.append({"account_code": "4000", "debit": Decimal("0"), "credit": interest_amount, "member_id": member_id, "loan_id": loan_id, "memo": "Interest income"})
    
    if penalty_amount > 0:
        lines.append({"account_code": "4020", "debit": Decimal("0"), "credit": penalty_amount, "member_id": member_id, "loan_id": loan_id, "memo": "Penalty income"})
    
    return accounting_service.create_journal_entry(
        entry_date=date.today(),
        description=description,
        reference=repayment_id,
        source_type="loan_repayment",
        source_id=repayment_id,
        created_by_id=created_by_id,
        lines=lines
    )

def post_fixed_deposit_creation(
    accounting_service: AccountingService,
    member_id: str,
    deposit_id: str,
    amount: Decimal,
    funding_source: str,
    description: str,
    created_by_id: Optional[str] = None
) -> JournalEntry:
    """Post journal entry for fixed deposit creation.
    
    Args:
        funding_source: 'savings' for transfer from savings, 'cash' for cash deposit,
                       'bank_transfer'/'mpesa' for bank/mobile money
    """
    
    if funding_source == "savings":
        debit_account = "2000"
        memo = "Transfer from savings"
    elif funding_source == "cash":
        debit_account = "1000"
        memo = "Cash deposit for fixed deposit"
    else:
        debit_account = "1010"
        memo = f"Bank/mobile deposit for fixed deposit"
    
    return accounting_service.create_journal_entry(
        entry_date=date.today(),
        description=description,
        source_type="fixed_deposit_create",
        source_id=deposit_id,
        created_by_id=created_by_id,
        lines=[
            {"account_code": debit_account, "debit": amount, "credit": Decimal("0"), "member_id": member_id, "memo": memo},
            {"account_code": "2020", "debit": Decimal("0"), "credit": amount, "member_id": member_id, "memo": "Fixed deposit principal"}
        ]
    )

def post_fixed_deposit_maturity(
    accounting_service: AccountingService,
    member_id: str,
    deposit_id: str,
    principal_amount: Decimal,
    interest_amount: Decimal,
    description: str,
    created_by_id: Optional[str] = None
) -> JournalEntry:
    """Post journal entry for fixed deposit maturity/closure"""
    
    lines = [
        {"account_code": "2020", "debit": principal_amount, "credit": Decimal("0"), "member_id": member_id, "memo": "Fixed deposit principal"},
        {"account_code": "5000", "debit": interest_amount, "credit": Decimal("0"), "member_id": member_id, "memo": "Interest expense"},
        {"account_code": "2000", "debit": Decimal("0"), "credit": principal_amount + interest_amount, "member_id": member_id, "memo": "Transfer to savings"}
    ]
    
    return accounting_service.create_journal_entry(
        entry_date=date.today(),
        description=description,
        source_type="fixed_deposit_close",
        source_id=deposit_id,
        created_by_id=created_by_id,
        lines=lines
    )
