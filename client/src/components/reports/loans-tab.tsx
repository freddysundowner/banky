import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LoanReport } from "./types";
import { getStatusColor, formatDate } from "./types";

interface LoansTabProps {
  data: LoanReport | undefined;
  isLoading: boolean;
  formatCurrency: (amount: number) => string;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function LoansTab({
  data,
  isLoading,
  formatCurrency,
  statusFilter,
  onStatusFilterChange,
  page,
  onPageChange,
}: LoansTabProps) {
  const pagination = data?.loans?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 mb-4">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-44" data-testid="select-loan-status">
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

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Total Applications" value={String(data?.summary?.total_applications || 0)} sub={`Approval Rate: ${(data?.summary?.approval_rate || 0).toFixed(1)}%`} />
            <SummaryCard label="Total Applied" value={formatCurrency(data?.summary?.total_applied_amount || 0)} />
            <SummaryCard label="Total Disbursed" value={formatCurrency(data?.summary?.total_disbursed_amount || 0)} className="text-green-600" />
            <SummaryCard label="Total Outstanding" value={formatCurrency(data?.summary?.total_outstanding || 0)} className="text-orange-600" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {Object.entries(data?.by_status || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2">
                    <Badge className={getStatusColor(status)}>{status}</Badge>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Loan Applications</CardTitle>
                  <CardDescription>
                    Showing {data?.loans?.items?.length || 0} of {pagination?.total || 0} loans
                  </CardDescription>
                </div>
              </div>
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
                    {(data?.loans?.items || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No loan applications found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.loans?.items.map((loan) => (
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

              {pagination && pagination.total_pages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.total_pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => onPageChange(page - 1)}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.total_pages}
                      onClick={() => onPageChange(page + 1)}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${className || ""}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
