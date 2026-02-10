import { useQuery, useQueryClient } from "@tanstack/react-query";

interface PermissionsData {
  role: string | null;
  permissions: string[];
  working_hours_allowed: boolean;
  working_hours_message: string;
}

export function usePermissions(organizationId: string | null, options?: { deferToSession?: boolean }) {
  const queryClient = useQueryClient();
  const deferToSession = options?.deferToSession ?? false;

  const hasSessionData = deferToSession
    ? !!queryClient.getQueryData(["/api/auth/permissions", organizationId])
    : true;

  const { data, isLoading } = useQuery<PermissionsData>({
    queryKey: ["/api/auth/permissions", organizationId],
    queryFn: async () => {
      if (!organizationId) return { role: null, permissions: [], working_hours_allowed: true, working_hours_message: "" };
      const res = await fetch(`/api/auth/permissions/${organizationId}`, { credentials: "include" });
      if (!res.ok) return { role: null, permissions: [], working_hours_allowed: true, working_hours_message: "" };
      return res.json();
    },
    enabled: !!organizationId && (!deferToSession || hasSessionData),
    refetchInterval: deferToSession ? undefined : 60000,
    refetchIntervalInBackground: deferToSession ? false : true,
    staleTime: deferToSession ? 1000 * 60 * 5 : 0,
    gcTime: deferToSession ? 1000 * 60 * 10 : undefined,
  });

  const hasPermission = (permission: string): boolean => {
    if (!data) return false;
    if (data.permissions.includes("*")) return true;
    if (data.permissions.includes(permission)) return true;
    
    const resource = permission.split(":")[0];
    if (data.permissions.includes(`${resource}:*`)) return true;
    
    return false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(p => hasPermission(p));
  };

  const hasRole = (roles: string[]): boolean => {
    if (!data?.role) return false;
    return roles.includes(data.role);
  };

  return {
    role: data?.role || null,
    permissions: data?.permissions || [],
    isLoading: deferToSession ? (isLoading && !hasSessionData) : isLoading,
    hasPermission,
    hasAnyPermission,
    hasRole,
    isAdmin: data?.role === "admin" || data?.role === "owner",
    workingHoursAllowed: data?.working_hours_allowed ?? true,
    workingHoursMessage: data?.working_hours_message || "",
  };
}
