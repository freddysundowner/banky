import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Building2, Smartphone, Users, Clock, Shield, MessageSquare, Mail, Copy, CheckCircle2, Info, Landmark } from "lucide-react";
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
}

interface RoleCardProps {
  title: string;
  description: string;
  permissions: string[];
  badge: string;
}

function RoleCard({ title, description, permissions, badge }: RoleCardProps) {
  const badgeColors: Record<string, string> = {
    "Full Access": "bg-green-100 text-green-800",
    "High Access": "bg-blue-100 text-blue-800",
    "Standard Access": "bg-purple-100 text-purple-800",
    "Limited Access": "bg-yellow-100 text-yellow-800",
    "Read Only": "bg-gray-100 text-gray-800",
    "Basic Access": "bg-slate-100 text-slate-800",
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">{title}</h4>
        <span className={`text-xs px-2 py-1 rounded-full ${badgeColors[badge] || "bg-gray-100"}`}>
          {badge}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      <ul className="text-sm space-y-1">
        {permissions.map((perm, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <Shield className="h-3 w-3 text-muted-foreground" />
            {perm}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SettingsPage({ organizationId }: SettingsPageProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [staffEmailDomain, setStaffEmailDomain] = useState("");
  const [orgInfoChanged, setOrgInfoChanged] = useState(false);

  const { data: settingsData, isLoading } = useQuery<Setting[]>({
    queryKey: ["/api/organizations", organizationId, "settings"],
    enabled: !!organizationId,
  });

  const { data: orgData } = useQuery<{ staff_email_domain?: string; name?: string }>({
    queryKey: ["/api/organizations", organizationId, "info"],
    queryFn: async () => {
      const memberships = await fetch("/api/organizations/my", { credentials: "include" }).then(r => r.json());
      const membership = memberships?.find((m: any) => m.organizationId === organizationId || m.organization?.id === organizationId);
      if (membership?.organization) {
        return { staff_email_domain: membership.organization.staff_email_domain, name: membership.organization.name };
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

  const getValue = (key: string): string => {
    if (settings[key] !== undefined) return settings[key];
    const setting = settingsData?.find(s => s.setting_key === key);
    return setting?.setting_value || "";
  };

  const getBoolValue = (key: string): boolean => {
    const value = getValue(key);
    return value.toLowerCase() === "true";
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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Organization Settings"
        description="Configure your organization's preferences and integrations"
      />

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Tabs defaultValue="general" className="space-y-6">
          <div className="border-b">
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <TabsList className="inline-flex h-12 items-center justify-start rounded-none bg-transparent p-0 w-auto">
                <TabsTrigger value="general" className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2" data-testid="tab-general">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">General</span>
                </TabsTrigger>
                <TabsTrigger value="loans" className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2" data-testid="tab-loans">
                  <Landmark className="h-4 w-4" />
                  <span className="hidden sm:inline">Loans</span>
                </TabsTrigger>
                <TabsTrigger value="members" className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2" data-testid="tab-members">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Members</span>
                </TabsTrigger>
                <TabsTrigger value="sms" className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2" data-testid="tab-sms">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">SMS</span>
                </TabsTrigger>
                <TabsTrigger value="email" className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2" data-testid="tab-email">
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">Email</span>
                </TabsTrigger>
                <TabsTrigger value="mpesa" className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2" data-testid="tab-mpesa">
                  <Smartphone className="h-4 w-4" />
                  <span className="hidden sm:inline">M-Pesa</span>
                </TabsTrigger>
                <TabsTrigger value="hours" className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2" data-testid="tab-hours">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Hours</span>
                </TabsTrigger>
                <TabsTrigger value="roles" className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2" data-testid="tab-roles">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Roles</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic organization configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={getValue("currency")}
                      onValueChange={(value) => {
                        updateSetting("currency", value);
                        updateSetting("currency_symbol", getCurrencySymbol(value));
                      }}
                    >
                      <SelectTrigger id="currency" data-testid="select-currency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {CURRENCIES.map(c => (
                          <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_format">Date Format</Label>
                    <Select
                      value={getValue("date_format")}
                      onValueChange={(value) => updateSetting("date_format", value)}
                    >
                      <SelectTrigger id="date_format" data-testid="select-date-format">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={getValue("timezone") || "Africa/Nairobi"}
                      onValueChange={(value) => updateSetting("timezone", value)}
                    >
                      <SelectTrigger id="timezone" data-testid="select-timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="auto_logout_minutes">Auto Logout (minutes)</Label>
                  <Input
                    id="auto_logout_minutes"
                    type="number"
                    value={getValue("auto_logout_minutes")}
                    onChange={(e) => updateSetting("auto_logout_minutes", e.target.value)}
                    placeholder="30"
                    data-testid="input-auto-logout"
                  />
                  <p className="text-sm text-muted-foreground">
                    Automatically log out users after this many minutes of inactivity
                  </p>
                </div>

              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Staff Email Domain</CardTitle>
                <CardDescription>The domain used to generate work emails for staff members (e.g. john@yourdomain.com)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="staff_email_domain">Domain</Label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-muted border border-r-0 rounded-l-md text-muted-foreground text-sm">@</span>
                    <Input
                      id="staff_email_domain"
                      value={staffEmailDomain?.replace('@', '') || ''}
                      onChange={(e) => {
                        setStaffEmailDomain(e.target.value.replace('@', ''));
                        setOrgInfoChanged(true);
                      }}
                      placeholder="mysacco.co.ke"
                      className="rounded-l-none"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When you add new staff, their work email will be <span className="font-medium">username@{staffEmailDomain || 'yourdomain.com'}</span>
                  </p>
                </div>
                {orgInfoChanged && (
                  <Button
                    onClick={() => updateOrgMutation.mutate({ staff_email_domain: staffEmailDomain })}
                    disabled={updateOrgMutation.isPending || !staffEmailDomain}
                    size="sm"
                  >
                    {updateOrgMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" /> Save Domain</>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Loan Settings</CardTitle>
                <CardDescription>Configure loan application rules and automation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Guarantors for Loans</Label>
                    <p className="text-sm text-muted-foreground">
                      All loan applications must have guarantors
                    </p>
                  </div>
                  <Switch
                    checked={getBoolValue("require_guarantors")}
                    onCheckedChange={(checked) => updateSetting("require_guarantors", String(checked))}
                    data-testid="switch-require-guarantors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_guarantor_exposure">Max Guarantor Exposure</Label>
                  <Input
                    id="max_guarantor_exposure"
                    type="number"
                    value={getValue("max_guarantor_exposure")}
                    onChange={(e) => updateSetting("max_guarantor_exposure", e.target.value)}
                    placeholder="3"
                    data-testid="input-max-guarantor"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum number of loans a member can guarantee at once
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Loan Deduction from Savings</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically deduct loan repayments from member savings accounts on the instalment due date
                    </p>
                  </div>
                  <Switch
                    checked={getBoolValue("auto_loan_deduction")}
                    onCheckedChange={(checked) => updateSetting("auto_loan_deduction", String(checked))}
                    data-testid="switch-auto-loan-deduction"
                  />
                </div>

                {getBoolValue("auto_loan_deduction") && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                    <Label htmlFor="auto_loan_deduction_time">Deduction Time</Label>
                    <Input
                      id="auto_loan_deduction_time"
                      type="time"
                      value={getValue("auto_loan_deduction_time") || "06:00"}
                      onChange={(e) => updateSetting("auto_loan_deduction_time", e.target.value)}
                      data-testid="input-auto-deduction-time"
                      className="w-40"
                    />
                    <p className="text-sm text-muted-foreground">
                      What time of day to run auto-deductions (based on your organization timezone)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Member Account Settings</CardTitle>
                <CardDescription>Configure member registration and activation rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Opening Deposit</Label>
                    <p className="text-sm text-muted-foreground">
                      Members must make a deposit before account activation
                    </p>
                  </div>
                  <Switch
                    checked={getBoolValue("require_opening_deposit")}
                    onCheckedChange={(checked) => updateSetting("require_opening_deposit", String(checked))}
                    data-testid="switch-require-opening-deposit"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minimum_opening_deposit">Minimum Opening Deposit</Label>
                  <Input
                    id="minimum_opening_deposit"
                    type="number"
                    value={getValue("minimum_opening_deposit")}
                    onChange={(e) => updateSetting("minimum_opening_deposit", e.target.value)}
                    placeholder="0"
                    data-testid="input-min-opening-deposit"
                  />
                  <p className="text-sm text-muted-foreground">
                    Minimum amount required for account activation (when enabled)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Activate on First Deposit</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically activate pending accounts when they receive their first deposit
                    </p>
                  </div>
                  <Switch
                    checked={getBoolValue("auto_activate_on_deposit")}
                    onCheckedChange={(checked) => updateSetting("auto_activate_on_deposit", String(checked))}
                    data-testid="switch-auto-activate"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SMS Integration</CardTitle>
                <CardDescription>Configure SMS notifications for members and staff</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send SMS alerts for loan approvals, repayment reminders, etc.
                    </p>
                  </div>
                  <Switch
                    checked={getBoolValue("sms_enabled")}
                    onCheckedChange={(checked) => updateSetting("sms_enabled", String(checked))}
                    data-testid="switch-sms-enabled"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sms_sender_id">Sender ID / Short Code</Label>
                  <Input
                    id="sms_sender_id"
                    value={getValue("sms_sender_id")}
                    onChange={(e) => updateSetting("sms_sender_id", e.target.value)}
                    placeholder="e.g., PointifyPOS"
                    data-testid="input-sms-sender-id"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sms_endpoint">API Endpoint URL</Label>
                  <Input
                    id="sms_endpoint"
                    value={getValue("sms_endpoint")}
                    onChange={(e) => updateSetting("sms_endpoint", e.target.value)}
                    placeholder="https://api.smsprovider.com/send"
                    data-testid="input-sms-endpoint"
                  />
                  <p className="text-xs text-muted-foreground">
                    The full URL for sending SMS via your provider's API
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sms_api_key">API Key</Label>
                  <Input
                    id="sms_api_key"
                    type="password"
                    value={getValue("sms_api_key")}
                    onChange={(e) => updateSetting("sms_api_key", e.target.value)}
                    placeholder="Enter your SMS API key"
                    data-testid="input-sms-api-key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your SMS provider's API key for authentication
                  </p>
                </div>

                {hasChanges && (
                  <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-sms">
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save SMS Settings
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Settings</CardTitle>
                <CardDescription>Configure email notifications via Brevo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for payslips, reminders, etc.
                    </p>
                  </div>
                  <Switch
                    checked={getBoolValue("email_enabled")}
                    onCheckedChange={(checked) => updateSetting("email_enabled", String(checked))}
                    data-testid="switch-email-enabled"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brevo_api_key">Brevo API Key</Label>
                  <Input
                    id="brevo_api_key"
                    type="password"
                    value={getValue("brevo_api_key")}
                    onChange={(e) => updateSetting("brevo_api_key", e.target.value)}
                    placeholder="Your Brevo API key"
                    data-testid="input-brevo-api-key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your API key from <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Brevo Dashboard</a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email_from_name">Sender Name</Label>
                  <Input
                    id="email_from_name"
                    value={getValue("email_from_name")}
                    onChange={(e) => updateSetting("email_from_name", e.target.value)}
                    placeholder="e.g., Your Organization Name"
                    data-testid="input-email-from-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email_from_address">Sender Email Address</Label>
                  <Input
                    id="email_from_address"
                    type="email"
                    value={getValue("email_from_address")}
                    onChange={(e) => updateSetting("email_from_address", e.target.value)}
                    placeholder="e.g., noreply@yourorganization.com"
                    data-testid="input-email-from-address"
                  />
                  <p className="text-xs text-muted-foreground">
                    This email must be verified in your Brevo account
                  </p>
                </div>

                {hasChanges && (
                  <Button 
                    onClick={handleSave} 
                    disabled={updateMutation.isPending}
                    className="w-full"
                    data-testid="button-save-email-settings"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Email Settings
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mpesa" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>M-Pesa Integration</CardTitle>
                <CardDescription>Configure M-Pesa payment gateway for member deposits, disbursements, and reversals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable M-Pesa</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow members to deposit via M-Pesa
                    </p>
                  </div>
                  <Switch
                    checked={getBoolValue("mpesa_enabled")}
                    onCheckedChange={(checked) => updateSetting("mpesa_enabled", String(checked))}
                    data-testid="switch-mpesa-enabled"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Gateway</Label>
                  <Select
                    value={getValue("mpesa_gateway") || "daraja"}
                    onValueChange={(value) => updateSetting("mpesa_gateway", value)}
                  >
                    <SelectTrigger data-testid="select-mpesa-gateway">
                      <SelectValue placeholder="Select payment gateway" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daraja">Direct Daraja API</SelectItem>
                      <SelectItem value="sunpay">SunPay (Managed Gateway)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      {(getValue("mpesa_gateway") || "daraja") === "daraja" ? (
                        <div>
                          <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">Direct Daraja API</p>
                          <p className="text-blue-700 dark:text-blue-400">Connect directly to Safaricom's Daraja API. You need to register on the Safaricom Developer Portal, create an app, get your Consumer Key, Consumer Secret, and Passkey. Best for organizations that want full control over their M-Pesa integration.</p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">SunPay - Managed M-Pesa Gateway</p>
                          <p className="text-blue-700 dark:text-blue-400">SunPay handles all the Safaricom setup for you. Simply create a free account at <a href="https://sunpay.co.ke" target="_blank" rel="noopener noreferrer" className="underline font-medium">sunpay.co.ke</a>, get your API key, and start accepting payments. Supports STK Push, C2B (Paybill), B2C (disbursements), and transaction reversals. Pricing: 1.5% per successful transaction, no monthly fees.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {(getValue("mpesa_gateway") || "daraja") === "daraja" ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="mpesa_paybill">Paybill Number</Label>
                        <Input
                          id="mpesa_paybill"
                          value={getValue("mpesa_paybill")}
                          onChange={(e) => updateSetting("mpesa_paybill", e.target.value)}
                          placeholder="e.g., 174379"
                          data-testid="input-mpesa-paybill"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mpesa_environment">Environment</Label>
                        <Select
                          value={getValue("mpesa_environment") || "sandbox"}
                          onValueChange={(value) => updateSetting("mpesa_environment", value)}
                        >
                          <SelectTrigger id="mpesa_environment" data-testid="select-mpesa-env">
                            <SelectValue placeholder="Select environment" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                            <SelectItem value="production">Production (Live)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mpesa_consumer_key">Consumer Key</Label>
                      <Input
                        id="mpesa_consumer_key"
                        type="password"
                        value={getValue("mpesa_consumer_key")}
                        onChange={(e) => updateSetting("mpesa_consumer_key", e.target.value)}
                        placeholder="Daraja API consumer key"
                        data-testid="input-mpesa-consumer-key"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mpesa_consumer_secret">Consumer Secret</Label>
                      <Input
                        id="mpesa_consumer_secret"
                        type="password"
                        value={getValue("mpesa_consumer_secret")}
                        onChange={(e) => updateSetting("mpesa_consumer_secret", e.target.value)}
                        placeholder="Daraja API consumer secret"
                        data-testid="input-mpesa-consumer-secret"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mpesa_passkey">Online Passkey</Label>
                      <Input
                        id="mpesa_passkey"
                        type="password"
                        value={getValue("mpesa_passkey")}
                        onChange={(e) => updateSetting("mpesa_passkey", e.target.value)}
                        placeholder="M-Pesa online passkey"
                        data-testid="input-mpesa-passkey"
                      />
                    </div>

                    <div className="rounded-lg bg-muted p-4">
                      <h4 className="font-medium mb-2">Callback URLs</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Register these URLs in your Safaricom Daraja Portal:
                      </p>
                      <div className="space-y-1 text-sm font-mono bg-background p-2 rounded">
                        <p><span className="text-muted-foreground">Validation:</span> /api/mpesa/c2b/validation/{organizationId}</p>
                        <p><span className="text-muted-foreground">Confirmation:</span> /api/mpesa/c2b/confirmation/{organizationId}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="sunpay_api_key">SunPay API Key</Label>
                      <Input
                        id="sunpay_api_key"
                        type="password"
                        value={getValue("sunpay_api_key")}
                        onChange={(e) => updateSetting("sunpay_api_key", e.target.value)}
                        placeholder="sp_your_api_key_here"
                        data-testid="input-sunpay-api-key"
                      />
                      <p className="text-xs text-muted-foreground">
                        Get your API key from your <a href="https://sunpay.co.ke/dashboard" target="_blank" rel="noopener noreferrer" className="underline text-primary">SunPay Dashboard</a>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Webhook URL</Label>
                      <p className="text-xs text-muted-foreground mb-1">
                        Copy this URL and set it as your webhook/callback URL in your SunPay dashboard. BANKY will automatically receive and process payment notifications.
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={`${window.location.origin}/api/webhooks/sunpay/${organizationId}`}
                          className="font-mono text-xs"
                          data-testid="input-sunpay-webhook-url"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/sunpay/${organizationId}`);
                            toast({ title: "Copied!", description: "Webhook URL copied to clipboard" });
                          }}
                          className="shrink-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Supported Payment Flows
                      </h4>
                      <div className="grid gap-3 md:grid-cols-2 text-sm">
                        <div>
                          <p className="font-medium">STK Push</p>
                          <p className="text-muted-foreground">Send payment prompt to customer's phone for deposits and repayments</p>
                        </div>
                        <div>
                          <p className="font-medium">C2B (Paybill)</p>
                          <p className="text-muted-foreground">Customers pay via M-Pesa Paybill using their member number as account reference</p>
                        </div>
                        <div>
                          <p className="font-medium">B2C (Disbursements)</p>
                          <p className="text-muted-foreground">Send money to member's M-Pesa for loan disbursements, refunds, or cashback</p>
                        </div>
                        <div>
                          <p className="font-medium">Transaction Reversal</p>
                          <p className="text-muted-foreground">Reverse completed M-Pesa transactions for refunds or corrections</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hours" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Working Hours</CardTitle>
                <CardDescription>Configure organization operating hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Clock In</Label>
                    <p className="text-sm text-muted-foreground">
                      Staff must clock in before they can use the system
                    </p>
                  </div>
                  <Switch
                    checked={getBoolValue("require_clock_in")}
                    onCheckedChange={(checked) => updateSetting("require_clock_in", String(checked))}
                    data-testid="switch-require-clock-in"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enforce Working Hours</Label>
                    <p className="text-sm text-muted-foreground">
                      Restrict system access to working hours only
                    </p>
                  </div>
                  <Switch
                    checked={getBoolValue("enforce_working_hours")}
                    onCheckedChange={(checked) => updateSetting("enforce_working_hours", String(checked))}
                    data-testid="switch-enforce-hours"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Weekend Access</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow staff to access the system on weekends
                    </p>
                  </div>
                  <Switch
                    checked={getBoolValue("allow_weekend_access")}
                    onCheckedChange={(checked) => updateSetting("allow_weekend_access", String(checked))}
                    data-testid="switch-weekend-access"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="working_start_time">Start Time</Label>
                    <Input
                      id="working_start_time"
                      type="time"
                      value={getValue("working_start_time") || "08:00"}
                      onChange={(e) => updateSetting("working_start_time", e.target.value)}
                      data-testid="input-start-time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="working_end_time">End Time</Label>
                    <Input
                      id="working_end_time"
                      type="time"
                      value={getValue("working_end_time") || "17:00"}
                      onChange={(e) => updateSetting("working_end_time", e.target.value)}
                      data-testid="input-end-time"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <RolesManagement organizationId={organizationId} />
          </TabsContent>

        </Tabs>

        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            size="lg"
            className="shadow-lg"
            data-testid="button-save-settings"
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {hasChanges ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>
    </div>
  );
}
