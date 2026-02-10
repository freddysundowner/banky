import { Badge } from "@/components/ui/badge";

type StatusType = "success" | "warning" | "error" | "info" | "default";

interface StatusBadgeProps {
  status: string;
  type?: StatusType;
}

const statusConfig: Record<string, { label: string; type: StatusType }> = {
  active: { label: "Active", type: "success" },
  inactive: { label: "Inactive", type: "default" },
  suspended: { label: "Suspended", type: "error" },
  pending: { label: "Pending", type: "warning" },
  under_review: { label: "Under Review", type: "info" },
  approved: { label: "Approved", type: "success" },
  rejected: { label: "Rejected", type: "error" },
  disbursed: { label: "Disbursed", type: "info" },
  completed: { label: "Completed", type: "success" },
  defaulted: { label: "Defaulted", type: "error" },
};

const typeStyles: Record<StatusType, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, type: type || "default" };
  const styles = typeStyles[config.type];

  return (
    <Badge variant="outline" className={`${styles} border-0 font-medium`}>
      {config.label}
    </Badge>
  );
}
