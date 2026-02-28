import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppDialog } from "@/hooks/use-app-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getErrorMessage } from "@/lib/error-utils";
import { UserPlus, Check, X, Trash2, Shield, AlertTriangle, TrendingUp, Wallet, Users, ChevronsUpDown } from "lucide-react";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface GuarantorsProps {
  organizationId: string;
  loanId: string;
  loanStatus: string;
  loanAmount?: number;
}

interface Guarantor {
  id: string;
  loan_id: string;
  guarantor_id: string;
  amount_guaranteed: number;
  guarantee_percentage?: number;
  relationship_to_borrower?: string;
  guarantor_savings_at_guarantee?: number;
  guarantor_shares_at_guarantee?: number;
  guarantor_total_exposure_at_guarantee?: number;
  available_guarantee_capacity?: number;
  status: string;
  rejection_reason?: string;
  accepted_at?: string;
  rejected_at?: string;
  consent_given?: boolean;
  consent_date?: string;
  consent_method?: string;
  created_at: string;
  guarantor?: {
    id: string;
    member_number: string;
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string;
    status?: string;
    savings_balance?: number;
    shares_balance?: number;
  };
}

interface EligibleMember {
  member_id: string;
  member_name: string;
  member_number: string;
  id_number?: string;
  phone?: string;
  email?: string;
  is_eligible: boolean;
  eligibility_reasons: string[];
  savings_balance: number;
  shares_balance: number;
  total_deposits: number;
  current_guarantee_exposure: number;
  active_guarantees_count: number;
  max_guarantee_capacity: number;
  available_guarantee_capacity: number;
  member_status: string;
  has_defaulted_loans: boolean;
  has_active_loans: boolean;
}

const guarantorSchema = z.object({
  guarantor_id: z.string().min(1, "Select a member"),
  amount_guaranteed: z.string().min(1, "Amount is required"),
  relationship_to_borrower: z.string().min(1, "Select relationship to borrower"),
});

type GuarantorFormData = z.infer<typeof guarantorSchema>;

const relationshipOptions = [
  { value: "spouse", label: "Spouse" },
  { value: "family", label: "Family Member" },
  { value: "colleague", label: "Work Colleague" },
  { value: "friend", label: "Friend" },
  { value: "business_partner", label: "Business Partner" },
  { value: "neighbor", label: "Neighbor" },
  { value: "other", label: "Other" },
];

export default function Guarantors({ organizationId, loanId, loanStatus, loanAmount = 0 }: GuarantorsProps) {
  const { toast } = useAppDialog();
  const [showDialog, setShowDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState<Guarantor | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedMember, setSelectedMember] = useState<EligibleMember | null>(null);
  const [guarantorSearchOpen, setGuarantorSearchOpen] = useState(false);
  const { canWrite: hasWritePermission } = useResourcePermissions(organizationId, RESOURCES.GUARANTORS);

  const canEdit = (loanStatus === "pending" || loanStatus === "under_review") && hasWritePermission;

  const { data: guarantors, isLoading } = useQuery<Guarantor[]>({
    queryKey: [`/api/organizations/${organizationId}/loans/${loanId}/guarantors`],
  });

  const { data: eligibleMembers, isLoading: loadingEligible } = useQuery<EligibleMember[]>({
    queryKey: [`/api/organizations/${organizationId}/loans/${loanId}/eligible-guarantors`],
    enabled: showDialog,
  });

  const form = useForm<GuarantorFormData>({
    resolver: zodResolver(guarantorSchema),
    defaultValues: {
      guarantor_id: "",
      amount_guaranteed: "",
      relationship_to_borrower: "",
    },
  });

  const guarantorsKey = `/api/organizations/${organizationId}/loans/${loanId}/guarantors`;
  const eligibleKey = `/api/organizations/${organizationId}/loans/${loanId}/eligible-guarantors`;

  const addMutation = useMutation({
    mutationFn: async (data: GuarantorFormData) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/loans/${loanId}/guarantors`, {
        guarantor_id: data.guarantor_id,
        amount_guaranteed: parseFloat(data.amount_guaranteed),
        relationship_to_borrower: data.relationship_to_borrower,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [guarantorsKey] });
      queryClient.invalidateQueries({ queryKey: [eligibleKey] });
      setShowDialog(false);
      setSelectedMember(null);
      form.reset();
      toast({ title: "Guarantor added successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to add guarantor", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PUT", `/api/organizations/${organizationId}/guarantors/${id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [guarantorsKey] });
      toast({ title: "Guarantee accepted" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to accept guarantee", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("PUT", `/api/organizations/${organizationId}/guarantors/${id}/reject`, { rejection_reason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [guarantorsKey] });
      queryClient.invalidateQueries({ queryKey: [eligibleKey] });
      setShowRejectDialog(null);
      setRejectReason("");
      toast({ title: "Guarantee rejected" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to reject guarantee", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/organizations/${organizationId}/guarantors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [guarantorsKey] });
      queryClient.invalidateQueries({ queryKey: [eligibleKey] });
      toast({ title: "Guarantor removed" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to remove guarantor", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const onSubmit = (data: GuarantorFormData) => {
    addMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      accepted: "default",
      rejected: "destructive",
      released: "outline",
      called: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return "-";
    return amount.toLocaleString();
  };

  const totalGuaranteed = guarantors?.reduce((sum, g) => sum + (g.status !== "rejected" ? Number(g.amount_guaranteed) : 0), 0) || 0;
  const acceptedCount = guarantors?.filter(g => g.status === "accepted").length || 0;
  const pendingCount = guarantors?.filter(g => g.status === "pending").length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Loan Guarantors
          </CardTitle>
          <CardDescription>
            Members guaranteeing this loan ({acceptedCount} accepted, {pendingCount} pending)
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {canEdit && (
            <Button onClick={() => setShowDialog(true)} size="sm" data-testid="button-add-guarantor">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Guarantor
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total Guaranteed</p>
            <p className="text-lg font-semibold">{formatCurrency(totalGuaranteed)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Loan Amount</p>
            <p className="text-lg font-semibold">{formatCurrency(loanAmount)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Coverage</p>
            <p className="text-lg font-semibold">{loanAmount > 0 ? ((totalGuaranteed / loanAmount) * 100).toFixed(0) : 0}%</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Guarantors</p>
            <p className="text-lg font-semibold">{guarantors?.length || 0}</p>
          </div>
        </div>

        {guarantors && guarantors.length > 0 ? (
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guarantor</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead>Savings at Guarantee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guarantors.map((g) => (
                  <TableRow key={g.id} data-testid={`guarantor-row-${g.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {g.guarantor?.first_name} {g.guarantor?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{g.guarantor?.member_number}</p>
                        {g.guarantor?.phone && (
                          <p className="text-xs text-muted-foreground">{g.guarantor.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{g.relationship_to_borrower?.replace("_", " ") || "-"}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(g.amount_guaranteed))}
                    </TableCell>
                    <TableCell className="text-right">
                      {g.guarantee_percentage ? `${Number(g.guarantee_percentage).toFixed(0)}%` : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>Savings: {formatCurrency(Number(g.guarantor_savings_at_guarantee))}</p>
                        <p className="text-xs text-muted-foreground">
                          Capacity: {formatCurrency(Number(g.available_guarantee_capacity))}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getStatusBadge(g.status)}
                        {g.rejection_reason && (
                          <p className="text-xs text-destructive">{g.rejection_reason}</p>
                        )}
                        {g.consent_given && g.consent_date && (
                          <p className="text-xs text-muted-foreground">
                            Consent: {new Date(g.consent_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {g.status === "pending" && canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => acceptMutation.mutate(g.id)}
                              disabled={acceptMutation.isPending}
                              data-testid={`button-accept-${g.id}`}
                              title="Accept Guarantee"
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowRejectDialog(g)}
                              data-testid={`button-reject-${g.id}`}
                              title="Reject Guarantee"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        {canEdit && g.status !== "accepted" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMutation.mutate(g.id)}
                            disabled={removeMutation.isPending}
                            data-testid={`button-remove-${g.id}`}
                            title="Remove Guarantor"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
            <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No guarantors added yet</p>
            {canEdit && (
              <Button variant="link" onClick={() => setShowDialog(true)}>
                Add a guarantor
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Add Guarantor Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Loan Guarantor
            </DialogTitle>
            <DialogDescription>
              Select an eligible member to guarantee this loan. Members must have sufficient savings and no defaults.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Member Selection */}
              <FormField
                control={form.control}
                name="guarantor_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Select Guarantor <span className="text-destructive">*</span></FormLabel>
                    <Popover open={guarantorSearchOpen} onOpenChange={setGuarantorSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            data-testid="select-guarantor"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? eligibleMembers?.find((m) => m.member_id === field.value)?.member_name || "Select a member..."
                              : "Search by name, member number, ID number, phone, email..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[450px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by name, member number, ID number, phone, email..." />
                          <CommandList>
                            {loadingEligible ? (
                              <div className="p-4 text-center">Loading eligible members...</div>
                            ) : (
                              <>
                                <CommandEmpty>No eligible members found.</CommandEmpty>
                                <CommandGroup>
                                  {eligibleMembers?.map((member) => (
                                    <CommandItem
                                      key={member.member_id}
                                      value={`${member.member_name} ${member.member_number} ${member.id_number || ""} ${member.phone || ""} ${member.email || ""}`}
                                      disabled={!member.is_eligible}
                                      onSelect={() => {
                                        field.onChange(member.member_id);
                                        setSelectedMember(member);
                                        setGuarantorSearchOpen(false);
                                      }}
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        {member.is_eligible ? (
                                          <Check className="h-3 w-3 text-green-600 shrink-0" />
                                        ) : (
                                          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                        )}
                                        <div className="flex flex-col flex-1 min-w-0">
                                          <span className="truncate">{member.member_name} ({member.member_number})</span>
                                          <span className="text-xs text-muted-foreground">
                                            Capacity: {formatCurrency(member.available_guarantee_capacity)}
                                          </span>
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Selected Member Details */}
              {selectedMember && (
                <Card className={selectedMember.is_eligible ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{selectedMember.member_name}</h4>
                        <p className="text-sm text-muted-foreground">{selectedMember.member_number}</p>
                      </div>
                      <Badge variant={selectedMember.is_eligible ? "default" : "secondary"}>
                        {selectedMember.is_eligible ? "Eligible" : "Not Eligible"}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Savings</p>
                          <p className="font-medium">{formatCurrency(selectedMember.savings_balance)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Max Capacity</p>
                          <p className="font-medium">{formatCurrency(selectedMember.max_guarantee_capacity)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Current Exposure</p>
                          <p className="font-medium">{formatCurrency(selectedMember.current_guarantee_exposure)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Available</p>
                          <p className="font-medium text-green-600">{formatCurrency(selectedMember.available_guarantee_capacity)}</p>
                        </div>
                      </div>
                    </div>
                    
                    {!selectedMember.is_eligible && (
                      <div className="mt-3 p-2 bg-amber-100 rounded text-sm">
                        <p className="font-medium text-amber-800">Eligibility Issues:</p>
                        <ul className="list-disc list-inside text-amber-700">
                          {selectedMember.eligibility_reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Relationship */}
              <FormField
                control={form.control}
                name="relationship_to_borrower"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship to Borrower <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-relationship">
                          <SelectValue placeholder="Select relationship..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {relationshipOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount_guaranteed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount to Guarantee <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter amount"
                        {...field}
                        data-testid="input-amount"
                      />
                    </FormControl>
                    <FormDescription>
                      {selectedMember && (
                        <>
                          Available capacity: {formatCurrency(selectedMember.available_guarantee_capacity)}
                          {loanAmount > 0 && field.value && (
                            <> | Coverage: {((parseFloat(field.value) / loanAmount) * 100).toFixed(1)}% of loan</>
                          )}
                        </>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowDialog(false); form.reset(); setSelectedMember(null); }}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={addMutation.isPending || !selectedMember?.is_eligible}
                  data-testid="button-submit-guarantor"
                >
                  {addMutation.isPending ? "Adding..." : "Add Guarantor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!showRejectDialog} onOpenChange={(open) => { if (!open) { setShowRejectDialog(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-destructive" />
              Reject Guarantee
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this guarantee request from{" "}
              {showRejectDialog?.guarantor?.first_name} {showRejectDialog?.guarantor?.last_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rejection Reason <span className="text-destructive">*</span></label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why the guarantee is being rejected..."
                rows={3}
                data-testid="input-reject-reason"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(null); setRejectReason(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showRejectDialog && rejectMutation.mutate({ id: showRejectDialog.id, reason: rejectReason })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Guarantee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
