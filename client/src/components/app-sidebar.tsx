import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Building2,
  CreditCard,
  FileText,
  Landmark,
  Settings,
  Percent,
  User,
  Wallet,
  PiggyBank,
  BarChart3,
  Receipt,
  CalendarDays,
  BookOpen,
  ClipboardList,
  Crown,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatures, FEATURES } from "@/hooks/use-features";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

interface OrganizationMembership {
  organizationId: string;
  organization: { id: string; name: string };
}

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string;
}

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Members",
    url: "/members",
    icon: Users,
    feature: FEATURES.MEMBERS,
  },
  {
    title: "Staff",
    url: "/staff",
    icon: UserCog,
  },
  {
    title: "Branches",
    url: "/branches",
    icon: Building2,
  },
];

const loanNavItems: NavItem[] = [
  {
    title: "Loan Products",
    url: "/loan-products",
    icon: CreditCard,
    feature: FEATURES.LOANS,
  },
  {
    title: "Loan Applications",
    url: "/loans",
    icon: FileText,
    feature: FEATURES.LOANS,
  },
];

const financeNavItems: NavItem[] = [
  {
    title: "Teller Station",
    url: "/teller",
    icon: Wallet,
    feature: FEATURES.TELLER_STATION,
  },
  {
    title: "Float Management",
    url: "/float-management",
    icon: PiggyBank,
    feature: FEATURES.FLOAT_MANAGEMENT,
  },
  {
    title: "Fixed Deposits",
    url: "/fixed-deposits",
    icon: Landmark,
    feature: FEATURES.FIXED_DEPOSITS,
  },
  {
    title: "Dividends",
    url: "/dividends",
    icon: Percent,
    feature: FEATURES.DIVIDENDS,
  },
  {
    title: "Expenses",
    url: "/expenses",
    icon: Receipt,
    feature: FEATURES.EXPENSES,
  },
  {
    title: "Accounting",
    url: "/accounting",
    icon: BookOpen,
    feature: FEATURES.ACCOUNTING,
  },
];

const operationsNavItems: NavItem[] = [
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    feature: FEATURES.ANALYTICS,
  },
  {
    title: "Leave Management",
    url: "/leave",
    icon: CalendarDays,
    feature: FEATURES.LEAVE_MANAGEMENT,
  },
  {
    title: "Audit Logs",
    url: "/audit-logs",
    icon: ClipboardList,
    feature: FEATURES.AUDIT_LOGS,
  },
];

const systemNavItems: NavItem[] = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  
  const { data: memberships } = useQuery<OrganizationMembership[]>({
    queryKey: ["/api/organizations/my"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/my", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
  });
  
  const organizationId = memberships?.[0]?.organizationId;
  const { hasFeature, isLoading, subscriptionStatus, plan, isTrial, isExpired, trialDaysRemaining } = useFeatures(organizationId);
  
  const filterNavItems = (items: NavItem[]) => {
    if (isLoading) return items;
    return items.filter(item => !item.feature || hasFeature(item.feature));
  };
  
  const filteredMainNav = filterNavItems(mainNavItems);
  const filteredLoanNav = filterNavItems(loanNavItems);
  const filteredFinanceNav = filterNavItems(financeNavItems);
  const filteredOperationsNav = filterNavItems(operationsNavItems);
  const filteredSystemNav = filterNavItems(systemNavItems);
  
  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Landmark className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-sidebar-foreground">BANKY</span>
            <span className="text-xs text-sidebar-foreground/60">Management System</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {filteredLoanNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Loans</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredLoanNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
        {filteredFinanceNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Finance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredFinanceNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
        {filteredOperationsNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredOperationsNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSystemNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2 space-y-1">
        {subscriptionStatus && (
          <Link href="/upgrade">
            <div className={`rounded-md px-3 py-2 text-xs cursor-pointer transition-colors ${
              isExpired 
                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/50'
                : isTrial 
                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                  : 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/50'
            }`}>
              <div className="flex items-center gap-1.5">
                {isExpired ? (
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                ) : isTrial ? (
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                ) : (
                  <Crown className="h-3.5 w-3.5 flex-shrink-0" />
                )}
                <span className="font-medium capitalize">{plan} Plan</span>
              </div>
              <p className="mt-0.5 leading-tight">
                {isExpired 
                  ? 'Subscription expired - Upgrade now'
                  : isTrial 
                    ? `Trial: ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} remaining`
                    : subscriptionStatus.status === 'active' 
                      ? 'Active subscription'
                      : 'View plans'}
              </p>
            </div>
          </Link>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location === "/my-account"}>
              <Link href="/my-account" data-testid="nav-my-account">
                <User className="h-4 w-4" />
                <span>My Account</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
