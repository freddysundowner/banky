import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CreditCard, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import type { LoanProduct } from "@shared/tenant-types";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";

interface LoanProductsProps {
  organizationId: string;
}

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  interest_rate: z.string().min(1, "Interest rate is required"),
  interest_rate_period: z.enum(["monthly", "annual", "weekly"]).default("monthly"),
  interest_type: z.enum(["flat", "reducing_balance"]).default("reducing_balance"),
  repayment_frequency: z.enum(["daily", "weekly", "bi_weekly", "monthly"]).default("monthly"),
  min_amount: z.string().min(1, "Minimum amount is required"),
  max_amount: z.string().min(1, "Maximum amount is required"),
  min_term_months: z.coerce.number().min(1, "Minimum term is required"),
  max_term_months: z.coerce.number().min(1, "Maximum term is required"),
  processing_fee: z.string().default("0"),
  insurance_fee: z.string().default("0"),
  appraisal_fee: z.string().default("0"),
  excise_duty_rate: z.string().default("20"),
  credit_life_insurance_rate: z.string().default("0"),
  credit_life_insurance_freq: z.enum(["annual", "per_period"]).default("annual"),
  late_payment_penalty: z.string().default("0"),
  grace_period_days: z.coerce.number().default(0),
  requires_guarantor: z.boolean().default(false),
  min_guarantors: z.coerce.number().default(0),
  max_guarantors: z.coerce.number().default(3),
  shares_multiplier: z.string().default("0"),
  min_shares_required: z.string().default("0"),
  deduct_interest_upfront: z.boolean().default(false),
  allow_multiple_loans: z.boolean().default(true),
  require_good_standing: z.boolean().default(false),
  requires_collateral: z.boolean().default(false),
  min_ltv_coverage: z.coerce.number().min(0).max(500).default(0),
  is_active: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productSchema>;

type ViewMode = "list" | "new" | "edit";

const repaymentFrequencies = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
];

const formatPercent = (value: string | number | undefined): string => {
  if (!value) return "0%";
  const num = typeof value === "string" ? parseFloat(value) : value;
  const formatted = num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted}%`;
};

export default function LoanProducts({ organizationId }: LoanProductsProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
  const [deleting, setDeleting] = useState<LoanProduct | null>(null);
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.LOAN_PRODUCTS);

  const { data: products, isLoading } = useQuery<LoanProduct[]>({
    queryKey: ["/api/organizations", organizationId, "loan-products"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/loan-products`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch loan products");
      return res.json();
    },
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      interest_rate: "",
      interest_rate_period: "monthly",
      interest_type: "reducing_balance",
      repayment_frequency: "monthly",
      min_amount: "",
      max_amount: "",
      min_term_months: 1,
      max_term_months: 12,
      processing_fee: "0",
      insurance_fee: "0",
      appraisal_fee: "0",
      excise_duty_rate: "20",
      credit_life_insurance_rate: "0",
      credit_life_insurance_freq: "annual",
      late_payment_penalty: "0",
      grace_period_days: 0,
      requires_guarantor: false,
      min_guarantors: 0,
      max_guarantors: 3,
      shares_multiplier: "0",
      min_shares_required: "0",
      deduct_interest_upfront: false,
      allow_multiple_loans: true,
      require_good_standing: false,
      requires_collateral: false,
      min_ltv_coverage: 0,
      is_active: true,
    },
  });

  const termPeriodLabel = "months";

  const getProductTermLabel = (_product: any) => {
    return "months";
  };

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/loan-products`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-products"] });
      setViewMode("list");
      form.reset();
      toast({ title: "Loan product created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create loan product", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (!editingProduct) return;
      return apiRequest("PATCH", `/api/organizations/${organizationId}/loan-products/${editingProduct.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-products"] });
      setViewMode("list");
      setEditingProduct(null);
      form.reset();
      toast({ title: "Loan product updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update loan product", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return;
      const res = await fetch(`/api/organizations/${organizationId}/loan-products/${deleting.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete loan product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "loan-products"] });
      setDeleting(null);
      toast({ title: "Loan product deleted successfully" });
    },
    onError: (error: Error) => {
      setDeleting(null);
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const openNewForm = () => {
    form.reset();
    setEditingProduct(null);
    setViewMode("new");
  };

  const openEditForm = (product: LoanProduct) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description || "",
      interest_rate: String(parseFloat(product.interest_rate) || 0),
      interest_rate_period: ((product as any).interest_rate_period || "monthly") as any,
      interest_type: product.interest_type as any,
      repayment_frequency: (product as any).repayment_frequency || "monthly",
      min_amount: product.min_amount,
      max_amount: product.max_amount,
      min_term_months: product.min_term_months,
      max_term_months: product.max_term_months,
      processing_fee: String(parseFloat((product as any).processing_fee) || 0),
      insurance_fee: String(parseFloat((product as any).insurance_fee) || 0),
      appraisal_fee: String(parseFloat((product as any).appraisal_fee) || 0),
      excise_duty_rate: String(parseFloat((product as any).excise_duty_rate) ?? 20),
      credit_life_insurance_rate: String(parseFloat((product as any).credit_life_insurance_rate) || 0),
      credit_life_insurance_freq: (product as any).credit_life_insurance_freq || "annual",
      late_payment_penalty: String(parseFloat((product as any).late_payment_penalty) || 0),
      grace_period_days: (product as any).grace_period_days || 0,
      requires_guarantor: product.requires_guarantor,
      min_guarantors: (product as any).min_guarantors || 0,
      max_guarantors: (product as any).max_guarantors || 3,
      shares_multiplier: String(parseFloat((product as any).shares_multiplier) ?? 0),
      min_shares_required: String(parseFloat((product as any).min_shares_required) ?? 0),
      deduct_interest_upfront: (product as any).deduct_interest_upfront || false,
      allow_multiple_loans: (product as any).allow_multiple_loans !== false,
      require_good_standing: (product as any).require_good_standing || false,
      requires_collateral: (product as any).requires_collateral || false,
      min_ltv_coverage: parseFloat((product as any).min_ltv_coverage) || 0,
      is_active: product.is_active,
    });
    setViewMode("edit");
  };

  const handleSubmit = (data: ProductFormData) => {
    if (viewMode === "edit") {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const goBack = () => {
    setViewMode("list");
    setEditingProduct(null);
    form.reset();
  };

  if (viewMode === "new" || viewMode === "edit") {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="icon" onClick={goBack} data-testid="button-back-products">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">
              {viewMode === "edit" ? "Edit Loan Product" : "New Loan Product"}
            </h1>
            <p className="text-muted-foreground">
              {viewMode === "edit" 
                ? `Editing: ${editingProduct?.name}`
                : "Configure a new loan product for your organization"
              }
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Business Loan" data-testid="input-product-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea {...field} placeholder="Describe this loan product..." data-testid="input-product-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="is_active" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>Product is available for new loan applications</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-product-active" />
                    </FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interest & Repayment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField control={form.control} name="interest_rate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Rate (%)</FormLabel>
                      <FormControl><Input {...field} type="number" step="0.01" placeholder="12.5" data-testid="input-product-interest" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="interest_rate_period" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Period</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product-rate-period"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Per Month</SelectItem>
                          <SelectItem value="annual">Per Year</SelectItem>
                          <SelectItem value="weekly">Per Week</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="interest_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product-interest-type"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                          <SelectItem value="flat">Flat Rate</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="repayment_frequency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repayment Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product-frequency"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {repaymentFrequencies.map((freq) => (
                            <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="grace_period_days" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grace Period (days)</FormLabel>
                      <FormControl><Input {...field} type="number" placeholder="0" data-testid="input-product-grace-period" /></FormControl>
                      <FormDescription>Days before late penalty applies</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="deduct_interest_upfront" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Deduct Interest Upfront</FormLabel>
                      <FormDescription>Deduct total interest from principal before disbursement</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-product-deduct-interest" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="allow_multiple_loans" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Allow Multiple Loans</FormLabel>
                      <FormDescription>Allow a member to have more than one active loan of this product type</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-product-allow-multiple" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="require_good_standing" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Require Good Standing</FormLabel>
                      <FormDescription>Member must have no overdue payments on any existing loans to apply</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-product-require-good-standing" />
                    </FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Loan Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="min_amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Amount</FormLabel>
                      <FormControl><Input {...field} type="number" placeholder="10000" data-testid="input-product-min-amount" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="max_amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Amount</FormLabel>
                      <FormControl><Input {...field} type="number" placeholder="1000000" data-testid="input-product-max-amount" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="min_term_months" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Term ({termPeriodLabel})</FormLabel>
                      <FormControl><Input {...field} type="number" data-testid="input-product-min-term" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="max_term_months" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Term ({termPeriodLabel})</FormLabel>
                      <FormControl><Input {...field} type="number" data-testid="input-product-max-term" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fees & Charges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField control={form.control} name="processing_fee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Processing Fee (%)</FormLabel>
                      <FormControl><Input {...field} type="number" step="0.01" placeholder="0" data-testid="input-product-processing-fee" /></FormControl>
                      <FormDescription>One-time fee at disbursement</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="insurance_fee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurance Fee (%)</FormLabel>
                      <FormControl><Input {...field} type="number" step="0.01" placeholder="0" data-testid="input-product-insurance-fee" /></FormControl>
                      <FormDescription>One-time fee at disbursement</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="appraisal_fee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Appraisal Fee (%)</FormLabel>
                      <FormControl><Input {...field} type="number" step="0.01" placeholder="0" /></FormControl>
                      <FormDescription>One-time valuation fee</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField control={form.control} name="excise_duty_rate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Excise Duty (%)</FormLabel>
                      <FormControl><Input {...field} type="number" step="0.01" placeholder="20" /></FormControl>
                      <FormDescription>Tax on fees (Kenya: 20%)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="credit_life_insurance_rate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Life Insurance (%)</FormLabel>
                      <FormControl><Input {...field} type="number" step="0.01" placeholder="0" /></FormControl>
                      <FormDescription>Recurring on reducing balance</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="credit_life_insurance_freq" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CLI Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="annual">Annual Rate</SelectItem>
                          <SelectItem value="per_period">Per Period Rate</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>How the rate is applied</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField control={form.control} name="late_payment_penalty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Late Payment Penalty (%)</FormLabel>
                      <FormControl><Input {...field} type="number" step="0.01" placeholder="0" data-testid="input-product-late-penalty" /></FormControl>
                      <FormDescription>Applied to overdue payments</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Guarantor Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="requires_guarantor" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Requires Guarantor</FormLabel>
                      <FormDescription>Loan applications must have guarantors</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-product-guarantor" />
                    </FormControl>
                  </FormItem>
                )} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="min_guarantors" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Guarantors</FormLabel>
                      <FormControl><Input {...field} type="number" min="0" data-testid="input-product-min-guarantors" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="max_guarantors" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Guarantors</FormLabel>
                      <FormControl><Input {...field} type="number" min="0" data-testid="input-product-max-guarantors" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Collateral Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="requires_collateral" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Requires Collateral</FormLabel>
                      <FormDescription>Loan cannot be approved or disbursed without registered collateral</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-product-requires-collateral" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="min_ltv_coverage" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum LTV Coverage (%)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="5" min="0" max="200" placeholder="0" data-testid="input-product-min-ltv-coverage" />
                    </FormControl>
                    <FormDescription>
                      Minimum collateral coverage required as a % of the loan amount, based on each collateral type's LTV ratio. E.g., 100 means collateral LTV value must equal or exceed the loan amount. Set to 0 to only require presence of collateral without a value threshold.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shares-Based Eligibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Standard SACCO practice: Members can borrow a multiple of their share capital (e.g., 3x shares = can borrow up to 3 times their shares balance).
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="shares_multiplier" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shares Multiplier</FormLabel>
                      <FormControl><Input {...field} type="number" step="0.5" min="0" placeholder="3" data-testid="input-product-shares-multiplier" /></FormControl>
                      <FormDescription>Maximum loan = Shares × Multiplier (0 to disable)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="min_shares_required" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Shares Required</FormLabel>
                      <FormControl><Input {...field} type="number" step="100" min="0" placeholder="0" data-testid="input-product-min-shares" /></FormControl>
                      <FormDescription>Minimum shares balance to qualify (0 = no minimum)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-4 justify-end">
              <Button type="button" variant="outline" onClick={goBack}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-product">
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : viewMode === "edit" ? "Update Product" : "Create Product"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Loan Products</h1>
          <p className="text-muted-foreground">Configure loan products for your organization</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {canWrite && (
            <Button onClick={openNewForm} data-testid="button-add-product" className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : products && products.length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Code</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead className="hidden lg:table-cell">Fees</TableHead>
                    <TableHead className="hidden md:table-cell">Amount Range</TableHead>
                    <TableHead className="hidden lg:table-cell">Term Range</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {product.name}
                          {(product as any).requires_collateral && (
                            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Collateral</Badge>
                          )}
                          {product.requires_guarantor && (
                            <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">Guarantor</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground sm:hidden">{product.code || ""}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{product.code || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {formatPercent(product.interest_rate)} {(product as any).interest_rate_period === "annual" ? "p.a." : (product as any).interest_rate_period === "weekly" ? "p.w." : "p.m."} ({product.interest_type?.replace("_", " ")})
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-xs space-y-0.5">
                          {parseFloat((product as any).processing_fee || 0) > 0 && <div>Proc: {formatPercent((product as any).processing_fee)}</div>}
                          {parseFloat((product as any).insurance_fee || 0) > 0 && <div>Ins: {formatPercent((product as any).insurance_fee)}</div>}
                          {parseFloat((product as any).appraisal_fee || 0) > 0 && <div>Appr: {formatPercent((product as any).appraisal_fee)}</div>}
                          {parseFloat((product as any).credit_life_insurance_rate || 0) > 0 && <div>CLI: {formatPercent((product as any).credit_life_insurance_rate)}/yr</div>}
                          {parseFloat((product as any).late_payment_penalty || 0) > 0 && <div>Late: {formatPercent((product as any).late_payment_penalty)}</div>}
                          {!parseFloat((product as any).processing_fee || 0) && !parseFloat((product as any).insurance_fee || 0) && !parseFloat((product as any).appraisal_fee || 0) && !parseFloat((product as any).credit_life_insurance_rate || 0) && !parseFloat((product as any).late_payment_penalty || 0) && "-"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {parseFloat(product.min_amount).toLocaleString()} - {parseFloat(product.max_amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{product.min_term_months} - {product.max_term_months} {getProductTermLabel(product)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canWrite && (
                            <Button variant="ghost" size="icon" onClick={() => openEditForm(product)} data-testid={`button-edit-product-${product.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canWrite && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleting(product)} data-testid={`button-delete-product-${product.id}`}>
                              <Trash2 className="h-4 w-4" />
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
              <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No Loan Products</h3>
              <p className="text-muted-foreground mb-4">Create loan products to start processing loans</p>
              {canWrite && (
                <Button onClick={openNewForm} data-testid="button-add-product-empty">
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Product
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Loan Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleting?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-product">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
