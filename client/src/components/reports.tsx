import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/hooks/use-currency";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  CreditCard,
  Users,
  Clock,
  DollarSign,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { FiltersBar } from "./reports/filters-bar";
import { SummaryTab } from "./reports/summary-tab";
import { LoansTab } from "./reports/loans-tab";
import { MembersTab } from "./reports/members-tab";
import { AgingTab } from "./reports/aging-tab";
import { PnlTab } from "./reports/pnl-tab";
import { StatementTab } from "./reports/statement-tab";

import type {
  Branch,
  Member,
  FinancialSummary,
  LoanReport,
  ProfitLoss,
  AgingReport,
  ReportFilters,
} from "./reports/types";

interface ReportsProps {
  organizationId: string;
}

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const fmt = (d: Date) => d.toISOString().split("T")[0];

export default function Reports({ organizationId }: ReportsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatAmount: formatCurrency } = useCurrency(organizationId);

  const [activeTab, setActiveTab] = useState("summary");
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: fmt(firstOfMonth),
    endDate: fmt(today),
    branchId: "all",
  });
  const [loanStatusFilter, setLoanStatusFilter] = useState("all");
  const [loanPage, setLoanPage] = useState(1);

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    if (filters.startDate) p.append("start_date", filters.startDate);
    if (filters.endDate) p.append("end_date", filters.endDate);
    if (filters.branchId && filters.branchId !== "all") p.append("branch_id", filters.branchId);
    if (extra) Object.entries(extra).forEach(([k, v]) => p.append(k, v));
    return p.toString();
  }, [filters]);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/organizations", organizationId, "branches"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/branches`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["/api/organizations", organizationId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/members`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "members",
  });

  const summaryParams = buildParams();
  const { data: summaryData, isLoading: summaryLoading } = useQuery<FinancialSummary>({
    queryKey: ["/api/organizations", organizationId, "reports", "financial-summary", summaryParams],
    queryFn: async () => {
      const res = await fetch(
        `/api/organizations/${organizationId}/reports/financial-summary?${summaryParams}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: activeTab === "summary",
  });

  const loanParams = buildParams({
    page: String(loanPage),
    page_size: "20",
    ...(loanStatusFilter !== "all" ? { status: loanStatusFilter } : {}),
  });
  const { data: loanData, isLoading: loanLoading } = useQuery<LoanReport>({
    queryKey: ["/api/organizations", organizationId, "reports", "loans", loanParams],
    queryFn: async () => {
      const res = await fetch(
        `/api/organizations/${organizationId}/reports/loans?${loanParams}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch loan report");
      return res.json();
    },
    enabled: activeTab === "loans",
  });

  const pnlParams = buildParams();
  const { data: pnlData, isLoading: pnlLoading } = useQuery<ProfitLoss>({
    queryKey: ["/api/organizations", organizationId, "reports", "profit-loss", pnlParams],
    queryFn: async () => {
      const res = await fetch(
        `/api/organizations/${organizationId}/reports/profit-loss?${pnlParams}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch P&L");
      return res.json();
    },
    enabled: activeTab === "pnl",
  });

  const { data: agingData, isLoading: agingLoading } = useQuery<AgingReport>({
    queryKey: ["/api/organizations", organizationId, "reports", "aging"],
    queryFn: async () => {
      const res = await fetch(
        `/api/organizations/${organizationId}/reports/aging`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch aging");
      return res.json();
    },
    enabled: activeTab === "aging",
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key.includes("reports");
      },
    });
    toast({ title: "Refreshed", description: "Report data has been refreshed." });
  };

  const handleExport = async (reportType: string) => {
    try {
      const exportParams = new URLSearchParams({ report_type: reportType });
      if (filters.startDate) exportParams.append("start_date", filters.startDate);
      if (filters.endDate) exportParams.append("end_date", filters.endDate);
      if (filters.branchId && filters.branchId !== "all") exportParams.append("branch_id", filters.branchId);
      if (reportType === "loans" && loanStatusFilter !== "all") exportParams.append("status", loanStatusFilter);
      const res = await fetch(
        `/api/organizations/${organizationId}/reports/export?${exportParams}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_report.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Exported", description: `${reportType} report downloaded.` });
    } catch {
      toast({ title: "Error", description: "Failed to export report.", variant: "destructive" });
    }
  };

  const handleStatusFilterChange = (status: string) => {
    setLoanStatusFilter(status);
    setLoanPage(1);
  };

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="reports-container">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground">Financial reports and analytics</p>
        </div>
      </div>

      <FiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        branches={branches}
        onRefresh={handleRefresh}
        onExport={handleExport}
        activeTab={activeTab}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="summary" className="gap-1" data-testid="tab-summary">
            <BarChart3 className="h-4 w-4" /> Summary
          </TabsTrigger>
          <TabsTrigger value="loans" className="gap-1" data-testid="tab-loans">
            <CreditCard className="h-4 w-4" /> Loans
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1" data-testid="tab-members">
            <Users className="h-4 w-4" /> Members
          </TabsTrigger>
          <TabsTrigger value="aging" className="gap-1" data-testid="tab-aging">
            <Clock className="h-4 w-4" /> Aging
          </TabsTrigger>
          <TabsTrigger value="pnl" className="gap-1" data-testid="tab-pnl">
            <DollarSign className="h-4 w-4" /> P&L
          </TabsTrigger>
          <TabsTrigger value="statement" className="gap-1" data-testid="tab-statement">
            <FileText className="h-4 w-4" /> Statement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <SummaryTab
            data={summaryData}
            isLoading={summaryLoading}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="loans">
          <LoansTab
            data={loanData}
            isLoading={loanLoading}
            formatCurrency={formatCurrency}
            statusFilter={loanStatusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            page={loanPage}
            onPageChange={setLoanPage}
          />
        </TabsContent>

        <TabsContent value="members">
          <MembersTab
            members={members}
            branches={branches}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="aging">
          <AgingTab
            data={agingData}
            isLoading={agingLoading}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="pnl">
          <PnlTab
            data={pnlData}
            isLoading={pnlLoading}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="statement">
          <StatementTab
            organizationId={organizationId}
            startDate={filters.startDate}
            endDate={filters.endDate}
            formatCurrency={formatCurrency}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
