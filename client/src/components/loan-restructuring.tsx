import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { RefreshCw, Plus, ArrowRight } from "lucide-react";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useCurrency } from "@/hooks/use-currency";

interface LoanRestructuringProps {
  organizationId: string;
  loanId: string;
  loanStatus: string;
  currentTerm: number;
  currentRate: number;
  currentMonthlyPayment: number;
  outstandingBalance: number;
  repaymentFrequency?: string;
}

interface Restructure {
  id: string;
  loan_id: string;
  restructure_type: string;
  old_term_months?: number;
  new_term_months?: number;
  old_interest_rate?: number;
  new_interest_rate?: number;
  old_monthly_repayment?: number;
  new_monthly_repayment?: number;
  penalty_waived?: number;
  grace_period_days?: number;
  reason?: string;
  created_at: string;
}

interface Preview {
  current: {
    term_months: number;
    interest_rate: number;
    monthly_repayment: number;
    outstanding_balance: number;
  };
  proposed: {
    term_months: number;
    interest_rate: number;
    monthly_repayment: number;
    total_repayment: number;
    total_interest: number;
  };
  savings: {
    monthly_savings: number;
  };
}

export default function LoanRestructuring({
  organizationId,
  loanId,
  loanStatus,
  currentTerm,
  currentRate,
  currentMonthlyPayment,
  outstandingBalance,
  repaymentFrequency = "monthly",
}: LoanRestructuringProps) {
  const { toast } = useToast();
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const [showDialog, setShowDialog] = useState(false);
  const termPeriodLabels: Record<string, string> = { daily: "days", weekly: "weeks", bi_weekly: "bi-weeks", monthly: "months" };
  const periodLabel = termPeriodLabels[repaymentFrequency] || "months";
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.RESTRUCTURE);
  const [restructureType, setRestructureType] = useState("extend_term");
  const [newTermMonths, setNewTermMonths] = useState("");
  const [newInterestRate, setNewInterestRate] = useState("");
  const [newMonthlyPayment, setNewMonthlyPayment] = useState("");
  const [penaltyWaived, setPenaltyWaived] = useState("");
  const [gracePeriodDays, setGracePeriodDays] = useState("");
  const [reason, setReason] = useState("");

  const canRestructure = loanStatus === "disbursed" && canWrite;

  const { data: restructures, isLoading } = useQuery<Restructure[]>({
    queryKey: ["/api/organizations", organizationId, "loans", loanId, "restructures"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/loans/${loanId}/restructures`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch restructures");
      return res.json();
    },
  });

  const { data: preview, isFetching: previewLoading } = useQuery<Preview>({
    queryKey: ["/api/organizations", organizationId, "loans", loanId, "restructure", "preview", restructureType, newTermMonths, newInterestRate],
    queryFn: async () => {
      const params = new URLSearchParams({ restructure_type: restructureType });
      if (newTermMonths) params.append("new_term_months", newTermMonths);
      if (newInterestRate) params.append("new_interest_rate", newInterestRate);
      const res = await fetch(`/api/organizations/${organizationId}/loans/${loanId}/restructure/preview?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch preview");
      return res.json();
    },
    enabled: showDialog && (restructureType === "extend_term" || restructureType === "adjust_interest"),
  });

  const restructureMutation = useMutation({
    mutationFn: async () => {
      const data: Record<string, any> = { restructure_type: restructureType, reason };
      if (restructureType === "extend_term") data.new_term_months = parseInt(newTermMonths);
      if (restructureType === "reduce_installment") data.new_monthly_repayment = parseFloat(newMonthlyPayment);
      if (restructureType === "adjust_interest") data.new_interest_rate = parseFloat(newInterestRate);
      if (restructureType === "waive_penalty") data.penalty_waived = parseFloat(penaltyWaived);
      if (restructureType === "grace_period") data.grace_period_days = parseInt(gracePeriodDays);
      
      return apiRequest("POST", `/api/organizations/${organizationId}/loans/${loanId}/restructure`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loans", loanId, "restructures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-applications"] });
      setShowDialog(false);
      resetForm();
      toast({ title: "Loan restructured successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to restructure loan", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setRestructureType("extend_term");
    setNewTermMonths("");
    setNewInterestRate("");
    setNewMonthlyPayment("");
    setPenaltyWaived("");
    setGracePeriodDays("");
    setReason("");
  };

  const formatCurrency = (amount: number) => {
    return formatAmount(amount || 0);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "extend_term": return "Term Extension";
      case "reduce_installment": return "Reduced Installment";
      case "adjust_interest": return "Interest Adjustment";
      case "waive_penalty": return "Penalty Waiver";
      case "grace_period": return "Grace Period";
      default: return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Loan Restructuring
            </CardTitle>
            <CardDescription>Modify loan terms to help borrower</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton organizationId={organizationId} />
            {canRestructure && (
              <Button onClick={() => setShowDialog(true)} data-testid="button-restructure" className="shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Restructure</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="p-3 border rounded-lg">
            <div className="text-sm text-muted-foreground">Current Term</div>
            <div className="text-lg font-bold">{currentTerm} {periodLabel}</div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="text-sm text-muted-foreground">Interest Rate</div>
            <div className="text-lg font-bold">{currentRate}%</div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="text-sm text-muted-foreground">Monthly Payment</div>
            <div className="text-lg font-bold">{formatCurrency(currentMonthlyPayment)}</div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className="text-lg font-bold">{formatCurrency(outstandingBalance)}</div>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-24" />
        ) : restructures && restructures.length > 0 ? (
          <>
            <h4 className="font-medium mb-3">Restructure History</h4>
            <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restructures.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(r.restructure_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.new_term_months && (
                        <span className="text-sm">{r.old_term_months} <ArrowRight className="inline h-3 w-3" /> {r.new_term_months} {periodLabel}</span>
                      )}
                      {r.new_interest_rate !== undefined && (
                        <span className="text-sm">{r.old_interest_rate}% <ArrowRight className="inline h-3 w-3" /> {r.new_interest_rate}%</span>
                      )}
                      {r.new_monthly_repayment !== undefined && (
                        <span className="text-sm">{formatCurrency(r.old_monthly_repayment || 0)} <ArrowRight className="inline h-3 w-3" /> {formatCurrency(r.new_monthly_repayment)}</span>
                      )}
                      {r.penalty_waived && <span className="text-sm">Waived: {formatCurrency(r.penalty_waived)}</span>}
                      {r.grace_period_days && <span className="text-sm">Grace: {r.grace_period_days} days</span>}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{r.reason || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </>
        ) : (
          <p className="text-center text-muted-foreground py-6">No restructuring history</p>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Restructure Loan</DialogTitle>
            <DialogDescription>Modify loan terms to accommodate borrower</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Restructure Type</label>
              <Select value={restructureType} onValueChange={setRestructureType}>
                <SelectTrigger data-testid="select-restructure-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="extend_term">Extend Term</SelectItem>
                  <SelectItem value="reduce_installment">Reduce Installment</SelectItem>
                  <SelectItem value="adjust_interest">Adjust Interest Rate</SelectItem>
                  <SelectItem value="waive_penalty">Waive Penalty</SelectItem>
                  <SelectItem value="grace_period">Grant Grace Period</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {restructureType === "extend_term" && (
              <div>
                <label className="text-sm font-medium">New Term ({periodLabel})</label>
                <Input
                  type="number"
                  value={newTermMonths}
                  onChange={(e) => setNewTermMonths(e.target.value)}
                  placeholder={`Current: ${currentTerm}`}
                  data-testid="input-new-term"
                />
              </div>
            )}

            {restructureType === "reduce_installment" && (
              <div>
                <label className="text-sm font-medium">New Monthly Payment</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newMonthlyPayment}
                  onChange={(e) => setNewMonthlyPayment(e.target.value)}
                  placeholder={`Current: ${currentMonthlyPayment}`}
                  data-testid="input-new-payment"
                />
              </div>
            )}

            {restructureType === "adjust_interest" && (
              <div>
                <label className="text-sm font-medium">New Interest Rate (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={newInterestRate}
                  onChange={(e) => setNewInterestRate(e.target.value)}
                  placeholder={`Current: ${currentRate}%`}
                  data-testid="input-new-rate"
                />
              </div>
            )}

            {restructureType === "waive_penalty" && (
              <div>
                <label className="text-sm font-medium">Penalty Amount to Waive</label>
                <Input
                  type="number"
                  step="0.01"
                  value={penaltyWaived}
                  onChange={(e) => setPenaltyWaived(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-penalty"
                />
              </div>
            )}

            {restructureType === "grace_period" && (
              <div>
                <label className="text-sm font-medium">Grace Period (days)</label>
                <Input
                  type="number"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(e.target.value)}
                  placeholder="30"
                  data-testid="input-grace-days"
                />
              </div>
            )}

            {preview && !previewLoading && (restructureType === "extend_term" || restructureType === "adjust_interest") && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Preview</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Current Monthly:</div>
                  <div className="font-medium">{formatCurrency(preview.current.monthly_repayment)}</div>
                  <div>Proposed Monthly:</div>
                  <div className="font-medium">{formatCurrency(preview.proposed.monthly_repayment)}</div>
                  <div>Monthly Savings:</div>
                  <div className="font-medium text-green-600">{formatCurrency(preview.savings.monthly_savings)}</div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for restructuring..."
                className="resize-none"
                data-testid="input-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={() => restructureMutation.mutate()} disabled={restructureMutation.isPending} data-testid="button-submit-restructure">
              {restructureMutation.isPending ? "Processing..." : "Apply Restructure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
