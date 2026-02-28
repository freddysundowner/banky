import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshButton } from "@/components/refresh-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  AlertTriangle,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  XCircle,
  ShieldAlert,
  Shield,
  X,
  ChevronRight,
  Users,
  UserPlus,
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface DashboardProps {
  organizationId: string;
  organizationName: string;
  onNavigate?: (section: string, meta?: { tab?: string; id?: string }) => void;
}

interface CollateralAlertItem {
  id: string;
  description: string;
  member_name: string | null;
  loan_number: string | null;
  next_revaluation_date: string | null;
  collateral_type_name: string | null;
}

interface InsuranceAlertItem {
  id: string;
  policy_number: string;
  insurer_name: string;
  expiry_date: string;
  collateral_description: string | null;
  loan_number: string | null;
  member_name: string | null;
}

interface CollateralAlerts {
  overdue_revaluation: CollateralAlertItem[];
  due_soon_revaluation: CollateralAlertItem[];
  expiring_insurance: InsuranceAlertItem[];
  expired_insurance: InsuranceAlertItem[];
  summary: {
    overdue_revaluation_count: number;
    due_soon_revaluation_count: number;
    expiring_insurance_count: number;
    expired_insurance_count: number;
  };
}

interface DashboardAnalytics {
  collateral_deficient_count: number;
  total_disbursed: number;
  total_outstanding: number;
  total_repaid: number;
  default_count: number;
  collection_rate: number;
  pending_loans: number;
  approved_loans: number;
  disbursed_loans: number;
}

interface TrendsData {
  period: string;
  applications: Record<string, number>;
  disbursements: Record<string, { count: number; amount: number }>;
  collections: Record<string, { count: number; amount: number }>;
}

interface RecentMember {
  id: string;
  first_name: string;
  last_name: string;
  member_number: string;
  status: string;
  created_at: string;
  phone: string | null;
}

interface RecentTransaction {
  id: string;
  transaction_number: string;
  member_id: string;
  transaction_type: string;
  account_type: string;
  amount: number;
  payment_method: string | null;
  description: string | null;
  created_at: string;
}

interface HealthData {
  health_score: number;
  health_status: string;
  metrics: {
    par_ratio: number;
    loan_to_deposit_ratio: number;
    collection_efficiency: number;
  };
}

const CHART_COLORS = ["#f59e0b", "#3b82f6", "#22c55e", "#ef4444", "#8b5cf6"];

export default function Dashboard({ organizationId, organizationName, onNavigate }: DashboardProps) {
  const { formatAmount } = useCurrency(organizationId);
  const [deficientDismissed, setDeficientDismissed] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState("monthly");
  const { data, isLoading, error } = useQuery<DashboardAnalytics>({
    queryKey: ["/api/organizations", organizationId, "analytics", "dashboard"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/analytics/dashboard`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
  });

  const { data: healthData } = useQuery<HealthData>({
    queryKey: ["/api/organizations", organizationId, "analytics", "institution-health"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/analytics/institution-health`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: collateralAlerts } = useQuery<CollateralAlerts>({
    queryKey: ["/api/organizations", organizationId, "collateral", "alerts"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/collateral/alerts`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: recentMembersData, isLoading: membersLoading } = useQuery<{ items: RecentMember[] }>({
    queryKey: ["/api/organizations", organizationId, "members", "recent"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/members?page=1&per_page=5`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: recentTxData, isLoading: txLoading } = useQuery<{ items: RecentTransaction[] }>({
    queryKey: ["/api/organizations", organizationId, "transactions", "recent"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/transactions?page=1&page_size=8`, {
        credentials: "include",
      });
      if (!res.ok) return null;
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

  const getTrendChartData = () => {
    if (!trendsData) return [];
    const allPeriods = new Set([
      ...Object.keys(trendsData.applications),
      ...Object.keys(trendsData.disbursements),
      ...Object.keys(trendsData.collections),
    ]);
    return Array.from(allPeriods).sort().map(period => ({
      period,
      disbursements: trendsData.disbursements[period]?.amount || 0,
      collections: trendsData.collections[period]?.amount || 0,
    }));
  };

  const getLoanStatusData = () => {
    if (!data) return [];
    return [
      { name: "Pending", value: data.pending_loans ?? 0, color: "#f59e0b" },
      { name: "Approved", value: data.approved_loans ?? 0, color: "#3b82f6" },
      { name: "Disbursed", value: data.disbursed_loans ?? 0, color: "#22c55e" },
    ].filter(d => d.value > 0);
  };

  if (error) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of {organizationName}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
            <XCircle className="h-10 w-10 md:h-12 md:w-12 text-destructive mb-3 md:mb-4" />
            <h3 className="font-medium text-sm md:text-base">Unable to load dashboard</h3>
            <p className="text-xs md:text-sm text-muted-foreground">Please try again later</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {data && data.collateral_deficient_count > 0 && !deficientDismissed && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-amber-800 dark:text-amber-300" data-testid="banner-collateral-deficient">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm flex-1">
            <span className="font-semibold">{data.collateral_deficient_count} {data.collateral_deficient_count === 1 ? "loan" : "loans"}</span> with collateral coverage below the required minimum — review required.
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex-shrink-0"
            onClick={() => setDeficientDismissed(true)}
            data-testid="button-dismiss-deficient-banner"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of {organizationName}</p>
        </div>
        <RefreshButton organizationId={organizationId} />
      </div>

      {healthData && (
        <Card className={`border-l-4 ${
          healthData.health_status === "excellent" ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20" :
          healthData.health_status === "good" ? "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20" :
          healthData.health_status === "fair" ? "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20" :
          "border-l-red-500 bg-red-50/50 dark:bg-red-950/20"
        }`} data-testid="card-institution-health">
          <CardContent className="py-3 px-4">
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
                  <p className="font-semibold text-sm">Institution Health Score</p>
                  <Badge variant={
                    healthData.health_status === "excellent" ? "default" :
                    healthData.health_status === "good" ? "secondary" :
                    healthData.health_status === "fair" ? "outline" :
                    "destructive"
                  } className="text-xs mt-0.5">
                    {healthData.health_status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">PAR Ratio</p>
                  <p className="font-semibold">{(healthData.metrics.par_ratio ?? 0).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Loan/Deposit Ratio</p>
                  <p className="font-semibold">{(healthData.metrics.loan_to_deposit_ratio ?? 0).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Collection Efficiency</p>
                  <p className="font-semibold">{(healthData.metrics.collection_efficiency ?? 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-base md:text-lg font-semibold mb-2 md:mb-3">Loan Portfolio</h2>
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Disbursed"
              value={data ? formatAmount(data.total_disbursed) : undefined}
              icon={ArrowUpRight}
              color="text-orange-600"
              bgColor="bg-orange-50 dark:bg-orange-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Outstanding"
              value={data ? formatAmount(data.total_outstanding) : undefined}
              icon={CircleDollarSign}
              color="text-red-600"
              bgColor="bg-red-50 dark:bg-red-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Collected"
              value={data ? formatAmount(data.total_repaid) : undefined}
              icon={ArrowDownRight}
              color="text-green-600"
              bgColor="bg-green-50 dark:bg-green-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Collection Rate"
              value={data ? `${data.collection_rate.toFixed(1)}%` : undefined}
              icon={TrendingUp}
              color="text-blue-600"
              bgColor="bg-blue-50 dark:bg-blue-950"
              isLoading={isLoading}
            />
          </div>
        </div>

        {data && data.default_count > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-2 md:pb-3 px-4 md:px-6 pt-4 md:pt-6">
              <CardTitle className="flex items-center gap-2 text-destructive text-sm md:text-base">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5" />
                Defaults & Collections
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div>
                  <p className="text-2xl md:text-3xl font-bold text-destructive">{data.default_count}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {data.default_count === 1 ? "loan" : "loans"} currently overdue or in collection
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {collateralAlerts && (collateralAlerts.summary.expired_insurance_count > 0 || collateralAlerts.summary.expiring_insurance_count > 0) && (
          <div>
            <h2 className="text-base md:text-lg font-semibold mb-2 md:mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              Insurance Expiry Alerts
              <Badge variant="destructive" className="text-xs">
                {collateralAlerts.summary.expired_insurance_count + collateralAlerts.summary.expiring_insurance_count}
              </Badge>
            </h2>
            <div className="space-y-3">
              {collateralAlerts.expired_insurance.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onNavigate?.("collateral", { tab: "insurance", id: p.id })}
                  className="w-full text-left"
                  data-testid={`alert-expired-insurance-${p.id}`}
                >
                  <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center gap-3 px-4 py-3">
                      <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200 truncate">
                          {p.collateral_description ?? "Policy"} — {p.insurer_name}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {p.member_name && <span>{p.member_name} · </span>}
                          {p.loan_number && <span>Loan {p.loan_number} · </span>}
                          <span className="font-medium">Policy #{p.policy_number} expired {p.expiry_date}</span>
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-red-400 flex-shrink-0" />
                    </CardContent>
                  </Card>
                </button>
              ))}
              {collateralAlerts.expiring_insurance.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onNavigate?.("collateral", { tab: "insurance", id: p.id })}
                  className="w-full text-left"
                  data-testid={`alert-expiring-insurance-${p.id}`}
                >
                  <Card className="border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center gap-3 px-4 py-3">
                      <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200 truncate">
                          {p.collateral_description ?? "Policy"} — {p.insurer_name}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {p.member_name && <span>{p.member_name} · </span>}
                          {p.loan_number && <span>Loan {p.loan_number} · </span>}
                          <span className="font-medium">Policy #{p.policy_number} expires {p.expiry_date}</span>
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )}

        {collateralAlerts && (collateralAlerts.summary.overdue_revaluation_count > 0 || collateralAlerts.summary.due_soon_revaluation_count > 0) && (
          <div>
            <h2 className="text-base md:text-lg font-semibold mb-2 md:mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Collateral Revaluation Alerts
            </h2>
            <div className="space-y-3">
              {collateralAlerts.overdue_revaluation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate?.("collateral")}
                  className="w-full text-left"
                  data-testid={`alert-overdue-${item.id}`}
                >
                  <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center gap-3 px-4 py-3">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200 truncate">{item.description}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {item.member_name && <span>{item.member_name} · </span>}
                          {item.loan_number && <span>Loan {item.loan_number} · </span>}
                          <span className="font-medium">Overdue since {item.next_revaluation_date}</span>
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-red-400 flex-shrink-0" />
                    </CardContent>
                  </Card>
                </button>
              ))}
              {collateralAlerts.due_soon_revaluation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate?.("collateral")}
                  className="w-full text-left"
                  data-testid={`alert-due-soon-${item.id}`}
                >
                  <Card className="border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center gap-3 px-4 py-3">
                      <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-orange-800 dark:text-orange-200 truncate">{item.description}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          {item.member_name && <span>{item.member_name} · </span>}
                          {item.loan_number && <span>Loan {item.loan_number} · </span>}
                          <span className="font-medium">Due {item.next_revaluation_date}</span>
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-orange-400 flex-shrink-0" />
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                Recent Members
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7"
                onClick={() => onNavigate?.("members")}
                data-testid="link-view-all-members"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {membersLoading ? (
                  <div className="divide-y">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                        <div className="h-7 w-7 rounded-full bg-muted flex-shrink-0" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-2.5 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentMembersData?.items?.length ? (
                  <div className="divide-y">
                    {recentMembersData.items.map((member) => (
                      <div key={member.id} className="flex items-center gap-2.5 px-3 py-2" data-testid={`row-member-${member.id}`}>
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-semibold text-primary">
                            {member.first_name[0]}{member.last_name[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{member.first_name} {member.last_name}</p>
                          <p className="text-[10px] text-muted-foreground">{member.member_number}</p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <span className={`text-[10px] font-medium ${
                            member.status === "active" ? "text-green-600 dark:text-green-400"
                            : member.status === "pending" ? "text-yellow-600 dark:text-yellow-400"
                            : "text-muted-foreground"
                          }`}>{member.status}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {member.created_at
                              ? formatDistanceToNow(new Date(member.created_at + (member.created_at.endsWith("Z") ? "" : "Z")), { addSuffix: true })
                              : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <UserPlus className="h-7 w-7 text-muted-foreground/40 mb-1.5" />
                    <p className="text-xs text-muted-foreground">No members yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                Recent Transactions
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7"
                onClick={() => onNavigate?.("transactions")}
                data-testid="link-view-all-transactions"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {txLoading ? (
                  <div className="divide-y">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-3 w-40" />
                          <Skeleton className="h-2.5 w-24" />
                        </div>
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
                  </div>
                ) : recentTxData?.items?.length ? (
                  <div className="divide-y">
                    {recentTxData.items.map((tx) => {
                      const isCredit = tx.transaction_type === "deposit" || tx.transaction_type === "share_purchase" || tx.transaction_type === "repayment";
                      return (
                        <div key={tx.id} className="flex items-center gap-2.5 px-3 py-2" data-testid={`row-tx-${tx.id}`}>
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${isCredit ? "bg-green-100 dark:bg-green-950" : "bg-red-100 dark:bg-red-950"}`}>
                            {isCredit
                              ? <ArrowDownRight className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                              : <ArrowUpRight className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate capitalize">{tx.transaction_type.replace(/_/g, " ")}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              <span className="capitalize">{tx.account_type.replace(/_/g, " ")}</span>
                              {tx.payment_method && <span> · {tx.payment_method.replace(/_/g, " ")}</span>}
                              <span> · {tx.transaction_number}</span>
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-xs font-semibold ${isCredit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                              {isCredit ? "+" : "-"}{formatAmount(tx.amount)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {tx.created_at
                                ? formatDistanceToNow(new Date(tx.created_at + (tx.created_at.endsWith("Z") ? "" : "Z")), { addSuffix: true })
                                : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <ArrowUpRight className="h-7 w-7 text-muted-foreground/40 mb-1.5" />
                    <p className="text-xs text-muted-foreground">No transactions yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Trend Analysis</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Applications, disbursements, and collections over time</p>
              </div>
              <Select value={trendPeriod} onValueChange={setTrendPeriod}>
                <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-trend-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : getTrendChartData().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No trend data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={getTrendChartData()} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => formatAmount(v)} />
                    <Tooltip formatter={(value: number) => formatAmount(value)} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="disbursements" name="Disbursements" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="collections" name="Collections" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Loan Status</CardTitle>
              <p className="text-xs text-muted-foreground">Distribution by status</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : getLoanStatusData().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <CircleDollarSign className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No loan data available</p>
                </div>
              ) : (
                <div>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={getLoanStatusData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {getLoanStatusData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                    {getLoanStatusData().map((item) => (
                      <span key={item.name} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        {item.name}: {item.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  isLoading,
}: {
  label: string;
  value: string | number | undefined;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  isLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-2 md:gap-3 p-2.5 md:p-4">
        <div className={`rounded-full p-1.5 md:p-2.5 ${bgColor} flex-shrink-0`}>
          <Icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${color}`} />
        </div>
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <Skeleton className="h-4 md:h-6 w-14 md:w-20 mb-0.5" />
          ) : (
            <p className="text-sm md:text-lg font-bold leading-tight">{value ?? 0}</p>
          )}
          <p className="text-[10px] md:text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
