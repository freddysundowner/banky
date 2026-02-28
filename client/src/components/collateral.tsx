import { useState, useEffect, useRef } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Shield, Plus, Search, MoreHorizontal, AlertTriangle, CheckCircle2,
  Clock, FileText, Trash2, Edit, TrendingUp, Lock, Unlock, DollarSign,
  ShieldAlert, ShieldCheck, Settings, X,
} from "lucide-react";

interface CollateralProps {
  organizationId: string;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  loan_id: z.string().min(1, "Loan ID required"),
  collateral_type_id: z.string().min(1, "Type required"),
  owner_name: z.string().min(1, "Owner name required"),
  owner_id_number: z.string().optional(),
  description: z.string().min(1, "Description required"),
  document_ref: z.string().optional(),
  declared_value: z.string().optional(),
});

const valuationSchema = z.object({
  appraised_value: z.string().min(1, "Appraised value required"),
  valuer_name: z.string().min(1, "Valuer name required"),
  valuation_date: z.string().optional(),
  next_revaluation_date: z.string().optional(),
  ltv_override: z.string().optional(),
});

const releaseSchema = z.object({
  release_notes: z.string().optional(),
});

const liquidationSchema = z.object({
  liquidation_amount: z.string().min(1, "Amount required"),
  liquidation_notes: z.string().optional(),
});

const insuranceSchema = z.object({
  policy_number: z.string().min(1, "Policy number required"),
  insurer_name: z.string().min(1, "Insurer required"),
  policy_type: z.string().optional(),
  sum_insured: z.string().optional(),
  premium_amount: z.string().optional(),
  premium_frequency: z.string().optional(),
  start_date: z.string().min(1, "Start date required"),
  expiry_date: z.string().min(1, "Expiry date required"),
  notes: z.string().optional(),
});

const typeSchema = z.object({
  name: z.string().min(1, "Name required"),
  ltv_percent: z.string().min(1, "LTV % required"),
  revaluation_months: z.string().optional(),
  requires_insurance: z.boolean().optional(),
  description: z.string().optional(),
});

// ── Status colors & helpers ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  registered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  under_lien: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  released: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  defaulted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  liquidated: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expiring_soon: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  lapsed: "bg-gray-100 text-gray-700",
  cancelled: "bg-gray-100 text-gray-700",
  overdue: "bg-red-100 text-red-800",
  due_soon: "bg-orange-100 text-orange-800",
  ok: "bg-green-100 text-green-800",
};

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>
      {label}
    </span>
  );
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CollateralManagement({ organizationId }: CollateralProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("register");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [showAddItem, setShowAddItem] = useState(false);
  const [loanSearch, setLoanSearch] = useState("");
  const [loanSearchDebounced, setLoanSearchDebounced] = useState("");
  const [loanDropdownOpen, setLoanDropdownOpen] = useState(false);
  const [selectedLoanLabel, setSelectedLoanLabel] = useState("");
  const loanSearchRef = useRef<HTMLDivElement>(null);
  const [showValuate, setShowValuate] = useState<any>(null);
  const [showRelease, setShowRelease] = useState<any>(null);
  const [showLiquidate, setShowLiquidate] = useState<any>(null);
  const [showAddInsurance, setShowAddInsurance] = useState<any>(null);
  const [showItemDetail, setShowItemDetail] = useState<any>(null);
  const [showAddType, setShowAddType] = useState(false);
  const [editType, setEditType] = useState<any>(null);

  // ── Queries ───────────────────────────────────────────────────────────────

  const statsQuery = useQuery<any>({
    queryKey: [`/api/organizations/${organizationId}/collateral/stats`],
  });

  const itemsQuery = useQuery<any[]>({
    queryKey: [`/api/organizations/${organizationId}/collateral/items`, search, statusFilter, typeFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (statusFilter) p.set("status", statusFilter);
      if (typeFilter) p.set("collateral_type_id", typeFilter);
      return fetch(`/api/organizations/${organizationId}/collateral/items?${p}`, { credentials: "include" })
        .then(async r => {
          if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || r.statusText);
          return r.json();
        });
    },
    enabled: activeTab === "register",
  });

  const insuranceQuery = useQuery<any[]>({
    queryKey: [`/api/organizations/${organizationId}/collateral/insurance`],
    enabled: activeTab === "insurance",
  });

  const alertsQuery = useQuery<any>({
    queryKey: [`/api/organizations/${organizationId}/collateral/alerts`],
    enabled: activeTab === "alerts",
  });

  const typesQuery = useQuery<any[]>({
    queryKey: [`/api/organizations/${organizationId}/collateral/types`],
  });

  const itemDetailQuery = useQuery<any>({
    queryKey: [`/api/organizations/${organizationId}/collateral/items`, showItemDetail?.id],
    queryFn: () => fetch(`/api/organizations/${organizationId}/collateral/items/${showItemDetail?.id}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!showItemDetail?.id,
  });

  useEffect(() => {
    const t = setTimeout(() => setLoanSearchDebounced(loanSearch), 300);
    return () => clearTimeout(t);
  }, [loanSearch]);

  const loanSearchQuery = useQuery<any[]>({
    queryKey: [`/api/organizations/${organizationId}/loans`, "collateral-picker", loanSearchDebounced],
    queryFn: () =>
      fetch(`/api/organizations/${organizationId}/loans?search=${encodeURIComponent(loanSearchDebounced)}&statuses=pending,under_review,approved,disbursed,defaulted,restructured&page_size=20`, { credentials: "include" })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) return d;
          if (Array.isArray(d?.items)) return d.items;
          return [];
        }),
    enabled: showAddItem && loanSearchDebounced.length >= 1,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (loanSearchRef.current && !loanSearchRef.current.contains(e.target as Node)) {
        setLoanDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Forms ─────────────────────────────────────────────────────────────────

  const itemForm = useForm({ resolver: zodResolver(itemSchema), defaultValues: { loan_id: "", collateral_type_id: "", owner_name: "", owner_id_number: "", description: "", document_ref: "", declared_value: "" } });
  const valuationForm = useForm({ resolver: zodResolver(valuationSchema), defaultValues: { appraised_value: "", valuer_name: "", valuation_date: "", next_revaluation_date: "", ltv_override: "" } });
  const releaseForm = useForm({ resolver: zodResolver(releaseSchema), defaultValues: { release_notes: "" } });
  const liquidationForm = useForm({ resolver: zodResolver(liquidationSchema), defaultValues: { liquidation_amount: "", liquidation_notes: "" } });
  const insuranceForm = useForm({ resolver: zodResolver(insuranceSchema), defaultValues: { policy_number: "", insurer_name: "", policy_type: "", sum_insured: "", premium_amount: "", premium_frequency: "", start_date: "", expiry_date: "", notes: "" } });
  const typeForm = useForm({ resolver: zodResolver(typeSchema), defaultValues: { name: "", ltv_percent: "", revaluation_months: "24", requires_insurance: false, description: "" } });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addItemMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/organizations/${organizationId}/collateral/items`, { ...data, declared_value: data.declared_value ? parseFloat(data.declared_value) : undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/items`] }); queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/stats`] }); setShowAddItem(false); itemForm.reset(); toast({ title: "Collateral item registered" }); },
    onError: (e: any) => toast({ title: "Failed to register collateral", description: e.message, variant: "destructive" }),
  });

  const valuateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("POST", `/api/organizations/${organizationId}/collateral/items/${id}/valuate`, { ...data, appraised_value: parseFloat(data.appraised_value), ltv_override: data.ltv_override ? parseFloat(data.ltv_override) : undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/items`] }); setShowValuate(null); toast({ title: "Valuation recorded" }); },
    onError: (e: any) => toast({ title: "Failed to record valuation", description: e.message, variant: "destructive" }),
  });

  const lienMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/organizations/${organizationId}/collateral/items/${id}/lien`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/items`] }); queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/stats`] }); toast({ title: "Lien placed — item is now locked" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const releaseMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("POST", `/api/organizations/${organizationId}/collateral/items/${id}/release`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/items`] }); queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/stats`] }); setShowRelease(null); toast({ title: "Collateral released" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const liquidateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("POST", `/api/organizations/${organizationId}/collateral/items/${id}/liquidate`, { ...data, liquidation_amount: parseFloat(data.liquidation_amount) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/items`] }); queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/stats`] }); setShowLiquidate(null); toast({ title: "Collateral marked as liquidated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/organizations/${organizationId}/collateral/items/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/items`] }); queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/stats`] }); toast({ title: "Collateral item deleted" }); },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const addInsuranceMutation = useMutation({
    mutationFn: ({ itemId, data }: any) => apiRequest("POST", `/api/organizations/${organizationId}/collateral/items/${itemId}/insurance`, { ...data, sum_insured: data.sum_insured ? parseFloat(data.sum_insured) : undefined, premium_amount: data.premium_amount ? parseFloat(data.premium_amount) : undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/items`] }); queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/insurance`] }); setShowAddInsurance(null); toast({ title: "Insurance policy added" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteInsuranceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/organizations/${organizationId}/collateral/insurance/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/insurance`] }); queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/items`] }); toast({ title: "Insurance policy deleted" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const addTypeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/organizations/${organizationId}/collateral/types`, { ...data, ltv_percent: parseFloat(data.ltv_percent), revaluation_months: parseInt(data.revaluation_months || "24") }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/types`] }); setShowAddType(false); typeForm.reset(); toast({ title: "Collateral type added" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PUT", `/api/organizations/${organizationId}/collateral/types/${id}`, { ...data, ltv_percent: parseFloat(data.ltv_percent), revaluation_months: parseInt(data.revaluation_months || "24") }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/types`] }); setEditType(null); toast({ title: "Collateral type updated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/organizations/${organizationId}/collateral/types/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/collateral/types`] }); toast({ title: "Type deleted" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const stats = statsQuery.data;
  const types = typesQuery.data ?? [];
  const alerts = alertsQuery.data;
  const alertCount = alerts ? (alerts.summary?.overdue_revaluation_count + alerts.summary?.expired_insurance_count) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Collateral & Insurance</h1>
          <p className="text-muted-foreground text-sm">Manage pledged assets and insurance policies for loans</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsQuery.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : (
          <>
            <StatCard label="Total Items" value={stats?.total_items ?? 0} icon={Shield} color="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" />
            <StatCard label="Under Lien" value={stats?.by_status?.under_lien ?? 0} icon={Lock} color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300" />
            <StatCard label="Overdue Revaluation" value={stats?.overdue_revaluation ?? 0} icon={AlertTriangle} color="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300" />
            <StatCard label="Insurance Expiring (30d)" value={stats?.expiring_insurance ?? 0} icon={ShieldAlert} color="bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300" />
          </>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="register" data-testid="tab-collateral-register">Register</TabsTrigger>
          <TabsTrigger value="insurance" data-testid="tab-collateral-insurance">Insurance</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-collateral-alerts">
            Alerts {alertCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">{alertCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="types" data-testid="tab-collateral-types">Type Settings</TabsTrigger>
        </TabsList>

        {/* ── Register Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="register" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input data-testid="input-collateral-search" placeholder="Search by description, owner, or document ref..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-collateral-status"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="under_lien">Under Lien</SelectItem>
                <SelectItem value="released">Released</SelectItem>
                <SelectItem value="defaulted">Defaulted</SelectItem>
                <SelectItem value="liquidated">Liquidated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44" data-testid="select-collateral-type"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                {types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button data-testid="button-add-collateral" onClick={() => { setShowAddItem(true); itemForm.reset(); }}>
              <Plus className="h-4 w-4 mr-1" /> Register Collateral
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {itemsQuery.isLoading ? (
                <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Loan / Member</TableHead>
                      <TableHead>Appraised Value</TableHead>
                      <TableHead>Lending Limit</TableHead>
                      <TableHead>Revaluation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(itemsQuery.data ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No collateral items found. Register the first pledged asset.</TableCell></TableRow>
                    ) : (itemsQuery.data ?? []).map((item: any) => (
                      <TableRow key={item.id} data-testid={`row-collateral-${item.id}`}>
                        <TableCell>
                          <div className="font-medium text-sm">{item.description}</div>
                          <div className="text-xs text-muted-foreground">{item.owner_name} {item.document_ref && `· ${item.document_ref}`}</div>
                        </TableCell>
                        <TableCell className="text-sm">{item.collateral_type_name}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{item.loan_number}</div>
                          <div className="text-xs text-muted-foreground">{item.member_name}</div>
                        </TableCell>
                        <TableCell className="text-sm">{fmt(item.appraised_value)}</TableCell>
                        <TableCell className="text-sm font-medium text-blue-600">{fmt(item.lending_limit)}</TableCell>
                        <TableCell>
                          {item.revaluation_status ? <StatusBadge status={item.revaluation_status} /> : <span className="text-muted-foreground text-xs">Not set</span>}
                        </TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-collateral-menu-${item.id}`}><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setShowItemDetail(item); }}>
                                <FileText className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setShowValuate(item); valuationForm.reset({ appraised_value: item.appraised_value ? String(item.appraised_value) : "", valuer_name: item.valuer_name ?? "", valuation_date: "", next_revaluation_date: "", ltv_override: item.ltv_override ? String(item.ltv_override) : "" }); }}>
                                <TrendingUp className="h-4 w-4 mr-2" /> Record Valuation
                              </DropdownMenuItem>
                              {item.status === "registered" && (
                                <DropdownMenuItem onClick={() => { if (confirm(`Place a lien on "${item.description}"? This will lock the asset until explicitly released.`)) lienMutation.mutate(item.id); }}>
                                  <Lock className="h-4 w-4 mr-2" /> Place Lien
                                </DropdownMenuItem>
                              )}
                              {item.status === "under_lien" && (
                                <DropdownMenuItem onClick={() => { setShowRelease(item); releaseForm.reset(); }}>
                                  <Unlock className="h-4 w-4 mr-2" /> Release
                                </DropdownMenuItem>
                              )}
                              {(item.status === "under_lien" || item.status === "defaulted") && (
                                <DropdownMenuItem onClick={() => { setShowLiquidate(item); liquidationForm.reset(); }}>
                                  <DollarSign className="h-4 w-4 mr-2" /> Liquidate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => { setShowAddInsurance(item); insuranceForm.reset(); }}>
                                <ShieldCheck className="h-4 w-4 mr-2" /> Add Insurance
                              </DropdownMenuItem>
                              {item.status !== "under_lien" && (
                                <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm(`Delete collateral: ${item.description}?`)) deleteItemMutation.mutate(item.id); }}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Insurance Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="insurance" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">All Insurance Policies</CardTitle></CardHeader>
            <CardContent className="p-0">
              {insuranceQuery.isLoading ? (
                <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy No.</TableHead>
                      <TableHead>Insurer</TableHead>
                      <TableHead>Collateral / Loan</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sum Insured</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(insuranceQuery.data ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No insurance policies yet. Add policies from the Register tab using the Actions menu.</TableCell></TableRow>
                    ) : (insuranceQuery.data ?? []).map((p: any) => (
                      <TableRow key={p.id} data-testid={`row-insurance-${p.id}`}>
                        <TableCell className="font-medium text-sm">{p.policy_number}</TableCell>
                        <TableCell className="text-sm">{p.insurer_name}</TableCell>
                        <TableCell>
                          <div className="text-sm">{p.collateral_description}</div>
                          <div className="text-xs text-muted-foreground">{p.loan_number} · {p.member_name}</div>
                        </TableCell>
                        <TableCell className="text-sm capitalize">{p.policy_type?.replace(/_/g, " ") ?? "—"}</TableCell>
                        <TableCell className="text-sm">{fmt(p.sum_insured)}</TableCell>
                        <TableCell className="text-sm">{p.expiry_date}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Delete this insurance policy?")) deleteInsuranceMutation.mutate(p.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Alerts Tab ───────────────────────────────────────────────────────── */}
        <TabsContent value="alerts" className="space-y-4 mt-4">
          {alertsQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
            <>
              {alerts?.summary?.overdue_revaluation_count > 0 && (
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader className="pb-2"><CardTitle className="text-base text-red-600 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Overdue Revaluation ({alerts.summary.overdue_revaluation_count})</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead>Member</TableHead><TableHead>Appraised Value</TableHead><TableHead>Last Revaluation</TableHead><TableHead>Was Due</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {alerts.overdue_revaluation.map((item: any) => (
                          <TableRow key={item.id}><TableCell className="font-medium text-sm">{item.description}</TableCell><TableCell className="text-sm">{item.collateral_type_name}</TableCell><TableCell className="text-sm">{item.member_name}</TableCell><TableCell className="text-sm">{fmt(item.appraised_value)}</TableCell><TableCell className="text-sm">{item.valuation_date ?? "Never"}</TableCell><TableCell className="text-sm text-red-600">{item.next_revaluation_date}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              {alerts?.summary?.due_soon_revaluation_count > 0 && (
                <Card className="border-orange-200 dark:border-orange-800">
                  <CardHeader className="pb-2"><CardTitle className="text-base text-orange-600 flex items-center gap-2"><Clock className="h-4 w-4" /> Revaluation Due Soon ({alerts.summary.due_soon_revaluation_count})</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead>Member</TableHead><TableHead>Due Date</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {alerts.due_soon_revaluation.map((item: any) => (
                          <TableRow key={item.id}><TableCell className="font-medium text-sm">{item.description}</TableCell><TableCell className="text-sm">{item.collateral_type_name}</TableCell><TableCell className="text-sm">{item.member_name}</TableCell><TableCell className="text-sm text-orange-600">{item.next_revaluation_date}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              {alerts?.summary?.expiring_insurance_count > 0 && (
                <Card className="border-orange-200 dark:border-orange-800">
                  <CardHeader className="pb-2"><CardTitle className="text-base text-orange-600 flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Insurance Expiring in 30 Days ({alerts.summary.expiring_insurance_count})</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Policy No.</TableHead><TableHead>Insurer</TableHead><TableHead>Collateral / Member</TableHead><TableHead>Expiry</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {alerts.expiring_insurance.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium text-sm">{p.policy_number}</TableCell>
                            <TableCell className="text-sm">{p.insurer_name}</TableCell>
                            <TableCell><div className="text-sm">{p.collateral_description ?? "—"}</div><div className="text-xs text-muted-foreground">{p.member_name ?? ""} {p.loan_number ? `· ${p.loan_number}` : ""}</div></TableCell>
                            <TableCell className="text-sm text-orange-600">{p.expiry_date}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              {alerts?.summary?.expired_insurance_count > 0 && (
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader className="pb-2"><CardTitle className="text-base text-red-600 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Expired Insurance ({alerts.summary.expired_insurance_count})</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Policy No.</TableHead><TableHead>Insurer</TableHead><TableHead>Collateral / Member</TableHead><TableHead>Expired On</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {alerts.expired_insurance.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium text-sm">{p.policy_number}</TableCell>
                            <TableCell className="text-sm">{p.insurer_name}</TableCell>
                            <TableCell><div className="text-sm">{p.collateral_description ?? "—"}</div><div className="text-xs text-muted-foreground">{p.member_name ?? ""} {p.loan_number ? `· ${p.loan_number}` : ""}</div></TableCell>
                            <TableCell className="text-sm text-red-600">{p.expiry_date}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              {!alerts || (alertCount === 0 && alerts.summary?.due_soon_revaluation_count === 0 && alerts.summary?.expiring_insurance_count === 0) && (
                <Card>
                  <CardContent className="py-16 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="text-lg font-medium">All clear</p>
                    <p className="text-muted-foreground text-sm">No overdue revaluations or expiring insurance policies.</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Types Tab ────────────────────────────────────────────────────────── */}
        <TabsContent value="types" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button data-testid="button-add-type" onClick={() => { setShowAddType(true); typeForm.reset(); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Type
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type Name</TableHead>
                    <TableHead>LTV %</TableHead>
                    <TableHead>Revaluation Period</TableHead>
                    <TableHead>Requires Insurance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typesQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)
                  ) : types.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No collateral types configured.</TableCell></TableRow>
                  ) : types.map((t: any) => (
                    <TableRow key={t.id} data-testid={`row-type-${t.id}`}>
                      <TableCell>
                        <div className="font-medium text-sm">{t.name}</div>
                        {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                      </TableCell>
                      <TableCell className="font-semibold text-blue-600">{t.ltv_percent}%</TableCell>
                      <TableCell className="text-sm">{t.revaluation_months ? `Every ${t.revaluation_months} months` : "No revaluation"}</TableCell>
                      <TableCell>{t.requires_insurance ? <span className="text-green-600 text-sm font-medium">Yes</span> : <span className="text-muted-foreground text-sm">No</span>}</TableCell>
                      <TableCell><StatusBadge status={t.is_active ? "active" : "lapsed"} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" data-testid={`button-type-menu-${t.id}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditType(t); typeForm.reset({ name: t.name, ltv_percent: String(t.ltv_percent), revaluation_months: String(t.revaluation_months ?? 24), requires_insurance: t.requires_insurance, description: t.description ?? "" }); }}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            {!t.is_system && (
                              <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm(`Delete type: ${t.name}?`)) deleteTypeMutation.mutate(t.id); }}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add Collateral Item Dialog ────────────────────────────────────────── */}
      <Dialog open={showAddItem} onOpenChange={(o) => { setShowAddItem(o); if (!o) { setLoanSearch(""); setSelectedLoanLabel(""); setLoanDropdownOpen(false); itemForm.reset(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Register Collateral Item</DialogTitle></DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(d => addItemMutation.mutate(d))} className="space-y-3">
              <FormField control={itemForm.control} name="loan_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Loan</FormLabel>
                  <div ref={loanSearchRef} className="relative">
                    <Input
                      data-testid="input-collateral-loan-search"
                      placeholder="Search by member name or loan number..."
                      value={selectedLoanLabel || loanSearch}
                      onChange={e => {
                        setLoanSearch(e.target.value);
                        if (selectedLoanLabel) {
                          setSelectedLoanLabel("");
                          field.onChange("");
                          itemForm.setValue("owner_name", "");
                          itemForm.setValue("owner_id_number", "");
                        }
                        setLoanDropdownOpen(true);
                      }}
                      onFocus={() => { if (!selectedLoanLabel) setLoanDropdownOpen(true); }}
                      className={selectedLoanLabel ? "bg-muted text-foreground font-medium" : ""}
                    />
                    {selectedLoanLabel && (
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                        onClick={() => { setSelectedLoanLabel(""); setLoanSearch(""); field.onChange(""); setLoanDropdownOpen(false); itemForm.setValue("owner_name", ""); itemForm.setValue("owner_id_number", ""); }}
                        data-testid="button-clear-loan">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {loanDropdownOpen && loanSearch.length >= 1 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-52 overflow-y-auto">
                        {loanSearchQuery.isLoading && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
                        )}
                        {!loanSearchQuery.isLoading && (Array.isArray(loanSearchQuery.data) ? loanSearchQuery.data : []).length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No active loans found</div>
                        )}
                        {(Array.isArray(loanSearchQuery.data) ? loanSearchQuery.data : []).map((loan: any) => (
                          <button
                            key={loan.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex flex-col"
                            onMouseDown={() => {
                              field.onChange(loan.id);
                              setSelectedLoanLabel(`${loan.application_number} — ${loan.member_name}`);
                              setLoanSearch("");
                              setLoanDropdownOpen(false);
                              if (loan.member_name) itemForm.setValue("owner_name", loan.member_name);
                              if (loan.member_id_number) itemForm.setValue("owner_id_number", loan.member_id_number);
                            }}
                          >
                            <span className="font-medium">{loan.application_number}</span>
                            <span className="text-muted-foreground text-xs">{loan.member_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={itemForm.control} name="collateral_type_id" render={({ field }) => (
                <FormItem><FormLabel>Collateral Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-collateral-type-id"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>{types.filter(t => t.is_active).map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.ltv_percent}% LTV)</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={itemForm.control} name="owner_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-collateral-owner" placeholder="Auto-filled from loan" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={itemForm.control} name="owner_id_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner ID No.</FormLabel>
                    <FormControl><Input {...field} data-testid="input-collateral-owner-id" placeholder="Auto-filled from loan" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={itemForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} data-testid="textarea-collateral-description" rows={2} placeholder="e.g. Toyota Vitz KBZ 001A, 2018" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={itemForm.control} name="document_ref" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ownership Document No.</FormLabel>
                    <FormControl><Input {...field} data-testid="input-collateral-doc-ref" placeholder="e.g. logbook no., title deed no." /></FormControl>
                    <p className="text-xs text-muted-foreground">The serial/ref no. on the ownership document</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={itemForm.control} name="declared_value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner's Declared Value (KES)</FormLabel>
                    <FormControl><Input type="number" {...field} data-testid="input-collateral-declared-value" placeholder="0" /></FormControl>
                    <p className="text-xs text-muted-foreground">Owner's estimate before formal appraisal</p>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-collateral" disabled={addItemMutation.isPending}>{addItemMutation.isPending ? "Registering..." : "Register"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Valuation Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!showValuate} onOpenChange={o => !o && setShowValuate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Valuation — {showValuate?.description}</DialogTitle></DialogHeader>
          <Form {...valuationForm}>
            <form onSubmit={valuationForm.handleSubmit(d => valuateMutation.mutate({ id: showValuate?.id, data: d }))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={valuationForm.control} name="appraised_value" render={({ field }) => (
                  <FormItem><FormLabel>Appraised Value (KES)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-appraised-value" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={valuationForm.control} name="ltv_override" render={({ field }) => (
                  <FormItem><FormLabel>LTV Override % (optional)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-ltv-override" placeholder={`Default: type setting`} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={valuationForm.control} name="valuer_name" render={({ field }) => (
                <FormItem><FormLabel>Valuer Name / Firm</FormLabel><FormControl><Input {...field} data-testid="input-valuer-name" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={valuationForm.control} name="valuation_date" render={({ field }) => (
                  <FormItem><FormLabel>Valuation Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-valuation-date" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={valuationForm.control} name="next_revaluation_date" render={({ field }) => (
                  <FormItem><FormLabel>Next Revaluation Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-next-revaluation-date" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowValuate(null)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-valuation" disabled={valuateMutation.isPending}>{valuateMutation.isPending ? "Saving..." : "Save Valuation"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Release Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!showRelease} onOpenChange={o => !o && setShowRelease(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Release Collateral</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Release <strong>{showRelease?.description}</strong> from lien? The owner will get their asset back.</p>
          <Form {...releaseForm}>
            <form onSubmit={releaseForm.handleSubmit(d => releaseMutation.mutate({ id: showRelease?.id, data: d }))} className="space-y-3">
              <FormField control={releaseForm.control} name="release_notes" render={({ field }) => (
                <FormItem><FormLabel>Release Notes (optional)</FormLabel><FormControl><Textarea {...field} data-testid="textarea-release-notes" rows={2} placeholder="e.g. Loan fully repaid on 28 Feb 2026" /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowRelease(null)}>Cancel</Button>
                <Button type="submit" data-testid="button-confirm-release" disabled={releaseMutation.isPending}>{releaseMutation.isPending ? "Releasing..." : "Release"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Liquidation Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!showLiquidate} onOpenChange={o => !o && setShowLiquidate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Liquidation</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Record the proceeds from selling <strong>{showLiquidate?.description}</strong>.</p>
          <Form {...liquidationForm}>
            <form onSubmit={liquidationForm.handleSubmit(d => liquidateMutation.mutate({ id: showLiquidate?.id, data: d }))} className="space-y-3">
              <FormField control={liquidationForm.control} name="liquidation_amount" render={({ field }) => (
                <FormItem><FormLabel>Proceeds (KES)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-liquidation-amount" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={liquidationForm.control} name="liquidation_notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} data-testid="textarea-liquidation-notes" rows={2} placeholder="Auctioneer, date, buyer details..." /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowLiquidate(null)}>Cancel</Button>
                <Button type="submit" variant="destructive" data-testid="button-confirm-liquidate" disabled={liquidateMutation.isPending}>{liquidateMutation.isPending ? "Saving..." : "Record Liquidation"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Add Insurance Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!showAddInsurance} onOpenChange={o => !o && setShowAddInsurance(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Insurance — {showAddInsurance?.description}</DialogTitle></DialogHeader>
          <Form {...insuranceForm}>
            <form onSubmit={insuranceForm.handleSubmit(d => addInsuranceMutation.mutate({ itemId: showAddInsurance?.id, data: d }))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={insuranceForm.control} name="policy_number" render={({ field }) => (
                  <FormItem><FormLabel>Policy Number</FormLabel><FormControl><Input {...field} data-testid="input-policy-number" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={insuranceForm.control} name="insurer_name" render={({ field }) => (
                  <FormItem><FormLabel>Insurer</FormLabel><FormControl><Input {...field} data-testid="input-insurer-name" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={insuranceForm.control} name="policy_type" render={({ field }) => (
                  <FormItem><FormLabel>Policy Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-policy-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="comprehensive">Comprehensive</SelectItem>
                        <SelectItem value="third_party">Third Party</SelectItem>
                        <SelectItem value="fire">Fire & Perils</SelectItem>
                        <SelectItem value="property">Property</SelectItem>
                        <SelectItem value="life">Life</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={insuranceForm.control} name="sum_insured" render={({ field }) => (
                  <FormItem><FormLabel>Sum Insured (KES)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-sum-insured" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={insuranceForm.control} name="premium_amount" render={({ field }) => (
                  <FormItem><FormLabel>Premium (KES)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-premium-amount" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={insuranceForm.control} name="premium_frequency" render={({ field }) => (
                  <FormItem><FormLabel>Premium Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-premium-frequency"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={insuranceForm.control} name="start_date" render={({ field }) => (
                  <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-insurance-start-date" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={insuranceForm.control} name="expiry_date" render={({ field }) => (
                  <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-insurance-expiry-date" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={insuranceForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes (optional)</FormLabel><FormControl><Textarea {...field} rows={2} data-testid="textarea-insurance-notes" /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddInsurance(null)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-insurance" disabled={addInsuranceMutation.isPending}>{addInsuranceMutation.isPending ? "Adding..." : "Add Policy"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Item Detail Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!showItemDetail} onOpenChange={o => !o && setShowItemDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Collateral Details</DialogTitle></DialogHeader>
          {itemDetailQuery.isLoading ? <Skeleton className="h-48 w-full" /> : itemDetailQuery.data ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div><span className="text-muted-foreground">Description:</span><div className="font-medium">{itemDetailQuery.data.description}</div></div>
                <div><span className="text-muted-foreground">Type:</span><div className="font-medium">{itemDetailQuery.data.collateral_type_name}</div></div>
                <div><span className="text-muted-foreground">Owner:</span><div className="font-medium">{itemDetailQuery.data.owner_name}</div></div>
                <div><span className="text-muted-foreground">Doc Ref:</span><div className="font-medium">{itemDetailQuery.data.document_ref ?? "—"}</div></div>
                <div><span className="text-muted-foreground">Declared Value:</span><div className="font-medium">{fmt(itemDetailQuery.data.declared_value)}</div></div>
                <div><span className="text-muted-foreground">Appraised Value:</span><div className="font-medium">{fmt(itemDetailQuery.data.appraised_value)}</div></div>
                <div><span className="text-muted-foreground">LTV %:</span><div className="font-medium">{itemDetailQuery.data.ltv_percent}%</div></div>
                <div><span className="text-muted-foreground">Lending Limit:</span><div className="font-medium text-blue-600">{fmt(itemDetailQuery.data.lending_limit)}</div></div>
                <div><span className="text-muted-foreground">Valuer:</span><div className="font-medium">{itemDetailQuery.data.valuer_name ?? "Not valuated"}</div></div>
                <div><span className="text-muted-foreground">Status:</span><div><StatusBadge status={itemDetailQuery.data.status} /></div></div>
              </div>
              {itemDetailQuery.data.insurance_policies?.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Insurance Policies</p>
                  <div className="space-y-1">
                    {itemDetailQuery.data.insurance_policies.map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center rounded-lg border px-3 py-2">
                        <div><div className="font-medium">{p.policy_number}</div><div className="text-xs text-muted-foreground">{p.insurer_name} · Expires {p.expiry_date}</div></div>
                        <StatusBadge status={p.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter><Button variant="outline" onClick={() => setShowItemDetail(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Type Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showAddType || !!editType} onOpenChange={o => { if (!o) { setShowAddType(false); setEditType(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editType ? "Edit Collateral Type" : "Add Collateral Type"}</DialogTitle></DialogHeader>
          <Form {...typeForm}>
            <form onSubmit={typeForm.handleSubmit(d => {
              if (editType) {
                const data = editType.is_system
                  ? (({ name, description, ...rest }) => rest)(d)
                  : d;
                updateTypeMutation.mutate({ id: editType.id, data });
              } else {
                addTypeMutation.mutate(d);
              }
            })} className="space-y-3">
              {editType?.is_system && (
                <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">
                  System type — name and description cannot be changed.
                </p>
              )}
              <FormField control={typeForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Type Name</FormLabel><FormControl><Input {...field} data-testid="input-type-name" placeholder="e.g. Motor Vehicle Logbook" disabled={!!editType?.is_system} className={editType?.is_system ? "opacity-50 cursor-not-allowed" : ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={typeForm.control} name="ltv_percent" render={({ field }) => (
                  <FormItem><FormLabel>LTV %</FormLabel><FormControl><Input type="number" {...field} data-testid="input-type-ltv" placeholder="70" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={typeForm.control} name="revaluation_months" render={({ field }) => (
                  <FormItem><FormLabel>Revalue Every (months)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-type-revaluation" placeholder="24" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={typeForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description (optional)</FormLabel><FormControl><Input {...field} data-testid="input-type-description" disabled={!!editType?.is_system} className={editType?.is_system ? "opacity-50 cursor-not-allowed" : ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={typeForm.control} name="requires_insurance" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-sm font-medium">Requires Insurance</FormLabel>
                    <p className="text-xs text-muted-foreground mt-0.5">Collateral items of this type must have an active insurance policy</p>
                  </div>
                  <FormControl>
                    <Switch
                      data-testid="switch-type-requires-insurance"
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowAddType(false); setEditType(null); }}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-type" disabled={addTypeMutation.isPending || updateTypeMutation.isPending}>{addTypeMutation.isPending || updateTypeMutation.isPending ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
