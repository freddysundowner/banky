import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useCurrency } from "@/hooks/use-currency";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Book, FileText, TrendingUp, Scale, Eye } from "lucide-react";

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  current_balance: number;
  is_system: boolean;
  is_active: boolean;
  description?: string;
}

interface LedgerEntry {
  date: string;
  entry_number: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  balance: number;
  memo?: string;
}

interface LedgerData {
  account_id: string;
  account_code: string;
  account_name: string;
  opening_balance: number;
  total_debits: number;
  total_credits: number;
  closing_balance: number;
  entries: LedgerEntry[];
}

interface TrialBalanceEntry {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit_balance: number;
  credit_balance: number;
}

interface TrialBalance {
  as_of_date: string;
  entries: TrialBalanceEntry[];
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
}

interface IncomeStatementEntry {
  account_id: string;
  account_code: string;
  account_name: string;
  amount: number;
}

interface IncomeStatement {
  start_date: string;
  end_date: string;
  income: IncomeStatementEntry[];
  expenses: IncomeStatementEntry[];
  total_income: number;
  total_expenses: number;
  net_income: number;
}

interface BalanceSheetEntry {
  account_id: string;
  account_code: string;
  account_name: string;
  balance: number;
}

interface BalanceSheet {
  as_of_date: string;
  assets: BalanceSheetEntry[];
  liabilities: BalanceSheetEntry[];
  equity: BalanceSheetEntry[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  retained_earnings: number;
}

interface ChartOfAccountsProps {
  organizationId: string;
}

export default function ChartOfAccounts({ organizationId }: ChartOfAccountsProps) {
  const { toast } = useToast();
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.CHART_OF_ACCOUNTS);
  const [activeTab, setActiveTab] = useState("accounts");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  
  const [reportDates, setReportDates] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    asOfDate: new Date().toISOString().split("T")[0],
  });

  const [newAccount, setNewAccount] = useState({
    code: "",
    name: "",
    account_type: "asset",
    description: "",
  });

  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/organizations", organizationId, "accounting", "accounts"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/accounting/accounts`);
      if (!res.ok) throw new Error("Failed to load accounts");
      return res.json();
    },
  });

  const { data: trialBalance, isLoading: trialBalanceLoading } = useQuery<TrialBalance>({
    queryKey: ["/api/organizations", organizationId, "accounting", "trial-balance", reportDates.asOfDate],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/accounting/reports/trial-balance?as_of_date=${reportDates.asOfDate}`);
      if (!res.ok) throw new Error("Failed to load trial balance");
      return res.json();
    },
    enabled: activeTab === "trial-balance",
  });

  const { data: incomeStatement, isLoading: incomeLoading } = useQuery<IncomeStatement>({
    queryKey: ["/api/organizations", organizationId, "accounting", "income-statement", reportDates.startDate, reportDates.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/accounting/reports/income-statement?start_date=${reportDates.startDate}&end_date=${reportDates.endDate}`);
      if (!res.ok) throw new Error("Failed to load income statement");
      return res.json();
    },
    enabled: activeTab === "income-statement",
  });

  const { data: balanceSheet, isLoading: balanceSheetLoading } = useQuery<BalanceSheet>({
    queryKey: ["/api/organizations", organizationId, "accounting", "balance-sheet", reportDates.asOfDate],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/accounting/reports/balance-sheet?as_of_date=${reportDates.asOfDate}`);
      if (!res.ok) throw new Error("Failed to load balance sheet");
      return res.json();
    },
    enabled: activeTab === "balance-sheet",
  });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery<LedgerData>({
    queryKey: ["/api/organizations", organizationId, "accounting", "ledger", selectedAccount?.id],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/accounting/accounts/${selectedAccount?.id}/ledger`);
      if (!res.ok) throw new Error("Failed to load ledger");
      return res.json();
    },
    enabled: !!selectedAccount && showLedgerDialog,
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: typeof newAccount) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/accounting/accounts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "accounting", "accounts"] });
      setShowCreateDialog(false);
      setNewAccount({ code: "", name: "", account_type: "asset", description: "" });
      toast({ title: "Account created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create account", description: error.message, variant: "destructive" });
    },
  });

  const filteredAccounts = accounts?.filter(acc => 
    filterType === "all" || acc.account_type === filterType
  ) || [];

  const accountTypeColors: Record<string, string> = {
    asset: "bg-blue-100 text-blue-800",
    liability: "bg-red-100 text-red-800",
    equity: "bg-purple-100 text-purple-800",
    income: "bg-green-100 text-green-800",
    expense: "bg-orange-100 text-orange-800",
  };

  const { formatAmount: formatCurrency } = useCurrency(organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="Manage your organization's general ledger accounts and view financial reports"
        action={<RefreshButton organizationId={organizationId} />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Trial Balance
          </TabsTrigger>
          <TabsTrigger value="income-statement" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Income Statement
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Balance Sheet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-between items-center">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
                <SelectItem value="liability">Liabilities</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>
{canWrite && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {accountsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead className="hidden md:table-cell">Type</TableHead>
                      <TableHead className="hidden lg:table-cell">Normal Balance</TableHead>
                      <TableHead className="text-right">Current Balance</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono">{account.code}</TableCell>
                        <TableCell className="font-medium">
                          <div>{account.name}</div>
                          <div className="text-xs text-muted-foreground md:hidden">{account.account_type}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge className={accountTypeColors[account.account_type]}>
                            {account.account_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize hidden lg:table-cell">{account.normal_balance}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(account.current_balance || 0)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {account.is_system ? (
                            <Badge variant="secondary">System</Badge>
                          ) : (
                            <Badge variant={account.is_active ? "default" : "outline"}>
                              {account.is_active ? "Active" : "Inactive"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAccount(account);
                              setShowLedgerDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ledger
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial-balance" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Trial Balance</CardTitle>
                <div className="flex items-center gap-2">
                  <Label>As of:</Label>
                  <Input
                    type="date"
                    value={reportDates.asOfDate}
                    onChange={(e) => setReportDates({ ...reportDates, asOfDate: e.target.value })}
                    className="w-40"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trialBalanceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : trialBalance ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialBalance.entries.map((entry) => (
                        <TableRow key={entry.account_id}>
                          <TableCell className="font-mono">{entry.account_code}</TableCell>
                          <TableCell>{entry.account_name}</TableCell>
                          <TableCell>
                            <Badge className={accountTypeColors[entry.account_type]}>
                              {entry.account_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.debit_balance > 0 ? formatCurrency(entry.debit_balance) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.credit_balance > 0 ? formatCurrency(entry.credit_balance) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(trialBalance.total_debits)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(trialBalance.total_credits)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="mt-4 text-center">
                    <Badge variant={trialBalance.is_balanced ? "default" : "destructive"}>
                      {trialBalance.is_balanced ? "Balanced" : "Not Balanced"}
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income-statement" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Income Statement (Profit & Loss)</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label>From:</Label>
                    <Input
                      type="date"
                      value={reportDates.startDate}
                      onChange={(e) => setReportDates({ ...reportDates, startDate: e.target.value })}
                      className="w-40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>To:</Label>
                    <Input
                      type="date"
                      value={reportDates.endDate}
                      onChange={(e) => setReportDates({ ...reportDates, endDate: e.target.value })}
                      className="w-40"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {incomeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : incomeStatement ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-2 text-green-700">Revenue</h3>
                    <Table>
                      <TableBody>
                        {incomeStatement.income.map((entry) => (
                          <TableRow key={entry.account_id}>
                            <TableCell className="font-mono w-24">{entry.account_code}</TableCell>
                            <TableCell>{entry.account_name}</TableCell>
                            <TableCell className="text-right font-mono w-32">
                              {formatCurrency(entry.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-green-50">
                          <TableCell colSpan={2}>Total Revenue</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(incomeStatement.total_income)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2 text-red-700">Expenses</h3>
                    <Table>
                      <TableBody>
                        {incomeStatement.expenses.map((entry) => (
                          <TableRow key={entry.account_id}>
                            <TableCell className="font-mono w-24">{entry.account_code}</TableCell>
                            <TableCell>{entry.account_name}</TableCell>
                            <TableCell className="text-right font-mono w-32">
                              {formatCurrency(entry.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-red-50">
                          <TableCell colSpan={2}>Total Expenses</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(incomeStatement.total_expenses)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <Card className={incomeStatement.net_income >= 0 ? "bg-green-50" : "bg-red-50"}>
                    <CardContent className="py-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">Net Income</span>
                        <span className={`font-bold text-2xl font-mono ${incomeStatement.net_income >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {formatCurrency(incomeStatement.net_income)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Balance Sheet</CardTitle>
                <div className="flex items-center gap-2">
                  <Label>As of:</Label>
                  <Input
                    type="date"
                    value={reportDates.asOfDate}
                    onChange={(e) => setReportDates({ ...reportDates, asOfDate: e.target.value })}
                    className="w-40"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {balanceSheetLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : balanceSheet ? (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-blue-700">Assets</h3>
                      <Table>
                        <TableBody>
                          {balanceSheet.assets.map((entry) => (
                            <TableRow key={entry.account_id}>
                              <TableCell className="font-mono w-20">{entry.account_code}</TableCell>
                              <TableCell>{entry.account_name}</TableCell>
                              <TableCell className="text-right font-mono w-28">
                                {formatCurrency(entry.balance)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-bold bg-blue-50">
                            <TableCell colSpan={2}>Total Assets</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(balanceSheet.total_assets)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-red-700">Liabilities</h3>
                      <Table>
                        <TableBody>
                          {balanceSheet.liabilities.map((entry) => (
                            <TableRow key={entry.account_id}>
                              <TableCell className="font-mono w-20">{entry.account_code}</TableCell>
                              <TableCell>{entry.account_name}</TableCell>
                              <TableCell className="text-right font-mono w-28">
                                {formatCurrency(entry.balance)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-bold bg-red-50">
                            <TableCell colSpan={2}>Total Liabilities</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(balanceSheet.total_liabilities)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-purple-700">Equity</h3>
                      <Table>
                        <TableBody>
                          {balanceSheet.equity.map((entry) => (
                            <TableRow key={entry.account_id}>
                              <TableCell className="font-mono w-20">{entry.account_code}</TableCell>
                              <TableCell>{entry.account_name}</TableCell>
                              <TableCell className="text-right font-mono w-28">
                                {formatCurrency(entry.balance)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell className="font-mono">-</TableCell>
                            <TableCell>Retained Earnings</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(balanceSheet.retained_earnings)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-bold bg-purple-50">
                            <TableCell colSpan={2}>Total Equity</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(balanceSheet.total_equity + balanceSheet.retained_earnings)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Code</Label>
                <Input
                  value={newAccount.code}
                  onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                  placeholder="e.g., 1050"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  value={newAccount.account_type}
                  onValueChange={(value) => setNewAccount({ ...newAccount, account_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                placeholder="e.g., Petty Cash"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={newAccount.description}
                onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                placeholder="Description of this account"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createAccountMutation.mutate(newAccount)}
              disabled={createAccountMutation.isPending || !newAccount.code || !newAccount.name}
            >
              {createAccountMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Account Ledger: {selectedAccount?.code} - {selectedAccount?.name}
            </DialogTitle>
          </DialogHeader>
          {ledgerLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : ledgerData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Opening Balance</div>
                    <div className="text-lg font-bold">{formatCurrency(ledgerData.opening_balance)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Debits</div>
                    <div className="text-lg font-bold text-blue-600">{formatCurrency(ledgerData.total_debits)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Credits</div>
                    <div className="text-lg font-bold text-green-600">{formatCurrency(ledgerData.total_credits)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Closing Balance</div>
                    <div className="text-lg font-bold">{formatCurrency(ledgerData.closing_balance)}</div>
                  </CardContent>
                </Card>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entry #</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerData.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledgerData.entries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono">{entry.entry_number}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(entry.balance)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No ledger data available</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
