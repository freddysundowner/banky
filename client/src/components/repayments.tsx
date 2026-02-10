import { useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Receipt, Plus, Calendar, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useFeatures } from "@/hooks/use-features";

interface RepaymentsProps {
  organizationId: string;
}

interface Repayment {
  id: string;
  repayment_number: string;
  loan_id: string;
  amount: number;
  principal_amount: number;
  interest_amount: number;
  penalty_amount: number;
  payment_method?: string;
  reference?: string;
  notes?: string;
  payment_date: string;
}

interface LoanApplication {
  id: string;
  application_number: string;
  member_id: string;
  amount: number;
  outstanding_balance: number;
  status: string;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  member_number?: string;
  id_number?: string;
  phone?: string;
  email?: string;
}

const phoneRegex = /^(\+254|0)[17]\d{8}$/;

const repaymentSchema = z.object({
  loan_id: z.string().min(1, "Loan is required"),
  amount: z.string().min(1, "Amount is required"),
  payment_method: z.string().optional(),
  mpesa_phone: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.payment_method === "mpesa") {
    if (!data.mpesa_phone || data.mpesa_phone.trim() === "") {
      return false;
    }
    return phoneRegex.test(data.mpesa_phone.replace(/\s/g, ""));
  }
  return true;
}, {
  message: "Valid M-Pesa phone number is required (e.g., 0712345678)",
  path: ["mpesa_phone"],
});

type RepaymentFormData = z.infer<typeof repaymentSchema>;

export default function Repayments({ organizationId }: RepaymentsProps) {
  const { toast } = useToast();
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const [showDialog, setShowDialog] = useState(false);
  const [loanSearchOpen, setLoanSearchOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.REPAYMENTS);
  const { hasFeature } = useFeatures(organizationId);
  const hasMpesa = hasFeature("mpesa_integration");
  const hasBankIntegration = hasFeature("bank_integration");

  interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }

  const { data: paginatedData, isLoading, isError } = useQuery<PaginatedResponse<Repayment>>({
    queryKey: ["/api/organizations", organizationId, "repayments", startDate, endDate, currentPage, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      params.append("page", currentPage.toString());
      params.append("page_size", pageSize.toString());
      const url = `/api/organizations/${organizationId}/repayments?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch repayments");
      return res.json();
    },
  });

  const repayments = paginatedData?.items;

  const { data: loans } = useQuery<LoanApplication[]>({
    queryKey: ["/api/organizations", organizationId, "loan-applications", "active"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/loan-applications?status=disbursed`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch loans");
      return res.json();
    },
  });

  const { data: members } = useQuery<Member[]>({
    queryKey: ["/api/organizations", organizationId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const form = useForm<RepaymentFormData>({
    resolver: zodResolver(repaymentSchema),
    defaultValues: {
      loan_id: "",
      amount: "",
      payment_method: "cash",
      mpesa_phone: "",
      reference: "",
      notes: "",
    },
  });
  
  const selectedPaymentMethod = form.watch("payment_method");

  const stkPushMutation = useMutation({
    mutationFn: async (data: { phone: string; amount: number; account_reference: string; description: string; loan_id?: string }) => {
      const res = await apiRequest("POST", `/api/organizations/${organizationId}/mpesa/stk-push`, data);
      return res.json();
    },
    onSuccess: (result: any) => {
      if (result.success) {
        toast({ title: "M-Pesa prompt sent! Please check your phone to complete payment." });
      } else {
        toast({ title: result.message || "Failed to send M-Pesa prompt", variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to initiate M-Pesa payment", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RepaymentFormData) => {
      if (data.payment_method === "mpesa" && data.mpesa_phone) {
        const selectedLoan = loans?.find(l => l.id === data.loan_id);
        const member = selectedLoan ? members?.find(m => m.id === selectedLoan.member_id) : null;
        const accountRef = selectedLoan?.application_number || "Payment";
        
        await stkPushMutation.mutateAsync({
          phone: data.mpesa_phone,
          amount: parseFloat(data.amount),
          account_reference: accountRef,
          description: `Loan repayment for ${member?.first_name || "Member"}`,
          loan_id: data.loan_id
        });
      }
      
      return apiRequest("POST", `/api/organizations/${organizationId}/repayments`, {
        ...data,
        amount: parseFloat(data.amount),
      });
    },
    onSuccess: () => {
      setCurrentPage(1);
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "repayments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-applications"] });
      setShowDialog(false);
      form.reset();
      toast({ title: "Repayment recorded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to record repayment", variant: "destructive" });
    },
  });

  const getLoanDisplay = (loanId: string) => {
    const loan = loans?.find(l => l.id === loanId);
    if (!loan) return "Unknown Loan";
    const member = members?.find(m => m.id === loan.member_id);
    const memberName = member ? `${member.first_name} ${member.last_name}` : "Unknown";
    return `${loan.application_number} - ${memberName}`;
  };

  const formatCurrency = (amount: number) => {
    return `${symbol} ${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" data-testid="text-repayments-title">Loan Repayments</h1>
          <p className="text-muted-foreground">Record and track loan payments</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {canWrite && (
            <Button onClick={() => setShowDialog(true)} data-testid="button-add-repayment" className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Record Payment</span>
              <span className="sm:hidden">Record</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
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
          <CardTitle>Payment History</CardTitle>
          <CardDescription>
            {paginatedData ? `${paginatedData.total} repayments found` : "All loan repayments recorded"}
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
              <h3 className="font-medium">Failed to load repayments</h3>
              <p className="text-sm text-muted-foreground">Please try again later</p>
            </div>
          ) : repayments && repayments.length > 0 ? (
            <>
            <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Payment #</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Principal</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Interest</TableHead>
                  <TableHead className="hidden lg:table-cell">Method</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repayments.map((payment) => (
                  <TableRow key={payment.id} data-testid={`row-repayment-${payment.id}`}>
                    <TableCell className="font-mono text-sm hidden sm:table-cell">{payment.repayment_number}</TableCell>
                    <TableCell>
                      <div>{getLoanDisplay(payment.loan_id)}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{new Date(payment.payment_date).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      {formatCurrency(payment.principal_amount)}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      {formatCurrency(payment.interest_amount)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="capitalize">{payment.payment_method || "cash"}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
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
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">No repayments yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Record a loan payment to get started
              </p>
              <Button onClick={() => setShowDialog(true)} data-testid="button-add-first-repayment">
                <Plus className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Loan Payment</DialogTitle>
            <DialogDescription>Record a payment against an active loan</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="loan_id"
                render={({ field }) => {
                  const selectedLoan = loans?.find(l => l.id === field.value);
                  const selectedMember = selectedLoan ? members?.find(m => m.id === selectedLoan.member_id) : null;
                  const disbursedLoans = loans?.filter(l => l.status === "disbursed") || [];
                  
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Loan</FormLabel>
                      <Popover open={loanSearchOpen} onOpenChange={setLoanSearchOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={loanSearchOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="select-loan"
                            >
                              {selectedLoan ? (
                                <span className="truncate">
                                  {selectedLoan.application_number} - {selectedMember?.first_name} {selectedMember?.last_name}
                                </span>
                              ) : (
                                "Search by name, member number, or ID..."
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search by name, member number, ID number, phone..." />
                            <CommandList>
                              <CommandEmpty>No loan found.</CommandEmpty>
                              <CommandGroup>
                                {disbursedLoans.map((loan) => {
                                  const member = members?.find(m => m.id === loan.member_id);
                                  const searchText = `${member?.first_name || ""} ${member?.last_name || ""} ${member?.member_number || ""} ${member?.id_number || ""} ${member?.phone || ""} ${loan.application_number}`.toLowerCase();
                                  return (
                                    <CommandItem
                                      key={loan.id}
                                      value={searchText}
                                      onSelect={() => {
                                        field.onChange(loan.id);
                                        setLoanSearchOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === loan.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {member?.first_name} {member?.last_name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {loan.application_number} | {member?.member_number || "No member #"} | Balance: {formatCurrency(loan.outstanding_balance)}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
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
                        <Input {...field} placeholder="Payment ref" data-testid="input-reference" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {selectedPaymentMethod === "mpesa" && (
                <FormField
                  control={form.control}
                  name="mpesa_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>M-Pesa Phone Number</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., 0712345678" 
                          data-testid="input-mpesa-phone"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        An M-Pesa payment prompt will be sent to this number
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Optional notes" data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-repayment">
                  {createMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
