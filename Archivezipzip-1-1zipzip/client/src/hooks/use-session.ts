import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeatureAccess } from "./use-features";

interface PermissionsData {
  role: string | null;
  permissions: string[];
  working_hours_allowed: boolean;
  working_hours_message: string;
}

interface SessionBundle {
  user: any;
  permissions: PermissionsData;
  features: FeatureAccess;
}

export function useSession(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SessionBundle>({
    queryKey: ["/api/auth/session", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("No organization ID");
      const res = await fetch(`/api/auth/session/${organizationId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load session");
      const bundle = await res.json();

      queryClient.setQueryData(
        ["/api/auth/permissions", organizationId],
        bundle.permissions
      );
      queryClient.setQueryData(
        ["/api/organizations", organizationId, "features"],
        bundle.features
      );

      return bundle;
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 1,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
  });

  return {
    session: data,
    isLoading,
    isReady: !isLoading && !!data,
  };
}
