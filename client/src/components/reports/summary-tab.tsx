import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PiggyBank,
  CreditCard,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { FinancialSummary } from "./types";
import { formatDate } from "./types";

interface SummaryTabProps {
  data: FinancialSummary | undefined;
  isLoading: boolean;
  formatCurrency: (amount: number) => string;
}

export function SummaryTab({ data, isLoading, formatCurrency }: SummaryTabProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <PiggyBank className="h-5 w-5" />
          Member Deposits
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Savings" value={formatCurrency(data?.member_deposits?.total_savings || 0)} className="text-primary" testId="text-total-savings" />
          <MetricCard label="Total Shares" value={formatCurrency(data?.member_deposits?.total_shares || 0)} testId="text-total-shares" />
          <MetricCard label="Fixed Deposits" value={formatCurrency(data?.member_deposits?.total_deposits || 0)} testId="text-total-deposits" />
          <MetricCard label="Total Member Funds" value={formatCurrency(data?.member_deposits?.total_member_funds || 0)} className="text-primary" highlight testId="text-total-funds" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Loan Portfolio
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Active Loans" value={String(data?.loan_portfolio?.active_loans || 0)} testId="text-active-loans" />
          <MetricCard label="Outstanding Balance" value={formatCurrency(data?.loan_portfolio?.total_outstanding || 0)} className="text-orange-600" testId="text-outstanding" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Period Activity ({formatDate(data?.period?.start_date || null)} - {formatDate(data?.period?.end_date || null)})
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Deposits Received"
            value={formatCurrency(data?.period_activity?.deposits_received || 0)}
            className="text-green-600"
            icon={<ArrowUpRight className="h-3 w-3 text-green-500" />}
          />
          <MetricCard
            label="Withdrawals Made"
            value={formatCurrency(data?.period_activity?.withdrawals_made || 0)}
            className="text-red-600"
            icon={<ArrowDownRight className="h-3 w-3 text-red-500" />}
          />
          <MetricCard label="Loans Disbursed" value={formatCurrency(data?.period_activity?.loans_disbursed || 0)} />
          <MetricCard label="Collections" value={formatCurrency(data?.period_activity?.loan_collections || 0)} className="text-green-600" />
          <MetricCard label="Interest Income" value={formatCurrency(data?.period_activity?.interest_income || 0)} className="text-blue-600" />
          <MetricCard label="Penalty Income" value={formatCurrency(data?.period_activity?.penalty_income || 0)} />
          <MetricCard label="Total Income" value={formatCurrency(data?.period_activity?.total_income || 0)} className="text-primary" highlight />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  className = "",
  highlight = false,
  icon,
  testId,
}: {
  label: string;
  value: string;
  className?: string;
  highlight?: boolean;
  icon?: React.ReactNode;
  testId?: string;
}) {
  return (
    <Card className={highlight ? "bg-primary/5" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${className}`} data-testid={testId}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
