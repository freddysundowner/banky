import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Calendar, Check, X, Clock, Plus, Search, Users, Building2, RefreshCw, Settings, Pencil, ChevronRight, ChevronLeft, ArrowLeft } from "lucide-react";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";

interface LeaveManagementProps {
  organizationId: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface Staff {
  id: string;
  staff_number: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
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
  branch_id?: string;
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  days_per_year: number;
  is_paid: boolean;
  carry_over_allowed: boolean;
  max_carry_over_days: number;
  description?: string;
}

interface LeaveBalance {
  id: string;
  staff_id: string;
  leave_type_id: string;
  year: number;
  entitled_days: number;
  used_days: number;
  remaining_days: number;
  staff_name?: string;
  leave_type_name?: string;
  branch_id?: string;
}

export default function LeaveManagement({ organizationId }: LeaveManagementProps) {
  const { toast } = useToast();
  const { hasPermission } = useResourcePermissions(organizationId, RESOURCES.LEAVE);
  const canRead = hasPermission("leave:read");
  const canWrite = hasPermission("leave:write");
  const canApprove = hasPermission("leave:approve");
  
  const [activeTab, setActiveTab] = useState("requests");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedBalanceStaffId, setSelectedBalanceStaffId] = useState<string | null>(null);
  const [balancesPage, setBalancesPage] = useState(1);
  const BALANCES_PER_PAGE = 10;
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showLeaveTypeDialog, setShowLeaveTypeDialog] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    staff_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    days_requested: "",
    reason: "",
  });
  const [leaveTypeForm, setLeaveTypeForm] = useState({
    name: "",
    code: "",
    days_per_year: "",
    is_paid: true,
    carry_over_allowed: false,
    max_carry_over_days: "0",
    description: "",
  });

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

  const { data: staffList } = useQuery<Staff[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "staff"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/staff`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });

  const { data: leaveRequests, isLoading: loadingRequests } = useQuery<LeaveRequest[]>({
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

  const { data: leaveBalances } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/organizations", organizationId, "hr", "leave-balances"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/hr/leave-balances`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leave balances");
      return res.json();
    },
  });

  const createLeaveRequest = useMutation({
    mutationFn: async () => {
      const payload: any = {
        leave_type_id: leaveForm.leave_type_id,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        days_requested: parseFloat(leaveForm.days_requested) || 0,
        reason: leaveForm.reason || null,
      };
      if (leaveForm.staff_id) {
        payload.staff_id = leaveForm.staff_id;
      }
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/leave-requests`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-balances"] });
      setShowLeaveDialog(false);
      setLeaveForm({ staff_id: "", leave_type_id: "", start_date: "", end_date: "", days_requested: "", reason: "" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-balances"] });
      toast({ title: "Success", description: "Leave request approved" });
    },
  });

  const rejectLeave = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("PUT", `/api/organizations/${organizationId}/hr/leave-requests/${requestId}/reject`, { rejection_reason: "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-balances"] });
      toast({ title: "Success", description: "Leave request rejected" });
    },
  });

  const initializeBalances = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${organizationId}/hr/leave-balances/initialize`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-types"] });
      toast({ title: "Success", description: "Leave balances initialized for all staff" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to initialize leave balances", variant: "destructive" });
    },
  });

  const saveLeaveType = useMutation({
    mutationFn: async () => {
      const payload = {
        name: leaveTypeForm.name,
        code: leaveTypeForm.code,
        days_per_year: parseInt(leaveTypeForm.days_per_year) || 0,
        is_paid: leaveTypeForm.is_paid,
        carry_over_allowed: leaveTypeForm.carry_over_allowed,
        max_carry_over_days: parseInt(leaveTypeForm.max_carry_over_days) || 0,
        description: leaveTypeForm.description || null,
      };
      if (editingLeaveType) {
        await apiRequest("PUT", `/api/organizations/${organizationId}/hr/leave-types/${editingLeaveType.id}`, payload);
      } else {
        await apiRequest("POST", `/api/organizations/${organizationId}/hr/leave-types`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "hr", "leave-types"] });
      setShowLeaveTypeDialog(false);
      setEditingLeaveType(null);
      resetLeaveTypeForm();
      toast({ title: "Success", description: editingLeaveType ? "Leave type updated" : "Leave type created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save leave type", variant: "destructive" });
    },
  });

  const resetLeaveTypeForm = () => {
    setLeaveTypeForm({ name: "", code: "", days_per_year: "", is_paid: true, carry_over_allowed: false, max_carry_over_days: "0", description: "" });
  };

  const openEditLeaveType = (lt: LeaveType) => {
    setEditingLeaveType(lt);
    setLeaveTypeForm({
      name: lt.name,
      code: lt.code,
      days_per_year: lt.days_per_year.toString(),
      is_paid: lt.is_paid,
      carry_over_allowed: lt.carry_over_allowed || false,
      max_carry_over_days: (lt.max_carry_over_days || 0).toString(),
      description: lt.description || "",
    });
    setShowLeaveTypeDialog(true);
  };

  const openNewLeaveType = () => {
    setEditingLeaveType(null);
    resetLeaveTypeForm();
    setShowLeaveTypeDialog(true);
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleDateChange = (field: "start_date" | "end_date", value: string) => {
    const newForm = { ...leaveForm, [field]: value };
    if (newForm.start_date && newForm.end_date) {
      newForm.days_requested = calculateDays(newForm.start_date, newForm.end_date).toString();
    }
    setLeaveForm(newForm);
  };

  const getStaffBranchId = (staffId: string) => {
    return staffList?.find(s => s.id === staffId)?.branch_id;
  };

  const filteredRequests = leaveRequests?.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (branchFilter !== "all") {
      const staffBranchId = getStaffBranchId(r.staff_id);
      if (staffBranchId && staffBranchId !== branchFilter) return false;
    }
    return true;
  }) || [];

  const filteredBalances = leaveBalances?.filter(b => {
    if (branchFilter !== "all") {
      const staffBranchId = getStaffBranchId(b.staff_id);
      if (staffBranchId && staffBranchId !== branchFilter) return false;
    }
    if (staffSearch) {
      const searchLower = staffSearch.toLowerCase();
      return b.staff_name?.toLowerCase().includes(searchLower);
    }
    return true;
  }) || [];

  const filteredStaff = staffList?.filter(s => {
    if (branchFilter !== "all" && s.branch_id && s.branch_id !== branchFilter) return false;
    return true;
  }) || [];

  const pendingCount = filteredRequests.filter(r => r.status === "pending").length;
  const approvedCount = filteredRequests.filter(r => r.status === "approved").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          You don't have permission to view leave requests.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground">Review, approve, and manage staff leave requests</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {branches && branches.length > 1 && (
            <Select value={branchFilter} onValueChange={(v) => { setBranchFilter(v); setBalancesPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canWrite && (
            <Button onClick={() => setShowLeaveDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Request Leave
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leave Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaveTypes?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Staff with Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(leaveBalances?.map(b => b.staff_id)).size || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requests" className="gap-2">
            <Calendar className="h-4 w-4" /> Leave Requests
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-2">
            <Users className="h-4 w-4" /> Leave Balances
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-2">
            <Settings className="h-4 w-4" /> Leave Types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Leave Requests</CardTitle>
                  <CardDescription>View and manage staff leave requests</CardDescription>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredRequests.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.staff_name || "Unknown"}</TableCell>
                          <TableCell>{request.leave_type_name || "Leave"}</TableCell>
                          <TableCell>
                            {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{request.days_requested}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell className="text-right">
                            {request.status === "pending" && canApprove && (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => approveLeave.mutate(request.id)}
                                  disabled={approveLeave.isPending}
                                >
                                  <Check className="h-4 w-4 mr-1" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => rejectLeave.mutate(request.id)}
                                  disabled={rejectLeave.isPending}
                                >
                                  <X className="h-4 w-4 mr-1" /> Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No Leave Requests</h3>
                  <p className="text-muted-foreground mt-1">Staff leave requests will appear here when submitted</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="mt-4">
          {(() => {
            const grouped = filteredBalances.reduce((acc, bal) => {
              const key = bal.staff_id;
              if (!acc[key]) acc[key] = { staff_name: bal.staff_name || "Unknown", balances: [] };
              acc[key].balances.push(bal);
              return acc;
            }, {} as Record<string, { staff_name: string; balances: LeaveBalance[] }>);
            const staffEntries = Object.entries(grouped);
            const selectedStaff = selectedBalanceStaffId ? grouped[selectedBalanceStaffId] : null;

            if (selectedBalanceStaffId && selectedStaff) {
              const totalEntitled = selectedStaff.balances.reduce((sum, b) => sum + b.entitled_days, 0);
              const totalUsed = selectedStaff.balances.reduce((sum, b) => sum + b.used_days, 0);
              return (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBalanceStaffId(null)} className="gap-1 px-2">
                        <ArrowLeft className="h-4 w-4" /> Back
                      </Button>
                      <div>
                        <CardTitle>{selectedStaff.staff_name}</CardTitle>
                        <CardDescription>Leave balances for the current year</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totalEntitled}</div>
                        <div className="text-xs text-muted-foreground">Total Entitled</div>
                      </div>
                      <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
                        <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{totalUsed}</div>
                        <div className="text-xs text-muted-foreground">Total Used</div>
                      </div>
                      <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-3 text-center">
                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">{totalEntitled - totalUsed}</div>
                        <div className="text-xs text-muted-foreground">Total Remaining</div>
                      </div>
                    </div>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Leave Type</TableHead>
                            <TableHead className="text-center">Entitled</TableHead>
                            <TableHead className="text-center">Used</TableHead>
                            <TableHead className="text-center">Remaining</TableHead>
                            <TableHead className="text-right">Usage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedStaff.balances.map((bal) => {
                            const pct = bal.entitled_days > 0 ? Math.round((bal.used_days / bal.entitled_days) * 100) : 0;
                            return (
                              <TableRow key={bal.id}>
                                <TableCell className="font-medium">{bal.leave_type_name || "Leave"}</TableCell>
                                <TableCell className="text-center">{bal.entitled_days}</TableCell>
                                <TableCell className="text-center">{bal.used_days}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={bal.remaining_days <= 0 ? "destructive" : bal.remaining_days <= 3 ? "outline" : "default"}>
                                    {bal.remaining_days}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-primary"}`}
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Leave Balances</CardTitle>
                      <CardDescription>Select a staff member to view their leave balances</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-[250px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search staff..."
                          value={staffSearch}
                          onChange={(e) => { setStaffSearch(e.target.value); setBalancesPage(1); }}
                          className="pl-9"
                        />
                      </div>
                      <Button 
                        onClick={() => initializeBalances.mutate()} 
                        disabled={initializeBalances.isPending}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        {initializeBalances.isPending ? "Initializing..." : "Initialize / Refresh Balances"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {staffEntries.length > 0 ? (
                    <>
                      <div className="rounded-md border divide-y">
                        {staffEntries.slice((balancesPage - 1) * BALANCES_PER_PAGE, balancesPage * BALANCES_PER_PAGE).map(([staffId, { staff_name, balances }]) => {
                          const totalRemaining = balances.reduce((sum, b) => sum + b.remaining_days, 0);
                          const totalEntitled = balances.reduce((sum, b) => sum + b.entitled_days, 0);
                          const totalUsed = balances.reduce((sum, b) => sum + b.used_days, 0);
                          return (
                            <button
                              key={staffId}
                              onClick={() => setSelectedBalanceStaffId(staffId)}
                              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Users className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{staff_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {totalUsed} of {totalEntitled} days used
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant={totalRemaining <= 0 ? "destructive" : "default"}>
                                  {totalRemaining} days remaining
                                </Badge>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {staffEntries.length > BALANCES_PER_PAGE && (
                        <div className="flex items-center justify-between mt-4">
                          <p className="text-sm text-muted-foreground">
                            Showing {(balancesPage - 1) * BALANCES_PER_PAGE + 1}-{Math.min(balancesPage * BALANCES_PER_PAGE, staffEntries.length)} of {staffEntries.length} staff
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBalancesPage(p => Math.max(1, p - 1))}
                              disabled={balancesPage <= 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            {Array.from({ length: Math.ceil(staffEntries.length / BALANCES_PER_PAGE) }, (_, i) => i + 1)
                              .filter(p => p === 1 || p === Math.ceil(staffEntries.length / BALANCES_PER_PAGE) || Math.abs(p - balancesPage) <= 1)
                              .map((p, idx, arr) => (
                                <span key={p}>
                                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground">...</span>}
                                  <Button
                                    variant={p === balancesPage ? "default" : "outline"}
                                    size="sm"
                                    className="w-8 h-8 p-0"
                                    onClick={() => setBalancesPage(p)}
                                  >
                                    {p}
                                  </Button>
                                </span>
                              ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBalancesPage(p => Math.min(Math.ceil(staffEntries.length / BALANCES_PER_PAGE), p + 1))}
                              disabled={balancesPage >= Math.ceil(staffEntries.length / BALANCES_PER_PAGE)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold text-lg">No Leave Balances</h3>
                      <p className="text-muted-foreground mt-1">Click "Initialize / Refresh Balances" above to set up leave entitlements for all active staff</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        <TabsContent value="types" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Leave Types Configuration</CardTitle>
                  <CardDescription>Define leave types and how many days each staff member is entitled to per year</CardDescription>
                </div>
                {canWrite && (
                  <Button onClick={openNewLeaveType} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Leave Type
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {leaveTypes && leaveTypes.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead className="text-center">Days / Year</TableHead>
                        <TableHead className="text-center">Paid</TableHead>
                        <TableHead className="text-center">Carry Over</TableHead>
                        {canWrite && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveTypes.map((lt) => (
                        <TableRow key={lt.id}>
                          <TableCell className="font-medium">{lt.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{lt.code}</Badge>
                          </TableCell>
                          <TableCell className="text-center font-semibold">{lt.days_per_year}</TableCell>
                          <TableCell className="text-center">
                            {lt.is_paid ? (
                              <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Unpaid</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {lt.carry_over_allowed ? `Yes (${lt.max_carry_over_days} days max)` : "No"}
                          </TableCell>
                          {canWrite && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEditLeaveType(lt)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No Leave Types</h3>
                  <p className="text-muted-foreground mt-1">Leave types will be automatically created when you first access this page</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showLeaveTypeDialog} onOpenChange={(open) => { setShowLeaveTypeDialog(open); if (!open) { setEditingLeaveType(null); resetLeaveTypeForm(); }}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLeaveType ? "Edit Leave Type" : "Add Leave Type"}</DialogTitle>
            <DialogDescription>
              {editingLeaveType ? "Update the leave type details" : "Create a new leave type with days per year entitlement"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={leaveTypeForm.name}
                  onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })}
                  placeholder="e.g. Annual Leave"
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={leaveTypeForm.code}
                  onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. ANNUAL"
                  disabled={!!editingLeaveType}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Days Per Year</Label>
              <Input
                type="number"
                value={leaveTypeForm.days_per_year}
                onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, days_per_year: e.target.value })}
                placeholder="Number of days staff are entitled to"
              />
              <p className="text-xs text-muted-foreground">This is how many days of this leave type each staff member gets per year</p>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leaveTypeForm.is_paid}
                  onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, is_paid: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Paid Leave</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leaveTypeForm.carry_over_allowed}
                  onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, carry_over_allowed: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Allow Carry Over</span>
              </label>
            </div>
            {leaveTypeForm.carry_over_allowed && (
              <div className="space-y-2">
                <Label>Max Carry Over Days</Label>
                <Input
                  type="number"
                  value={leaveTypeForm.max_carry_over_days}
                  onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, max_carry_over_days: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowLeaveTypeDialog(false); setEditingLeaveType(null); resetLeaveTypeForm(); }}>Cancel</Button>
            <Button
              onClick={() => saveLeaveType.mutate()}
              disabled={saveLeaveType.isPending || !leaveTypeForm.name || !leaveTypeForm.code || !leaveTypeForm.days_per_year}
            >
              {saveLeaveType.isPending ? "Saving..." : editingLeaveType ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>Submit a leave request for a staff member</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Staff Member</Label>
              <Select value={leaveForm.staff_id} onValueChange={(v) => setLeaveForm({ ...leaveForm, staff_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStaff.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.first_name} {staff.last_name} ({staff.staff_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveForm.leave_type_id} onValueChange={(v) => setLeaveForm({ ...leaveForm, leave_type_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.name} ({type.days_per_year} days/year)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  value={leaveForm.start_date} 
                  onChange={(e) => handleDateChange("start_date", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input 
                  type="date" 
                  value={leaveForm.end_date} 
                  onChange={(e) => handleDateChange("end_date", e.target.value)} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Days Requested</Label>
              <Input 
                type="number" 
                value={leaveForm.days_requested} 
                onChange={(e) => setLeaveForm({ ...leaveForm, days_requested: e.target.value })}
                placeholder="Auto-calculated from dates"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea 
                value={leaveForm.reason} 
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} 
                placeholder="Reason for leave..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => createLeaveRequest.mutate()} 
              disabled={createLeaveRequest.isPending || !leaveForm.staff_id || !leaveForm.leave_type_id || !leaveForm.start_date || !leaveForm.end_date}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
