import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshButton } from "@/components/refresh-button";
import {
  Users,
  Banknote,
  TrendingUp,
  FileText,
  Building2,
  UserCog,
  Wallet,
  PiggyBank,
  AlertTriangle,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

interface DashboardProps {
  organizationId: string;
  organizationName: string;
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

export default function Dashboard({ organizationId, organizationName }: DashboardProps) {
  const { symbol, formatAmount } = useCurrency(organizationId);
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

        <div>
          <h2 className="text-base md:text-lg font-semibold mb-2 md:mb-3">Loan Applications</h2>
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total"
              value={data?.total_loans}
              icon={FileText}
              color="text-purple-600"
              bgColor="bg-purple-50 dark:bg-purple-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Pending"
              value={data?.pending_loans}
              icon={Clock}
              color="text-yellow-600"
              bgColor="bg-yellow-50 dark:bg-yellow-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Approved"
              value={data?.approved_loans}
              icon={CheckCircle2}
              color="text-green-600"
              bgColor="bg-green-50 dark:bg-green-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Disbursed"
              value={data?.disbursed_loans}
              icon={Banknote}
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
