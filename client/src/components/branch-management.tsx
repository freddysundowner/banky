import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppDialog } from "@/hooks/use-app-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import type { Branch } from "@shared/tenant-types";

interface BranchManagementProps {
  organizationId: string;
}

const branchSchema = z.object({
  name: z.string().min(2, "Branch name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});

type BranchFormData = z.infer<typeof branchSchema>;

export default function BranchManagement({ organizationId }: BranchManagementProps) {
  const { toast } = useAppDialog();
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  const { data: branches, isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ["/api/organizations", organizationId, "branches"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/branches`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const branchForm = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      return apiRequest("POST", `/api/organizations/${organizationId}/branches`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "branches"] });
      setShowBranchDialog(false);
      branchForm.reset();
      toast({ title: "Branch created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create branch", variant: "destructive" });
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      if (!editingBranch) return;
      return apiRequest("PATCH", `/api/organizations/${organizationId}/branches/${editingBranch.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "branches"] });
      setEditingBranch(null);
      branchForm.reset();
      toast({ title: "Branch updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update branch", variant: "destructive" });
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async () => {
      if (!deletingBranch) return;
      return apiRequest("DELETE", `/api/organizations/${organizationId}/branches/${deletingBranch.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "branches"] });
      setDeletingBranch(null);
      toast({ title: "Branch deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete branch", variant: "destructive" });
    },
  });

  const openEditDialog = (branch: Branch) => {
    setEditingBranch(branch);
    branchForm.reset({
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
    });
  };

  const handleBranchSubmit = (data: BranchFormData) => {
    if (editingBranch) {
      updateBranchMutation.mutate(data);
    } else {
      createBranchMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branches</h1>
        <p className="text-muted-foreground">Manage your organization's branches</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <CardTitle>All Branches</CardTitle>
            <CardDescription>{branches?.length || 0} branches total</CardDescription>
          </div>
          <Button onClick={() => { branchForm.reset(); setShowBranchDialog(true); }} data-testid="button-add-branch" className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Add Branch</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </CardHeader>
        <CardContent>
          {branchesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : branches && branches.length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch) => (
                    <TableRow key={branch.id} data-testid={`row-branch-${branch.id}`}>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell>{branch.code || "-"}</TableCell>
                      <TableCell>
                        {branch.address ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {branch.address}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {branch.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {branch.phone}
                            </div>
                          )}
                          {branch.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {branch.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={branch.is_active ? "default" : "secondary"}>
                          {branch.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(branch)}
                            data-testid={`button-edit-branch-${branch.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingBranch(branch)}
                            data-testid={`button-delete-branch-${branch.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">No branches yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first branch to get started
              </p>
              <Button onClick={() => setShowBranchDialog(true)} data-testid="button-add-first-branch">
                <Plus className="mr-2 h-4 w-4" />
                Add Branch
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showBranchDialog || !!editingBranch} onOpenChange={(open) => {
        if (!open) {
          setShowBranchDialog(false);
          setEditingBranch(null);
          branchForm.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Edit Branch" : "Add New Branch"}</DialogTitle>
            <DialogDescription>
              {editingBranch ? "Update branch details" : "Create a new branch for your organization"}
            </DialogDescription>
          </DialogHeader>
          <Form {...branchForm}>
            <form onSubmit={branchForm.handleSubmit(handleBranchSubmit)} className="space-y-4">
              <FormField
                control={branchForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Main Branch" data-testid="input-branch-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={branchForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123 Main Street" data-testid="input-branch-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={branchForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+254 700 000000" data-testid="input-branch-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={branchForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="branch@example.com" data-testid="input-branch-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowBranchDialog(false);
                    setEditingBranch(null);
                    branchForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createBranchMutation.isPending || updateBranchMutation.isPending}
                  data-testid="button-save-branch"
                >
                  {createBranchMutation.isPending || updateBranchMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingBranch} onOpenChange={(open) => !open && setDeletingBranch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Branch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingBranch?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingBranch(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteBranchMutation.mutate()}
              disabled={deleteBranchMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteBranchMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
