import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/hooks/use-currency";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { ArrowDownLeft, ArrowUpRight, Plus, Wallet, AlertCircle, ChevronsUpDown, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useFeatures } from "@/hooks/use-features";

interface Branch {
  id: string;
  name: string;
  is_active: boolean;
}

interface TransactionsProps {
  organizationId: string;
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
}

interface Member {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  id_number?: string;
  savings_balance: number;
  shares_balance: number;
  deposits_balance: number;
}

const transactionSchema = z.object({
  member_id: z.string().min(1, "Member is required"),
  transaction_type: z.enum(["deposit", "withdrawal", "transfer", "fee", "interest"]),
  account_type: z.enum(["savings", "shares", "deposits"]),
  amount: z.string().min(1, "Amount is required"),
  payment_method: z.string().optional(),
  reference: z.string().optional(),
  description: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export default function Transactions({ organizationId }: TransactionsProps) {
  const { toast } = useToast();
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const [showDialog, setShowDialog] = useState(false);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.TRANSACTIONS);
  const { user } = useAuth();
  const { hasFeature } = useFeatures(organizationId);
  const hasMpesa = hasFeature("mpesa_integration");
  const hasBankIntegration = hasFeature("bank_integration");
  const [stkPolling, setStkPolling] = useState<{
    checkoutRequestId: string;
  } | null>(null);
  const [stkPollCount, setStkPollCount] = useState(0);
  const maxPollAttempts = 24;

  useEffect(() => {
    if (!stkPolling) return;
    if (stkPollCount >= maxPollAttempts) {
      toast({
        title: "M-Pesa Payment Status Unknown",
        description: "Could not confirm payment status. If the payment was made, it will be credited shortly.",
        variant: "destructive",
      });
      setStkPolling(null);
      setStkPollCount(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/organizations/${organizationId}/mpesa/stk-query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            checkout_request_id: stkPolling.checkoutRequestId,
          }),
        });
        const result = await res.json();

        if (result.status === "credited" || result.status === "already_credited") {
          toast({
            title: "M-Pesa Payment Confirmed",
            description: result.message || "Deposit has been credited to the member's account.",
          });
          setStkPolling(null);
          setStkPollCount(0);
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "transactions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
        } else if (result.status === "cancelled" || result.status === "failed" || result.status === "timeout") {
          toast({
            title: "M-Pesa Payment Not Completed",
            description: result.message || "The payment was not completed.",
            variant: "destructive",
          });
          setStkPolling(null);
          setStkPollCount(0);
        } else {
          setStkPollCount(prev => prev + 1);
        }
      } catch {
        setStkPollCount(prev => prev + 1);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [stkPolling, stkPollCount, organizationId, toast]);

  const userBranchId = (user as any)?.branchId;
  const userRole = (user as any)?.role;
  const canSeeAllBranches = !userBranchId || userRole === 'admin' || userRole === 'owner';

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/organizations", organizationId, "branches"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/branches`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  useEffect(() => {
    if (branches && branches.length === 1) {
      setBranchFilter(branches[0].id);
    }
  }, [branches]);

  interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }

  const { data: paginatedData, isLoading, isError } = useQuery<PaginatedResponse<Transaction>>({
    queryKey: ["/api/organizations", organizationId, "transactions", branchFilter, startDate, endDate, currentPage, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter && branchFilter !== "all") {
        params.append("branch_id", branchFilter);
      }
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      params.append("page", currentPage.toString());
      params.append("page_size", pageSize.toString());
      const url = `/api/organizations/${organizationId}/transactions?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  const transactions = paginatedData?.items;

  const { data: members } = useQuery<Member[]>({
    queryKey: ["/api/organizations", organizationId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      member_id: "",
      transaction_type: "deposit",
      account_type: "savings",
      amount: "",
      payment_method: "cash",
      reference: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const res = await fetch(`/api/organizations/${organizationId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, amount: parseFloat(data.amount) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to record transaction" }));
        throw new Error(err.detail || "Failed to record transaction");
      }
      return res.json();
    },
    onSuccess: (result: any) => {
      if (result?.stk_push) {
        setShowDialog(false);
        form.reset();
        toast({
          title: "STK Push Sent",
          description: "Please check the member's phone to approve the payment. Verifying payment status...",
        });
        if (result.checkout_request_id) {
          setStkPollCount(0);
          setStkPolling({
            checkoutRequestId: result.checkout_request_id,
          });
        }
      } else {
        setCurrentPage(1);
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
        setShowDialog(false);
        form.reset();
        toast({ title: "Transaction recorded successfully" });
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to record transaction", variant: "destructive" });
    },
  });

  const getMemberName = (memberId: string) => {
    const member = members?.find(m => m.id === memberId);
    return member ? `${member.first_name} ${member.last_name}` : "Unknown";
  };

  const getTransactionIcon = (type: string) => {
    if (type === "deposit" || type === "interest") {
      return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
    }
    return <ArrowUpRight className="h-4 w-4 text-red-600" />;
  };

  const formatCurrency = (amount: number) => {
    return `${symbol} ${(amount ?? 0).toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" data-testid="text-transactions-title">Transactions</h1>
          <p className="text-muted-foreground">Record deposits, withdrawals, and transfers</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {canWrite && (
            <Button onClick={() => setShowDialog(true)} data-testid="button-add-transaction" className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">New Transaction</span>
              <span className="sm:hidden">New</span>
            </Button>
          )}
        </div>
      </div>

      {stkPolling && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100" data-testid="text-stk-polling-status">
                Verifying M-Pesa payment... ({stkPollCount + 1}/{maxPollAttempts})
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Waiting for payment confirmation from Safaricom
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStkPolling(null); setStkPollCount(0); }}
              className="shrink-0 text-blue-600 dark:text-blue-400"
              data-testid="button-cancel-stk-polling"
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {canSeeAllBranches && branches && branches.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Branch</span>
            <Select value={branchFilter} onValueChange={(v) => { setBranchFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">From</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="w-[160px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">To</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="w-[160px]"
          />
        </div>
        {(startDate || endDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setCurrentPage(1); }}>
            Clear dates
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            {paginatedData ? `${paginatedData.total} transactions found` : "All financial transactions across member accounts"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-medium">Failed to load transactions</h3>
              <p className="text-sm text-muted-foreground">Please try again later</p>
            </div>
          ) : transactions && transactions.length > 0 ? (
            <>
            <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Transaction #</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Balance After</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id} data-testid={`row-transaction-${txn.id}`}>
                    <TableCell className="font-mono text-sm hidden sm:table-cell">{txn.transaction_number}</TableCell>
                    <TableCell>
                      <div>{getMemberName(txn.member_id)}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{new Date(txn.created_at).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(txn.transaction_type)}
                        <span className="capitalize">{txn.transaction_type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="capitalize">{txn.account_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(txn.amount)}
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell">
                      {formatCurrency(txn.balance_after)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{new Date(txn.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            {paginatedData && paginatedData.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, paginatedData.total)} of {paginatedData.total}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="text-sm px-3">
                    Page {currentPage} of {paginatedData.total_pages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= paginatedData.total_pages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">No transactions yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Record your first transaction to get started
              </p>
              {canWrite && (
                <Button onClick={() => setShowDialog(true)} data-testid="button-add-first-transaction">
                  <Plus className="mr-2 h-4 w-4" />
                  New Transaction
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Transaction</DialogTitle>
            <DialogDescription>Record a deposit, withdrawal, or transfer</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="member_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Member</FormLabel>
                    <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            data-testid="select-member"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? (() => {
                                  const member = members?.find((m) => m.id === field.value);
                                  return member
                                    ? `${member.member_number} - ${member.first_name} ${member.last_name}`
                                    : "Select member...";
                                })()
                              : "Search and select member..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by name, member number, ID number, phone or email..." />
                          <CommandList>
                            <CommandEmpty>No member found.</CommandEmpty>
                            <CommandGroup>
                              {members?.map((member) => (
                                <CommandItem
                                  key={member.id}
                                  value={`${member.member_number} ${member.first_name} ${member.last_name} ${member.phone || ""} ${member.email || ""} ${member.id_number || ""}`}
                                  onSelect={() => {
                                    field.onChange(member.id);
                                    setMemberSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      member.id === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{member.member_number} - {member.first_name} {member.last_name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {member.phone || member.email || "No contact"}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="transaction_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-txn-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="deposit">Deposit</SelectItem>
                          <SelectItem value="withdrawal">Withdrawal</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                          <SelectItem value="fee">Fee</SelectItem>
                          <SelectItem value="interest">Interest</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="account_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-account-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="savings">Savings</SelectItem>
                          <SelectItem value="shares">Shares</SelectItem>
                          <SelectItem value="deposits">Deposits</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-method">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          {hasMpesa && <SelectItem value="mpesa">M-Pesa</SelectItem>}
                          {hasBankIntegration && <SelectItem value="bank">Bank Transfer</SelectItem>}
                          <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Transaction ref" data-testid="input-reference" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Optional notes" data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-transaction">
                  {createMutation.isPending ? "Recording..." : "Record Transaction"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
