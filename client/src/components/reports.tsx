import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { useCurrency } from "@/hooks/use-currency";
import { 
  FileText, 
  Users, 
  Banknote, 
  TrendingUp, 
  Download, 
  AlertCircle, 
  Clock, 
  DollarSign,
  PiggyBank,
  CreditCard,
  Receipt,
  Calendar,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from "lucide-react";

interface ReportsProps {
  organizationId: string;
}

interface Member {
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

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface FinancialSummary {
  period: {
    start_date: string;
    end_date: string;
  };
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

interface LoanReport {
  period: {
    start_date: string | null;
    end_date: string | null;
  };
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
  loans: Array<{
    application_number: string;
    member_name: string;
    amount: number;
    status: string;
    applied_at: string;
    disbursed_at: string | null;
    outstanding: number;
  }>;
}

interface ProfitLoss {
  period: {
    start_date: string;
    end_date: string;
  };
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
    operational_costs?: number;
    total_expenses: number;
  };
  net_profit: number;
}

interface AgingReport {
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

interface MemberStatement {
  member: {
    id: string;
    member_number: string;
    name: string;
    phone: string;
    email: string;
  };
  period: {
    start_date: string;
    end_date: string;
  };
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

export default function Reports({ organizationId }: ReportsProps) {
  const { formatAmount } = useCurrency(organizationId);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [loanStatusFilter, setLoanStatusFilter] = useState<string>("all");

  // Fetch members for dropdown
  const { data: members, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/organizations", organizationId, "members"],
  });

  // Fetch branches
  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/organizations", organizationId, "branches"],
  });

  // Financial Summary
  const { data: financialSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<FinancialSummary>({
    queryKey: ["/api/organizations", organizationId, "reports", "financial-summary", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      const res = await fetch(`/api/organizations/${organizationId}/reports/financial-summary?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch financial summary");
      return res.json();
    },
  });

  // Loan Report
  const { data: loanReport, isLoading: loanReportLoading, refetch: refetchLoans } = useQuery<LoanReport>({
    queryKey: ["/api/organizations", organizationId, "reports", "loans", startDate, endDate, loanStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (loanStatusFilter !== "all") params.append("status", loanStatusFilter);
      const res = await fetch(`/api/organizations/${organizationId}/reports/loans?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch loan report");
      return res.json();
    },
  });

  // Profit & Loss
  const { data: profitLoss, isLoading: plLoading, refetch: refetchPL } = useQuery<ProfitLoss>({
    queryKey: ["/api/organizations", organizationId, "reports", "profit-loss", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      const res = await fetch(`/api/organizations/${organizationId}/reports/profit-loss?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch P&L");
      return res.json();
    },
  });

  // Aging Report
  const { data: agingReport, isLoading: agingLoading, refetch: refetchAging } = useQuery<AgingReport>({
    queryKey: ["/api/organizations", organizationId, "reports", "aging"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/reports/aging`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch aging report");
      return res.json();
    },
  });

  // Member Statement
  const { data: memberStatement, isLoading: statementLoading } = useQuery<MemberStatement>({
    queryKey: ["/api/organizations", organizationId, "reports", "member-statement", selectedMember, startDate, endDate],
    queryFn: async () => {
      if (!selectedMember) return null;
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      const res = await fetch(`/api/organizations/${organizationId}/reports/member-statement/${selectedMember}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch statement");
      return res.json();
    },
    enabled: !!selectedMember,
  });

  const formatCurrency = (amount: number) => {
    return formatAmount(amount || 0);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" });
  };

  const refreshAll = () => {
    refetchSummary();
    refetchLoans();
    refetchPL();
    refetchAging();
  };

  // Calculate member stats
  const activeMembers = members?.filter(m => m.status === "active").length || 0;
  const pendingMembers = members?.filter(m => m.status === "pending").length || 0;
  const totalMembers = members?.length || 0;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      approved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      disbursed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      defaulted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      restructured: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      completed: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      paid: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive financial reports for your institution"
        action={<RefreshButton organizationId={organizationId} />}
      />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Date Filter Bar */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-date" className="text-xs">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                  data-testid="input-end-date"
                />
              </div>
              <Button variant="outline" onClick={refreshAll} data-testid="button-refresh-reports">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" data-testid="button-export-reports">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="summary" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto min-w-full md:w-auto">
              <TabsTrigger value="summary" className="gap-1" data-testid="tab-summary">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Summary</span>
              </TabsTrigger>
              <TabsTrigger value="loans" className="gap-1" data-testid="tab-loans">
                <Banknote className="h-4 w-4" />
                <span className="hidden sm:inline">Loans</span>
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-1" data-testid="tab-members">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Members</span>
              </TabsTrigger>
              <TabsTrigger value="aging" className="gap-1" data-testid="tab-aging">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Aging</span>
              </TabsTrigger>
              <TabsTrigger value="pnl" className="gap-1" data-testid="tab-pnl">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">P&L</span>
              </TabsTrigger>
              <TabsTrigger value="statement" className="gap-1" data-testid="tab-statement">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Statement</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Summary Tab */}
          <TabsContent value="summary" className="mt-6 space-y-6">
            {summaryLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : (
              <>
                {/* Member Deposits Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <PiggyBank className="h-5 w-5" />
                    Member Deposits
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Savings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-primary" data-testid="text-total-savings">
                          {formatCurrency(financialSummary?.member_deposits?.total_savings || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Shares</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-total-shares">
                          {formatCurrency(financialSummary?.member_deposits?.total_shares || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Fixed Deposits</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-total-deposits">
                          {formatCurrency(financialSummary?.member_deposits?.total_deposits || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Member Funds</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-primary" data-testid="text-total-funds">
                          {formatCurrency(financialSummary?.member_deposits?.total_member_funds || 0)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Loan Portfolio Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Loan Portfolio
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Loans</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-active-loans">
                          {financialSummary?.loan_portfolio?.active_loans || 0}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-orange-600" data-testid="text-outstanding">
                          {formatCurrency(financialSummary?.loan_portfolio?.total_outstanding || 0)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Period Activity Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Period Activity ({formatDate(financialSummary?.period?.start_date || null)} - {formatDate(financialSummary?.period?.end_date || null)})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <ArrowUpRight className="h-3 w-3 text-green-500" />
                          Deposits Received
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(financialSummary?.period_activity?.deposits_received || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <ArrowDownRight className="h-3 w-3 text-red-500" />
                          Withdrawals Made
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold text-red-600">
                          {formatCurrency(financialSummary?.period_activity?.withdrawals_made || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Loans Disbursed</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold">
                          {formatCurrency(financialSummary?.period_activity?.loans_disbursed || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Collections</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(financialSummary?.period_activity?.loan_collections || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Interest Income</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold text-blue-600">
                          {formatCurrency(financialSummary?.period_activity?.interest_income || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Penalty Income</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold">
                          {formatCurrency(financialSummary?.period_activity?.penalty_income || 0)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold text-primary">
                          {formatCurrency(financialSummary?.period_activity?.total_income || 0)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Loans Tab */}
          <TabsContent value="loans" className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-4 mb-4">
              <Select value={loanStatusFilter} onValueChange={setLoanStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-loan-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="disbursed">Disbursed</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                  <SelectItem value="restructured">Restructured</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loanReportLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <>
                {/* Loan Summary Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{loanReport?.summary?.total_applications || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        Approval Rate: {(loanReport?.summary?.approval_rate || 0).toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Applied</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(loanReport?.summary?.total_applied_amount || 0)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Disbursed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{formatCurrency(loanReport?.summary?.total_disbursed_amount || 0)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">{formatCurrency(loanReport?.summary?.total_outstanding || 0)}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Status Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Status Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(loanReport?.by_status || {}).map(([status, count]) => (
                        <div key={status} className="flex items-center gap-2">
                          <Badge className={getStatusColor(status)}>{status}</Badge>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Loan List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Loan Applications</CardTitle>
                    <CardDescription>Most recent loan applications</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto -mx-6 px-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Application #</TableHead>
                            <TableHead>Member</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Applied</TableHead>
                            <TableHead>Disbursed</TableHead>
                            <TableHead className="text-right">Outstanding</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(loanReport?.loans || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                No loan applications found
                              </TableCell>
                            </TableRow>
                          ) : (
                            loanReport?.loans.map((loan) => (
                              <TableRow key={loan.application_number}>
                                <TableCell className="font-mono text-sm">{loan.application_number}</TableCell>
                                <TableCell>{loan.member_name}</TableCell>
                                <TableCell className="text-right">{formatCurrency(loan.amount)}</TableCell>
                                <TableCell>
                                  <Badge className={getStatusColor(loan.status)}>{loan.status}</Badge>
                                </TableCell>
                                <TableCell>{formatDate(loan.applied_at)}</TableCell>
                                <TableCell>{formatDate(loan.disbursed_at)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(loan.outstanding)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalMembers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{activeMembers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Activation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{pendingMembers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Branches</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{branches?.length || 0}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Members by Branch</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">Members</TableHead>
                        <TableHead className="text-right">Total Savings</TableHead>
                        <TableHead className="text-right">Total Shares</TableHead>
                        <TableHead className="text-right">Total Deposits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(branches || []).map((branch) => {
                        const branchMembers = members?.filter(m => m.branch_id === branch.id) || [];
                        const totalSavings = branchMembers.reduce((sum, m) => sum + (m.savings_balance || 0), 0);
                        const totalShares = branchMembers.reduce((sum, m) => sum + (m.shares_balance || 0), 0);
                        const totalDeposits = branchMembers.reduce((sum, m) => sum + (m.deposits_balance || 0), 0);
                        return (
                          <TableRow key={branch.id}>
                            <TableCell className="font-medium">{branch.name}</TableCell>
                            <TableCell className="text-right">{branchMembers.length}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalSavings)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalShares)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalDeposits)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aging Tab */}
          <TabsContent value="aging" className="mt-6 space-y-6">
            {agingLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Loan Aging Analysis</CardTitle>
                    <CardDescription>As of {formatDate(agingReport?.as_of_date || null)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto -mx-6 px-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Aging Bucket</TableHead>
                            <TableHead className="text-right">No. of Loans</TableHead>
                            <TableHead className="text-right">Outstanding Amount</TableHead>
                            <TableHead className="text-right">% of Portfolio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Current</Badge>
                            </TableCell>
                            <TableCell className="text-right">{agingReport?.summary?.current?.count || 0}</TableCell>
                            <TableCell className="text-right">{formatCurrency(agingReport?.summary?.current?.total_outstanding || 0)}</TableCell>
                            <TableCell className="text-right">
                              {agingReport?.total_portfolio?.total_outstanding 
                                ? ((agingReport?.summary?.current?.total_outstanding / agingReport.total_portfolio.total_outstanding) * 100).toFixed(1)
                                : 0}%
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">1-30 Days</Badge>
                            </TableCell>
                            <TableCell className="text-right">{agingReport?.summary?.["1_30_days"]?.count || 0}</TableCell>
                            <TableCell className="text-right">{formatCurrency(agingReport?.summary?.["1_30_days"]?.total_outstanding || 0)}</TableCell>
                            <TableCell className="text-right">
                              {agingReport?.total_portfolio?.total_outstanding 
                                ? ((agingReport?.summary?.["1_30_days"]?.total_outstanding / agingReport.total_portfolio.total_outstanding) * 100).toFixed(1)
                                : 0}%
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">31-60 Days</Badge>
                            </TableCell>
                            <TableCell className="text-right">{agingReport?.summary?.["31_60_days"]?.count || 0}</TableCell>
                            <TableCell className="text-right">{formatCurrency(agingReport?.summary?.["31_60_days"]?.total_outstanding || 0)}</TableCell>
                            <TableCell className="text-right">
                              {agingReport?.total_portfolio?.total_outstanding 
                                ? ((agingReport?.summary?.["31_60_days"]?.total_outstanding / agingReport.total_portfolio.total_outstanding) * 100).toFixed(1)
                                : 0}%
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">61-90 Days</Badge>
                            </TableCell>
                            <TableCell className="text-right">{agingReport?.summary?.["61_90_days"]?.count || 0}</TableCell>
                            <TableCell className="text-right">{formatCurrency(agingReport?.summary?.["61_90_days"]?.total_outstanding || 0)}</TableCell>
                            <TableCell className="text-right">
                              {agingReport?.total_portfolio?.total_outstanding 
                                ? ((agingReport?.summary?.["61_90_days"]?.total_outstanding / agingReport.total_portfolio.total_outstanding) * 100).toFixed(1)
                                : 0}%
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Over 90 Days</Badge>
                            </TableCell>
                            <TableCell className="text-right">{agingReport?.summary?.over_90_days?.count || 0}</TableCell>
                            <TableCell className="text-right">{formatCurrency(agingReport?.summary?.over_90_days?.total_outstanding || 0)}</TableCell>
                            <TableCell className="text-right">
                              {agingReport?.total_portfolio?.total_outstanding 
                                ? ((agingReport?.summary?.over_90_days?.total_outstanding / agingReport.total_portfolio.total_outstanding) * 100).toFixed(1)
                                : 0}%
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50 font-semibold">
                            <TableCell>Total Portfolio</TableCell>
                            <TableCell className="text-right">{agingReport?.total_portfolio?.count || 0}</TableCell>
                            <TableCell className="text-right">{formatCurrency(agingReport?.total_portfolio?.total_outstanding || 0)}</TableCell>
                            <TableCell className="text-right">100%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* PAR Metrics */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">PAR {">"} 30 Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-600">
                        {agingReport?.total_portfolio?.total_outstanding 
                          ? (((
                              (agingReport?.summary?.["31_60_days"]?.total_outstanding || 0) +
                              (agingReport?.summary?.["61_90_days"]?.total_outstanding || 0) +
                              (agingReport?.summary?.over_90_days?.total_outstanding || 0)
                            ) / agingReport.total_portfolio.total_outstanding) * 100).toFixed(2)
                          : 0}%
                      </div>
                      <p className="text-xs text-muted-foreground">Portfolio at Risk</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">PAR {">"} 90 Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {agingReport?.total_portfolio?.total_outstanding 
                          ? ((agingReport?.summary?.over_90_days?.total_outstanding / agingReport.total_portfolio.total_outstanding) * 100).toFixed(2)
                          : 0}%
                      </div>
                      <p className="text-xs text-muted-foreground">High Risk</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Current Ratio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {agingReport?.total_portfolio?.total_outstanding 
                          ? ((agingReport?.summary?.current?.total_outstanding / agingReport.total_portfolio.total_outstanding) * 100).toFixed(2)
                          : 0}%
                      </div>
                      <p className="text-xs text-muted-foreground">Performing Loans</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* P&L Tab */}
          <TabsContent value="pnl" className="mt-6 space-y-6">
            {plLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Profit & Loss Statement</CardTitle>
                  <CardDescription>
                    Period: {formatDate(profitLoss?.period?.start_date || null)} - {formatDate(profitLoss?.period?.end_date || null)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Income Section */}
                    <div>
                      <h4 className="font-semibold text-lg mb-3 text-green-600">Income</h4>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between py-2 border-b">
                          <span>Interest Income</span>
                          <span className="font-medium">{formatCurrency(profitLoss?.income?.interest_income || 0)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span>Penalty Income</span>
                          <span className="font-medium">{formatCurrency(profitLoss?.income?.penalty_income || 0)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span>Processing Fees</span>
                          <span className="font-medium">{formatCurrency(profitLoss?.income?.processing_fees || 0)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span>Insurance Fees</span>
                          <span className="font-medium">{formatCurrency(profitLoss?.income?.insurance_fees || 0)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span>Extra Charges</span>
                          <span className="font-medium">{formatCurrency(profitLoss?.income?.extra_charges || 0)}</span>
                        </div>
                        <div className="flex justify-between py-2 bg-green-50 dark:bg-green-900/20 px-2 rounded font-semibold">
                          <span>Total Income</span>
                          <span className="text-green-600">{formatCurrency(profitLoss?.income?.total_income || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expenses Section */}
                    <div>
                      <h4 className="font-semibold text-lg mb-3 text-red-600">Expenses</h4>
                      <div className="space-y-2 pl-4">
                        {profitLoss?.expenses?.categories && Object.entries(profitLoss.expenses.categories).map(([name, amount]) => (
                          <div key={name} className="flex justify-between py-2 border-b">
                            <span>{name}</span>
                            <span className="font-medium">{formatCurrency(amount)}</span>
                          </div>
                        ))}
                        {(!profitLoss?.expenses?.categories || Object.keys(profitLoss.expenses.categories).length === 0) && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">No approved expenses in this period</span>
                            <span className="font-medium">{formatCurrency(0)}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-2 bg-red-50 dark:bg-red-900/20 px-2 rounded font-semibold">
                          <span>Total Expenses</span>
                          <span className="text-red-600">{formatCurrency(profitLoss?.expenses?.total_expenses || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Net Profit */}
                    <div className="pt-4 border-t-2">
                      <div className="flex justify-between py-3 bg-primary/10 px-4 rounded-lg">
                        <span className="text-lg font-bold">Net Profit</span>
                        <span className={`text-xl font-bold ${(profitLoss?.net_profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(profitLoss?.net_profit || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Member Statement Tab */}
          <TabsContent value="statement" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Member Statement</CardTitle>
                <CardDescription>Select a member to view their statement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-sm">
                  <Label className="text-xs">Select Member</Label>
                  <Select value={selectedMember} onValueChange={setSelectedMember}>
                    <SelectTrigger data-testid="select-member">
                      <SelectValue placeholder="Choose a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {membersLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        (members || []).map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.member_number} - {member.first_name} {member.last_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {selectedMember && (
              statementLoading ? (
                <Skeleton className="h-64" />
              ) : memberStatement ? (
                <>
                  {/* Member Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {memberStatement.member.name}
                      </CardTitle>
                      <CardDescription>
                        {memberStatement.member.member_number} | {memberStatement.member.phone} | {memberStatement.member.email}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Savings Balance</p>
                          <p className="text-xl font-bold text-primary">{formatCurrency(memberStatement.balances.savings)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Shares Balance</p>
                          <p className="text-xl font-bold">{formatCurrency(memberStatement.balances.shares)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Deposits Balance</p>
                          <p className="text-xl font-bold">{formatCurrency(memberStatement.balances.deposits)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Loan Outstanding</p>
                          <p className="text-xl font-bold text-orange-600">{formatCurrency(memberStatement.balances.total_loan_outstanding)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Transactions */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Transaction History</CardTitle>
                      <CardDescription>
                        {formatDate(memberStatement.period.start_date)} - {formatDate(memberStatement.period.end_date)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto -mx-6 px-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead>Description</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(memberStatement.transactions || []).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                  No transactions found for this period
                                </TableCell>
                              </TableRow>
                            ) : (
                              memberStatement.transactions.map((txn, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{formatDate(txn.date)}</TableCell>
                                  <TableCell>
                                    <Badge variant={txn.type === "deposit" ? "default" : "secondary"}>
                                      {txn.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{txn.account}</TableCell>
                                  <TableCell className={`text-right ${txn.type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                                    {txn.type === "deposit" ? "+" : "-"}{formatCurrency(txn.amount)}
                                  </TableCell>
                                  <TableCell className="text-right">{formatCurrency(txn.balance_after)}</TableCell>
                                  <TableCell className="font-mono text-xs">{txn.reference}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{txn.description}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Loans Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Loans Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto -mx-6 px-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Loan #</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Outstanding</TableHead>
                              <TableHead>Disbursed</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(memberStatement.loans_summary || []).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                  No loans found
                                </TableCell>
                              </TableRow>
                            ) : (
                              memberStatement.loans_summary.map((loan, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-mono">{loan.loan_number}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(loan.amount)}</TableCell>
                                  <TableCell>
                                    <Badge className={getStatusColor(loan.status)}>{loan.status}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">{formatCurrency(loan.outstanding)}</TableCell>
                                  <TableCell>{formatDate(loan.disbursed_at)}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
