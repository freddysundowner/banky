import { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

interface PermissionGuardProps {
  children: ReactNode;
  permission: string;
  organizationId: string | null;
  fallback?: ReactNode;
}

export function PermissionGuard({
  children,
  permission,
  organizationId,
  fallback = null,
}: PermissionGuardProps) {
  const { hasPermission, isLoading } = usePermissions(organizationId);

  if (isLoading) return null;
  if (!hasPermission(permission)) return <>{fallback}</>;

  return <>{children}</>;
}

interface WriteGuardProps {
  children: ReactNode;
  resource: string;
  organizationId: string | null;
  fallback?: ReactNode;
}

export function WriteGuard({
  children,
  resource,
  organizationId,
  fallback = null,
}: WriteGuardProps) {
  return (
    <PermissionGuard
      permission={`${resource}:write`}
      organizationId={organizationId}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  );
}

interface ReadGuardProps {
  children: ReactNode;
  resource: string;
  organizationId: string | null;
  fallback?: ReactNode;
}

export function ReadGuard({
  children,
  resource,
  organizationId,
  fallback = null,
}: ReadGuardProps) {
  return (
    <PermissionGuard
      permission={`${resource}:read`}
      organizationId={organizationId}
      fallback={fallback}
    >
      {children}
    </PermissionGuard>
  );
}
