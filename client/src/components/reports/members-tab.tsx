import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Member, Branch } from "./types";

interface MembersTabProps {
  members: Member[];
  branches: Branch[];
  formatCurrency: (amount: number) => string;
}

export function MembersTab({ members, branches, formatCurrency }: MembersTabProps) {
  const activeMembers = members.filter((m) => m.status === "active").length;
  const pendingMembers = members.filter((m) => m.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Members" value={members.length} />
        <StatCard label="Active Members" value={activeMembers} className="text-green-600" />
        <StatCard label="Pending Activation" value={pendingMembers} className="text-yellow-600" />
        <StatCard label="Branches" value={branches.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members by Branch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Total Savings</TableHead>
                  <TableHead className="text-right">Total Shares</TableHead>
                  <TableHead className="text-right">Total Deposits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => {
                  const branchMembers = members.filter((m) => m.branch_id === branch.id);
                  return (
                    <TableRow key={branch.id}>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell className="text-right">{branchMembers.length}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(branchMembers.reduce((s, m) => s + (m.savings_balance || 0), 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(branchMembers.reduce((s, m) => s + (m.shares_balance || 0), 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(branchMembers.reduce((s, m) => s + (m.deposits_balance || 0), 0))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${className || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
