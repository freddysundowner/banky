import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface RefreshButtonProps {
  organizationId: string;
}

export function RefreshButton({ organizationId }: RefreshButtonProps) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (Array.isArray(key) && key[0] === "/api/organizations" && key[1] === organizationId) {
          return true;
        }
        return false;
      },
    });
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isRefreshing}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
      Refresh
    </Button>
  );
}
