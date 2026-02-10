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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of {organizationName}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="font-medium">Unable to load dashboard</h3>
            <p className="text-sm text-muted-foreground">Please try again later</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of {organizationName}</p>
        </div>
        <RefreshButton
          queryKeys={[["/api/organizations", organizationId, "analytics", "dashboard"]]}
        />
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Organization</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <StatCard
              label="Total Members"
              value={data?.total_members}
              icon={Users}
              color="text-blue-600"
              bgColor="bg-blue-50 dark:bg-blue-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Active Staff"
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
          <h2 className="text-lg font-semibold mb-3">Member Funds</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
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
          <h2 className="text-lg font-semibold mb-3">Loan Portfolio</h2>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Disbursed"
              value={data ? formatAmount(data.total_disbursed) : undefined}
              icon={ArrowUpRight}
              color="text-orange-600"
              bgColor="bg-orange-50 dark:bg-orange-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Outstanding Balance"
              value={data ? formatAmount(data.total_outstanding) : undefined}
              icon={CircleDollarSign}
              color="text-red-600"
              bgColor="bg-red-50 dark:bg-red-950"
              isLoading={isLoading}
            />
            <StatCard
              label="Total Collected"
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
          <h2 className="text-lg font-semibold mb-3">Loan Applications</h2>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Applications"
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
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Defaults & Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-3xl font-bold text-destructive">{data.default_count}</p>
                  <p className="text-sm text-muted-foreground">
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
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`rounded-full p-3 ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="min-w-0">
          {isLoading ? (
            <Skeleton className="h-7 w-20 mb-1" />
          ) : (
            <p className="text-xl sm:text-2xl font-bold break-all">{value ?? 0}</p>
          )}
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
