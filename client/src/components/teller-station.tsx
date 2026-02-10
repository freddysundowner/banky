import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MemberStatementPage from "./member-statement-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { usePermissions } from "@/hooks/use-permissions";
import { useFeatures } from "@/hooks/use-features";
import { useCurrency } from "@/hooks/use-currency";
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowRightLeft,
  Search, 
  Wallet, 
  Banknote,
  Receipt,
  User,
  CreditCard,
  DollarSign,
  Clock,
  CheckCircle,
  Lock,
  Users,
  AlertTriangle,
  ShieldAlert,
  Ticket,
  PhoneCall,
  UserCheck,
  PiggyBank
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: string;
  branch_id: string;
}

interface QueueTicket {
  id: string;
  ticket_number: string;
  branch_id: string;
  service_category: string;
  member_id?: string;
  member_name?: string;
  member_phone?: string;
  status: string;
  teller_id?: string;
  counter_number?: number;
  called_at?: string;
  created_at: string;
}

interface TellerStationProps {
  organizationId: string;
}

interface Member {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  savings_balance: number;
  shares_balance: number;
  deposits_balance: number;
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
  created_at: string;
  member?: Member;
}

interface LoanApplication {
  id: string;
  loan_number: string;
  member_id: string;
  principal_amount: number;
  outstanding_balance: number;
  status: string;
  member?: Member;
}

const depositSchema = z.object({
  member_id: z.string().min(1, "Member is required"),
  account_type: z.enum(["savings", "shares", "deposits"]),
  amount: z.string().min(1, "Amount is required"),
  payment_method: z.enum(["cash", "mpesa", "bank_transfer", "cheque"]),
  mpesa_phone: z.string().optional(),
  reference: z.string().optional(),
});

const withdrawalSchema = z.object({
  member_id: z.string().min(1, "Member is required"),
  account_type: z.enum(["savings", "shares", "deposits"]),
  amount: z.string().min(1, "Amount is required"),
  payment_method: z.enum(["cash", "mpesa", "bank_transfer", "cheque"]),
  reference: z.string().optional(),
});

const repaymentSchema = z.object({
  loan_id: z.string().min(1, "Loan is required"),
  amount: z.string().min(1, "Amount is required"),
  payment_method: z.enum(["cash", "mpesa", "bank_transfer", "cheque"]),
  reference: z.string().optional(),
});

type DepositFormData = z.infer<typeof depositSchema>;
type WithdrawalFormData = z.infer<typeof withdrawalSchema>;
type RepaymentFormData = z.infer<typeof repaymentSchema>;

export default function TellerStation({ organizationId }: TellerStationProps) {
  const { toast } = useToast();
  const { canRead, canWrite, isLoading: permissionsLoading } = useResourcePermissions(organizationId, RESOURCES.TELLER_STATION);
  const { isAdmin } = usePermissions(organizationId);
  const { hasFeature } = useFeatures(organizationId);
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const hasMpesa = hasFeature("mpesa_integration");
  const hasBankIntegration = hasFeature("bank_integration");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState("deposit");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedTellerId, setSelectedTellerId] = useState<string | null>(null);
  const [showStatementPage, setShowStatementPage] = useState(false);
  const [counterNumber, setCounterNumber] = useState<string | null>(null);
  const [counterInput, setCounterInput] = useState("");

  // Get current user's staff info for display
  const { data: myStaffInfo } = useQuery<Staff | null>({
    queryKey: ["/api/organizations", organizationId, "staff", "me"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/staff/me`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Access is controlled by teller_station:read permission
  const canAccessTellerStation = canRead;

  const { data: branches } = useQuery<{ id: string; name: string; code: string }[]>({
    queryKey: ["/api/organizations", organizationId, "branches"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/branches`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (branches && branches.length === 1 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches]);

  const { data: staffList } = useQuery<Staff[]>({
    queryKey: ["/api/organizations", organizationId, "staff"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/staff`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: handoverStaffList } = useQuery<Staff[]>({
    queryKey: ["/api/organizations", organizationId, "staff", "handover-list"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/staff/tellers`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  type ActiveCounter = { counter_number: string; staff_id: string; staff_name: string | null; branch_id: string };
  const { data: activeCounters, refetch: refetchCounters } = useQuery<ActiveCounter[]>({
    queryKey: ["/api/organizations", organizationId, "floats", "active-counters"],
    queryFn: async () => {
      const branchId = myStaffInfo?.branch_id || selectedBranchId || "";
      const res = await fetch(`/api/organizations/${organizationId}/floats/active-counters?branch_id=${branchId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(myStaffInfo?.branch_id || selectedBranchId),
  });

  const filteredTellers = staffList?.filter((staff) => 
    staff.role?.toLowerCase() === "teller" && 
    (!selectedBranchId || staff.branch_id === selectedBranchId)
  ) || [];

  const { data: members, isLoading: membersLoading, isError: membersError } = useQuery<Member[]>({
    queryKey: ["/api/organizations", organizationId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const { data: todayTransactions, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/organizations", organizationId, "transactions", "today", isAdmin ? selectedTellerId : myStaffInfo?.id],
    queryFn: async () => {
      let url = `/api/organizations/${organizationId}/transactions?today=true`;
      if (isAdmin && selectedTellerId) {
        url += `&teller_id=${selectedTellerId}`;
      } else if (!isAdmin && myStaffInfo?.id) {
        url += `&teller_id=${myStaffInfo.id}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.items || []);
    },
    enabled: isAdmin || !!myStaffInfo,
  });

  const { data: loans } = useQuery<LoanApplication[]>({
    queryKey: ["/api/organizations", organizationId, "loans", "active"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/loans?status=disbursed`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: myFloat, refetch: refetchFloat } = useQuery<{
    id: string;
    staff_id?: string;
    staff_name?: string;
    current_balance: number;
    opening_balance: number;
    deposits_in: number;
    withdrawals_out: number;
    replenishments: number;
    status: string;
  } | null>({
    queryKey: ["/api/organizations", organizationId, "floats", isAdmin && selectedTellerId ? `teller/${selectedTellerId}` : "my"],
    queryFn: async () => {
      const url = isAdmin && selectedTellerId 
        ? `/api/organizations/${organizationId}/floats/teller/${selectedTellerId}`
        : `/api/organizations/${organizationId}/floats/my`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Queue management - fetch tickets for teller's branch
  const { data: queueTickets = [], refetch: refetchQueue } = useQuery<QueueTicket[]>({
    queryKey: ["/api/organizations", organizationId, "queue-tickets", myStaffInfo?.branch_id],
    queryFn: async () => {
      if (!myStaffInfo?.branch_id) return [];
      const res = await fetch(
        `/api/organizations/${organizationId}/queue-tickets?branch_id=${myStaffInfo.branch_id}&status=waiting,serving`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!myStaffInfo?.branch_id,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const currentlyServing = queueTickets.find(t => t.status === "serving" && t.teller_id === myStaffInfo?.id);
  const waitingCount = queueTickets.filter(t => t.status === "waiting").length;

  const announceTicket = (ticketNumber: string, counterNumber: string) => {
    if ('speechSynthesis' in window) {
      const ticketDigits = ticketNumber.split('').join(' ');
      const message = `Ticket number ${ticketDigits}, please go to counter number ${counterNumber}`;
      window.speechSynthesis.cancel();

      const utterance1 = new SpeechSynthesisUtterance(message);
      utterance1.rate = 0.9;
      utterance1.pitch = 1;
      utterance1.volume = 1;

      const utterance2 = new SpeechSynthesisUtterance(message);
      utterance2.rate = 0.9;
      utterance2.pitch = 1;
      utterance2.volume = 1;

      utterance1.onend = () => {
        setTimeout(() => {
          window.speechSynthesis.speak(utterance2);
        }, 800);
      };

      window.speechSynthesis.speak(utterance1);
    }
  };

  const callNextMutation = useMutation({
    mutationFn: async () => {
      if (!myStaffInfo?.branch_id) throw new Error("No branch assigned");
      let url = `/api/organizations/${organizationId}/queue-tickets/call-next?branch_id=${myStaffInfo.branch_id}`;
      if (effectiveCounterNumber) {
        url += `&counter_number=${encodeURIComponent(effectiveCounterNumber)}`;
      }
      const res = await fetch(url, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to call next");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Calling Customer", description: `Ticket ${data.ticket.ticket_number} - ${data.ticket.member_name || "Guest"}` });
        announceTicket(data.ticket.ticket_number, effectiveCounterNumber || data.ticket.counter_number || "1");
      } else {
        toast({ title: "Queue Empty", description: data.message });
      }
      refetchQueue();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const completeTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch(
        `/api/organizations/${organizationId}/queue-tickets/${ticketId}/complete`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to complete");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Complete", description: "Customer service completed" });
      refetchQueue();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const depositForm = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      member_id: "",
      account_type: "savings",
      amount: "",
      payment_method: "cash",
      mpesa_phone: "",
      reference: "",
    },
  });
  
  const depositPaymentMethod = depositForm.watch("payment_method");
  const [stkPushLoading, setStkPushLoading] = useState(false);

  useEffect(() => {
    if (depositPaymentMethod === "mpesa" && selectedMember?.phone) {
      depositForm.setValue("mpesa_phone", selectedMember.phone);
    }
  }, [depositPaymentMethod, selectedMember]);

  const withdrawalForm = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      member_id: "",
      account_type: "savings",
      amount: "",
      payment_method: "cash",
      reference: "",
    },
  });

  const repaymentForm = useForm<RepaymentFormData>({
    resolver: zodResolver(repaymentSchema),
    defaultValues: {
      loan_id: "",
      amount: "",
      payment_method: "cash",
      reference: "",
    },
  });

  const handleSendStkPush = async () => {
    const phone = depositForm.getValues("mpesa_phone");
    const amount = depositForm.getValues("amount");
    
    if (!phone || !amount) {
      toast({ title: "Please enter phone number and amount", variant: "destructive" });
      return;
    }
    
    setStkPushLoading(true);
    try {
      const res = await apiRequest("POST", `/api/organizations/${organizationId}/mpesa/stk-push`, {
        phone,
        amount: parseFloat(amount),
        account_reference: selectedMember?.member_number || "Deposit",
        description: `Deposit for ${selectedMember?.first_name || "Member"}`
      });
      
      const data = await res.json();
      if (data.success || res.ok) {
        toast({ title: "M-Pesa prompt sent! Check member's phone to complete payment." });
      } else {
        toast({ title: data.message || "Failed to send M-Pesa prompt", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: error.message || "Failed to initiate M-Pesa", variant: "destructive" });
    } finally {
      setStkPushLoading(false);
    }
  };

  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/transactions`, {
        ...data,
        amount: parseFloat(data.amount),
        transaction_type: "deposit",
        ...(isAdmin && selectedTellerId ? { teller_id: selectedTellerId } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      refetchFloat();
      depositForm.reset();
      setSelectedMember(null);
      toast({ title: "Deposit recorded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to record deposit", variant: "destructive" });
    },
  });

  const withdrawalMutation = useMutation({
    mutationFn: async (data: WithdrawalFormData) => {
      const withdrawalAmount = parseFloat(data.amount);
      const currentBalance = myFloat?.current_balance || 0;
      
      if (withdrawalAmount > currentBalance) {
        throw new Error(`Insufficient float balance. Available: ${symbol} ${currentBalance.toLocaleString()}`);
      }
      
      return apiRequest("POST", `/api/organizations/${organizationId}/transactions`, {
        ...data,
        amount: withdrawalAmount,
        transaction_type: "withdrawal",
        ...(isAdmin && selectedTellerId ? { teller_id: selectedTellerId } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      refetchFloat();
      withdrawalForm.reset();
      setSelectedMember(null);
      toast({ title: "Withdrawal recorded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to record withdrawal", variant: "destructive" });
    },
  });

  const repaymentMutation = useMutation({
    mutationFn: async (data: RepaymentFormData) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/repayments`, {
        loan_id: data.loan_id,
        amount_paid: parseFloat(data.amount),
        payment_method: data.payment_method,
        reference_number: data.reference,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "repayments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "transactions"] });
      repaymentForm.reset();
      toast({ title: "Loan repayment recorded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to record repayment", variant: "destructive" });
    },
  });

  const filteredMembers = members?.filter(m => {
    const search = memberSearch.toLowerCase();
    return (
      m.member_number.toLowerCase().includes(search) ||
      m.first_name.toLowerCase().includes(search) ||
      m.last_name.toLowerCase().includes(search) ||
      m.phone?.toLowerCase().includes(search) ||
      m.email?.toLowerCase().includes(search) ||
      m.id_number?.toLowerCase().includes(search)
    );
  }).slice(0, 5);

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setMemberSearch("");
    depositForm.setValue("member_id", member.id);
    withdrawalForm.setValue("member_id", member.id);
  };

  const todayDeposits = todayTransactions?.filter(t => t.transaction_type === "deposit") || [];
  const todayWithdrawals = todayTransactions?.filter(t => t.transaction_type === "withdrawal") || [];
  const totalDeposits = todayDeposits.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalWithdrawals = todayWithdrawals.reduce((sum, t) => sum + Number(t.amount), 0);

  const memberLoans = selectedMember 
    ? loans?.filter(l => l.member_id === selectedMember.id && l.status === "disbursed") 
    : [];

  const [showReconcile, setShowReconcile] = useState(false);
  const [showReplenishRequest, setShowReplenishRequest] = useState(false);
  const [physicalCount, setPhysicalCount] = useState("");
  const [reconcileNotes, setReconcileNotes] = useState("");
  const [returnToVault, setReturnToVault] = useState(true);
  const [replenishAmount, setReplenishAmount] = useState("");
  const [replenishReason, setReplenishReason] = useState("");
  
  const [showShortageApproval, setShowShortageApproval] = useState(false);
  const [pendingShortageId, setPendingShortageId] = useState<string | null>(null);
  const [approverEmail, setApproverEmail] = useState("");
  const [approverPassword, setApproverPassword] = useState("");
  const [shortageAction, setShortageAction] = useState<"deduct" | "hold" | "expense">("deduct");
  const [approvalNotes, setApprovalNotes] = useState("");

  const [showHandoverDialog, setShowHandoverDialog] = useState(false);
  const [handoverToStaffId, setHandoverToStaffId] = useState("");
  const [handoverAmount, setHandoverAmount] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [handoverStaffSearch, setHandoverStaffSearch] = useState("");

  const { data: myShortages, refetch: refetchShortages } = useQuery<{
    shortages: Array<{
      id: string;
      date: string;
      shortage_amount: number;
      status: string;
      notes: string;
    }>;
    total_pending: number;
    total_held: number;
    total_outstanding: number;
  }>({
    queryKey: ["/api/organizations", organizationId, "shortages", "my"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/shortages/my`, { credentials: "include" });
      if (!res.ok) return { shortages: [], total_pending: 0, total_held: 0, total_outstanding: 0 };
      return res.json();
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      if (!myFloat) throw new Error("No float to reconcile");
      return apiRequest("POST", `/api/organizations/${organizationId}/floats/${myFloat.id}/reconcile`, {
        physical_count: parseFloat(physicalCount),
        notes: reconcileNotes,
        return_to_vault: returnToVault,
      });
    },
    onSuccess: (data: any) => {
      refetchFloat();
      refetchShortages();
      
      if (data.requires_approval) {
        setShowReconcile(false);
        const pendingShortage = myShortages?.shortages?.find(s => s.status === "pending");
        if (pendingShortage) {
          setPendingShortageId(pendingShortage.id);
        }
        setShowShortageApproval(true);
        toast({ 
          title: "Shortage Detected - Manager Approval Required",
          description: `Shortage of ${symbol} ${Math.abs(data.variance).toLocaleString()} requires manager approval to close the day.`,
          variant: "destructive"
        });
      } else {
        setShowReconcile(false);
        setPhysicalCount("");
        setReconcileNotes("");
        setReturnToVault(true);
        const variance = data.variance || 0;
        const status = variance < 0 ? "Shortage" : variance > 0 ? "Overage" : "Balanced";
        const vaultMessage = data.returned_to_vault ? " - Cash returned to vault" : "";
        toast({ 
          title: "Float reconciled successfully",
          description: `${status}: ${symbol} ${Math.abs(variance).toLocaleString()}${vaultMessage}`
        });
      }
    },
    onError: () => {
      toast({ title: "Failed to reconcile float", variant: "destructive" });
    },
  });

  const approveShortagueMutation = useMutation({
    mutationFn: async () => {
      if (!pendingShortageId) throw new Error("No shortage to approve");
      return apiRequest("POST", `/api/organizations/${organizationId}/shortages/${pendingShortageId}/approve`, {
        email: approverEmail,
        password: approverPassword,
        action: shortageAction,
        notes: approvalNotes,
      });
    },
    onSuccess: (data: any) => {
      refetchFloat();
      refetchShortages();
      setShowShortageApproval(false);
      setPendingShortageId(null);
      setApproverEmail("");
      setApproverPassword("");
      setApprovalNotes("");
      setPhysicalCount("");
      setReconcileNotes("");
      toast({ 
        title: "Shortage Approved",
        description: data.message 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Approval Failed", 
        description: error?.message || "Invalid credentials or insufficient permissions",
        variant: "destructive" 
      });
    },
  });

  const requestReplenishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/organizations/${organizationId}/floats/my/request-replenishment`, {
        amount: parseFloat(replenishAmount),
        reason: replenishReason,
      });
    },
    onSuccess: () => {
      setShowReplenishRequest(false);
      setReplenishAmount("");
      setReplenishReason("");
      toast({ title: "Replenishment request submitted" });
    },
    onError: () => {
      toast({ title: "Failed to submit request", variant: "destructive" });
    },
  });

  interface PendingHandover {
    id: string;
    from_staff_id: string;
    from_staff_name: string | null;
    amount: number;
    notes: string | null;
    created_at: string;
  }

  const { data: pendingHandovers, refetch: refetchHandovers } = useQuery<{ handovers: PendingHandover[] }>({
    queryKey: ["/api/organizations", organizationId, "shift-handovers", "pending"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/shift-handovers?status=pending`, { credentials: "include" });
      if (!res.ok) return { handovers: [] };
      return res.json();
    },
  });

  const myPendingHandovers = pendingHandovers?.handovers?.filter(h => h.from_staff_id !== myStaffInfo?.id) || [];
  const mySentHandovers = pendingHandovers?.handovers?.filter(h => h.from_staff_id === myStaffInfo?.id) || [];

  const cancelHandoverMutation = useMutation({
    mutationFn: async (handoverId: string) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/shift-handovers/${handoverId}/cancel`);
    },
    onSuccess: () => {
      refetchFloat();
      refetchHandovers();
      toast({ title: "Handover Cancelled", description: "The pending handover has been cancelled." });
    },
    onError: (error: any) => {
      toast({ title: "Cancel Failed", description: error?.message || "Failed to cancel handover", variant: "destructive" });
    },
  });

  const initiateHandoverMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/organizations/${organizationId}/shift-handovers`, {
        to_staff_id: handoverToStaffId,
        amount: parseFloat(handoverAmount),
        notes: handoverNotes || undefined,
      });
    },
    onSuccess: () => {
      setShowHandoverDialog(false);
      setHandoverToStaffId("");
      setHandoverAmount("");
      setHandoverNotes("");
      setHandoverStaffSearch("");
      refetchFloat();
      refetchHandovers();
      toast({ title: "Handover Initiated", description: "Waiting for receiving teller to accept." });
    },
    onError: (error: any) => {
      toast({ title: "Handover Failed", description: error?.message || "Failed to initiate handover", variant: "destructive" });
    },
  });

  const acknowledgeHandoverMutation = useMutation({
    mutationFn: async ({ handoverId, action, notes }: { handoverId: string; action: "accept" | "reject"; notes?: string }) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/shift-handovers/${handoverId}/acknowledge`, {
        action,
        notes,
      });
    },
    onSuccess: (_, variables) => {
      refetchFloat();
      refetchHandovers();
      toast({ 
        title: variables.action === "accept" ? "Handover Accepted" : "Handover Rejected",
        description: variables.action === "accept" ? "Cash has been added to your float." : "The handover has been rejected."
      });
    },
    onError: (error: any) => {
      toast({ title: "Action Failed", description: error?.message || "Failed to process handover", variant: "destructive" });
    },
  });

  // Show loading state while checking permissions
  if (permissionsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Show member statement page
  if (showStatementPage && selectedMember) {
    return (
      <MemberStatementPage
        organizationId={organizationId}
        memberId={selectedMember.id}
        onBack={() => setShowStatementPage(false)}
      />
    );
  }

  // Only tellers and admins can access the teller station
  if (!canAccessTellerStation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <ShieldAlert className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">
            The Teller Station is only available to staff members with the Teller role.
            Please contact your administrator if you need access.
          </p>
          <Badge variant="outline" className="text-sm">
            Your role: {myStaffInfo?.role || "Unknown"}
          </Badge>
        </div>
      </div>
    );
  }

  // Show branch and teller selection screen for admins before accessing teller station
  if (isAdmin && (!selectedBranchId || !selectedTellerId)) {
    const selectedBranch = branches?.find(b => b.id === selectedBranchId);
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                <Banknote className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Teller Station Setup</CardTitle>
              <CardDescription>
                Select a branch and teller to operate as before accessing the teller station
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!(branches && branches.length === 1) && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Branch</Label>
                <Select
                  value={selectedBranchId || ""}
                  onValueChange={(value) => {
                    setSelectedBranchId(value || null);
                    setSelectedTellerId(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Teller</Label>
                <Select
                  value={selectedTellerId || ""}
                  onValueChange={(value) => setSelectedTellerId(value || null)}
                  disabled={!selectedBranchId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={selectedBranchId ? "Select a teller" : "Select a branch first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTellers.length > 0 ? (
                      filteredTellers.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.first_name} {staff.last_name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No tellers found in {selectedBranch?.name || "this branch"}
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {selectedBranchId && filteredTellers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No tellers are assigned to this branch. Please assign staff with the Teller role first.
                  </p>
                )}
              </div>

              {selectedBranchId && selectedTellerId && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Ready to proceed to the teller station
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const myActiveCounter = activeCounters?.find(c => c.staff_id === myStaffInfo?.id);
  const effectiveCounterNumber = counterNumber || (myActiveCounter ? myActiveCounter.counter_number : null);

  if (!effectiveCounterNumber) {
    const getCounterStatus = (num: number) => {
      const taken = activeCounters?.find(c => c.counter_number === String(num));
      if (!taken) return null;
      if (taken.staff_id === myStaffInfo?.id) return { mine: true, name: "You" };
      return { mine: false, name: taken.staff_name || "Another teller" };
    };
    const isCounterInputTaken = () => {
      if (!counterInput.trim()) return false;
      const taken = activeCounters?.find(c => c.counter_number === counterInput.trim());
      return taken && taken.staff_id !== myStaffInfo?.id;
    };

    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                <Banknote className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Select Your Counter</CardTitle>
              <CardDescription>
                Choose your counter number before starting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                  const status = getCounterStatus(num);
                  const isTaken = status && !status.mine;
                  return (
                    <div key={num} className="relative">
                      <Button
                        variant={counterInput === String(num) ? "default" : isTaken ? "ghost" : "outline"}
                        className={`h-12 w-full text-lg font-bold ${isTaken ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                        onClick={() => !isTaken && setCounterInput(String(num))}
                        disabled={!!isTaken}
                      >
                        {num}
                      </Button>
                      {status && (
                        <span className={`absolute -bottom-1 left-0 right-0 text-[10px] text-center truncate px-1 ${status.mine ? "text-green-600" : "text-red-500"}`}>
                          {status.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Or type counter number"
                  value={counterInput}
                  onChange={(e) => setCounterInput(e.target.value)}
                  className="text-center font-medium"
                />
              </div>
              {isCounterInputTaken() && (
                <p className="text-sm text-red-500 text-center">
                  Counter {counterInput} is already in use by {activeCounters?.find(c => c.counter_number === counterInput.trim())?.staff_name || "another teller"}
                </p>
              )}
              <Button
                className="w-full"
                size="lg"
                disabled={!counterInput.trim() || !!isCounterInputTaken()}
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/organizations/${organizationId}/floats/set-counter?counter_number=${encodeURIComponent(counterInput.trim())}`, {
                      method: "POST",
                      credentials: "include",
                    });
                    if (!res.ok) {
                      const err = await res.json();
                      toast({ title: "Counter Unavailable", description: err.detail || "Failed to set counter", variant: "destructive" });
                      refetchCounters();
                      return;
                    }
                    setCounterNumber(counterInput.trim());
                    refetchCounters();
                  } catch (e: any) {
                    toast({ title: "Error", description: e.message, variant: "destructive" });
                  }
                }}
              >
                Start Teller Station
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-bold">Teller Station</h2>
          </div>
          <RefreshButton organizationId={organizationId} />
        </div>
        {isAdmin && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedBranchId || ""}
                  onValueChange={(value) => {
                    setSelectedBranchId(value || null);
                    setSelectedTellerId(null);
                  }}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedTellerId || ""}
                  onValueChange={(value) => setSelectedTellerId(value || null)}
                  disabled={!selectedBranchId}
                >
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <SelectValue placeholder={selectedBranchId ? "Select teller" : "Select branch first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTellers.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.first_name} {staff.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        {/* Queue Panel */}
        {myStaffInfo?.branch_id && (
          <div className="mb-3 p-2 border rounded-lg flex flex-wrap items-center justify-between gap-2 bg-card">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs font-bold">Counter {effectiveCounterNumber}</Badge>
                <Ticket className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Queue:</span>
                <Badge variant="secondary" className="text-xs">{waitingCount} waiting</Badge>
              </div>
              
              {currentlyServing ? (
                <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-950 rounded text-sm">
                  <UserCheck className="h-4 w-4 text-blue-600" />
                  <span className="font-bold">{currentlyServing.ticket_number}</span>
                  <span className="text-muted-foreground">
                    {currentlyServing.member_name || "Guest"}
                  </span>
                  <Button 
                    size="sm" 
                    className="h-6 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => completeTicketMutation.mutate(currentlyServing.id)}
                    disabled={completeTicketMutation.isPending}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Done
                  </Button>
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">No customer being served</span>
              )}
            </div>
            
            <Button 
              size="sm"
              onClick={() => callNextMutation.mutate()}
              disabled={callNextMutation.isPending || waitingCount === 0}
              className="h-7 text-xs gap-1"
            >
              <PhoneCall className="h-3 w-3" />
              {callNextMutation.isPending ? "Calling..." : "Call Next"}
            </Button>
          </div>
        )}

        {/* Shortage Warning Banner */}
        {myShortages && myShortages.total_outstanding > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Outstanding Cash Shortages</AlertTitle>
            <AlertDescription>
              You have outstanding shortages totaling <strong>{symbol} {myShortages.total_outstanding.toLocaleString()}</strong>.
              {myShortages.total_pending > 0 && (
                <span className="block mt-1">
                  Pending approval: {symbol} {myShortages.total_pending.toLocaleString()}
                </span>
              )}
              {myShortages.total_held > 0 && (
                <span className="block mt-1">
                  Held (awaiting resolution): {symbol} {myShortages.total_held.toLocaleString()}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Approval Status */}
        {myFloat?.status === "pending_approval" && (
          <Alert variant="destructive" className="mb-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Manager Approval Required</AlertTitle>
            <AlertDescription>
              Your end-of-day reconciliation shows a shortage that requires manager approval before closing.
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2 ml-2"
                onClick={() => {
                  const pendingShortage = myShortages?.shortages?.find(s => s.status === "pending");
                  if (pendingShortage) {
                    setPendingShortageId(pendingShortage.id);
                    setShowShortageApproval(true);
                  }
                }}
              >
                Request Manager Approval
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Incoming Handovers */}
        {myPendingHandovers.length > 0 && (
          <Alert className="mb-4 border-blue-500/50 bg-blue-50 dark:bg-blue-900/10">
            <ArrowRightLeft className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700 dark:text-blue-400">Pending Shift Handovers</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                {myPendingHandovers.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-2 bg-background rounded border">
                    <div>
                      <span className="font-medium">{h.from_staff_name || "Unknown"}</span>
                      <span className="mx-2">wants to hand over</span>
                      <span className="font-bold text-green-600">{symbol} {h.amount.toLocaleString()}</span>
                      {h.notes && <span className="text-muted-foreground ml-2">({h.notes})</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => acknowledgeHandoverMutation.mutate({ handoverId: h.id, action: "accept" })}
                        disabled={acknowledgeHandoverMutation.isPending}
                      >
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => acknowledgeHandoverMutation.mutate({ handoverId: h.id, action: "reject" })}
                        disabled={acknowledgeHandoverMutation.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {mySentHandovers.length > 0 && (
          <Alert className="mb-4 border-amber-500/50 bg-amber-50 dark:bg-amber-900/10">
            <ArrowRightLeft className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700 dark:text-amber-400">Outgoing Handovers (Pending)</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                {mySentHandovers.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-2 bg-background rounded border">
                    <div>
                      <span className="text-sm">Waiting for </span>
                      <span className="font-medium">{h.to_staff_name || "Unknown"}</span>
                      <span className="text-sm"> to accept </span>
                      <span className="font-bold text-green-600">{symbol} {h.amount.toLocaleString()}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => cancelHandoverMutation.mutate(h.id)}
                      disabled={cancelHandoverMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {myFloat && (
          <div className="mb-4 p-3 border-2 border-primary/20 bg-primary/5 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span className="font-semibold">Cash Float</span>
                <Badge variant={
                  myFloat.status === "open" ? "default" : 
                  myFloat.status === "pending_approval" ? "destructive" : 
                  "secondary"
                } className="text-xs">
                  {myFloat.status === "open" ? "Active" : 
                   myFloat.status === "pending_approval" ? "Pending Approval" : 
                   "Reconciled"}
                </Badge>
                <span className="text-xs text-muted-foreground ml-2">
                  ({todayTransactions?.length || 0} transactions today)
                </span>
              </div>
              {myFloat.status === "open" && canWrite && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowReplenishRequest(true)}>
                    Request Cash
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setShowHandoverDialog(true)}>
                    <ArrowRightLeft className="h-3 w-3 mr-1" />
                    Handover
                  </Button>
                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => setShowReconcile(true)}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    End of Day
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Opening:</span>
                <span className="ml-1 font-medium">{symbol} {myFloat.opening_balance.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Deposits:</span>
                <span className="ml-1 font-medium text-green-600">+{myFloat.deposits_in.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Withdrawals:</span>
                <span className="ml-1 font-medium text-red-600">-{myFloat.withdrawals_out.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Replenish:</span>
                <span className="ml-1 font-medium text-blue-600">+{myFloat.replenishments.toLocaleString()}</span>
              </div>
              <div className="ml-auto bg-background px-3 py-1 rounded border">
                <span className="text-muted-foreground">Balance:</span>
                <span className="ml-1 font-bold text-primary">{symbol} {myFloat.current_balance.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {showReconcile && myFloat && (
          <Card className="mb-6 border-2 border-orange-500/20 bg-orange-50 dark:bg-orange-900/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-orange-600" />
                End of Day Reconciliation
              </CardTitle>
              <CardDescription>Count your physical cash and close the day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="p-4 bg-background rounded-lg border">
                    <p className="text-sm text-muted-foreground">Expected Cash Balance</p>
                    <p className="text-2xl font-bold">{symbol} {myFloat.current_balance.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Opening ({myFloat.opening_balance.toLocaleString()}) + Deposits ({myFloat.deposits_in.toLocaleString()}) 
                      + Replenishments ({myFloat.replenishments.toLocaleString()}) - Withdrawals ({myFloat.withdrawals_out.toLocaleString()})
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Physical Cash Count ({currency})</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter counted amount"
                      value={physicalCount}
                      onChange={(e) => setPhysicalCount(e.target.value)}
                    />
                  </div>
                  {physicalCount && (
                    <div className={`p-3 rounded-lg ${
                      parseFloat(physicalCount) === myFloat.current_balance ? 'bg-green-100 dark:bg-green-900/20' :
                      parseFloat(physicalCount) < myFloat.current_balance ? 'bg-red-100 dark:bg-red-900/20' :
                      'bg-yellow-100 dark:bg-yellow-900/20'
                    }`}>
                      <p className="text-sm font-medium">
                        {parseFloat(physicalCount) === myFloat.current_balance ? 'Balanced' :
                         parseFloat(physicalCount) < myFloat.current_balance ? 'Shortage' : 'Overage'}
                      </p>
                      <p className="text-lg font-bold">
                        {symbol} {Math.abs(parseFloat(physicalCount) - myFloat.current_balance).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Notes (Optional)</label>
                    <Input
                      placeholder="Any notes about the reconciliation"
                      value={reconcileNotes}
                      onChange={(e) => setReconcileNotes(e.target.value)}
                    />
                  </div>
                  
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="returnToVault"
                        checked={returnToVault}
                        onCheckedChange={(checked) => setReturnToVault(checked === true)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="returnToVault" className="font-medium cursor-pointer">
                          Return cash to vault
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {returnToVault 
                            ? `All cash will be returned to the vault. Tomorrow you'll start with ${symbol} 0 until supervisor allocates new float.`
                            : "Cash will stay with you. Tomorrow you'll start with today's closing balance."}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowReconcile(false)}>Cancel</Button>
                    <Button 
                      onClick={() => reconcileMutation.mutate()}
                      disabled={!physicalCount || reconcileMutation.isPending}
                    >
                      {reconcileMutation.isPending ? "Reconciling..." : "Complete Reconciliation"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {showReplenishRequest && (
          <Card className="mb-6 border-2 border-blue-500/20 bg-blue-50 dark:bg-blue-900/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                Request Cash Replenishment
              </CardTitle>
              <CardDescription>Request additional cash from your supervisor</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Amount Needed ({currency})</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter amount"
                    value={replenishAmount}
                    onChange={(e) => setReplenishAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <Input
                    placeholder="Why do you need more cash?"
                    value={replenishReason}
                    onChange={(e) => setReplenishReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowReplenishRequest(false)}>Cancel</Button>
                <Button 
                  onClick={() => requestReplenishMutation.mutate()}
                  disabled={!replenishAmount || !replenishReason || requestReplenishMutation.isPending}
                >
                  {requestReplenishMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!myFloat && (
          <Card className="mb-6 border-2 border-yellow-500/20 bg-yellow-50 dark:bg-yellow-900/10">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-6 w-6 text-yellow-600" />
                <div>
                  <p className="font-medium">No Cash Float Allocated</p>
                  <p className="text-sm text-muted-foreground">Please request a cash float from your supervisor before processing withdrawals.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin && !selectedTellerId && (
          <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-300">
            Showing totals for <strong>all tellers</strong> organization-wide. Select a teller above to see their individual stats.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Member Lookup
              </CardTitle>
              <CardDescription>Search by name, member number, ID number, phone or email</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  placeholder="Search member..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />

                {memberSearch && filteredMembers && filteredMembers.length > 0 && (
                  <div className="border rounded-md divide-y">
                    {filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        className="w-full p-3 text-left hover:bg-muted transition-colors"
                        onClick={() => handleSelectMember(member)}
                      >
                        <div className="font-medium">{member.first_name} {member.last_name}</div>
                        <div className="text-sm text-muted-foreground">{member.member_number} • {member.phone}</div>
                      </button>
                    ))}
                  </div>
                )}

                {membersLoading && memberSearch && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Loading members...
                  </div>
                )}

                {membersError && (
                  <div className="text-sm text-destructive text-center py-4">
                    Unable to load members. Your role may need the "Members: Read" permission. Contact your administrator.
                  </div>
                )}

                {memberSearch && memberSearch.length >= 2 && !membersLoading && !membersError && (!filteredMembers || filteredMembers.length === 0) && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No members found matching "{memberSearch}"
                  </div>
                )}

                {selectedMember && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                          {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold">{selectedMember.first_name} {selectedMember.last_name}</div>
                          <div className="text-sm text-muted-foreground">{selectedMember.member_number}</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Savings:</span>
                          <span className="font-medium">{symbol} {(selectedMember.savings_balance || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Shares:</span>
                          <span className="font-medium">{symbol} {(selectedMember.shares_balance || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Deposits:</span>
                          <span className="font-medium">{symbol} {(selectedMember.deposits_balance || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setShowStatementPage(true)}
                        >
                          View Statement
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setSelectedMember(null)}
                        >
                          Clear
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Quick Transactions</CardTitle>
              <CardDescription>Process member transactions quickly</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="deposit" className="flex items-center gap-2">
                    <ArrowDownLeft className="h-4 w-4" />
                    Deposit
                  </TabsTrigger>
                  <TabsTrigger value="withdrawal" className="flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4" />
                    Withdrawal
                  </TabsTrigger>
                  <TabsTrigger value="repayment" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Loan Repayment
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="deposit" className="mt-4">
                  {isAdmin && !selectedTellerId && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm mb-4">
                      <strong>Admin Notice:</strong> Please select a teller from the dropdown above before processing transactions. 
                      Transactions must be linked to a teller's float for proper cash tracking and accountability.
                    </div>
                  )}
                  <Form {...depositForm}>
                    <form onSubmit={depositForm.handleSubmit((data) => depositMutation.mutate(data))} className="space-y-4">
                      {!selectedMember && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm">
                          Please select a member from the lookup first
                        </div>
                      )}

                      {selectedMember && (
                        <div className="p-3 bg-muted rounded-md">
                          <span className="font-medium">{selectedMember.first_name} {selectedMember.last_name}</span>
                          <span className="text-muted-foreground"> ({selectedMember.member_number})</span>
                        </div>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={depositForm.control}
                          name="account_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="savings">Savings</SelectItem>
                                  <SelectItem value="shares">Shares</SelectItem>
                                  <SelectItem value="deposits">Fixed Deposits</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={depositForm.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount ({currency})</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min="1" placeholder="0.00" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={depositForm.control}
                          name="payment_method"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Method</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  {hasMpesa && <SelectItem value="mpesa">M-Pesa</SelectItem>}
                                  {hasBankIntegration && <SelectItem value="bank_transfer">Bank Transfer</SelectItem>}
                                  <SelectItem value="cheque">Cheque</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={depositForm.control}
                          name="reference"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reference (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Receipt code, cheque no." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {depositPaymentMethod === "mpesa" && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md space-y-3">
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">M-Pesa Payment</p>
                          <div className="flex gap-2">
                            <FormField
                              control={depositForm.control}
                              name="mpesa_phone"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input {...field} placeholder="Phone number (e.g., 0712345678)" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleSendStkPush}
                              disabled={stkPushLoading || !selectedMember}
                              className="shrink-0"
                            >
                              {stkPushLoading ? "Sending..." : "Send STK Push"}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Send an M-Pesa payment prompt to member's phone, then enter the confirmation code as reference
                          </p>
                        </div>
                      )}

                      {canWrite && depositPaymentMethod !== "mpesa" ? (
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={!selectedMember || depositMutation.isPending || (isAdmin && !selectedTellerId)}
                        >
                          {depositMutation.isPending ? "Processing..." : "Record Deposit"}
                        </Button>
                      ) : depositPaymentMethod === "mpesa" ? null : (
                        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          You don't have permission to process deposits
                        </div>
                      )}
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="withdrawal" className="mt-4">
                  {isAdmin && !selectedTellerId && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm mb-4">
                      <strong>Admin Notice:</strong> Please select a teller from the dropdown above before processing transactions. 
                      Transactions must be linked to a teller's float for proper cash tracking and accountability.
                    </div>
                  )}
                  <Form {...withdrawalForm}>
                    <form onSubmit={withdrawalForm.handleSubmit((data) => withdrawalMutation.mutate(data))} className="space-y-4">
                      {!selectedMember && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm">
                          Please select a member from the lookup first
                        </div>
                      )}

                      {selectedMember && (
                        <div className="p-3 bg-muted rounded-md">
                          <span className="font-medium">{selectedMember.first_name} {selectedMember.last_name}</span>
                          <span className="text-muted-foreground"> ({selectedMember.member_number})</span>
                        </div>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={withdrawalForm.control}
                          name="account_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="savings">
                                    Savings (Bal: {symbol} {(selectedMember?.savings_balance || 0).toLocaleString()})
                                  </SelectItem>
                                  <SelectItem value="shares">
                                    Shares (Bal: {symbol} {(selectedMember?.shares_balance || 0).toLocaleString()})
                                  </SelectItem>
                                  <SelectItem value="deposits">
                                    Fixed Deposits (Bal: {symbol} {(selectedMember?.deposits_balance || 0).toLocaleString()})
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={withdrawalForm.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount ({currency})</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min="1" placeholder="0.00" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={withdrawalForm.control}
                          name="payment_method"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Method</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  {hasMpesa && <SelectItem value="mpesa">M-Pesa</SelectItem>}
                                  {hasBankIntegration && <SelectItem value="bank_transfer">Bank Transfer</SelectItem>}
                                  <SelectItem value="cheque">Cheque</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={withdrawalForm.control}
                          name="reference"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reference (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Receipt code, cheque no." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {canWrite ? (
                        <Button 
                          type="submit" 
                          className="w-full" 
                          variant="destructive"
                          disabled={!selectedMember || withdrawalMutation.isPending || (isAdmin && !selectedTellerId)}
                        >
                          {withdrawalMutation.isPending ? "Processing..." : "Process Withdrawal"}
                        </Button>
                      ) : (
                        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          You don't have permission to process withdrawals
                        </div>
                      )}
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="repayment" className="mt-4">
                  {isAdmin && !selectedTellerId && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm mb-4">
                      <strong>Admin Notice:</strong> Please select a teller from the dropdown above before processing transactions. 
                      Transactions must be linked to a teller's float for proper cash tracking and accountability.
                    </div>
                  )}
                  <Form {...repaymentForm}>
                    <form onSubmit={repaymentForm.handleSubmit((data) => repaymentMutation.mutate(data))} className="space-y-4">
                      {!selectedMember && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm">
                          Please select a member from the lookup first to see their active loans
                        </div>
                      )}

                      {selectedMember && memberLoans && memberLoans.length === 0 && (
                        <div className="p-4 bg-muted rounded-md text-sm">
                          This member has no active loans requiring repayment
                        </div>
                      )}

                      {selectedMember && memberLoans && memberLoans.length > 0 && (
                        <>
                          <FormField
                            control={repaymentForm.control}
                            name="loan_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Select Loan</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a loan" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {memberLoans.map((loan) => (
                                      <SelectItem key={loan.id} value={loan.id}>
                                        {loan.loan_number} - Outstanding: {symbol} {(loan.outstanding_balance || 0).toLocaleString()}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={repaymentForm.control}
                              name="amount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Repayment Amount ({currency})</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" min="1" placeholder="0.00" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={repaymentForm.control}
                              name="payment_method"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Payment Method</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="cash">Cash</SelectItem>
                                      {hasMpesa && <SelectItem value="mpesa">M-Pesa</SelectItem>}
                                      {hasBankIntegration && <SelectItem value="bank_transfer">Bank Transfer</SelectItem>}
                                      <SelectItem value="cheque">Cheque</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={repaymentForm.control}
                            name="reference"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Reference (Optional)</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="M-Pesa code, receipt no." />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {canWrite ? (
                            <Button 
                              type="submit" 
                              className="w-full"
                              disabled={repaymentMutation.isPending || (isAdmin && !selectedTellerId)}
                            >
                              {repaymentMutation.isPending ? "Processing..." : "Record Repayment"}
                            </Button>
                          ) : (
                            <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground flex items-center gap-2">
                              <Lock className="h-4 w-4" />
                              You don't have permission to process repayments
                            </div>
                          )}
                        </>
                      )}
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Today's Transactions
            </CardTitle>
            <CardDescription>Your transactions processed today</CardDescription>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : todayTransactions && todayTransactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayTransactions.slice(0, 10).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.transaction_number}</TableCell>
                      <TableCell>
                        <Badge variant={tx.transaction_type === "deposit" ? "default" : "destructive"}>
                          {tx.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{tx.account_type}</TableCell>
                      <TableCell className={`text-right font-medium ${tx.transaction_type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                        {tx.transaction_type === "deposit" ? "+" : "-"}{symbol} {tx.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions processed yet today
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manager Approval Dialog */}
      <Dialog open={showShortageApproval} onOpenChange={setShowShortageApproval}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-600" />
              Manager Shortage Approval
            </DialogTitle>
            <DialogDescription>
              A manager with shortage approval permission must authenticate to approve this shortage.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {myShortages?.shortages?.find(s => s.id === pendingShortageId) && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Shortage Amount: {symbol} {myShortages.shortages.find(s => s.id === pendingShortageId)?.shortage_amount.toLocaleString()}
                </p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                  Date: {myShortages.shortages.find(s => s.id === pendingShortageId)?.date}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="approver-email">Manager Email</Label>
              <Input
                id="approver-email"
                type="email"
                placeholder="manager@example.com"
                value={approverEmail}
                onChange={(e) => setApproverEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="approver-password">Password</Label>
              <Input
                id="approver-password"
                type="password"
                placeholder="Enter password"
                value={approverPassword}
                onChange={(e) => setApproverPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={shortageAction}
                onValueChange={(value: "deduct" | "hold" | "expense") => setShortageAction(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deduct">
                    <span className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Deduct from Teller Salary
                    </span>
                  </SelectItem>
                  <SelectItem value="hold">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Hold (Keep as Warning)
                    </span>
                  </SelectItem>
                  <SelectItem value="expense">
                    <span className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Write Off as Expense
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {shortageAction === "deduct" 
                  ? "The shortage will be recorded as a salary deduction for the teller."
                  : shortageAction === "hold"
                  ? "The shortage will remain visible as a warning until resolved."
                  : "The shortage will be written off as an organizational expense."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="approval-notes">Notes (Optional)</Label>
              <Input
                id="approval-notes"
                placeholder="Add any notes..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowShortageApproval(false);
              setApproverEmail("");
              setApproverPassword("");
              setApprovalNotes("");
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => approveShortagueMutation.mutate()}
              disabled={!approverEmail || !approverPassword || approveShortagueMutation.isPending}
            >
              {approveShortagueMutation.isPending ? "Approving..." : "Approve & Close Day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHandoverDialog} onOpenChange={setShowHandoverDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Shift Handover
            </DialogTitle>
            <DialogDescription>
              Transfer cash from your float to another teller
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Your Current Balance</p>
              <p className="text-xl font-bold">{symbol} {myFloat?.current_balance?.toLocaleString() || 0}</p>
            </div>

            <div className="space-y-2">
              <Label>Hand Over To</Label>
              {handoverToStaffId ? (
                <div className="flex items-center justify-between p-3 border rounded-md bg-muted">
                  <div>
                    <div className="font-medium">
                      {(handoverStaffList || []).find(s => s.id === handoverToStaffId)?.first_name}{" "}
                      {(handoverStaffList || []).find(s => s.id === handoverToStaffId)?.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(handoverStaffList || []).find(s => s.id === handoverToStaffId)?.email || (handoverStaffList || []).find(s => s.id === handoverToStaffId)?.role}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setHandoverToStaffId("")}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Search by name or email..."
                    value={handoverStaffSearch}
                    onChange={(e) => setHandoverStaffSearch(e.target.value)}
                  />
                  {handoverStaffSearch && (
                    <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                      {(handoverStaffList || []).filter(s => {
                        if (s.id === myStaffInfo?.id) return false;
                        const search = handoverStaffSearch.toLowerCase();
                        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
                        const email = (s.email || "").toLowerCase();
                        return fullName.includes(search) || email.includes(search);
                      }).slice(0, 5).map((staff) => (
                        <button
                          key={staff.id}
                          className="w-full p-3 text-left hover:bg-muted transition-colors"
                          onClick={() => {
                            setHandoverToStaffId(staff.id);
                            setHandoverStaffSearch("");
                          }}
                        >
                          <div className="font-medium">{staff.first_name} {staff.last_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {staff.role}{staff.email ? ` • ${staff.email}` : ""}
                          </div>
                        </button>
                      ))}
                      {(handoverStaffList || []).filter(s => {
                        if (s.id === myStaffInfo?.id) return false;
                        const search = handoverStaffSearch.toLowerCase();
                        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
                        const email = (s.email || "").toLowerCase();
                        return fullName.includes(search) || email.includes(search);
                      }).length === 0 && (
                        <div className="p-3 text-center text-muted-foreground">No staff found</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="handover-amount">Amount ({currency})</Label>
              <Input
                id="handover-amount"
                type="number"
                step="0.01"
                placeholder="Enter amount to handover"
                value={handoverAmount}
                onChange={(e) => setHandoverAmount(e.target.value)}
              />
              {handoverAmount && parseFloat(handoverAmount) > (myFloat?.current_balance || 0) && (
                <p className="text-sm text-red-500">Amount exceeds your current balance</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="handover-notes">Notes (Optional)</Label>
              <Input
                id="handover-notes"
                placeholder="Reason for handover..."
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowHandoverDialog(false);
              setHandoverToStaffId("");
              setHandoverAmount("");
              setHandoverNotes("");
              setHandoverStaffSearch("");
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => initiateHandoverMutation.mutate()}
              disabled={
                !handoverToStaffId || 
                !handoverAmount || 
                parseFloat(handoverAmount) <= 0 ||
                parseFloat(handoverAmount) > (myFloat?.current_balance || 0) ||
                initiateHandoverMutation.isPending
              }
            >
              {initiateHandoverMutation.isPending ? "Processing..." : "Initiate Handover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
