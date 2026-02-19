import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { 
  Wallet, 
  Plus, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  ArrowUpRight,
  Clock,
  Users,
  DollarSign,
  AlertTriangle,
  Building2,
  ArrowRightLeft,
  FileText,
  Download,
  Vault,
  Shield
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCurrency } from "@/hooks/use-currency";

interface FloatManagementProps {
  organizationId: string;
}

interface TellerFloat {
  id: string;
  staff_id: string;
  staff_name: string;
  branch_id: string;
  branch_name: string;
  date: string;
  opening_balance: number;
  current_balance: number;
  deposits_in: number;
  withdrawals_out: number;
  replenishments: number;
  returns_to_vault: number;
  closing_balance: number | null;
  physical_count: number | null;
  variance: number | null;
  status: string;
  reconciled_at: string | null;
  notes: string | null;
}

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  staff_number: string;
  role: string;
  branch_id: string;
}

interface PendingRequest {
  id: string;
  teller_float_id: string;
  staff_name: string;
  amount: number;
  reason: string;
  current_balance: number;
  created_at: string;
}

interface BranchVault {
  id: string;
  branch_id: string;
  branch_name: string;
  current_balance: number;
  last_updated: string | null;
}

interface PendingVaultReturn {
  id: string;
  teller_float_id: string;
  staff_id: string;
  staff_name: string;
  branch_id: string;
  branch_name: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

interface ShiftHandover {
  id: string;
  from_staff_id: string;
  from_staff_name: string | null;
  to_staff_id: string;
  to_staff_name: string | null;
  branch_name: string | null;
  amount: number;
  status: string;
  notes: string | null;
  from_acknowledged_at: string | null;
  to_acknowledged_at: string | null;
  created_at: string;
}

interface DailyCashPosition {
  report_date: string;
  branches: Array<{
    branch_id: string;
    branch_name: string;
    vault_balance: number;
    float_allocated: number;
    deposits_received: number;
    withdrawals_paid: number;
    total_cash_in_hand: number;
    teller_count: number;
    tellers: Array<{
      staff_name: string;
      opening_balance: number;
      current_balance: number;
      deposits: number;
      withdrawals: number;
      status: string;
    }>;
  }>;
  totals: {
    vault_balance: number;
    float_allocated: number;
    deposits_received: number;
    withdrawals_paid: number;
    total_cash_in_hand: number;
  };
}

const allocateSchema = z.object({
  staff_id: z.string().min(1, "Staff is required"),
  amount: z.string().min(1, "Amount is required"),
  notes: z.string().optional(),
});

const replenishSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  notes: z.string().optional(),
});

const vaultDepositSchema = z.object({
  branch_id: z.string().min(1, "Branch is required"),
  amount: z.string().min(1, "Amount is required"),
  source: z.string().min(1, "Source is required"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type AllocateFormData = z.infer<typeof allocateSchema>;
type ReplenishFormData = z.infer<typeof replenishSchema>;
type VaultDepositFormData = z.infer<typeof vaultDepositSchema>;

export default function FloatManagement({ organizationId }: FloatManagementProps) {
  const { toast } = useToast();
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.FLOAT_MANAGEMENT);
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [replenishOpen, setReplenishOpen] = useState(false);
  const [vaultDepositOpen, setVaultDepositOpen] = useState(false);
  const [selectedFloat, setSelectedFloat] = useState<TellerFloat | null>(null);
  const [selectedStaffForAllocation, setSelectedStaffForAllocation] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("floats");

  const { data: floats, isLoading: floatsLoading } = useQuery<TellerFloat[]>({
    queryKey: ["/api/organizations", organizationId, "floats"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/floats`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: staff } = useQuery<Staff[]>({
    queryKey: ["/api/organizations", organizationId, "staff"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/staff`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: pendingRequests, refetch: refetchRequests } = useQuery<PendingRequest[]>({
    queryKey: ["/api/organizations", organizationId, "floats", "pending-requests"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/floats/pending-requests`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: vaultsData, refetch: refetchVaults } = useQuery<{ vaults: BranchVault[] }>({
    queryKey: ["/api/organizations", organizationId, "vaults"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/vaults`, { credentials: "include" });
      if (!res.ok) return { vaults: [] };
      return res.json();
    },
  });

  const { data: pendingVaultReturns, refetch: refetchPendingReturns } = useQuery<{ pending_returns: PendingVaultReturn[], count: number }>({
    queryKey: ["/api/organizations", organizationId, "pending-vault-returns"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/pending-vault-returns`, { credentials: "include" });
      if (!res.ok) return { pending_returns: [], count: 0 };
      return res.json();
    },
  });

  const { data: shiftHandovers, refetch: refetchHandovers } = useQuery<{ handovers: ShiftHandover[] }>({
    queryKey: ["/api/organizations", organizationId, "shift-handovers"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/shift-handovers`, { credentials: "include" });
      if (!res.ok) return { handovers: [] };
      return res.json();
    },
  });

  const { data: dailyCashPosition, refetch: refetchDailyReport } = useQuery<DailyCashPosition>({
    queryKey: ["/api/organizations", organizationId, "daily-cash-position"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/daily-cash-position`, { credentials: "include" });
      if (!res.ok) return { report_date: "", branches: [], totals: { vault_balance: 0, float_allocated: 0, deposits_received: 0, withdrawals_paid: 0, total_cash_in_hand: 0 } };
      return res.json();
    },
  });

  const { data: branches } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/organizations", organizationId, "branches"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/branches`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: selectedStaffShortages } = useQuery<{
    shortages: Array<{
      id: string;
      date: string;
      shortage_amount: number;
      status: string;
    }>;
    total_pending: number;
    total_held: number;
    total_outstanding: number;
  }>({
    queryKey: ["/api/organizations", organizationId, "shortages", "pending", selectedStaffForAllocation],
    queryFn: async () => {
      if (!selectedStaffForAllocation) return { shortages: [], total_pending: 0, total_held: 0, total_outstanding: 0 };
      const res = await fetch(`/api/organizations/${organizationId}/shortages/pending/${selectedStaffForAllocation}`, { credentials: "include" });
      if (!res.ok) return { shortages: [], total_pending: 0, total_held: 0, total_outstanding: 0 };
      return res.json();
    },
    enabled: !!selectedStaffForAllocation,
  });

  const { data: heldShortages, isLoading: heldLoading } = useQuery<{
    shortages: Array<{
      id: string;
      staff_id: string;
      staff_name: string;
      branch_name: string;
      date: string;
      shortage_amount: number;
      status: string;
      notes: string;
      created_at: string;
    }>;
    total_held: number;
  }>({
    queryKey: ["/api/organizations", organizationId, "shortages", "held"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/shortages/held`, { credentials: "include" });
      if (!res.ok) return { shortages: [], total_held: 0 };
      return res.json();
    },
  });

  const [resolveShortageId, setResolveShortageId] = useState<string | null>(null);
  const [resolveAction, setResolveAction] = useState<string>("deduct");
  const [resolvePin, setResolvePin] = useState("");
  const [resolveStaffNumber, setResolveStaffNumber] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");

  const resolveHeldMutation = useMutation({
    mutationFn: async ({ shortageId, action, pin, staffNumber, notes }: { shortageId: string; action: string; pin: string; staffNumber: string; notes: string }) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/shortages/${shortageId}/approve`, {
        action,
        pin,
        staff_number: staffNumber,
        notes,
      });
    },
    onSuccess: (_, variables) => {
      const label = variables.action === "deduct" ? "Salary deduction" : "Expense write-off";
      toast({ title: `${label} applied successfully` });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "shortages", "held"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "floats"] });
      setResolveShortageId(null);
      setResolvePin("");
      setResolveStaffNumber("");
      setResolveNotes("");
    },
    onError: (error: any) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const allocateForm = useForm<AllocateFormData>({
    resolver: zodResolver(allocateSchema),
    defaultValues: { staff_id: "", amount: "", notes: "" },
  });

  const replenishForm = useForm<ReplenishFormData>({
    resolver: zodResolver(replenishSchema),
    defaultValues: { amount: "", notes: "" },
  });

  const vaultDepositForm = useForm<VaultDepositFormData>({
    resolver: zodResolver(vaultDepositSchema),
    defaultValues: { branch_id: "", amount: "", source: "", reference: "", notes: "" },
  });

  useEffect(() => {
    if (branches && branches.length === 1 && !vaultDepositForm.getValues("branch_id")) {
      vaultDepositForm.setValue("branch_id", branches[0].id);
    }
  }, [branches]);

  const allocateMutation = useMutation({
    mutationFn: async (data: AllocateFormData) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/floats/allocate`, {
        staff_id: data.staff_id,
        amount: parseFloat(data.amount),
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "floats"] });
      allocateForm.reset();
      setAllocateOpen(false);
      toast({ title: "Float allocated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to allocate float", variant: "destructive" });
    },
  });

  const replenishMutation = useMutation({
    mutationFn: async (data: ReplenishFormData) => {
      if (!selectedFloat) throw new Error("No float selected");
      return apiRequest("POST", `/api/organizations/${organizationId}/floats/${selectedFloat.id}/replenish`, {
        amount: parseFloat(data.amount),
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "floats"] });
      replenishForm.reset();
      setReplenishOpen(false);
      setSelectedFloat(null);
      toast({ title: "Float replenished successfully" });
    },
    onError: () => {
      toast({ title: "Failed to replenish float", variant: "destructive" });
    },
  });

  const reopenFloatMutation = useMutation({
    mutationFn: async (floatId: string) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/floats/${floatId}/reopen`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "floats"] });
      toast({ title: "Float reopened successfully" });
    },
    onError: () => {
      toast({ title: "Failed to reopen float", variant: "destructive" });
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/floats/requests/${requestId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "floats"] });
      refetchRequests();
      toast({ title: "Replenishment approved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to approve request", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/floats/requests/${requestId}/reject`, {});
    },
    onSuccess: () => {
      refetchRequests();
      toast({ title: "Request rejected" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reject request", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const vaultDepositMutation = useMutation({
    mutationFn: async (data: VaultDepositFormData) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/vaults/deposit`, {
        branch_id: data.branch_id,
        amount: parseFloat(data.amount),
        source: data.source,
        reference: data.reference,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "vaults"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "daily-cash-position"] });
      vaultDepositForm.reset();
      setVaultDepositOpen(false);
      toast({ title: "Vault deposit recorded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to record vault deposit", variant: "destructive" });
    },
  });

  const acceptVaultReturnMutation = useMutation({
    mutationFn: async (returnId: string) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/pending-vault-returns/${returnId}/review`, {
        action: "accept",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "vaults"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "floats"] });
      refetchPendingReturns();
      refetchDailyReport();
      toast({ title: "Vault return accepted - vault balance updated" });
    },
    onError: () => {
      toast({ title: "Failed to accept vault return", variant: "destructive" });
    },
  });

  const rejectVaultReturnMutation = useMutation({
    mutationFn: async (returnId: string) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/pending-vault-returns/${returnId}/review`, {
        action: "reject",
        notes: "Rejected by manager",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "floats"] });
      refetchPendingReturns();
      toast({ title: "Vault return rejected - teller can reconcile again" });
    },
    onError: () => {
      toast({ title: "Failed to reject vault return", variant: "destructive" });
    },
  });

  // Only show tellers in the float allocation dropdown
  const tellerStaff = staff?.filter(s => s.role === "teller") || [];

  const totalFloatAllocated = floats?.reduce((sum, f) => sum + f.current_balance, 0) || 0;
  const totalDeposits = floats?.reduce((sum, f) => sum + f.deposits_in, 0) || 0;
  const totalWithdrawals = floats?.reduce((sum, f) => sum + f.withdrawals_out, 0) || 0;

  if (floatsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const pendingReturnCount = pendingVaultReturns?.count || 0;
  const pendingRequestCount = pendingRequests?.length || 0;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Float Management</h2>
          <p className="text-sm text-muted-foreground">Manage teller floats, vault cash, and daily operations</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RefreshButton organizationId={organizationId} />
          {canWrite && (
            <Dialog open={vaultDepositOpen} onOpenChange={setVaultDepositOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add to Vault
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Money to Vault</DialogTitle>
                  <DialogDescription>Record a cash deposit to a branch vault</DialogDescription>
                </DialogHeader>
                <Form {...vaultDepositForm}>
                  <form onSubmit={vaultDepositForm.handleSubmit((data) => vaultDepositMutation.mutate(data))} className="space-y-4">
                    {!(branches && branches.length === 1) && (
                    <FormField
                      control={vaultDepositForm.control}
                      name="branch_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select branch" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {branches?.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )}
                    <FormField
                      control={vaultDepositForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount ({currency})</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={vaultDepositForm.control}
                      name="source"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select source" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="bank_withdrawal">Bank Withdrawal</SelectItem>
                              <SelectItem value="head_office">Head Office Transfer</SelectItem>
                              <SelectItem value="safe">Safe</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={vaultDepositForm.control}
                      name="reference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reference (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Bank slip no., receipt no." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={vaultDepositForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Any additional notes..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={vaultDepositMutation.isPending}>
                      {vaultDepositMutation.isPending ? "Recording..." : "Record Vault Deposit"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
          {canWrite && (
            <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Allocate Float
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Allocate Cash Float</DialogTitle>
                <DialogDescription>Allocate cash to a teller for the day</DialogDescription>
              </DialogHeader>
              <Form {...allocateForm}>
                <form onSubmit={allocateForm.handleSubmit((data) => allocateMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={allocateForm.control}
                    name="staff_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teller</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setSelectedStaffForAllocation(value);
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select teller" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tellerStaff.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.first_name} {s.last_name} ({s.staff_number})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {selectedStaffShortages && selectedStaffShortages.total_outstanding > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Outstanding Shortages Warning</AlertTitle>
                      <AlertDescription>
                        This teller has outstanding cash shortages totaling{" "}
                        <strong>{symbol} {selectedStaffShortages.total_outstanding.toLocaleString()}</strong>.
                        {selectedStaffShortages.total_pending > 0 && (
                          <span className="block mt-1">
                            Pending approval: {symbol} {selectedStaffShortages.total_pending.toLocaleString()}
                          </span>
                        )}
                        {selectedStaffShortages.total_held > 0 && (
                          <span className="block mt-1">
                            Held (unresolved): {symbol} {selectedStaffShortages.total_held.toLocaleString()}
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                  <FormField
                    control={allocateForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount ({currency})</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={allocateForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={allocateMutation.isPending}>
                    {allocateMutation.isPending ? "Allocating..." : "Allocate Float"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-6 h-auto flex-nowrap">
            <TabsTrigger value="floats" className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap">
              <Wallet className="h-4 w-4 shrink-0" />
              Floats
            </TabsTrigger>
            <TabsTrigger value="vault" className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap">
              <Building2 className="h-4 w-4 shrink-0" />
              Vault
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap relative">
              <Clock className="h-4 w-4 shrink-0" />
              Pending
              {(pendingReturnCount + pendingRequestCount) > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingReturnCount + pendingRequestCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="held" className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap relative" data-testid="tab-held-shortages">
              <Shield className="h-4 w-4 shrink-0" />
              Held
              {(heldShortages?.shortages?.length ?? 0) > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {heldShortages?.shortages?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="handovers" className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap">
              <ArrowRightLeft className="h-4 w-4 shrink-0" />
              Handovers
            </TabsTrigger>
            <TabsTrigger value="report" className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap">
              <FileText className="h-4 w-4 shrink-0" />
              Report
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="floats" className="space-y-4">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Float Allocated</CardTitle>
            <Wallet className="h-4 w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{symbol} {totalFloatAllocated.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{floats?.length || 0} active tellers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Deposits</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600 shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{symbol} {totalDeposits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Cash received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Withdrawals</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-red-600 shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{symbol} {totalWithdrawals.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Cash paid out</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingRequests?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
      </div>

      {pendingRequests && pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Replenishment Requests
            </CardTitle>
            <CardDescription>Approve or reject float replenishment requests from tellers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teller</TableHead>
                  <TableHead>Requested Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Current Balance</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead className="hidden md:table-cell">Requested At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.staff_name}</TableCell>
                    <TableCell>{symbol} {req.amount.toLocaleString()}</TableCell>
                    <TableCell className="hidden sm:table-cell">{symbol} {req.current_balance.toLocaleString()}</TableCell>
                    <TableCell className="max-w-[200px] truncate hidden md:table-cell">{req.reason}</TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(req.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {canWrite && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveRequestMutation.mutate(req.id)}
                            disabled={approveRequestMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectRequestMutation.mutate(req.id)}
                            disabled={rejectRequestMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Today's Teller Floats
          </CardTitle>
          <CardDescription>View and manage all teller cash floats for today</CardDescription>
        </CardHeader>
        <CardContent>
          {floats && floats.length > 0 ? (
            <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teller</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Opening</TableHead>
                  <TableHead>Deposits</TableHead>
                  <TableHead>Withdrawals</TableHead>
                  <TableHead className="hidden md:table-cell">Replenishments</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {floats.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.staff_name}</TableCell>
                    <TableCell>{f.branch_name}</TableCell>
                    <TableCell>{symbol} {f.opening_balance.toLocaleString()}</TableCell>
                    <TableCell className="text-green-600">+{f.deposits_in.toLocaleString()}</TableCell>
                    <TableCell className="text-red-600">-{f.withdrawals_out.toLocaleString()}</TableCell>
                    <TableCell className="text-blue-600 hidden md:table-cell">+{f.replenishments.toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">{symbol} {f.current_balance.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={
                        f.status === "open" ? "default" : 
                        f.status === "pending_approval" ? "destructive" :
                        f.status === "pending_vault_return" ? "outline" :
                        "secondary"
                      }>
                        {f.status === "open" ? "Active" : 
                         f.status === "pending_approval" ? "Shortage - Pending Approval" :
                         f.status === "pending_vault_return" ? "Pending Vault Return" :
                         "Reconciled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                      {canWrite && f.status === "open" && (
                        <Dialog open={replenishOpen && selectedFloat?.id === f.id} onOpenChange={(open) => {
                          setReplenishOpen(open);
                          if (open) setSelectedFloat(f);
                          else setSelectedFloat(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Replenish
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Replenish Float</DialogTitle>
                              <DialogDescription>Add cash to {f.staff_name}'s float</DialogDescription>
                            </DialogHeader>
                            <div className="py-2 px-3 bg-muted rounded-lg mb-4">
                              <p className="text-sm">Current Balance: <span className="font-semibold">{symbol} {f.current_balance.toLocaleString()}</span></p>
                            </div>
                            <Form {...replenishForm}>
                              <form onSubmit={replenishForm.handleSubmit((data) => replenishMutation.mutate(data))} className="space-y-4">
                                <FormField
                                  control={replenishForm.control}
                                  name="amount"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Amount to Add ({currency})</FormLabel>
                                      <FormControl>
                                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={replenishForm.control}
                                  name="notes"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Notes (Optional)</FormLabel>
                                      <FormControl>
                                        <Textarea placeholder="Reason for replenishment..." {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button type="submit" className="w-full" disabled={replenishMutation.isPending}>
                                  {replenishMutation.isPending ? "Processing..." : "Replenish Float"}
                                </Button>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      )}
                      {canWrite && f.status !== "open" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => reopenFloatMutation.mutate(f.id)}
                          disabled={reopenFloatMutation.isPending}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Reopen
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
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No floats allocated today</p>
              <p className="text-sm">Allocate cash floats to tellers to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="vault" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {vaultsData?.vaults?.map((vault) => (
              <Card key={vault.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{vault.branch_name}</CardTitle>
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {symbol} {vault.current_balance.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {vault.last_updated ? `Updated: ${new Date(vault.last_updated).toLocaleString()}` : "No transactions yet"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          {(!vaultsData?.vaults || vaultsData.vaults.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No branch vaults found</p>
                <p className="text-sm">Create branches to start managing vault cash</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pendingReturnCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Pending Vault Returns ({pendingReturnCount})
                </CardTitle>
                <CardDescription>Tellers waiting for vault return approval</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teller</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="hidden sm:table-cell">Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingVaultReturns?.pending_returns?.map((ret) => (
                      <TableRow key={ret.id}>
                        <TableCell className="font-medium">{ret.staff_name}</TableCell>
                        <TableCell>{ret.branch_name}</TableCell>
                        <TableCell className="font-semibold">{symbol} {ret.amount.toLocaleString()}</TableCell>
                        <TableCell className="hidden sm:table-cell">{new Date(ret.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canWrite && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => acceptVaultReturnMutation.mutate(ret.id)}
                                  disabled={acceptVaultReturnMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => rejectVaultReturnMutation.mutate(ret.id)}
                                  disabled={rejectVaultReturnMutation.isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {pendingRequestCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                  Cash Replenishment Requests ({pendingRequestCount})
                </CardTitle>
                <CardDescription>Tellers requesting additional cash</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teller</TableHead>
                      <TableHead className="hidden sm:table-cell">Current Balance</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="hidden md:table-cell">Reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests?.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.staff_name}</TableCell>
                        <TableCell className="hidden sm:table-cell">{symbol} {req.current_balance.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">{symbol} {req.amount.toLocaleString()}</TableCell>
                        <TableCell className="hidden md:table-cell">{req.reason}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canWrite && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approveRequestMutation.mutate(req.id)}
                                  disabled={approveRequestMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => rejectRequestMutation.mutate(req.id)}
                                  disabled={rejectRequestMutation.isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {pendingReturnCount === 0 && pendingRequestCount === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                <p>No pending approvals</p>
                <p className="text-sm">All vault returns and requests have been processed</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="held" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Held Shortages
              </CardTitle>
              <CardDescription>
                Shortages placed on hold awaiting manager resolution. You can deduct from salary or write off as expense.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {heldLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : heldShortages?.shortages?.length ? (
                <div className="space-y-4">
                  {heldShortages.total_held > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Total Held</AlertTitle>
                      <AlertDescription>
                        {symbol} {heldShortages.total_held.toLocaleString()} across {heldShortages.shortages.length} shortage(s)
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="overflow-x-auto -mx-4 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Teller</TableHead>
                        <TableHead className="hidden sm:table-cell">Branch</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="hidden md:table-cell">Notes</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {heldShortages.shortages.map((s) => (
                        <TableRow key={s.id} data-testid={`row-held-shortage-${s.id}`}>
                          <TableCell>{new Date(s.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{s.staff_name}</TableCell>
                          <TableCell className="hidden sm:table-cell">{s.branch_name || "-"}</TableCell>
                          <TableCell className="font-bold text-destructive">{symbol} {s.shortage_amount.toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate hidden md:table-cell">{s.notes || "-"}</TableCell>
                          <TableCell>
                            <Dialog open={resolveShortageId === s.id} onOpenChange={(open) => { if (!open) setResolveShortageId(null); }}>
                              <DialogTrigger asChild>
                                <Button size="sm" onClick={() => { setResolveShortageId(s.id); setResolveAction("deduct"); setResolvePin(""); setResolveStaffNumber(""); setResolveNotes(""); }} data-testid={`button-resolve-${s.id}`}>
                                  Resolve
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Resolve Held Shortage</DialogTitle>
                                  <DialogDescription>
                                    {s.staff_name} - {symbol} {s.shortage_amount.toLocaleString()} on {new Date(s.date).toLocaleDateString()}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 pt-2">
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Resolution</label>
                                    <Select value={resolveAction} onValueChange={setResolveAction}>
                                      <SelectTrigger data-testid="select-resolve-action">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="deduct">Deduct from Salary</SelectItem>
                                        <SelectItem value="expense">Write Off as Expense</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Your Staff Number</label>
                                    <Input
                                      value={resolveStaffNumber}
                                      onChange={(e) => setResolveStaffNumber(e.target.value)}
                                      placeholder="Enter your staff number"
                                      data-testid="input-resolve-staff-number"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Approval PIN</label>
                                    <Input
                                      type="password"
                                      value={resolvePin}
                                      onChange={(e) => setResolvePin(e.target.value)}
                                      placeholder="Enter your PIN"
                                      data-testid="input-resolve-pin"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Notes (optional)</label>
                                    <Textarea
                                      value={resolveNotes}
                                      onChange={(e) => setResolveNotes(e.target.value)}
                                      placeholder="Add notes about the resolution"
                                      data-testid="input-resolve-notes"
                                    />
                                  </div>
                                  <Button
                                    className="w-full"
                                    disabled={!resolvePin || resolveHeldMutation.isPending}
                                    onClick={() => resolveHeldMutation.mutate({
                                      shortageId: s.id,
                                      action: resolveAction,
                                      pin: resolvePin,
                                      staffNumber: resolveStaffNumber,
                                      notes: resolveNotes,
                                    })}
                                    data-testid="button-confirm-resolve"
                                  >
                                    {resolveHeldMutation.isPending ? "Processing..." : resolveAction === "deduct" ? "Deduct from Salary" : "Write Off as Expense"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No held shortages</p>
                  <p className="text-sm mt-1">All shortages have been resolved</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="handovers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Shift Handovers
              </CardTitle>
              <CardDescription>Recent shift handovers between tellers</CardDescription>
            </CardHeader>
            <CardContent>
              {shiftHandovers?.handovers && shiftHandovers.handovers.length > 0 ? (
                <div className="overflow-x-auto -mx-4 md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="hidden sm:table-cell">Branch</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftHandovers.handovers.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.from_staff_name || "Unknown"}</TableCell>
                        <TableCell>{h.to_staff_name || "Unknown"}</TableCell>
                        <TableCell className="hidden sm:table-cell">{h.branch_name || "Unknown"}</TableCell>
                        <TableCell className="font-semibold">{symbol} {h.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={h.status === "accepted" ? "default" : h.status === "rejected" ? "destructive" : "secondary"}>
                            {h.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{new Date(h.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No shift handovers yet</p>
                  <p className="text-sm">Tellers can initiate handovers from their Teller Station</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 shrink-0" />
                    Daily Cash Position Report
                  </CardTitle>
                  <CardDescription>
                    {dailyCashPosition?.report_date ? `Report for ${new Date(dailyCashPosition.report_date).toLocaleDateString()}` : "Today's cash position"}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => refetchDailyReport()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dailyCashPosition?.totals && (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-6">
                  <Card className="bg-blue-50 dark:bg-blue-900/20">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Vault</div>
                      <div className="text-xl font-bold">{symbol} {dailyCashPosition.totals.vault_balance.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 dark:bg-green-900/20">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Float Allocated</div>
                      <div className="text-xl font-bold">{symbol} {dailyCashPosition.totals.float_allocated.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50 dark:bg-purple-900/20">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Deposits</div>
                      <div className="text-xl font-bold">{symbol} {dailyCashPosition.totals.deposits_received.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-orange-50 dark:bg-orange-900/20">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Withdrawals</div>
                      <div className="text-xl font-bold">{symbol} {dailyCashPosition.totals.withdrawals_paid.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-emerald-50 dark:bg-emerald-900/20">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Cash</div>
                      <div className="text-xl font-bold">{symbol} {dailyCashPosition.totals.total_cash_in_hand.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {dailyCashPosition?.branches && dailyCashPosition.branches.length > 0 ? (
                <div className="overflow-x-auto -mx-4 md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>Vault</TableHead>
                      <TableHead className="hidden sm:table-cell">Float</TableHead>
                      <TableHead>Deposits</TableHead>
                      <TableHead>Withdrawals</TableHead>
                      <TableHead>Total Cash</TableHead>
                      <TableHead className="hidden sm:table-cell">Tellers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyCashPosition.branches.map((b) => (
                      <TableRow key={b.branch_id}>
                        <TableCell className="font-medium">{b.branch_name}</TableCell>
                        <TableCell>{symbol} {b.vault_balance.toLocaleString()}</TableCell>
                        <TableCell className="hidden sm:table-cell">{symbol} {b.float_allocated.toLocaleString()}</TableCell>
                        <TableCell className="text-green-600">+{symbol} {b.deposits_received.toLocaleString()}</TableCell>
                        <TableCell className="text-red-600">-{symbol} {b.withdrawals_paid.toLocaleString()}</TableCell>
                        <TableCell className="font-bold">{symbol} {b.total_cash_in_hand.toLocaleString()}</TableCell>
                        <TableCell className="hidden sm:table-cell">{b.teller_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No data available for today</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
