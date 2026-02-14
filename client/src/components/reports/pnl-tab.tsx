import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfitLoss } from "./types";
import { formatDate } from "./types";

interface PnlTabProps {
  data: ProfitLoss | undefined;
  isLoading: boolean;
  formatCurrency: (amount: number) => string;
}

export function PnlTab({ data, isLoading, formatCurrency }: PnlTabProps) {
  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profit & Loss Statement</CardTitle>
        <CardDescription>
          Period: {formatDate(data?.period?.start_date || null)} - {formatDate(data?.period?.end_date || null)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-lg mb-3 text-green-600">Income</h4>
            <div className="space-y-2 pl-4">
              <LineItem label="Interest Income" value={formatCurrency(data?.income?.interest_income || 0)} />
              <LineItem label="Penalty Income" value={formatCurrency(data?.income?.penalty_income || 0)} />
              <LineItem label="Processing Fees" value={formatCurrency(data?.income?.processing_fees || 0)} />
              <LineItem label="Insurance Fees" value={formatCurrency(data?.income?.insurance_fees || 0)} />
              <LineItem label="Extra Charges" value={formatCurrency(data?.income?.extra_charges || 0)} />
              <div className="flex justify-between py-2 bg-green-50 dark:bg-green-900/20 px-2 rounded font-semibold">
                <span>Total Income</span>
                <span className="text-green-600">{formatCurrency(data?.income?.total_income || 0)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-3 text-red-600">Expenses</h4>
            <div className="space-y-2 pl-4">
              {data?.expenses?.categories && Object.entries(data.expenses.categories).map(([name, amount]) => (
                <LineItem key={name} label={name} value={formatCurrency(amount)} />
              ))}
              {(!data?.expenses?.categories || Object.keys(data.expenses.categories).length === 0) && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">No approved expenses in this period</span>
                  <span className="font-medium">{formatCurrency(0)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 bg-red-50 dark:bg-red-900/20 px-2 rounded font-semibold">
                <span>Total Expenses</span>
                <span className="text-red-600">{formatCurrency(data?.expenses?.total_expenses || 0)}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t-2">
            <div className="flex justify-between py-3 bg-primary/10 px-4 rounded-lg">
              <span className="text-lg font-bold">Net Profit</span>
              <span className={`text-xl font-bold ${(data?.net_profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(data?.net_profit || 0)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
