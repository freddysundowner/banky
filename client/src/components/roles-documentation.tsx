import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, Search, Shield, Users, Eye, CheckCircle, XCircle, Banknote, FileText, Calculator, Landmark, Clock, HandCoins, BarChart3, Settings, UserCog, CreditCard, ClipboardList } from "lucide-react";

interface RolesDocumentationProps {
  onBack: () => void;
}

const SYSTEM_ROLES = [
  {
    name: "admin",
    description: "Full access to all features and settings. This role has unrestricted access to every part of the system.",
    icon: Shield,
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    capabilities: [
      "Complete access to all modules and features",
      "Manage staff, branches, and organization settings",
      "Create and manage roles and permissions",
      "View all reports and analytics",
      "Perform all financial operations",
    ],
    permissions: ["* (all permissions)"],
  },
  {
    name: "manager",
    description: "Branch and department management with full loan lifecycle control. Ideal for branch managers or department heads.",
    icon: Users,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    capabilities: [
      "View dashboard and manage branches",
      "View and manage members and view staff",
      "Full loan lifecycle: create, approve, reject, and disburse loans",
      "Manage repayments and guarantors",
      "Handle transactions, deposits, and withdrawals",
      "Manage defaults and loan restructuring",
      "Send SMS notifications",
      "View reports and analytics",
      "Manage float allocation and approve shortage requests",
      "View salary deductions",
    ],
    cannotDo: [
      "Cannot manage staff records",
      "Cannot manage organization settings or roles",
      "Cannot access HR, leave, or expense management",
      "Cannot manage chart of accounts or journal entries",
    ],
    permissions: [
      "dashboard:read", "branches:read", "branches:write",
      "members:read", "members:write", "staff:read",
      "loan_products:read", "loans:read", "loans:write", "loans:process", "loans:approve", "loans:reject",
      "repayments:read", "repayments:write", "guarantors:read", "guarantors:write",
      "transactions:read", "transactions:write", "defaults:read", "defaults:write",
      "restructure:read", "restructure:write", "sms:read", "sms:write",
      "reports:read", "analytics:read",
      "float_management:read", "float_management:write", "shortage_approval:write",
      "salary_deductions:read",
    ],
  },
  {
    name: "loan_officer",
    description: "Handles loan applications and member management. Can create and disburse loans but cannot approve or reject them.",
    icon: Banknote,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    capabilities: [
      "Create and manage loan applications",
      "Disburse approved loans (M-Pesa, bank, cash)",
      "View and manage members",
      "Process transactions",
      "View repayments",
      "Manage loan products",
      "Handle loan restructuring",
    ],
    cannotDo: [
      "Cannot approve loan applications",
      "Cannot reject loan applications",
      "Cannot access reports, analytics, or dashboard",
      "Cannot manage branches or staff",
      "Cannot manage float or teller station",
    ],
    permissions: [
      "loans:read", "loans:write", "loans:process",
      "members:read", "members:write",
      "transactions:read", "transactions:write",
      "repayments:read", "loan_products:read", "loan_products:write",
      "restructure:read", "restructure:write",
    ],
  },
  {
    name: "teller",
    description: "Handles day-to-day transactions at the counter. Focused on deposits, withdrawals, and loan repayments.",
    icon: CreditCard,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    capabilities: [
      "Access teller station for deposits, withdrawals, and repayments",
      "View member information",
      "Process loan repayments",
      "Record transactions",
    ],
    cannotDo: [
      "Cannot create or manage loan applications",
      "Cannot approve or reject loans",
      "Cannot manage members, staff, or branches",
      "Cannot access reports or analytics",
    ],
    permissions: [
      "teller_station:read", "teller_station:write",
      "members:read",
      "repayments:read", "repayments:write",
      "transactions:read", "transactions:write",
    ],
  },
  {
    name: "reviewer",
    description: "Reviews and decides on loan applications. Can approve or reject but cannot create or disburse loans.",
    icon: FileText,
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    capabilities: [
      "Review loan applications",
      "Approve loan applications",
      "Reject loan applications with reasons",
      "View member details and guarantor information",
      "View repayment history and defaults",
      "Access reports and analytics for informed decisions",
    ],
    cannotDo: [
      "Cannot create loan applications",
      "Cannot disburse loans",
      "Cannot process transactions",
      "Cannot manage members or staff",
    ],
    permissions: [
      "branches:read", "members:read", "staff:read", "loan_products:read",
      "loans:read", "loans:approve", "loans:reject",
      "repayments:read", "guarantors:read",
      "defaults:read", "restructure:read",
      "reports:read", "analytics:read",
    ],
  },
  {
    name: "accountant",
    description: "Manages financial records and transactions. Focused on accounting, reports, and reconciliation.",
    icon: Calculator,
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    capabilities: [
      "View and process transactions",
      "Manage repayments",
      "Handle defaults and write-offs",
      "View member, staff, and loan information",
      "Access financial reports and analytics",
    ],
    cannotDo: [
      "Cannot create or manage loan applications",
      "Cannot approve or reject loans",
      "Cannot manage members or staff",
      "Cannot send SMS notifications",
      "Cannot manage float or teller station",
    ],
    permissions: [
      "branches:read", "members:read", "staff:read", "loan_products:read",
      "loans:read", "transactions:read", "transactions:write",
      "repayments:read", "repayments:write",
      "defaults:read", "defaults:write",
      "reports:read", "analytics:read",
    ],
  },
  {
    name: "auditor",
    description: "Read-only access across key modules for auditing and compliance purposes.",
    icon: Eye,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    capabilities: [
      "View branches, members, staff, and loan products",
      "View loan applications and repayments",
      "View transactions",
      "View defaults and restructuring records",
      "View reports and analytics",
      "View audit logs for complete traceability",
    ],
    cannotDo: [
      "Cannot create, edit, or delete any records",
      "Cannot approve or reject anything",
      "Cannot process transactions",
      "Cannot change settings",
    ],
    permissions: [
      "branches:read", "members:read", "staff:read", "loan_products:read",
      "loans:read", "transactions:read", "repayments:read",
      "defaults:read", "restructure:read",
      "reports:read", "analytics:read", "audit:read",
    ],
  },
  {
    name: "hr",
    description: "Human resources management including staff records, leave management, and salary deductions.",
    icon: UserCog,
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    capabilities: [
      "View branches and manage staff records",
      "Full HR management (performance reviews, records)",
      "Manage leave requests (view, create, approve)",
      "Manage salary deductions",
      "View analytics",
    ],
    cannotDo: [
      "Cannot access loan or transaction features",
      "Cannot view member financial data",
      "Cannot access reports or audit logs",
      "Cannot manage branches or settings",
    ],
    permissions: [
      "branches:read", "staff:read", "staff:write",
      "hr:read", "hr:write", "analytics:read",
      "leave:read", "leave:write", "leave:approve",
      "salary_deductions:read", "salary_deductions:write",
    ],
  },
  {
    name: "supervisor",
    description: "Team supervisor focused on oversight and leave management for their team.",
    icon: ClipboardList,
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    capabilities: [
      "View dashboard",
      "View branches and staff",
      "Manage and approve leave requests",
    ],
    cannotDo: [
      "Cannot access loan, transaction, or financial features",
      "Cannot manage members or staff records",
      "Cannot access reports or analytics",
      "Cannot manage organization settings",
    ],
    permissions: [
      "dashboard:read", "branches:read", "staff:read",
      "leave:read", "leave:write", "leave:approve",
    ],
  },
  {
    name: "staff",
    description: "Basic staff access with minimal read permissions. Suitable for general employees.",
    icon: Users,
    color: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
    capabilities: [
      "View branches and members",
      "View staff directory",
      "View loan products and loan applications",
      "Submit leave requests",
    ],
    cannotDo: [
      "Cannot create or manage loans",
      "Cannot process transactions",
      "Cannot manage members or staff",
      "Cannot access reports, analytics, or settings",
      "Cannot approve anything",
    ],
    permissions: [
      "branches:read", "members:read",
      "staff:read", "loan_products:read", "loans:read",
      "leave:read", "leave:write",
    ],
  },
  {
    name: "kiosk_operator",
    description: "Limited role for queue ticketing kiosk operations only.",
    icon: Clock,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    capabilities: [
      "Access the ticketing kiosk interface",
      "Manage queue display",
    ],
    cannotDo: [
      "Cannot access any other system features",
    ],
    permissions: [
      "ticketing:access", "ticketing:display",
    ],
  },
];

const PERMISSION_DOCS: Record<string, { label: string; description: string; icon: any }> = {
  "dashboard:read": { label: "Dashboard: View", description: "View the main dashboard with overview statistics", icon: BarChart3 },
  "branches:read": { label: "Branches: View", description: "View branch information and details", icon: Landmark },
  "branches:write": { label: "Branches: Manage", description: "Create, edit, and delete branches", icon: Landmark },
  "staff:read": { label: "Staff: View", description: "View staff member profiles and details", icon: Users },
  "staff:write": { label: "Staff: Manage", description: "Add, edit, and manage staff members", icon: Users },
  "members:read": { label: "Members: View", description: "View member profiles, balances, and history", icon: Users },
  "members:write": { label: "Members: Manage", description: "Register new members, edit member details", icon: Users },
  "members:activate": { label: "Members: Activate", description: "Activate member accounts", icon: CheckCircle },
  "members:suspend": { label: "Members: Suspend", description: "Suspend member accounts", icon: XCircle },
  "loan_products:read": { label: "Loan Products: View", description: "View loan product configurations", icon: FileText },
  "loan_products:write": { label: "Loan Products: Manage", description: "Create and configure loan products", icon: FileText },
  "loans:read": { label: "Loans: View", description: "View loan applications and their status", icon: Banknote },
  "loans:write": { label: "Loans: Create/Edit", description: "Create new loan applications and edit existing ones", icon: Banknote },
  "loans:process": { label: "Loans: Disburse", description: "Disburse approved loans via M-Pesa, cash, or cheque", icon: Banknote },
  "loans:approve": { label: "Loans: Approve", description: "Approve pending loan applications", icon: CheckCircle },
  "loans:reject": { label: "Loans: Reject", description: "Reject pending loan applications with a reason", icon: XCircle },
  "repayments:read": { label: "Repayments: View", description: "View loan repayment records and schedules", icon: HandCoins },
  "repayments:write": { label: "Repayments: Record", description: "Record loan repayment transactions", icon: HandCoins },
  "guarantors:read": { label: "Guarantors: View", description: "View loan guarantor information", icon: Users },
  "guarantors:write": { label: "Guarantors: Manage", description: "Add and manage loan guarantors", icon: Users },
  "transactions:read": { label: "Transactions: View", description: "View all financial transactions", icon: CreditCard },
  "transactions:write": { label: "Transactions: Process", description: "Create deposits, withdrawals, and transfers", icon: CreditCard },
  "fixed_deposits:read": { label: "Fixed Deposits: View", description: "View fixed deposit accounts and maturity details", icon: Landmark },
  "fixed_deposits:write": { label: "Fixed Deposits: Manage", description: "Create and manage fixed deposit accounts", icon: Landmark },
  "dividends:read": { label: "Dividends: View", description: "View dividend declarations and distributions", icon: HandCoins },
  "dividends:write": { label: "Dividends: Manage", description: "Declare and distribute dividends", icon: HandCoins },
  "chart_of_accounts:read": { label: "Chart of Accounts: View", description: "View the chart of accounts", icon: FileText },
  "chart_of_accounts:write": { label: "Chart of Accounts: Manage", description: "Create and edit accounts in the chart of accounts", icon: FileText },
  "journal_entries:read": { label: "Journal Entries: View", description: "View journal entries and general ledger", icon: FileText },
  "journal_entries:write": { label: "Journal Entries: Create", description: "Create manual journal entries", icon: FileText },
  "teller_station:read": { label: "Teller Station: View", description: "View teller station interface", icon: CreditCard },
  "teller_station:write": { label: "Teller Station: Operate", description: "Process deposits, withdrawals, and repayments at the counter", icon: CreditCard },
  "float_management:read": { label: "Float Management: View", description: "View cash float allocations and vault balance", icon: Landmark },
  "float_management:write": { label: "Float Management: Manage", description: "Allocate floats, manage vault cash, handle replenishment", icon: Landmark },
  "shortage_approval:write": { label: "Shortage Approval", description: "Approve or reject cash shortage reports from tellers", icon: CheckCircle },
  "defaults:read": { label: "Defaults: View", description: "View overdue loans and default reports", icon: XCircle },
  "defaults:write": { label: "Defaults: Manage", description: "Manage loan defaults and collections", icon: XCircle },
  "restructure:read": { label: "Restructure: View", description: "View loan restructuring records", icon: FileText },
  "restructure:write": { label: "Restructure: Manage", description: "Restructure loans (extend terms, adjust rates)", icon: FileText },
  "sms:read": { label: "SMS: View", description: "View SMS logs and templates", icon: FileText },
  "sms:write": { label: "SMS: Send", description: "Send SMS notifications to members", icon: FileText },
  "reports:read": { label: "Reports: View", description: "Access financial reports (Trial Balance, Income Statement, Balance Sheet)", icon: BarChart3 },
  "analytics:read": { label: "Analytics: View", description: "Access performance analytics and dashboards", icon: BarChart3 },
  "audit:read": { label: "Audit Logs: View", description: "View audit trail of all system actions", icon: Eye },
  "hr:read": { label: "HR: View", description: "View HR records and staff performance", icon: UserCog },
  "hr:write": { label: "HR: Manage", description: "Manage staff HR records and performance reviews", icon: UserCog },
  "leave:read": { label: "Leave: View", description: "View leave requests and balances", icon: Clock },
  "leave:write": { label: "Leave: Request", description: "Submit leave requests", icon: Clock },
  "leave:approve": { label: "Leave: Approve", description: "Approve or reject staff leave requests", icon: CheckCircle },
  "expenses:read": { label: "Expenses: View", description: "View expense records", icon: CreditCard },
  "expenses:write": { label: "Expenses: Create", description: "Create and submit expense records", icon: CreditCard },
  "expenses:approve": { label: "Expenses: Approve", description: "Approve or reject expense requests", icon: CheckCircle },
  "settings:read": { label: "Settings: View", description: "View organization settings", icon: Settings },
  "settings:write": { label: "Settings: Manage", description: "Change organization settings and configuration", icon: Settings },
  "roles:read": { label: "Roles: View", description: "View roles and their permissions", icon: Shield },
  "roles:write": { label: "Roles: Manage", description: "Create, edit, and delete roles", icon: Shield },
  "salary_deductions:read": { label: "Salary Deductions: View", description: "View salary deduction configurations", icon: HandCoins },
  "salary_deductions:write": { label: "Salary Deductions: Manage", description: "Create and manage salary deductions", icon: HandCoins },
  "ticketing:access": { label: "Ticketing: Access", description: "Access the queue ticketing kiosk", icon: Clock },
  "ticketing:display": { label: "Ticketing: Display", description: "View the queue display screen", icon: Clock },
};

export default function RolesDocumentation({ onBack }: RolesDocumentationProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRoles = SYSTEM_ROLES.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.capabilities.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredPermissions = Object.entries(PERMISSION_DOCS).filter(([key, val]) =>
    key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    val.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    val.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const permissionGroups: Record<string, [string, typeof PERMISSION_DOCS[string]][]> = {};
  filteredPermissions.forEach(([key, val]) => {
    const group = key.split(":")[0].replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if (!permissionGroups[group]) permissionGroups[group] = [];
    permissionGroups[group].push([key, val]);
  });

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Roles & Permissions Guide</h1>
          <p className="text-muted-foreground">
            Understand what each role can do and how permissions work
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search roles or permissions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            How Roles & Permissions Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Each staff member is assigned a <span className="font-medium text-foreground">role</span> that determines what they can see and do in the system. Roles contain a set of <span className="font-medium text-foreground">permissions</span> that control access to specific features.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border p-3 space-y-1">
              <p className="font-medium text-foreground">System Roles</p>
              <p>Pre-configured roles that come with recommended permissions. You can customize their permissions but cannot delete them.</p>
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <p className="font-medium text-foreground">Custom Roles</p>
              <p>Create your own roles with specific permissions tailored to your organization's needs.</p>
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 border p-3 space-y-1">
            <p className="font-medium text-foreground">Separation of Duties</p>
            <p>For security, loan processing is split across roles. For example, a <span className="font-medium">Loan Officer</span> can create and disburse loans, while a <span className="font-medium">Reviewer</span> approves or rejects them. This ensures no single person controls the entire loan lifecycle.</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-4">System Roles ({filteredRoles.length})</h2>
        <div className="grid gap-4">
          {filteredRoles.map(role => {
            const Icon = role.icon;
            return (
              <Card key={role.name}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${role.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base capitalize">{role.name.replace(/_/g, " ")}</CardTitle>
                      <CardDescription>{role.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">What this role can do:</p>
                    <ul className="space-y-1">
                      {role.capabilities.map((cap, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          {cap}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {role.cannotDo && role.cannotDo.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Limitations:</p>
                      <ul className="space-y-1">
                        {role.cannotDo.map((cap, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                            {cap}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium mb-2">Permissions:</p>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.map(perm => (
                        <Badge key={perm} variant="outline" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">All Permissions Reference</h2>
        <Card>
          <CardContent className="pt-6">
            <Accordion type="multiple" className="w-full">
              {Object.entries(permissionGroups).map(([group, perms]) => (
                <AccordionItem key={group} value={group}>
                  <AccordionTrigger className="text-sm font-medium">
                    {group}
                    <Badge variant="secondary" className="ml-2">{perms.length}</Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {perms.map(([key, val]) => {
                        const PermIcon = val.icon;
                        return (
                          <div key={key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <PermIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{val.label}</p>
                              <p className="text-xs text-muted-foreground">{val.description}</p>
                              <Badge variant="outline" className="text-xs mt-1">{key}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
