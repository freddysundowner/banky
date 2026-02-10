import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2, Sparkles, Crown, Mail, Send, Smartphone, CheckCircle2 } from "lucide-react";
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
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [phone, setPhone] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "sending" | "waiting" | "success" | "failed">("idle");
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
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

  useEffect(() => {
    if (paymentStatus !== "waiting" || !currentPaymentId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/organizations/${organizationId}/subscription/check-payment/${currentPaymentId}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "completed") {
          setPaymentStatus("success");
          clearInterval(interval);
          queryClient.invalidateQueries({ queryKey: ["plans", organizationId] });
          queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "features"] });
          toast({
            title: "Payment Successful!",
            description: `Your subscription has been activated. Receipt: ${data.mpesa_receipt || "confirmed"}`
          });
        } else if (data.status === "failed") {
          setPaymentStatus("failed");
          clearInterval(interval);
        }
      } catch {
      }
    }, 3000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (paymentStatus === "waiting") {
        setPaymentStatus("idle");
        toast({
          title: "Payment Timeout",
          description: "We haven't received confirmation yet. If you paid, it may take a moment to process.",
          variant: "destructive"
        });
      }
    }, 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [paymentStatus, currentPaymentId, organizationId]);

  const handlePayWithMpesa = async () => {
    if (!selectedPlan || !phone) return;

    setPaymentStatus("sending");
    try {
      const res = await fetch(`/api/organizations/${organizationId}/subscription/pay-mpesa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          phone: phone,
          billing_period: billingPeriod
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setPaymentStatus("failed");
        toast({
          title: "Payment Failed",
          description: data.detail || "Failed to initiate payment",
          variant: "destructive"
        });
        return;
      }

      setCurrentPaymentId(data.payment_id);
      setPaymentStatus("waiting");
      toast({
        title: "Check Your Phone",
        description: data.message
      });
    } catch {
      setPaymentStatus("failed");
      toast({
        title: "Error",
        description: "Failed to initiate payment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const openPaymentDialog = (plan: Plan) => {
    setSelectedPlan(plan);
    setBillingPeriod("monthly");
    setPhone("");
    setPaymentStatus("idle");
    setCurrentPaymentId(null);
    setShowPaymentDialog(true);
  };

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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const saasPlans = plans?.filter(p => p.pricing_model === 'saas') || plans || [];
  const paymentAmount = selectedPlan
    ? billingPeriod === "annual" && selectedPlan.annual_price > 0
      ? selectedPlan.annual_price
      : selectedPlan.monthly_price
    : 0;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Subscription Plans</h1>
        <p className="text-sm md:text-base text-muted-foreground">Choose the plan that best fits your organization's needs</p>
      </div>

      <div className="grid gap-4 md:gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))' }}>
        {saasPlans.map((plan) => {
          const colors = PLAN_COLORS[plan.plan_type] || PLAN_COLORS.starter;
          const isPopular = plan.plan_type === 'growth';
          
          return (
            <Card 
              key={plan.id} 
              className={`relative flex flex-col mt-4 ${plan.is_current ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md transition-shadow'}`}
            >
              {plan.is_current && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-primary text-primary-foreground shadow-sm whitespace-nowrap">
                    <Crown className="w-3 h-3 mr-1" />
                    Current Plan
                  </Badge>
                </div>
              )}
              {isPopular && !plan.is_current && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-blue-600 text-white shadow-sm whitespace-nowrap">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className={`${colors.bg} rounded-t-lg border-b ${colors.border} p-4 md:p-6`}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base md:text-lg capitalize">{plan.name}</CardTitle>
                </div>
                <CardDescription className="pt-2">
                  <span className="text-2xl md:text-3xl font-bold text-foreground">${plan.monthly_price}</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </CardDescription>
                {plan.annual_price > 0 && (
                  <p className="text-xs text-muted-foreground">
                    or ${plan.annual_price}/year (save {Math.round((1 - plan.annual_price / (plan.monthly_price * 12)) * 100)}%)
                  </p>
                )}
              </CardHeader>
              
              <CardContent className="flex-1 pt-4 md:pt-6 p-4 md:p-6">
                <div className="space-y-4 md:space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Limits</h4>
                    <div className="grid grid-cols-1 gap-1.5 md:gap-2 text-sm">
                      <div className="flex justify-between py-1 md:py-1.5 px-2 md:px-3 bg-muted/50 rounded">
                        <span className="text-muted-foreground text-xs md:text-sm">Members</span>
                        <span className="font-medium text-xs md:text-sm">
                          {plan.max_members >= 999999 ? 'Unlimited' : plan.max_members.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 md:py-1.5 px-2 md:px-3 bg-muted/50 rounded">
                        <span className="text-muted-foreground text-xs md:text-sm">Staff</span>
                        <span className="font-medium text-xs md:text-sm">
                          {plan.max_staff >= 999999 ? 'Unlimited' : plan.max_staff}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 md:py-1.5 px-2 md:px-3 bg-muted/50 rounded">
                        <span className="text-muted-foreground text-xs md:text-sm">Branches</span>
                        <span className="font-medium text-xs md:text-sm">
                          {plan.max_branches >= 999999 ? 'Unlimited' : plan.max_branches}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Features</h4>
                    <ul className="space-y-1.5 md:space-y-2">
                      {(plan.features?.enabled || []).slice(0, 6).map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm">
                          <Check className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="break-words min-w-0">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>

              <div className="p-4 md:p-6 pt-0 mt-auto">
                {plan.is_current ? (
                  <Button className="w-full" size="lg" variant="outline" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    variant={plan.is_upgrade ? "default" : "secondary"}
                    onClick={() => openPaymentDialog(plan)}
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    {plan.is_upgrade ? "Upgrade with M-Pesa" : 
                     plan.is_downgrade ? "Switch Plan" : "Select Plan"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4 p-4 md:py-6">
          <div className="text-center sm:text-left">
            <h3 className="text-base md:text-lg font-semibold">Need a custom solution?</h3>
            <p className="text-slate-300 text-xs md:text-sm">
              Contact our sales team for Enterprise pricing and custom development options.
            </p>
          </div>
          <Button 
            variant="secondary" 
            className="whitespace-nowrap w-full sm:w-auto"
            onClick={() => setShowContactDialog(true)}
          >
            <Mail className="h-4 w-4 mr-2" />
            Contact Sales
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showPaymentDialog} onOpenChange={(open) => {
        if (!open && paymentStatus === "waiting") return;
        setShowPaymentDialog(open);
        if (!open) {
          setPaymentStatus("idle");
          setCurrentPaymentId(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-green-600" />
              Pay with M-Pesa
            </DialogTitle>
            <DialogDescription>
              {selectedPlan && `Subscribe to ${selectedPlan.name} plan`}
            </DialogDescription>
          </DialogHeader>

          {paymentStatus === "success" ? (
            <div className="flex flex-col items-center py-6 gap-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div className="text-center">
                <h3 className="text-lg font-semibold">Payment Successful!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your {selectedPlan?.name} subscription is now active.
                </p>
              </div>
              <Button onClick={() => setShowPaymentDialog(false)} className="mt-2">
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedPlan && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{selectedPlan.name} Plan</span>
                    <Badge variant="outline" className="capitalize">{billingPeriod}</Badge>
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    KES {paymentAmount.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{billingPeriod === "annual" ? "year" : "month"}
                    </span>
                  </div>
                </div>
              )}

              {selectedPlan && selectedPlan.annual_price > 0 && (
                <div className="space-y-2">
                  <Label>Billing Period</Label>
                  <Select value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as "monthly" | "annual")} disabled={paymentStatus !== "idle"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly (${selectedPlan.monthly_price}/mo)</SelectItem>
                      <SelectItem value="annual">
                        Annual (${selectedPlan.annual_price}/yr - Save {Math.round((1 - selectedPlan.annual_price / (selectedPlan.monthly_price * 12)) * 100)}%)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
                <Input
                  id="mpesa-phone"
                  type="tel"
                  placeholder="0712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={paymentStatus !== "idle" && paymentStatus !== "failed"}
                />
                <p className="text-xs text-muted-foreground">
                  A payment prompt will be sent to this number
                </p>
              </div>

              {paymentStatus === "waiting" && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Waiting for M-Pesa confirmation...
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      Check your phone and enter your M-Pesa PIN
                    </p>
                  </div>
                </div>
              )}

              {paymentStatus === "failed" && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Payment failed or was cancelled. Please try again.
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                disabled={!phone || paymentStatus === "sending" || paymentStatus === "waiting"}
                onClick={handlePayWithMpesa}
              >
                {paymentStatus === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending to phone...
                  </>
                ) : paymentStatus === "waiting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Awaiting payment...
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4 mr-2" />
                    Pay KES {paymentAmount.toLocaleString()} via M-Pesa
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
