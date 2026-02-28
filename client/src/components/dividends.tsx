import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppDialog } from "@/hooks/use-app-dialog";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { useCurrency } from "@/hooks/use-currency";
import { Loader2, Plus, CheckCircle, XCircle, Send, Eye, Percent, Users, DollarSign } from "lucide-react";

interface DividendDeclaration {
  id: string;
  fiscal_year: number;
  declaration_date: string;
  effective_date: string;
  dividend_rate: number;
  total_shares_value: number;
  total_dividend_amount: number;
  distribution_type: string;
  status: string;
  approved_at?: string;
  distributed_at?: string;
  notes?: string;
  created_at: string;
  member_count: number;
}

interface MemberDividend {
  id: string;
  member_id: string;
  member_name: string;
  member_number: string;
  shares_balance: number;
  dividend_rate: number;
  dividend_amount: number;
  status: string;
  credited_to?: string;
  credited_at?: string;
}

interface DividendDetails {
  declaration: DividendDeclaration;
  members: MemberDividend[];
}

export function Dividends({ organizationId }: { organizationId: string }) {
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.DIVIDENDS);
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const [showDeclareDialog, setShowDeclareDialog] = useState(false);
  const [selectedDividend, setSelectedDividend] = useState<string | null>(null);
  const [declareForm, setDeclareForm] = useState({
    fiscal_year: new Date().getFullYear(),
    declaration_date: new Date().toISOString().split("T")[0],
    effective_date: new Date().toISOString().split("T")[0],
    dividend_rate: 10,
    distribution_type: "savings",
    notes: ""
  });
  
  const { toast } = useAppDialog();
  const queryClient = useQueryClient();

  const { data: dividends, isLoading } = useQuery<DividendDeclaration[]>({
    queryKey: ["/api/organizations", organizationId, "dividends"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/dividends`);
      if (!res.ok) throw new Error("Failed to load dividends");
      return res.json();
    }
  });

  const { data: dividendDetails, isLoading: detailsLoading } = useQuery<DividendDetails>({
    queryKey: ["/api/organizations", organizationId, "dividends", selectedDividend],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/dividends/${selectedDividend}`);
      if (!res.ok) throw new Error("Failed to load dividend details");
      return res.json();
    },
    enabled: !!selectedDividend
  });

  const declareMutation = useMutation({
    mutationFn: async (data: typeof declareForm) => {
      const res = await fetch(`/api/organizations/${organizationId}/dividends/declare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to declare dividend");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Dividend Declared", description: data.message });
      setShowDeclareDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "dividends"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (dividendId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/dividends/${dividendId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to approve dividend");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Dividend Approved", description: "Dividend has been approved for distribution" });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "dividends"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const distributeMutation = useMutation({
    mutationFn: async (dividendId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/dividends/${dividendId}/distribute`, {
        method: "POST"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to distribute dividend");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Dividend Distributed", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "dividends"] });
      if (selectedDividend) {
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "dividends", selectedDividend] });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (dividendId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/dividends/${dividendId}/cancel`, {
        method: "POST"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to cancel dividend");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Dividend Cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "dividends"] });
      setSelectedDividend(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      declared: "secondary",
      approved: "default",
      processing: "outline",
      distributed: "default",
      cancelled: "destructive"
    };
    const colors: Record<string, string> = {
      declared: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      processing: "bg-orange-100 text-orange-800",
      distributed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800"
    };
    return <Badge className={colors[status] || ""}>{status.toUpperCase()}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Dividends</h2>
          <p className="text-muted-foreground">Manage dividend declarations and distributions</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
        <Dialog open={showDeclareDialog} onOpenChange={setShowDeclareDialog}>
          {canWrite && (
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Declare Dividend</Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Declare New Dividend</DialogTitle>
              <DialogDescription>
                Declare dividend for members based on their share balance
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fiscal Year</Label>
                  <Input
                    type="number"
                    value={declareForm.fiscal_year}
                    onChange={(e) => setDeclareForm({ ...declareForm, fiscal_year: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dividend Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={declareForm.dividend_rate}
                    onChange={(e) => setDeclareForm({ ...declareForm, dividend_rate: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Declaration Date</Label>
                  <Input
                    type="date"
                    value={declareForm.declaration_date}
                    onChange={(e) => setDeclareForm({ ...declareForm, declaration_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <Input
                    type="date"
                    value={declareForm.effective_date}
                    onChange={(e) => setDeclareForm({ ...declareForm, effective_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Credit Dividend To</Label>
                <Select
                  value={declareForm.distribution_type}
                  onValueChange={(v) => setDeclareForm({ ...declareForm, distribution_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Member Savings Account</SelectItem>
                    <SelectItem value="shares">Add to Member Shares</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  value={declareForm.notes}
                  onChange={(e) => setDeclareForm({ ...declareForm, notes: e.target.value })}
                  placeholder="AGM resolution reference..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeclareDialog(false)}>Cancel</Button>
              <Button onClick={() => declareMutation.mutate(declareForm)} disabled={declareMutation.isPending}>
                {declareMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Declare Dividend
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Declarations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dividends?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Distributed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {symbol} {(dividends?.filter(d => d.status === "distributed").reduce((sum, d) => sum + d.total_dividend_amount, 0) || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dividends?.filter(d => d.status === "approved").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">All Declarations</TabsTrigger>
          <TabsTrigger value="details" disabled={!selectedDividend}>View Details</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fiscal Year</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="hidden md:table-cell">Total Shares</TableHead>
                    <TableHead>Total Dividend</TableHead>
                    <TableHead className="hidden lg:table-cell">Members</TableHead>
                    <TableHead className="hidden sm:table-cell">Credit To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dividends?.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.fiscal_year}</TableCell>
                      <TableCell>{d.dividend_rate}%</TableCell>
                      <TableCell className="hidden md:table-cell">{symbol} {d.total_shares_value?.toLocaleString()}</TableCell>
                      <TableCell>{symbol} {d.total_dividend_amount?.toLocaleString()}</TableCell>
                      <TableCell className="hidden lg:table-cell">{d.member_count}</TableCell>
                      <TableCell className="capitalize hidden sm:table-cell">{d.distribution_type}</TableCell>
                      <TableCell>{getStatusBadge(d.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDividend(d.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canWrite && d.status === "declared" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => approveMutation.mutate(d.id)}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => cancelMutation.mutate(d.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {canWrite && d.status === "approved" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => distributeMutation.mutate(d.id)}
                              disabled={distributeMutation.isPending}
                            >
                              <Send className="h-4 w-4 mr-1" /> Distribute
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!dividends || dividends.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No dividends declared yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          {detailsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : dividendDetails ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dividend FY{dividendDetails.declaration.fiscal_year}</CardTitle>
                  <CardDescription>
                    Rate: {dividendDetails.declaration.dividend_rate}% | 
                    Status: {dividendDetails.declaration.status} | 
                    Credit to: {dividendDetails.declaration.distribution_type}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Shares</p>
                      <p className="text-lg font-bold">{symbol} {dividendDetails.declaration.total_shares_value?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Dividend</p>
                      <p className="text-lg font-bold">{symbol} {dividendDetails.declaration.total_dividend_amount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Members</p>
                      <p className="text-lg font-bold">{dividendDetails.members.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Member Dividends</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Member No.</TableHead>
                        <TableHead>Shares Balance</TableHead>
                        <TableHead>Dividend Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Credited To</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dividendDetails.members.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{m.member_name}</TableCell>
                          <TableCell>{m.member_number}</TableCell>
                          <TableCell>{symbol} {m.shares_balance.toLocaleString()}</TableCell>
                          <TableCell className="font-medium">{symbol} {m.dividend_amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={m.status === "credited" ? "default" : "secondary"}>
                              {m.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{m.credited_to || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
