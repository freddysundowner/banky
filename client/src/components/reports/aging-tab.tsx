import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { AgingReport } from "./types";
import { formatDate } from "./types";

interface AgingTabProps {
  data: AgingReport | undefined;
  isLoading: boolean;
  formatCurrency: (amount: number) => string;
}

const AGING_ROWS = [
  { key: "current", label: "Current", badgeClass: "bg-green-50 text-green-700 border-green-200" },
  { key: "1_30_days", label: "1-30 Days", badgeClass: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { key: "31_60_days", label: "31-60 Days", badgeClass: "bg-orange-50 text-orange-700 border-orange-200" },
  { key: "61_90_days", label: "61-90 Days", badgeClass: "bg-red-50 text-red-700 border-red-200" },
  { key: "over_90_days", label: "Over 90 Days", badgeClass: "bg-red-100 text-red-800 border-red-300" },
] as const;

export function AgingTab({ data, isLoading, formatCurrency }: AgingTabProps) {
  if (isLoading) return <Skeleton className="h-64" />;

  const totalOutstanding = data?.total_portfolio?.total_outstanding || 0;

  const pctOf = (amount: number) =>
    totalOutstanding ? ((amount / totalOutstanding) * 100).toFixed(1) : "0";

  const parGt30 = totalOutstanding
    ? ((
        (data?.summary?.["31_60_days"]?.total_outstanding || 0) +
        (data?.summary?.["61_90_days"]?.total_outstanding || 0) +
        (data?.summary?.over_90_days?.total_outstanding || 0)
      ) / totalOutstanding * 100).toFixed(2)
    : "0";

  const parGt90 = totalOutstanding
    ? ((data?.summary?.over_90_days?.total_outstanding || 0) / totalOutstanding * 100).toFixed(2)
    : "0";

  const currentRatio = totalOutstanding
    ? ((data?.summary?.current?.total_outstanding || 0) / totalOutstanding * 100).toFixed(2)
    : "0";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Loan Aging Analysis</CardTitle>
          <CardDescription>As of {formatDate(data?.as_of_date || null)}</CardDescription>
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
                {AGING_ROWS.map((row) => {
                  const bucket = data?.summary?.[row.key as keyof typeof data.summary];
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">
                        <Badge variant="outline" className={row.badgeClass}>{row.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{bucket?.count || 0}</TableCell>
                      <TableCell className="text-right">{formatCurrency(bucket?.total_outstanding || 0)}</TableCell>
                      <TableCell className="text-right">{pctOf(bucket?.total_outstanding || 0)}%</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total Portfolio</TableCell>
                  <TableCell className="text-right">{data?.total_portfolio?.count || 0}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalOutstanding)}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <ParCard label='PAR > 30 Days' value={`${parGt30}%`} sub="Portfolio at Risk" className="text-yellow-600" />
        <ParCard label='PAR > 90 Days' value={`${parGt90}%`} sub="High Risk" className="text-red-600" />
        <ParCard label="Current Ratio" value={`${currentRatio}%`} sub="Performing Loans" className="text-green-600" />
      </div>
    </div>
  );
}

function ParCard({ label, value, sub, className }: { label: string; value: string; sub: string; className: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${className}`}>{value}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
