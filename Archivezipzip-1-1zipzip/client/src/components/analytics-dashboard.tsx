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
  FileText, DollarSign, Clock, Download, ArrowUp, ArrowDown, Minus
} from "lucide-react";
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
  loans_processed: number;
  loans_approved: number;
  total_disbursed: number;
  total_collected: number;
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
    queryKey: ["/api/organizations", organizationId, "analytics", "staff"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/analytics/staff`, { credentials: "include" });
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
              <CardTitle>Staff Performance</CardTitle>
              <CardDescription>Individual staff metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <Skeleton className="h-48" />
              ) : staffData && staffData.length > 0 ? (
                <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead className="text-right">Processed</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Disbursed</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffData.map((staff) => (
                      <TableRow key={staff.staff_id}>
                        <TableCell className="font-medium">{staff.staff_name}</TableCell>
                        <TableCell className="text-right">{staff.loans_processed}</TableCell>
                        <TableCell className="text-right">{staff.loans_approved}</TableCell>
                        <TableCell className="text-right">{formatCurrency(staff.total_disbursed)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(staff.total_collected)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No staff data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
