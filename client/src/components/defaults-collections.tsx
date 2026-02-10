import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { RefreshButton } from "@/components/refresh-button";
import { AlertTriangle, Phone, Calendar, FileWarning, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useCurrency } from "@/hooks/use-currency";

interface DefaultsCollectionsProps {
  organizationId: string;
}

interface LoanDefault {
  id: string;
  loan_id: string;
  days_overdue: number;
  amount_overdue: number;
  penalty_amount: number;
  status: string;
  collection_notes?: string;
  next_action_date?: string;
  assigned_to_id?: string;
  loan?: {
    application_number: string;
    member?: {
      first_name: string;
      last_name: string;
      phone: string;
    };
  };
}

interface DueTodayLoan {
  loan_id: string;
  application_number: string;
  member?: {
    first_name: string;
    last_name: string;
    phone: string;
    member_number?: string;
  };
  instalment_amount: number;
  amount_due: number;
  outstanding_balance: number;
  next_payment_date: string;
  frequency: string;
  is_overdue: boolean;
  days_overdue: number;
  total_paid: number;
}

interface DueTodayResponse {
  due_today: DueTodayLoan[];
  overdue: DueTodayLoan[];
}

interface DefaultSummary {
  total_defaulted: number;
  total_amount_overdue: number;
  total_penalties: number;
  by_aging: Record<string, number>;
}

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
}

export default function DefaultsCollections({ organizationId }: DefaultsCollectionsProps) {
  const { toast } = useToast();
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const [selectedDefault, setSelectedDefault] = useState<LoanDefault | null>(null);
  const [collectionNotes, setCollectionNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.DEFAULTS);

  const { data: dueTodayData, isLoading: isDueTodayLoading } = useQuery<DueTodayResponse>({
    queryKey: ["/api/organizations", organizationId, "defaults", "due-today"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/defaults/due-today`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch due today");
      return res.json();
    },
    staleTime: 5000,
    refetchOnMount: "always",
  });

  const { data: defaults, isLoading, isError } = useQuery<LoanDefault[]>({
    queryKey: ["/api/organizations", organizationId, "defaults"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/defaults`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch defaults");
      return res.json();
    },
    staleTime: 5000,
    refetchOnMount: "always",
  });

  const { data: summary } = useQuery<DefaultSummary>({
    queryKey: ["/api/organizations", organizationId, "defaults", "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/defaults/summary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    staleTime: 5000,
    refetchOnMount: "always",
  });

  const { data: staff } = useQuery<Staff[]>({
    queryKey: ["/api/organizations", organizationId, "staff"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/staff`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; status?: string; collection_notes?: string; assigned_to_id?: string }) => {
      return apiRequest("PUT", `/api/organizations/${organizationId}/defaults/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "defaults"] });
      setSelectedDefault(null);
      setCollectionNotes("");
      setSelectedStatus("");
      setAssignedTo("");
      toast({ title: "Default record updated" });
    },
    onError: () => {
      toast({ title: "Failed to update record", variant: "destructive" });
    },
  });

  const formatCurrency = (amount: number) => {
    return formatAmount(amount || 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "destructive";
      case "in_collection": return "secondary";
      case "resolved": return "default";
      case "written_off": return "outline";
      default: return "secondary";
    }
  };

  const openUpdateDialog = (def: LoanDefault) => {
    setSelectedDefault(def);
    setCollectionNotes(def.collection_notes || "");
    setSelectedStatus(def.status);
    setAssignedTo(def.assigned_to_id || "");
  };

  const handleUpdate = () => {
    if (!selectedDefault) return;
    updateMutation.mutate({
      id: selectedDefault.id,
      status: selectedStatus,
      collection_notes: collectionNotes,
      assigned_to_id: assignedTo || undefined,
    });
  };

  const dueTodayLoans = dueTodayData?.due_today || [];
  const overdueLoansFromApi = dueTodayData?.overdue || [];
  const totalDueToday = dueTodayLoans.reduce((sum, l) => sum + l.instalment_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-defaults-title">Defaults & Collections</h1>
          <p className="text-muted-foreground">Track overdue loans, due instalments, and manage collections</p>
        </div>
        <RefreshButton organizationId={organizationId} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {dueTodayLoans.length} {dueTodayLoans.length === 1 ? 'loan' : 'loans'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{formatCurrency(totalDueToday)} total due</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue Loans</CardTitle>
            <FileWarning className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {overdueLoansFromApi.length} {overdueLoansFromApi.length === 1 ? 'loan' : 'loans'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Past payment date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Defaulted</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-defaulted">
              {summary?.total_defaulted || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Penalties</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.total_penalties || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Instalments Due Today
          </CardTitle>
          <CardDescription>Loans with payments due today or pending collection</CardDescription>
        </CardHeader>
        <CardContent>
          {isDueTodayLoading ? (
            <Skeleton className="h-48" />
          ) : dueTodayLoans.length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan #</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead className="text-right">Instalment Amount</TableHead>
                    <TableHead className="text-right">Outstanding Balance</TableHead>
                    <TableHead>Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dueTodayLoans.map((loan) => (
                    <TableRow key={loan.loan_id}>
                      <TableCell className="font-mono">{loan.application_number}</TableCell>
                      <TableCell>
                        {loan.member ? `${loan.member.first_name} ${loan.member.last_name}` : "-"}
                      </TableCell>
                      <TableCell className="capitalize">{loan.frequency}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(loan.instalment_amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(loan.outstanding_balance)}</TableCell>
                      <TableCell>
                        {loan.member?.phone && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={`tel:${loan.member.phone}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="font-medium">No instalments due today</h3>
              <p className="text-sm text-muted-foreground">All payments are up to date</p>
            </div>
          )}
        </CardContent>
      </Card>

      {overdueLoansFromApi.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Overdue Instalments ({overdueLoansFromApi.length})
            </CardTitle>
            <CardDescription>Loans with missed payment dates that need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan #</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                    <TableHead className="text-right">Outstanding Balance</TableHead>
                    <TableHead>Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueLoansFromApi.map((loan) => (
                    <TableRow key={loan.loan_id}>
                      <TableCell className="font-mono">{loan.application_number}</TableCell>
                      <TableCell>
                        {loan.member ? `${loan.member.first_name} ${loan.member.last_name}` : "-"}
                      </TableCell>
                      <TableCell className="capitalize">{loan.frequency}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{loan.days_overdue} {loan.days_overdue === 1 ? 'day' : 'days'}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(loan.amount_due)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(loan.outstanding_balance)}</TableCell>
                      <TableCell>
                        {loan.member?.phone && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={`tel:${loan.member.phone}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
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
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Defaulted Loans
          </CardTitle>
          <CardDescription>Loans formally flagged as defaulted with collection actions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-medium">Failed to load defaults</h3>
              <p className="text-sm text-muted-foreground">Please try again later</p>
            </div>
          ) : defaults && defaults.length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead className="text-right">Amount Overdue</TableHead>
                  <TableHead className="text-right">Penalty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaults.map((def) => (
                  <TableRow key={def.id} data-testid={`row-default-${def.id}`}>
                    <TableCell className="font-mono">{def.loan?.application_number || def.loan_id}</TableCell>
                    <TableCell>
                      {def.loan?.member ? `${def.loan.member.first_name} ${def.loan.member.last_name}` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={def.days_overdue > 60 ? "destructive" : "secondary"}>
                        {def.days_overdue} {def.days_overdue === 1 ? 'day' : 'days'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(def.amount_overdue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(def.penalty_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(def.status)} className="capitalize">
                        {def.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {def.assigned_to_id ? staff?.find(s => s.id === def.assigned_to_id)?.first_name || "-" : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {canWrite && (
                          <Button variant="ghost" size="sm" onClick={() => openUpdateDialog(def)} data-testid={`button-update-${def.id}`}>
                            Update
                          </Button>
                        )}
                        {def.loan?.member?.phone && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={`tel:${def.loan.member.phone}`}>
                              <Phone className="h-4 w-4" />
                            </a>
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
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="font-medium">No overdue loans</h3>
              <p className="text-sm text-muted-foreground">All loans are in good standing</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDefault} onOpenChange={(open) => !open && setSelectedDefault(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Default Record</DialogTitle>
            <DialogDescription>
              Update collection status for {selectedDefault?.loan?.application_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="in_collection">In Collection</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="written_off">Written Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Assign To</label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger data-testid="select-assigned-to">
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Collection Notes</label>
              <Textarea
                value={collectionNotes}
                onChange={(e) => setCollectionNotes(e.target.value)}
                placeholder="Notes about collection attempts..."
                className="resize-none"
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDefault(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-save-default">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
