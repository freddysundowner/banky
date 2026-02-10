import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Loader2, Sparkles, Crown, Mail, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface Plan {
  id: string;
  name: string;
  plan_type: string;
  pricing_model: string;
  monthly_price: number;
  annual_price: number;
  max_members: number;
  max_staff: number;
  max_branches: number;
  features: { enabled?: string[] };
  is_current: boolean;
  is_upgrade: boolean;
  is_downgrade: boolean;
}

interface UpgradePageProps {
  organizationId: string;
}


const PLAN_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  starter: { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-100 text-slate-700" },
  growth: { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
  professional: { bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700" },
  enterprise: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" }
};

export default function UpgradePage({ organizationId }: UpgradePageProps) {
  const { toast } = useToast();
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    organization: "",
    message: ""
  });
  const [isSending, setIsSending] = useState(false);

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["plans", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/plans`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    }
  });

  const { data: branding } = useQuery<{ sales_email?: string; platform_name?: string }>({
    queryKey: ["public-branding"],
    queryFn: async () => {
      const res = await fetch("/api/public/branding");
      if (!res.ok) return {};
      return res.json();
    }
  });

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    
    try {
      const res = await fetch("/api/public/sales-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm)
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "Inquiry Sent",
          description: data.message || "We'll get back to you soon!"
        });
        setShowContactDialog(false);
        setContactForm({ name: "", email: "", organization: "", message: "" });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to send inquiry. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send inquiry. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const upgradeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_id: planId })
      });
      if (!res.ok) throw new Error("Failed to upgrade");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Plan Updated",
        description: data.message
      });
      queryClient.invalidateQueries({ queryKey: ["plans", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "features"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update plan. Please try again.",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const saasPlans = plans?.filter(p => p.pricing_model === 'saas') || plans || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <p className="text-muted-foreground">Choose the plan that best fits your organization's needs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {saasPlans.map((plan) => {
          const colors = PLAN_COLORS[plan.plan_type] || PLAN_COLORS.starter;
          const isPopular = plan.plan_type === 'growth';
          
          return (
            <Card 
              key={plan.id} 
              className={`relative flex flex-col ${plan.is_current ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md transition-shadow'}`}
            >
              {plan.is_current && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground shadow-sm">
                    <Crown className="w-3 h-3 mr-1" />
                    Current Plan
                  </Badge>
                </div>
              )}
              {isPopular && !plan.is_current && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white shadow-sm">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className={`${colors.bg} rounded-t-lg border-b ${colors.border}`}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg capitalize">{plan.name}</CardTitle>
                </div>
                <CardDescription className="pt-2">
                  <span className="text-3xl font-bold text-foreground">${plan.monthly_price}</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
                {plan.annual_price > 0 && (
                  <p className="text-xs text-muted-foreground">
                    or ${plan.annual_price}/year (save {Math.round((1 - plan.annual_price / (plan.monthly_price * 12)) * 100)}%)
                  </p>
                )}
              </CardHeader>
              
              <CardContent className="flex-1 pt-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Limits</h4>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between py-1.5 px-3 bg-muted/50 rounded">
                        <span className="text-muted-foreground">Members</span>
                        <span className="font-medium">
                          {plan.max_members >= 999999 ? 'Unlimited' : plan.max_members.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 px-3 bg-muted/50 rounded">
                        <span className="text-muted-foreground">Staff</span>
                        <span className="font-medium">
                          {plan.max_staff >= 999999 ? 'Unlimited' : plan.max_staff}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 px-3 bg-muted/50 rounded">
                        <span className="text-muted-foreground">Branches</span>
                        <span className="font-medium">
                          {plan.max_branches >= 999999 ? 'Unlimited' : plan.max_branches}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Features</h4>
                    <ul className="space-y-2">
                      {(plan.features?.enabled || []).slice(0, 6).map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>

              <div className="p-6 pt-0 mt-auto">
                <Button
                  className="w-full"
                  size="lg"
                  variant={plan.is_current ? "outline" : plan.is_upgrade ? "default" : "secondary"}
                  disabled={plan.is_current || upgradeMutation.isPending}
                  onClick={() => upgradeMutation.mutate(plan.id)}
                >
                  {upgradeMutation.isPending && upgradeMutation.variables === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {plan.is_current ? "Current Plan" : 
                   plan.is_upgrade ? "Upgrade Now" : 
                   plan.is_downgrade ? "Downgrade" : "Select Plan"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4 py-6">
          <div>
            <h3 className="text-lg font-semibold">Need a custom solution?</h3>
            <p className="text-slate-300 text-sm">
              Contact our sales team for Enterprise pricing and custom development options.
            </p>
          </div>
          <Button 
            variant="secondary" 
            className="whitespace-nowrap"
            onClick={() => setShowContactDialog(true)}
          >
            <Mail className="h-4 w-4 mr-2" />
            Contact Sales
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Sales
            </DialogTitle>
            <DialogDescription>
              Fill out the form below and we'll get back to you about Enterprise pricing and custom solutions.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@company.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="organization">Organization Name</Label>
              <Input
                id="organization"
                placeholder="Your Sacco or Bank Name"
                value={contactForm.organization}
                onChange={(e) => setContactForm({ ...contactForm, organization: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                placeholder="Tell us about your requirements, expected member count, features you need, etc."
                rows={4}
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                required
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowContactDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSending}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Inquiry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
