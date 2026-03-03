import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calculator, ChevronDown, ChevronUp, TrendingDown, Banknote, RefreshCw } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

interface LoanCalculatorProps {
  organizationId: string;
}

interface AmortizationRow {
  period: number;
  openingBalance: number;
  payment: number;
  principal: number;
  interest: number;
  closingBalance: number;
}

function calcReducingBalance(principal: number, periodicRate: number, n: number) {
  if (n <= 0) return { payment: 0, totalInterest: 0, totalRepayment: 0 };
  let payment: number;
  if (periodicRate === 0) {
    payment = principal / n;
  } else {
    payment = (principal * periodicRate * Math.pow(1 + periodicRate, n)) / (Math.pow(1 + periodicRate, n) - 1);
  }
  const totalRepayment = payment * n;
  const totalInterest = totalRepayment - principal;
  return { payment, totalInterest, totalRepayment };
}

function calcFlat(principal: number, periodicRate: number, n: number) {
  if (n <= 0) return { payment: 0, totalInterest: 0, totalRepayment: 0 };
  const totalInterest = principal * periodicRate * n;
  const totalRepayment = principal + totalInterest;
  const payment = totalRepayment / n;
  return { payment, totalInterest, totalRepayment };
}

function buildAmortization(
  principal: number,
  periodicRate: number,
  n: number,
  interestType: string
): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  let balance = principal;

  const { payment } =
    interestType === "flat"
      ? calcFlat(principal, periodicRate, n)
      : calcReducingBalance(principal, periodicRate, n);

  for (let i = 1; i <= n; i++) {
    const interest =
      interestType === "flat"
        ? (principal * periodicRate)
        : balance * periodicRate;
    const principalPart = payment - interest;
    const closing = Math.max(0, balance - principalPart);
    rows.push({
      period: i,
      openingBalance: balance,
      payment,
      principal: principalPart,
      interest,
      closingBalance: i === n ? 0 : closing,
    });
    balance = closing;
  }
  return rows;
}

function getPeriodicRate(annualRate: number, frequency: string): number {
  const r = annualRate / 100;
  switch (frequency) {
    case "weekly":   return r / 52;
    case "fortnightly": return r / 26;
    case "quarterly": return r / 4;
    case "annual":   return r;
    default:         return r / 12;
  }
}

function frequencyLabel(f: string) {
  return { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" }[f] ?? f;
}

export default function LoanCalculator({ organizationId }: LoanCalculatorProps) {
  const { symbol, formatAmount } = useCurrency(organizationId);

  const [amount, setAmount] = useState("100000");
  const [rate, setRate] = useState("18");
  const [term, setTerm] = useState("12");
  const [interestType, setInterestType] = useState("reducing_balance");
  const [frequency, setFrequency] = useState("monthly");
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("none");

  const { data: productsData } = useQuery<any>({
    queryKey: ["/api/organizations", organizationId, "loan-products"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/loan-products`, { credentials: "include" });
      if (!res.ok) return { products: [] };
      return res.json();
    },
  });

  const products: any[] = productsData?.products ?? productsData ?? [];

  function loadProduct(productId: string) {
    setSelectedProduct(productId);
    if (productId === "none") return;
    const p = products.find((p: any) => p.id === productId);
    if (!p) return;
    if (p.min_amount) setAmount(String(p.min_amount));
    if (p.interest_rate) setRate(String(p.interest_rate));
    if (p.default_term_months || p.min_term_months) setTerm(String(p.default_term_months ?? p.min_term_months));
    if (p.interest_type) setInterestType(p.interest_type);
    if (p.repayment_frequency) setFrequency(p.repayment_frequency);
  }

  const result = useMemo(() => {
    const P = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    const n = parseInt(term) || 0;
    if (P <= 0 || n <= 0) return null;

    const periodicRate = getPeriodicRate(r, frequency);
    const calc =
      interestType === "flat"
        ? calcFlat(P, periodicRate, n)
        : calcReducingBalance(P, periodicRate, n);

    return { ...calc, periodicRate, n, P };
  }, [amount, rate, term, interestType, frequency]);

  const schedule = useMemo(() => {
    if (!result) return [];
    return buildAmortization(result.P, result.periodicRate, result.n, interestType);
  }, [result, interestType]);

  const fmt = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const freqWord = frequencyLabel(frequency).toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Loan Calculator</h2>
          <p className="text-muted-foreground">Estimate repayments and view full amortization schedule</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loan Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {products.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Load from Product</Label>
                  <Select value={selectedProduct} onValueChange={loadProduct}>
                    <SelectTrigger data-testid="select-product">
                      <SelectValue placeholder="Select a product..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Manual entry —</SelectItem>
                      {products.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="amount">Loan Amount ({symbol})</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  data-testid="input-amount"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rate">Annual Interest Rate (%)</Label>
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  step="0.1"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                  data-testid="input-rate"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="term">Term (months)</Label>
                <Input
                  id="term"
                  type="number"
                  min="1"
                  value={term}
                  onChange={e => setTerm(e.target.value)}
                  data-testid="input-term"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Interest Type</Label>
                <Select value={interestType} onValueChange={setInterestType}>
                  <SelectTrigger data-testid="select-interest-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                    <SelectItem value="flat">Flat Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Repayment Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => { setAmount("100000"); setRate("18"); setTerm("12"); setInterestType("reducing_balance"); setFrequency("monthly"); setSelectedProduct("none"); }}
                data-testid="button-reset"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-primary/20">
                  <CardContent className="pt-6 text-center">
                    <div className="text-sm text-muted-foreground mb-1 capitalize">{freqWord} Payment</div>
                    <div className="text-2xl font-bold text-primary" data-testid="text-periodic-payment">
                      {symbol} {fmt(result.payment)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{result.n} instalments</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-sm text-muted-foreground mb-1">Total Interest</div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-total-interest">
                      {symbol} {fmt(result.totalInterest)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {result.P > 0 ? ((result.totalInterest / result.P) * 100).toFixed(1) : 0}% of principal
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-sm text-muted-foreground mb-1">Total Repayment</div>
                    <div className="text-2xl font-bold" data-testid="text-total-repayment">
                      {symbol} {fmt(result.totalRepayment)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Principal + Interest</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="pt-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Principal</div>
                      <div className="font-medium">{symbol} {fmt(result.P)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Interest Type</div>
                      <div className="font-medium capitalize">{interestType === "flat" ? "Flat Rate" : "Reducing Balance"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Annual Rate</div>
                      <div className="font-medium">{rate}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Frequency</div>
                      <div className="font-medium">{frequencyLabel(frequency)}</div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Amortization Schedule</span>
                      <Badge variant="outline" className="text-xs">{schedule.length} periods</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSchedule(v => !v)}
                      data-testid="button-toggle-schedule"
                    >
                      {showSchedule ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {showSchedule ? "Hide" : "Show"}
                    </Button>
                  </div>

                  {showSchedule && (
                    <div className="mt-4 overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center w-12">#</TableHead>
                            <TableHead className="text-right">Opening Balance</TableHead>
                            <TableHead className="text-right">Payment</TableHead>
                            <TableHead className="text-right">Principal</TableHead>
                            <TableHead className="text-right">Interest</TableHead>
                            <TableHead className="text-right">Closing Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schedule.map(row => (
                            <TableRow key={row.period} data-testid={`row-schedule-${row.period}`}>
                              <TableCell className="text-center text-muted-foreground text-sm">{row.period}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{fmt(row.openingBalance)}</TableCell>
                              <TableCell className="text-right font-mono text-sm font-medium">{fmt(row.payment)}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-blue-600 dark:text-blue-400">{fmt(row.principal)}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-amber-600 dark:text-amber-400">{fmt(row.interest)}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{fmt(row.closingBalance)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-medium">
                            <TableCell className="text-center text-sm">Σ</TableCell>
                            <TableCell />
                            <TableCell className="text-right font-mono text-sm">{fmt(result.totalRepayment)}</TableCell>
                            <TableCell className="text-right font-mono text-sm text-blue-600 dark:text-blue-400">{fmt(result.P)}</TableCell>
                            <TableCell className="text-right font-mono text-sm text-amber-600 dark:text-amber-400">{fmt(result.totalInterest)}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="flex items-center justify-center h-48">
              <div className="text-center text-muted-foreground">
                <Banknote className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Enter loan details on the left to see results</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
