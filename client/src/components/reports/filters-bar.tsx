import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Download } from "lucide-react";
import type { Branch, ReportFilters } from "./types";

interface FiltersBarProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  branches: Branch[];
  onRefresh: () => void;
  onExport: (reportType: string) => void;
  activeTab: string;
}

const TAB_TO_EXPORT: Record<string, string> = {
  summary: "summary",
  loans: "loans",
  members: "members",
  aging: "aging",
  pnl: "pnl",
};

export function FiltersBar({
  filters,
  onFiltersChange,
  branches,
  onRefresh,
  onExport,
  activeTab,
}: FiltersBarProps) {
  const exportType = TAB_TO_EXPORT[activeTab];

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="start-date" className="text-xs">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
              className="w-40"
              data-testid="input-start-date"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="end-date" className="text-xs">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
              className="w-40"
              data-testid="input-end-date"
            />
          </div>
          {branches.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Branch</Label>
              <Select
                value={filters.branchId}
                onValueChange={(v) => onFiltersChange({ ...filters, branchId: v })}
              >
                <SelectTrigger className="w-44" data-testid="select-branch-filter">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" onClick={onRefresh} data-testid="button-refresh-reports">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {exportType && (
            <Button
              variant="outline"
              onClick={() => onExport(exportType)}
              data-testid="button-export-reports"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
