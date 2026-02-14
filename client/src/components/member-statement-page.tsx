import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

interface Member {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  savings_balance?: number;
  shares_balance?: number;
  deposits_balance?: number;
  branch_id?: string;
  branch_name?: string;
}

interface Transaction {
  id: string;
  transaction_number: string;
  member_id: string;
  transaction_type: string;
  account_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  payment_method?: string;
  reference?: string;
  description?: string;
  created_at: string;
  branch_name?: string;
}

interface FixedDeposit {
  deposit_number: string;
  product_name: string;
  principal_amount: number;
  interest_rate: number;
  term_months: number;
  start_date: string;
  maturity_date: string;
  expected_interest: number;
  maturity_amount: number;
  status: string;
  early_withdrawal: boolean;
  penalty_amount: number;
}

interface MemberStatementPageProps {
  organizationId: string;
  memberId: string;
  onBack: () => void;
}

export default function MemberStatementPage({ organizationId, memberId, onBack }: MemberStatementPageProps) {
  const { symbol } = useCurrency(organizationId);
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: member, isLoading: memberLoading } = useQuery<Member>({
    queryKey: ["/api/organizations", organizationId, "members", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/members/${memberId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load member");
      return res.json();
    },
  });

  const { data: transactions, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/organizations", organizationId, "transactions", "member", memberId, accountFilter],
    queryFn: async () => {
      let url = `/api/organizations/${organizationId}/transactions?member_id=${memberId}`;
      if (accountFilter !== "all") {
        url += `&account_type=${accountFilter}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: fixedDeposits = [], isLoading: fdLoading } = useQuery<FixedDeposit[]>({
    queryKey: ["/api/organizations", organizationId, "fixed-deposits", "member", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/fixed-deposits?member_id=${memberId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const formatTxType = (type: string) => {
    const labels: Record<string, string> = {
      deposit: "Deposit",
      withdrawal: "Withdrawal",
      transfer: "Transfer",
      loan_disbursement: "Loan Disbursement",
      loan_repayment: "Loan Repayment",
      penalty_charge: "Late Penalty",
      auto_deduction: "Auto Deduction",
      interest_posting: "Interest Posting",
      dividend_payment: "Dividend Payment",
      share_purchase: "Share Purchase",
      share_sale: "Share Sale",
      fixed_deposit: "Fixed Deposit",
      fd_withdrawal: "FD Withdrawal",
      fd_interest: "FD Interest",
    };
    return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const getTxBadgeVariant = (type: string): "default" | "destructive" | "secondary" | "outline" => {
    if (type === "deposit" || type === "loan_disbursement" || type === "dividend_payment" || type === "fd_interest" || type === "interest_posting") return "default";
    if (type === "penalty_charge") return "destructive";
    if (type === "withdrawal" || type === "loan_repayment" || type === "auto_deduction") return "secondary";
    return "outline";
  };

  const filteredTransactions = transactions?.filter(tx => {
    if (startDate && new Date(tx.created_at) < new Date(startDate)) return false;
    if (endDate && new Date(tx.created_at) > new Date(endDate + "T23:59:59")) return false;
    return true;
  }) || [];

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0; color: #666; }
        .balances { display: flex; gap: 20px; margin-bottom: 20px; }
        .balance-box { flex: 1; padding: 10px; border: 1px solid #ddd; text-align: center; }
        .balance-box .label { font-size: 12px; color: #666; }
        .balance-box .amount { font-size: 18px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .deposit { color: green; }
        .withdrawal, .penalty_charge { color: red; }
        .loan_repayment { color: #2563eb; }
        .loan_disbursement { color: #7c3aed; }
        .transfer { color: #d97706; }
        .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Account Statement - ${member?.first_name} ${member?.last_name}</title>
          ${styles}
        </head>
        <body>
          <div class="header">
            <h1>Account Statement</h1>
            <p><strong>${member?.first_name} ${member?.last_name}</strong></p>
            <p>Member No: ${member?.member_number}</p>
            ${member?.branch_name ? `<p>Branch: ${member?.branch_name}</p>` : ''}
            <p>Generated: ${new Date().toLocaleDateString()}</p>
            ${accountFilter !== 'all' ? `<p>Account: ${accountFilter.toUpperCase()}</p>` : ''}
            ${startDate || endDate ? `<p>Period: ${startDate || 'Start'} to ${endDate || 'Present'}</p>` : ''}
          </div>

          <div class="balances">
            <div class="balance-box">
              <div class="label">Savings Balance</div>
              <div class="amount">${symbol} ${(member?.savings_balance || 0).toLocaleString()}</div>
            </div>
            <div class="balance-box">
              <div class="label">Shares Balance</div>
              <div class="amount">${symbol} ${(member?.shares_balance || 0).toLocaleString()}</div>
            </div>
            <div class="balance-box">
              <div class="label">Deposits Balance</div>
              <div class="amount">${symbol} ${(member?.deposits_balance || 0).toLocaleString()}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Tx No.</th>
                <th>Type</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Balance After</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.map(tx => `
                <tr>
                  <td>${new Date(tx.created_at).toLocaleDateString()}</td>
                  <td>${tx.transaction_number}</td>
                  <td class="${tx.transaction_type}">${formatTxType(tx.transaction_type)}</td>
                  <td>${tx.account_type}</td>
                  <td class="${tx.transaction_type}">${symbol} ${Number(tx.amount).toLocaleString()}</td>
                  <td>${symbol} ${Number(tx.balance_after).toLocaleString()}</td>
                  <td>${tx.reference || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>Total Transactions: ${filteredTransactions.length}</p>
            <p>This is a computer-generated statement.</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (memberLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Account Statement</h1>
            <p className="text-muted-foreground">
              {member?.first_name} {member?.last_name} ({member?.member_number})
            </p>
          </div>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Statement
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-sm text-muted-foreground">Savings</div>
            <div className="text-xl font-bold">{symbol} {(member?.savings_balance || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-sm text-muted-foreground">Shares</div>
            <div className="text-xl font-bold">{symbol} {(member?.shares_balance || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-sm text-muted-foreground">Deposits</div>
            <div className="text-xl font-bold">{symbol} {(member?.deposits_balance || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transactions
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">From:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-36"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">To:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-36"
                />
              </div>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Account Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="shares">Shares</SelectItem>
                  <SelectItem value="deposits">Deposits</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent ref={printRef}>
          {txLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTransactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Tx No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{tx.transaction_number}</TableCell>
                    <TableCell>
                      <Badge variant={getTxBadgeVariant(tx.transaction_type)}>
                        {formatTxType(tx.transaction_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{tx.account_type}</TableCell>
                    <TableCell className={`text-right font-medium ${["deposit", "loan_disbursement", "dividend_payment", "fd_interest", "interest_posting"].includes(tx.transaction_type) ? "text-green-600" : "text-red-600"}`}>
                      {["deposit", "loan_disbursement", "dividend_payment", "fd_interest", "interest_posting"].includes(tx.transaction_type) ? "+" : "-"}{symbol} {Number(tx.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{symbol} {Number(tx.balance_after).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.reference || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No transactions found for the selected filters
            </div>
          )}
          
          {filteredTransactions.length > 0 && (
            <div className="mt-4 pt-4 border-t text-sm text-muted-foreground text-center">
              Showing {filteredTransactions.length} transaction(s)
            </div>
          )}
        </CardContent>
      </Card>

      {fixedDeposits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Fixed Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deposit #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Maturity Date</TableHead>
                  <TableHead className="text-right">Maturity Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixedDeposits.map((fd) => (
                  <TableRow key={fd.deposit_number}>
                    <TableCell className="font-mono text-sm">{fd.deposit_number}</TableCell>
                    <TableCell>{fd.product_name}</TableCell>
                    <TableCell className="text-right">{symbol} {Number(fd.principal_amount).toLocaleString()}</TableCell>
                    <TableCell>{fd.interest_rate}%</TableCell>
                    <TableCell>{fd.term_months} months</TableCell>
                    <TableCell>{new Date(fd.maturity_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{symbol} {Number(fd.maturity_amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={fd.status === "active" ? "default" : fd.status === "closed" ? "secondary" : "outline"}>
                        {fd.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
