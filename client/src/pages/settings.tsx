import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Building2, Smartphone, Users, Clock, Shield, MessageSquare, Mail, Copy, CheckCircle2, Info, Landmark, Play, BarChart3, UserCog, GitBranch, ArrowUpRight, Trash2, AlertTriangle, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import RolesManagement from "@/components/roles-management";
import { CURRENCIES, getCurrencySymbol } from "@/lib/currency";

interface Setting {
  id: number;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  description: string;
}

interface SettingsPageProps {
  organizationId: string;
  isOwner?: boolean;
}

type SettingsSection = "general" | "loans" | "members" | "sms" | "email" | "mpesa" | "hours" | "roles" | "usage" | "danger";

const navItems: { id: SettingsSection; label: string; icon: typeof Building2; destructive?: boolean; ownerOnly?: boolean }[] = [
  { id: "general", label: "General", icon: Building2 },
  { id: "loans", label: "Loans", icon: Landmark },
  { id: "members", label: "Members", icon: Users },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "email", label: "Email", icon: Mail },
  { id: "mpesa", label: "M-Pesa", icon: Smartphone },
  { id: "hours", label: "Business Hours", icon: Clock },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
  { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle, destructive: true, ownerOnly: true },
];

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function SettingRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`py-4 first:pt-0 last:pb-0 ${className}`}>{children}</div>;
}

function SettingGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-0 divide-y">
      {title && <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pb-4">{title}</h3>}
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, testId }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void; testId: string;
}) {
  return (
    <SettingRow>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} data-testid={testId} />
      </div>
    </SettingRow>
  );
}

function RunDeductionButton({ organizationId }: { organizationId: string }) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/organizations/${organizationId}/trigger-auto-deduction`);
      return res.json();
    },
    onSuccess: (data: { message: string; deducted: number; skipped: number; errors: number }) => {
      toast({
        title: "Auto Deduction Complete",
        description: `${data.deducted} loan(s) deducted, ${data.skipped} skipped (insufficient savings), ${data.errors} error(s)`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message || "Could not run auto deduction", variant: "destructive" });
    },
  });

  return (
    <div className="pt-2">
      <Button variant="outline" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-run-auto-deduction">
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
        Run Now
      </Button>
      <p className="text-xs text-muted-foreground mt-1">Manually trigger auto loan deductions right now</p>
    </div>
  );
}

interface UsageItem {
  label: string;
  current: number;
  limit: number | null;
  limit_display: string;
  percentage: number;
  icon: string;
}

interface UsageData {
  plan_name: string;
  plan_type: string;
  subscription_status: {
    status: string;
    is_active: boolean;
    is_trial: boolean;
    trial_days_remaining: number;
    is_expired: boolean;
    message: string | null;
  };
  usage: UsageItem[];
}

function UsageDashboard({ organizationId }: { organizationId: string }) {
  const { data, isLoading } = useQuery<UsageData>({
    queryKey: ["/api/organizations", organizationId, "usage"],
    enabled: !!organizationId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const iconMap: Record<string, typeof Users> = {
    "users": Users,
    "user-cog": UserCog,
    "building": GitBranch,
    "message-square": MessageSquare,
  };

  function getProgressColor(percentage: number): string {
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-primary";
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Plan Usage" description={`Your current plan: ${data.plan_name}`} />

      {data.subscription_status.is_trial && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 text-sm text-yellow-800 dark:text-yellow-200">
          Trial period — {data.subscription_status.trial_days_remaining} days remaining
        </div>
      )}

      {data.subscription_status.message && (
        <div className={`p-4 rounded-lg text-sm ${
          data.subscription_status.is_expired
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800"
        }`}>
          {data.subscription_status.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {data.usage.map((item) => {
          const IconComponent = iconMap[item.icon] || Users;
          return (
            <div key={item.label} className="rounded-lg border bg-card p-4 space-y-3" data-testid={`usage-card-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                <span className="text-sm text-muted-foreground">{item.current} / {item.limit_display}</span>
              </div>
              {item.limit !== null && (
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${getProgressColor(item.percentage)}`} style={{ width: `${item.percentage}%` }} />
                </div>
              )}
              {item.limit === null && <p className="text-xs text-muted-foreground">No limit on your current plan</p>}
              {item.percentage >= 90 && item.limit !== null && <p className="text-xs text-destructive">Approaching limit — consider upgrading</p>}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" asChild data-testid="button-upgrade-plan">
          <a href="/upgrade"><ArrowUpRight className="mr-2 h-4 w-4" />Upgrade Plan</a>
        </Button>
      </div>
    </div>
  );
}

function DeleteOrganizationSection({ organizationId }: { organizationId: string }) {
  const { toast } = useToast();
  const [confirmName, setConfirmName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const orgQuery = useQuery<{ name: string }>({
    queryKey: ['/api/organizations', organizationId],
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/organizations/${organizationId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Organization deleted", description: "The organization and all its data have been permanently removed." });
      setShowDeleteDialog(false);
      queryClient.clear();
      window.location.href = "/login";
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const orgName = orgQuery.data?.name ?? "";
  const canDelete = confirmName === orgName && orgName.length > 0;

  return (
    <div className="space-y-6">
      <SectionHeader title="Danger Zone" description="Irreversible actions for this organization" />

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Delete Organization
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Permanently delete this organization and all its data. This cannot be undone.</p>
        </div>

        <div className="rounded-md bg-destructive/10 p-4 text-sm space-y-2">
          <p className="font-medium text-destructive">This will permanently delete:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>All members, staff, and branch data</li>
            <li>All loans, transactions, and financial records</li>
            <li>All settings and configurations</li>
            <li>The organization's database</li>
          </ul>
        </div>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogTrigger asChild>
            <Button variant="destructive" data-testid="button-delete-org-trigger">
              <Trash2 className="mr-2 h-4 w-4" />Delete This Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Organization</DialogTitle>
              <DialogDescription>This action is permanent and cannot be undone. All data will be lost.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                To confirm, type the organization name: <span className="font-semibold text-foreground">{orgName}</span>
              </p>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder="Type organization name to confirm" data-testid="input-confirm-delete-org" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setConfirmName(""); }} data-testid="button-cancel-delete-org">Cancel</Button>
              <Button variant="destructive" disabled={!canDelete || deleteMutation.isPending} onClick={() => deleteMutation.mutate()} data-testid="button-confirm-delete-org">
                {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Permanently Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function GeneralSection({ getValue, updateSetting, staffEmailDomain, setStaffEmailDomain, orgInfoChanged, setOrgInfoChanged, updateOrgMutation }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader title="General" description="Your organization's core information and preferences" />

      <SettingGroup title="Organization Details">
        <SettingRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="organization_name">Organization Name</Label>
              <Input id="organization_name" value={getValue("organization_name")} onChange={(e) => updateSetting("organization_name", e.target.value)} placeholder="e.g. Sunrise SACCO Ltd" data-testid="input-organization-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organization_phone">Phone Number</Label>
              <Input id="organization_phone" value={getValue("organization_phone")} onChange={(e) => updateSetting("organization_phone", e.target.value)} placeholder="e.g. +254 700 123 456" data-testid="input-organization-phone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organization_email">Email Address</Label>
              <Input id="organization_email" value={getValue("organization_email")} onChange={(e) => updateSetting("organization_email", e.target.value)} placeholder="e.g. info@yoursacco.co.ke" data-testid="input-organization-email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organization_website">Website</Label>
              <Input id="organization_website" value={getValue("organization_website")} onChange={(e) => updateSetting("organization_website", e.target.value)} placeholder="e.g. www.yoursacco.co.ke" data-testid="input-organization-website" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="organization_address">Physical Address</Label>
              <Input id="organization_address" value={getValue("organization_address")} onChange={(e) => updateSetting("organization_address", e.target.value)} placeholder="e.g. Kenyatta Avenue, Nairobi" data-testid="input-organization-address" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organization_postal">P.O. Box</Label>
              <Input id="organization_postal" value={getValue("organization_postal")} onChange={(e) => updateSetting("organization_postal", e.target.value)} placeholder="e.g. 12345-00100 Nairobi" data-testid="input-organization-postal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organization_registration_no">Registration Number</Label>
              <Input id="organization_registration_no" value={getValue("organization_registration_no")} onChange={(e) => updateSetting("organization_registration_no", e.target.value)} placeholder="e.g. CS/12345" data-testid="input-organization-registration-no" />
            </div>
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Preferences">
        <SettingRow>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select value={getValue("currency")} onValueChange={(value) => { updateSetting("currency", value); updateSetting("currency_symbol", getCurrencySymbol(value)); }}>
                <SelectTrigger id="currency" data-testid="select-currency"><SelectValue placeholder="Select currency" /></SelectTrigger>
                <SelectContent className="max-h-60">{CURRENCIES.map(c => (<SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date_format">Date Format</Label>
              <Select value={getValue("date_format")} onValueChange={(value) => updateSetting("date_format", value)}>
                <SelectTrigger id="date_format" data-testid="select-date-format"><SelectValue placeholder="Select format" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={getValue("timezone") || "Africa/Nairobi"} onValueChange={(value) => updateSetting("timezone", value)}>
                <SelectTrigger id="timezone" data-testid="select-timezone"><SelectValue placeholder="Select timezone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Nairobi">Africa/Nairobi (EAT)</SelectItem>
                  <SelectItem value="Africa/Lagos">Africa/Lagos (WAT)</SelectItem>
                  <SelectItem value="Africa/Johannesburg">Africa/Johannesburg (SAST)</SelectItem>
                  <SelectItem value="Africa/Cairo">Africa/Cairo (EET)</SelectItem>
                  <SelectItem value="Africa/Accra">Africa/Accra (GMT)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                  <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
                  <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST)</SelectItem>
                  <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                  <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingRow>
        <SettingRow>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="auto_logout_minutes">Auto Logout (minutes)</Label>
            <Input id="auto_logout_minutes" type="number" value={getValue("auto_logout_minutes")} onChange={(e) => updateSetting("auto_logout_minutes", e.target.value)} placeholder="30" data-testid="input-auto-logout" />
            <p className="text-xs text-muted-foreground">Log out users after this many minutes of inactivity</p>
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Staff Email Domain">
        <SettingRow>
          <p className="text-sm text-muted-foreground mb-3">The domain used to generate work emails for staff members</p>
          <div className="flex items-center max-w-md">
            <span className="px-3 py-2 bg-muted border border-r-0 rounded-l-md text-muted-foreground text-sm">@</span>
            <Input
              id="staff_email_domain"
              value={staffEmailDomain?.replace('@', '') || ''}
              onChange={(e) => { setStaffEmailDomain(e.target.value.replace('@', '')); setOrgInfoChanged(true); }}
              placeholder="mysacco.co.ke"
              className="rounded-l-none"
              data-testid="input-staff-email-domain"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Staff emails will be <span className="font-medium">username@{staffEmailDomain || 'yourdomain.com'}</span></p>
          {orgInfoChanged && (
            <Button
              onClick={() => updateOrgMutation.mutate({ staff_email_domain: staffEmailDomain })}
              disabled={updateOrgMutation.isPending || !staffEmailDomain}
              size="sm"
              className="mt-3"
              data-testid="button-save-staff-domain"
            >
              {updateOrgMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Domain</>}
            </Button>
          )}
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

function LoansSection({ getValue, getBoolValue, updateSetting, organizationId }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Loans" description="Configure loan application rules and automation" />
      <SettingGroup>
        <ToggleRow label="Require Guarantors" description="All loan applications must have guarantors" checked={getBoolValue("require_guarantors")} onChange={(v) => updateSetting("require_guarantors", String(v))} testId="switch-require-guarantors" />
        <SettingRow>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="max_guarantor_exposure">Max Guarantor Exposure</Label>
            <Input id="max_guarantor_exposure" type="number" value={getValue("max_guarantor_exposure")} onChange={(e) => updateSetting("max_guarantor_exposure", e.target.value)} placeholder="3" data-testid="input-max-guarantor" />
            <p className="text-xs text-muted-foreground">Maximum loans a member can guarantee at once</p>
          </div>
        </SettingRow>
        <ToggleRow label="Auto Loan Deduction from Savings" description="Automatically deduct repayments from member savings on the instalment due date" checked={getBoolValue("auto_loan_deduction")} onChange={(v) => updateSetting("auto_loan_deduction", String(v))} testId="switch-auto-loan-deduction" />
        {getBoolValue("auto_loan_deduction") && (
          <SettingRow>
            <div className="pl-4 border-l-2 border-primary/20 space-y-3">
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="auto_loan_deduction_time">Deduction Time</Label>
                <Input id="auto_loan_deduction_time" type="time" value={getValue("auto_loan_deduction_time") || "06:00"} onChange={(e) => updateSetting("auto_loan_deduction_time", e.target.value)} data-testid="input-auto-deduction-time" className="w-40" />
                <p className="text-xs text-muted-foreground">Time of day to run auto-deductions (org timezone)</p>
              </div>
              <RunDeductionButton organizationId={organizationId} />
            </div>
          </SettingRow>
        )}
      </SettingGroup>
    </div>
  );
}

function MembersSection({ getBoolValue, updateSetting, getValue }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Members" description="Configure member registration and activation rules" />
      <SettingGroup>
        <ToggleRow label="Require Opening Deposit" description="Members must make a deposit before account activation" checked={getBoolValue("require_opening_deposit")} onChange={(v) => updateSetting("require_opening_deposit", String(v))} testId="switch-require-opening-deposit" />
        <SettingRow>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="minimum_opening_deposit">Minimum Opening Deposit</Label>
            <Input id="minimum_opening_deposit" type="number" value={getValue("minimum_opening_deposit")} onChange={(e) => updateSetting("minimum_opening_deposit", e.target.value)} placeholder="0" data-testid="input-min-opening-deposit" />
            <p className="text-xs text-muted-foreground">Minimum amount for account activation (when enabled)</p>
          </div>
        </SettingRow>
        <ToggleRow label="Auto-Activate on First Deposit" description="Automatically activate pending accounts when they receive their first deposit" checked={getBoolValue("auto_activate_on_deposit")} onChange={(v) => updateSetting("auto_activate_on_deposit", String(v))} testId="switch-auto-activate" />
      </SettingGroup>
    </div>
  );
}

function SmsSection({ getBoolValue, updateSetting, getValue, hasChanges, handleSave, updateMutation }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader title="SMS" description="Configure SMS notifications for members and staff" />
      <SettingGroup>
        <ToggleRow label="Enable SMS Notifications" description="Send SMS alerts for loan approvals, repayment reminders, etc." checked={getBoolValue("sms_enabled")} onChange={(v) => updateSetting("sms_enabled", String(v))} testId="switch-sms-enabled" />
        <SettingRow>
          <div className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label htmlFor="sms_sender_id">Sender ID / Short Code</Label>
              <Input id="sms_sender_id" value={getValue("sms_sender_id")} onChange={(e) => updateSetting("sms_sender_id", e.target.value)} placeholder="e.g., PointifyPOS" data-testid="input-sms-sender-id" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sms_endpoint">API Endpoint URL</Label>
              <Input id="sms_endpoint" value={getValue("sms_endpoint")} onChange={(e) => updateSetting("sms_endpoint", e.target.value)} placeholder="https://api.smsprovider.com/send" data-testid="input-sms-endpoint" />
              <p className="text-xs text-muted-foreground">The full URL for sending SMS via your provider's API</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sms_api_key">API Key</Label>
              <Input id="sms_api_key" type="password" value={getValue("sms_api_key")} onChange={(e) => updateSetting("sms_api_key", e.target.value)} placeholder="Enter your SMS API key" data-testid="input-sms-api-key" />
              <p className="text-xs text-muted-foreground">Your SMS provider's API key for authentication</p>
            </div>
          </div>
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

function EmailSection({ getBoolValue, updateSetting, getValue }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Email" description="Configure email notifications via Brevo" />
      <SettingGroup>
        <ToggleRow label="Enable Email Notifications" description="Send email notifications for payslips, reminders, etc." checked={getBoolValue("email_enabled")} onChange={(v) => updateSetting("email_enabled", String(v))} testId="switch-email-enabled" />
        <SettingRow>
          <div className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label htmlFor="brevo_api_key">Brevo API Key</Label>
              <Input id="brevo_api_key" type="password" value={getValue("brevo_api_key")} onChange={(e) => updateSetting("brevo_api_key", e.target.value)} placeholder="Your Brevo API key" data-testid="input-brevo-api-key" />
              <p className="text-xs text-muted-foreground">
                Get your API key from <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:no-underline" data-testid="link-brevo-dashboard">Brevo Dashboard</a>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email_from_name">Sender Name</Label>
              <Input id="email_from_name" value={getValue("email_from_name")} onChange={(e) => updateSetting("email_from_name", e.target.value)} placeholder="e.g., Your Organization Name" data-testid="input-email-from-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email_from_address">Sender Email Address</Label>
              <Input id="email_from_address" type="email" value={getValue("email_from_address")} onChange={(e) => updateSetting("email_from_address", e.target.value)} placeholder="e.g., noreply@yourorganization.com" data-testid="input-email-from-address" />
              <p className="text-xs text-muted-foreground">This email must be verified in your Brevo account</p>
            </div>
          </div>
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

function MpesaSection({ getBoolValue, updateSetting, getValue, organizationId, toast }: any) {
  const mpesaEnv = getValue("mpesa_environment") || "sandbox";

  return (
    <div className="space-y-6">
      <SectionHeader title="M-Pesa" description="Configure M-Pesa payment gateway for deposits, disbursements, and reversals" />
      <SettingGroup>
        <ToggleRow label="Enable M-Pesa" description="Allow members to deposit via M-Pesa" checked={getBoolValue("mpesa_enabled")} onChange={(v) => updateSetting("mpesa_enabled", String(v))} testId="switch-mpesa-enabled" />

        <SettingRow>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="mpesa_environment">Environment</Label>
            <Select value={mpesaEnv} onValueChange={(value) => updateSetting("mpesa_environment", value)}>
              <SelectTrigger id="mpesa_environment" data-testid="select-mpesa-env"><SelectValue placeholder="Select environment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                <SelectItem value="production">Production (Live)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SettingRow>

        {mpesaEnv === "sandbox" && (
          <SettingRow>
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-300">Sandbox Mode — Live Payments Disabled</p>
                  <p className="text-amber-700 dark:text-amber-400 mt-1">M-Pesa is using Safaricom's Daraja sandbox credentials for testing. Members cannot make real deposits or payments from the mobile app. To go live, switch to <strong>Production</strong> and enter your live credentials from the <a href="https://developer.safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="underline font-medium">Safaricom Developer Portal</a>.</p>
                </div>
              </div>
            </div>
          </SettingRow>
        )}

        {mpesaEnv === "production" && (
          <SettingRow>
            <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-700 p-4">
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-green-800 dark:text-green-300">Production Mode — Live Payments Active</p>
                  <p className="text-green-700 dark:text-green-400 mt-1">M-Pesa is configured for live transactions. Make sure your Daraja API credentials below are your production keys.</p>
                </div>
              </div>
            </div>
          </SettingRow>
        )}

        <SettingRow>
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">Safaricom Daraja API</p>
                <p className="text-blue-700 dark:text-blue-400">Connect directly to Safaricom's Daraja API. You need your Consumer Key, Consumer Secret, and Passkey from the <a href="https://developer.safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="underline font-medium">Safaricom Developer Portal</a>.</p>
              </div>
            </div>
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Daraja API Credentials">
          <SettingRow>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mpesa_paybill">Paybill Number</Label>
                <Input id="mpesa_paybill" value={getValue("mpesa_paybill")} onChange={(e) => updateSetting("mpesa_paybill", e.target.value)} placeholder={mpesaEnv === "sandbox" ? "174379 (sandbox default)" : "Your live paybill number"} data-testid="input-mpesa-paybill" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mpesa_consumer_key">Consumer Key</Label>
                <Input id="mpesa_consumer_key" type="password" value={getValue("mpesa_consumer_key")} onChange={(e) => updateSetting("mpesa_consumer_key", e.target.value)} placeholder={mpesaEnv === "sandbox" ? "Sandbox consumer key (pre-filled)" : "Your live Daraja API consumer key"} data-testid="input-mpesa-consumer-key" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mpesa_consumer_secret">Consumer Secret</Label>
                <Input id="mpesa_consumer_secret" type="password" value={getValue("mpesa_consumer_secret")} onChange={(e) => updateSetting("mpesa_consumer_secret", e.target.value)} placeholder={mpesaEnv === "sandbox" ? "Sandbox consumer secret (pre-filled)" : "Your live Daraja API consumer secret"} data-testid="input-mpesa-consumer-secret" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mpesa_passkey">Online Passkey</Label>
                <Input id="mpesa_passkey" type="password" value={getValue("mpesa_passkey")} onChange={(e) => updateSetting("mpesa_passkey", e.target.value)} placeholder={mpesaEnv === "sandbox" ? "Sandbox passkey (pre-filled)" : "Your live M-Pesa online passkey"} data-testid="input-mpesa-passkey" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mpesa_stk_callback_url">STK Push Callback URL</Label>
                <Input id="mpesa_stk_callback_url" value={getValue("mpesa_stk_callback_url")} onChange={(e) => updateSetting("mpesa_stk_callback_url", e.target.value)} placeholder={`https://yourdomain.com/api/mpesa/stk-callback/${organizationId}`} data-testid="input-mpesa-stk-callback" />
                <p className="text-xs text-muted-foreground">Safaricom will send STK Push results to this URL</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mpesa_initiator_name">B2C Initiator Name</Label>
                  <Input id="mpesa_initiator_name" value={getValue("mpesa_initiator_name")} onChange={(e) => updateSetting("mpesa_initiator_name", e.target.value)} placeholder="testapi" data-testid="input-mpesa-initiator" />
                  <p className="text-xs text-muted-foreground">Required for B2C disbursements</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mpesa_security_credential">B2C Security Credential</Label>
                  <Input id="mpesa_security_credential" type="password" value={getValue("mpesa_security_credential")} onChange={(e) => updateSetting("mpesa_security_credential", e.target.value)} placeholder="Encrypted credential" data-testid="input-mpesa-security-credential" />
                  <p className="text-xs text-muted-foreground">Required for B2C disbursements</p>
                </div>
              </div>
            </div>
          </SettingRow>
          <SettingRow>
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium mb-2 text-sm">Callback URLs</h4>
              <p className="text-xs text-muted-foreground mb-2">Register these in your Safaricom Daraja Portal:</p>
              <div className="space-y-1 text-xs font-mono bg-background p-3 rounded border">
                <p><span className="text-muted-foreground">Validation:</span> /api/mpesa/c2b/validation/{organizationId}</p>
                <p><span className="text-muted-foreground">Confirmation:</span> /api/mpesa/c2b/confirmation/{organizationId}</p>
                <p><span className="text-muted-foreground">STK Callback:</span> /api/mpesa/stk-callback/{organizationId}</p>
              </div>
            </div>
          </SettingRow>
        </SettingGroup>
    </div>
  );
}

function HoursSection({ getBoolValue, updateSetting, getValue }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Business Hours" description="Configure organization operating hours and access rules" />
      <SettingGroup>
        <ToggleRow label="Require Clock In" description="Staff must clock in before they can use the system" checked={getBoolValue("require_clock_in")} onChange={(v) => updateSetting("require_clock_in", String(v))} testId="switch-require-clock-in" />
        <ToggleRow label="Enforce Working Hours" description="Restrict system access to working hours only" checked={getBoolValue("enforce_working_hours")} onChange={(v) => updateSetting("enforce_working_hours", String(v))} testId="switch-enforce-hours" />
        <ToggleRow label="Allow Weekend Access" description="Allow staff to access the system on weekends" checked={getBoolValue("allow_weekend_access")} onChange={(v) => updateSetting("allow_weekend_access", String(v))} testId="switch-weekend-access" />
        <SettingRow>
          <div className="grid gap-4 sm:grid-cols-2 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="working_hours_start">Start Time</Label>
              <Input id="working_hours_start" type="time" value={getValue("working_hours_start") || "08:00"} onChange={(e) => updateSetting("working_hours_start", e.target.value)} data-testid="input-start-time" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="working_hours_end">End Time</Label>
              <Input id="working_hours_end" type="time" value={getValue("working_hours_end") || "17:00"} onChange={(e) => updateSetting("working_hours_end", e.target.value)} data-testid="input-end-time" />
            </div>
          </div>
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

export default function SettingsPage({ organizationId, isOwner }: SettingsPageProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [staffEmailDomain, setStaffEmailDomain] = useState("");
  const [orgInfoChanged, setOrgInfoChanged] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: settingsData, isLoading } = useQuery<Setting[]>({
    queryKey: ["/api/organizations", organizationId, "settings"],
    enabled: !!organizationId,
  });

  const { data: orgData } = useQuery<{ staff_email_domain?: string; name?: string; phone?: string; email?: string; address?: string }>({
    queryKey: ["/api/organizations", organizationId, "info"],
    queryFn: async () => {
      const memberships = await fetch("/api/organizations/my", { credentials: "include" }).then(r => r.json());
      const membership = memberships?.find((m: any) => m.organizationId === organizationId || m.organization?.id === organizationId);
      if (membership?.organization) {
        const org = membership.organization;
        return { staff_email_domain: org.staff_email_domain, name: org.name, phone: org.phone, email: org.email, address: org.address };
      }
      return {};
    },
    enabled: !!organizationId,
  });

  if (orgData?.staff_email_domain && !staffEmailDomain && !orgInfoChanged) {
    setStaffEmailDomain(orgData.staff_email_domain);
  }

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      return apiRequest("PUT", `/api/organizations/${organizationId}/settings`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "settings"] });
      toast({ title: "Settings saved successfully" });
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (data: { staff_email_domain: string }) => {
      return apiRequest("PATCH", `/api/organizations/${organizationId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my"] });
      toast({ title: "Staff email domain updated" });
      setOrgInfoChanged(false);
    },
    onError: () => {
      toast({ title: "Failed to update staff email domain", variant: "destructive" });
    },
  });

  const orgFieldFallbacks: Record<string, string> = {
    organization_name: orgData?.name || "",
    organization_phone: orgData?.phone || "",
    organization_email: orgData?.email || "",
    organization_address: orgData?.address || "",
  };

  const getValue = (key: string): string => {
    if (settings[key] !== undefined) return settings[key];
    const setting = settingsData?.find(s => s.setting_key === key);
    if (setting?.setting_value) return setting.setting_value;
    return orgFieldFallbacks[key] || "";
  };

  const getBoolValue = (key: string): boolean => {
    return getValue(key).toLowerCase() === "true";
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const visibleNavItems = navItems.filter(item => !item.ownerOnly || isOwner);
  const currentNav = visibleNavItems.find(n => n.id === activeSection);

  const sharedProps = { getValue, getBoolValue, updateSetting, organizationId, hasChanges, handleSave, updateMutation, toast };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Organization Settings" description="Configure your organization's preferences and integrations" />

      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          <nav className="hidden lg:block w-56 shrink-0 border-r bg-muted/30 p-3 sticky top-0 self-start" data-testid="settings-sidebar">
            <div className="space-y-0.5">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    data-testid={`nav-${item.id}`}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left ${
                      isActive
                        ? item.destructive
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                        : item.destructive
                          ? "text-destructive/70 hover:bg-destructive/5 hover:text-destructive"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex-1 min-w-0">
            <div className="lg:hidden px-4 pt-4 pb-2 sticky top-0 bg-background z-10 border-b">
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                data-testid="button-mobile-settings-nav"
                className="w-full flex items-center justify-between px-3 py-2.5 border rounded-md text-sm font-medium bg-card"
              >
                <span className="flex items-center gap-2">
                  {currentNav && <currentNav.icon className="h-4 w-4" />}
                  {currentNav?.label}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${mobileNavOpen ? "rotate-180" : ""}`} />
              </button>
              {mobileNavOpen && (
                <div className="mt-1 border rounded-md bg-card p-1 shadow-lg">
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setActiveSection(item.id); setMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left ${
                          activeSection === item.id
                            ? item.destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary font-medium"
                            : item.destructive ? "text-destructive/70" : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />{item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 lg:p-8 max-w-3xl">
              {activeSection === "general" && (
                <GeneralSection {...sharedProps} staffEmailDomain={staffEmailDomain} setStaffEmailDomain={setStaffEmailDomain} orgInfoChanged={orgInfoChanged} setOrgInfoChanged={setOrgInfoChanged} updateOrgMutation={updateOrgMutation} />
              )}
              {activeSection === "loans" && <LoansSection {...sharedProps} />}
              {activeSection === "members" && <MembersSection {...sharedProps} />}
              {activeSection === "sms" && <SmsSection {...sharedProps} />}
              {activeSection === "email" && <EmailSection {...sharedProps} />}
              {activeSection === "mpesa" && <MpesaSection {...sharedProps} />}
              {activeSection === "hours" && <HoursSection {...sharedProps} />}
              {activeSection === "roles" && (
                <div className="space-y-6">
                  <SectionHeader title="Roles & Permissions" description="Manage staff roles and their access levels" />
                  <RolesManagement organizationId={organizationId} />
                </div>
              )}
              {activeSection === "usage" && <UsageDashboard organizationId={organizationId} />}
              {activeSection === "danger" && isOwner && <DeleteOrganizationSection organizationId={organizationId} />}
            </div>
          </div>
        </div>
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
          <Button onClick={handleSave} disabled={updateMutation.isPending} size="lg" className="shadow-lg" data-testid="button-save-settings">
            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
