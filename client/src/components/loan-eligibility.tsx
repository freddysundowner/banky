import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/hooks/use-currency";
import {
  CheckCircle2,
  XCircle,
  Info,
  Search,
  RefreshCw,
  ChevronRight,
  User,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Calculator,
  ClipboardList,
} from "lucide-react";

interface LoanEligibilityProps {
  organizationId: string;
}

interface LoanProduct {
  id: string;
  name: string;
  code: string;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  interest_rate: number;
  interest_rate_period: string;
  requires_collateral: boolean;
  shares_multiplier: number;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  member_number: string;
  status: string;
  savings_balance: number;
  shares_balance: number;
  deposits_balance: number;
}

interface EligibilityCheck {
  key: string;
  label: string;
  passed: boolean;
  message: string;
  informational?: boolean;
}

interface EligibilityResult {
  eligible: boolean;
  checks: EligibilityCheck[];
  member: {
    id: string;
    name: string;
    member_number: string;
    status: string;
    savings_balance: number;
    shares_balance: number;
    deposits_balance: number;
  };
  product: {
    id: string;
    name: string;
    interest_rate: number;
    interest_rate_period: string;
    requires_guarantor: boolean;
    min_guarantors: number;
    requires_collateral: boolean;
  };
  requested: {
    amount: number;
    term_months: number;
    collateral_value: number;
  };
  estimates: {
    monthly_payment: number;
    processing_fee: number;
    insurance_fee: number;
    appraisal_fee: number;
    total_fees: number;
    total_repayable: number;
  };
  max_eligible_amount: number | null;
}

export default function LoanEligibility({ organizationId }: LoanEligibilityProps) {
  const { formatAmount, symbol } = useCurrency(organizationId);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [collateralValue, setCollateralValue] = useState("");
  const [result, setResult] = useState<EligibilityResult | null>(null);

  const { data: products, isLoading: productsLoading } = useQuery<LoanProduct[]>({
    queryKey: ["/api/organizations", organizationId, "loan-products"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/loan-products`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch loan products");
      const data = await res.json();
      return (data.items || data).filter((p: LoanProduct & { is_active: boolean }) => p.is_active !== false);
    },
  });

  const { data: membersData, isLoading: membersLoading } = useQuery<{ items: Member[] }>({
    queryKey: ["/api/organizations", organizationId, "members", "search", memberSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", per_page: "8" });
      if (memberSearch) params.set("search", memberSearch);
      const res = await fetch(`/api/organizations/${organizationId}/members?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: memberSearch.length >= 2 || memberSearch.length === 0,
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/organizations/${organizationId}/loans/eligibility-check`, {
        member_id: selectedMember?.id,
        loan_product_id: selectedProductId,
        amount: parseFloat(amount) || 0,
        term_months: parseInt(termMonths) || 12,
        collateral_value: parseFloat(collateralValue) || 0,
      });
      return res.json();
    },
    onSuccess: (data) => setResult(data),
  });

  const selectedProduct = products?.find(p => p.id === selectedProductId);
  const canCheck = selectedMember && selectedProductId && parseFloat(amount) > 0 && parseInt(termMonths) > 0;

  const handleReset = () => {
    setSelectedMember(null);
    setMemberSearch("");
    setSelectedProductId("");
    setAmount("");
    setTermMonths("");
    setCollateralValue("");
    setResult(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Loan Eligibility Checker
          </h1>
          <p className="text-sm text-muted-foreground">Quick field assessment — check if a client qualifies for a loan</p>
        </div>
        {result && (
          <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-reset-eligibility">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> New Check
          </Button>
        )}
      </div>

      {!result ? (
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Client / Member
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedMember ? (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                    <div>
                      <p className="font-medium text-sm">{selectedMember.first_name} {selectedMember.last_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedMember.member_number}</p>
                      <Badge
                        variant={selectedMember.status === "active" ? "default" : "secondary"}
                        className="mt-1 text-[10px] h-4"
                      >
                        {selectedMember.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => { setSelectedMember(null); setMemberSearch(""); setResult(null); }}
                      data-testid="button-change-member"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or member number..."
                        className="pl-8 text-sm"
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        data-testid="input-member-search"
                      />
                    </div>
                    {membersLoading ? (
                      <div className="space-y-2">
                        {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    ) : (
                      <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                        {(membersData?.items || []).length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">No members found</p>
                        ) : (
                          (membersData?.items || []).map(m => (
                            <button
                              key={m.id}
                              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                              onClick={() => setSelectedMember(m)}
                              data-testid={`button-select-member-${m.id}`}
                            >
                              <div>
                                <p className="text-sm font-medium">{m.first_name} {m.last_name}</p>
                                <p className="text-xs text-muted-foreground">{m.member_number}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-medium ${m.status === "active" ? "text-green-600" : "text-amber-600"}`}>
                                  {m.status}
                                </span>
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" /> Loan Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Loan Product</Label>
                  {productsLoading ? (
                    <Skeleton className="h-9 w-full mt-1" />
                  ) : (
                    <Select value={selectedProductId} onValueChange={v => { setSelectedProductId(v); setAmount(""); setTermMonths(""); setResult(null); }}>
                      <SelectTrigger className="mt-1" data-testid="select-loan-product">
                        <SelectValue placeholder="Select loan product..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(products || []).map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedProduct && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Range: {symbol}{selectedProduct.min_amount.toLocaleString()} – {symbol}{selectedProduct.max_amount.toLocaleString()} · Term: {selectedProduct.min_term_months}–{selectedProduct.max_term_months} months · Rate: {selectedProduct.interest_rate}% {selectedProduct.interest_rate_period}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Loan Amount ({symbol})</Label>
                    <Input
                      type="number"
                      placeholder={selectedProduct ? `${selectedProduct.min_amount}–${selectedProduct.max_amount}` : "0"}
                      className="mt-1"
                      value={amount}
                      onChange={e => { setAmount(e.target.value); setResult(null); }}
                      data-testid="input-loan-amount"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Term (months)</Label>
                    <Input
                      type="number"
                      placeholder={selectedProduct ? `${selectedProduct.min_term_months}–${selectedProduct.max_term_months}` : "12"}
                      className="mt-1"
                      value={termMonths}
                      onChange={e => { setTermMonths(e.target.value); setResult(null); }}
                      data-testid="input-term-months"
                    />
                  </div>
                </div>

                {selectedProduct?.requires_collateral && (
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Collateral / Security Value ({symbol})
                    </Label>
                    <Input
                      type="number"
                      placeholder="Estimated market value of security..."
                      className="mt-1"
                      value={collateralValue}
                      onChange={e => { setCollateralValue(e.target.value); setResult(null); }}
                      data-testid="input-collateral-value"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Enter the estimated market value of the security the client is offering.</p>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => checkMutation.mutate()}
                  disabled={!canCheck || checkMutation.isPending}
                  data-testid="button-check-eligibility"
                >
                  {checkMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Checking...</>
                  ) : (
                    <><Calculator className="h-4 w-4 mr-2" /> Check Eligibility</>
                  )}
                </Button>

                {checkMutation.isError && (
                  <p className="text-xs text-destructive text-center">
                    {(checkMutation.error as Error)?.message || "Failed to check eligibility"}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="flex flex-col items-center justify-center min-h-64 border-dashed bg-muted/20">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Results will appear here</p>
            <p className="text-xs text-muted-foreground mt-1">Fill in client and loan details, then click Check Eligibility</p>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`rounded-xl border-2 p-5 ${result.eligible ? "border-green-500 bg-green-50 dark:bg-green-950/30" : "border-red-400 bg-red-50 dark:bg-red-950/30"}`}>
            <div className="flex items-center gap-3">
              {result.eligible ? (
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500 dark:text-red-400 flex-shrink-0" />
              )}
              <div>
                <h2 className={`text-lg font-bold ${result.eligible ? "text-green-700 dark:text-green-300" : "text-red-600 dark:text-red-400"}`}>
                  {result.eligible ? "Eligible for Loan" : "Not Currently Eligible"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {result.member.name} · {result.member.member_number} · {result.product.name}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-2">
              <h3 className="text-sm font-semibold">Eligibility Checks</h3>
              <div className="space-y-2">
                {result.checks.map((check) => (
                  <div
                    key={check.key}
                    className={`flex gap-3 rounded-lg border p-3 ${
                      check.informational
                        ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20"
                        : check.passed
                          ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                          : "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20"
                    }`}
                    data-testid={`check-${check.key}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {check.informational ? (
                        <Info className="h-4 w-4 text-blue-500" />
                      ) : check.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{check.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{check.message}</p>
                    </div>
                    <div className="flex-shrink-0 ml-auto">
                      {!check.informational && (
                        <Badge
                          variant={check.passed ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {check.passed ? "Pass" : "Fail"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}

                {result.product.requires_guarantor && (
                  <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold">Guarantors Required</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        This product requires at least {result.product.min_guarantors} guarantor{result.product.min_guarantors !== 1 ? "s" : ""}. Arrange guarantors before application.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Member Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Savings</span>
                    <span className="font-medium">{formatAmount(result.member.savings_balance)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Shares</span>
                    <span className="font-medium">{formatAmount(result.member.shares_balance)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Deposits</span>
                    <span className="font-medium">{formatAmount(result.member.deposits_balance)}</span>
                  </div>
                  {result.max_eligible_amount !== null && (
                    <div className="flex justify-between text-xs pt-1 border-t">
                      <span className="text-muted-foreground">Max from shares</span>
                      <span className="font-semibold text-primary">{formatAmount(result.max_eligible_amount)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {result.eligible && (
                <Card className="border-green-200 dark:border-green-800">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estimated Costs</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Monthly payment</span>
                      <span className="font-bold text-sm text-foreground">{formatAmount(result.estimates.monthly_payment)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total repayable</span>
                      <span className="font-medium">{formatAmount(result.estimates.total_repayable)}</span>
                    </div>
                    {result.estimates.processing_fee > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Processing fee</span>
                        <span className="font-medium">{formatAmount(result.estimates.processing_fee)}</span>
                      </div>
                    )}
                    {result.estimates.insurance_fee > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Insurance fee</span>
                        <span className="font-medium">{formatAmount(result.estimates.insurance_fee)}</span>
                      </div>
                    )}
                    {result.estimates.appraisal_fee > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Appraisal fee</span>
                        <span className="font-medium">{formatAmount(result.estimates.appraisal_fee)}</span>
                      </div>
                    )}
                    {result.estimates.total_fees > 0 && (
                      <div className="flex justify-between text-xs pt-1 border-t">
                        <span className="text-muted-foreground font-medium">Total fees</span>
                        <span className="font-medium">{formatAmount(result.estimates.total_fees)}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground pt-1">
                      Rate: {result.product.interest_rate}% {result.product.interest_rate_period} · {result.requested.term_months} months
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
