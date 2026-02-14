"""
Accounting Routes - API endpoints for Chart of Accounts, Journal Entries, and Reports
"""

from datetime import date
from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.database import get_db
from models.tenant import Member, LoanApplication, MemberFixedDeposit
from routes.auth import get_current_user
from services.tenant_context import get_tenant_context

from .models import ChartOfAccounts, JournalEntry, JournalLine, FiscalPeriod
from .schemas import (
    AccountCreate, AccountUpdate, AccountResponse,
    JournalEntryCreate, JournalEntryResponse, JournalLineResponse,
    FiscalPeriodCreate, FiscalPeriodResponse,
    TrialBalanceResponse, IncomeStatementResponse, BalanceSheetResponse,
    AccountBalanceResponse
)
from .service import AccountingService

router = APIRouter()

def get_tenant_session_context(org_id: str, user, db: Session):
    """Get tenant context and validate membership"""
    tenant_ctx, membership = get_tenant_context(org_id, user.id, db)
    if not tenant_ctx or not membership:
        raise HTTPException(status_code=403, detail="Not authorized for this organization")
    return tenant_ctx, membership

def require_permission(membership, permission: str, db: Session):
    """Check if user has required permission"""
    from routes.common import check_permission
    if not check_permission(membership, permission, db):
        raise HTTPException(status_code=403, detail=f"Permission denied: {permission}")

@router.get("/{org_id}/accounting/accounts", response_model=List[AccountResponse])
async def list_accounts(
    org_id: str,
    account_type: Optional[str] = None,
    include_inactive: bool = False,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all accounts in chart of accounts"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "analytics:read", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        query = tenant_session.query(ChartOfAccounts)
        
        if account_type:
            query = query.filter(ChartOfAccounts.account_type == account_type)
        
        if not include_inactive:
            query = query.filter(ChartOfAccounts.is_active == True)
        
        accounts = query.order_by(ChartOfAccounts.code).all()
        return [AccountResponse.model_validate(a) for a in accounts]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/accounting/accounts", response_model=AccountResponse)
async def create_account(
    org_id: str,
    data: AccountCreate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new account in chart of accounts"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        existing = tenant_session.query(ChartOfAccounts).filter(
            ChartOfAccounts.code == data.code
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Account code already exists")
        
        from .models import ACCOUNT_TYPES, AccountType as AT
        normal_balance = ACCOUNT_TYPES[AT(data.account_type.value)]["normal_balance"]
        
        account = ChartOfAccounts(
            code=data.code,
            name=data.name,
            account_type=data.account_type.value,
            parent_id=data.parent_id,
            description=data.description,
            normal_balance=normal_balance,
            is_header=data.is_header,
            is_system=False,
            is_active=True
        )
        tenant_session.add(account)
        tenant_session.commit()
        
        return AccountResponse.model_validate(account)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/accounting/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    org_id: str,
    account_id: str,
    data: AccountUpdate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an account"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        account = tenant_session.query(ChartOfAccounts).filter(
            ChartOfAccounts.id == account_id
        ).first()
        
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        if account.is_system and data.is_active == False:
            raise HTTPException(status_code=400, detail="Cannot deactivate system account")
        
        if data.name is not None:
            account.name = data.name
        if data.description is not None:
            account.description = data.description
        if data.parent_id is not None:
            account.parent_id = data.parent_id
        if data.is_active is not None:
            account.is_active = data.is_active
        
        tenant_session.commit()
        return AccountResponse.model_validate(account)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/accounting/accounts/{account_id}/ledger")
async def get_account_ledger(
    org_id: str,
    account_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get ledger entries for a specific account"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "analytics:read", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        svc = AccountingService(tenant_session)
        return svc.get_account_ledger(account_id, start_date, end_date)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/accounting/journal-entries", response_model=List[JournalEntryResponse])
async def list_journal_entries(
    org_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    source_type: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List journal entries"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "analytics:read", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        query = tenant_session.query(JournalEntry)
        
        if start_date:
            query = query.filter(JournalEntry.entry_date >= start_date)
        if end_date:
            query = query.filter(JournalEntry.entry_date <= end_date)
        if source_type:
            query = query.filter(JournalEntry.source_type == source_type)
        
        entries = query.order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc()).offset(offset).limit(limit).all()
        
        result = []
        for entry in entries:
            entry_dict = JournalEntryResponse.model_validate(entry)
            entry_dict.lines = []
            for line in entry.lines:
                line_resp = JournalLineResponse.model_validate(line)
                line_resp.account_code = line.account.code if line.account else None
                line_resp.account_name = line.account.name if line.account else None
                entry_dict.lines.append(line_resp)
            result.append(entry_dict)
        
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/accounting/journal-entries", response_model=JournalEntryResponse)
async def create_journal_entry(
    org_id: str,
    data: JournalEntryCreate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a manual journal entry"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "analytics:write", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        from models.tenant import Staff
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        svc = AccountingService(tenant_session)
        
        lines = [
            {
                "account_id": line.account_id,
                "debit": line.debit,
                "credit": line.credit,
                "memo": line.memo,
                "member_id": line.member_id,
                "loan_id": line.loan_id
            }
            for line in data.lines
        ]
        
        entry = svc.create_journal_entry(
            entry_date=data.entry_date,
            description=data.description,
            reference=data.reference,
            source_type="manual",
            created_by_id=staff.id if staff else None,
            lines=lines
        )
        
        return JournalEntryResponse.model_validate(entry)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/accounting/journal-entries/{entry_id}/reverse", response_model=JournalEntryResponse)
async def reverse_journal_entry(
    org_id: str,
    entry_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reverse a journal entry"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "analytics:write", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        from models.tenant import Staff
        staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        svc = AccountingService(tenant_session)
        reversal = svc.reverse_journal_entry(entry_id, created_by_id=staff.id if staff else None)
        
        return JournalEntryResponse.model_validate(reversal)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/accounting/reports/trial-balance")
async def get_trial_balance(
    org_id: str,
    as_of_date: date = Query(default=None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get trial balance report"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        report_date = as_of_date or date.today()
        return svc.get_trial_balance(report_date)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/accounting/reports/income-statement")
async def get_income_statement(
    org_id: str,
    start_date: date,
    end_date: date,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get income statement (profit & loss) report"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        return svc.get_income_statement(start_date, end_date)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/accounting/reports/balance-sheet")
async def get_balance_sheet(
    org_id: str,
    as_of_date: date = Query(default=None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get balance sheet report"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "reports:read", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        report_date = as_of_date or date.today()
        return svc.get_balance_sheet(report_date)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/accounting/seed-accounts")
async def seed_default_accounts(
    org_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Seed default chart of accounts"""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        svc = AccountingService(tenant_session)
        count = svc.seed_default_accounts()
        return {"message": f"Created {count} default accounts", "created": count}
    finally:
        tenant_session.close()
        tenant_ctx.close()


class OpeningBalanceLine(BaseModel):
    account_code: str
    amount: float
    memo: Optional[str] = None

class OpeningBalanceRequest(BaseModel):
    effective_date: Optional[date] = None
    notes: Optional[str] = None
    lines: List[OpeningBalanceLine]


@router.get("/{org_id}/accounting/opening-balances/preview")
async def preview_opening_balances(
    org_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Preview opening balance data per account.
    Returns each account with its current GL balance and system-suggested balance
    (from actual member/loan/FD data). Admin can use or override these values."""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        existing = tenant_session.query(JournalEntry).filter(
            JournalEntry.source_type == "opening_balance"
        ).first()
        
        result = _calculate_opening_balance_gaps(tenant_session, svc)
        result["already_posted"] = existing is not None
        if existing:
            result["existing_entry_number"] = existing.entry_number
        return result
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{org_id}/accounting/opening-balances/post")
async def post_opening_balances(
    org_id: str,
    data: OpeningBalanceRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Post opening balance journal entry using admin-provided amounts per account.
    The admin decides the amount for each account - they can use the system suggestion
    or enter their own values based on their actual books."""
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "settings:write", db)
    tenant_session = tenant_ctx.create_session()
    
    try:
        existing = tenant_session.query(JournalEntry).filter(
            JournalEntry.source_type == "opening_balance"
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Opening balances have already been posted. To re-post, first reverse the existing opening balance entry."
            )
        
        if not data.lines or len(data.lines) == 0:
            raise HTTPException(status_code=400, detail="No opening balance lines provided.")
        
        svc = AccountingService(tenant_session)
        svc.seed_default_accounts()
        
        account_map = {
            "1000": {"name": "Cash on Hand", "type": "asset"},
            "1010": {"name": "Cash at Bank", "type": "asset"},
            "1100": {"name": "Loans Receivable", "type": "asset"},
            "2000": {"name": "Member Savings", "type": "liability"},
            "2010": {"name": "Member Shares", "type": "liability"},
            "2020": {"name": "Member Fixed Deposits", "type": "liability"},
        }
        
        je_lines = []
        total_debit = Decimal("0")
        total_credit = Decimal("0")
        
        for line in data.lines:
            amt = Decimal(str(line.amount))
            if amt == 0:
                continue
            
            info = account_map.get(line.account_code)
            if not info:
                raise HTTPException(
                    status_code=400,
                    detail=f"Account code {line.account_code} is not supported for opening balances."
                )
            
            memo = line.memo or f"Opening balance - {info['name']}"
            
            if info["type"] == "asset":
                je_lines.append({
                    "account_code": line.account_code,
                    "debit": amt if amt > 0 else Decimal("0"),
                    "credit": abs(amt) if amt < 0 else Decimal("0"),
                    "memo": memo,
                })
                total_debit += amt if amt > 0 else Decimal("0")
                total_credit += abs(amt) if amt < 0 else Decimal("0")
            else:
                je_lines.append({
                    "account_code": line.account_code,
                    "debit": abs(amt) if amt < 0 else Decimal("0"),
                    "credit": amt if amt > 0 else Decimal("0"),
                    "memo": memo,
                })
                total_credit += amt if amt > 0 else Decimal("0")
                total_debit += abs(amt) if amt < 0 else Decimal("0")
        
        if not je_lines:
            return {"message": "No adjustments needed - all amounts are zero.", "journal_entry": None}
        
        if abs(total_debit - total_credit) > Decimal("0.01"):
            raise HTTPException(
                status_code=400,
                detail=f"Debits ({float(total_debit):,.2f}) must equal credits ({float(total_credit):,.2f}). The entry is out of balance by {float(abs(total_debit - total_credit)):,.2f}."
            )
        
        effective = data.effective_date or date.today()
        notes_text = data.notes or "Opening balances entered by administrator"
        
        je = svc.create_journal_entry(
            entry_date=effective,
            description=f"Opening Balances - {notes_text}",
            source_type="opening_balance",
            source_id="opening_balance",
            lines=je_lines
        )
        
        return {
            "message": f"Opening balances posted successfully. Journal entry: {je.entry_number}",
            "journal_entry": {
                "id": je.id,
                "entry_number": je.entry_number,
                "entry_date": str(effective),
                "total_debit": float(total_debit),
                "total_credit": float(total_credit),
                "line_count": len(je_lines)
            }
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


def _calculate_opening_balance_gaps(tenant_session, svc: AccountingService):
    """Calculate gaps between actual balances and GL balances."""
    
    total_savings = Decimal("0")
    total_shares = Decimal("0")
    members = tenant_session.query(Member).filter(Member.is_active == True).all()
    for m in members:
        total_savings += Decimal(str(m.savings_balance or 0))
        total_shares += Decimal(str(m.shares_balance or 0))
    
    active_loans = tenant_session.query(LoanApplication).filter(
        LoanApplication.status.in_(["active", "disbursed", "overdue", "defaulted"])
    ).all()
    total_loan_outstanding = Decimal("0")
    for loan in active_loans:
        total_loan_outstanding += Decimal(str(loan.outstanding_balance or 0))
    
    active_fds = tenant_session.query(MemberFixedDeposit).filter(
        MemberFixedDeposit.status == "active"
    ).all()
    total_fd = Decimal("0")
    for fd in active_fds:
        total_fd += Decimal(str(fd.principal_amount or 0))
    
    gl_balances = {}
    for code in ["1010", "1100", "2000", "2010", "2020"]:
        account = tenant_session.query(ChartOfAccounts).filter(
            ChartOfAccounts.code == code
        ).first()
        if account:
            debit_total = tenant_session.query(func.coalesce(func.sum(JournalLine.debit), 0)).join(
                JournalEntry, JournalLine.journal_entry_id == JournalEntry.id
            ).filter(
                JournalLine.account_id == account.id,
                JournalEntry.status == "posted"
            ).scalar()
            credit_total = tenant_session.query(func.coalesce(func.sum(JournalLine.credit), 0)).join(
                JournalEntry, JournalLine.journal_entry_id == JournalEntry.id
            ).filter(
                JournalLine.account_id == account.id,
                JournalEntry.status == "posted"
            ).scalar()
            gl_balances[code] = {
                "debit": Decimal(str(debit_total)),
                "credit": Decimal(str(credit_total)),
                "net": Decimal(str(debit_total)) - Decimal(str(credit_total))
            }
        else:
            gl_balances[code] = {"debit": Decimal("0"), "credit": Decimal("0"), "net": Decimal("0")}
    
    gl_savings = gl_balances["2000"]["credit"] - gl_balances["2000"]["debit"]
    gl_shares = gl_balances["2010"]["credit"] - gl_balances["2010"]["debit"]
    gl_loans = gl_balances["1100"]["debit"] - gl_balances["1100"]["credit"]
    gl_fds = gl_balances["2020"]["credit"] - gl_balances["2020"]["debit"]
    
    savings_gap = total_savings - gl_savings
    shares_gap = total_shares - gl_shares
    loans_gap = total_loan_outstanding - gl_loans
    fd_gap = total_fd - gl_fds
    
    lines = []
    balancing_amount = Decimal("0")
    
    if savings_gap > 0:
        lines.append({
            "account_code": "2000",
            "account_name": "Member Savings",
            "debit": 0,
            "credit": float(savings_gap),
            "memo": f"Opening balance - Member savings ({len(members)} members)"
        })
        balancing_amount += savings_gap
    elif savings_gap < 0:
        lines.append({
            "account_code": "2000",
            "account_name": "Member Savings",
            "debit": float(abs(savings_gap)),
            "credit": 0,
            "memo": f"Opening balance adjustment - Member savings"
        })
        balancing_amount -= abs(savings_gap)
    
    if shares_gap > 0:
        lines.append({
            "account_code": "2010",
            "account_name": "Member Shares",
            "debit": 0,
            "credit": float(shares_gap),
            "memo": f"Opening balance - Member shares"
        })
        balancing_amount += shares_gap
    elif shares_gap < 0:
        lines.append({
            "account_code": "2010",
            "account_name": "Member Shares",
            "debit": float(abs(shares_gap)),
            "credit": 0,
            "memo": f"Opening balance adjustment - Member shares"
        })
        balancing_amount -= abs(shares_gap)
    
    if loans_gap > 0:
        lines.append({
            "account_code": "1100",
            "account_name": "Loans Receivable",
            "debit": float(loans_gap),
            "credit": 0,
            "memo": f"Opening balance - Outstanding loans ({len(active_loans)} loans)"
        })
        balancing_amount -= loans_gap
    elif loans_gap < 0:
        lines.append({
            "account_code": "1100",
            "account_name": "Loans Receivable",
            "debit": 0,
            "credit": float(abs(loans_gap)),
            "memo": f"Opening balance adjustment - Loans receivable"
        })
        balancing_amount += abs(loans_gap)
    
    if fd_gap > 0:
        lines.append({
            "account_code": "2020",
            "account_name": "Member Fixed Deposits",
            "debit": 0,
            "credit": float(fd_gap),
            "memo": f"Opening balance - Fixed deposits ({len(active_fds)} deposits)"
        })
        balancing_amount += fd_gap
    elif fd_gap < 0:
        lines.append({
            "account_code": "2020",
            "account_name": "Member Fixed Deposits",
            "debit": float(abs(fd_gap)),
            "credit": 0,
            "memo": f"Opening balance adjustment - Fixed deposits"
        })
        balancing_amount -= abs(fd_gap)
    
    if balancing_amount > 0:
        lines.append({
            "account_code": "1010",
            "account_name": "Cash at Bank",
            "debit": float(balancing_amount),
            "credit": 0,
            "memo": "Opening balance - Cash at bank (balancing entry for member liabilities)"
        })
    elif balancing_amount < 0:
        lines.append({
            "account_code": "1010",
            "account_name": "Cash at Bank",
            "debit": 0,
            "credit": float(abs(balancing_amount)),
            "memo": "Opening balance adjustment - Cash at bank"
        })
    
    has_gaps = any(
        abs(g) > Decimal("0.01") for g in [savings_gap, shares_gap, loans_gap, fd_gap]
    )
    
    accounts = [
        {
            "account_code": "2000",
            "account_name": "Member Savings",
            "account_type": "liability",
            "current_gl_balance": float(gl_savings),
            "suggested_balance": float(total_savings),
            "gap": float(savings_gap),
            "detail": f"{len(members)} active members",
        },
        {
            "account_code": "2010",
            "account_name": "Member Shares",
            "account_type": "liability",
            "current_gl_balance": float(gl_shares),
            "suggested_balance": float(total_shares),
            "gap": float(shares_gap),
            "detail": f"{len(members)} active members",
        },
        {
            "account_code": "1100",
            "account_name": "Loans Receivable",
            "account_type": "asset",
            "current_gl_balance": float(gl_loans),
            "suggested_balance": float(total_loan_outstanding),
            "gap": float(loans_gap),
            "detail": f"{len(active_loans)} active loans",
        },
        {
            "account_code": "2020",
            "account_name": "Member Fixed Deposits",
            "account_type": "liability",
            "current_gl_balance": float(gl_fds),
            "suggested_balance": float(total_fd),
            "gap": float(fd_gap),
            "detail": f"{len(active_fds)} active deposits",
        },
        {
            "account_code": "1010",
            "account_name": "Cash at Bank",
            "account_type": "asset",
            "current_gl_balance": float(gl_balances["1010"]["net"]),
            "suggested_balance": None,
            "gap": None,
            "detail": "Enter from your actual bank statement",
        },
        {
            "account_code": "1000",
            "account_name": "Cash on Hand",
            "account_type": "asset",
            "current_gl_balance": float(gl_balances.get("1000", {}).get("net", 0)),
            "suggested_balance": None,
            "gap": None,
            "detail": "Enter from your physical cash count",
        },
    ]
    
    return {
        "has_gaps": has_gaps,
        "accounts": accounts,
        "summary": {
            "member_savings": {"actual": float(total_savings), "gl": float(gl_savings), "gap": float(savings_gap)},
            "member_shares": {"actual": float(total_shares), "gl": float(gl_shares), "gap": float(shares_gap)},
            "outstanding_loans": {"actual": float(total_loan_outstanding), "gl": float(gl_loans), "gap": float(loans_gap)},
            "fixed_deposits": {"actual": float(total_fd), "gl": float(gl_fds), "gap": float(fd_gap)},
        },
        "lines": lines,
        "total_debit": float(sum(Decimal(str(l["debit"])) for l in lines)),
        "total_credit": float(sum(Decimal(str(l["credit"])) for l in lines)),
    }
