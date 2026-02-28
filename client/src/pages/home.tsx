import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useFeatures } from "@/hooks/use-features";
import { useSession } from "@/hooks/use-session";
import { useBranding } from "@/context/BrandingContext";
import { CURRENCIES } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { NotificationCenter } from "@/components/notification-center";
import {
  Landmark,
  Building2,
  Clock,
  Shield,
  Settings,
  LogOut,
  Plus,
  LayoutDashboard,
  Users,
  Banknote,
  FileText,
  CreditCard,
  Wallet,
  Receipt,
  BarChart3,
  MessageSquare,
  AlertTriangle,
  ScrollText,
  UserCircle,
  Calendar,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import Dashboard from "./dashboard";
import BranchManagement from "@/components/branch-management";
import StaffManagement from "@/components/staff-management";
import MemberManagement from "@/components/member-management";
import LoanProducts from "@/components/loan-products";
import LoanApplications from "@/components/loan-applications";
import Transactions from "@/components/transactions";
import Repayments from "@/components/repayments";
import Reports from "@/components/reports";
import AnalyticsDashboard from "@/components/analytics-dashboard";
import SMSNotifications from "@/components/sms-notifications";
import DefaultsCollections from "@/components/defaults-collections";
import HRManagement from "@/components/hr-management";
import LeaveManagement from "@/components/leave-management";
import ExpensesManagement from "@/components/expenses-management";
import AuditLogs from "@/components/audit-logs";
import CRMManagement from "@/components/crm";
import CollateralManagement from "@/components/collateral";
import TellerStation from "@/components/teller-station";
import FloatManagement from "@/components/float-management";
import { TicketingKiosk } from "@/components/ticketing-kiosk";
import { QueueDisplayBoard } from "@/components/queue-display-board";
import { TellerServices } from "@/components/teller-services";
import FixedDeposits from "@/components/fixed-deposits";
import ChartOfAccounts from "@/components/chart-of-accounts";
import JournalEntries from "@/components/journal-entries";
import { Dividends } from "@/components/dividends";
import OpeningBalances from "@/components/opening-balances";
import { TrialBanner } from "@/components/trial-banner";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { OrgSetupProgress } from "@/components/org-setup-progress";
import SettingsPage from "@/pages/settings";
import UpgradePage from "@/pages/upgrade";
import MyAccountPage from "@/pages/my-account";
import type { Organization } from "@shared/schema";
import { Link } from "wouter";
import { X, Mail } from "lucide-react";

interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  organization: Omit<Organization, "connectionString">;
}

const createOrgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  code: z.string().min(2, "Code must be at least 2 characters").max(20, "Code must be less than 20 characters").optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  staffEmailDomain: z.string().min(3, "Staff email domain is required (e.g. mysacco.co.ke)"),
  deploymentMode: z.enum(["saas", "standalone"]),
  currency: z.string().default("KES"),
});

const updateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
  workingDays: z.array(z.string()).optional(),
  currency: z.string().optional(),
  financialYearStart: z.string().optional(),
  enforceWorkingHours: z.boolean().optional(),
  autoLogoutMinutes: z.string().optional(),
  requireTwoFactorAuth: z.boolean().optional(),
});

type CreateOrgFormData = z.infer<typeof createOrgSchema>;
type UpdateOrgFormData = z.infer<typeof updateOrgSchema>;

type NavSection = "dashboard" | "teller" | "teller-services" | "float-management" | "ticketing-kiosk" | "queue-display" | "branches" | "staff" | "members" | "loan-products" | "loans" | "transactions" | "repayments" | "fixed-deposits" | "chart-of-accounts" | "journal-entries" | "opening-balances" | "dividends" | "reports" | "analytics" | "sms" | "defaults" | "hr" | "leaves" | "expenses" | "audit" | "crm" | "collateral" | "settings" | "my-account" | "upgrade";

const weekDays = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const navItems = [
  { title: "Dashboard", value: "dashboard" as NavSection, icon: LayoutDashboard, permissions: ["dashboard:read"], feature: "core_banking" },
  { title: "Teller Station", value: "teller" as NavSection, icon: Banknote, permissions: ["teller_station:read"], feature: "teller_station" },
  { title: "Float Management", value: "float-management" as NavSection, icon: Wallet, permissions: ["float_management:read"], feature: "float_management" },
  { title: "Teller Services", value: "teller-services" as NavSection, icon: Receipt, permissions: ["teller_station:read"], feature: "teller_station" },
  { title: "Ticketing Kiosk", value: "ticketing-kiosk" as NavSection, icon: Receipt, permissions: ["ticketing:access"], feature: "teller_station" },
  { title: "Queue Display", value: "queue-display" as NavSection, icon: Receipt, permissions: ["ticketing:display"], feature: "teller_station" },
  { title: "Branches", value: "branches" as NavSection, icon: Building2, permissions: ["branches:read"], feature: "core_banking" },
  { title: "Staff", value: "staff" as NavSection, icon: Users, permissions: ["staff:read"], feature: "core_banking" },
  { title: "Members", value: "members" as NavSection, icon: Users, permissions: ["members:read"], feature: "members" },
  { title: "Loan Products", value: "loan-products" as NavSection, icon: CreditCard, permissions: ["loan_products:read"], feature: "loans" },
  { title: "Loan Applications", value: "loans" as NavSection, icon: FileText, permissions: ["loans:read"], feature: "loans" },
  { title: "Transactions", value: "transactions" as NavSection, icon: Wallet, permissions: ["transactions:read"], feature: "savings" },
  { title: "Repayments", value: "repayments" as NavSection, icon: Receipt, permissions: ["repayments:read"], feature: "loans" },
  { title: "Fixed Deposits", value: "fixed-deposits" as NavSection, icon: Wallet, permissions: ["fixed_deposits:read"], feature: "fixed_deposits" },
  { title: "Dividends", value: "dividends" as NavSection, icon: Wallet, permissions: ["dividends:read"], feature: "dividends" },
  { title: "Chart of Accounts", value: "chart-of-accounts" as NavSection, icon: FileText, permissions: ["chart_of_accounts:read"], feature: "accounting" },
  { title: "Journal Entries", value: "journal-entries" as NavSection, icon: ScrollText, permissions: ["journal_entries:read"], feature: "accounting" },
  { title: "Opening Balances", value: "opening-balances" as NavSection, icon: ScrollText, permissions: ["settings:write"], feature: "accounting" },
  { title: "Reports", value: "reports" as NavSection, icon: BarChart3, permissions: ["reports:read"], feature: "analytics" },
  { title: "Analytics", value: "analytics" as NavSection, icon: BarChart3, permissions: ["analytics:read"], feature: "analytics" },
  { title: "SMS Notifications", value: "sms" as NavSection, icon: MessageSquare, permissions: ["sms:read"], feature: "sms_notifications" },
  { title: "Defaults & Collections", value: "defaults" as NavSection, icon: AlertTriangle, permissions: ["defaults:read"], feature: "loans" },
  { title: "HR Management", value: "hr" as NavSection, icon: Users, permissions: ["hr:read"], feature: "payroll" },
  { title: "Leave Management", value: "leaves" as NavSection, icon: Calendar, permissions: ["leave:read"], feature: "leave_management" },
  { title: "Expenses", value: "expenses" as NavSection, icon: Receipt, permissions: ["expenses:read"], feature: "expenses" },
  { title: "Audit Logs", value: "audit" as NavSection, icon: ScrollText, permissions: ["audit:read"], feature: "audit_logs" },
  { title: "CRM", value: "crm" as NavSection, icon: Users, permissions: ["members:read"], feature: "crm" },
  { title: "Collateral & Insurance", value: "collateral" as NavSection, icon: Shield, permissions: ["loans:read"], feature: "collateral" },
  { title: "Settings", value: "settings" as NavSection, icon: Settings, permissions: ["settings:read"], adminOnly: true },
  { title: "My Account", value: "my-account" as NavSection, icon: UserCircle, permissions: [], alwaysShow: true },
];

function SidebarNavMenu({ items, activeSection, onSelect }: { 
  items: typeof navItems, 
  activeSection: NavSection, 
  onSelect: (value: NavSection) => void 
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.value}>
          <SidebarMenuButton
            isActive={activeSection === item.value}
            onClick={() => {
              onSelect(item.value);
              setOpenMobile(false);
            }}
            data-testid={`nav-${item.value}`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function SidebarUpgradeFooter({ plan, isTrial, trialDaysRemaining, onUpgrade }: {
  plan: string | undefined,
  isTrial: boolean,
  trialDaysRemaining: number,
  onUpgrade: () => void
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarFooter className="p-2">
      <div 
        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border border-primary/20 bg-primary/5 cursor-pointer transition-all ${
          plan !== 'enterprise' ? 'hover:bg-primary/10 hover:border-primary/40' : ''
        }`}
        onClick={() => {
          if (plan !== 'enterprise') {
            onUpgrade();
            setOpenMobile(false);
          }
        }}
      >
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs rounded font-semibold ${
            plan === 'professional' ? 'bg-purple-500 text-white' :
            plan === 'growth' ? 'bg-blue-500 text-white' :
            plan === 'enterprise' ? 'bg-amber-500 text-white' :
            'bg-primary text-primary-foreground'
          }`}>
            {plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Starter'}
          </span>
          {isTrial && trialDaysRemaining > 0 && (
            <span className="text-xs font-medium text-primary">
              {trialDaysRemaining}d trial
            </span>
          )}
        </div>
        {plan !== 'enterprise' && (
          <ChevronRight className="h-4 w-4 text-primary" />
        )}
      </div>
    </SidebarFooter>
  );
}

export default function Home() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { platform_name: platformName, deployment_mode } = useBranding();
  const isSaasMode = deployment_mode === 'saas';
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationMembership["organization"] | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success" || params.get("payment") === "cancelled") {
      return "upgrade";
    }
    return "dashboard";
  });
  const [isSectionInitialized, setIsSectionInitialized] = useState(false);
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [crmPrefill, setCrmPrefill] = useState<{ first_name: string; last_name: string; phone?: string; email?: string } | null>(null);
  const [showSetupProgress, setShowSetupProgress] = useState(false);
  const [setupOrgName, setSetupOrgName] = useState("");
  const [setupMode, setSetupMode] = useState<"full" | "finalize">("full");
  const [finalizeReady, setFinalizeReady] = useState(false);
  const queryClient = useQueryClient();
  const prevSectionRef = useRef(activeSection);

  useEffect(() => {
    if (prevSectionRef.current !== activeSection && selectedOrg) {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (Array.isArray(key) && key[0] === "/api/organizations" && key[1] === selectedOrg.id) {
            return true;
          }
          return false;
        },
      });
      prevSectionRef.current = activeSection;
    }
  }, [activeSection, selectedOrg, queryClient]);

  const { isLoading: sessionLoading } = useSession(selectedOrg?.id);

  interface AttendanceStatus {
    clocked_in: boolean;
    clocked_out: boolean;
    clock_in_time: string | null;
    clock_out_time: string | null;
    require_clock_in: boolean;
  }

  const { data: attendanceStatus } = useQuery<AttendanceStatus>({
    queryKey: ["/api/organizations", selectedOrg?.id, "hr", "attendance", "my-status"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${selectedOrg!.id}/hr/attendance/my-status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attendance status");
      return res.json();
    },
    enabled: !!selectedOrg,
    refetchInterval: 60000,
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/organizations/${selectedOrg!.id}/hr/attendance/clock-in`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", selectedOrg?.id, "hr", "attendance"] });
      toast({ title: "Clocked in successfully" });
    },
    onError: () => {
      toast({ title: "Failed to clock in", variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/organizations/${selectedOrg!.id}/hr/attendance/clock-out`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", selectedOrg?.id, "hr", "attendance"] });
      toast({ title: "Clocked out successfully" });
    },
    onError: () => {
      toast({ title: "Failed to clock out", variant: "destructive" });
    },
  });

  const { hasAnyPermission, isAdmin, role, workingHoursAllowed, workingHoursMessage, isLoading: permissionsLoading } = usePermissions(selectedOrg?.id || null, { deferToSession: true });
  const { hasFeature, isLoading: featuresLoading, isExpired, isTrial, trialDaysRemaining, trialMessage, plan } = useFeatures(selectedOrg?.id, { deferToSession: true });
  
  const filteredNavItems = navItems.filter(item => {
    if (item.alwaysShow) return true;
    if (item.adminOnly && !isAdmin) return false;
    const featureRequired = (item as any).feature;
    if (featureRequired) {
      if (featuresLoading) return true;
      if (!hasFeature(featureRequired)) return false;
    }
    return hasAnyPermission(item.permissions);
  });

  // Reset section and initialization when org changes so the loader re-gates cleanly
  useEffect(() => {
    setIsSectionInitialized(false);
    const params = new URLSearchParams(window.location.search);
    const isPaymentReturn = params.get("payment") === "success" || params.get("payment") === "cancelled";
    setActiveSection(isPaymentReturn ? "upgrade" : "dashboard");
  }, [selectedOrg?.id]);

  // Redirect to first available section if current section is not accessible.
  // Only runs AFTER the session has loaded so filteredNavItems reflects real permissions.
  // Special sections like "upgrade" are always allowed.
  const specialSections = ["upgrade", "settings", "my-account"];
  useEffect(() => {
    if (selectedOrg && !sessionLoading && !permissionsLoading && !featuresLoading && filteredNavItems.length > 0) {
      const isSpecialSection = specialSections.includes(activeSection);
      const currentSectionAllowed = isSpecialSection || filteredNavItems.some(item => item.value === activeSection);
      if (!currentSectionAllowed) {
        const preferredItem = filteredNavItems.find(item => item.value !== "my-account") || filteredNavItems[0];
        setActiveSection(preferredItem.value);
      }
      setIsSectionInitialized(true);
    }
  }, [selectedOrg, sessionLoading, permissionsLoading, featuresLoading, filteredNavItems, activeSection]);

  const { data: memberships, isLoading: orgsLoading } = useQuery<OrganizationMembership[]>({
    queryKey: ["/api/organizations/my"],
    enabled: !!user,
  });

  const createForm = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      code: "",
      email: "",
      phone: "",
      address: "",
      deploymentMode: "saas",
      currency: "KES",
    },
  });

  const watchedName = createForm.watch("name");
  useEffect(() => {
    if (watchedName) {
      const generated = watchedName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20) || "ORG";
      createForm.setValue("code", generated);
    } else {
      createForm.setValue("code", "");
    }
  }, [watchedName, createForm]);

  const updateForm = useForm<UpdateOrgFormData>({
    resolver: zodResolver(updateOrgSchema),
    defaultValues: {
      workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    },
  });

  useEffect(() => {
    if (selectedOrg) {
      updateForm.reset({
        name: selectedOrg.name,
        email: selectedOrg.email || "",
        phone: selectedOrg.phone || "",
        address: selectedOrg.address || "",
        workingHoursStart: selectedOrg.workingHoursStart || "08:00:00",
        workingHoursEnd: selectedOrg.workingHoursEnd || "17:00:00",
        workingDays: (selectedOrg.workingDays as string[]) || ["monday", "tuesday", "wednesday", "thursday", "friday"],
        currency: selectedOrg.currency || "KES",
        financialYearStart: selectedOrg.financialYearStart || "01-01",
        enforceWorkingHours: selectedOrg.enforceWorkingHours || false,
        autoLogoutMinutes: selectedOrg.autoLogoutMinutes || "30",
        requireTwoFactorAuth: selectedOrg.requireTwoFactorAuth || false,
      });
    }
  }, [selectedOrg, updateForm]);

  useEffect(() => {
    if (memberships && memberships.length > 0 && !selectedOrg) {
      setSelectedOrg(memberships[0].organization);
    }
  }, [memberships, selectedOrg]);

  useEffect(() => {
    if (!selectedOrg || !memberships) return;
    if (showSetupProgress || showOnboarding) return;
    const membership = memberships.find(m => m.organization.id === selectedOrg.id);
    if (!membership?.isOwner) return;
    const dismissedKey = `onboarding_dismissed_${selectedOrg.id}`;
    if (localStorage.getItem(dismissedKey)) return;
    fetch(`/api/organizations/${selectedOrg.id}/branches`, { credentials: "include" })
      .then(res => {
        if (!res.ok) {
          setShowOnboarding(true);
          return null;
        }
        return res.json();
      })
      .then((branches) => {
        if (branches === null) return;
        if (Array.isArray(branches) && branches.length === 0) {
          setShowOnboarding(true);
        }
      })
      .catch(() => {
        setShowOnboarding(true);
      });
  }, [selectedOrg, memberships, showSetupProgress, showOnboarding]);

  const [setupReady, setSetupReady] = useState(false);
  const setupReadyRef = useRef(false);

  const createMutation = useMutation({
    mutationFn: async (data: CreateOrgFormData) => {
      return apiRequest("POST", "/api/organizations", data);
    },
    onSuccess: async () => {
      setSelectedOrg(null);
      await queryClient.invalidateQueries({ queryKey: ["/api/organizations/my"] });
      createForm.reset();
      setupReadyRef.current = true;
      setSetupReady(true);
    },
    onError: (error: Error) => {
      setShowSetupProgress(false);
      toast({
        title: "Failed to create organization",
        description: error?.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateOrg = (data: CreateOrgFormData) => {
    setSetupOrgName(data.name);
    setShowCreateDialog(false);
    setSetupMode("full");
    setShowSetupProgress(true);
    setupReadyRef.current = false;
    setSetupReady(false);
    createMutation.mutate(data);
  };

  const handleWizardFinalize = async (needsBranch: boolean) => {
    setShowOnboarding(false);
    setSetupOrgName(selectedOrg?.name || "");
    setSetupMode("finalize");
    setFinalizeReady(false);
    setShowSetupProgress(true);

    if (needsBranch && selectedOrg) {
      try {
        await apiRequest("POST", `/api/organizations/${selectedOrg.id}/branches`, {
          name: "Main Branch",
          code: "BR0001",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", selectedOrg.id, "branches"] });
      } catch (e) {
      }
    }
    setFinalizeReady(true);
  };

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateOrgFormData) => {
      if (!selectedOrg) return;
      return apiRequest("PATCH", `/api/organizations/${selectedOrg.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my"] });
      toast({
        title: "Settings saved",
        description: "Organization settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isBootstrapping =
    authLoading ||
    orgsLoading ||
    (memberships && memberships.length > 0 && (!selectedOrg || sessionLoading || permissionsLoading || featuresLoading || !isSectionInitialized));

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-0">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg mb-6">
          <Landmark className="h-9 w-9 text-primary-foreground" />
        </div>
        <h1 className="text-xl font-bold mb-1">{platformName || "BankyKit"}</h1>
        <p className="text-muted-foreground text-sm mb-8">
          {authLoading ? "Verifying session..." : (orgsLoading || !selectedOrg) ? "Loading your organization..." : sessionLoading ? "Loading your workspace..." : "Preparing dashboard..."}
        </p>
        <div className="w-56 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-primary rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  const hasOrganizations = memberships && memberships.length > 0;

  if (!hasOrganizations) {
    if (showSetupProgress) {
      return (
        <OrgSetupProgress
          orgName={setupOrgName}
          ready={setupMode === "full" ? setupReady : finalizeReady}
          mode={setupMode}
          onComplete={() => {
            setShowSetupProgress(false);
            if (setupMode === "full") {
              setShowOnboarding(true);
            }
          }}
        />
      );
    }
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Landmark className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">{platformName}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {((user as any)?.firstName || (user as any)?.first_name || "")?.[0]}
                    {((user as any)?.lastName || (user as any)?.last_name || "")?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <span className="text-sm text-muted-foreground">Welcome,</span>
                  <span className="text-sm font-medium ml-1">
                    {(user as any)?.firstName || (user as any)?.first_name} {(user as any)?.lastName || (user as any)?.last_name}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="button-logout">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
              <Building2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome to {platformName}</h1>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              Get started by setting up your organization. You can configure your institution's details, working hours, and access settings.
            </p>
            <Button size="lg" onClick={() => setShowCreateDialog(true)} data-testid="button-create-org">
              <Plus className="mr-2 h-5 w-5" />
              Create Organization
            </Button>
          </div>
        </main>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Create Organization</DialogTitle>
                  <DialogDescription className="text-sm">
                    Set up your financial institution in just a few steps
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateOrg)} className="space-y-5">
                <div className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Unity Sacco Ltd" data-testid="input-create-org-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                      control={createForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="info@mysacco.com" data-testid="input-create-org-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+254 700 000000" data-testid="input-create-org-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={createForm.control}
                    name="staffEmailDomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Staff Email Domain <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <span className="flex items-center justify-center px-3 h-9 bg-muted border border-r-0 rounded-l-md text-muted-foreground text-sm">@</span>
                            <Input 
                              {...field} 
                              value={field.value?.replace('@', '') || ''} 
                              onChange={(e) => field.onChange(e.target.value.replace('@', ''))}
                              placeholder="mysacco.co.ke" 
                              className="rounded-l-none"
                              data-testid="input-create-org-staff-domain" 
                            />
                          </div>
                        </FormControl>
                        <FormDescription>Staff emails will use this domain (e.g. john@mysacco.co.ke)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-create-currency">
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            {CURRENCIES.map(c => (
                              <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create-org" className="w-full sm:w-auto">
                    {createMutation.isPending ? "Setting up your organization..." : "Create Organization"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Show blocking screen when outside working hours
  if (selectedOrg && !permissionsLoading && !workingHoursAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription className="mt-2">
              {workingHoursMessage || "You cannot access the system at this time."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Please contact your administrator if you need access outside of working hours.
            </p>
            <Button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/auth/session", selectedOrg?.id] });
                queryClient.invalidateQueries({ queryKey: ["/api/auth/permissions", selectedOrg?.id] });
              }}
              variant="default"
              className="w-full"
              data-testid="button-refresh-access"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Check Again
            </Button>
            <Button onClick={() => logout()} variant="outline" className="w-full" data-testid="button-logout">
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render ticketing kiosk and queue display as true full screen (outside sidebar layout)
  if (activeSection === "ticketing-kiosk" && selectedOrg) {
    return (
      <TicketingKiosk 
        organizationId={selectedOrg.id}
        organizationName={selectedOrg.name}
        branchId={(user as any)?.branch_id}
        branchName={(user as any)?.branchName}
        isAdmin={isAdmin}
        onBack={() => setActiveSection("dashboard")}
        onLogout={() => logout()}
      />
    );
  }

  if (activeSection === "queue-display" && selectedOrg) {
    return (
      <QueueDisplayBoard 
        organizationId={selectedOrg.id}
        organizationName={selectedOrg.name}
        branchId={(user as any)?.branch_id}
        branchName={(user as any)?.branchName}
        isAdmin={isAdmin}
        onBack={() => setActiveSection("dashboard")}
        onLogout={() => logout()}
      />
    );
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex flex-col h-screen w-full overflow-hidden">
        {showSetupProgress && (
          <OrgSetupProgress
            orgName={setupOrgName}
            ready={setupMode === "full" ? setupReady : finalizeReady}
            mode={setupMode}
            onComplete={() => {
              setShowSetupProgress(false);
              if (setupMode === "full") {
                setShowOnboarding(true);
              }
            }}
          />
        )}
        {showOnboarding && selectedOrg && !showSetupProgress && (
          <OnboardingWizard
            organizationId={selectedOrg.id}
            organizationName={selectedOrg.name}
            onComplete={() => setShowOnboarding(false)}
            onFinalize={handleWizardFinalize}
          />
        )}
        <div className="flex flex-1 overflow-hidden">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <Landmark className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">{platformName}</span>
              </div>
            </SidebarGroup>

            {memberships.length > 1 && (
              <SidebarGroup>
                <SidebarGroupLabel>Organization</SidebarGroupLabel>
                <SidebarGroupContent>
                  <Select
                    value={selectedOrg?.id}
                    onValueChange={(id) => {
                      const membership = memberships.find((m) => m.organizationId === id);
                      if (membership) setSelectedOrg(membership.organization);
                    }}
                  >
                    <SelectTrigger className="w-full" data-testid="select-organization">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {memberships.map((m) => (
                        <SelectItem key={m.organizationId} value={m.organizationId}>
                          {m.organization.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarNavMenu 
                  items={filteredNavItems} 
                  activeSection={activeSection} 
                  onSelect={setActiveSection} 
                />
              </SidebarGroupContent>
            </SidebarGroup>

          </SidebarContent>
          
          {isSaasMode && (
            <SidebarUpgradeFooter
              plan={plan}
              isTrial={isTrial}
              trialDaysRemaining={trialDaysRemaining}
              onUpgrade={() => setActiveSection("upgrade")}
            />
          )}
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          {isSaasMode && (
            <TrialBanner
              isExpired={isExpired}
              isTrial={isTrial}
              trialDaysRemaining={trialDaysRemaining}
              message={trialMessage}
              onUpgrade={() => setActiveSection("upgrade")}
            />
          )}
          {!emailBannerDismissed && user && !(user as any)?.isStaff && (user as any)?.is_email_verified === false && (
            <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800" data-testid="banner-email-verification">
              <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                <Mail className="h-4 w-4 shrink-0" />
                <span>Please verify your email address.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href="/verify-email">
                  <Button variant="outline" size="sm" data-testid="button-verify-now">
                    Verify Now
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEmailBannerDismissed(true)}
                  data-testid="button-dismiss-verification"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <header className="flex h-12 items-center justify-between border-b bg-card px-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              {selectedOrg && attendanceStatus?.require_clock_in && !attendanceStatus.clocked_in && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                  onClick={() => clockInMutation.mutate()}
                  disabled={clockInMutation.isPending}
                  data-testid="button-header-clock-in"
                >
                  <Clock className="h-3 w-3" />
                  <span className="hidden sm:inline">{clockInMutation.isPending ? "Clocking in..." : "Clock In"}</span>
                  <span className="sm:hidden">In</span>
                </Button>
              )}
              {(user as any)?.branchName && (
                <div className="hidden md:flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                  <Building2 className="h-3 w-3" />
                  {(user as any).branchName}
                </div>
              )}
              <div className="h-4 w-px bg-border hidden md:block" />
              {selectedOrg && (
                <NotificationCenter organizationId={selectedOrg.id} />
              )}
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {((user as any)?.firstName || (user as any)?.first_name || "")?.[0]}
                    {((user as any)?.lastName || (user as any)?.last_name || "")?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm hidden sm:block">
                  {(user as any)?.firstName || (user as any)?.first_name} {(user as any)?.lastName || (user as any)?.last_name}
                </span>
              </div>
              {selectedOrg && attendanceStatus?.require_clock_in && attendanceStatus.clocked_in && !attendanceStatus.clocked_out && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                  onClick={() => clockOutMutation.mutate()}
                  disabled={clockOutMutation.isPending}
                  data-testid="button-header-clock-out"
                >
                  <Clock className="h-3 w-3" />
                  <span className="hidden sm:inline">{clockOutMutation.isPending ? "Clocking out..." : "Clock Out"}</span>
                  <span className="sm:hidden">Out</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => logout()} data-testid="button-logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {!isAdmin && !workingHoursAllowed && selectedOrg ? (
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="rounded-full bg-orange-100 p-6">
                  <Clock className="h-12 w-12 text-orange-600" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold">Outside Working Hours</h2>
                  <p className="text-muted-foreground max-w-md">
                    {workingHoursMessage || "The system is only accessible during working hours. Please try again during your scheduled work hours."}
                  </p>
                </div>
              </div>
            ) : attendanceStatus?.require_clock_in && !attendanceStatus?.clocked_in && selectedOrg && !isAdmin ? (
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="rounded-full bg-primary/10 p-6">
                  <Clock className="h-12 w-12 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold">Clock In Required</h2>
                  <p className="text-muted-foreground max-w-md">
                    You need to clock in before you can access the system. Please clock in to start your work day.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="gap-2"
                  onClick={() => clockInMutation.mutate()}
                  disabled={clockInMutation.isPending}
                  data-testid="button-clock-in-required"
                >
                  <Clock className="h-5 w-5" />
                  {clockInMutation.isPending ? "Clocking in..." : "Clock In Now"}
                </Button>
              </div>
            ) : (
            <>
            {activeSection === "dashboard" && selectedOrg && (
              <Dashboard organizationId={selectedOrg.id} organizationName={selectedOrg.name} />
            )}

            {activeSection === "teller" && selectedOrg && (
              <TellerStation organizationId={selectedOrg.id} />
            )}

            {activeSection === "float-management" && selectedOrg && (
              <FloatManagement organizationId={selectedOrg.id} />
            )}

            {activeSection === "teller-services" && selectedOrg && (
              <TellerServices organizationId={selectedOrg.id} />
            )}

            {activeSection === "settings" && selectedOrg && (
              <SettingsPage organizationId={selectedOrg.id} isOwner={memberships?.find(m => m.organizationId === selectedOrg.id)?.isOwner ?? false} />
            )}

            {activeSection === "upgrade" && selectedOrg && (
              <UpgradePage organizationId={selectedOrg.id} />
            )}

            {activeSection === "branches" && selectedOrg && (
              <BranchManagement organizationId={selectedOrg.id} />
            )}

            {activeSection === "staff" && selectedOrg && (
              <StaffManagement organizationId={selectedOrg.id} />
            )}

            {activeSection === "members" && selectedOrg && (
              <MemberManagement
                organizationId={selectedOrg.id}
                prefillContact={crmPrefill}
                onPrefillConsumed={() => setCrmPrefill(null)}
              />
            )}

            {activeSection === "loan-products" && selectedOrg && (
              <LoanProducts organizationId={selectedOrg.id} />
            )}

            {activeSection === "loans" && selectedOrg && (
              <LoanApplications organizationId={selectedOrg.id} />
            )}

            {activeSection === "transactions" && selectedOrg && (
              <Transactions organizationId={selectedOrg.id} />
            )}

            {activeSection === "repayments" && selectedOrg && (
              <Repayments organizationId={selectedOrg.id} />
            )}

            {activeSection === "fixed-deposits" && selectedOrg && (
              <FixedDeposits organizationId={selectedOrg.id} />
            )}

            {activeSection === "chart-of-accounts" && selectedOrg && (
              <ChartOfAccounts organizationId={selectedOrg.id} />
            )}

            {activeSection === "journal-entries" && selectedOrg && (
              <JournalEntries organizationId={selectedOrg.id} />
            )}

            {activeSection === "opening-balances" && selectedOrg && (
              <OpeningBalances organizationId={selectedOrg.id} />
            )}

            {activeSection === "dividends" && selectedOrg && (
              <Dividends organizationId={selectedOrg.id} />
            )}

            {activeSection === "reports" && selectedOrg && (
              <Reports organizationId={selectedOrg.id} />
            )}

            {activeSection === "analytics" && selectedOrg && (
              <AnalyticsDashboard organizationId={selectedOrg.id} />
            )}

            {activeSection === "sms" && selectedOrg && (
              <SMSNotifications organizationId={selectedOrg.id} />
            )}

            {activeSection === "defaults" && selectedOrg && (
              <DefaultsCollections organizationId={selectedOrg.id} />
            )}

            {activeSection === "hr" && selectedOrg && (
              <HRManagement organizationId={selectedOrg.id} />
            )}

            {activeSection === "leaves" && selectedOrg && (
              <LeaveManagement organizationId={selectedOrg.id} />
            )}

            {activeSection === "expenses" && selectedOrg && (
              <ExpensesManagement organizationId={selectedOrg.id} />
            )}

            {activeSection === "audit" && selectedOrg && (
              <AuditLogs organizationId={selectedOrg.id} />
            )}

            {activeSection === "crm" && selectedOrg && (
              <CRMManagement
                organizationId={selectedOrg.id}
                onConvertToMember={(contact) => {
                  setCrmPrefill(contact);
                  setActiveSection("members");
                }}
              />
            )}

            {activeSection === "collateral" && selectedOrg && (
              <CollateralManagement organizationId={selectedOrg.id} />
            )}

            {activeSection === "my-account" && selectedOrg && (
              <MyAccountPage organizationId={selectedOrg.id} />
            )}
            </>
            )}
          </main>
        </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
