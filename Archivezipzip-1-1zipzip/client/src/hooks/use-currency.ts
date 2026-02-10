import { useQuery } from "@tanstack/react-query";
import { getCurrencySymbol, formatCurrency as formatCurrencyUtil } from "@/lib/currency";

interface Setting {
  setting_key: string;
  setting_value: string;
}

export function useCurrency(organizationId: string) {
  const { data: settingsData } = useQuery<Setting[]>({
    queryKey: ["/api/organizations", organizationId, "settings"],
    enabled: !!organizationId,
  });

  const currency = settingsData?.find(s => s.setting_key === "currency")?.setting_value || "KES";
  const symbol = getCurrencySymbol(currency);

  const formatAmount = (amount: number | string) => {
    return formatCurrencyUtil(amount, currency);
  };

  return { currency, symbol, formatAmount };
}
