import { usePermissions } from "./use-permissions";

export function useResourcePermissions(
  organizationId: string | null,
  resource: string
) {
  const permissions = usePermissions(organizationId);

  const canRead = permissions.hasPermission(`${resource}:read`);
  const canWrite = permissions.hasPermission(`${resource}:write`);

  return {
    ...permissions,
    canRead,
    canWrite,
    resource,
  };
}

export const RESOURCES = {
  DASHBOARD: "dashboard",
  TELLER_STATION: "teller_station",
  FLOAT_MANAGEMENT: "float_management",
  BRANCHES: "branches",
  STAFF: "staff",
  MEMBERS: "members",
  LOAN_PRODUCTS: "loan_products",
  LOANS: "loans",
  REPAYMENTS: "repayments",
  GUARANTORS: "guarantors",
  TRANSACTIONS: "transactions",
  FIXED_DEPOSITS: "fixed_deposits",
  DIVIDENDS: "dividends",
  CHART_OF_ACCOUNTS: "chart_of_accounts",
  JOURNAL_ENTRIES: "journal_entries",
  DEFAULTS: "defaults",
  RESTRUCTURE: "restructure",
  SMS: "sms",
  REPORTS: "reports",
  ANALYTICS: "analytics",
  AUDIT: "audit",
  HR: "hr",
  LEAVE: "leave",
  EXPENSES: "expenses",
  SETTINGS: "settings",
  ROLES: "roles",
  CRM: "crm",
  COLLATERAL: "collateral",
} as const;
