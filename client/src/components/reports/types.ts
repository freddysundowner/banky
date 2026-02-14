export interface ReportsProps {
  organizationId: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
}

export interface Member {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  savings_balance: number;
  shares_balance: number;
  deposits_balance: number;
  status: string;
  branch_id?: string;
}

export interface MemberSearchResult {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
}

export interface FinancialSummary {
  period: { start_date: string; end_date: string };
  member_deposits: {
    total_savings: number;
    total_shares: number;
    total_deposits: number;
    total_member_funds: number;
  };
  loan_portfolio: {
    total_outstanding: number;
    active_loans: number;
  };
  period_activity: {
    deposits_received: number;
    withdrawals_made: number;
    net_deposits: number;
    loans_disbursed: number;
    loan_collections: number;
    interest_income: number;
    penalty_income: number;
    total_income: number;
  };
}

export interface LoanReport {
  period: { start_date: string | null; end_date: string | null };
  summary: {
    total_applications: number;
    total_applied_amount: number;
    total_approved_amount: number;
    total_disbursed_amount: number;
    total_outstanding: number;
    total_repaid: number;
    approval_rate: number;
  };
  by_status: Record<string, number>;
  loans: {
    items: Array<{
      application_number: string;
      member_name: string;
      amount: number;
      status: string;
      applied_at: string;
      disbursed_at: string | null;
      outstanding: number;
    }>;
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
    };
  };
}

export interface ProfitLoss {
  period: { start_date: string; end_date: string };
  income: {
    interest_income: number;
    penalty_income: number;
    processing_fees: number;
    insurance_fees: number;
    extra_charges: number;
    total_income: number;
  };
  expenses: {
    categories?: Record<string, number>;
    total_expenses: number;
  };
  net_profit: number;
}

export interface AgingReport {
  as_of_date: string;
  summary: {
    current: { count: number; total_outstanding: number };
    "1_30_days": { count: number; total_outstanding: number };
    "31_60_days": { count: number; total_outstanding: number };
    "61_90_days": { count: number; total_outstanding: number };
    over_90_days: { count: number; total_outstanding: number };
  };
  total_portfolio: {
    count: number;
    total_outstanding: number;
  };
}

export interface MemberStatement {
  member: {
    id: string;
    member_number: string;
    name: string;
    phone: string;
    email: string;
  };
  period: { start_date: string; end_date: string };
  balances: {
    savings: number;
    shares: number;
    deposits: number;
    total_loan_outstanding: number;
  };
  transactions: Array<{
    date: string;
    type: string;
    account: string;
    amount: number;
    balance_after: number;
    reference: string;
    description: string;
  }>;
  loans_summary: Array<{
    loan_number: string;
    amount: number;
    status: string;
    outstanding: number;
    disbursed_at: string | null;
  }>;
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  branchId: string;
}

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  disbursed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  defaulted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  restructured: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  completed: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  paid: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
