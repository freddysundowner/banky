import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  FormDescription,
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
import { useAppDialog } from "@/hooks/use-app-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getErrorMessage } from "@/lib/error-utils";
import { Users, Plus, Pencil, Trash2, Mail, Phone, Lock, Unlock, KeyRound, UserX, UserCheck, MoreHorizontal, ArrowLeft, Building2, User, IdCard, Search, ChevronLeft, ChevronRight, Loader2, UserPlus, LinkIcon, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Staff, Branch } from "@shared/tenant-types";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import AddStaffPage from "@/pages/add-staff";

interface StaffManagementProps {
  organizationId: string;
}

interface RoleData {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  permissions: string[];
}

const staffUpdateSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  secondary_email: z.string().email("Valid email is required").optional().or(z.literal("")),
  phone: z.string().optional(),
  role: z.string().default("staff"),
  branch_id: z.string().optional(),
  national_id: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  next_of_kin_name: z.string().optional(),
  next_of_kin_phone: z.string().optional(),
  next_of_kin_relationship: z.string().optional(),
});

type StaffUpdateData = z.infer<typeof staffUpdateSchema>;

interface EditStaffPageProps {
  organizationId: string;
  staffData: Staff;
  onBack: () => void;
}

function EditStaffPage({ organizationId, staffData, onBack }: EditStaffPageProps) {
  const { toast } = useAppDialog();
  const { user } = useAuth();
  const [approvalPin, setApprovalPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [linkedMemberInfo, setLinkedMemberInfo] = useState<{id: string; member_number: string; name: string} | null>(null);
  const [memberFormData, setMemberFormData] = useState({
    id_type: "national_id",
    id_number: "",
    date_of_birth: "",
    gender: "",
    marital_status: "",
    address: "",
    city: "",
    county: "",
    next_of_kin_name: "",
    next_of_kin_phone: "",
    next_of_kin_relationship: "",
  });

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

  const { data: roles } = useQuery<RoleData[]>({
    queryKey: ["/api/organizations", organizationId, "roles"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/roles`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
  });

  const staffWithProfile = staffData as Staff & { profile?: any };

  const form = useForm<StaffUpdateData>({
    resolver: zodResolver(staffUpdateSchema),
    defaultValues: {
      first_name: staffData.first_name,
      last_name: staffData.last_name,
      email: staffData.email,
      secondary_email: staffData.secondary_email || "",
      phone: staffData.phone || "",
      role: staffData.role,
      branch_id: staffData.branch_id || undefined,
      national_id: staffWithProfile.profile?.national_id || "",
      date_of_birth: staffWithProfile.profile?.date_of_birth || "",
      gender: staffWithProfile.profile?.gender || "",
      next_of_kin_name: staffWithProfile.profile?.next_of_kin_name || "",
      next_of_kin_phone: staffWithProfile.profile?.next_of_kin_phone || "",
      next_of_kin_relationship: staffWithProfile.profile?.next_of_kin_relationship || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: StaffUpdateData) => {
      return apiRequest("PATCH", `/api/organizations/${organizationId}/staff/${staffData.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "staff"] });
      toast({ title: "Staff member updated successfully" });
      onBack();
    },
    onError: () => {
      toast({ title: "Failed to update staff member", variant: "destructive" });
    },
  });

  const setPinMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/organizations/${organizationId}/staff/${staffData.id}/set-approval-pin`, { pin: approvalPin });
    },
    onSuccess: () => {
      setApprovalPin("");
      setConfirmPin("");
      toast({ title: "Approval PIN set successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to set approval PIN", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createMemberMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/organizations/${organizationId}/staff/${staffData.id}/create-member-account`, memberFormData);
    },
    onSuccess: async (res: any) => {
      const data = typeof res.json === 'function' ? await res.json() : res;
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      if (data.member) {
        setLinkedMemberInfo({
          id: data.member.id,
          member_number: data.member.member_number,
          name: `${data.member.first_name} ${data.member.last_name}`,
        });
      }
      setShowMemberDialog(false);
      toast({ title: data.message || "Member account created and linked" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to create member account", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const handleSetPin = () => {
    if (approvalPin.length < 4 || approvalPin.length > 6 || !/^\d+$/.test(approvalPin)) {
      toast({ title: "PIN must be 4-6 digits", variant: "destructive" });
      return;
    }
    if (approvalPin !== confirmPin) {
      toast({ title: "PINs do not match", variant: "destructive" });
      return;
    }
    setPinMutation.mutate();
  };

  const handleSubmit = (data: StaffUpdateData) => {
    updateMutation.mutate(data);
  };

  const selectedRole = form.watch("role");
  const showPinSection = ["manager", "admin", "supervisor", "owner"].includes(selectedRole || "");
  const hasLinkedMember = !!(staffData as any).linked_member_id || !!linkedMemberInfo;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Edit Staff Member</h1>
            <p className="text-muted-foreground">{staffData.first_name} {staffData.last_name}</p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Basic Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="first_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="Enter first name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="last_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="Enter last name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <CardTitle>Contact Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Work Email</label>
                  <Input value={staffData.email || ""} disabled className="bg-muted" />
                  <p className="text-sm text-muted-foreground">Email cannot be changed</p>
                </div>
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., 0712345678" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="secondary_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Email (Optional)</FormLabel>
                  <FormControl><Input {...field} type="email" placeholder="Personal email for payslip CC" /></FormControl>
                  <FormDescription>Payslip emails will be CC'd to this address</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IdCard className="h-5 w-5 text-primary" />
                <CardTitle>Personal Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="national_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>National ID Number</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., 12345678" /></FormControl>
                    <FormDescription>Used as payslip PDF password</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl><Input {...field} type="date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Next of Kin</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="next_of_kin_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input {...field} placeholder="Next of kin full name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="next_of_kin_phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input {...field} placeholder="Phone number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="next_of_kin_relationship" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Assignment</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(roles || []).map((role) => (
                          <SelectItem key={role.name} value={role.name}>
                            {role.name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {!(branches && branches.length === 1) && (
                <FormField control={form.control} name="branch_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    {canSeeAllBranches ? (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches?.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md border">
                        {branches?.find(b => b.id === userBranchId)?.name || "Your assigned branch"}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onBack}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>

      {showPinSection && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle>Approval PIN</CardTitle>
            </div>
            <CardDescription>
              Set a 4-6 digit PIN for this staff member to approve float shortages and other sensitive operations at the teller station.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="approval-pin">New PIN</Label>
                <Input
                  id="approval-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 4-6 digit PIN"
                  value={approvalPin}
                  onChange={(e) => setApprovalPin(e.target.value.replace(/\D/g, ""))}
                  data-testid="input-approval-pin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pin">Confirm PIN</Label>
                <Input
                  id="confirm-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Re-enter PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  data-testid="input-confirm-approval-pin"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSetPin}
                disabled={!approvalPin || !confirmPin || setPinMutation.isPending}
                data-testid="button-set-approval-pin"
              >
                {setPinMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Set Approval PIN
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            <CardTitle>Member Account</CardTitle>
          </div>
          <CardDescription>
            Link this staff member to a member account so they can receive loans and access member services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasLinkedMember ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Member Account Linked</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {linkedMemberInfo
                    ? `Account: ${linkedMemberInfo.member_number} - ${linkedMemberInfo.name}`
                    : (staffData as any).linked_member_number
                      ? `Account: ${(staffData as any).linked_member_number} - ${(staffData as any).linked_member_name || ""}`
                      : "This staff member has a linked member account"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This staff member does not have a member account yet. Create one to enable them to apply for loans and use member services.
              </p>
              <Button
                type="button"
                onClick={() => {
                  const p = staffWithProfile.profile;
                  setMemberFormData(prev => ({
                    ...prev,
                    id_number: p?.national_id || "",
                    date_of_birth: p?.date_of_birth || "",
                    gender: p?.gender || "",
                    next_of_kin_name: p?.next_of_kin_name || "",
                    next_of_kin_phone: p?.next_of_kin_phone || "",
                    next_of_kin_relationship: p?.next_of_kin_relationship || "",
                  }));
                  setShowMemberDialog(true);
                }}
                data-testid="button-create-member-account"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create Member Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Member Account</DialogTitle>
            <DialogDescription>
              Create a member account for {staffData.first_name} {staffData.last_name}. The name, email, phone, and branch will be copied from the staff record. Please fill in any additional details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={`${staffData.first_name} ${staffData.last_name}`} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={staffData.email || ""} disabled className="bg-muted" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={staffData.phone || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>ID Number</Label>
                <Input
                  placeholder="National ID number"
                  value={memberFormData.id_number}
                  onChange={(e) => setMemberFormData(prev => ({ ...prev, id_number: e.target.value }))}
                  data-testid="input-member-id-number"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={memberFormData.date_of_birth}
                  onChange={(e) => setMemberFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                  data-testid="input-member-dob"
                />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select
                  value={memberFormData.gender}
                  onValueChange={(val) => setMemberFormData(prev => ({ ...prev, gender: val }))}
                >
                  <SelectTrigger data-testid="select-member-gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Marital Status</Label>
                <Select
                  value={memberFormData.marital_status}
                  onValueChange={(val) => setMemberFormData(prev => ({ ...prev, marital_status: val }))}
                >
                  <SelectTrigger data-testid="select-member-marital-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="divorced">Divorced</SelectItem>
                    <SelectItem value="widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>County</Label>
                <Input
                  placeholder="County"
                  value={memberFormData.county}
                  onChange={(e) => setMemberFormData(prev => ({ ...prev, county: e.target.value }))}
                  data-testid="input-member-county"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                placeholder="Physical address"
                value={memberFormData.address}
                onChange={(e) => setMemberFormData(prev => ({ ...prev, address: e.target.value }))}
                data-testid="input-member-address"
              />
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Next of Kin</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    placeholder="Next of kin name"
                    value={memberFormData.next_of_kin_name}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, next_of_kin_name: e.target.value }))}
                    data-testid="input-member-nok-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    placeholder="Next of kin phone"
                    value={memberFormData.next_of_kin_phone}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, next_of_kin_phone: e.target.value }))}
                    data-testid="input-member-nok-phone"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Select
                    value={memberFormData.next_of_kin_relationship}
                    onValueChange={(val) => setMemberFormData(prev => ({ ...prev, next_of_kin_relationship: val }))}
                  >
                    <SelectTrigger data-testid="select-member-nok-relationship">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowMemberDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => createMemberMutation.mutate()}
              disabled={createMemberMutation.isPending}
              data-testid="button-confirm-create-member"
            >
              {createMemberMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create & Link Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StaffManagement({ organizationId }: StaffManagementProps) {
  const { toast } = useAppDialog();
  const { user } = useAuth();
  const [showAddPage, setShowAddPage] = useState(false);
  const [showEditPage, setShowEditPage] = useState(false);
  const [editingStaffData, setEditingStaffData] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState<Staff | null>(null);
  const [resettingPassword, setResettingPassword] = useState<Staff | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [staffPage, setStaffPage] = useState(1);
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [debouncedStaffSearch, setDebouncedStaffSearch] = useState("");
  const STAFF_PER_PAGE = 15;
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.STAFF);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStaffSearch(staffSearchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [staffSearchQuery]);

  const userBranchId = (user as any)?.branchId;
  const userRole = (user as any)?.role;
  const canSeeAllBranches = !userBranchId || userRole === 'admin' || userRole === 'owner';

  interface PaginatedStaff {
    items: Staff[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  }

  const { data: staffData, isLoading } = useQuery<PaginatedStaff>({
    queryKey: ["/api/organizations", organizationId, "staff", debouncedStaffSearch, staffPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedStaffSearch.trim()) {
        params.append("search", debouncedStaffSearch.trim());
      }
      params.append("page", staffPage.toString());
      params.append("per_page", STAFF_PER_PAGE.toString());
      const res = await fetch(`/api/organizations/${organizationId}/staff?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });

  const staffList = staffData?.items;
  const totalStaff = staffData?.total || 0;
  const totalStaffPages = staffData?.total_pages || 0;

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/organizations", organizationId, "branches"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/branches`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return;
      return apiRequest("DELETE", `/api/organizations/${organizationId}/staff/${deleting.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "staff"] });
      setDeleting(null);
      toast({ title: "Staff member deleted successfully" });
    },
    onError: (error: unknown) => {
      setDeleting(null);
      toast({ 
        title: "Cannot delete staff", 
        description: getErrorMessage(error),
        variant: "destructive" 
      });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (staffId: string) => {
      return apiRequest("PUT", `/api/organizations/${organizationId}/hr/staff/${staffId}/lock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "staff"] });
      toast({ title: "Staff account locked" });
    },
    onError: () => {
      toast({ title: "Failed to lock account", variant: "destructive" });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async (staffId: string) => {
      return apiRequest("PUT", `/api/organizations/${organizationId}/hr/staff/${staffId}/unlock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "staff"] });
      toast({ title: "Staff account unlocked" });
    },
    onError: () => {
      toast({ title: "Failed to unlock account", variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (staffId: string) => {
      return apiRequest("PUT", `/api/organizations/${organizationId}/hr/staff/${staffId}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "staff"] });
      toast({ title: "Staff activated" });
    },
    onError: () => {
      toast({ title: "Failed to activate staff", variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (staffId: string) => {
      return apiRequest("PUT", `/api/organizations/${organizationId}/hr/staff/${staffId}/deactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "staff"] });
      toast({ title: "Staff deactivated" });
    },
    onError: () => {
      toast({ title: "Failed to deactivate staff", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!resettingPassword) return;
      return apiRequest("PUT", `/api/organizations/${organizationId}/hr/staff/${resettingPassword.id}/reset-password`, { new_password: newPassword });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "staff"] });
      setResettingPassword(null);
      setNewPassword("");
      toast({ title: "Password reset successfully" });
    },
    onError: () => {
      toast({ title: "Failed to reset password", variant: "destructive" });
    },
  });

  if (showAddPage) {
    return <AddStaffPage organizationId={organizationId} onBack={() => setShowAddPage(false)} />;
  }

  if (showEditPage && editingStaffData) {
    return <EditStaffPage organizationId={organizationId} staffData={editingStaffData} onBack={() => { setShowEditPage(false); setEditingStaffData(null); }} />;
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "manager": return "default";
      case "loan_officer": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">{totalStaff} staff member{totalStaff !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {canWrite && (
            <Button onClick={() => setShowAddPage(true)} data-testid="button-add-staff" className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add Staff</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or employee number..."
                value={staffSearchQuery}
                onChange={(e) => { setStaffSearchQuery(e.target.value); setStaffPage(1); }}
                className="pl-9"
              />
            </div>
            {staffSearchQuery && (
              <Button variant="ghost" size="sm" onClick={() => { setStaffSearchQuery(""); setStaffPage(1); }}>
                Clear
              </Button>
            )}
          </div>
          {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : staffList && staffList.length > 0 ? (
              <>
                <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Employee #</TableHead>
                      <TableHead className="hidden md:table-cell">Contact</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden lg:table-cell">Branch</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffList.map((staff) => (
                      <TableRow key={staff.id} data-testid={`row-staff-${staff.id}`}>
                        <TableCell className="font-medium">
                          <div>{staff.first_name} {staff.last_name}</div>
                          <div className="text-sm text-muted-foreground sm:hidden">{staff.staff_number || ""}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{staff.staff_number || "-"}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {staff.email}
                            </div>
                            {staff.phone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {staff.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(staff.role)}>
                            {staff.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{(staff as any).branch_name || "-"}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={staff.is_active ? "default" : "secondary"}>
                            {staff.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canWrite && (
                              <Button variant="ghost" size="icon" onClick={() => { setEditingStaffData(staff); setShowEditPage(true); }} data-testid={`button-edit-staff-${staff.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canWrite && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setResettingPassword(staff)}>
                                    <KeyRound className="mr-2 h-4 w-4" />
                                    Reset Password
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {(staff as any).is_locked ? (
                                    <DropdownMenuItem onClick={() => unlockMutation.mutate(staff.id)}>
                                      <Unlock className="mr-2 h-4 w-4" />
                                      Unlock Account
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => lockMutation.mutate(staff.id)}>
                                      <Lock className="mr-2 h-4 w-4" />
                                      Lock Account
                                    </DropdownMenuItem>
                                  )}
                                  {staff.is_active ? (
                                    <DropdownMenuItem onClick={() => deactivateMutation.mutate(staff.id)}>
                                      <UserX className="mr-2 h-4 w-4" />
                                      Deactivate
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => activateMutation.mutate(staff.id)}>
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      Activate
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setDeleting(staff)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                {totalStaffPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(staffPage - 1) * STAFF_PER_PAGE + 1}-{Math.min(staffPage * STAFF_PER_PAGE, totalStaff)} of {totalStaff} staff
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStaffPage(p => Math.max(1, p - 1))}
                        disabled={staffPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: totalStaffPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalStaffPages || Math.abs(p - staffPage) <= 1)
                        .map((p, idx, arr) => (
                          <span key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground">...</span>}
                            <Button
                              variant={p === staffPage ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => setStaffPage(p)}
                            >
                              {p}
                            </Button>
                          </span>
                        ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStaffPage(p => Math.min(totalStaffPages, p + 1))}
                        disabled={staffPage >= totalStaffPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : staffSearchQuery ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium">No results found</h3>
                <p className="text-sm text-muted-foreground mb-4">No staff match "{staffSearchQuery}"</p>
                <Button variant="outline" onClick={() => { setStaffSearchQuery(""); setStaffPage(1); }}>
                  Clear Search
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium">No staff members yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Add your first staff member to get started</p>
                {canWrite && (
                  <Button onClick={() => setShowAddPage(true)} data-testid="button-add-first-staff">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Staff
                  </Button>
                )}
              </div>
            )}
        </CardContent>
      </Card>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Staff Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleting?.first_name} {deleting?.last_name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-staff">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resettingPassword} onOpenChange={(open) => { if (!open) { setResettingPassword(null); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resettingPassword?.first_name} {resettingPassword?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResettingPassword(null); setNewPassword(""); }}>Cancel</Button>
            <Button onClick={() => resetPasswordMutation.mutate()} disabled={newPassword.length < 6 || resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
