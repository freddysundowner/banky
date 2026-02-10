import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useCurrency } from "@/hooks/use-currency";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  PiggyBank, 
  Plus, 
  Pencil,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Wallet,
  ArrowLeft
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FixedDepositsProps {
  organizationId: string;
}

interface FixedDepositProduct {
  id: string;
  name: string;
  code: string;
  description: string | null;
  term_months: number;
  interest_rate: number;
  min_amount: number;
  max_amount: number | null;
  early_withdrawal_penalty: number;
  is_active: boolean;
  created_at: string;
}

interface MemberFixedDeposit {
  id: string;
  deposit_number: string;
  member_id: string;
  product_id: string;
  principal_amount: number;
  interest_rate: number;
  term_months: number;
  start_date: string;
  maturity_date: string;
  expected_interest: number;
  maturity_amount: number;
  actual_interest_paid: number | null;
  actual_amount_paid: number | null;
  status: string;
  closed_date: string | null;
  early_withdrawal: boolean;
  penalty_amount: number;
  auto_rollover: boolean;
  rollover_count: number;
  parent_deposit_id: string | null;
  notes: string | null;
  created_at: string;
  member_name: string | null;
  member_number: string | null;
  product_name: string | null;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  member_number: string;
  phone?: string;
  id_number?: string;
  savings_balance?: number;
}

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").max(20),
  description: z.string().optional(),
  term_months: z.coerce.number().min(1, "Term must be at least 1 month"),
  interest_rate: z.coerce.number().min(0, "Rate cannot be negative").max(100),
  min_amount: z.coerce.number().min(0),
  max_amount: z.coerce.number().nullable().optional(),
  early_withdrawal_penalty: z.coerce.number().min(0).max(100).default(0),
});

const depositSchema = z.object({
  member_id: z.string().min(1, "Select a member"),
  product_id: z.string().min(1, "Select a product"),
  principal_amount: z.coerce.number().min(1, "Amount is required"),
  notes: z.string().optional(),
  auto_rollover: z.boolean().default(false),
});

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
    case "matured":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Matured</Badge>;
    case "closed":
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Closed</Badge>;
    case "withdrawn":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Withdrawn Early</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function FixedDeposits({ organizationId }: FixedDepositsProps) {
  const { toast } = useToast();
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.FIXED_DEPOSITS);
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const [activeTab, setActiveTab] = useState("deposits");
  const [productViewMode, setProductViewMode] = useState<"list" | "product_form">("list");
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FixedDepositProduct | null>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<MemberFixedDeposit | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const { data: products = [], isLoading: productsLoading } = useQuery<FixedDepositProduct[]>({
    queryKey: [`/api/organizations/${organizationId}/fixed-deposit-products`],
    enabled: !!organizationId,
  });

  const { data: deposits = [], isLoading: depositsLoading } = useQuery<MemberFixedDeposit[]>({
    queryKey: [`/api/organizations/${organizationId}/fixed-deposits`, statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all" 
        ? `/api/organizations/${organizationId}/fixed-deposits`
        : `/api/organizations/${organizationId}/fixed-deposits?status=${statusFilter}`;
      const response = await apiRequest("GET", url);
      return response.json();
    },
    enabled: !!organizationId,
  });

  const { data: maturingDeposits = [] } = useQuery<MemberFixedDeposit[]>({
    queryKey: [`/api/organizations/${organizationId}/fixed-deposits/maturing-soon`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/organizations/${organizationId}/fixed-deposits/maturing-soon`);
      return response.json();
    },
    enabled: !!organizationId,
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: [`/api/organizations/${organizationId}/members`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/organizations/${organizationId}/members`);
      return response.json();
    },
    enabled: !!organizationId,
  });

  const productForm = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      term_months: 12,
      interest_rate: 8,
      min_amount: 1000,
      max_amount: null as number | null,
      early_withdrawal_penalty: 25,
    },
  });

  const depositForm = useForm({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      member_id: "",
      product_id: "",
      principal_amount: 0,
      notes: "",
      auto_rollover: false,
    },
  });

  const createProduct = useMutation({
    mutationFn: async (data: z.infer<typeof productSchema>) => {
      const response = await apiRequest("POST", `/api/organizations/${organizationId}/fixed-deposit-products`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Product created successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/fixed-deposit-products`] });
      setProductViewMode("list");
      setEditingProduct(null);
      productForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async (data: z.infer<typeof productSchema>) => {
      const response = await apiRequest("PUT", `/api/organizations/${organizationId}/fixed-deposit-products/${editingProduct?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Product updated successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/fixed-deposit-products`] });
      setProductViewMode("list");
      setEditingProduct(null);
      productForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createDeposit = useMutation({
    mutationFn: async (data: z.infer<typeof depositSchema>) => {
      const response = await apiRequest("POST", `/api/organizations/${organizationId}/fixed-deposits`, {
        ...data,
        funding_source: "savings",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Fixed deposit created successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/fixed-deposits`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/members`] });
      setShowDepositDialog(false);
      setSelectedMember(null);
      setMemberSearch("");
      depositForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const processMatured = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/organizations/${organizationId}/fixed-deposits/process-matured`);
      return response.json();
    },
    onSuccess: (data) => {
      const msg = `Processed: ${data.processed_count} paid out, ${data.rolled_over_count} rolled over`;
      toast({ title: "Maturity processing complete", description: msg });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/fixed-deposits`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/members`] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const closeDeposit = useMutation({
    mutationFn: async ({ depositId, earlyWithdrawal }: { depositId: string; earlyWithdrawal: boolean }) => {
      const response = await apiRequest("POST", `/api/organizations/${organizationId}/fixed-deposits/${depositId}/close`, {
        early_withdrawal: earlyWithdrawal,
      });
      return response.json();
    },
    onSuccess: (data) => {
      const penalty = data.early_withdrawal ? ` (Penalty: ${formatAmount(data.penalty_amount)})` : "";
      toast({ title: "Deposit closed successfully", description: `Amount paid: ${formatAmount(data.actual_amount_paid)}${penalty}` });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/fixed-deposits`] });
      setShowCloseDialog(false);
      setSelectedDeposit(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditProduct = (product: FixedDepositProduct) => {
    setEditingProduct(product);
    productForm.reset({
      name: product.name,
      code: product.code,
      description: product.description || "",
      term_months: product.term_months,
      interest_rate: Number(product.interest_rate),
      min_amount: Number(product.min_amount),
      max_amount: product.max_amount ? Number(product.max_amount) : null,
      early_withdrawal_penalty: Number(product.early_withdrawal_penalty),
    });
    setProductViewMode("product_form");
  };

  const handleCloseDeposit = (deposit: MemberFixedDeposit) => {
    setSelectedDeposit(deposit);
    setShowCloseDialog(true);
  };

  const filteredMembers = members.filter(m => {
    if (memberSearch === "") return true;
    const search = memberSearch.toLowerCase();
    return (
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(search) ||
      m.member_number.toLowerCase().includes(search) ||
      m.phone?.toLowerCase().includes(search) ||
      m.id_number?.toLowerCase().includes(search)
    );
  });

  const selectedProduct = products.find(p => p.id === depositForm.watch("product_id"));

  const activeProducts = products.filter(p => p.is_active);
  const totalActiveDeposits = deposits.filter(d => d.status === "active").reduce((sum, d) => sum + Number(d.principal_amount), 0);
  const totalExpectedInterest = deposits.filter(d => d.status === "active").reduce((sum, d) => sum + Number(d.expected_interest), 0);

  if (productViewMode === "product_form") {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => {
            setProductViewMode("list");
            setEditingProduct(null);
            productForm.reset();
          }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">
              {editingProduct ? "Edit Fixed Deposit Product" : "Create Fixed Deposit Product"}
            </h1>
            <p className="text-muted-foreground">
              {editingProduct
                ? `Editing: ${editingProduct.name}`
                : "Define the terms for a new fixed deposit product"}
            </p>
          </div>
        </div>

        <Form {...productForm}>
          <form onSubmit={productForm.handleSubmit((data) =>
            editingProduct ? updateProduct.mutate(data) : createProduct.mutate(data)
          )} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={productForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 12-Month Fixed Deposit" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={productForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., FD12M" {...field} disabled={!!editingProduct} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={productForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Product description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={productForm.control}
                    name="term_months"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Term (Months)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={productForm.control}
                    name="interest_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual Interest Rate (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Amount Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={productForm.control}
                    name="min_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{`Minimum Amount (${currency})`}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={productForm.control}
                    name="max_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{`Maximum Amount (${currency})`}</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="No limit" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Penalties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={productForm.control}
                  name="early_withdrawal_penalty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Early Withdrawal Penalty (% of interest)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormDescription>Percentage of earned interest forfeited on early withdrawal</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                {editingProduct ? "Update Product" : "Create Product"}
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setProductViewMode("list");
                setEditingProduct(null);
                productForm.reset();
              }}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fixed Deposits</h1>
          <p className="text-muted-foreground">Manage fixed deposit accounts and products</p>
        </div>
        <RefreshButton organizationId={organizationId} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deposits</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deposits.filter(d => d.status === "active").length}</div>
            <p className="text-xs text-muted-foreground">Currently held</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Principal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(totalActiveDeposits)}</div>
            <p className="text-xs text-muted-foreground">In active deposits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expected Interest</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(totalExpectedInterest)}</div>
            <p className="text-xs text-muted-foreground">At maturity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maturing Soon</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{maturingDeposits.length}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>
      </div>

      {maturingDeposits.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {maturingDeposits.length} deposit(s) maturing within the next 30 days. Review them in the deposits tab.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="deposits">Member Deposits</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Deposits</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="matured">Matured</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => processMatured.mutate()}
                disabled={processMatured.isPending}
              >
                <Clock className="h-4 w-4 mr-2" />
                {processMatured.isPending ? "Processing..." : "Process Matured"}
              </Button>
            <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
              <DialogTrigger asChild>
                <Button disabled={activeProducts.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Fixed Deposit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Open Fixed Deposit</DialogTitle>
                  <DialogDescription>Create a new fixed deposit by transferring from member's savings.</DialogDescription>
                </DialogHeader>
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <Wallet className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Transfer from Savings:</strong> The deposit amount will be deducted from the member's savings balance. For cash or M-Pesa deposits, use the Teller Station.
                  </AlertDescription>
                </Alert>
                <Form {...depositForm}>
                  <form onSubmit={depositForm.handleSubmit((data) => createDeposit.mutate(data))} className="space-y-4">
                    {!selectedMember ? (
                      <div className="space-y-2">
                        <FormLabel>Member</FormLabel>
                        <Input 
                          placeholder="Search by name, member number, ID or phone..." 
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                        />
                        {memberSearch && filteredMembers.length > 0 && (
                          <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                            {filteredMembers.slice(0, 10).map((member) => (
                              <button
                                key={member.id}
                                type="button"
                                className="w-full p-3 text-left hover:bg-muted transition-colors"
                                onClick={() => {
                                  setSelectedMember(member);
                                  depositForm.setValue("member_id", member.id);
                                  setMemberSearch("");
                                }}
                              >
                                <div className="font-medium">{member.first_name} {member.last_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {member.member_number} {member.phone && `• ${member.phone}`}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {memberSearch && filteredMembers.length === 0 && (
                          <div className="p-3 text-sm text-muted-foreground text-center border rounded-md">
                            No members found
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 border rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                              {selectedMember.first_name[0]}{selectedMember.last_name[0]}
                            </div>
                            <div>
                              <div className="font-semibold">{selectedMember.first_name} {selectedMember.last_name}</div>
                              <div className="text-sm text-muted-foreground">{selectedMember.member_number}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Savings Balance</div>
                            <div className="font-semibold">{symbol} {(selectedMember.savings_balance || 0).toLocaleString()}</div>
                          </div>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => {
                            setSelectedMember(null);
                            depositForm.setValue("member_id", "");
                          }}
                        >
                          Change Member
                        </Button>
                      </div>
                    )}
                    <FormField
                      control={depositForm.control}
                      name="product_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {activeProducts.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} ({product.term_months} months @ {product.interest_rate}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedProduct && (
                            <FormDescription>
                              Min: {formatAmount(Number(selectedProduct.min_amount))}
                              {selectedProduct.max_amount && ` | Max: ${formatAmount(Number(selectedProduct.max_amount))}`}
                              {` | Early withdrawal penalty: ${selectedProduct.early_withdrawal_penalty}%`}
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={depositForm.control}
                      name="principal_amount"
                      render={({ field }) => {
                        const amount = Number(field.value) || 0;
                        const savingsBalance = selectedMember?.savings_balance || 0;
                        const minAmount = selectedProduct ? Number(selectedProduct.min_amount) : 0;
                        const maxAmount = selectedProduct?.max_amount ? Number(selectedProduct.max_amount) : null;
                        
                        const exceedsSavings = amount > savingsBalance;
                        const belowMin = selectedProduct && amount > 0 && amount < minAmount;
                        const exceedsMax = maxAmount && amount > maxAmount;
                        
                        return (
                          <FormItem>
                            <FormLabel>{`Principal Amount (${currency})`}</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            {selectedMember && selectedProduct && (
                              <div className="space-y-1 text-xs">
                                <div className={exceedsSavings ? "text-red-500 font-medium" : "text-muted-foreground"}>
                                  Available savings: {symbol} {savingsBalance.toLocaleString()}
                                  {exceedsSavings && " - Insufficient balance!"}
                                </div>
                                {belowMin && (
                                  <div className="text-red-500 font-medium">
                                    Below minimum: {symbol} {minAmount.toLocaleString()}
                                  </div>
                                )}
                                {exceedsMax && (
                                  <div className="text-red-500 font-medium">
                                    Exceeds maximum: {symbol} {maxAmount.toLocaleString()}
                                  </div>
                                )}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={depositForm.control}
                      name="auto_rollover"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Auto-Rollover on Maturity</FormLabel>
                            <FormDescription>
                              When the deposit matures, automatically open a new deposit with the same principal. Interest will be paid to savings.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={depositForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createDeposit.isPending}>
                        {createDeposit.isPending ? "Creating..." : "Create Deposit"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {depositsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : deposits.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <PiggyBank className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No fixed deposits found</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden sm:table-cell">Deposit #</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="hidden md:table-cell">Product</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Interest Rate</TableHead>
                    <TableHead className="hidden md:table-cell">Maturity Date</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Maturity Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits.map((deposit) => (
                    <TableRow key={deposit.id}>
                      <TableCell className="font-medium hidden sm:table-cell">{deposit.deposit_number}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{deposit.member_name}</div>
                          <div className="text-xs text-muted-foreground">{deposit.member_number}</div>
                          <div className="text-xs text-muted-foreground md:hidden">{deposit.product_name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{deposit.product_name}</TableCell>
                      <TableCell className="text-right">{formatAmount(Number(deposit.principal_amount))}</TableCell>
                      <TableCell className="text-right hidden lg:table-cell">{deposit.interest_rate}%</TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(deposit.maturity_date)}</TableCell>
                      <TableCell className="text-right hidden lg:table-cell">{formatAmount(Number(deposit.maturity_amount))}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(deposit.status)}
                          {deposit.auto_rollover && deposit.status === "active" && (
                            <Badge variant="outline" className="text-xs">Rollover</Badge>
                          )}
                          {deposit.rollover_count > 0 && (
                            <span className="text-xs text-muted-foreground">#{deposit.rollover_count}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {deposit.status === "active" && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleCloseDeposit(deposit)}
                          >
                            Close
                          </Button>
                        )}
                        {deposit.status === "closed" && deposit.early_withdrawal && (
                          <span className="text-xs text-yellow-600">
                            Penalty: {formatAmount(Number(deposit.penalty_amount))}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-end">
            {canWrite && (
              <Button onClick={() => {
                setEditingProduct(null);
                productForm.reset();
                setProductViewMode("product_form");
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            )}
          </div>

          {productsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No fixed deposit products defined yet</p>
                <p className="text-sm text-muted-foreground">Create a product to start accepting fixed deposits</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <Card key={product.id} className={!product.is_active ? "opacity-60" : ""}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription>{product.code}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {product.is_active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-500">Inactive</Badge>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {product.description && (
                      <p className="text-sm text-muted-foreground">{product.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Term:</span>
                        <span className="font-medium ml-2">{product.term_months} months</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rate:</span>
                        <span className="font-medium ml-2">{product.interest_rate}% p.a.</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Min:</span>
                        <span className="font-medium ml-2">{formatAmount(Number(product.min_amount))}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Penalty:</span>
                        <span className="font-medium ml-2">{product.early_withdrawal_penalty}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Fixed Deposit</DialogTitle>
            <DialogDescription>
              Close deposit #{selectedDeposit?.deposit_number} for {selectedDeposit?.member_name}
            </DialogDescription>
          </DialogHeader>
          {selectedDeposit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Principal:</span>
                  <span className="font-medium ml-2">{formatAmount(Number(selectedDeposit.principal_amount))}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Expected Interest:</span>
                  <span className="font-medium ml-2">{formatAmount(Number(selectedDeposit.expected_interest))}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Maturity Date:</span>
                  <span className="font-medium ml-2">{formatDate(selectedDeposit.maturity_date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Maturity Amount:</span>
                  <span className="font-medium ml-2">{formatAmount(Number(selectedDeposit.maturity_amount))}</span>
                </div>
              </div>

              {new Date(selectedDeposit.maturity_date) > new Date() && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This deposit has not matured yet. Closing now will incur an early withdrawal penalty on the interest earned.
                  </AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancel</Button>
                <Button 
                  onClick={() => closeDeposit.mutate({ 
                    depositId: selectedDeposit.id, 
                    earlyWithdrawal: new Date(selectedDeposit.maturity_date) > new Date()
                  })}
                  disabled={closeDeposit.isPending}
                >
                  {closeDeposit.isPending ? "Closing..." : "Close Deposit"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
