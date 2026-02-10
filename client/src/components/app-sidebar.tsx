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
  const { hasFeature, isLoading } = useFeatures(organizationId);
  
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
      <SidebarFooter className="border-t border-sidebar-border p-2">
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
