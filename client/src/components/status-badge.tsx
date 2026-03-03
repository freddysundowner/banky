import { Badge } from "@/components/ui/badge";

type StatusType = "success" | "warning" | "error" | "info" | "default" | "muted";

interface StatusBadgeProps {
  status: string;
  type?: StatusType;
  className?: string;
}

export const statusConfig: Record<string, { label: string; type: StatusType }> = {
  active:         { label: "Active",         type: "success" },
  approved:       { label: "Approved",       type: "success" },
  completed:      { label: "Completed",      type: "success" },
  paid:           { label: "Paid",           type: "success" },
  paid_off:       { label: "Paid Off",       type: "success" },
  disbursed:      { label: "Disbursed",      type: "info" },
  under_review:   { label: "Under Review",   type: "info" },
  reviewed:       { label: "Reviewed",       type: "info" },
  processing:     { label: "Processing",     type: "info" },
  in_progress:    { label: "In Progress",    type: "info" },
  sent:           { label: "Sent",           type: "info" },
  pending:        { label: "Pending",        type: "warning" },
  late:           { label: "Late",           type: "warning" },
  overdue:        { label: "Overdue",        type: "warning" },
  partial:        { label: "Partial",        type: "warning" },
  on_hold:        { label: "On Hold",        type: "warning" },
  due_soon:       { label: "Due Soon",       type: "warning" },
  expiring:       { label: "Expiring",       type: "warning" },
  defaulted:      { label: "Defaulted",      type: "error" },
  rejected:       { label: "Rejected",       type: "error" },
  suspended:      { label: "Suspended",      type: "error" },
  failed:         { label: "Failed",         type: "error" },
  expired:        { label: "Expired",        type: "error" },
  overdue_review: { label: "Overdue Review", type: "error" },
  inactive:       { label: "Inactive",       type: "muted" },
  closed:         { label: "Closed",         type: "muted" },
  cancelled:      { label: "Cancelled",      type: "muted" },
  written_off:    { label: "Written Off",    type: "muted" },
  draft:          { label: "Draft",          type: "muted" },
  archived:       { label: "Archived",       type: "muted" },
  present:        { label: "Present",        type: "success" },
  absent:         { label: "Absent",         type: "error" },
  half_day:       { label: "Half Day",       type: "warning" },
  leave:          { label: "Leave",          type: "info" },
  excellent:      { label: "Excellent",      type: "success" },
  good:           { label: "Good",           type: "info" },
  average:        { label: "Average",        type: "warning" },
  poor:           { label: "Poor",           type: "error" },
  processed:      { label: "Processed",      type: "success" },
  matured:        { label: "Matured",        type: "success" },
  terminated:     { label: "Terminated",     type: "error" },
};

export const typeStyles: Record<StatusType, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  error:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  info:    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-300",
  muted:   "bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-500",
};

export function getStatusType(status: string): StatusType {
  return statusConfig[status]?.type ?? "default";
}

export function getStatusLabel(status: string): string {
  return statusConfig[status]?.label ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getStatusClass(status: string): string {
  const type = getStatusType(status);
  return typeStyles[type];
}

export function StatusBadge({ status, type, className = "" }: StatusBadgeProps) {
  const resolvedType = type ?? getStatusType(status);
  const styles = typeStyles[resolvedType];
  const label = getStatusLabel(status);

  return (
    <Badge variant="outline" className={`${styles} border-0 font-medium ${className}`}>
      {label}
    </Badge>
  );
}
