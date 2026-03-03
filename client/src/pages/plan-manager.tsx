import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAppDialog } from "@/hooks/use-app-dialog";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, X, RotateCcw } from "lucide-react";

const ALL_FEATURES: { id: string; label: string; group: string }[] = [
  { id: "members", label: "Members & KYC", group: "Core" },
  { id: "savings", label: "Savings Accounts", group: "Core" },
  { id: "loans", label: "Loans", group: "Core" },
  { id: "audit_logs", label: "Audit Logs", group: "Core" },
  { id: "mpesa_integration", label: "M-Pesa Integration", group: "Core" },
  { id: "sms_notifications", label: "SMS Notifications", group: "Core" },
  { id: "core_banking", label: "Core Banking Engine", group: "Core" },
  { id: "shares", label: "Share Capital", group: "Finance" },
  { id: "dividends", label: "Dividends", group: "Finance" },
  { id: "fixed_deposits", label: "Fixed Deposits", group: "Finance" },
  { id: "expenses", label: "Expense Tracking", group: "Finance" },
  { id: "accounting", label: "Accounting (GL)", group: "Finance" },
  { id: "teller_station", label: "Teller Station", group: "Operations" },
  { id: "float_management", label: "Float Management", group: "Operations" },
  { id: "collateral", label: "Collateral & Insurance", group: "Operations" },
  { id: "crm", label: "CRM", group: "Operations" },
  { id: "analytics", label: "Analytics Dashboard", group: "Reporting" },
  { id: "analytics_export", label: "Analytics Export", group: "Reporting" },
  { id: "custom_reports", label: "Custom Reports", group: "Reporting" },
  { id: "bulk_sms", label: "Bulk SMS", group: "Communications" },
  { id: "multiple_branches", label: "Multiple Branches", group: "Scale" },
  { id: "leave_management", label: "Leave Management", group: "HR" },
  { id: "payroll", label: "Payroll", group: "HR" },
  { id: "hr", label: "HR Management", group: "HR" },
];

const FEATURE_GROUPS = ["Core", "Finance", "Operations", "Reporting", "Communications", "Scale", "HR"];

const BUSINESS_TYPE_COLORS: Record<string, string> = {
  chama: "bg-green-100 text-green-800",
  sacco: "bg-blue-100 text-blue-800",
  mfi: "bg-orange-100 text-orange-800",
  bank: "bg-purple-100 text-purple-800",
};

interface AdminPlan {
  id: string;
  name: string;
  plan_type: string;
  business_type?: string;
  pricing_model: string;
  monthly_price: number;
  annual_price: number;
  one_time_price: number;
  max_members?: number;
  max_staff?: number;
  max_branches?: number;
  sort_order: number;
  features: { enabled?: string[]; custom?: string[] };
  is_active: boolean;
}

function PlanFeatureCard({ plan, onSave }: { plan: AdminPlan; onSave: () => void }) {
  const { toast } = useAppDialog();
  const [customInput, setCustomInput] = useState("");
  const enabledFeatures = new Set(plan.features?.enabled || []);
  const customFeatures: string[] = plan.features?.custom || [];

  const toggleMutation = useMutation({
    mutationFn: async (featureId: string) => {
      const res = await fetch(`/api/admin/plans/${plan.id}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toggle_feature: featureId }),
      });
      if (!res.ok) throw new Error("Failed to update feature");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
    },
    onError: () => toast({ title: "Failed to update feature", variant: "destructive" }),
  });

  const addCustomMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await fetch(`/api/admin/plans/${plan.id}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ add_custom: value }),
      });
      if (!res.ok) throw new Error("Failed to add feature");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setCustomInput("");
    },
    onError: () => toast({ title: "Failed to add custom feature", variant: "destructive" }),
  });

  const removeCustomMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await fetch(`/api/admin/plans/${plan.id}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ remove_custom: value }),
      });
      if (!res.ok) throw new Error("Failed to remove feature");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
    },
    onError: () => toast({ title: "Failed to remove custom feature", variant: "destructive" }),
  });

  return (
    <Card data-testid={`card-plan-${plan.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{plan.name}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {plan.pricing_model === "saas"
                ? `KES ${plan.monthly_price?.toLocaleString()}/mo`
                : `KES ${plan.one_time_price?.toLocaleString()} one-time`}
              {plan.max_members ? ` · ${plan.max_members.toLocaleString()} members` : ""}
            </CardDescription>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {plan.business_type && (
              <Badge className={`text-xs ${BUSINESS_TYPE_COLORS[plan.business_type] || "bg-gray-100 text-gray-800"}`}>
                {plan.business_type.toUpperCase()}
              </Badge>
            )}
            <Badge variant={plan.pricing_model === "saas" ? "default" : "secondary"} className="text-xs">
              {plan.pricing_model === "saas" ? "SaaS" : "Licence"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {FEATURE_GROUPS.map((group) => {
          const groupFeatures = ALL_FEATURES.filter(f => f.group === group);
          return (
            <div key={group}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group}</p>
              <div className="space-y-1.5">
                {groupFeatures.map((feature) => (
                  <div key={feature.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                    <span className="text-sm">{feature.label}</span>
                    <Switch
                      checked={enabledFeatures.has(feature.id)}
                      onCheckedChange={() => toggleMutation.mutate(feature.id)}
                      disabled={toggleMutation.isPending}
                      data-testid={`toggle-feature-${plan.id}-${feature.id}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Custom Features</p>
          <div className="space-y-1.5 mb-2">
            {customFeatures.map((cf, i) => (
              <div key={i} className="flex items-center justify-between py-1 px-2 bg-muted/30 rounded">
                <span className="text-sm">{cf}</span>
                <button
                  onClick={() => removeCustomMutation.mutate(cf)}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid={`button-remove-custom-${plan.id}-${i}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Custom integration"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="text-sm"
              data-testid={`input-custom-feature-${plan.id}`}
              onKeyDown={(e) => { if (e.key === "Enter" && customInput.trim()) addCustomMutation.mutate(customInput.trim()); }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => { if (customInput.trim()) addCustomMutation.mutate(customInput.trim()); }}
              disabled={!customInput.trim() || addCustomMutation.isPending}
              data-testid={`button-add-custom-${plan.id}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlanManagerPage() {
  const { toast } = useAppDialog();
  const [activeType, setActiveType] = useState<string>("all");

  const { data: plans, isLoading } = useQuery<AdminPlan[]>({
    queryKey: ["/api/admin/plans"],
    queryFn: async () => {
      const res = await fetch("/api/admin/plans", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch("/api/admin/plans/reset-features", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reset");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Features reset", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
    },
    onError: () => toast({ title: "Failed to reset features", variant: "destructive" }),
  });

  const tabs = [
    { id: "all", label: "All Plans" },
    { id: "chama", label: "Chama" },
    { id: "sacco", label: "SACCO" },
    { id: "mfi", label: "MFI" },
    { id: "bank", label: "Bank" },
    { id: "generic", label: "Generic" },
  ];

  const filteredPlans = (plans || []).filter((p) => {
    if (activeType === "all") return true;
    if (activeType === "generic") return !p.business_type;
    return p.business_type === activeType;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Plan Feature Manager"
          description="Manage which features are included in each subscription plan. Changes take effect immediately."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => resetMutation.mutate("")}
          disabled={resetMutation.isPending}
          data-testid="button-reset-all-features"
        >
          {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
          Reset All to Defaults
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveType(tab.id)}
            data-testid={`tab-plan-type-${tab.id}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeType === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
            {tab.id !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({(plans || []).filter(p => tab.id === "generic" ? !p.business_type : p.business_type === tab.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredPlans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No plans found for this filter.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {filteredPlans.map((plan) => (
            <PlanFeatureCard key={plan.id} plan={plan} onSave={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] })} />
          ))}
        </div>
      )}
    </div>
  );
}
