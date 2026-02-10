import { AlertTriangle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TrialBannerProps {
  isExpired: boolean;
  isTrial: boolean;
  trialDaysRemaining: number;
  message: string | null;
  onUpgrade?: () => void;
}

export function TrialBanner({ 
  isExpired, 
  isTrial, 
  trialDaysRemaining, 
  message,
  onUpgrade 
}: TrialBannerProps) {
  if (!message && !isExpired && !(isTrial && trialDaysRemaining <= 7)) {
    return null;
  }

  if (isExpired) {
    return (
      <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            {message || "Your subscription has expired. Please upgrade to continue using the platform."}
          </span>
        </div>
        {onUpgrade && (
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onUpgrade}
            className="bg-white text-red-600 hover:bg-red-50"
          >
            Upgrade Now
          </Button>
        )}
      </div>
    );
  }

  if (isTrial && trialDaysRemaining <= 3) {
    return (
      <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            {message || `Your trial expires in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''}. Upgrade now to avoid interruption.`}
          </span>
        </div>
        {onUpgrade && (
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onUpgrade}
            className="bg-white text-amber-600 hover:bg-amber-50"
          >
            Upgrade Now
          </Button>
        )}
      </div>
    );
  }

  if (isTrial && trialDaysRemaining <= 7) {
    return (
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            You're on a trial. {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining.
          </span>
        </div>
        {onUpgrade && (
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onUpgrade}
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            View Plans
          </Button>
        )}
      </div>
    );
  }

  return null;
}
