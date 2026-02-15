import { useState, useMemo } from "react";
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
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [autoApplied, setAutoApplied] = useState<Record<string, boolean>>({});

  const { data: preview, isLoading, isError, error, refetch } = useQuery<PreviewData>({
    queryKey: [`/api/organizations/${organizationId}/accounting/opening-balances/preview`],
  });

  const setAmount = (code: string, value: string) => {
    setAmounts(prev => ({ ...prev, [code]: value }));
    setAutoApplied(prev => ({ ...prev, [code]: false }));
  };

  const applyAuto = (code: string, gap: number) => {
    setAmounts(prev => ({ ...prev, [code]: String(gap) }));
    setAutoApplied(prev => ({ ...prev, [code]: true }));
  };

  const clearAmount = (code: string) => {
    setAmounts(prev => ({ ...prev, [code]: "" }));
    setAutoApplied(prev => ({ ...prev, [code]: false }));
  };

  const applyAllSuggestions = () => {
    if (!preview?.accounts) return;
    const newAmounts: Record<string, string> = { ...amounts };
    const newAuto: Record<string, boolean> = { ...autoApplied };
    let totalDebit = 0;
    let totalCredit = 0;

    for (const acct of preview.accounts) {
      if (acct.gap !== null && Math.abs(acct.gap) > 0.01) {
        newAmounts[acct.account_code] = String(acct.gap);
        newAuto[acct.account_code] = true;
        if (acct.account_type === "asset") {
          if (acct.gap > 0) totalDebit += acct.gap;
          else totalCredit += Math.abs(acct.gap);
        } else {
          if (acct.gap > 0) totalCredit += acct.gap;
          else totalDebit += Math.abs(acct.gap);
        }
      }
    }

    const diff = totalCredit - totalDebit;
    if (Math.abs(diff) > 0.01) {
      const cashAcct = preview.accounts.find(a => a.account_code === "1000");
      if (cashAcct) {
        newAmounts["1000"] = String(Math.round(diff * 100) / 100);
        newAuto["1000"] = true;
      }
    }

    setAmounts(newAmounts);
    setAutoApplied(newAuto);
  };

  const getEntryAmount = (code: string): number => {
    return parseFloat(amounts[code] || "") || 0;
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
  }, [amounts, preview?.accounts]);

  const hasAnyEntries = Object.values(amounts).some(v => parseFloat(v) !== 0 && v !== "");

  const postMutation = useMutation<PostResult, Error>({
    mutationFn: async () => {
      const lines = (preview?.accounts || [])
        .filter(acct => {
          const val = parseFloat(amounts[acct.account_code] || "");
          return !isNaN(val) && val !== 0;
        })
        .map(acct => ({
          account_code: acct.account_code,
          amount: parseFloat(amounts[acct.account_code]),
          memo: autoApplied[acct.account_code]
            ? `Opening balance (auto-calculated) - ${acct.account_name}`
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
      setAmounts({});
      setAutoApplied({});
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

  const typeLabels: Record<string, string> = {
    asset: "Assets",
    liability: "Liabilities",
    equity: "Equity",
  };
  const typeOrder = ["asset", "liability", "equity"];
  const grouped = typeOrder
    .map(type => ({
      type,
      label: typeLabels[type] || type,
      accounts: (preview?.accounts || []).filter(a => a.account_type === type),
    }))
    .filter(g => g.accounts.length > 0);

  return (
    <div className="space-y-4 pb-48" data-testid="opening-balances-page">
      <PageHeader
        title="Opening Balances"
        description="Set starting balances from your previous system or actual records."
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
        <div className="space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>How this works</AlertTitle>
            <AlertDescription>
              Tap <strong>Auto</strong> on individual accounts, or use the button below to fill all gaps at once.
              The system will auto-balance to Cash/Bank if needed. All entries must balance before posting.
            </AlertDescription>
          </Alert>
          {preview?.has_gaps && (
            <Button
              onClick={applyAllSuggestions}
              variant="default"
              className="w-full"
              size="lg"
              data-testid="button-apply-all"
            >
              <Wand2 className="h-5 w-5 mr-2" />
              Apply All Suggestions & Auto-Balance
            </Button>
          )}
        </div>
      )}

      {grouped.map(group => (
        <div key={group.type} className="space-y-2" data-testid={`group-${group.type}`}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {group.label}
          </h3>
          {group.accounts.map(acct => {
            const hasSuggestion = acct.suggested_balance !== null;
            const gapExists = acct.gap !== null && Math.abs(acct.gap) > 0.01;
            const currentVal = amounts[acct.account_code] || "";
            const isAutoFilled = autoApplied[acct.account_code] === true;
            const hasValue = currentVal !== "" && parseFloat(currentVal) !== 0;
            const showInput = hasValue || gapExists || amounts.hasOwnProperty(acct.account_code);

            return (
              <Card
                key={acct.account_code}
                className={`${isAutoFilled ? "border-green-400 dark:border-green-600" : ""}`}
                data-testid={`account-row-${acct.account_code}`}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{acct.account_code}</span>
                        {isAutoFilled && <Badge variant="secondary" className="text-xs">Auto</Badge>}
                      </div>
                      <div className="text-sm font-medium truncate">{acct.account_name}</div>
                    </div>
                    {!alreadyPosted && (
                      <div className="flex gap-1 shrink-0">
                        {hasSuggestion && gapExists && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => applyAuto(acct.account_code, acct.gap!)}
                            data-testid={`button-auto-${acct.account_code}`}
                          >
                            <Wand2 className="h-3.5 w-3.5 mr-1" />
                            Auto
                          </Button>
                        )}
                        {!showInput && !gapExists && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAmount(acct.account_code, "")}
                            data-testid={`button-manual-${acct.account_code}`}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Enter
                          </Button>
                        )}
                        {hasValue && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => clearAmount(acct.account_code)}
                            data-testid={`button-clear-${acct.account_code}`}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Clear
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">GL Balance</div>
                      <div className="font-mono font-medium">{formatCurrency(acct.current_gl_balance)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Actual</div>
                      <div className="font-mono font-medium">
                        {hasSuggestion ? formatCurrency(acct.suggested_balance!) : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Gap</div>
                      <div className={`font-mono font-medium ${gapExists ? "text-orange-600 dark:text-orange-400" : ""}`}>
                        {hasSuggestion && gapExists
                          ? formatCurrency(acct.gap!)
                          : hasSuggestion
                            ? "Matched"
                            : "-"}
                      </div>
                    </div>
                  </div>

                  {!alreadyPosted && showInput && (
                    <div className="pt-1">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter adjustment amount"
                        className={`text-right font-mono ${isAutoFilled ? "border-green-500 bg-green-50 dark:bg-green-950" : ""}`}
                        value={currentVal}
                        onChange={(e) => setAmount(acct.account_code, e.target.value)}
                        data-testid={`input-amount-${acct.account_code}`}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}

      {!alreadyPosted && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t-2 shadow-2xl p-4" data-testid="post-section">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <span>Dr: <strong className="font-mono">{formatCurrency(totals.debit)}</strong></span>
                <span>Cr: <strong className="font-mono">{formatCurrency(totals.credit)}</strong></span>
              </div>
              <Badge variant={totals.balanced ? "default" : "destructive"} data-testid="balance-status">
                {totals.balanced ? "Balanced" : `Off by ${formatCurrency(Math.abs(totals.debit - totals.credit))}`}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                className="w-36"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                data-testid="input-effective-date"
              />
              <Input
                placeholder="Notes (optional)"
                className="flex-1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-notes"
              />
            </div>
            <Button
              size="lg"
              className="w-full text-base"
              onClick={() => setShowConfirm(true)}
              disabled={!totals.balanced || !hasAnyEntries}
              data-testid="button-post-opening-balances"
            >
              <ArrowRightLeft className="h-5 w-5 mr-2" />
              Post Opening Balances
            </Button>
          </div>
        </div>
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
                const val = parseFloat(amounts[a.account_code] || "");
                return !isNaN(val) && val !== 0;
              })
              .map(a => (
                <div key={a.account_code} className="flex justify-between text-sm px-2">
                  <span>{a.account_code} - {a.account_name}</span>
                  <span className="font-mono">
                    {formatCurrency(parseFloat(amounts[a.account_code]))}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {autoApplied[a.account_code] ? "Auto" : "Manual"}
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
