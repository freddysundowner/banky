import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCheck,
  Trash2,
  Edit,
  PhoneCall,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CRMProps {
  organizationId: string;
  onConvertToMember?: (contact: { first_name: string; last_name: string; phone?: string; email?: string }) => void;
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  first_name: z.string().min(1, "First name required"),
  last_name: z.string().min(1, "Last name required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  source: z.string().optional(),
  referred_by: z.string().optional(),
  interest: z.string().optional(),
  estimated_amount: z.string().optional(),
  notes: z.string().optional(),
});

const interactionSchema = z.object({
  interaction_type: z.string().min(1, "Type required"),
  interaction_date: z.string().optional(),
  notes: z.string().min(1, "Notes required"),
  outcome: z.string().optional(),
});

const followupSchema = z.object({
  contact_id: z.string().min(1, "Contact required"),
  description: z.string().min(1, "Description required"),
  due_date: z.string().min(1, "Due date required"),
  assigned_to_id: z.string().optional(),
});

// ── Status badges ─────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  qualified: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  converted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  done: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main CRM component ────────────────────────────────────────────────────────

export default function CRMManagement({ organizationId, onConvertToMember }: CRMProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState("contacts");

  const [showAddContact, setShowAddContact] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const [showInteractionDialog, setShowInteractionDialog] = useState<any>(null);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState<any>(null);
  const [showConvertDialog, setShowConvertDialog] = useState<any>(null);
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const statsQuery = useQuery<any>({
    queryKey: [`/api/organizations/${organizationId}/crm/stats`],
  });

  const contactsQuery = useQuery<any[]>({
    queryKey: [`/api/organizations/${organizationId}/crm/contacts`, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      return fetch(`/api/organizations/${organizationId}/crm/contacts?${params}`, {
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || r.statusText || "Request failed");
        return r.json();
      });
    },
  });

  const interactionsQuery = useQuery<any[]>({
    queryKey: [`/api/organizations/${organizationId}/crm/interactions`],
    enabled: activeTab === "interactions",
  });

  const followupsQuery = useQuery<any[]>({
    queryKey: [`/api/organizations/${organizationId}/crm/followups`],
    enabled: activeTab === "followups",
  });

  // ── Contact CRUD ───────────────────────────────────────────────────────────

  const addContactMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/organizations/${organizationId}/crm/contacts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/contacts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/stats`] });
      setShowAddContact(false);
      toast({ title: "Contact added" });
    },
    onError: () => toast({ title: "Failed to add contact", variant: "destructive" }),
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, data }: any) =>
      apiRequest("PUT", `/api/organizations/${organizationId}/crm/contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/contacts`] });
      setEditContact(null);
      toast({ title: "Contact updated" });
    },
    onError: () => toast({ title: "Failed to update contact", variant: "destructive" }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/organizations/${organizationId}/crm/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/contacts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/stats`] });
      toast({ title: "Contact deleted" });
    },
    onError: () => toast({ title: "Failed to delete contact", variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/organizations/${organizationId}/crm/contacts/${id}/convert`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/contacts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/stats`] });
      const contact = showConvertDialog;
      setShowConvertDialog(null);
      if (onConvertToMember && contact) {
        const [first_name, ...rest] = (contact.full_name || "").trim().split(" ");
        onConvertToMember({
          first_name: first_name || contact.first_name || "",
          last_name: rest.join(" ") || contact.last_name || "",
          phone: contact.phone || "",
          email: contact.email || "",
        });
      } else {
        toast({ title: "Contact marked as converted", description: "You can now create them as a member." });
      }
    },
    onError: () => toast({ title: "Conversion failed", variant: "destructive" }),
  });

  // ── Interaction CRUD ───────────────────────────────────────────────────────

  const addInteractionMutation = useMutation({
    mutationFn: ({ contactId, data }: any) =>
      apiRequest("POST", `/api/organizations/${organizationId}/crm/contacts/${contactId}/interactions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/contacts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/interactions`] });
      setShowInteractionDialog(null);
      toast({ title: "Interaction logged" });
    },
    onError: () => toast({ title: "Failed to log interaction", variant: "destructive" }),
  });

  // ── Follow-up CRUD ─────────────────────────────────────────────────────────

  const addFollowUpMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/organizations/${organizationId}/crm/followups`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/followups`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/stats`] });
      setShowFollowUpDialog(null);
      setShowAddFollowUp(false);
      toast({ title: "Follow-up scheduled" });
    },
    onError: () => toast({ title: "Failed to schedule follow-up", variant: "destructive" }),
  });

  const markFollowUpDoneMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PUT", `/api/organizations/${organizationId}/crm/followups/${id}`, { status: "done" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/followups`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/stats`] });
      toast({ title: "Follow-up marked done" });
    },
    onError: () => toast({ title: "Failed to update follow-up", variant: "destructive" }),
  });

  const deleteFollowUpMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/organizations/${organizationId}/crm/followups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/crm/followups`] });
      toast({ title: "Follow-up deleted" });
    },
  });

  // ── Forms ──────────────────────────────────────────────────────────────────

  const contactForm = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: "", last_name: "", phone: "", email: "",
      source: "", referred_by: "", interest: "", estimated_amount: "", notes: "",
    },
  });

  const editContactForm = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: "", last_name: "", phone: "", email: "",
      source: "", referred_by: "", interest: "", estimated_amount: "", notes: "",
    },
  });

  const interactionForm = useForm({
    resolver: zodResolver(interactionSchema),
    defaultValues: { interaction_type: "", interaction_date: "", notes: "", outcome: "" },
  });

  const followUpForm = useForm({
    resolver: zodResolver(followupSchema),
    defaultValues: { contact_id: "", description: "", due_date: "", assigned_to_id: "" },
  });

  // ── Open edit dialog ───────────────────────────────────────────────────────

  function openEdit(contact: any) {
    setEditContact(contact);
    editContactForm.reset({
      first_name: contact.first_name,
      last_name: contact.last_name,
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      source: contact.source ?? "",
      referred_by: contact.referred_by ?? "",
      interest: contact.interest ?? "",
      estimated_amount: contact.estimated_amount ? String(contact.estimated_amount) : "",
      notes: contact.notes ?? "",
    });
  }

  function openLogInteraction(contact: any) {
    setShowInteractionDialog(contact);
    interactionForm.reset({ interaction_type: "", interaction_date: "", notes: "", outcome: "" });
  }

  function openFollowUp(contact: any) {
    setShowFollowUpDialog(contact);
    followUpForm.reset({
      contact_id: contact.id,
      description: "",
      due_date: "",
      assigned_to_id: "",
    });
  }

  function openAddFollowUp() {
    setShowAddFollowUp(true);
    followUpForm.reset({ contact_id: "", description: "", due_date: "", assigned_to_id: "" });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = statsQuery.data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-muted-foreground text-sm">Manage prospects and convert them to members</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Total Contacts" value={stats?.total_contacts ?? 0} icon={Users} color="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" />
            <StatCard label="Qualified" value={stats?.by_status?.qualified ?? 0} icon={UserCheck} color="bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300" />
            <StatCard label="Converted" value={stats?.by_status?.converted ?? 0} icon={CheckCircle2} color="bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300" />
            <StatCard label="Overdue Follow-ups" value={stats?.overdue_followups ?? 0} icon={AlertCircle} color="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300" />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
          <TabsTrigger value="interactions" data-testid="tab-interactions">Interactions</TabsTrigger>
          <TabsTrigger value="followups" data-testid="tab-followups">Follow-ups</TabsTrigger>
        </TabsList>

        {/* ── Contacts tab ──────────────────────────────────────────────────── */}
        <TabsContent value="contacts" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-crm-search"
                placeholder="Search contacts..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-crm-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Button data-testid="button-add-contact" onClick={() => { setShowAddContact(true); contactForm.reset(); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Contact
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {contactsQuery.isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Follow-ups</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(contactsQuery.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                          No contacts yet. Add your first prospect to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (contactsQuery.data ?? []).map((c: any) => (
                        <TableRow key={c.id} data-testid={`row-contact-${c.id}`}>
                          <TableCell className="font-medium">{c.full_name}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {c.phone && <div className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" /> {c.phone}</div>}
                              {c.email && <div className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-3 w-3" /> {c.email}</div>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm capitalize">{c.source?.replace("_", " ") ?? "—"}</TableCell>
                          <TableCell className="text-sm capitalize">{c.interest?.replace(/_/g, " ") ?? "—"}</TableCell>
                          <TableCell><StatusBadge status={c.status} /></TableCell>
                          <TableCell>
                            {c.followup_count > 0 ? (
                              <span className="flex items-center gap-1 text-sm text-yellow-600">
                                <Clock className="h-3 w-3" /> {c.followup_count}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-contact-menu-${c.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(c)}>
                                  <Edit className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openLogInteraction(c)}>
                                  <PhoneCall className="h-4 w-4 mr-2" /> Log Interaction
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openFollowUp(c)}>
                                  <Calendar className="h-4 w-4 mr-2" /> Schedule Follow-up
                                </DropdownMenuItem>
                                {c.status !== "converted" && (
                                  <DropdownMenuItem onClick={() => setShowConvertDialog(c)}>
                                    <UserCheck className="h-4 w-4 mr-2" /> Mark as Converted
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    if (confirm(`Delete ${c.full_name}?`)) deleteContactMutation.mutate(c.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Interactions tab ───────────────────────────────────────────────── */}
        <TabsContent value="interactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interaction History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {interactionsQuery.isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(interactionsQuery.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                          No interactions logged yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (interactionsQuery.data ?? []).map((i: any) => (
                        <TableRow key={i.id} data-testid={`row-interaction-${i.id}`}>
                          <TableCell className="font-medium">{i.contact_name ?? "—"}</TableCell>
                          <TableCell>
                            <span className="capitalize">{i.interaction_type?.replace("_", " ")}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {i.interaction_date ? new Date(i.interaction_date).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell>
                            {i.outcome ? <StatusBadge status={i.outcome} /> : "—"}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm">{i.notes}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Follow-ups tab ─────────────────────────────────────────────────── */}
        <TabsContent value="followups" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button data-testid="button-add-followup" onClick={openAddFollowUp}>
              <Plus className="h-4 w-4 mr-1" /> Schedule Follow-up
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {followupsQuery.isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(followupsQuery.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          No follow-ups scheduled.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (followupsQuery.data ?? []).map((f: any) => (
                        <TableRow key={f.id} data-testid={`row-followup-${f.id}`}>
                          <TableCell className="font-medium">
                            <div>{f.contact_name}</div>
                            {f.contact_phone && <div className="text-xs text-muted-foreground">{f.contact_phone}</div>}
                          </TableCell>
                          <TableCell className="text-sm">{f.description}</TableCell>
                          <TableCell className="text-sm">
                            {f.due_date ? new Date(f.due_date).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{f.assigned_to_name ?? "—"}</TableCell>
                          <TableCell><StatusBadge status={f.status} /></TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-followup-menu-${f.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {f.status !== "done" && (
                                  <DropdownMenuItem onClick={() => markFollowUpDoneMutation.mutate(f.id)}>
                                    <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Done
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    if (confirm("Delete this follow-up?")) deleteFollowUpMutation.mutate(f.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add Contact Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit((d) => addContactMutation.mutate({
              ...d,
              estimated_amount: d.estimated_amount ? parseFloat(d.estimated_amount) : undefined,
            }))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={contactForm.control} name="first_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-contact-first-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={contactForm.control} name="last_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-contact-last-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={contactForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} data-testid="input-contact-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={contactForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} data-testid="input-contact-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={contactForm.control} name="source" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-contact-source">
                          <SelectValue placeholder="How did they hear about you?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="walk_in">Walk-in</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={contactForm.control} name="interest" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-contact-interest">
                          <SelectValue placeholder="What are they interested in?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="personal_loan">Personal Loan</SelectItem>
                        <SelectItem value="group_loan">Group Loan</SelectItem>
                        <SelectItem value="chama_membership">Chama Membership</SelectItem>
                        <SelectItem value="sacco_membership">SACCO Membership</SelectItem>
                        <SelectItem value="savings">Savings Account</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={contactForm.control} name="referred_by" render={({ field }) => (
                <FormItem>
                  <FormLabel>Referred By (if applicable)</FormLabel>
                  <FormControl><Input {...field} data-testid="input-contact-referred-by" placeholder="Name of referrer" /></FormControl>
                </FormItem>
              )} />
              <FormField control={contactForm.control} name="estimated_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Amount</FormLabel>
                  <FormControl><Input type="number" {...field} data-testid="input-contact-amount" placeholder="e.g. 50000" /></FormControl>
                </FormItem>
              )} />
              <FormField control={contactForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea {...field} data-testid="textarea-contact-notes" rows={3} /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddContact(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-contact" disabled={addContactMutation.isPending}>
                  {addContactMutation.isPending ? "Adding..." : "Add Contact"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Contact Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!editContact} onOpenChange={(o) => !o && setEditContact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <Form {...editContactForm}>
            <form onSubmit={editContactForm.handleSubmit((d) => updateContactMutation.mutate({
              id: editContact?.id,
              data: { ...d, estimated_amount: d.estimated_amount ? parseFloat(d.estimated_amount) : undefined },
            }))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editContactForm.control} name="first_name" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editContactForm.control} name="last_name" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editContactForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={editContactForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editContactForm.control} name="source" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="walk_in">Walk-in</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={editContactForm.control} name="interest" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Interest" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="personal_loan">Personal Loan</SelectItem>
                        <SelectItem value="group_loan">Group Loan</SelectItem>
                        <SelectItem value="chama_membership">Chama Membership</SelectItem>
                        <SelectItem value="sacco_membership">SACCO Membership</SelectItem>
                        <SelectItem value="savings">Savings Account</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={editContactForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditContact(null)}>Cancel</Button>
                <Button type="submit" disabled={updateContactMutation.isPending}>
                  {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Log Interaction Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!showInteractionDialog} onOpenChange={(o) => !o && setShowInteractionDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Interaction — {showInteractionDialog?.full_name}</DialogTitle>
          </DialogHeader>
          <Form {...interactionForm}>
            <form onSubmit={interactionForm.handleSubmit((d) => addInteractionMutation.mutate({
              contactId: showInteractionDialog?.id,
              data: d,
            }))} className="space-y-3">
              <FormField control={interactionForm.control} name="interaction_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-interaction-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="call">Phone Call</SelectItem>
                      <SelectItem value="visit">In-person Visit</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={interactionForm.control} name="interaction_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} data-testid="input-interaction-date" />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={interactionForm.control} name="outcome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Outcome</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-interaction-outcome"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="follow_up_needed">Follow-up Needed</SelectItem>
                      <SelectItem value="not_interested">Not Interested</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={interactionForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} data-testid="textarea-interaction-notes" rows={3} placeholder="What was discussed?" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowInteractionDialog(null)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-interaction" disabled={addInteractionMutation.isPending}>
                  {addInteractionMutation.isPending ? "Logging..." : "Log Interaction"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Follow-up Dialog (from contact or standalone) ──────────────────── */}
      <Dialog
        open={!!showFollowUpDialog || showAddFollowUp}
        onOpenChange={(o) => {
          if (!o) { setShowFollowUpDialog(null); setShowAddFollowUp(false); }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {showFollowUpDialog ? `Schedule Follow-up — ${showFollowUpDialog.full_name}` : "Schedule Follow-up"}
            </DialogTitle>
          </DialogHeader>
          <Form {...followUpForm}>
            <form onSubmit={followUpForm.handleSubmit((d) => addFollowUpMutation.mutate(d))} className="space-y-3">
              {showAddFollowUp && !showFollowUpDialog && (
                <FormField control={followUpForm.control} name="contact_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-followup-contact"><SelectValue placeholder="Select contact" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(contactsQuery.data ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={followUpForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} data-testid="textarea-followup-description" rows={2} placeholder="What needs to be done?" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={followUpForm.control} name="due_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} data-testid="input-followup-due-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowFollowUpDialog(null); setShowAddFollowUp(false); }}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-followup" disabled={addFollowUpMutation.isPending}>
                  {addFollowUpMutation.isPending ? "Scheduling..." : "Schedule"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Convert to Member confirmation ─────────────────────────────────── */}
      <Dialog open={!!showConvertDialog} onOpenChange={(o) => !o && setShowConvertDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convert to Member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Mark <strong>{showConvertDialog?.full_name}</strong> as converted? You can then create them as a member
            using their details.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(null)}>Cancel</Button>
            <Button
              data-testid="button-confirm-convert"
              disabled={convertMutation.isPending}
              onClick={() => convertMutation.mutate(showConvertDialog?.id)}
            >
              {convertMutation.isPending ? "Converting..." : "Mark Converted"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
