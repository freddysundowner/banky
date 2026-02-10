import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface SubscriptionStatus {
  status: string;
  is_active: boolean;
  is_trial: boolean;
  trial_days_remaining: number;
  trial_ends_at: string | null;
  is_expired: boolean;
  message: string | null;
}

export interface FeatureAccess {
  mode: "saas" | "enterprise";
  plan_or_edition: string;
  features: string[];
  limits: {
    max_members: number | null;
    max_staff: number | null;
    max_branches: number | null;
    sms_monthly: number | null;
  };
  subscription_status?: SubscriptionStatus;
}

export const FEATURES = {
  CORE_BANKING: "core_banking",
  MEMBERS: "members",
  SAVINGS: "savings",
  SHARES: "shares",
  LOANS: "loans",
  TELLER_STATION: "teller_station",
  FLOAT_MANAGEMENT: "float_management",
  FIXED_DEPOSITS: "fixed_deposits",
  DIVIDENDS: "dividends",
  ANALYTICS: "analytics",
  ANALYTICS_EXPORT: "analytics_export",
  SMS_NOTIFICATIONS: "sms_notifications",
  BULK_SMS: "bulk_sms",
  EXPENSES: "expenses",
  LEAVE_MANAGEMENT: "leave_management",
  PAYROLL: "payroll",
  ACCOUNTING: "accounting",
  AUDIT_LOGS: "audit_logs",
  MULTIPLE_BRANCHES: "multiple_branches",
  API_ACCESS: "api_access",
  WHITE_LABEL: "white_label",
  CUSTOM_REPORTS: "custom_reports",
  MPESA_INTEGRATION: "mpesa_integration",
  BANK_INTEGRATION: "bank_integration",
} as const;

export function useFeatures(organizationId: string | undefined, options?: { deferToSession?: boolean }) {
  const queryClient = useQueryClient();
  const deferToSession = options?.deferToSession ?? false;

  const hasSessionData = deferToSession
    ? !!queryClient.getQueryData(["/api/organizations", organizationId, "features"])
    : true;

  const { data, isLoading, error } = useQuery<FeatureAccess>({
    queryKey: ["/api/organizations", organizationId, "features"],
    queryFn: async () => {
      if (!organizationId) throw new Error("No organization ID");
      const res = await fetch(`/api/organizations/${organizationId}/features`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load features");
      return res.json();
    },
    enabled: !!organizationId && (!deferToSession || hasSessionData),
    staleTime: 5 * 60 * 1000,
  });

  const hasFeature = (feature: string): boolean => {
    if (!data) return false;
    return data.features.includes(feature);
  };

  const checkLimit = (limitName: keyof FeatureAccess["limits"], currentValue: number): boolean => {
    if (!data) return true;
    const limit = data.limits[limitName];
    if (limit === null) return true;
    return currentValue < limit;
  };

  return {
    featureAccess: data,
    isLoading: deferToSession ? (isLoading && !hasSessionData) : isLoading,
    error,
    hasFeature,
    checkLimit,
    plan: data?.plan_or_edition || "starter",
    mode: data?.mode || "saas",
    subscriptionStatus: data?.subscription_status,
    isExpired: data?.subscription_status?.is_expired || false,
    isTrial: data?.subscription_status?.is_trial || false,
    trialDaysRemaining: data?.subscription_status?.trial_days_remaining || 0,
    trialMessage: data?.subscription_status?.message || null,
  };
}
