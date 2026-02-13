import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getErrorMessage } from "@/lib/error-utils";
import { FileText, Plus, Check, X, Banknote, Eye, ArrowLeft, Pencil, Download, ChevronLeft, ChevronRight, ChevronsUpDown, AlertTriangle, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { LoanApplication, LoanProduct, Member } from "@shared/tenant-types";
import Guarantors from "./guarantors";
import LoanRestructuring from "./loan-restructuring";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useFeatures } from "@/hooks/use-features";

interface Branch {
  id: string;
  name: string;
  is_active: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Loan detail error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <p className="text-red-600 mb-2">Something went wrong loading loan details.</p>
          <p className="text-sm text-muted-foreground mb-4">{this.state.error?.message}</p>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>Try Again</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const formatPercent = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "0%";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0%";
  return num % 1 === 0 ? `${num}%` : `${parseFloat(num.toFixed(2))}%`;
};

interface ScheduleItem {
  installment_number: number;
  due_date: string;
  principal: number;
  interest: number;
  total_payment: number;
  balance_after: number;
  paid_principal?: number;
  paid_interest?: number;
  paid_penalty?: number;
  status?: string;
}

interface LoanSummary {
  total_expected: number;
  total_paid: number;
  total_paid_principal: number;
  total_paid_interest: number;
  total_paid_penalty: number;
  outstanding_balance: number;
  amount_overdue: number;
  overdue_count: number;
  next_due_amount: number | null;
  next_due_date: string | null;
}

interface LoanScheduleData {
  loan_id: string;
  application_number: string;
  amount: number;
  term_months: number;
  interest_rate: number;
  monthly_payment: number;
  interest_deducted_upfront?: boolean;
  summary: LoanSummary;
  schedule: ScheduleItem[];
}

function LoanSchedule({ organizationId, loanId }: { organizationId: string; loanId: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  
  const { data, isLoading, error } = useQuery<LoanScheduleData>({
    queryKey: ["/api/organizations", organizationId, "loans", loanId, "schedule"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/loans/${loanId}/schedule`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
  });

  const formatCurrency = (amount: number) => `${symbol} ${amount.toLocaleString()}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const downloadScheduleCSV = () => {
    if (!data) return;
    const headers = ["Instalment", "Due Date", "Principal", "Interest", "Total", "Balance", "Paid", "Status"];
    const rows = data.schedule.map(item => [
      item.installment_number,
      item.due_date,
      item.principal,
      item.interest,
      item.total_payment,
      item.balance_after,
      (item.paid_principal || 0) + (item.paid_interest || 0) + (item.paid_penalty || 0),
      item.status || "pending"
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan-schedule-${data.application_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <Card><CardContent className="pt-6"><Skeleton className="h-48" /></CardContent></Card>;
  if (error || !data) return <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground">Failed to load schedule</p></CardContent></Card>;

  const totalPages = Math.ceil(data.schedule.length / pageSize);
  const paginatedSchedule = data.schedule.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Repayment Schedule</CardTitle>
          <p className="text-sm text-muted-foreground">
            {data.term_months} instalments of {formatCurrency(data.monthly_payment)} at {data.interest_rate}% per period
            {data.interest_deducted_upfront && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Interest deducted upfront</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadScheduleCSV} data-testid="button-download-schedule">
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSchedule.map((item) => {
                const totalPaid = (item.paid_principal || 0) + (item.paid_interest || 0) + (item.paid_penalty || 0);
                const statusColors: Record<string, string> = {
                  paid: "bg-green-100 text-green-800",
                  partial: "bg-yellow-100 text-yellow-800",
                  overdue: "bg-red-100 text-red-800",
                  pending: "bg-gray-100 text-gray-800",
                };
                return (
                <TableRow key={item.installment_number} data-testid={`row-instalment-${item.installment_number}`}>
                  <TableCell className="font-medium">{item.installment_number}</TableCell>
                  <TableCell>{formatDate(item.due_date)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.principal)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.interest)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.total_payment)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.balance_after)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalPaid)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.status || "pending"] || statusColors.pending}`}>
                      {(item.status || "pending").charAt(0).toUpperCase() + (item.status || "pending").slice(1)}
                    </span>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, data.schedule.length)} of {data.schedule.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="button-schedule-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                data-testid="button-schedule-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RepaymentRecord {
  id: string;
  repayment_number: string;
  loan_id: string;
  amount: number;
  principal_amount: number;
  interest_amount: number;
  penalty_amount: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  payment_date: string;
  created_at: string;
}

function LoanPaymentHistory({ organizationId, loanId, loanData }: { organizationId: string; loanId: string; loanData: any }) {
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const { data: repayments, isLoading: repaymentsLoading } = useQuery<RepaymentRecord[]>({
    queryKey: ["/api/organizations", organizationId, "repayments", { loan_id: loanId }],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/repayments?loan_id=${loanId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch repayments");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.items || []);
    },
  });

  const { data: scheduleData } = useQuery<LoanScheduleData>({
    queryKey: ["/api/organizations", organizationId, "loans", loanId, "schedule"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/loans/${loanId}/schedule`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
  });

  const formatCurrency = (amount: number | string | null | undefined) => {
    const num = typeof amount === "string" ? parseFloat(amount) : (amount || 0);
    return `${symbol} ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const summary = scheduleData?.summary;
  const totalPaid = summary?.total_paid || 0;
  const totalPrincipalPaid = summary?.total_paid_principal || 0;
  const totalInterestPaid = summary?.total_paid_interest || 0;
  const totalPenaltyPaid = summary?.total_paid_penalty || 0;
  const totalToRepay = summary?.total_expected || Number(loanData?.total_repayment || 0);
  const outstandingBalance = summary?.outstanding_balance || 0;
  const amountOverdue = summary?.amount_overdue || 0;
  const overdueCount = summary?.overdue_count || 0;

  const getPaymentMethodLabel = (method: string | null) => {
    const methods: Record<string, string> = {
      cash: "Cash",
      mpesa: "M-Pesa",
      bank_transfer: "Bank Transfer",
      cheque: "Cheque",
    };
    return methods[method || ""] || method || "-";
  };

  if (repaymentsLoading) return <Card><CardContent className="pt-6"><Skeleton className="h-48" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Total Paid</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
            <div className="text-xs text-muted-foreground mt-1">of {formatCurrency(totalToRepay)} total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Outstanding Balance</div>
            <div className="text-xl font-bold">{formatCurrency(outstandingBalance)}</div>
            <div className="text-xs text-muted-foreground mt-1">Remaining to pay</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Amount Overdue</div>
            <div className={`text-xl font-bold ${amountOverdue > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(amountOverdue)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {amountOverdue > 0 ? `${overdueCount} instalment(s) past due` : "All caught up"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Next Due</div>
            <div className="text-xl font-bold">
              {summary?.next_due_amount ? formatCurrency(summary.next_due_amount) : "-"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary?.next_due_date ? formatDate(summary.next_due_date) : "Fully paid"}
            </div>
          </CardContent>
        </Card>
      </div>

      {scheduleData && scheduleData.schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instalment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduleData.schedule.map((item) => {
                    const paidForInstalment = (item.paid_principal || 0) + (item.paid_interest || 0) + (item.paid_penalty || 0);
                    const remainingForInstalment = Math.max(0, item.total_payment - paidForInstalment);
                    const status = item.status || "pending";

                    return (
                      <TableRow key={item.installment_number} className={status === "overdue" ? "bg-red-50 dark:bg-red-950/30" : ""}>
                        <TableCell className="font-medium">{item.installment_number}</TableCell>
                        <TableCell>{formatDate(item.due_date)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_payment)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(paidForInstalment)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(remainingForInstalment)}</TableCell>
                        <TableCell>
                          {status === "paid" ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Paid
                            </Badge>
                          ) : status === "overdue" ? (
                            <Badge variant="destructive">
                              <AlertCircle className="mr-1 h-3 w-3" /> Overdue
                            </Badge>
                          ) : status === "partial" ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800">
                              <Clock className="mr-1 h-3 w-3" /> Partial
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Clock className="mr-1 h-3 w-3" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Transactions ({repayments?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!repayments || repayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments recorded yet</p>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Penalty</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repayments.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.repayment_number}</TableCell>
                      <TableCell>{formatDate(r.payment_date)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{formatCurrency(r.amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.principal_amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.interest_amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.penalty_amount)}</TableCell>
                      <TableCell>{getPaymentMethodLabel(r.payment_method)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.reference || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 pt-4 border-t grid gap-2 sm:grid-cols-4 text-sm">
                <div><span className="text-muted-foreground">Total Paid:</span> <span className="font-medium">{formatCurrency(totalPaid)}</span></div>
                <div><span className="text-muted-foreground">Principal:</span> <span className="font-medium">{formatCurrency(totalPrincipalPaid)}</span></div>
                <div><span className="text-muted-foreground">Interest:</span> <span className="font-medium">{formatCurrency(totalInterestPaid)}</span></div>
                <div><span className="text-muted-foreground">Penalties:</span> <span className="font-medium">{formatCurrency(totalPenaltyPaid)}</span></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface LoanApplicationsProps {
  organizationId: string;
}

const phoneRegex = /^(\+254|0)[17]\d{8}$/;

const applicationSchema = z.object({
  member_id: z.string().min(1, "Member is required"),
  product_id: z.string().min(1, "Loan product is required"),
  amount: z.string().min(1, "Amount is required"),
  term: z.coerce.number().min(1, "Term is required"),
  purpose: z.string().min(1, "Purpose is required"),
  purpose_details: z.string().optional(),
  disbursement_method: z.string().min(1, "Disbursement method is required"),
  disbursement_account: z.string().optional(),
  disbursement_phone: z.string().optional(),
  guarantor_ids: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  if (data.disbursement_method === "mpesa") {
    if (!data.disbursement_phone || data.disbursement_phone.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "M-Pesa phone number is required",
        path: ["disbursement_phone"],
      });
    } else if (!phoneRegex.test(data.disbursement_phone.replace(/\s/g, ""))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid phone number (e.g., 0712345678 or +254712345678)",
        path: ["disbursement_phone"],
      });
    }
  }
  if (data.disbursement_method === "bank_transfer") {
    if (!data.disbursement_account || data.disbursement_account.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bank account number is required",
        path: ["disbursement_account"],
      });
    }
  }
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

const loanPurposes = [
  "Business expansion",
  "Working capital",
  "Asset purchase",
  "Education fees",
  "Medical expenses",
  "Home improvement",
  "Agriculture",
  "Emergency",
  "Debt consolidation",
  "Other",
];

const disbursementMethods = [
  { value: "mpesa", label: "M-Pesa" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash at Branch" },
  { value: "cheque", label: "Cheque" },
];

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  under_review: "outline",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
  pending_disbursement: "outline",
  disbursed: "default",
  completed: "default",
  defaulted: "destructive",
};

type ViewMode = "list" | "new" | "edit" | "view";

export default function LoanApplications({ organizationId }: LoanApplicationsProps) {
  const { toast } = useToast();
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showRejectDialog, setShowRejectDialog] = useState<LoanApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectCategory, setRejectCategory] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState<LoanApplication | null>(null);
  const [approveComments, setApproveComments] = useState("");
  const [approveConditions, setApproveConditions] = useState("");
  const [approveConfirmed, setApproveConfirmed] = useState(false);
  const [showDisburseDialog, setShowDisburseDialog] = useState<LoanApplication | null>(null);
  const [disburseMethod, setDisburseMethod] = useState("");
  const [disburseAccount, setDisburseAccount] = useState("");
  const [disbursePhone, setDisbursePhone] = useState("");
  const [disburseConfirmed, setDisburseConfirmed] = useState(false);
  const [rejectConfirmed, setRejectConfirmed] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.LOANS);
  const { hasFeature } = useFeatures(organizationId);
  const hasMpesa = hasFeature("mpesa_integration");
  const hasBankIntegration = hasFeature("bank_integration");
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [editingLoan, setEditingLoan] = useState<LoanApplication | null>(null);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [guarantorSearchOpen, setGuarantorSearchOpen] = useState(false);
  const [extraCharges, setExtraCharges] = useState<{ charge_name: string; amount: string }[]>([]);
  const { user } = useAuth();

  const userBranchId = (user as any)?.branchId;
  const userRole = (user as any)?.role;
  const canSeeAllBranches = !userBranchId || userRole === 'admin' || userRole === 'owner';

  const isMemberInactive = (member: Member | undefined): boolean => {
    if (!member) return false;
    return !member.is_active || (member.status !== undefined && member.status !== "active");
  };

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

  const { data: applications, isLoading } = useQuery<LoanApplication[]>({
    queryKey: ["/api/organizations", organizationId, "loan-applications", branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter && branchFilter !== "all") {
        params.append("branch_id", branchFilter);
      }
      const url = `/api/organizations/${organizationId}/loan-applications${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch loan applications");
      return res.json();
    },
  });

  const { data: products } = useQuery<LoanProduct[]>({
    queryKey: ["/api/organizations", organizationId, "loan-products", "active"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/loan-products?active=true`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch loan products");
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

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      member_id: "",
      product_id: "",
      amount: "",
      term: 12,
      purpose: "",
      purpose_details: "",
      disbursement_method: "",
      disbursement_account: "",
      disbursement_phone: "",
      guarantor_ids: [],
    },
  });

  const selectedProduct = products?.find((p) => p.id === form.watch("product_id"));

  const createMutation = useMutation({
    mutationFn: async (data: ApplicationFormData) => {
      const selectedMember = members?.find((m) => m.id === data.member_id);
      if (isMemberInactive(selectedMember)) {
        throw new Error("Cannot submit loan application for an inactive member. Please activate the member first.");
      }
      return apiRequest("POST", `/api/organizations/${organizationId}/loan-applications`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-applications"] });
      setViewMode("list");
      form.reset();
      toast({ title: "Loan application submitted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to submit loan application", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, comments, conditions }: { id: string; comments?: string; conditions?: string }) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/loan-applications/${id}/approve`, { comments, conditions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-applications"] });
      setShowApproveDialog(null);
      setApproveComments("");
      setApproveConditions("");
      setApproveConfirmed(false);
      setSelectedLoan(null);
      toast({ title: "Loan application approved successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to approve application", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason, category }: { id: string; reason: string; category?: string }) => {
      const fullReason = category ? `[${category}] ${reason}` : reason;
      return apiRequest("POST", `/api/organizations/${organizationId}/loan-applications/${id}/reject`, { reason: fullReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-applications"] });
      setShowRejectDialog(null);
      setRejectReason("");
      setRejectCategory("");
      setRejectConfirmed(false);
      setSelectedLoan(null);
      toast({ title: "Loan application rejected" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to reject application", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const disburseMutation = useMutation({
    mutationFn: async ({ id, method, account, phone }: { id: string; method: string; account?: string; phone?: string }) => {
      const res = await apiRequest("POST", `/api/organizations/${organizationId}/loan-applications/${id}/disburse`, { 
        disbursement_method: method,
        disbursement_account: account,
        disbursement_phone: phone
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "transactions"] });
      setShowDisburseDialog(null);
      setDisburseMethod("");
      setDisburseAccount("");
      setDisbursePhone("");
      setDisburseConfirmed(false);
      setSelectedLoan(null);
      if (data?.status === "pending_disbursement") {
        toast({ title: "M-Pesa disbursement initiated", description: "The loan will be marked as disbursed once M-Pesa confirms the payment was sent successfully." });
      } else {
        toast({ title: "Loan disbursed successfully" });
      }
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to disburse loan", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PUT", `/api/organizations/${organizationId}/loan-applications/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-applications"] });
      setViewMode("list");
      setEditingLoan(null);
      editForm.reset();
      toast({ title: "Loan application updated and resubmitted" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to update loan application", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const editForm = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      member_id: "",
      product_id: "",
      amount: "",
      term: 12,
      purpose: "",
      purpose_details: "",
      disbursement_method: "",
      disbursement_account: "",
      disbursement_phone: "",
      guarantor_ids: [],
    },
  });

  const selectedEditProduct = products?.find((p) => p.id === editForm.watch("product_id"));

  const handleEditSubmit = (data: ApplicationFormData) => {
    if (!editingLoan) return;
    const selectedMember = members?.find((m) => m.id === editingLoan.member_id);
    if (isMemberInactive(selectedMember)) {
      toast({ 
        title: "Cannot submit loan application", 
        description: "This member is inactive and cannot apply for loans. Please activate the member first.", 
        variant: "destructive" 
      });
      return;
    }
    const fullPurpose = data.purpose === "Other" && data.purpose_details
      ? `Other: ${data.purpose_details}`
      : data.purpose;
    const payload = {
      loan_product_id: data.product_id,
      amount: parseFloat(data.amount),
      term_months: data.term,
      purpose: fullPurpose || null,
      disbursement_method: data.disbursement_method,
      disbursement_account: data.disbursement_account || null,
      disbursement_phone: data.disbursement_phone || null,
    };
    editMutation.mutate({ id: editingLoan.id, data: payload });
  };

  const openEditPage = (app: LoanApplication) => {
    const purpose = app.purpose || "";
    const isPredefinedPurpose = loanPurposes.includes(purpose) || purpose.startsWith("Other:");
    editForm.reset({
      member_id: app.member_id,
      product_id: app.loan_product_id,
      amount: String(parseFloat(app.amount)),
      term: (app as any).term_months || 12,
      purpose: purpose.startsWith("Other:") ? "Other" : (isPredefinedPurpose ? purpose : "Other"),
      purpose_details: purpose.startsWith("Other:") ? purpose.replace("Other: ", "") : (!isPredefinedPurpose ? purpose : ""),
      disbursement_method: (app as any).disbursement_method || "",
      disbursement_account: (app as any).disbursement_account || "",
      disbursement_phone: (app as any).disbursement_phone || "",
      guarantor_ids: [],
    });
    setEditingLoan(app);
    setViewMode("edit");
  };

  const handleSubmit = (data: ApplicationFormData) => {
    const fullPurpose = data.purpose === "Other" && data.purpose_details
      ? `Other: ${data.purpose_details}`
      : data.purpose;
    const validCharges = extraCharges.filter(c => c.charge_name.trim() && parseFloat(c.amount) > 0);
    const payload = {
      member_id: data.member_id,
      loan_product_id: data.product_id,
      amount: parseFloat(data.amount),
      term_months: data.term,
      purpose: fullPurpose || null,
      disbursement_method: data.disbursement_method,
      disbursement_account: data.disbursement_account || null,
      disbursement_phone: data.disbursement_phone || null,
      guarantors: data.guarantor_ids?.map(id => ({ guarantor_id: id, amount_guaranteed: parseFloat(data.amount) })) || [],
      extra_charges: validCharges.map(c => ({ charge_name: c.charge_name.trim(), amount: parseFloat(c.amount) })),
    };
    createMutation.mutate(payload as any);
  };

  const getFreqLabel = (loanOrProduct: any) => {
    const freq = loanOrProduct?.repayment_frequency 
      || (products?.find((p: any) => p.id === (loanOrProduct?.product_id || loanOrProduct?.loan_product_id)) as any)?.repayment_frequency 
      || "monthly";
    const labels: Record<string, { period: string; payment: string }> = {
      daily: { period: "days", payment: "Daily Payment", rateLabel: "per day" },
      weekly: { period: "weeks", payment: "Weekly Payment", rateLabel: "per week" },
      bi_weekly: { period: "bi-weeks", payment: "Bi-Weekly Payment", rateLabel: "per 2 weeks" },
      monthly: { period: "months", payment: "Monthly Payment", rateLabel: "per month" },
    };
    return labels[freq] || labels.monthly;
  };

  if (selectedLoan) {
    const loan = selectedLoan as any;
    const loanFreq = getFreqLabel(selectedLoan);
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return "-";
      try {
        return new Date(dateStr).toLocaleDateString("en-US", { 
          year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        });
      } catch {
        return "-";
      }
    };
    const getDisbursementMethodLabel = (method: string | null | undefined) => {
      const methods: Record<string, string> = {
        mpesa: "M-Pesa",
        bank_transfer: "Bank Transfer",
        cash: "Cash at Branch",
        cheque: "Cheque",
      };
      return methods[method || ""] || method || "-";
    };
    const downloadLoanStatement = (loan: any, selectedLoan: LoanApplication) => {
      try {
        const formatDateSimple = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString() : "-";
        const safeParse = (val: any) => {
          const parsed = parseFloat(String(val || "0"));
          return isNaN(parsed) ? 0 : parsed;
        };
        const lines = [
          "LOAN STATEMENT",
          "",
          `Loan Number: ${selectedLoan.application_number || "-"}`,
          `Member: ${loan.member_first_name || ""} ${loan.member_last_name || ""}`,
          `Member Number: ${loan.member?.member_number || "-"}`,
          `Product: ${loan.product_name || "-"}`,
          "",
          "LOAN DETAILS",
          `Principal Amount: ${symbol} ${safeParse(selectedLoan.amount).toLocaleString()}`,
          `Interest Rate: ${selectedLoan.interest_rate || 0}% p.a.`,
          `Term: ${selectedLoan.term_months || 0} ${loanFreq.period}`,
          `${loanFreq.payment}: ${symbol} ${safeParse(selectedLoan.monthly_repayment).toLocaleString()}`,
          `Total Interest: ${symbol} ${safeParse(selectedLoan.total_interest).toLocaleString()}`,
          `Total Repayment: ${symbol} ${safeParse(selectedLoan.total_repayment).toLocaleString()}`,
          "",
          "STATUS",
          `Status: ${selectedLoan.status || "-"}`,
          `Applied: ${formatDateSimple(loan.applied_at || loan.created_at)}`,
          loan.approved_at ? `Approved: ${formatDateSimple(loan.approved_at)}` : null,
          loan.disbursed_at ? `Disbursed: ${formatDateSimple(loan.disbursed_at)}` : null,
          "",
          "REPAYMENT STATUS",
          `Amount Disbursed: ${symbol} ${safeParse(selectedLoan.amount_disbursed).toLocaleString()}`,
          `Amount Repaid: ${symbol} ${safeParse(selectedLoan.amount_repaid).toLocaleString()}`,
          `Outstanding Balance: ${symbol} ${safeParse(selectedLoan.outstanding_balance).toLocaleString()}`,
          "",
          `Generated: ${new Date().toLocaleString()}`,
        ].filter(Boolean).join("\n");
        const blob = new Blob([lines], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `loan-statement-${selectedLoan.application_number || "unknown"}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Downloaded", description: "Loan statement downloaded successfully" });
      } catch (error) {
        toast({ title: "Error", description: "Failed to generate loan statement", variant: "destructive" });
      }
    };
    const safeParseFloat = (val: any) => {
      if (val === null || val === undefined || val === "") return 0;
      const parsed = parseFloat(String(val));
      return isNaN(parsed) ? 0 : parsed;
    };

    return (
      <ErrorBoundary fallback={<div>Error loading loan</div>}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedLoan(null)} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">Loan {selectedLoan?.application_number || "Unknown"}</h1>
            <p className="text-muted-foreground">
              {loan.member_first_name} {loan.member_last_name} - {loan.product_name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Badge variant={statusColors[selectedLoan.status || "pending"] || "secondary"} className="capitalize">
              {(selectedLoan.status || "pending").replace("_", " ")}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadLoanStatement(loan, selectedLoan)}
              data-testid="button-download-loan-statement"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Statement</span>
            </Button>
            {selectedLoan.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setShowApproveDialog(selectedLoan)}
                  data-testid="button-approve-detail"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowRejectDialog(selectedLoan)}
                  data-testid="button-reject-detail"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
            {selectedLoan.status === "approved" && (
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  const loan = selectedLoan as any;
                  setDisburseMethod(loan.disbursement_method || "");
                  setDisburseAccount(loan.disbursement_account || "");
                  setDisbursePhone(loan.disbursement_phone || "");
                  setShowDisburseDialog(selectedLoan);
                }}
                data-testid="button-disburse-detail"
              >
                <Banknote className="h-4 w-4 mr-1" />
                Disburse Loan
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Applicant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Member Name</div>
                  <div className="font-medium">{loan.member_first_name} {loan.member_last_name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Member Number</div>
                  <div className="font-medium">{loan.member?.member_number || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{loan.member?.phone || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium">{loan.member?.email || "-"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loan Product</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Product Name</div>
                  <div className="font-medium">{loan.product_name || loan.loan_product?.name || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Interest Type</div>
                  <div className="font-medium capitalize">{(loan.loan_product?.interest_type || "-").replace("_", " ")}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Processing Fee</div>
                  <div className="font-medium">{loan.processing_fee ? `${parseFloat(loan.processing_fee).toLocaleString()}` : "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Insurance Fee</div>
                  <div className="font-medium">{loan.insurance_fee ? `${parseFloat(loan.insurance_fee).toLocaleString()}` : "-"}</div>
                </div>
              </div>
              {loan.extra_charges && (loan.extra_charges as any[]).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm font-medium mb-2">Extra Charges</div>
                  <div className="space-y-1">
                    {(loan.extra_charges as any[]).map((ec: any) => (
                      <div key={ec.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{ec.charge_name}</span>
                        <span className="font-medium">{parseFloat(String(ec.amount || "0")).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-medium pt-1 border-t">
                      <span>Total Extra Charges</span>
                      <span>{(loan.extra_charges as any[]).reduce((sum: number, ec: any) => sum + parseFloat(String(ec.amount || "0")), 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">Principal Amount</div>
                <div className="text-lg font-bold">{safeParseFloat(selectedLoan.amount).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Term</div>
                <div className="text-lg font-bold">{loan.term_months || 0} {loanFreq.period}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Interest Rate</div>
                <div className="text-lg font-bold">{selectedLoan.interest_rate || 0}% {(loanFreq as any).rateLabel || "per period"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Interest</div>
                <div className="text-lg font-bold">{safeParseFloat(loan.total_interest).toLocaleString()}</div>
                {(selectedLoan as any).interest_deducted_upfront && (
                  <div className="text-xs text-amber-600 font-medium">Deducted at disbursement</div>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  {(selectedLoan as any).interest_deducted_upfront ? "Total Installments Due" : "Total Repayment"}
                </div>
                <div className="text-lg font-bold">
                  {(selectedLoan as any).interest_deducted_upfront
                    ? safeParseFloat(selectedLoan.amount).toLocaleString()
                    : safeParseFloat(loan.total_repayment).toLocaleString()
                  }
                </div>
                {(selectedLoan as any).interest_deducted_upfront && (
                  <div className="text-xs text-muted-foreground">Principal only (interest already paid)</div>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{loanFreq.payment}</div>
                <div className="text-lg font-bold">{safeParseFloat(selectedLoan.monthly_repayment).toLocaleString()}</div>
              </div>
              {["disbursed", "closed", "defaulted"].includes(selectedLoan.status) && (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground">Amount Disbursed</div>
                    <div className="text-lg font-bold text-green-600">{safeParseFloat(selectedLoan.amount_disbursed).toLocaleString()}</div>
                    {(selectedLoan as any).interest_deducted_upfront && (
                      <div className="text-xs text-muted-foreground">(Interest deducted upfront)</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Amount Repaid</div>
                    <div className="text-lg font-bold text-blue-600">{safeParseFloat(selectedLoan.amount_repaid).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Outstanding Balance</div>
                    <div className="text-lg font-bold text-orange-600">{safeParseFloat(selectedLoan.outstanding_balance).toLocaleString()}</div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Purpose & Disbursement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">Purpose of Loan</div>
                  <div className="font-medium">{selectedLoan.purpose || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Disbursement Method</div>
                  <div className="font-medium">{getDisbursementMethodLabel(loan.disbursement_method)}</div>
                </div>
                {loan.disbursement_method === "mpesa" && loan.disbursement_phone && (
                  <div>
                    <div className="text-sm text-muted-foreground">M-Pesa Number</div>
                    <div className="font-medium">{loan.disbursement_phone}</div>
                  </div>
                )}
                {loan.disbursement_method === "bank_transfer" && loan.disbursement_account && (
                  <div>
                    <div className="text-sm text-muted-foreground">Bank Account</div>
                    <div className="font-medium">{loan.disbursement_account}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline & Staff</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Applied On</div>
                  <div className="font-medium">{formatDate(loan.applied_at || loan.created_at)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Applied By (Staff)</div>
                  <div className="font-medium">{loan.created_by_name || "-"}</div>
                </div>
                {loan.approved_at && (
                  <>
                    <div>
                      <div className="text-sm text-muted-foreground">Approved On</div>
                      <div className="font-medium text-green-600">{formatDate(loan.approved_at)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Reviewed By</div>
                      <div className="font-medium">{loan.reviewed_by_name || "-"}</div>
                    </div>
                  </>
                )}
                {loan.rejected_at && (
                  <>
                    <div>
                      <div className="text-sm text-muted-foreground">Rejected On</div>
                      <div className="font-medium text-red-600">{formatDate(loan.rejected_at)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Rejected By</div>
                      <div className="font-medium">{loan.reviewed_by_name || "-"}</div>
                    </div>
                  </>
                )}
                {loan.disbursed_at && (
                  <div>
                    <div className="text-sm text-muted-foreground">Disbursed On</div>
                    <div className="font-medium text-blue-600">{formatDate(loan.disbursed_at)}</div>
                  </div>
                )}
                {loan.closed_at && (
                  <div>
                    <div className="text-sm text-muted-foreground">Closed On</div>
                    <div className="font-medium">{formatDate(loan.closed_at)}</div>
                  </div>
                )}
                {loan.next_payment_date && (
                  <div>
                    <div className="text-sm text-muted-foreground">Next Payment Due</div>
                    <div className="font-medium">{formatDate(loan.next_payment_date)}</div>
                  </div>
                )}
              </div>
              {selectedLoan.status === "rejected" && loan.rejection_reason && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="text-sm text-red-600 dark:text-red-400 font-medium">Rejection Reason</div>
                  <div className="text-red-800 dark:text-red-200">{loan.rejection_reason}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="payments">
          <TabsList className="flex-wrap">
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="guarantors">Guarantors</TabsTrigger>
            <TabsTrigger value="restructure">Restructuring</TabsTrigger>
          </TabsList>
          <TabsContent value="payments" className="mt-4">
            <LoanPaymentHistory organizationId={organizationId} loanId={selectedLoan.id} loanData={loan} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-4">
            <LoanSchedule organizationId={organizationId} loanId={selectedLoan.id} />
          </TabsContent>
          <TabsContent value="guarantors" className="mt-4">
            <Guarantors
              organizationId={organizationId}
              loanId={selectedLoan.id}
              loanStatus={selectedLoan.status}
              loanAmount={Number(selectedLoan.amount)}
            />
          </TabsContent>
          <TabsContent value="restructure" className="mt-4">
            <LoanRestructuring
              organizationId={organizationId}
              loanId={selectedLoan.id}
              loanStatus={selectedLoan.status}
              currentTerm={loan.term_months}
              currentRate={safeParseFloat(selectedLoan.interest_rate)}
              currentMonthlyPayment={safeParseFloat(selectedLoan.monthly_repayment)}
              outstandingBalance={safeParseFloat(selectedLoan.outstanding_balance)}
              repaymentFrequency={(selectedLoan as any).repayment_frequency || "monthly"}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog - Detail View */}
      <Dialog open={!!showApproveDialog} onOpenChange={(open) => { if (!open) { setShowApproveDialog(null); setApproveComments(""); setApproveConditions(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Approve Loan Application
            </DialogTitle>
            <DialogDescription>
              Review and approve application {showApproveDialog?.application_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Applicant</span>
                <span className="font-medium">{(showApproveDialog as any)?.member_first_name} {(showApproveDialog as any)?.member_last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Loan Amount</span>
                <span className="font-medium">{parseFloat(showApproveDialog?.amount || "0").toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Term</span>
                <span className="font-medium">{(showApproveDialog as any)?.term_months || 0} {getFreqLabel(showApproveDialog).period}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Review Comments</label>
              <Textarea
                value={approveComments}
                onChange={(e) => setApproveComments(e.target.value)}
                placeholder="Add any review notes or observations..."
                className="resize-none"
                rows={3}
                data-testid="input-approve-comments-detail"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Approval Conditions (Optional)</label>
              <Textarea
                value={approveConditions}
                onChange={(e) => setApproveConditions(e.target.value)}
                placeholder="Any conditions for this approval..."
                className="resize-none"
                rows={2}
                data-testid="input-approve-conditions-detail"
              />
            </div>
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="approve-confirm-detail"
                checked={approveConfirmed}
                onCheckedChange={(checked) => setApproveConfirmed(!!checked)}
                data-testid="checkbox-approve-confirm-detail"
              />
              <label htmlFor="approve-confirm-detail" className="text-sm font-medium cursor-pointer">
                I confirm that I have reviewed this application and approve the loan
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowApproveDialog(null); setApproveComments(""); setApproveConditions(""); setApproveConfirmed(false); }} data-testid="button-cancel-approve-detail">
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => showApproveDialog && approveMutation.mutate({ 
                id: showApproveDialog.id, 
                comments: approveComments,
                conditions: approveConditions 
              })}
              disabled={approveMutation.isPending || !approveConfirmed}
              data-testid="button-confirm-approve-detail"
            >
              {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog - Detail View */}
      <Dialog open={!!showRejectDialog} onOpenChange={(open) => { if (!open) { setShowRejectDialog(null); setRejectReason(""); setRejectCategory(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-600" />
              Reject Loan Application
            </DialogTitle>
            <DialogDescription>
              Reject application {showRejectDialog?.application_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rejection Category</label>
              <Select value={rejectCategory} onValueChange={setRejectCategory}>
                <SelectTrigger data-testid="select-reject-category-detail">
                  <SelectValue placeholder="Select reason category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Insufficient Income">Insufficient Income</SelectItem>
                  <SelectItem value="Poor Credit History">Poor Credit History</SelectItem>
                  <SelectItem value="Incomplete Documentation">Incomplete Documentation</SelectItem>
                  <SelectItem value="Exceeds Lending Limits">Exceeds Lending Limits</SelectItem>
                  <SelectItem value="Guarantor Issues">Guarantor Issues</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rejection Reason</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide detailed reason for rejection..."
                className="resize-none"
                rows={4}
                data-testid="input-reject-reason-detail"
              />
            </div>
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="reject-confirm-detail"
                checked={rejectConfirmed}
                onCheckedChange={(checked) => setRejectConfirmed(!!checked)}
                data-testid="checkbox-reject-confirm-detail"
              />
              <label htmlFor="reject-confirm-detail" className="text-sm font-medium cursor-pointer">
                I confirm that I want to reject this loan application
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowRejectDialog(null); setRejectReason(""); setRejectCategory(""); setRejectConfirmed(false); }} data-testid="button-cancel-reject-detail">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showRejectDialog && rejectMutation.mutate({ 
                id: showRejectDialog.id, 
                reason: rejectReason,
                category: rejectCategory 
              })}
              disabled={rejectMutation.isPending || !rejectReason.trim() || !rejectConfirmed}
              data-testid="button-confirm-reject-detail"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disburse Dialog - Detail View */}
      <Dialog open={!!showDisburseDialog} onOpenChange={(open) => { if (!open) { setShowDisburseDialog(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-blue-600" />
              Disburse Loan
            </DialogTitle>
            <DialogDescription>
              Disburse loan {showDisburseDialog?.application_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(() => {
              const loan = showDisburseDialog as any;
              const loanProduct = products?.find((p) => p.id === loan?.loan_product_id);
              const loanAmount = parseFloat(loan?.amount || "0");
              const procFee = parseFloat(loan?.processing_fee || "0");
              const insFee = parseFloat(loan?.insurance_fee || "0");
              const loanInterest = parseFloat(loan?.total_interest || "0");
              const deductUpfront = loanProduct?.deduct_interest_upfront || false;
              const interestDed = deductUpfront ? loanInterest : 0;
              const netAmount = loanAmount - procFee - insFee - interestDed;
              
              return (
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Loan Amount</span>
                    <span className="font-medium">{loanAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Processing Fee</span>
                    <span className="font-medium">-{procFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Insurance Fee</span>
                    <span className="font-medium">-{insFee.toLocaleString()}</span>
                  </div>
                  {deductUpfront && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Interest (Upfront)</span>
                      <span className="font-medium text-amber-600">-{interestDed.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2 mt-2">
                    <span>Net Disbursement</span>
                    <span className="text-green-600">{netAmount.toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}
            <div className="space-y-2">
              <label className="text-sm font-medium">Disbursement Method</label>
              <Select value={disburseMethod} onValueChange={setDisburseMethod}>
                <SelectTrigger data-testid="select-disburse-method-detail">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {hasMpesa && <SelectItem value="mpesa">M-Pesa</SelectItem>}
                  {hasBankIntegration && <SelectItem value="bank_transfer">Bank Transfer</SelectItem>}
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasMpesa && disburseMethod === "mpesa" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">M-Pesa Number</label>
                <Input
                  value={disbursePhone}
                  onChange={(e) => setDisbursePhone(e.target.value)}
                  placeholder="e.g. 0712345678"
                  data-testid="input-disburse-phone-detail"
                />
              </div>
            )}
            {hasBankIntegration && disburseMethod === "bank_transfer" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Bank Account</label>
                <Input
                  value={disburseAccount}
                  onChange={(e) => setDisburseAccount(e.target.value)}
                  placeholder="Account number"
                  data-testid="input-disburse-account-detail"
                />
              </div>
            )}
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="disburse-confirm-detail"
                checked={disburseConfirmed}
                onCheckedChange={(checked) => setDisburseConfirmed(!!checked)}
                data-testid="checkbox-disburse-confirm-detail"
              />
              <label htmlFor="disburse-confirm-detail" className="text-sm font-medium cursor-pointer">
                I confirm the disbursement details are correct and authorize this payment
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDisburseDialog(null); setDisburseMethod(""); setDisburseAccount(""); setDisbursePhone(""); setDisburseConfirmed(false); }} data-testid="button-cancel-disburse-detail">
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => showDisburseDialog && disburseMutation.mutate({ 
                id: showDisburseDialog.id, 
                method: disburseMethod,
                account: disburseAccount,
                phone: disbursePhone
              })}
              disabled={disburseMutation.isPending || !disburseMethod || !disburseConfirmed}
              data-testid="button-confirm-disburse-detail"
            >
              {disburseMutation.isPending ? "Processing..." : "Confirm Disbursement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </ErrorBoundary>
    );
  }

  const selectedMember = members?.find((m) => m.id === form.watch("member_id"));
  const watchedDisbursementMethod = form.watch("disbursement_method");
  const editWatchedDisbursementMethod = editForm.watch("disbursement_method");
  const watchedPurpose = form.watch("purpose");
  const editWatchedPurpose = editForm.watch("purpose");

  const renderLoanApplicationForm = (
    formInstance: typeof form,
    onSubmit: (data: ApplicationFormData) => void,
    isEditing: boolean,
    isPending: boolean
  ) => {
    const product = products?.find((p) => p.id === formInstance.watch("product_id"));
    const selectedMember = members?.find((m) => m.id === formInstance.watch("member_id"));
    const disbMethod = formInstance.watch("disbursement_method");
    const purposeVal = formInstance.watch("purpose");
    const amount = parseFloat(formInstance.watch("amount") || "0");
    const term = formInstance.watch("term") || 0;
    
    const frequency = (product as any)?.repayment_frequency || "monthly";
    const frequencyLabels: Record<string, { period: string; payment: string }> = {
      daily: { period: "Days", payment: "Daily Payment" },
      weekly: { period: "Weeks", payment: "Weekly Payment" },
      bi_weekly: { period: "Bi-Weeks", payment: "Bi-Weekly Payment" },
      monthly: { period: "Months", payment: "Monthly Payment" },
    };
    const freqInfo = frequencyLabels[frequency] || frequencyLabels.monthly;
    const periodicRate = product ? parseFloat(product.interest_rate) / 100 : 0;

    const totalInterest = product?.interest_type === "flat" 
      ? amount * periodicRate
      : periodicRate > 0 && term > 0 ? (amount * periodicRate * Math.pow(1 + periodicRate, term)) / (Math.pow(1 + periodicRate, term) - 1) * term - amount : 0;
    const periodicPayment = term > 0 ? (amount + totalInterest) / term : 0;
    const processingFee = product ? amount * (parseFloat(product.processing_fee || "0") / 100) : 0;
    const insuranceFee = product ? amount * (parseFloat(product.insurance_fee || "0") / 100) : 0;
    const totalExtraCharges = extraCharges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

    return (
      <Form {...formInstance}>
        <form onSubmit={formInstance.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 text-lg border-b pb-2">Applicant Information</h3>
              {isEditing && editingLoan ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Member</div>
                    <div className="font-medium">{(editingLoan as any).member_name}</div>
                    <div className="text-xs text-muted-foreground">{(editingLoan as any).member_number}</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Application Number</div>
                    <div className="font-medium">{editingLoan.application_number}</div>
                    {editingLoan.status === "rejected" && editingLoan.rejection_reason && (
                      <div className="text-xs text-destructive mt-1">Rejected: {editingLoan.rejection_reason}</div>
                    )}
                  </div>
                </div>
              ) : (
                <FormField control={formInstance.control} name="member_id" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Select Member <span className="text-destructive">*</span></FormLabel>
                    <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            data-testid="select-application-member"
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
                              {members?.map((member) => {
                                const isInactive = isMemberInactive(member);
                                return (
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
                                      <span className={cn(isInactive && "text-muted-foreground")}>
                                        {member.member_number} - {member.first_name} {member.last_name}
                                        {isInactive && <span className="ml-2 text-xs text-destructive">(Inactive)</span>}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {member.phone || member.email || "No contact"}
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
                    {isMemberInactive(selectedMember) && (
                      <div className="mt-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-destructive font-medium">This member is inactive and cannot apply for loans. Please activate the member first.</span>
                      </div>
                    )}
                    {selectedMember && !isMemberInactive(selectedMember) && (
                      <div className="mt-2 p-3 bg-muted rounded-md text-sm grid gap-2 md:grid-cols-3">
                        <div><span className="text-muted-foreground">Savings:</span> {parseFloat(selectedMember.savings_balance || "0").toLocaleString()}</div>
                        <div><span className="text-muted-foreground">Shares:</span> {parseFloat(selectedMember.shares_balance || "0").toLocaleString()}</div>
                        <div><span className="text-muted-foreground">Deposits:</span> {parseFloat(selectedMember.deposits_balance || "0").toLocaleString()}</div>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 text-lg border-b pb-2">Loan Details</h3>
              <div className="space-y-4">
                <FormField control={formInstance.control} name="product_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Product <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      const selected = products?.find((p) => p.id === val);
                      if (selected) {
                        formInstance.setValue("term", selected.max_term_months);
                      }
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-application-product"><SelectValue placeholder="Select loan product..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} - {formatPercent(p.interest_rate)} ({p.interest_type?.replace("_", " ")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {product && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md text-sm">
                        <div className="grid gap-2 md:grid-cols-2">
                          <div><span className="text-muted-foreground">Amount Range:</span> {parseFloat(product.min_amount).toLocaleString()} - {parseFloat(product.max_amount).toLocaleString()}</div>
                          <div><span className="text-muted-foreground">Term Range:</span> {product.min_term_months} - {product.max_term_months} {freqInfo.period.toLowerCase()}</div>
                          <div><span className="text-muted-foreground">Processing Fee:</span> {formatPercent(product.processing_fee)}</div>
                          <div><span className="text-muted-foreground">Insurance Fee:</span> {formatPercent(product.insurance_fee)}</div>
                        </div>
                        {product.requires_guarantor && (
                          <div className="mt-2 text-amber-600 dark:text-amber-400 font-medium">This product requires a guarantor</div>
                        )}
                      </div>
                    )}
                    {product && selectedMember && parseFloat((product as any).shares_multiplier || "3") > 0 && (
                      <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md text-sm" data-testid="eligibility-info">
                        <div className="font-medium text-amber-800 dark:text-amber-200 mb-1">Shares-Based Eligibility</div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <span className="text-muted-foreground">Member Shares:</span>{" "}
                            <span className="font-medium">{parseFloat(selectedMember.shares_balance || "0").toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Max Eligible ({(product as any).shares_multiplier || "3"}x):</span>{" "}
                            <span className="font-medium text-green-700 dark:text-green-400">
                              {(parseFloat(selectedMember.shares_balance || "0") * parseFloat((product as any).shares_multiplier || "3")).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {parseFloat((product as any).min_shares_required || "0") > 0 && parseFloat(selectedMember.shares_balance || "0") < parseFloat((product as any).min_shares_required || "0") && (
                          <div className="mt-2 text-destructive font-medium">
                            Minimum shares required: {parseFloat((product as any).min_shares_required).toLocaleString()} (current: {parseFloat(selectedMember.shares_balance || "0").toLocaleString()})
                          </div>
                        )}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={formInstance.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Amount <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input {...field} type="number" placeholder="Enter amount" data-testid="input-application-amount" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={formInstance.control} name="term" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repayment Term ({freqInfo.period}) <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input {...field} type="number" placeholder="e.g. 12" data-testid="input-application-term" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {product && amount > 0 && term > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium mb-3 text-green-800 dark:text-green-200">Loan Calculation Preview</h4>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
                      <div className="p-2 bg-white dark:bg-background rounded">
                        <div className="text-muted-foreground">Principal</div>
                        <div className="text-lg font-bold">{amount.toLocaleString()}</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-background rounded">
                        <div className="text-muted-foreground">Total Interest</div>
                        <div className="text-lg font-bold">{totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-background rounded">
                        <div className="text-muted-foreground">{freqInfo.payment}</div>
                        <div className="text-lg font-bold">{periodicPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="p-2 bg-white dark:bg-background rounded">
                        <div className="text-muted-foreground">Total Repayment</div>
                        <div className="text-lg font-bold">{(amount + totalInterest).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                    </div>
                    {(processingFee > 0 || insuranceFee > 0 || totalExtraCharges > 0 || (product as any).deduct_interest_upfront) && (
                      <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 text-sm">
                        <div className="text-muted-foreground">Upfront Deductions (from disbursement):</div>
                        <div className="flex flex-wrap gap-4 mt-1">
                          {processingFee > 0 && <span>Processing: {processingFee.toLocaleString()}</span>}
                          {insuranceFee > 0 && <span>Insurance: {insuranceFee.toLocaleString()}</span>}
                          {totalExtraCharges > 0 && <span>Extra Charges: {totalExtraCharges.toLocaleString()}</span>}
                          {(product as any).deduct_interest_upfront && (
                            <span className="text-amber-600">Interest (Upfront): {totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          )}
                          <span className="font-medium">
                            Net Disbursement: {(amount - processingFee - insuranceFee - totalExtraCharges - ((product as any).deduct_interest_upfront ? totalInterest : 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 text-lg border-b pb-2">Purpose of Loan</h3>
              <div className="space-y-4">
                <FormField control={formInstance.control} name="purpose" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Purpose <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-application-purpose"><SelectValue placeholder="Select purpose..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loanPurposes.map((purpose) => (
                          <SelectItem key={purpose} value={purpose}>{purpose}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {purposeVal === "Other" && (
                  <FormField control={formInstance.control} name="purpose_details" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Please specify</FormLabel>
                      <FormControl><Textarea {...field} className="resize-none" placeholder="Describe the purpose of the loan..." data-testid="input-application-purpose-details" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 text-lg border-b pb-2">Disbursement Details</h3>
              <div className="space-y-4">
                <FormField control={formInstance.control} name="disbursement_method" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Disbursement Method <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-disbursement-method"><SelectValue placeholder="How should funds be disbursed?" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {disbursementMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {disbMethod === "mpesa" && (
                  <FormField control={formInstance.control} name="disbursement_phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>M-Pesa Phone Number <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. 254712345678" data-testid="input-disbursement-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                {disbMethod === "bank_transfer" && (
                  <FormField control={formInstance.control} name="disbursement_account" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Account Number <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input {...field} placeholder="Enter bank account number" data-testid="input-disbursement-account" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                {disbMethod === "cheque" && (
                  <FormField control={formInstance.control} name="disbursement_account" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cheque Payee Name</FormLabel>
                      <FormControl><Input {...field} placeholder="Name to appear on cheque" data-testid="input-disbursement-cheque" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
            </CardContent>
          </Card>

          {!isEditing && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4 border-b pb-2">
                  <h3 className="font-semibold text-lg">Extra Charges</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setExtraCharges([...extraCharges, { charge_name: "", amount: "" }])}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Charge
                  </Button>
                </div>
                {extraCharges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No extra charges added. Click "Add Charge" to add fees like application forms, registration, etc.</p>
                ) : (
                  <div className="space-y-3">
                    {extraCharges.map((charge, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="flex-1">
                          <Input
                            placeholder="Charge name (e.g., Application Form)"
                            value={charge.charge_name}
                            onChange={(e) => {
                              const updated = [...extraCharges];
                              updated[index].charge_name = e.target.value;
                              setExtraCharges(updated);
                            }}
                          />
                        </div>
                        <div className="w-40">
                          <Input
                            type="number"
                            placeholder="Amount"
                            min="0"
                            step="0.01"
                            value={charge.amount}
                            onChange={(e) => {
                              const updated = [...extraCharges];
                              updated[index].amount = e.target.value;
                              setExtraCharges(updated);
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => setExtraCharges(extraCharges.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-end pt-2 border-t text-sm font-medium">
                      Total Extra Charges: {extraCharges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0).toLocaleString()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {product?.requires_guarantor && !isEditing && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4 text-lg border-b pb-2">Guarantor Information</h3>
                <FormField control={formInstance.control} name="guarantor_ids" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Select Guarantor(s) <span className="text-destructive">*</span></FormLabel>
                    <Popover open={guarantorSearchOpen} onOpenChange={setGuarantorSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            data-testid="select-application-guarantor"
                            className={cn(
                              "w-full justify-between",
                              (!field.value || field.value.length === 0) && "text-muted-foreground"
                            )}
                          >
                            {field.value && field.value.length > 0
                              ? `${field.value.length} guarantor(s) selected`
                              : "Search and add guarantor..."}
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
                              {members?.filter((m) => m.id !== formInstance.watch("member_id") && !field.value?.includes(m.id)).map((member) => (
                                <CommandItem
                                  key={member.id}
                                  value={`${member.member_number} ${member.first_name} ${member.last_name} ${member.phone || ""} ${member.email || ""} ${member.id_number || ""}`}
                                  onSelect={() => {
                                    field.onChange([...(field.value || []), member.id]);
                                    setGuarantorSearchOpen(false);
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span>
                                      {member.member_number} - {member.first_name} {member.last_name}
                                    </span>
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
                    {field.value && field.value.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {field.value.map((gid) => {
                          const g = members?.find((m) => m.id === gid);
                          return g ? (
                            <div key={gid} className="flex items-center justify-between p-2 bg-muted rounded">
                              <span>{g.first_name} {g.last_name} ({g.member_number})</span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(field.value?.filter((id) => id !== gid))}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={() => { setViewMode("list"); formInstance.reset(); setEditingLoan(null); setExtraCharges([]); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-application">
              {isPending ? (isEditing ? "Updating..." : "Submitting...") : (isEditing ? "Update & Resubmit" : "Submit Application")}
            </Button>
          </div>
        </form>
      </Form>
    );
  };

  if (viewMode === "new") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setViewMode("list"); form.reset(); setExtraCharges([]); }} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Loan Application</h1>
            <p className="text-muted-foreground">Complete all sections to submit a loan application</p>
          </div>
        </div>
        {renderLoanApplicationForm(form, handleSubmit, false, createMutation.isPending)}
      </div>
    );
  }

  if (viewMode === "edit" && editingLoan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setViewMode("list"); setEditingLoan(null); editForm.reset(); }} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Loan Application</h1>
            <p className="text-muted-foreground">Update the application details and resubmit for review</p>
          </div>
          <Badge variant={statusColors[editingLoan.status] || "secondary"} className="ml-auto capitalize">
            {editingLoan.status.replace("_", " ")}
          </Badge>
        </div>
        {renderLoanApplicationForm(editForm, handleEditSubmit, true, editMutation.isPending)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Loan Applications</h1>
          <p className="text-muted-foreground">Manage loan applications</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {canWrite && (
            <Button onClick={() => { form.reset(); setViewMode("new"); }} data-testid="button-new-application" className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">New Application</span>
              <span className="sm:hidden">New</span>
            </Button>
          )}
        </div>
      </div>

      {canSeeAllBranches && branches && branches.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter by Branch:</span>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[200px]">
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

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : applications && applications.length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Application #</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden md:table-cell">Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden lg:table-cell">Term</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id} data-testid={`row-application-${app.id}`}>
                    <TableCell className="font-medium hidden sm:table-cell">{app.application_number}</TableCell>
                    <TableCell>
                      <div>{(app as any).member_name}</div>
                      <div className="text-xs text-muted-foreground md:hidden">{(app as any).product_name}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{(app as any).product_name}</TableCell>
                    <TableCell>{parseFloat(app.amount).toLocaleString()}</TableCell>
                    <TableCell className="hidden lg:table-cell">{(app as any).term_months} {getFreqLabel(app).period}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[app.status] || "secondary"}>
                        {app.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedLoan(app)}
                          data-testid={`button-view-${app.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canWrite && ["pending", "under_review", "cancelled", "rejected"].includes(app.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditPage(app)}
                            title="Edit application"
                            data-testid={`button-edit-${app.id}`}
                          >
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                                              </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">No loan applications yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Submit your first loan application</p>
              {canWrite && (
                <Button onClick={() => setViewMode("new")} data-testid="button-first-application">
                  <Plus className="mr-2 h-4 w-4" />
                  New Application
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={!!showApproveDialog} onOpenChange={(open) => { if (!open) { setShowApproveDialog(null); setApproveComments(""); setApproveConditions(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Approve Loan Application
            </DialogTitle>
            <DialogDescription>
              Review and approve application {showApproveDialog?.application_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Applicant</span>
                <span className="font-medium">{(showApproveDialog as any)?.member_first_name} {(showApproveDialog as any)?.member_last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Loan Amount</span>
                <span className="font-medium">{parseFloat(showApproveDialog?.amount || "0").toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Term</span>
                <span className="font-medium">{(showApproveDialog as any)?.term_months || 0} {getFreqLabel(showApproveDialog).period}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Review Comments</label>
              <Textarea
                value={approveComments}
                onChange={(e) => setApproveComments(e.target.value)}
                placeholder="Add any review notes or observations..."
                className="resize-none"
                rows={3}
                data-testid="input-approve-comments"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Approval Conditions (Optional)</label>
              <Textarea
                value={approveConditions}
                onChange={(e) => setApproveConditions(e.target.value)}
                placeholder="Any conditions for this approval (e.g., must provide additional documentation before disbursement)..."
                className="resize-none"
                rows={2}
                data-testid="input-approve-conditions"
              />
            </div>
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="approve-confirm"
                checked={approveConfirmed}
                onCheckedChange={(checked) => setApproveConfirmed(!!checked)}
                data-testid="checkbox-approve-confirm"
              />
              <label htmlFor="approve-confirm" className="text-sm font-medium cursor-pointer">
                I confirm that I have reviewed this application and approve the loan
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowApproveDialog(null); setApproveComments(""); setApproveConditions(""); setApproveConfirmed(false); }} data-testid="button-cancel-approve">
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => showApproveDialog && approveMutation.mutate({ 
                id: showApproveDialog.id, 
                comments: approveComments,
                conditions: approveConditions 
              })}
              disabled={approveMutation.isPending || !approveConfirmed}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!showRejectDialog} onOpenChange={(open) => { if (!open) { setShowRejectDialog(null); setRejectReason(""); setRejectCategory(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-destructive" />
              Reject Loan Application
            </DialogTitle>
            <DialogDescription>
              Please provide details for rejecting application {showRejectDialog?.application_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Applicant</span>
                <span className="font-medium">{(showRejectDialog as any)?.member_first_name} {(showRejectDialog as any)?.member_last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Loan Amount</span>
                <span className="font-medium">{parseFloat(showRejectDialog?.amount || "0").toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rejection Category <span className="text-destructive">*</span></label>
              <Select value={rejectCategory} onValueChange={setRejectCategory}>
                <SelectTrigger data-testid="select-reject-category">
                  <SelectValue placeholder="Select a category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insufficient_income">Insufficient Income</SelectItem>
                  <SelectItem value="poor_credit_history">Poor Credit History</SelectItem>
                  <SelectItem value="existing_loans">Too Many Existing Loans</SelectItem>
                  <SelectItem value="incomplete_documentation">Incomplete Documentation</SelectItem>
                  <SelectItem value="exceeds_limit">Exceeds Borrowing Limit</SelectItem>
                  <SelectItem value="guarantor_issues">Guarantor Requirements Not Met</SelectItem>
                  <SelectItem value="policy_violation">Policy Violation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Detailed Reason <span className="text-destructive">*</span></label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide specific reason for rejection..."
                className="resize-none"
                rows={4}
                data-testid="input-reject-reason"
              />
            </div>
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="reject-confirm"
                checked={rejectConfirmed}
                onCheckedChange={(checked) => setRejectConfirmed(!!checked)}
                data-testid="checkbox-reject-confirm"
              />
              <label htmlFor="reject-confirm" className="text-sm font-medium cursor-pointer">
                I confirm that I want to reject this loan application
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowRejectDialog(null); setRejectReason(""); setRejectCategory(""); setRejectConfirmed(false); }} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showRejectDialog && rejectMutation.mutate({ 
                id: showRejectDialog.id, 
                reason: rejectReason,
                category: rejectCategory 
              })}
              disabled={!rejectReason.trim() || !rejectCategory || rejectMutation.isPending || !rejectConfirmed}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disburse Dialog */}
      <Dialog open={!!showDisburseDialog} onOpenChange={(open) => { 
        if (!open) { 
          setShowDisburseDialog(null); 
          setDisburseMethod(""); 
          setDisburseAccount(""); 
          setDisbursePhone(""); 
          setDisburseConfirmed(false); 
        } 
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-600" />
              Disburse Loan
            </DialogTitle>
            <DialogDescription>
              Confirm disbursement details for application {showDisburseDialog?.application_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {(() => {
              const loan = showDisburseDialog as any;
              const loanProduct = products?.find((p) => p.id === loan?.loan_product_id);
              const disbFreq = getFreqLabel(loan);
              const amount = parseFloat(loan?.amount || "0");
              const processingFee = parseFloat(loan?.processing_fee || "0");
              const insuranceFee = parseFloat(loan?.insurance_fee || "0");
              const totalInterest = parseFloat(loan?.total_interest || "0");
              const deductInterestUpfront = loanProduct?.deduct_interest_upfront || false;
              const interestDeduction = deductInterestUpfront ? totalInterest : 0;
              const loanExtraCharges = (loan?.extra_charges || []) as { id: string; charge_name: string; amount: string | number }[];
              const totalExtraChargesDisb = loanExtraCharges.reduce((sum: number, c: any) => sum + parseFloat(String(c.amount || "0")), 0);
              const netDisbursement = amount - processingFee - insuranceFee - totalExtraChargesDisb - interestDeduction;
              
              return (
                <>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <h4 className="font-medium mb-3">Loan Summary</h4>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Applicant</span>
                      <span className="font-medium">{loan?.member_first_name} {loan?.member_last_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Loan Amount</span>
                      <span className="font-medium">{amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Term</span>
                      <span className="font-medium">{loan?.term_months || 0} {disbFreq.period}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{disbFreq.payment}</span>
                      <span className="font-medium">{parseFloat(loan?.monthly_repayment || "0").toLocaleString()}</span>
                    </div>
                    {deductInterestUpfront && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Interest Method</span>
                        <span className="font-medium text-amber-600">Deducted Upfront</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
                    <h4 className="font-medium mb-3">Fee Breakdown</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Loan Principal</span>
                      <span>{amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Less: Processing Fee</span>
                      <span className="text-red-600">-{processingFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Less: Insurance Fee</span>
                      <span className="text-red-600">-{insuranceFee.toLocaleString()}</span>
                    </div>
                    {loanExtraCharges.map((ec: any) => (
                      <div key={ec.id || ec.charge_name} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Less: {ec.charge_name}</span>
                        <span className="text-red-600">-{parseFloat(String(ec.amount || "0")).toLocaleString()}</span>
                      </div>
                    ))}
                    {deductInterestUpfront && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Less: Interest (Upfront)</span>
                        <span className="text-red-600">-{interestDeduction.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-2 border-t">
                      <span>Net Disbursement</span>
                      <span className="text-green-600">{netDisbursement.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Disbursement Method <span className="text-destructive">*</span></label>
                    <Select value={disburseMethod} onValueChange={setDisburseMethod}>
                      <SelectTrigger data-testid="select-disburse-method">
                        <SelectValue placeholder="Select disbursement method..." />
                      </SelectTrigger>
                      <SelectContent>
                        {hasMpesa && <SelectItem value="mpesa">M-Pesa</SelectItem>}
                        {hasBankIntegration && <SelectItem value="bank_transfer">Bank Transfer</SelectItem>}
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasMpesa && disburseMethod === "mpesa" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">M-Pesa Phone Number <span className="text-destructive">*</span></label>
                      <Input
                        value={disbursePhone}
                        onChange={(e) => setDisbursePhone(e.target.value)}
                        placeholder="e.g., 0712345678"
                        data-testid="input-disburse-phone"
                      />
                    </div>
                  )}

                  {hasBankIntegration && disburseMethod === "bank_transfer" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Bank Account Details <span className="text-destructive">*</span></label>
                      <Input
                        value={disburseAccount}
                        onChange={(e) => setDisburseAccount(e.target.value)}
                        placeholder="Account number and bank name"
                        data-testid="input-disburse-account"
                      />
                    </div>
                  )}

                  <div className="flex items-start space-x-2 pt-2">
                    <Checkbox
                      id="disburse-confirm"
                      checked={disburseConfirmed}
                      onCheckedChange={(checked) => setDisburseConfirmed(checked === true)}
                      data-testid="checkbox-disburse-confirm"
                    />
                    <label htmlFor="disburse-confirm" className="text-sm leading-tight cursor-pointer" data-testid="label-disburse-confirm">
                      I confirm that all details are correct and authorize this disbursement of <strong>{netDisbursement.toLocaleString()}</strong>
                    </label>
                  </div>
                </>
              );
            })()}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { 
              setShowDisburseDialog(null); 
              setDisburseMethod(""); 
              setDisburseAccount(""); 
              setDisbursePhone(""); 
              setDisburseConfirmed(false); 
            }} data-testid="button-cancel-disburse">
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => showDisburseDialog && disburseMutation.mutate({ 
                id: showDisburseDialog.id, 
                method: disburseMethod,
                account: disburseAccount,
                phone: disbursePhone
              })}
              disabled={
                !disburseMethod || 
                !disburseConfirmed || 
                (disburseMethod === "mpesa" && !disbursePhone) ||
                (disburseMethod === "bank_transfer" && !disburseAccount) ||
                disburseMutation.isPending
              }
              data-testid="button-confirm-disburse"
            >
              {disburseMutation.isPending ? "Processing..." : "Confirm Disbursement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
