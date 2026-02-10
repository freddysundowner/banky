import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Search, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLogsProps {
  organizationId: string;
}

interface AuditLog {
  id: string;
  staff_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  staff?: {
    first_name: string;
    last_name: string;
  };
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface AuditSummary {
  total_actions: number;
  by_action: Record<string, number>;
  by_entity: Record<string, number>;
}

export default function AuditLogs({ organizationId }: AuditLogsProps) {
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      if (searchTerm !== debouncedSearch) {
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, isLoading, isError } = useQuery<AuditLogsResponse>({
    queryKey: ["/api/organizations", organizationId, "audit-logs", currentPage, filterAction, filterEntity, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });
      if (filterAction !== "all") params.append("action", filterAction);
      if (filterEntity !== "all") params.append("entity_type", filterEntity);
      if (debouncedSearch) params.append("search", debouncedSearch);
      
      const res = await fetch(`/api/organizations/${organizationId}/audit-logs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  const { data: summary } = useQuery<AuditSummary>({
    queryKey: ["/api/organizations", organizationId, "audit-logs", "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/audit-logs/summary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes("create") || actionLower.includes("deposit")) return "default";
    if (actionLower.includes("update") || actionLower.includes("edit")) return "secondary";
    if (actionLower.includes("delete") || actionLower.includes("remove") || actionLower.includes("suspend")) return "destructive";
    if (actionLower.includes("login") || actionLower.includes("logout")) return "outline";
    if (actionLower.includes("withdraw")) return "secondary";
    return "secondary";
  };

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, " ")
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Data is filtered server-side, no local filtering needed
  const filteredLogs = data?.logs;

  const uniqueActions = summary?.by_action ? Object.keys(summary.by_action) : [];
  const uniqueEntities = summary?.by_entity ? Object.keys(summary.by_entity) : [];

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-audit-title">Audit Logs</h1>
          <p className="text-muted-foreground">Track all system activities</p>
        </div>
        <RefreshButton organizationId={organizationId} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-actions">
              {data?.total || summary?.total_actions || 0}
            </div>
          </CardContent>
        </Card>
        {summary?.by_action && Object.entries(summary.by_action).slice(0, 2).map(([action, count]) => (
          <Card key={action}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium capitalize">{formatAction(action)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                {data?.total ? `${data.total} total records` : "Complete audit trail"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-48"
                  data-testid="input-search"
                />
              </div>
              <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-40" data-testid="filter-action">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action}>{formatAction(action)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterEntity} onValueChange={(v) => { setFilterEntity(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-40" data-testid="filter-entity">
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {uniqueEntities.map(entity => (
                    <SelectItem key={entity} value={entity} className="capitalize">{entity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-medium">Failed to load audit logs</h3>
              <p className="text-sm text-muted-foreground">Please try again later</p>
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden sm:table-cell">Date/Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="hidden md:table-cell">Entity</TableHead>
                      <TableHead className="min-w-[200px] hidden lg:table-cell">Details</TableHead>
                      <TableHead className="hidden md:table-cell">IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                        <TableCell className="whitespace-nowrap hidden sm:table-cell">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div>{log.staff ? `${log.staff.first_name} ${log.staff.last_name}` : "System"}</div>
                          <div className="text-xs text-muted-foreground sm:hidden">{new Date(log.created_at).toLocaleDateString()}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionColor(log.action)}>
                            {formatAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize hidden md:table-cell">{log.entity_type || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] hidden lg:table-cell">
                          {log.details && log.details !== "-" ? (
                            <span className="line-clamp-2">{log.details}</span>
                          ) : log.entity_id ? (
                            <span className="font-mono text-xs">ID: {log.entity_id.substring(0, 8)}...</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm hidden md:table-cell">{log.ip_address || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {data && data.total_pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, data.total)} of {data.total} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="text-sm px-3">
                      Page {currentPage} of {data.total_pages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= data.total_pages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">No audit logs</h3>
              <p className="text-sm text-muted-foreground">
                {debouncedSearch || filterAction !== "all" || filterEntity !== "all"
                  ? "No logs match your search or filters"
                  : "System activities will appear here"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
