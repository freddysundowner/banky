import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
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
import { useAppDialog } from "@/hooks/use-app-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Users, Lock, Unlock, Star, Plus, UserCheck, UserX, AlertCircle, DollarSign,
  Calendar, Clock, FileText, GraduationCap, AlertTriangle, BarChart3, Check, X,
  TrendingUp, UserMinus, Briefcase, Timer, Award, ShieldAlert, LogIn, LogOut,
  Eye, Mail, Download, Printer
} from "lucide-react";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useCurrency } from "@/hooks/use-currency";

interface HRManagementProps {
  organizationId: string;
}

interface Staff {
  id: string;
  staff_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  branch_id?: string;
}

interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason?: string;
  status: string;
  staff_name?: string;
  leave_type_name?: string;
  approved_by_name?: string;
  created_at: string;
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  days_per_year: number;
  is_paid: boolean;
}

interface Attendance {
  id: string;
  staff_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  status: string;
  staff_name?: string;
  late_minutes: number;
  overtime_minutes: number;
}

interface PayrollConfig {
  id: string;
  staff_id: string;
  basic_salary: number;
  house_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  gross_salary: number;
  nhif_deduction: number;
  nssf_deduction: number;
  paye_tax: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  staff_name?: string;
}

interface DisciplinaryRecord {
  id: string;
  staff_id: string;
  action_type: string;
  incident_date: string;
  description: string;
  staff_name?: string;
  issued_by_name?: string;
  is_resolved: boolean;
}

interface TrainingRecord {
  id: string;
  staff_id: string;
  training_name: string;
  training_type?: string;
  provider?: string;
  start_date: string;
  end_date?: string;
  status: string;
  passed?: boolean;
  staff_name?: string;
}

interface HRSummary {
  total_staff: number;
  active_staff: number;
  inactive_staff: number;
  locked_staff: number;
  pending_leave_requests: number;
  staff_on_leave_today: number;
  clocked_in_today: number;
  pending_trainings: number;
  unresolved_disciplinary: number;
}

export default function HRManagement({ organizationId }: HRManagementProps) {
  const { toast } = useAppDialog();
  const { formatAmount } = useCurrency(organizationId);
  const [activeTab, setActiveTab] = useState("overview");
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showPayrollDialog, setShowPayrollDialog] = useState(false);
  const [showDisciplinaryDialog, setShowDisciplinaryDialog] = useState(false);
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);
  const [showPayslipDialog, setShowPayslipDialog] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.HR);
  
  const [leaveForm, setLeaveForm] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: ""
  });
  
  const [payrollForm, setPayrollForm] = useState({
    staff_id: "",
    basic_salary: "",
    house_allowance: "",
    transport_allowance: "",
    other_allowances: "",
    nhif_deduction: "",
    nssf_deduction: "",
    paye_tax: "",
    other_deductions: ""
  });
  
  const [disciplinaryForm, setDisciplinaryForm] = useState({
    staff_id: "",
    action_type: "",
    incident_date: "",
    description: ""
  });
  
  const [trainingForm, setTrainingForm] = useState({
    staff_id: "",
    training_name: "",
    training_type: "",
    provider: "",
    start_date: "",
    end_date: "",
    cost: ""
  });

  const { data: summary } = useQuery<HRSummary>({
    queryKey: ["/api/organizations", organizationId, "hr", "reports", "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/reports/summary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const { data: staffList, isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "staff"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/staff`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });

  const { data: leaveRequests } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "leave-requests"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/leave-requests`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leave requests");
      return res.json();
    },
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "leave-types"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/leave-types`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leave types");
      return res.json();
    },
  });

  const { data: attendance } = useQuery<Attendance[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "attendance"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/attendance`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
  });

  const { data: payrollConfigs } = useQuery<PayrollConfig[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "payroll-configs"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/payroll-configs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payroll");
      return res.json();
    },
  });

  const { data: disciplinaryRecords } = useQuery<DisciplinaryRecord[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "disciplinary"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/disciplinary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch disciplinary");
      return res.json();
    },
  });

  const { data: trainingRecords } = useQuery<TrainingRecord[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "training"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/training`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch training");
      return res.json();
    },
  });

  const { data: payPeriods } = useQuery<any[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "pay-periods"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/pay-periods`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pay periods");
      return res.json();
    },
  });

  const { data: payslips } = useQuery<any[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "payslips"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/payslips`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payslips");
      return res.json();
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (staffId: string) => {
      await apiRequest("PUT", `/api/organizations/${organizationId}/hr/staff/${staffId}/lock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "staff"] });
      toast({ title: "Success", description: "Staff account locked" });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async (staffId: string) => {
      await apiRequest("PUT", `/api/organizations/${organizationId}/hr/staff/${staffId}/unlock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "staff"] });
      toast({ title: "Success", description: "Staff account unlocked" });
    },
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/attendance/clock-in`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "reports", "summary"] });
      toast({ title: "Clocked In", description: "You have successfully clocked in" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to clock in", variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/attendance/clock-out`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "attendance"] });
      toast({ title: "Clocked Out", description: "You have successfully clocked out" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to clock out", variant: "destructive" });
    },
  });

  const createLeaveRequest = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/leave-requests`, leaveForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-requests"] });
      setShowLeaveDialog(false);
      setLeaveForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
      toast({ title: "Success", description: "Leave request submitted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit leave request", variant: "destructive" });
    },
  });

  const approveLeave = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("PUT", `/api/organizations/${organizationId}/hr/leave-requests/${requestId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-requests"] });
      toast({ title: "Success", description: "Leave request approved" });
    },
  });

  const rejectLeave = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("PUT", `/api/organizations/${organizationId}/hr/leave-requests/${requestId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-requests"] });
      toast({ title: "Success", description: "Leave request rejected" });
    },
  });

  const initializeBalances = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/leave-balances/initialize`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Leave balances initialized for all staff" });
    },
  });

  const createPayrollConfig = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/payroll-configs`, {
        ...payrollForm,
        basic_salary: parseFloat(payrollForm.basic_salary) || 0,
        house_allowance: parseFloat(payrollForm.house_allowance) || 0,
        transport_allowance: parseFloat(payrollForm.transport_allowance) || 0,
        other_allowances: parseFloat(payrollForm.other_allowances) || 0,
        nhif_deduction: parseFloat(payrollForm.nhif_deduction) || 0,
        nssf_deduction: parseFloat(payrollForm.nssf_deduction) || 0,
        paye_tax: parseFloat(payrollForm.paye_tax) || 0,
        other_deductions: parseFloat(payrollForm.other_deductions) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "payroll-configs"] });
      setShowPayrollDialog(false);
      setPayrollForm({ staff_id: "", basic_salary: "", house_allowance: "", transport_allowance: "", other_allowances: "", nhif_deduction: "", nssf_deduction: "", paye_tax: "", other_deductions: "" });
      toast({ title: "Success", description: "Payroll configuration saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save payroll config", variant: "destructive" });
    },
  });

  const createDisciplinaryRecord = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/disciplinary`, disciplinaryForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "disciplinary"] });
      setShowDisciplinaryDialog(false);
      setDisciplinaryForm({ staff_id: "", action_type: "", incident_date: "", description: "" });
      toast({ title: "Success", description: "Disciplinary record created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create disciplinary record", variant: "destructive" });
    },
  });

  const createTrainingRecord = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/training`, {
        ...trainingForm,
        cost: trainingForm.cost ? parseFloat(trainingForm.cost) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "training"] });
      setShowTrainingDialog(false);
      setTrainingForm({ staff_id: "", training_name: "", training_type: "", provider: "", start_date: "", end_date: "", cost: "" });
      toast({ title: "Success", description: "Training record created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create training record", variant: "destructive" });
    },
  });

  const generatePayPeriods = useMutation({
    mutationFn: async (year: number) => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/pay-periods/generate-monthly?year=${year}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "pay-periods"] });
      toast({ title: "Success", description: "Pay periods generated for the year" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate pay periods", variant: "destructive" });
    },
  });

  const runPayroll = useMutation({
    mutationFn: async (periodId: string) => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/pay-periods/${periodId}/run-payroll`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "pay-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "payslips"] });
      toast({ title: "Success", description: "Payroll processed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to run payroll", variant: "destructive" });
    },
  });

  const approvePayroll = useMutation({
    mutationFn: async (periodId: string) => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/pay-periods/${periodId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "pay-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "payslips"] });
      toast({ title: "Success", description: "Payroll approved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to approve payroll", variant: "destructive" });
    },
  });

  const disbursePayroll = useMutation({
    mutationFn: async (periodId: string) => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/pay-periods/${periodId}/disburse`, { method: "savings_account" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "pay-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "payslips"] });
      toast({ title: "Success", description: "Salaries disbursed to staff accounts" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to disburse payroll", variant: "destructive" });
    },
  });

  const emailPayslip = useMutation({
    mutationFn: async (payslipId: string) => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/payslips/${payslipId}/email`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Payslip emailed to staff member" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to email payslip", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      cancelled: "outline",
      completed: "default",
      in_progress: "secondary",
      scheduled: "outline"
    };
    return <Badge variant={variants[status] || "outline"} className="capitalize">{status.replace("_", " ")}</Badge>;
  };

  const getPayrollStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string, className?: string }> = {
      open: { variant: "outline", label: "Open" },
      processing: { variant: "secondary", label: "Processing" },
      approved: { variant: "default", label: "Approved", className: "bg-blue-600" },
      paid: { variant: "default", label: "Paid", className: "bg-green-600" },
      draft: { variant: "outline", label: "Draft" }
    };
    const c = config[status] || { variant: "outline", label: status };
    return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return formatAmount(amount);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Management</h1>
          <p className="text-muted-foreground mt-1">Manage your workforce, attendance, payroll, and more</p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton organizationId={organizationId} />
          <Button 
            variant="outline" 
            onClick={() => clockInMutation.mutate()} 
            disabled={clockInMutation.isPending}
            className="gap-2"
          >
            <LogIn className="h-4 w-4" />
            Clock In
          </Button>
          <Button 
            variant="outline" 
            onClick={() => clockOutMutation.mutate()} 
            disabled={clockOutMutation.isPending}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Clock Out
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b">
          <TabsList className="h-auto p-0 bg-transparent w-full justify-start gap-0 rounded-none">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="staff" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2"
            >
              <Users className="h-4 w-4" />
              Staff
            </TabsTrigger>
            <TabsTrigger 
              value="attendance" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2"
            >
              <Clock className="h-4 w-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger 
              value="payroll" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Payroll
            </TabsTrigger>
            <TabsTrigger 
              value="disciplinary" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2"
            >
              <ShieldAlert className="h-4 w-4" />
              Disciplinary
            </TabsTrigger>
            <TabsTrigger 
              value="training" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-3 gap-2"
            >
              <GraduationCap className="h-4 w-4" />
              Training
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Staff</p>
                    <p className="text-3xl font-bold mt-1">{summary?.total_staff || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="text-green-600">{summary?.active_staff || 0} active</span>
                      {" / "}
                      <span className="text-gray-500">{summary?.inactive_staff || 0} inactive</span>
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Leave</p>
                    <p className="text-3xl font-bold mt-1">{summary?.pending_leave_requests || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary?.staff_on_leave_today || 0} on leave today
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Clocked In Today</p>
                    <p className="text-3xl font-bold mt-1">{summary?.clocked_in_today || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      of {summary?.active_staff || 0} active staff
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <Timer className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Actions</p>
                    <p className="text-3xl font-bold mt-1">{(summary?.pending_trainings || 0) + (summary?.unresolved_disciplinary || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary?.pending_trainings || 0} training, {summary?.unresolved_disciplinary || 0} disciplinary
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Common HR tasks at your fingertips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setShowLeaveDialog(true)}>
                  <Calendar className="h-5 w-5" />
                  <span className="text-sm">Request Leave</span>
                </Button>
                {canWrite && (
                  <>
                    <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setShowPayrollDialog(true)}>
                      <DollarSign className="h-5 w-5" />
                      <span className="text-sm">Configure Payroll</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setShowDisciplinaryDialog(true)}>
                      <ShieldAlert className="h-5 w-5" />
                      <span className="text-sm">Add Disciplinary</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setShowTrainingDialog(true)}>
                      <GraduationCap className="h-5 w-5" />
                      <span className="text-sm">Add Training</span>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Staff Directory</CardTitle>
                  <CardDescription>View and manage staff accounts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : staffList && staffList.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Staff #</TableHead>
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        {canWrite && <TableHead className="font-semibold text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffList.map((staff) => (
                        <TableRow key={staff.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-sm">{staff.staff_number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {staff.first_name[0]}{staff.last_name[0]}
                                </span>
                              </div>
                              <span className="font-medium">{staff.first_name} {staff.last_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{staff.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{staff.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1.5">
                              <Badge variant={staff.is_active ? "default" : "secondary"}>
                                {staff.is_active ? "Active" : "Inactive"}
                              </Badge>
                              {staff.is_locked && (
                                <Badge variant="destructive" className="gap-1">
                                  <Lock className="h-3 w-3" /> Locked
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          {canWrite && (
                            <TableCell className="text-right">
                              {staff.is_locked ? (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => unlockMutation.mutate(staff.id)}
                                  className="gap-1"
                                >
                                  <Unlock className="h-4 w-4" /> Unlock
                                </Button>
                              ) : (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => lockMutation.mutate(staff.id)}
                                  className="gap-1 text-destructive hover:text-destructive"
                                >
                                  <Lock className="h-4 w-4" /> Lock
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg">No Staff Found</h3>
                  <p className="text-muted-foreground mt-1">Staff members will appear here once added</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="mt-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Attendance Records</h2>
              <p className="text-muted-foreground">Track daily attendance and work hours</p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              {attendance && attendance.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Employee</TableHead>
                        <TableHead className="font-semibold">Clock In</TableHead>
                        <TableHead className="font-semibold">Clock Out</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((record) => (
                        <TableRow key={record.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{new Date(record.date).toLocaleDateString()}</TableCell>
                          <TableCell>{record.staff_name || "You"}</TableCell>
                          <TableCell className="font-mono text-sm">{record.clock_in || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{record.clock_out || "-"}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {record.late_minutes > 0 && <span className="text-amber-600">Late: {record.late_minutes}m</span>}
                            {record.overtime_minutes > 0 && <span className="text-green-600 ml-2">OT: {record.overtime_minutes}m</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg">No Attendance Records</h3>
                  <p className="text-muted-foreground mt-1">Clock in to start tracking attendance</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="mt-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Payroll Management</h2>
              <p className="text-muted-foreground">Process salaries, manage pay periods, and view payslips</p>
            </div>
            <div className="flex gap-2">
              {canWrite && (
                <>
                  <Button variant="outline" onClick={() => setShowPayrollDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Staff Salary
                  </Button>
                  <Button onClick={() => generatePayPeriods.mutate(new Date().getFullYear())} disabled={generatePayPeriods.isPending} className="gap-2">
                    <Calendar className="h-4 w-4" /> Generate Periods
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Pay Periods */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Pay Periods</CardTitle>
              <CardDescription>Monthly pay cycles for salary processing</CardDescription>
            </CardHeader>
            <CardContent>
              {payPeriods && payPeriods.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Period</TableHead>
                        <TableHead className="font-semibold">Pay Date</TableHead>
                        <TableHead className="font-semibold text-right">Staff</TableHead>
                        <TableHead className="font-semibold text-right">Total Net</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        {canWrite && <TableHead className="font-semibold text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payPeriods.map((period: any) => (
                        <TableRow key={period.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{period.name}</TableCell>
                          <TableCell>{new Date(period.pay_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">{period.staff_count}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatCurrency(period.total_net)}</TableCell>
                          <TableCell>{getPayrollStatusBadge(period.status)}</TableCell>
                          {canWrite && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {period.status === "open" && (
                                  <Button size="sm" variant="outline" onClick={() => runPayroll.mutate(period.id)} disabled={runPayroll.isPending}>
                                    Run Payroll
                                  </Button>
                                )}
                                {period.status === "processing" && (
                                  <Button size="sm" variant="default" onClick={() => approvePayroll.mutate(period.id)} disabled={approvePayroll.isPending}>
                                    Approve
                                  </Button>
                                )}
                                {period.status === "approved" && (
                                  <Button size="sm" variant="default" onClick={() => disbursePayroll.mutate(period.id)} disabled={disbursePayroll.isPending} className="bg-green-600 hover:bg-green-700">
                                    Disburse
                                  </Button>
                                )}
                                {period.status === "paid" && (
                                  <Badge variant="default" className="bg-green-600">Completed</Badge>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Calendar className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold">No Pay Periods</h3>
                  <p className="text-muted-foreground text-sm mt-1">Generate monthly pay periods to start processing payroll</p>
                  {canWrite && (
                    <Button onClick={() => generatePayPeriods.mutate(new Date().getFullYear())} className="mt-4 gap-2">
                      <Calendar className="h-4 w-4" /> Generate {new Date().getFullYear()} Periods
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Salary Configurations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Salary Configurations</CardTitle>
              <CardDescription>Staff salary structures and deductions</CardDescription>
            </CardHeader>
            <CardContent>
              {payrollConfigs && payrollConfigs.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Employee</TableHead>
                        <TableHead className="font-semibold text-right">Basic</TableHead>
                        <TableHead className="font-semibold text-right">Allowances</TableHead>
                        <TableHead className="font-semibold text-right">Deductions</TableHead>
                        <TableHead className="font-semibold text-right">Net Salary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollConfigs.map((config) => (
                        <TableRow key={config.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{config.staff_name}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(config.basic_salary)}</TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            +{formatCurrency(config.house_allowance + config.transport_allowance + config.other_allowances)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            -{formatCurrency(config.total_deductions)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatCurrency(config.net_salary)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                    <DollarSign className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold">No Salary Configurations</h3>
                  <p className="text-muted-foreground text-sm mt-1">Configure staff salaries before running payroll</p>
                  {canWrite && (
                    <Button onClick={() => setShowPayrollDialog(true)} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" /> Add Salary Configuration
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Payslips */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Payslips</CardTitle>
              <CardDescription>Generated payslips for processed periods</CardDescription>
            </CardHeader>
            <CardContent>
              {payslips && payslips.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Employee</TableHead>
                        <TableHead className="font-semibold">Period</TableHead>
                        <TableHead className="font-semibold text-right">Gross</TableHead>
                        <TableHead className="font-semibold text-right">Deductions</TableHead>
                        <TableHead className="font-semibold text-right">Net</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payslips.map((slip: any) => (
                        <TableRow key={slip.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{slip.staff_name}</TableCell>
                          <TableCell>{slip.pay_period}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(slip.gross_salary)}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">-{formatCurrency(slip.total_deductions)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatCurrency(slip.net_salary)}</TableCell>
                          <TableCell>{getPayrollStatusBadge(slip.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => { setSelectedPayslip(slip); setShowPayslipDialog(true); }}
                                title="View Payslip"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => emailPayslip.mutate(slip.id)}
                                disabled={emailPayslip.isPending}
                                title="Email Payslip"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No payslips generated yet. Run payroll to generate payslips.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disciplinary Tab */}
        <TabsContent value="disciplinary" className="mt-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Disciplinary Records</h2>
              <p className="text-muted-foreground">Track warnings, suspensions, and actions</p>
            </div>
            {canWrite && (
              <Button onClick={() => setShowDisciplinaryDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Record
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="pt-6">
              {disciplinaryRecords && disciplinaryRecords.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Employee</TableHead>
                        <TableHead className="font-semibold">Action Type</TableHead>
                        <TableHead className="font-semibold">Incident Date</TableHead>
                        <TableHead className="font-semibold">Description</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disciplinaryRecords.map((record) => (
                        <TableRow key={record.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{record.staff_name}</TableCell>
                          <TableCell>
                            <Badge variant={record.action_type === "warning" ? "secondary" : "destructive"} className="capitalize">
                              {record.action_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(record.incident_date).toLocaleDateString()}</TableCell>
                          <TableCell className="max-w-[300px] truncate text-muted-foreground">{record.description}</TableCell>
                          <TableCell>
                            <Badge variant={record.is_resolved ? "default" : "outline"}>
                              {record.is_resolved ? "Resolved" : "Pending"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <ShieldAlert className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg">No Disciplinary Records</h3>
                  <p className="text-muted-foreground mt-1">Disciplinary actions will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Training Tab */}
        <TabsContent value="training" className="mt-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Training Records</h2>
              <p className="text-muted-foreground">Track training programs and certifications</p>
            </div>
            {canWrite && (
              <Button onClick={() => setShowTrainingDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Training
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="pt-6">
              {trainingRecords && trainingRecords.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Employee</TableHead>
                        <TableHead className="font-semibold">Training Name</TableHead>
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="font-semibold">Duration</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trainingRecords.map((record) => (
                        <TableRow key={record.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{record.staff_name}</TableCell>
                          <TableCell>{record.training_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{record.training_type || "General"}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(record.start_date).toLocaleDateString()}
                            {record.end_date && ` - ${new Date(record.end_date).toLocaleDateString()}`}
                          </TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <GraduationCap className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg">No Training Records</h3>
                  <p className="text-muted-foreground mt-1">Training programs will appear here</p>
                  {canWrite && (
                    <Button onClick={() => setShowTrainingDialog(true)} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" /> Add Training
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Leave Request Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>Submit a new leave request for approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveForm.leave_type_id} onValueChange={(v) => setLeaveForm({ ...leaveForm, leave_type_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Reason for leave..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>Cancel</Button>
            <Button onClick={() => createLeaveRequest.mutate()} disabled={createLeaveRequest.isPending}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payroll Config Dialog */}
      <Dialog open={showPayrollDialog} onOpenChange={setShowPayrollDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payroll Configuration</DialogTitle>
            <DialogDescription>Configure salary structure for an employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={payrollForm.staff_id} onValueChange={(v) => setPayrollForm({ ...payrollForm, staff_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {staffList?.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>{staff.first_name} {staff.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Basic Salary</Label>
                <Input type="number" value={payrollForm.basic_salary} onChange={(e) => setPayrollForm({ ...payrollForm, basic_salary: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>House Allowance</Label>
                <Input type="number" value={payrollForm.house_allowance} onChange={(e) => setPayrollForm({ ...payrollForm, house_allowance: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Transport Allowance</Label>
                <Input type="number" value={payrollForm.transport_allowance} onChange={(e) => setPayrollForm({ ...payrollForm, transport_allowance: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Other Allowances</Label>
                <Input type="number" value={payrollForm.other_allowances} onChange={(e) => setPayrollForm({ ...payrollForm, other_allowances: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Deductions</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>NHIF</Label>
                  <Input type="number" value={payrollForm.nhif_deduction} onChange={(e) => setPayrollForm({ ...payrollForm, nhif_deduction: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>NSSF</Label>
                  <Input type="number" value={payrollForm.nssf_deduction} onChange={(e) => setPayrollForm({ ...payrollForm, nssf_deduction: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>PAYE Tax</Label>
                  <Input type="number" value={payrollForm.paye_tax} onChange={(e) => setPayrollForm({ ...payrollForm, paye_tax: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Other Deductions</Label>
                  <Input type="number" value={payrollForm.other_deductions} onChange={(e) => setPayrollForm({ ...payrollForm, other_deductions: e.target.value })} placeholder="0.00" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayrollDialog(false)}>Cancel</Button>
            <Button onClick={() => createPayrollConfig.mutate()} disabled={createPayrollConfig.isPending}>Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disciplinary Dialog */}
      <Dialog open={showDisciplinaryDialog} onOpenChange={setShowDisciplinaryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Disciplinary Record</DialogTitle>
            <DialogDescription>Document a disciplinary action</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={disciplinaryForm.staff_id} onValueChange={(v) => setDisciplinaryForm({ ...disciplinaryForm, staff_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {staffList?.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>{staff.first_name} {staff.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select value={disciplinaryForm.action_type} onValueChange={(v) => setDisciplinaryForm({ ...disciplinaryForm, action_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="written_warning">Written Warning</SelectItem>
                    <SelectItem value="suspension">Suspension</SelectItem>
                    <SelectItem value="termination">Termination</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Incident Date</Label>
                <Input type="date" value={disciplinaryForm.incident_date} onChange={(e) => setDisciplinaryForm({ ...disciplinaryForm, incident_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={disciplinaryForm.description} onChange={(e) => setDisciplinaryForm({ ...disciplinaryForm, description: e.target.value })} placeholder="Describe the incident..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisciplinaryDialog(false)}>Cancel</Button>
            <Button onClick={() => createDisciplinaryRecord.mutate()} disabled={createDisciplinaryRecord.isPending}>Save Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Dialog */}
      <Dialog open={showTrainingDialog} onOpenChange={setShowTrainingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Training Record</DialogTitle>
            <DialogDescription>Document a training program or certification</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={trainingForm.staff_id} onValueChange={(v) => setTrainingForm({ ...trainingForm, staff_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {staffList?.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>{staff.first_name} {staff.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Training Name</Label>
              <Input value={trainingForm.training_name} onChange={(e) => setTrainingForm({ ...trainingForm, training_name: e.target.value })} placeholder="e.g., Leadership Development" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Training Type</Label>
                <Select value={trainingForm.training_type} onValueChange={(v) => setTrainingForm({ ...trainingForm, training_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                    <SelectItem value="certification">Certification</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input value={trainingForm.provider} onChange={(e) => setTrainingForm({ ...trainingForm, provider: e.target.value })} placeholder="Training provider" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={trainingForm.start_date} onChange={(e) => setTrainingForm({ ...trainingForm, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={trainingForm.end_date} onChange={(e) => setTrainingForm({ ...trainingForm, end_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrainingDialog(false)}>Cancel</Button>
            <Button onClick={() => createTrainingRecord.mutate()} disabled={createTrainingRecord.isPending}>Save Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payslip Detail Dialog */}
      <Dialog open={showPayslipDialog} onOpenChange={setShowPayslipDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payslip Details
            </DialogTitle>
            <DialogDescription>
              {selectedPayslip?.staff_name} - {selectedPayslip?.pay_period}
            </DialogDescription>
          </DialogHeader>
          {selectedPayslip && (
            <div className="space-y-4 py-4">
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="text-center border-b pb-3">
                  <h3 className="font-bold text-lg">PAYSLIP</h3>
                  <p className="text-sm text-muted-foreground">Pay Period: {selectedPayslip.pay_period}</p>
                  <p className="text-sm text-muted-foreground">Pay Date: {selectedPayslip.pay_date ? new Date(selectedPayslip.pay_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Employee:</span>
                  <span className="font-medium text-right">{selectedPayslip.staff_name}</span>
                </div>

                <div className="border-t pt-3">
                  <h4 className="font-semibold text-sm mb-2 text-green-600">Earnings</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Basic Salary</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.basic_salary || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>House Allowance</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.house_allowance || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transport Allowance</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.transport_allowance || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Other Allowances</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.other_allowances || 0)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Gross Salary</span>
                      <span className="font-mono text-green-600">{formatCurrency(selectedPayslip.gross_salary || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <h4 className="font-semibold text-sm mb-2 text-red-600">Deductions</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>NHIF</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.nhif_deduction || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>NSSF</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.nssf_deduction || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PAYE Tax</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.paye_tax || 0)}</span>
                    </div>
                    {(selectedPayslip.loan_deductions || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Loan Repayments</span>
                        <span className="font-mono">{formatCurrency(selectedPayslip.loan_deductions || 0)}</span>
                      </div>
                    )}
                    {(selectedPayslip.advance_deductions || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Salary Advance Recovery</span>
                        <span className="font-mono">{formatCurrency(selectedPayslip.advance_deductions || 0)}</span>
                      </div>
                    )}
                    {(selectedPayslip.shortage_deductions || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Shortage Deductions</span>
                        <span className="font-mono">{formatCurrency(selectedPayslip.shortage_deductions || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Other Deductions</span>
                      <span className="font-mono">{formatCurrency(selectedPayslip.other_deductions || 0)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Deductions</span>
                      <span className="font-mono text-red-600">-{formatCurrency(selectedPayslip.total_deductions || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 bg-primary/5 -mx-4 px-4 py-2 rounded-b">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Net Salary</span>
                    <span className="font-mono font-bold text-lg text-primary">{formatCurrency(selectedPayslip.net_salary || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Status: {selectedPayslip.status}</span>
                {selectedPayslip.paid_at && <span>Paid: {new Date(selectedPayslip.paid_at).toLocaleDateString()}</span>}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => emailPayslip.mutate(selectedPayslip?.id)} disabled={emailPayslip.isPending || !selectedPayslip} className="gap-2">
              <Mail className="h-4 w-4" /> Email
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button onClick={() => setShowPayslipDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
