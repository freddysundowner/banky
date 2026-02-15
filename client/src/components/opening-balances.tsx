import { useState, useMemo, useEffect } from "react";
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
import { Loader2, CheckCircle2, AlertTriangle, ArrowRightLeft, Wand2, Pencil, RotateCcw, Info } from "lucide-react";

interface AccountRow {
  account_code: string;
  account_name: string;
  account_type: string;
  current_gl_balance: number;
  suggested_balance: number | null;
  gap: number | null;
  detail: string;
}

interface PreviewData {
  has_gaps: boolean;
  already_posted: boolean;
  existing_entry_number?: string;
  accounts: AccountRow[];
  summary: Record<string, { actual: number; gl: number; gap: number }>;
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

interface AccountEntry {
  amount: string;
  source: "none" | "suggested" | "manual";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function OpeningBalances({ organizationId }: { organizationId: string }) {
  const { toast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<Record<string, AccountEntry>>({});

  const { data: preview, isLoading, isError, error, refetch } = useQuery<PreviewData>({
    queryKey: [`/api/organizations/${organizationId}/accounting/opening-balances/preview`],
  });

  useEffect(() => {
    if (preview?.accounts && !preview.already_posted) {
      const autoEntries: Record<string, AccountEntry> = {};
      for (const acct of preview.accounts) {
        if (acct.gap !== null && Math.abs(acct.gap) > 0.01) {
          autoEntries[acct.account_code] = {
            amount: String(acct.gap),
            source: "suggested",
          };
        }
      }
      if (Object.keys(autoEntries).length > 0) {
        setEntries(prev => {
          if (Object.keys(prev).length > 0) return prev;
          return autoEntries;
        });
      }
    }
  }, [preview]);

  const updateEntry = (code: string, amount: string, source: "suggested" | "manual") => {
    setEntries(prev => ({
      ...prev,
      [code]: { amount, source },
    }));
  };

  const clearEntry = (code: string) => {
    setEntries(prev => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const getEntryAmount = (code: string): number => {
    const entry = entries[code];
    if (!entry || entry.source === "none") return 0;
    return parseFloat(entry.amount) || 0;
  };

  const totals = useMemo(() => {
    if (!preview?.accounts) return { debit: 0, credit: 0, balanced: true };
    let debit = 0;
    let credit = 0;
    for (const acct of preview.accounts) {
      const amt = getEntryAmount(acct.account_code);
      if (amt === 0) continue;
      if (acct.account_type === "asset") {
        if (amt > 0) debit += amt;
        else credit += Math.abs(amt);
      } else {
        if (amt > 0) credit += amt;
        else debit += Math.abs(amt);
      }
    }
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 };
  }, [entries, preview?.accounts]);

  const hasAnyEntries = Object.values(entries).some(e => e.source !== "none" && parseFloat(e.amount) !== 0);

  const postMutation = useMutation<PostResult, Error>({
    mutationFn: async () => {
      const lines = (preview?.accounts || [])
        .filter(acct => {
          const entry = entries[acct.account_code];
          return entry && entry.source !== "none" && parseFloat(entry.amount) !== 0;
        })
        .map(acct => ({
          account_code: acct.account_code,
          amount: parseFloat(entries[acct.account_code].amount),
          memo: entries[acct.account_code].source === "suggested"
            ? `Opening balance (system suggested) - ${acct.account_name}`
            : `Opening balance (manually entered) - ${acct.account_name}`,
        }));

      const res = await apiRequest(
        "POST",
        `/api/organizations/${organizationId}/accounting/opening-balances/post`,
        {
          effective_date: effectiveDate,
          notes: notes || undefined,
          lines,
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
      setEntries({});
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
          description="Set up your ledger with starting balances from your previous system."
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

  const alreadyPosted = preview?.already_posted ?? false;

  return (
    <div className="space-y-6" data-testid="opening-balances-page">
      <PageHeader
        title="Opening Balances"
        description="Set up your ledger with starting balances from your previous system or actual records."
      />

      {alreadyPosted && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-200">Opening Balances Already Posted</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            Opening balances were posted as entry {preview?.existing_entry_number}. To re-do them,
            first reverse that journal entry from the Journal Entries page.
          </AlertDescription>
        </Alert>
      )}

      {!alreadyPosted && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>How this works</AlertTitle>
          <AlertDescription>
            For each account, the system shows what's currently in the ledger and the actual balance
            from your member data. The "Adjustment Needed" column shows the difference. You can apply
            the suggested adjustment or enter your own amount from your actual records (bank statements,
            loan books, etc.). All entries must balance (debits = credits) before posting.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Account Balances</CardTitle>
          <CardDescription>
            {alreadyPosted
              ? "Current account status. Opening balances have already been recorded."
              : "Set the opening balance for each account. Use the system suggestion or enter your own amount."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="accounts-table">
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Current in Ledger</TableHead>
                <TableHead className="text-right">Actual Balance</TableHead>
                <TableHead className="text-right">Adjustment Needed</TableHead>
                <TableHead className="text-right">Your Entry</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const typeLabels: Record<string, string> = {
                  asset: "Assets",
                  liability: "Liabilities",
                  equity: "Equity",
                  income: "Income",
                  expense: "Expenses",
                };
                const typeOrder = ["asset", "liability", "equity", "income", "expense"];
                const grouped = typeOrder
                  .map(type => ({
                    type,
                    label: typeLabels[type] || type,
                    accounts: (preview?.accounts || []).filter(a => a.account_type === type),
                  }))
                  .filter(g => g.accounts.length > 0);

                const rows: JSX.Element[] = [];
                grouped.forEach(group => {
                  rows.push(
                    <TableRow key={`header-${group.type}`} className="bg-muted/50">
                      <TableCell colSpan={6} className="font-semibold text-sm py-2">
                        {group.label}
                      </TableCell>
                    </TableRow>
                  );
                  group.accounts.forEach((acct) => {
                    const entry = entries[acct.account_code];
                    const hasEntry = entry && entry.source !== "none";
                    const hasSuggestion = acct.suggested_balance !== null;
                    const gapExists = acct.gap !== null && Math.abs(acct.gap) > 0.01;
                    const isAuto = hasEntry && entry.source === "suggested";
                    const isManual = hasEntry && entry.source === "manual";
                    rows.push(
                      <TableRow key={acct.account_code} data-testid={`account-row-${acct.account_code}`}>
                        <TableCell>
                          <div className="font-mono text-sm font-medium">{acct.account_code}</div>
                          <div className="text-sm">{acct.account_name}</div>
                          <div className="text-xs text-muted-foreground">{acct.detail}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(acct.current_gl_balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasSuggestion ? (
                            <span className="font-mono">{formatCurrency(acct.suggested_balance!)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasSuggestion && gapExists ? (
                            <span className="font-mono text-orange-600 dark:text-orange-400">
                              {formatCurrency(acct.gap!)}
                            </span>
                          ) : hasSuggestion ? (
                            <Badge variant="outline" className="text-xs">None</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {alreadyPosted ? (
                            <span className="text-muted-foreground">-</span>
                          ) : isAuto ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-mono font-medium text-green-700 dark:text-green-400">
                                {formatCurrency(parseFloat(entry.amount) || 0)}
                              </span>
                              <Badge variant="secondary" className="text-xs">Auto</Badge>
                            </div>
                          ) : isManual ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="w-36 text-right font-mono ml-auto"
                              value={entry.amount}
                              onChange={(e) => updateEntry(acct.account_code, e.target.value, "manual")}
                              autoFocus
                              data-testid={`input-amount-${acct.account_code}`}
                            />
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {!alreadyPosted && (
                            <div className="flex items-center justify-center gap-1">
                              {hasSuggestion && gapExists && !isAuto && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => updateEntry(acct.account_code, String(acct.gap!), "suggested")}
                                  data-testid={`button-auto-${acct.account_code}`}
                                >
                                  <Wand2 className="h-3.5 w-3.5 mr-1" />
                                  Auto
                                </Button>
                              )}
                              {!isManual && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateEntry(acct.account_code, "", "manual")}
                                  data-testid={`button-manual-${acct.account_code}`}
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1" />
                                  Manual
                                </Button>
                              )}
                              {hasEntry && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => clearEntry(acct.account_code)}
                                  data-testid={`button-clear-${acct.account_code}`}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                  Reset
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  });
                });
                return rows;
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!alreadyPosted && hasAnyEntries && (
        <Card>
          <CardHeader>
            <CardTitle>Post Opening Balances</CardTitle>
            <CardDescription>
              Review the totals below. Debits must equal credits before you can post.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6 p-4 rounded-lg bg-muted/50">
              <div className="text-center">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Debits</div>
                <div className="text-lg font-mono font-semibold">{formatCurrency(totals.debit)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Credits</div>
                <div className="text-lg font-mono font-semibold">{formatCurrency(totals.credit)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Difference</div>
                <div className={`text-lg font-mono font-semibold ${totals.balanced ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(Math.abs(totals.debit - totals.credit))}
                </div>
              </div>
              <Badge variant={totals.balanced ? "default" : "destructive"} className="ml-auto" data-testid="balance-status">
                {totals.balanced ? "Balanced" : "Out of Balance"}
              </Badge>
            </div>

            {!totals.balanced && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Entry Not Balanced</AlertTitle>
                <AlertDescription>
                  Total debits ({formatCurrency(totals.debit)}) do not equal total credits ({formatCurrency(totals.credit)}).
                  Adjust your amounts so that debits and credits are equal. You may need to add a Cash at Bank or
                  Cash on Hand amount to balance the entry.
                </AlertDescription>
              </Alert>
            )}

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
                disabled={!totals.balanced}
                data-testid="button-post-opening-balances"
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Post Opening Balances
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Opening Balance Entry</DialogTitle>
            <DialogDescription>
              This will create a journal entry for{" "}
              <span className="font-semibold">{formatCurrency(totals.debit)}</span>{" "}
              (debit = credit) effective {effectiveDate}. This action can only be done once.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <div className="text-sm text-muted-foreground">Accounts included:</div>
            {preview?.accounts
              .filter(a => {
                const e = entries[a.account_code];
                return e && e.source !== "none" && parseFloat(e.amount) !== 0;
              })
              .map(a => (
                <div key={a.account_code} className="flex justify-between text-sm px-2">
                  <span>{a.account_code} - {a.account_name}</span>
                  <span className="font-mono">
                    {formatCurrency(parseFloat(entries[a.account_code].amount))}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {entries[a.account_code].source === "suggested" ? "Auto" : "Manual"}
                    </Badge>
                  </span>
                </div>
              ))
            }
          </div>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>One-time action</AlertTitle>
            <AlertDescription>
              Opening balances can only be posted once. If you need to adjust later, reverse the journal entry from
              the Journal Entries page and re-post.
            </AlertDescription>
          </Alert>
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
