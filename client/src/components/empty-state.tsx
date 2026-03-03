import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 ${
        compact ? "py-8" : "py-14"
      }`}
      data-testid="empty-state"
    >
      <div className={`rounded-full bg-muted flex items-center justify-center mb-4 ${compact ? "p-3" : "p-5"}`}>
        <Icon className={`text-muted-foreground/60 ${compact ? "h-5 w-5" : "h-8 w-8"}`} />
      </div>
      <h3 className={`font-semibold mb-1 ${compact ? "text-sm" : "text-base"}`}>{title}</h3>
      <p className={`text-muted-foreground max-w-sm mb-5 ${compact ? "text-xs" : "text-sm"}`}>{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="flex items-center gap-3">
          {actionLabel && onAction && (
            <Button size={compact ? "sm" : "default"} onClick={onAction} data-testid="button-empty-action">
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button size={compact ? "sm" : "default"} variant="outline" onClick={onSecondary} data-testid="button-empty-secondary">
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
