import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertTriangle, ArrowRightLeft, FileText } from "lucide-react";

interface GapSummary {
  actual: number;
  gl: number;
  gap: number;
}

interface PreviewLine {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  memo: string;
}

interface PreviewData {
  has_gaps: boolean;
  summary: Record<string, GapSummary>;
  lines: PreviewLine[];
  total_debit: number;
  total_credit: number;
}

interface PostResult {
  message: string;
  journal_entry: {
    id: string;
    entry_number: string;
    entry_date: string;
    total_debit: number;
    total_credit: number;
    line_count: number;
  } | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const categoryLabels: Record<string, string> = {
  member_savings: "Member Savings",
  member_shares: "Member Shares",
  outstanding_loans: "Outstanding Loans",
  fixed_deposits: "Fixed Deposits",
};

export default function OpeningBalances({ organizationId }: { organizationId: string }) {
  const { toast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  const { data: preview, isLoading, isError, error, refetch } = useQuery<PreviewData>({
    queryKey: [`/api/organizations/${organizationId}/accounting/opening-balances/preview`],
  });

  const postMutation = useMutation<PostResult, Error>({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/organizations/${organizationId}/accounting/opening-balances/post`,
        {
          effective_date: effectiveDate,
          notes: notes || undefined,
        }
      );
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Opening Balances Posted",
        description: data.message,
      });
      setShowConfirm(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/accounting`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setShowConfirm(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Opening Balances"
          description="Reconcile the General Ledger with actual member, loan, and deposit data after bulk imports or migrations."
        />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to Load</AlertTitle>
          <AlertDescription>
            {(error as Error)?.message || "Could not load opening balance data. Please try again."}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-retry">
          Retry
        </Button>
      </div>
    );
  }

  const hasGaps = preview?.has_gaps ?? false;

  return (
    <div className="space-y-6" data-testid="opening-balances-page">
      <PageHeader
        title="Opening Balances"
        description="Reconcile the General Ledger with actual member, loan, and deposit data after bulk imports or migrations."
      />

      {!hasGaps && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-200">Ledger is Reconciled</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            The General Ledger matches all actual member savings, shares, outstanding loans, and fixed deposit balances. No adjustments are needed.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {preview?.summary && Object.entries(preview.summary).map(([key, val]) => (
          <Card key={key} data-testid={`summary-card-${key}`}>
            <CardHeader className="pb-2">
              <CardDescription>{categoryLabels[key] || key}</CardDescription>
              <CardTitle className="text-lg">
                {formatCurrency(val.actual)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">In Ledger</span>
                <span>{formatCurrency(val.gl)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Gap</span>
                <Badge
                  variant={Math.abs(val.gap) < 0.01 ? "outline" : "destructive"}
                  className="font-mono"
                  data-testid={`gap-badge-${key}`}
                >
                  {Math.abs(val.gap) < 0.01 ? "0.00" : formatCurrency(val.gap)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasGaps && preview?.lines && preview.lines.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Proposed Journal Entry</CardTitle>
              </div>
              <CardDescription>
                This entry will bring the General Ledger in line with actual balances. Review the lines below before posting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table data-testid="preview-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.lines.map((line, idx) => (
                    <TableRow key={idx} data-testid={`preview-line-${idx}`}>
                      <TableCell>
                        <div className="font-mono text-sm">{line.account_code}</div>
                        <div className="text-xs text-muted-foreground">{line.account_name}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {line.memo}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {line.debit > 0 ? formatCurrency(line.debit) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {line.credit > 0 ? formatCurrency(line.credit) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell colSpan={2} className="text-right">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(preview.total_debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(preview.total_credit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Post Opening Balances</CardTitle>
              <CardDescription>
                Set the effective date and optional notes, then post the journal entry. This action can only be done once.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="effective-date">Effective Date</Label>
                  <Input
                    id="effective-date"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    data-testid="input-effective-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input
                    id="notes"
                    placeholder="e.g. Migration from legacy system"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    data-testid="input-notes"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => setShowConfirm(true)}
                  data-testid="button-post-opening-balances"
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Post Opening Balances
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Opening Balance Entry</DialogTitle>
            <DialogDescription>
              This will create a journal entry for{" "}
              <span className="font-semibold">{formatCurrency(preview?.total_debit ?? 0)}</span>{" "}
              (debit = credit) effective {effectiveDate}. This action cannot be undone through this page.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>One-time action</AlertTitle>
              <AlertDescription>
                Opening balances can only be posted once. If you need to adjust later, you would reverse the journal entry from the Journal Entries page and re-post.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} data-testid="button-cancel-post">
              Cancel
            </Button>
            <Button
              onClick={() => postMutation.mutate()}
              disabled={postMutation.isPending}
              data-testid="button-confirm-post"
            >
              {postMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm & Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
