import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Plus, Pencil, Trash2, Shield, Lock, RotateCcw, ArrowLeft, BookOpen } from "lucide-react";
import RolesDocumentation from "@/components/roles-documentation";
import { useResourcePermissions, RESOURCES } from "@/hooks/use-resource-permissions";

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  permissions: string[];
  created_at: string;
}

interface RolesManagementProps {
  organizationId: string;
}

const PERMISSION_GROUPS = {
  "Dashboard": ["dashboard:read"],
  "Branches": ["branches:read", "branches:write"],
  "Staff": ["staff:read", "staff:write"],
  "Members": ["members:read", "members:write", "members:activate", "members:suspend"],
  "Loan Products": ["loan_products:read", "loan_products:write"],
  "Loans": ["loans:read", "loans:write", "loans:process", "loans:approve", "loans:reject"],
  "Repayments": ["repayments:read", "repayments:write"],
  "Guarantors": ["guarantors:read", "guarantors:write"],
  "Transactions": ["transactions:read", "transactions:write"],
  "Fixed Deposits": ["fixed_deposits:read", "fixed_deposits:write"],
  "Dividends": ["dividends:read", "dividends:write"],
  "Chart of Accounts": ["chart_of_accounts:read", "chart_of_accounts:write"],
  "Journal Entries": ["journal_entries:read", "journal_entries:write"],
  "Teller Station": ["teller_station:read", "teller_station:write"],
  "Float Management": ["float_management:read", "float_management:write"],
  "Shortage Approval": ["shortage_approval:write"],
  "Defaults": ["defaults:read", "defaults:write"],
  "Restructure": ["restructure:read", "restructure:write"],
  "SMS": ["sms:read", "sms:write"],
  "Reports": ["reports:read"],
  "Analytics": ["analytics:read"],
  "Audit": ["audit:read"],
  "HR": ["hr:read", "hr:write"],
  "Leave": ["leave:read", "leave:write", "leave:approve"],
  "Expenses": ["expenses:read", "expenses:write", "expenses:approve"],
  "Settings": ["settings:read", "settings:write"],
  "Roles": ["roles:read", "roles:write"],
};

export default function RolesManagement({ organizationId }: RolesManagementProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"list" | "form" | "docs">("list");
  const [editing, setEditing] = useState<Role | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const { canWrite } = useResourcePermissions(organizationId, RESOURCES.ROLES);

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ["/api/organizations", organizationId, "roles"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/roles`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; permissions: string[] }) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/roles`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "roles"] });
      resetForm();
      toast({ title: "Role created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create role", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; permissions?: string[] } }) => {
      return apiRequest("PATCH", `/api/organizations/${organizationId}/roles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "roles"] });
      resetForm();
      toast({ title: "Role updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/organizations/${organizationId}/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "roles"] });
      toast({ title: "Role deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete role", variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/roles/${id}/reset`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "roles"] });
      toast({ title: "Role reset to default permissions" });
    },
    onError: () => {
      toast({ title: "Failed to reset role", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setViewMode("list");
    setEditing(null);
    setFormName("");
    setFormDescription("");
    setSelectedPermissions([]);
  };

  const openCreateDialog = () => {
    setEditing(null);
    setFormName("");
    setFormDescription("");
    setSelectedPermissions([]);
    setViewMode("form");
  };

  const openEditDialog = (role: Role) => {
    setEditing(role);
    setFormName(role.name);
    setFormDescription(role.description || "");
    setSelectedPermissions(role.permissions);
    setViewMode("form");
  };

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast({ title: "Role name is required", variant: "destructive" });
      return;
    }

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        data: { name: formName, description: formDescription, permissions: selectedPermissions }
      });
    } else {
      createMutation.mutate({ name: formName, description: formDescription, permissions: selectedPermissions });
    }
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const toggleGroupPermissions = (groupPerms: string[]) => {
    const allSelected = groupPerms.every(p => selectedPermissions.includes(p));
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !groupPerms.includes(p)));
    } else {
      setSelectedPermissions(prev => Array.from(new Set([...prev, ...groupPerms])));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (viewMode === "docs") {
    return <RolesDocumentation onBack={() => setViewMode("list")} />;
  }

  if (viewMode === "form") {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="icon" onClick={resetForm}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">
              {editing ? "Edit Role" : "Create New Role"}
            </h1>
            <p className="text-muted-foreground">
              {editing ? "Update role details and permissions" : "Define a new role with specific permissions"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Senior Loan Officer"
                disabled={editing?.is_system}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe what this role is for"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="multiple" className="w-full">
              {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                <AccordionItem key={group} value={group}>
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={perms.every(p => selectedPermissions.includes(p))}
                        onCheckedChange={() => toggleGroupPermissions(perms)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {group}
                      <Badge variant="secondary" className="text-xs">
                        {perms.filter(p => selectedPermissions.includes(p)).length}/{perms.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      {perms.map(perm => (
                        <div key={perm} className="flex items-center gap-2">
                          <Checkbox
                            id={perm}
                            checked={selectedPermissions.includes(perm)}
                            onCheckedChange={() => togglePermission(perm)}
                          />
                          <label htmlFor={perm} className="text-xs cursor-pointer">
                            {perm.split(":")[1]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="text-xs text-muted-foreground">
              Selected: {selectedPermissions.length} permissions
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={resetForm}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {editing ? "Update Role" : "Create Role"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Manage Roles</h3>
          <p className="text-sm text-muted-foreground">Create custom roles and assign permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode("docs")}>
            <BookOpen className="h-4 w-4 mr-2" />
            Permissions Guide
          </Button>
          <RefreshButton organizationId={organizationId} />
          {canWrite && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {roles?.map(role => (
          <Card key={role.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{role.name}</CardTitle>
                  {role.is_system && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      System
                    </Badge>
                  )}
                  {role.permissions.includes("*") && (
                    <Badge className="bg-green-100 text-green-800">Full Access</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(role)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canWrite && role.is_system && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => resetMutation.mutate(role.id)}
                      disabled={resetMutation.isPending}
                      title="Reset to default permissions"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  {canWrite && !role.is_system && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => deleteMutation.mutate(role.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription>{role.description || "No description"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {role.permissions.includes("*") ? (
                  <Badge variant="outline">All Permissions</Badge>
                ) : (
                  role.permissions.slice(0, 8).map(perm => (
                    <Badge key={perm} variant="outline" className="text-xs">
                      {perm}
                    </Badge>
                  ))
                )}
                {!role.permissions.includes("*") && role.permissions.length > 8 && (
                  <Badge variant="outline" className="text-xs">
                    +{role.permissions.length - 8} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
