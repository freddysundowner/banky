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
import { Receipt, Plus, Check, X, Clock, Building2, FolderOpen, Pencil, Trash2, RefreshCw, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useCurrency } from "@/hooks/use-currency";

interface ExpensesManagementProps {
  organizationId: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
}

interface Expense {
  id: string;
  expense_number: string;
  category_id: string;
  branch_id?: string;
  amount: number;
  expense_date: string;
  description: string;
  vendor?: string;
  receipt_number?: string;
  payment_method?: string;
  payment_reference?: string;
  status: string;
  created_by_id: string;
  approved_by_id?: string;
  approved_at?: string;
  notes?: string;
  is_recurring?: boolean;
  recurrence_interval?: string;
  next_due_date?: string;
  created_at: string;
  category_name?: string;
  branch_name?: string;
  created_by_name?: string;
  approved_by_name?: string;
}

export default function ExpensesManagement({ organizationId }: ExpensesManagementProps) {
  const { toast } = useAppDialog();
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const { hasPermission } = useResourcePermissions(organizationId, RESOURCES.EXPENSES);
  const canRead = hasPermission("expenses:read");
  const canWrite = hasPermission("expenses:write");
  const canApprove = hasPermission("expenses:approve");
  
  const [activeTab, setActiveTab] = useState("expenses");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [viewMode, setViewMode] = useState<"list" | "expense_form" | "category_form">("list");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  
  const [expenseForm, setExpenseForm] = useState({
    category_id: "",
    branch_id: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    description: "",
    vendor: "",
    receipt_number: "",
    payment_method: "",
    payment_reference: "",
    notes: "",
    is_recurring: false,
    recurrence_interval: "",
    next_due_date: "",
  });
  
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    is_active: true,
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

  const { data: categories, isLoading: loadingCategories } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/organizations", organizationId, "expenses", "categories"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/expenses/categories`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: paginatedData, isLoading: loadingExpenses } = useQuery<{
    items: Expense[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    total_amount: number;
    pending_count: number;
    approved_total: number;
  }>({
    queryKey: ["/api/organizations", organizationId, "expenses", statusFilter, branchFilter, startDate, endDate, currentPage, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(currentPage), page_size: String(pageSize) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (branchFilter !== "all") params.set("branch_id", branchFilter);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const res = await fetch(`/api/organizations/${organizationId}/expenses?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
  });

  const expenses = paginatedData?.items;

  const createExpense = useMutation({
    mutationFn: async () => {
      const payload = {
        ...expenseForm,
        amount: parseFloat(expenseForm.amount) || 0,
        branch_id: expenseForm.branch_id || null,
        vendor: expenseForm.vendor || null,
        receipt_number: expenseForm.receipt_number || null,
        payment_method: expenseForm.payment_method || null,
        payment_reference: expenseForm.payment_reference || null,
        notes: expenseForm.notes || null,
        recurrence_interval: expenseForm.recurrence_interval || null,
        next_due_date: expenseForm.next_due_date || null,
      };
      await apiRequest("POST", `/api/organizations/${organizationId}/expenses`, payload);
    },
    onSuccess: () => {
      setCurrentPage(1);
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "expenses"] });
      setViewMode("list");
      resetExpenseForm();
      toast({ title: "Success", description: "Expense created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create expense", variant: "destructive" });
    },
  });

  const updateExpense = useMutation({
    mutationFn: async () => {
      const payload = {
        ...expenseForm,
        amount: parseFloat(expenseForm.amount) || 0,
        branch_id: expenseForm.branch_id || null,
        vendor: expenseForm.vendor || null,
        receipt_number: expenseForm.receipt_number || null,
        payment_method: expenseForm.payment_method || null,
        payment_reference: expenseForm.payment_reference || null,
        notes: expenseForm.notes || null,
        recurrence_interval: expenseForm.recurrence_interval || null,
        next_due_date: expenseForm.next_due_date || null,
      };
      await apiRequest("PUT", `/api/organizations/${organizationId}/expenses/${editingExpense?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "expenses"] });
      setViewMode("list");
      setEditingExpense(null);
      resetExpenseForm();
      toast({ title: "Success", description: "Expense updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update expense", variant: "destructive" });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/organizations/${organizationId}/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "expenses"] });
      toast({ title: "Success", description: "Expense deleted" });
    },
  });

  const approveExpense = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/organizations/${organizationId}/expenses/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "expenses"] });
      toast({ title: "Success", description: "Expense approved" });
    },
  });

  const rejectExpense = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/organizations/${organizationId}/expenses/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "expenses"] });
      toast({ title: "Success", description: "Expense rejected" });
    },
  });

  const createCategory = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/organizations/${organizationId}/expenses/categories`, categoryForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "expenses", "categories"] });
      setViewMode("list");
      resetCategoryForm();
      toast({ title: "Success", description: "Category created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create category", variant: "destructive" });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/organizations/${organizationId}/expenses/categories/${editingCategory?.id}`, categoryForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "expenses", "categories"] });
      setViewMode("list");
      setEditingCategory(null);
      resetCategoryForm();
      toast({ title: "Success", description: "Category updated" });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/organizations/${organizationId}/expenses/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "expenses", "categories"] });
      toast({ title: "Success", description: "Category deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Cannot delete category with expenses", variant: "destructive" });
    },
  });

  const resetExpenseForm = () => {
    setExpenseForm({
      category_id: "",
      branch_id: "",
      amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      description: "",
      vendor: "",
      receipt_number: "",
      payment_method: "",
      payment_reference: "",
      notes: "",
      is_recurring: false,
      recurrence_interval: "",
      next_due_date: "",
    });
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: "", description: "", is_active: true });
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      category_id: expense.category_id,
      branch_id: expense.branch_id || "",
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      description: expense.description,
      vendor: expense.vendor || "",
      receipt_number: expense.receipt_number || "",
      payment_method: expense.payment_method || "",
      payment_reference: expense.payment_reference || "",
      notes: expense.notes || "",
      is_recurring: expense.is_recurring || false,
      recurrence_interval: expense.recurrence_interval || "",
      next_due_date: expense.next_due_date || "",
    });
    setViewMode("expense_form");
  };

  const openEditCategory = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      is_active: category.is_active,
    });
    setViewMode("category_form");
  };

  const expensesList = expenses || [];

  const totalExpenses = paginatedData?.total_amount ?? 0;
  const pendingCount = paginatedData?.pending_count ?? 0;
  const approvedTotal = paginatedData?.approved_total ?? 0;

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
          You don't have permission to view expenses.
        </CardContent>
      </Card>
    );
  }

  if (viewMode === "expense_form") {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setViewMode("list"); setEditingExpense(null); resetExpenseForm(); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{editingExpense ? "Edit Expense" : "Add Expense"}</h1>
            <p className="text-muted-foreground">
              {editingExpense ? `Editing: ${editingExpense.expense_number}` : "Enter expense details"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Expense Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={expenseForm.category_id} onValueChange={(v) => setExpenseForm({ ...expenseForm, category_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.filter(c => c.is_active).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={expenseForm.branch_id || "none"} onValueChange={(v) => setExpenseForm({ ...expenseForm, branch_id: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No branch</SelectItem>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{`Amount (${currency}) *`}</Label>
                <Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="What was this expense for?" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} placeholder="Vendor name" />
              </div>
              <div className="space-y-2">
                <Label>Receipt Number</Label>
                <Input value={expenseForm.receipt_number} onChange={(e) => setExpenseForm({ ...expenseForm, receipt_number: e.target.value })} placeholder="Receipt #" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={expenseForm.payment_method} onValueChange={(v) => setExpenseForm({ ...expenseForm, payment_method: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Reference</Label>
                <Input value={expenseForm.payment_reference} onChange={(e) => setExpenseForm({ ...expenseForm, payment_reference: e.target.value })} placeholder="Transaction ID" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder="Additional notes..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recurring Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Recurring Expense
                </Label>
                <p className="text-sm text-muted-foreground">Set this expense to repeat automatically</p>
              </div>
              <Switch 
                checked={expenseForm.is_recurring} 
                onCheckedChange={(checked) => setExpenseForm({ ...expenseForm, is_recurring: checked })} 
              />
            </div>
            {expenseForm.is_recurring && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Interval *</Label>
                  <Select value={expenseForm.recurrence_interval} onValueChange={(v) => setExpenseForm({ ...expenseForm, recurrence_interval: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Next Due Date *</Label>
                  <Input 
                    type="date" 
                    value={expenseForm.next_due_date} 
                    onChange={(e) => setExpenseForm({ ...expenseForm, next_due_date: e.target.value })} 
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => { setViewMode("list"); setEditingExpense(null); resetExpenseForm(); }}>Cancel</Button>
          <Button 
            onClick={() => editingExpense ? updateExpense.mutate() : createExpense.mutate()} 
            disabled={createExpense.isPending || updateExpense.isPending || !expenseForm.category_id || !expenseForm.amount || !expenseForm.description}
          >
            {editingExpense ? "Update" : "Create"} Expense
          </Button>
        </div>
      </div>
    );
  }

  if (viewMode === "category_form") {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setViewMode("list"); setEditingCategory(null); resetCategoryForm(); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{editingCategory ? "Edit Category" : "Add Category"}</h1>
            <p className="text-muted-foreground">
              {editingCategory ? `Editing: ${editingCategory.name}` : "Define an expense category"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Category Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="e.g., Office Supplies" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} placeholder="Category description..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => { setViewMode("list"); setEditingCategory(null); resetCategoryForm(); }}>Cancel</Button>
          <Button 
            onClick={() => editingCategory ? updateCategory.mutate() : createCategory.mutate()} 
            disabled={createCategory.isPending || updateCategory.isPending || !categoryForm.name}
          >
            {editingCategory ? "Update" : "Create"} Category
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses Management</h1>
          <p className="text-muted-foreground">Track and manage organizational expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {branches && branches.length > 1 && (
            <Select value={branchFilter} onValueChange={(v) => { setBranchFilter(v); setCurrentPage(1); }}>
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
            <Button onClick={() => { resetExpenseForm(); setEditingExpense(null); setViewMode("expense_form"); }} className="gap-2">
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{symbol} {totalExpenses.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{symbol} {approvedTotal.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="expenses" className="gap-2">
            <Receipt className="h-4 w-4" /> Expenses
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <FolderOpen className="h-4 w-4" /> Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Expense Records</CardTitle>
                    <CardDescription>
                      {paginatedData ? `${paginatedData.total} expenses found` : "View and manage expense entries"}
                    </CardDescription>
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
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
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">From</span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">To</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                      className="w-[160px]"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setCurrentPage(1); }}>
                      Clear dates
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingExpenses ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : expensesList.length > 0 ? (
                <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Expense #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesList.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {expense.expense_number}
                              {expense.is_recurring && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <RefreshCw className="h-3 w-3" />
                                  {expense.recurrence_interval}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(expense.expense_date).toLocaleDateString()}</TableCell>
                          <TableCell>{expense.category_name}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                          <TableCell className="text-right font-medium">{symbol} {expense.amount.toLocaleString()}</TableCell>
                          <TableCell>{getStatusBadge(expense.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {expense.status === "pending" && canApprove && (
                                <>
                                  <Button size="sm" variant="ghost" className="text-green-600 h-8 w-8 p-0" onClick={() => approveExpense.mutate(expense.id)}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-red-600 h-8 w-8 p-0" onClick={() => rejectExpense.mutate(expense.id)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {expense.status === "pending" && canWrite && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditExpense(expense)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-red-600 h-8 w-8 p-0" onClick={() => deleteExpense.mutate(expense.id)}>
                                    <Trash2 className="h-4 w-4" />
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
                {paginatedData && paginatedData.total_pages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, paginatedData.total)} of {paginatedData.total}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <div className="text-sm px-3">
                        Page {currentPage} of {paginatedData.total_pages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage >= paginatedData.total_pages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No Expenses</h3>
                  <p className="text-muted-foreground mt-1">Create your first expense to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Expense Categories</CardTitle>
                  <CardDescription>Organize expenses by category</CardDescription>
                </div>
                {canWrite && (
                  <Button size="sm" onClick={() => { resetCategoryForm(); setEditingCategory(null); setViewMode("category_form"); }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Category
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingCategories ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : categories && categories.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{category.description || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={category.is_active ? "default" : "secondary"}>
                              {category.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {canWrite && (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditCategory(category)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-600 h-8 w-8 p-0" onClick={() => deleteCategory.mutate(category.id)}>
                                  <Trash2 className="h-4 w-4" />
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
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No Categories</h3>
                  <p className="text-muted-foreground mt-1">Create expense categories to organize your expenses</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
