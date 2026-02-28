import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/refresh-button";
import {
  Users,
  TrendingUp,
  Building2,
  UserCog,
  Wallet,
  PiggyBank,
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
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

interface DashboardProps {
  organizationId: string;
  organizationName: string;
  onNavigate?: (section: string) => void;
}

interface CollateralAlertItem {
  id: string;
  description: string;
  member_name: string | null;
  loan_number: string | null;
  next_revaluation_date: string | null;
  collateral_type_name: string | null;
}

interface CollateralAlerts {
  overdue_revaluation: CollateralAlertItem[];
  due_soon_revaluation: CollateralAlertItem[];
  summary: {
    overdue_revaluation_count: number;
    due_soon_revaluation_count: number;
  };
}

interface DashboardAnalytics {
  total_members: number;
  total_staff: number;
  total_branches: number;
  collateral_deficient_count: number;
  total_savings: number;
  total_shares: number;
  total_disbursed: number;
  total_outstanding: number;
  total_repaid: number;
  default_count: number;
  collection_rate: number;
}

export default function Dashboard({ organizationId, organizationName, onNavigate }: DashboardProps) {
  const { symbol, formatAmount } = useCurrency(organizationId);
  const [deficientDismissed, setDeficientDismissed] = useState(false);
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

      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-base md:text-lg font-semibold mb-2 md:mb-3">Organization</h2>
          <div className="grid gap-3 md:gap-4 grid-cols-3">
            <StatCard
              label="Members"
              value={data?.total_members}
              icon={Users}
              color="text-blue-600"
              bgColor="bg-blue-50 dark:bg-blue-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Staff"
              value={data?.total_staff}
              icon={UserCog}
              color="text-indigo-600"
              bgColor="bg-indigo-50 dark:bg-indigo-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Branches"
              value={data?.total_branches}
              icon={Building2}
              color="text-slate-600"
              bgColor="bg-slate-50 dark:bg-slate-900"
              isLoading={isLoading}
            />
          </div>
        </div>

        <div>
          <h2 className="text-base md:text-lg font-semibold mb-2 md:mb-3">Member Funds</h2>
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
            <StatCard
              label="Total Savings"
              value={data ? formatAmount(data.total_savings) : undefined}
              icon={PiggyBank}
              color="text-green-600"
              bgColor="bg-green-50 dark:bg-green-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Total Shares"
              value={data ? formatAmount(data.total_shares) : undefined}
              icon={Wallet}
              color="text-teal-600"
              bgColor="bg-teal-50 dark:bg-teal-950"
              isLoading={isLoading}
            />
          </div>
        </div>

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
      <CardContent className="flex items-center gap-2.5 md:gap-4 p-3 md:p-5">
        <div className={`rounded-full p-2 md:p-3 ${bgColor} flex-shrink-0`}>
          <Icon className={`h-4 w-4 md:h-5 md:w-5 ${color}`} />
        </div>
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <Skeleton className="h-5 md:h-7 w-16 md:w-20 mb-0.5 md:mb-1" />
          ) : (
            <p className="text-base sm:text-lg md:text-2xl font-bold truncate">{value ?? 0}</p>
          )}
          <p className="text-[11px] md:text-sm text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
