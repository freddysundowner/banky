import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAppDialog } from "@/hooks/use-app-dialog";
import { useFeatures } from "@/hooks/use-features";
import { useCurrency } from "@/hooks/use-currency";
import { RefreshButton } from "@/components/refresh-button";
import { Smartphone, FileText, Building, Ticket, Search, CheckCircle, XCircle, Clock, CreditCard, Phone } from "lucide-react";

interface TellerServicesProps {
  organizationId: string;
}

export function TellerServices({ organizationId }: TellerServicesProps) {
  const { hasFeature } = useFeatures(organizationId);
  const hasMpesa = hasFeature("mpesa_integration");
  const hasBankIntegration = hasFeature("bank_integration");
  
  const availableTabs = useMemo(() => {
    const tabs: string[] = [];
    if (hasMpesa) tabs.push("mpesa");
    tabs.push("cheques");
    if (hasBankIntegration) tabs.push("bank");
    tabs.push("queue");
    return tabs;
  }, [hasMpesa, hasBankIntegration]);
  
  const [activeTab, setActiveTab] = useState(() => availableTabs[0] || "cheques");

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Teller Services</h2>
          <p className="text-sm text-muted-foreground">Manage payments, cheques, transfers, and queue</p>
        </div>
        <RefreshButton organizationId={organizationId} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-4 h-auto flex-nowrap">
            {hasMpesa && (
              <TabsTrigger value="mpesa" className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap">
                <Smartphone className="h-4 w-4 shrink-0" />
                M-Pesa
              </TabsTrigger>
            )}
            <TabsTrigger value="cheques" className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap">
              <FileText className="h-4 w-4 shrink-0" />
              Cheques
            </TabsTrigger>
            {hasBankIntegration && (
              <TabsTrigger value="bank" className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap">
                <Building className="h-4 w-4 shrink-0" />
                Transfers
              </TabsTrigger>
            )}
            <TabsTrigger value="queue" className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap">
              <Ticket className="h-4 w-4 shrink-0" />
              Queue
            </TabsTrigger>
          </TabsList>
        </div>

        {hasMpesa && (
          <TabsContent value="mpesa">
            <MpesaLog organizationId={organizationId} />
          </TabsContent>
        )}
        <TabsContent value="cheques">
          <ChequeDeposits organizationId={organizationId} />
        </TabsContent>
        {hasBankIntegration && (
          <TabsContent value="bank">
            <BankTransfers organizationId={organizationId} />
          </TabsContent>
        )}
        <TabsContent value="queue">
          <QueueManagement organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MpesaLog({ organizationId }: { organizationId: string }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const { toast } = useAppDialog();
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/mpesa-payments`, statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/organizations/${organizationId}/mpesa-payments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: members = [] } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/members`],
  });

  const creditMutation = useMutation({
    mutationFn: async ({ paymentId, memberId }: { paymentId: string; memberId: string }) => {
      const res = await fetch(
        `/api/organizations/${organizationId}/mpesa-payments/${paymentId}/credit?member_id=${memberId}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to credit");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Payment credited to member" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/mpesa-payments`] });
      setCreditDialogOpen(false);
      setSelectedPayment(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "credited": return <Badge className="bg-green-500">Credited</Badge>;
      case "unmatched": return <Badge variant="destructive">Unmatched</Badge>;
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          M-Pesa Payment Log
        </CardTitle>
        <CardDescription>View and manage incoming M-Pesa payments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone, M-Pesa code, or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="credited">Credited</SelectItem>
              <SelectItem value="unmatched">Unmatched</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="border rounded-lg min-w-[600px] md:min-w-0">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Date/Time</th>
                  <th className="text-left p-3 font-medium">M-Pesa Code</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Phone</th>
                  <th className="text-left p-3 font-medium">Sender</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Account Ref</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Member</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="text-center p-4">Loading...</td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={9} className="text-center p-4 text-muted-foreground">No M-Pesa payments found</td></tr>
                ) : (
                  payments.map((p: any) => (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 text-sm">{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
                      <td className="p-3 font-mono text-sm">{p.trans_id}</td>
                      <td className="p-3 text-sm hidden md:table-cell">{p.phone_number}</td>
                      <td className="p-3 text-sm">{p.sender_name}</td>
                      <td className="p-3 text-right font-medium">{symbol} {p.amount?.toLocaleString()}</td>
                      <td className="p-3 text-sm hidden lg:table-cell">{p.bill_ref_number}</td>
                      <td className="p-3 text-sm hidden md:table-cell">{p.member_name || <span className="text-muted-foreground">-</span>}</td>
                      <td className="p-3">{getStatusBadge(p.status)}</td>
                      <td className="p-3">
                        {p.status === "unmatched" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedPayment(p); setCreditDialogOpen(true); }}
                          >
                            Credit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Credit M-Pesa Payment</DialogTitle>
              <DialogDescription>
                Select the member to credit {symbol} {selectedPayment?.amount?.toLocaleString()} from {selectedPayment?.phone_number}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Search Member</Label>
                <Input 
                  placeholder="Search by member number, ID number, or name..." 
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="mb-2"
                />
                <Label>Select Member</Label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {(members as any[])
                      .filter((m: any) => {
                        if (!memberSearch) return true;
                        const search = memberSearch.toLowerCase();
                        return (
                          m.member_number?.toLowerCase().includes(search) ||
                          m.id_number?.toLowerCase().includes(search) ||
                          m.first_name?.toLowerCase().includes(search) ||
                          m.last_name?.toLowerCase().includes(search) ||
                          m.phone?.includes(search)
                        );
                      })
                      .slice(0, 50)
                      .map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.member_number} - {m.first_name} {m.last_name} {m.id_number ? `(ID: ${m.id_number})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreditDialogOpen(false); setMemberSearch(""); }}>Cancel</Button>
              <Button
                onClick={() => selectedPayment && selectedMember && creditMutation.mutate({
                  paymentId: selectedPayment.id,
                  memberId: selectedMember
                })}
                disabled={!selectedMember || creditMutation.isPending}
              >
                {creditMutation.isPending ? "Processing..." : "Credit to Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function ChequeDeposits({ organizationId }: { organizationId: string }) {
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const [statusFilter, setStatusFilter] = useState("all");
  const [newChequeOpen, setNewChequeOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [formData, setFormData] = useState({
    member_id: "",
    cheque_number: "",
    bank_name: "",
    bank_branch: "",
    drawer_name: "",
    amount: "",
    account_type: "savings",
    notes: ""
  });
  const { toast } = useAppDialog();
  const queryClient = useQueryClient();

  const { data: cheques = [], isLoading } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/cheque-deposits`, statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/organizations/${organizationId}/cheque-deposits${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: members = [] } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/members`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/organizations/${organizationId}/cheque-deposits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, amount: parseFloat(data.amount) })
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to create");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Cheque deposit recorded" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/cheque-deposits`] });
      setNewChequeOpen(false);
      setFormData({ member_id: "", cheque_number: "", bank_name: "", bank_branch: "", drawer_name: "", amount: "", account_type: "savings", notes: "" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const actionMutation = useMutation({
    mutationFn: async ({ chequeId, action, reason }: { chequeId: string; action: string; reason?: string }) => {
      const res = await fetch(`/api/organizations/${organizationId}/cheque-deposits/${chequeId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason })
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      return res.json();
    },
    onSuccess: (_, { action }) => {
      toast({ title: "Success", description: `Cheque ${action}ed successfully` });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/cheque-deposits`] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "cleared": return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Cleared</Badge>;
      case "bounced": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Bounced</Badge>;
      case "cancelled": return <Badge variant="outline">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cheque Deposits
          </CardTitle>
          <CardDescription>Manage cheque deposits and clearance</CardDescription>
        </div>
        <Dialog open={newChequeOpen} onOpenChange={setNewChequeOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">New Cheque Deposit</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Cheque Deposit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Search Member</Label>
                <Input 
                  placeholder="Search by member number, ID number, or name..." 
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="mb-2"
                />
                <Label>Member</Label>
                <Select value={formData.member_id} onValueChange={(v) => setFormData({...formData, member_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {(members as any[])
                      .filter((m: any) => {
                        if (!memberSearch) return true;
                        const search = memberSearch.toLowerCase();
                        return (
                          m.member_number?.toLowerCase().includes(search) ||
                          m.id_number?.toLowerCase().includes(search) ||
                          m.first_name?.toLowerCase().includes(search) ||
                          m.last_name?.toLowerCase().includes(search) ||
                          m.phone?.includes(search)
                        );
                      })
                      .slice(0, 50)
                      .map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.member_number} - {m.first_name} {m.last_name} {m.id_number ? `(ID: ${m.id_number})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Cheque Number</Label>
                  <Input value={formData.cheque_number} onChange={(e) => setFormData({...formData, cheque_number: e.target.value})} />
                </div>
                <div>
                  <Label>Amount ({currency})</Label>
                  <Input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Bank Name</Label>
                  <Input value={formData.bank_name} onChange={(e) => setFormData({...formData, bank_name: e.target.value})} />
                </div>
                <div>
                  <Label>Bank Branch</Label>
                  <Input value={formData.bank_branch} onChange={(e) => setFormData({...formData, bank_branch: e.target.value})} />
                </div>
              </div>
              <div>
                <Label>Drawer Name</Label>
                <Input value={formData.drawer_name} onChange={(e) => setFormData({...formData, drawer_name: e.target.value})} placeholder="Name on the cheque" />
              </div>
              <div>
                <Label>Account Type</Label>
                <Select value={formData.account_type} onValueChange={(v) => setFormData({...formData, account_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="shares">Shares</SelectItem>
                    <SelectItem value="deposits">Deposits</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewChequeOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Record Deposit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="border rounded-lg min-w-[500px] md:min-w-0">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
                  <th className="text-left p-3 font-medium">Member</th>
                  <th className="text-left p-3 font-medium">Cheque #</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Bank</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Expected Clear</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="text-center p-4">Loading...</td></tr>
                ) : cheques.length === 0 ? (
                  <tr><td colSpan={8} className="text-center p-4 text-muted-foreground">No cheque deposits found</td></tr>
                ) : (
                  cheques.map((c: any) => (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 text-sm hidden md:table-cell">{c.deposit_date}</td>
                      <td className="p-3 text-sm">{c.member_name}</td>
                      <td className="p-3 font-mono text-sm">{c.cheque_number}</td>
                      <td className="p-3 text-sm hidden lg:table-cell">{c.bank_name}</td>
                      <td className="p-3 text-right font-medium">{symbol} {c.amount?.toLocaleString()}</td>
                      <td className="p-3 text-sm hidden md:table-cell">{c.expected_clearance_date}</td>
                      <td className="p-3">{getStatusBadge(c.status)}</td>
                      <td className="p-3">
                        {c.status === "pending" && (
                          <div className="flex gap-1 flex-wrap">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => actionMutation.mutate({ chequeId: c.id, action: "clear" })}>
                              Clear
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => actionMutation.mutate({ chequeId: c.id, action: "bounce", reason: "Insufficient funds" })}>
                              Bounce
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BankTransfers({ organizationId }: { organizationId: string }) {
  const { currency, symbol, formatAmount } = useCurrency(organizationId);
  const [statusFilter, setStatusFilter] = useState("all");
  const [newTransferOpen, setNewTransferOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [selectedMemberForCredit, setSelectedMemberForCredit] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [formData, setFormData] = useState({
    transfer_type: "incoming",
    amount: "",
    bank_name: "",
    bank_account: "",
    bank_reference: "",
    account_type: "savings",
    notes: ""
  });
  const { toast } = useAppDialog();
  const queryClient = useQueryClient();

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/bank-transfers`, statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/organizations/${organizationId}/bank-transfers${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: members = [] } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/members`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/organizations/${organizationId}/bank-transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, amount: parseFloat(data.amount) })
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Bank transfer recorded" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/bank-transfers`] });
      setNewTransferOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const actionMutation = useMutation({
    mutationFn: async ({ transferId, action, memberId }: { transferId: string; action: string; memberId?: string }) => {
      const res = await fetch(`/api/organizations/${organizationId}/bank-transfers/${transferId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, member_id: memberId })
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Transfer updated" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/bank-transfers`] });
      setCreditDialogOpen(false);
      setSelectedTransfer(null);
      setSelectedMemberForCredit("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "verified": return <Badge className="bg-blue-500">Verified</Badge>;
      case "credited": return <Badge className="bg-green-500">Credited</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Bank Transfers
          </CardTitle>
          <CardDescription>Manage incoming bank transfers and verification</CardDescription>
        </div>
        <Dialog open={newTransferOpen} onOpenChange={setNewTransferOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">Record Transfer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Bank Transfer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Bank Name</Label>
                  <Input value={formData.bank_name} onChange={(e) => setFormData({...formData, bank_name: e.target.value})} />
                </div>
                <div>
                  <Label>Amount ({currency})</Label>
                  <Input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Bank Account</Label>
                  <Input value={formData.bank_account} onChange={(e) => setFormData({...formData, bank_account: e.target.value})} />
                </div>
                <div>
                  <Label>Bank Reference</Label>
                  <Input value={formData.bank_reference} onChange={(e) => setFormData({...formData, bank_reference: e.target.value})} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewTransferOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Record Transfer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="credited">Credited</SelectItem>
          </SelectContent>
        </Select>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="border rounded-lg min-w-[500px] md:min-w-0">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
                  <th className="text-left p-3 font-medium">Bank</th>
                  <th className="text-left p-3 font-medium">Reference</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Member</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center p-4">Loading...</td></tr>
                ) : transfers.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-4 text-muted-foreground">No bank transfers found</td></tr>
                ) : (
                  transfers.map((t: any) => (
                    <tr key={t.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 text-sm hidden md:table-cell">{t.transfer_date || t.created_at?.split("T")[0]}</td>
                      <td className="p-3 text-sm">{t.bank_name}</td>
                      <td className="p-3 font-mono text-sm">{t.bank_reference}</td>
                      <td className="p-3 text-right font-medium">{symbol} {t.amount?.toLocaleString()}</td>
                      <td className="p-3 text-sm hidden md:table-cell">{t.member_name || <span className="text-muted-foreground">-</span>}</td>
                      <td className="p-3">{getStatusBadge(t.status)}</td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {t.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => actionMutation.mutate({ transferId: t.id, action: "verify" })}>
                              Verify
                            </Button>
                          )}
                          {(t.status === "pending" || t.status === "verified") && (
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => {
                              setSelectedTransfer(t);
                              setCreditDialogOpen(true);
                            }}>
                              Credit
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Credit Bank Transfer</DialogTitle>
              <DialogDescription>
                Select the member to credit {symbol} {selectedTransfer?.amount?.toLocaleString()} from {selectedTransfer?.bank_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Search Member</Label>
                <Input 
                  placeholder="Search by member number, ID number, or name..." 
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="mb-2"
                />
                <Label>Select Member</Label>
                <Select value={selectedMemberForCredit} onValueChange={setSelectedMemberForCredit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {(members as any[])
                      .filter((m: any) => {
                        if (!memberSearch) return true;
                        const search = memberSearch.toLowerCase();
                        return (
                          m.member_number?.toLowerCase().includes(search) ||
                          m.id_number?.toLowerCase().includes(search) ||
                          m.first_name?.toLowerCase().includes(search) ||
                          m.last_name?.toLowerCase().includes(search) ||
                          m.phone?.includes(search)
                        );
                      })
                      .slice(0, 50)
                      .map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.member_number} - {m.first_name} {m.last_name} {m.id_number ? `(ID: ${m.id_number})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreditDialogOpen(false); setMemberSearch(""); }}>Cancel</Button>
              <Button
                onClick={() => selectedTransfer && selectedMemberForCredit && actionMutation.mutate({
                  transferId: selectedTransfer.id,
                  action: "credit",
                  memberId: selectedMemberForCredit
                })}
                disabled={!selectedMemberForCredit || actionMutation.isPending}
              >
                {actionMutation.isPending ? "Processing..." : "Credit to Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function QueueManagement({ organizationId }: { organizationId: string }) {
  const [selectedBranch, setSelectedBranch] = useState("");
  const { toast } = useAppDialog();
  const queryClient = useQueryClient();

  const { data: branches = [] } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/branches`],
  });

  useEffect(() => {
    if ((branches as any[]).length === 1 && !selectedBranch) {
      setSelectedBranch((branches as any[])[0].id);
    }
  }, [branches]);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/queue-tickets`, selectedBranch],
    queryFn: async () => {
      if (!selectedBranch) return [];
      const res = await fetch(`/api/organizations/${organizationId}/queue-tickets?branch_id=${selectedBranch}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedBranch
  });

  const callNextMutation = useMutation({
    mutationFn: async ({ branchId, category }: { branchId: string; category?: string }) => {
      const params = new URLSearchParams({ branch_id: branchId });
      if (category) params.set("service_category", category);
      const res = await fetch(`/api/organizations/${organizationId}/queue-tickets/call-next?${params}`, {
        method: "POST"
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Calling", description: `Ticket ${data.ticket.ticket_number} to counter ${data.ticket.counter_number || "1"}` });
      } else {
        toast({ title: "No tickets", description: data.message });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/queue-tickets`] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const completeMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/queue-tickets/${ticketId}/complete`, {
        method: "POST"
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Complete", description: "Ticket marked as completed" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/queue-tickets`] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const waitingTickets = tickets.filter((t: any) => t.status === "waiting");
  const servingTickets = tickets.filter((t: any) => t.status === "serving");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "waiting": return <Badge variant="secondary">Waiting</Badge>;
      case "serving": return <Badge className="bg-blue-500">Serving</Badge>;
      case "completed": return <Badge className="bg-green-500">Completed</Badge>;
      case "no_show": return <Badge variant="destructive">No Show</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "deposits": return <CreditCard className="h-4 w-4" />;
      case "loans": return <FileText className="h-4 w-4" />;
      case "inquiries": return <Phone className="h-4 w-4" />;
      default: return <Ticket className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          Queue Management
        </CardTitle>
        <CardDescription>Manage customer queue and call next ticket</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          {(branches as any[]).length > 1 && (
          <div className="flex-1">
            <Label>Select Branch</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {(branches as any[]).map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}
          {selectedBranch && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => callNextMutation.mutate({ branchId: selectedBranch })} disabled={callNextMutation.isPending}>
                Call Next
              </Button>
              <Button variant="outline" onClick={() => callNextMutation.mutate({ branchId: selectedBranch, category: "deposits" })}>
                Deposits
              </Button>
              <Button variant="outline" onClick={() => callNextMutation.mutate({ branchId: selectedBranch, category: "loans" })}>
                Loans
              </Button>
            </div>
          )}
        </div>

        {selectedBranch && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Now Serving ({servingTickets.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {servingTickets.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No tickets being served</p>
                ) : (
                  <div className="space-y-2">
                    {servingTickets.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          {getCategoryIcon(t.service_category)}
                          <div className="min-w-0">
                            <div className="font-bold text-lg">{t.ticket_number}</div>
                            <div className="text-sm text-muted-foreground truncate">{t.member_name || "Guest"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm hidden sm:inline">Counter {t.counter_number || "1"}</span>
                          <Button size="sm" onClick={() => completeMutation.mutate(t.id)}>Done</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Waiting ({waitingTickets.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {waitingTickets.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No tickets waiting</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {waitingTickets.slice(0, 10).map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 p-2 border rounded">
                        <div className="flex items-center gap-2 min-w-0">
                          {getCategoryIcon(t.service_category)}
                          <span className="font-medium">{t.ticket_number}</span>
                          <span className="text-sm text-muted-foreground truncate">{t.member_name || "Guest"}</span>
                        </div>
                        {getStatusBadge(t.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
