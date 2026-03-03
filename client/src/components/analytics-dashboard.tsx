import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFeatures } from "@/hooks/use-features";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, Building2, Users, TrendingUp, TrendingDown, Activity, AlertCircle, 
  FileText, DollarSign, Clock, Download, ArrowUp, ArrowDown, Minus, Info
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { RefreshButton } from "@/components/refresh-button";
import { useCurrency } from "@/hooks/use-currency";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface AnalyticsDashboardProps {
  organizationId: string;
}

interface DashboardAnalytics {
  total_members: number;
  total_staff: number;
  total_branches: number;
  total_loans: number;
  pending_loans: number;
  approved_loans: number;
  disbursed_loans: number;
  total_savings: number;
  total_shares: number;
  total_disbursed: number;
  total_outstanding: number;
  total_repaid: number;
  default_count: number;
  collection_rate: number;
}

interface BranchPerformance {
  branch_id: string;
  branch_name: string;
  member_count: number;
  loan_count: number;
  total_disbursed: number;
  total_collected: number;
  default_rate: number;
}

interface StaffPerformance {
  staff_id: string;
  staff_name: string;
  staff_number: string;
  role: string;
  loans_processed: number;
  loans_approved: number;
  loans_rejected: number;
  disbursed_loan_count: number;
  default_count: number;
  default_rate: number;
  total_disbursed: number;
  total_collected: number;
  transactions_processed: number;
  transaction_volume: number;
  attendance_days: number;
  present_days: number;
  late_count: number;
  attendance_rate: number;
  disciplinary_count: number;
  performance_score: number;
  attendance_tracked: boolean;
  score_breakdown: {
    portfolio_quality: number;
    loan_throughput: number;
    txn_throughput: number;
    attendance: number | null;
    disciplinary: number;
  };
  score_weights: {
    portfolio: number;
    loan_vol: number;
    txn: number;
    attendance: number;
    disciplinary: number;
  };
  base_weights: {
    portfolio: number;
    loan_vol: number;
    txn: number;
    attendance: number;
    disciplinary: number;
  };
}

interface TrendsData {
  period: string;
  start_date: string;
  end_date: string;
  applications: Record<string, number>;
  disbursements: Record<string, { count: number; amount: number }>;
  collections: Record<string, { count: number; amount: number }>;
}

interface HealthData {
  health_score: number;
  health_status: string;
  metrics: {
    total_member_funds: number;
    total_loan_portfolio: number;
    portfolio_at_risk: number;
    par_ratio: number;
    loan_to_deposit_ratio: number;
    collection_efficiency: number;
  };
  member_stats: {
    total_active: number;
    average_savings: number;
  };
  loan_stats: {
    active_loans: number;
    average_loan_size: number;
    default_count: number;
  };
}

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AnalyticsDashboard({ organizationId }: AnalyticsDashboardProps) {
  const [trendPeriod, setTrendPeriod] = useState<string>("monthly");
  const [staffPeriod, setStaffPeriod] = useState<string>("this_month");
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [showFormula, setShowFormula] = useState(false);
  const { hasFeature } = useFeatures(organizationId);
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const canExport = hasFeature("analytics_export");

  const { data: dashboardData, isLoading: dashboardLoading, isError: dashboardError } = useQuery<DashboardAnalytics>({
    queryKey: ["/api/organizations", organizationId, "analytics", "dashboard"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/analytics/dashboard`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const { data: branchData, isLoading: branchLoading } = useQuery<BranchPerformance[]>({
    queryKey: ["/api/organizations", organizationId, "analytics", "branches"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/analytics/branches`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch branch analytics");
      return res.json();
    },
  });

  const { data: staffData, isLoading: staffLoading } = useQuery<StaffPerformance[]>({
    queryKey: ["/api/organizations", organizationId, "analytics", "staff", staffPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/analytics/staff?period=${staffPeriod}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staff analytics");
      return res.json();
    },
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery<TrendsData>({
    queryKey: ["/api/organizations", organizationId, "analytics", "trends", trendPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/analytics/trends?period=${trendPeriod}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trends");
      return res.json();
    },
  });

  const { data: healthData, isLoading: healthLoading } = useQuery<HealthData>({
    queryKey: ["/api/organizations", organizationId, "analytics", "institution-health"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/analytics/institution-health`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch health data");
      return res.json();
    },
  });

  const formatCurrency = (amount: number) => {
    return formatAmount(amount || 0);
  };

  const formatPercent = (value: number) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  const getTrendChartData = () => {
    if (!trendsData) return [];
    const allPeriods = new Set([
      ...Object.keys(trendsData.applications),
      ...Object.keys(trendsData.disbursements),
      ...Object.keys(trendsData.collections),
    ]);
    
    return Array.from(allPeriods).sort().map(period => ({
      period: period,
      applications: trendsData.applications[period] || 0,
      disbursements: trendsData.disbursements[period]?.amount || 0,
      collections: trendsData.collections[period]?.amount || 0,
    }));
  };

  const getLoanStatusData = () => {
    if (!dashboardData) return [];
    return [
      { name: "Pending", value: dashboardData.pending_loans, color: "#f59e0b" },
      { name: "Approved", value: dashboardData.approved_loans, color: "#3b82f6" },
      { name: "Disbursed", value: dashboardData.disbursed_loans, color: "#22c55e" },
    ].filter(d => d.value > 0);
  };

  const handleExportCSV = () => {
    if (!dashboardData || !branchData || !staffData) return;

    let csv = "ANALYTICS REPORT\n";
    csv += `Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}\n\n`;
    
    csv += "SUMMARY METRICS\n";
    csv += `Total Members,${dashboardData.total_members}\n`;
    csv += `Active Loans,${dashboardData.disbursed_loans}\n`;
    csv += `Pending Applications,${dashboardData.pending_loans}\n`;
    csv += `Total Disbursed,${dashboardData.total_disbursed}\n`;
    csv += `Total Collected,${dashboardData.total_repaid}\n`;
    csv += `Collection Rate,${dashboardData.collection_rate}%\n`;
    csv += `Default Count,${dashboardData.default_count}\n\n`;

    csv += "BRANCH PERFORMANCE\n";
    csv += "Branch,Members,Loans,Disbursed,Collected,Default Rate\n";
    branchData.forEach(b => {
      csv += `${b.branch_name},${b.member_count},${b.loan_count},${b.total_disbursed},${b.total_collected},${b.default_rate}%\n`;
    });
    csv += "\n";

    csv += "STAFF PERFORMANCE\n";
    csv += "Staff,Processed,Approved,Disbursed,Collected\n";
    staffData.forEach(s => {
      csv += `${s.staff_name},${s.loans_processed},${s.loans_approved},${s.total_disbursed},${s.total_collected}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TrendIndicator = ({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) => {
    if (previous === 0) return <span className="text-muted-foreground text-xs">-</span>;
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    const isNeutral = Math.abs(change) < 1;
    
    if (isNeutral) {
      return <span className="text-muted-foreground text-xs flex items-center gap-1"><Minus className="h-3 w-3" /> No change</span>;
    }
    
    return (
      <span className={`text-xs flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(change).toFixed(1)}%{suffix}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-analytics-title">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {canExport && (
            <Button variant="outline" onClick={handleExportCSV} disabled={!dashboardData}>
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          )}
        </div>
      </div>

      {healthData && !healthLoading && (
        <Card className={`border-l-4 ${
          healthData.health_status === "excellent" ? "border-l-green-500 bg-green-50/50" :
          healthData.health_status === "good" ? "border-l-blue-500 bg-blue-50/50" :
          healthData.health_status === "fair" ? "border-l-yellow-500 bg-yellow-50/50" :
          "border-l-red-500 bg-red-50/50"
        }`}>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${
                  healthData.health_status === "excellent" ? "text-green-600" :
                  healthData.health_status === "good" ? "text-blue-600" :
                  healthData.health_status === "fair" ? "text-yellow-600" :
                  "text-red-600"
                }`}>
                  {healthData.health_score}
                </div>
                <div>
                  <p className="font-semibold">Institution Health Score</p>
                  <Badge variant={
                    healthData.health_status === "excellent" ? "default" :
                    healthData.health_status === "good" ? "secondary" :
                    healthData.health_status === "fair" ? "outline" :
                    "destructive"
                  }>
                    {healthData.health_status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-muted-foreground">PAR Ratio</p>
                  <p className="font-semibold">{formatPercent(healthData.metrics.par_ratio)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Loan/Deposit Ratio</p>
                  <p className="font-semibold">{formatPercent(healthData.metrics.loan_to_deposit_ratio)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Collection Efficiency</p>
                  <p className="font-semibold">{formatPercent(healthData.metrics.collection_efficiency)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dashboardLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : dashboardError ? (
          <Card className="md:col-span-4">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-medium">Failed to load analytics</h3>
              <p className="text-sm text-muted-foreground">Please try again later</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-members">
                  {dashboardData?.total_members || 0}
                </div>
                <p className="text-xs text-muted-foreground">Active members</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-loans">
                  {dashboardData?.disbursed_loans || 0}
                </div>
                <p className="text-xs text-muted-foreground">Currently disbursed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Applications</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {dashboardData?.pending_loans || 0}
                </div>
                <p className="text-xs text-muted-foreground">Awaiting review</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Loan Size</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthData ? formatCurrency(healthData.loan_stats.average_loan_size) : "-"}
                </div>
                <p className="text-xs text-muted-foreground">Per loan</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Disbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData?.total_disbursed || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(dashboardData?.total_repaid || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-collection-rate">
              {formatPercent(dashboardData?.collection_rate || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Defaults</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-default-rate">
              {dashboardData?.default_count || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Trend Analysis</CardTitle>
              <CardDescription>Applications, disbursements, and collections over time</CardDescription>
            </div>
            <Select value={trendPeriod} onValueChange={setTrendPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={getTrendChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === "applications" ? value : formatCurrency(value),
                      name.charAt(0).toUpperCase() + name.slice(1)
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="disbursements" fill="#3b82f6" name="Disbursements" />
                  <Bar dataKey="collections" fill="#22c55e" name="Collections" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Status</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={getLoanStatusData()}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {getLoanStatusData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex justify-center gap-4 mt-4">
              {getLoanStatusData().map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="branches" className="w-full">
        <TabsList>
          <TabsTrigger value="branches" className="gap-2">
            <Building2 className="h-4 w-4" />
            Branch Performance
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <Users className="h-4 w-4" />
            Staff Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Branch Performance</CardTitle>
              <CardDescription>Metrics by branch location</CardDescription>
            </CardHeader>
            <CardContent>
              {branchLoading ? (
                <Skeleton className="h-48" />
              ) : branchData && branchData.length > 0 ? (
                <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-right">Members</TableHead>
                      <TableHead className="text-right">Loans</TableHead>
                      <TableHead className="text-right">Disbursed</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Default Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchData.map((branch) => (
                      <TableRow key={branch.branch_id}>
                        <TableCell className="font-medium">{branch.branch_name}</TableCell>
                        <TableCell className="text-right">{branch.member_count}</TableCell>
                        <TableCell className="text-right">{branch.loan_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(branch.total_disbursed)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(branch.total_collected)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={branch.default_rate > 10 ? "destructive" : "secondary"}>
                            {formatPercent(branch.default_rate)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No branch data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div>
                    <CardTitle>Staff Performance</CardTitle>
                    <CardDescription>Data-driven scores ranked highest to lowest</CardDescription>
                  </div>
                  <button
                    onClick={() => setShowFormula(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    title="View scoring formula"
                    data-testid="button-show-formula"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
                <Select value={staffPeriod} onValueChange={(v) => { setStaffPeriod(v); setExpandedStaff(null); }}>
                  <SelectTrigger className="w-40" data-testid="select-staff-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="this_quarter">This Quarter</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                    <SelectItem value="all_time">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Dialog open={showFormula} onOpenChange={setShowFormula}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Scoring Formula</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5 text-sm">
                    <p className="text-muted-foreground">
                      Each staff member receives a score from 0–100 computed as a weighted sum of five
                      sub-metrics. Weights vary by role to reflect what each role is actually responsible for.
                    </p>

                    <div>
                      <p className="font-semibold mb-2">Final Score</p>
                      <div className="bg-muted rounded-md px-4 py-3 font-mono text-xs leading-relaxed">
                        Score = (Portfolio Quality × w₁) + (Loan Volume × w₂)<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ (Txn Throughput × w₃) + (Attendance × w₄)<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ (Disciplinary × w₅)
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        If attendance is not recorded for the period, its weight (w₄) is redistributed
                        proportionally across the remaining four components.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <p className="font-semibold">Sub-metric Formulas</p>

                      <div className="border rounded-md p-3 space-y-1">
                        <p className="font-medium">1. Portfolio Quality (0–100)</p>
                        <p className="font-mono text-xs bg-muted rounded px-2 py-1">
                          100 − (defaults ÷ disbursed_loans × 100) × 5
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Each 1% default rate costs 5 points. A 20%+ default rate scores 0.
                          Staff with no disbursed loans score 100 (clean portfolio).
                        </p>
                      </div>

                      <div className="border rounded-md p-3 space-y-1">
                        <p className="font-medium">2. Loan Volume (0–100)</p>
                        <p className="font-mono text-xs bg-muted rounded px-2 py-1">
                          ln(1 + loans_processed) ÷ ln(1 + 50) × 100
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Logarithmic scale — 50 loans = 100 pts. Diminishing returns reward
                          consistent volume without penalising new staff too heavily.
                        </p>
                      </div>

                      <div className="border rounded-md p-3 space-y-1">
                        <p className="font-medium">3. Transaction Throughput (0–100)</p>
                        <p className="font-mono text-xs bg-muted rounded px-2 py-1">
                          ln(1 + transactions) ÷ ln(1 + 200) × 100
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Logarithmic scale — 200 teller transactions = 100 pts.
                        </p>
                      </div>

                      <div className="border rounded-md p-3 space-y-1">
                        <p className="font-medium">4. Attendance (0–100)</p>
                        <p className="font-mono text-xs bg-muted rounded px-2 py-1">
                          (present + late + half_day days) ÷ total_recorded_days × 100
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Direct percentage of days marked present, late, or half_day out of all
                          attendance records. If no attendance records exist this component is
                          excluded and its weight is redistributed.
                        </p>
                      </div>

                      <div className="border rounded-md p-3 space-y-1">
                        <p className="font-medium">5. Disciplinary (0–100)</p>
                        <p className="font-mono text-xs bg-muted rounded px-2 py-1">
                          100 − (open_incidents × 25)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Counts only unresolved disciplinary records in the selected period.
                          4 or more open incidents results in a score of 0.
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold mb-2">Role Weights (%)</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-muted">
                              <th className="text-left px-3 py-2 border">Role</th>
                              <th className="text-right px-3 py-2 border">Portfolio</th>
                              <th className="text-right px-3 py-2 border">Loan Vol.</th>
                              <th className="text-right px-3 py-2 border">Transactions</th>
                              <th className="text-right px-3 py-2 border">Attendance</th>
                              <th className="text-right px-3 py-2 border">Disciplinary</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { role: "Loan Officer", p: 35, l: 30, t: 5, a: 20, d: 10 },
                              { role: "Teller",       p: 5,  l: 10, t: 45, a: 25, d: 15 },
                              { role: "Reviewer",     p: 30, l: 25, t: 5,  a: 25, d: 15 },
                              { role: "HR / Admin",   p: 0,  l: 0,  t: 10, a: 55, d: 35 },
                              { role: "All Others",   p: 15, l: 15, t: 15, a: 40, d: 15 },
                            ].map(r => (
                              <tr key={r.role} className="border-b">
                                <td className="px-3 py-2 border font-medium">{r.role}</td>
                                <td className="px-3 py-2 border text-right">{r.p}%</td>
                                <td className="px-3 py-2 border text-right">{r.l}%</td>
                                <td className="px-3 py-2 border text-right">{r.t}%</td>
                                <td className="px-3 py-2 border text-right">{r.a}%</td>
                                <td className="px-3 py-2 border text-right">{r.d}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold mb-2">Score Bands</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { range: "80–100", label: "Excellent", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
                          { range: "60–79",  label: "Good",      color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
                          { range: "40–59",  label: "Average",   color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
                          { range: "0–39",   label: "Needs Improvement", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
                        ].map(b => (
                          <div key={b.range} className={`rounded px-3 py-2 ${b.color}`}>
                            <span className="font-semibold">{b.range}</span> — {b.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : staffData && staffData.length > 0 ? (
                <div className="space-y-2">
                  {staffData.map((s, idx) => {
                    const score = s.performance_score;
                    const isExpanded = expandedStaff === s.staff_id;
                    const scoreColor = score >= 80 ? "text-green-600 dark:text-green-400"
                      : score >= 60 ? "text-blue-600 dark:text-blue-400"
                      : score >= 40 ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400";
                    const barColor = score >= 80 ? "bg-green-500"
                      : score >= 60 ? "bg-blue-500"
                      : score >= 40 ? "bg-amber-500"
                      : "bg-red-500";
                    const roleFmt = (r: string) => r?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "—";
                    return (
                      <div key={s.staff_id} className="border rounded-lg overflow-hidden">
                        <button
                          className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
                          onClick={() => setExpandedStaff(isExpanded ? null : s.staff_id)}
                          data-testid={`staff-performance-row-${s.staff_id}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold truncate">{s.staff_name}</span>
                                <Badge variant="outline" className="text-xs shrink-0">{roleFmt(s.role)}</Badge>
                                {s.staff_number && <span className="text-xs text-muted-foreground shrink-0">{s.staff_number}</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
                                </div>
                                <span className={`text-sm font-bold w-14 text-right shrink-0 ${scoreColor}`}>{score}/100</span>
                              </div>
                            </div>
                            <div className="hidden sm:flex gap-4 text-xs text-muted-foreground shrink-0 ml-2">
                              {s.loans_processed > 0 && <span>{s.loans_processed} loans</span>}
                              {s.transactions_processed > 0 && <span>{s.transactions_processed} txns</span>}
                              {s.attendance_days > 0 && <span>{s.attendance_rate}% att.</span>}
                              {s.disciplinary_count > 0 && <span className="text-red-500">{s.disciplinary_count} disciplinary</span>}
                            </div>
                            <span className="text-muted-foreground text-sm ml-2">{isExpanded ? "▲" : "▼"}</span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t bg-muted/20 px-4 py-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Loans Processed</p>
                                <p className="font-semibold">{s.loans_processed}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Loans Approved</p>
                                <p className="font-semibold">{s.loans_approved}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Loans Rejected</p>
                                <p className="font-semibold">{s.loans_rejected}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Defaults</p>
                                <p className={`font-semibold ${s.default_count > 0 ? "text-red-600" : ""}`}>
                                  {s.default_count} ({s.default_rate}%)
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Disbursed</p>
                                <p className="font-semibold">{formatCurrency(s.total_disbursed)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Collected</p>
                                <p className="font-semibold">{formatCurrency(s.total_collected)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Transactions</p>
                                <p className="font-semibold">{s.transactions_processed} ({formatCurrency(s.transaction_volume)})</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Attendance</p>
                                <p className="font-semibold">
                                  {s.attendance_days > 0
                                    ? `${s.present_days}/${s.attendance_days} days (${s.attendance_rate}%)`
                                    : "No records"}
                                  {s.late_count > 0 && <span className="text-amber-500 ml-1">· {s.late_count} late</span>}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Disciplinary</p>
                                <p className={`font-semibold ${s.disciplinary_count > 0 ? "text-red-600" : "text-green-600"}`}>
                                  {s.disciplinary_count > 0 ? `${s.disciplinary_count} open` : "None"}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t">
                              <div className="flex items-center gap-1.5 mb-3">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Score Breakdown</p>
                                {!s.attendance_tracked && (
                                  <span className="text-xs text-amber-600 dark:text-amber-400 italic">· attendance not tracked — weight redistributed</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {[
                                  { label: "Portfolio Quality", val: s.score_breakdown.portfolio_quality, wKey: "portfolio" },
                                  { label: "Loan Volume",       val: s.score_breakdown.loan_throughput,   wKey: "loan_vol" },
                                  { label: "Transactions",      val: s.score_breakdown.txn_throughput,    wKey: "txn" },
                                  { label: "Attendance",        val: s.score_breakdown.attendance,        wKey: "attendance" },
                                  { label: "Disciplinary",      val: s.score_breakdown.disciplinary,      wKey: "disciplinary" },
                                ].map(({ label, val, wKey }) => {
                                  const weight = s.score_weights?.[wKey as keyof typeof s.score_weights] ?? 0;
                                  const baseWeight = s.base_weights?.[wKey as keyof typeof s.base_weights] ?? 0;
                                  const notTracked = val === null;
                                  const displayVal = notTracked ? 0 : (val ?? 0);
                                  return (
                                    <div key={label} className={`text-center ${notTracked ? "opacity-40" : ""}`}>
                                      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {notTracked ? (
                                          <span className="italic">not tracked</span>
                                        ) : (
                                          <>
                                            <span className="font-medium text-foreground">{weight}%</span>
                                            {weight !== baseWeight && (
                                              <span className="text-amber-500 ml-0.5">(was {baseWeight}%)</span>
                                            )}
                                          </>
                                        )}
                                      </p>
                                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                                        <div className="h-full bg-primary rounded-full" style={{ width: `${displayVal}%` }} />
                                      </div>
                                      <p className="text-xs font-semibold">{notTracked ? "—" : displayVal}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No staff data available for this period</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
