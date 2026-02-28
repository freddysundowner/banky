import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppDialog } from "@/hooks/use-app-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, CheckCircle2, Users, CreditCard, UserPlus } from "lucide-react";
import { CURRENCIES } from "@/lib/currency";

interface OnboardingWizardProps {
  organizationId: string;
  organizationName: string;
  onComplete: () => void;
  onFinalize: (needsBranch: boolean) => void;
}


export function OnboardingWizard({ organizationId, organizationName, onComplete, onFinalize }: OnboardingWizardProps) {
  const { toast } = useAppDialog();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  const [orgDetails, setOrgDetails] = useState({
    name: organizationName,
    currency: "KES",
    email: "",
    phone: "",
  });

  const [branchDetails, setBranchDetails] = useState({
    name: "Head Office",
    code: "HO",
    address: "",
  });

  const [completedSteps, setCompletedSteps] = useState({
    orgUpdated: false,
    branchCreated: false,
  });

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/organizations/${organizationId}`, {
        name: orgDetails.name,
        currency: orgDetails.currency,
        email: orgDetails.email || undefined,
        phone: orgDetails.phone || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my"] });
      setCompletedSteps(prev => ({ ...prev, orgUpdated: true }));
      setStep(2);
    },
    onError: () => {
      toast({ title: "Failed to update organization details", variant: "destructive" });
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/organizations/${organizationId}/branches`, {
        name: branchDetails.name,
        code: branchDetails.code,
        address: branchDetails.address || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "branches"] });
      setCompletedSteps(prev => ({ ...prev, branchCreated: true }));
      setStep(3);
    },
    onError: () => {
      toast({ title: "Failed to create branch", variant: "destructive" });
    },
  });

  const handleExit = (needsBranch: boolean) => {
    localStorage.setItem(`onboarding_dismissed_${organizationId}`, "true");
    onFinalize(needsBranch);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleExit(!completedSteps.branchCreated); }}>
      <DialogContent className="sm:max-w-lg" data-testid="onboarding-wizard">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle data-testid="onboarding-title">
                {step === 1 && "Organization Details"}
                {step === 2 && "Create Your First Branch"}
                {step === 3 && "You're All Set!"}
              </DialogTitle>
              <DialogDescription data-testid="onboarding-step-indicator">
                {step < 3 ? `Step ${step} of 3` : "Setup Complete"}
              </DialogDescription>
            </div>
          </div>
          <div className="flex gap-1 mt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
                data-testid={`onboarding-progress-${s}`}
              />
            ))}
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={orgDetails.name}
                onChange={(e) => setOrgDetails(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your organization name"
                data-testid="input-org-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-currency">Currency</Label>
              <Select
                value={orgDetails.currency}
                onValueChange={(val) => setOrgDetails(prev => ({ ...prev, currency: val }))}
              >
                <SelectTrigger id="org-currency" data-testid="select-org-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} data-testid={`currency-option-${c.code}`}>{c.code} - {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">Organization Email</Label>
              <Input
                id="org-email"
                type="email"
                value={orgDetails.email}
                onChange={(e) => setOrgDetails(prev => ({ ...prev, email: e.target.value }))}
                placeholder="info@yourorganization.com"
                data-testid="input-org-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">Organization Phone</Label>
              <Input
                id="org-phone"
                value={orgDetails.phone}
                onChange={(e) => setOrgDetails(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+254 700 000 000"
                data-testid="input-org-phone"
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => handleExit(!completedSteps.branchCreated)}
                data-testid="button-setup-later"
              >
                Set up later
              </Button>
              <Button
                onClick={() => updateOrgMutation.mutate()}
                disabled={!orgDetails.name || updateOrgMutation.isPending}
                data-testid="button-onboarding-next-1"
              >
                {updateOrgMutation.isPending ? "Saving..." : "Next"}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Create your first branch to start managing operations. You can add more branches later.
            </p>
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                value={branchDetails.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const code = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) || "BR";
                  setBranchDetails(prev => ({ ...prev, name, code }));
                }}
                placeholder="e.g. Head Office"
                data-testid="input-branch-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-address">Branch Address</Label>
              <Input
                id="branch-address"
                value={branchDetails.address}
                onChange={(e) => setBranchDetails(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main Street, City"
                data-testid="input-branch-address"
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  data-testid="button-onboarding-back-2"
                >
                  Back
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleExit(true)}
                  data-testid="button-skip-branch"
                >
                  Skip this step
                </Button>
              </div>
              <Button
                onClick={() => createBranchMutation.mutate()}
                disabled={!branchDetails.name || createBranchMutation.isPending}
                data-testid="button-onboarding-next-2"
              >
                {createBranchMutation.isPending ? "Creating..." : "Next"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-base font-medium mb-1">Setup Complete</p>
              <p className="text-sm text-muted-foreground">
                Your organization is ready to go. Here's what was configured:
              </p>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                {completedSteps.orgUpdated ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                )}
                <span className="text-sm" data-testid="checklist-org-details">Organization details updated</span>
              </div>
              <div className="flex items-center gap-2">
                {completedSteps.branchCreated ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                )}
                <span className="text-sm" data-testid="checklist-branch">First branch created</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Links</p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => handleExit(false)}
                  data-testid="link-add-staff"
                >
                  <Users className="h-4 w-4" />
                  Add Staff Members
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => handleExit(false)}
                  data-testid="link-create-loan-products"
                >
                  <CreditCard className="h-4 w-4" />
                  Create Loan Products
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => handleExit(false)}
                  data-testid="link-register-members"
                >
                  <UserPlus className="h-4 w-4" />
                  Register Members
                </Button>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => handleExit(false)}
              data-testid="button-go-to-dashboard"
            >
              Go to Dashboard
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
