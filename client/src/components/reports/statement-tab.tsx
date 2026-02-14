import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, Search } from "lucide-react";
import type { MemberStatement, MemberSearchResult } from "./types";
import { getStatusColor, formatDate } from "./types";

interface StatementTabProps {
  organizationId: string;
  startDate: string;
  endDate: string;
  formatCurrency: (amount: number) => string;
}

export function StatementTab({ organizationId, startDate, endDate, formatCurrency }: StatementTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: searchResults } = useQuery<MemberSearchResult[]>({
    queryKey: ["/api/organizations", organizationId, "reports", "member-search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      const res = await fetch(
        `/api/organizations/${organizationId}/reports/member-search?query=${encodeURIComponent(debouncedSearch)}&limit=10`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: debouncedSearch.length >= 2,
  });

  const { data: statement, isLoading: statementLoading } = useQuery<MemberStatement>({
    queryKey: ["/api/organizations", organizationId, "reports", "member-statement", selectedMemberId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      const res = await fetch(
        `/api/organizations/${organizationId}/reports/member-statement/${selectedMemberId}?${params}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch statement");
      return res.json();
    },
    enabled: !!selectedMemberId,
  });

  const showResults = debouncedSearch.length >= 2 && !selectedMemberId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Member Statement</CardTitle>
          <CardDescription>Search for a member to view their statement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm relative">
            <Label className="text-xs">Search Member</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or member number..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (!e.target.value) setSelectedMemberId("");
                }}
                className="pl-10"
                data-testid="input-member-search"
              />
            </div>
            {showResults && searchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    onClick={() => {
                      setSelectedMemberId(m.id);
                      setSearchTerm(`${m.member_number} - ${m.first_name} ${m.last_name}`);
                    }}
                    data-testid={`member-result-${m.id}`}
                  >
                    <span className="font-mono text-xs mr-2">{m.member_number}</span>
                    {m.first_name} {m.last_name}
                  </button>
                ))}
              </div>
            )}
            {showResults && searchResults && searchResults.length === 0 && debouncedSearch.length >= 2 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground">
                No members found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedMemberId && (
        statementLoading ? (
          <Skeleton className="h-64" />
        ) : statement ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {statement.member.name}
                </CardTitle>
                <CardDescription>
                  {statement.member.member_number} | {statement.member.phone} | {statement.member.email}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <BalanceItem label="Savings Balance" value={formatCurrency(statement.balances.savings)} className="text-primary" />
                  <BalanceItem label="Shares Balance" value={formatCurrency(statement.balances.shares)} />
                  <BalanceItem label="Deposits Balance" value={formatCurrency(statement.balances.deposits)} />
                  <BalanceItem label="Loan Outstanding" value={formatCurrency(statement.balances.total_loan_outstanding)} className="text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  {formatDate(statement.period.start_date)} - {formatDate(statement.period.end_date)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(statement.transactions || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No transactions found for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        statement.transactions.map((txn, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{formatDate(txn.date)}</TableCell>
                            <TableCell>
                              <Badge variant={txn.type === "deposit" ? "default" : "secondary"}>{txn.type}</Badge>
                            </TableCell>
                            <TableCell>{txn.account}</TableCell>
                            <TableCell className={`text-right ${txn.type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                              {txn.type === "deposit" ? "+" : "-"}{formatCurrency(txn.amount)}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(txn.balance_after)}</TableCell>
                            <TableCell className="font-mono text-xs">{txn.reference}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{txn.description}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Loans Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan #</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead>Disbursed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(statement.loans_summary || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No loans found
                          </TableCell>
                        </TableRow>
                      ) : (
                        statement.loans_summary.map((loan, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{loan.loan_number}</TableCell>
                            <TableCell className="text-right">{formatCurrency(loan.amount)}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(loan.status)}>{loan.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(loan.outstanding)}</TableCell>
                            <TableCell>{formatDate(loan.disbursed_at)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null
      )}
    </div>
  );
}

function BalanceItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${className || ""}`}>{value}</p>
    </div>
  );
}
