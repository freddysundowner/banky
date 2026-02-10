import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Plus, ChevronDown, ChevronRight, RotateCcw, Trash2, ChevronLeft } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 20;

interface JournalLine {
  id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  debit: string;
  credit: string;
  memo?: string;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  reference?: string;
  source_type?: string;
  status: string;
  total_debit: string;
  total_credit: string;
  is_reversed: boolean;
  lines: JournalLine[];
  created_at: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  is_header: boolean;
}

interface JournalEntriesProps {
  organizationId: string;
}

interface NewLine {
  account_id: string;
  debit: string;
  credit: string;
  memo: string;
}

export default function JournalEntries({ organizationId }: JournalEntriesProps) {
  const { toast } = useToast();
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.JOURNAL_ENTRIES);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [page, setPage] = useState(1);
  const [lines, setLines] = useState<NewLine[]>([
    { account_id: "", debit: "", credit: "", memo: "" },
    { account_id: "", debit: "", credit: "", memo: "" },
  ]);

  const { data: entries, isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/organizations", organizationId, "accounting", "journal-entries", page],
    queryFn: async () => {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await fetch(`/api/organizations/${organizationId}/accounting/journal-entries?limit=${PAGE_SIZE}&offset=${offset}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch journal entries");
      return res.json();
    },
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/organizations", organizationId, "accounting", "accounts"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/accounting/accounts`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json();
    },
  });

  const postableAccounts = accounts?.filter(a => !a.is_header) || [];

  const createMutation = useMutation({
    mutationFn: async (data: {
      entry_date: string;
      description: string;
      reference?: string;
      lines: { account_id: string; debit: string; credit: string; memo?: string }[];
    }) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/accounting/journal-entries`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "accounting", "journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "accounting", "accounts"] });
      resetForm();
      toast({ title: "Journal entry created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create journal entry", description: err.message, variant: "destructive" });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/accounting/journal-entries/${entryId}/reverse`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "accounting", "journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "accounting", "accounts"] });
      toast({ title: "Journal entry reversed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to reverse journal entry", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setShowCreateDialog(false);
    setEntryDate(format(new Date(), "yyyy-MM-dd"));
    setDescription("");
    setReference("");
    setLines([
      { account_id: "", debit: "", credit: "", memo: "" },
      { account_id: "", debit: "", credit: "", memo: "" },
    ]);
  };

  const addLine = () => {
    setLines([...lines, { account_id: "", debit: "", credit: "", memo: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof NewLine, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    if (field === "debit" && value) {
      newLines[index].credit = "";
    } else if (field === "credit" && value) {
      newLines[index].debit = "";
    }
    setLines(newLines);
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }

    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) {
      toast({ title: "At least 2 valid lines are required", variant: "destructive" });
      return;
    }

    const totalDebit = validLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredit = validLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast({ title: "Entry must be balanced", description: `Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}`, variant: "destructive" });
      return;
    }

    createMutation.mutate({
      entry_date: entryDate,
      description,
      reference: reference || undefined,
      lines: validLines.map(l => ({
        account_id: l.account_id,
        debit: l.debit || "0",
        credit: l.credit || "0",
        memo: l.memo || undefined,
      })),
    });
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Journal Entries</h2>
          <p className="text-muted-foreground">View and create accounting journal entries</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton organizationId={organizationId} />
          {canWrite && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Journal Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {!entries || entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No journal entries found</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <Collapsible key={entry.id} open={expandedEntry === entry.id} onOpenChange={(open) => setExpandedEntry(open ? entry.id : null)}>
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          {expandedEntry === entry.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <div className="font-medium">{entry.entry_number}</div>
                            <div className="text-sm text-muted-foreground">{entry.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm">{format(new Date(entry.entry_date), "MMM d, yyyy")}</div>
                            <div className="text-sm text-muted-foreground">
                              {parseFloat(entry.total_debit).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.is_reversed && (
                              <Badge variant="secondary">Reversed</Badge>
                            )}
                            {entry.source_type && (
                              <Badge variant="outline">{entry.source_type}</Badge>
                            )}
                            <Badge variant={entry.status === "posted" ? "default" : "secondary"}>
                              {entry.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t p-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right">Debit</TableHead>
                              <TableHead className="text-right">Credit</TableHead>
                              <TableHead>Memo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.lines.map((line) => (
                              <TableRow key={line.id}>
                                <TableCell>
                                  <span className="font-mono text-sm">{line.account_code}</span>{" "}
                                  {line.account_name}
                                </TableCell>
                                <TableCell className="text-right">
                                  {parseFloat(line.debit) > 0 ? parseFloat(line.debit).toLocaleString() : ""}
                                </TableCell>
                                <TableCell className="text-right">
                                  {parseFloat(line.credit) > 0 ? parseFloat(line.credit).toLocaleString() : ""}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{line.memo}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {canWrite && !entry.is_reversed && entry.source_type === "manual" && (
                          <div className="mt-4 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => reverseMutation.mutate(entry.id)}
                              disabled={reverseMutation.isPending}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reverse Entry
                            </Button>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
          
          {entries && entries.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {page} {entries.length < PAGE_SIZE && page > 1 ? "(last page)" : ""}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={entries.length < PAGE_SIZE}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Journal Entry</DialogTitle>
            <DialogDescription>
              Create a manual journal entry. Entries must be balanced (debits = credits).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Entry Date</Label>
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Optional reference"
                />
              </div>
              <div className="space-y-2 col-span-1">
                <Label>Balance Status</Label>
                <div className={`p-2 rounded text-center ${isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {isBalanced ? "Balanced" : `Difference: ${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Journal entry description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Entry Lines</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Account</TableHead>
                    <TableHead className="w-[120px]">Debit</TableHead>
                    <TableHead className="w-[120px]">Credit</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={line.account_id}
                          onValueChange={(v) => updateLine(index, "account_id", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {postableAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) => updateLine(index, "debit", e.target.value)}
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) => updateLine(index, "credit", e.target.value)}
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.memo}
                          onChange={(e) => updateLine(index, "memo", e.target.value)}
                          placeholder="Line memo"
                        />
                      </TableCell>
                      <TableCell>
                        {lines.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">Totals</TableCell>
                    <TableCell className="font-medium">{totalDebit.toFixed(2)}</TableCell>
                    <TableCell className="font-medium">{totalCredit.toFixed(2)}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !isBalanced}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
