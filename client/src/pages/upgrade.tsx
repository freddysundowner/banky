import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2, Sparkles, Crown, Mail, Send, Smartphone, CheckCircle2, CreditCard, Globe, Building, Hash, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface Plan {
  id: string;
  name: string;
  plan_type: string;
  pricing_model: string;
  monthly_price: number;
  annual_price: number;
  usd_monthly_price: number;
  usd_annual_price: number;
  ngn_monthly_price: number;
  ngn_annual_price: number;
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

type Gateway = "mpesa" | "stripe" | "paystack";
type PaystackChannel = "card" | "bank" | "ussd" | "mobile_money" | "bank_transfer" | "qr";

const PLAN_COLORS: Record<string, { bg: string; border: string }> = {
  starter: { bg: "bg-slate-50", border: "border-slate-200" },
  growth: { bg: "bg-blue-50", border: "border-blue-200" },
  professional: { bg: "bg-purple-50", border: "border-purple-200" },
  enterprise: { bg: "bg-amber-50", border: "border-amber-200" }
};

const PAYSTACK_CHANNELS: { id: PaystackChannel; label: string; icon: typeof CreditCard; description: string }[] = [
  { id: "card", label: "Card", icon: CreditCard, description: "Visa, Mastercard, Verve" },
  { id: "bank_transfer", label: "Bank Transfer", icon: Building, description: "Pay via bank transfer" },
  { id: "ussd", label: "USSD", icon: Hash, description: "Pay with USSD code" },
  { id: "mobile_money", label: "Mobile Money", icon: Smartphone, description: "MTN, Airtel, etc." },
  { id: "qr", label: "QR Code", icon: Wallet, description: "Scan to pay" },
];

function getPlanPrice(plan: Plan, gateway: Gateway, period: "monthly" | "annual"): number {
  if (gateway === "stripe") {
    return period === "annual" && plan.usd_annual_price > 0 ? plan.usd_annual_price : plan.usd_monthly_price;
  }
  if (gateway === "paystack") {
    return period === "annual" && plan.ngn_annual_price > 0 ? plan.ngn_annual_price : plan.ngn_monthly_price;
  }
  return period === "annual" && plan.annual_price > 0 ? plan.annual_price : plan.monthly_price;
}

function getCurrencySymbol(gateway: Gateway): string {
  if (gateway === "stripe") return "$";
  if (gateway === "paystack") return "NGN ";
  return "KES ";
}

function formatPrice(amount: number, gateway: Gateway): string {
  const sym = getCurrencySymbol(gateway);
  return `${sym}${amount.toLocaleString()}`;
}

function hasAnnualForGateway(plan: Plan, gateway: Gateway): boolean {
  if (gateway === "stripe") return plan.usd_annual_price > 0;
  if (gateway === "paystack") return plan.ngn_annual_price > 0;
  return plan.annual_price > 0;
}

export default function UpgradePage({ organizationId }: UpgradePageProps) {
  const { toast } = useToast();
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [gateway, setGateway] = useState<Gateway>("mpesa");
  const [paystackChannel, setPaystackChannel] = useState<PaystackChannel>("card");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "sending" | "waiting" | "success" | "failed">("idle");
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", organization: "", message: "" });
  const [isSending, setIsSending] = useState(false);

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["plans", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/plans`, { credentials: "include" });
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
          toast({ title: "Payment Successful!", description: "Your subscription has been activated." });
        } else if (data.status === "failed") {
          setPaymentStatus("failed");
          clearInterval(interval);
        }
      } catch {}
    }, 3000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (paymentStatus === "waiting") {
        setPaymentStatus("idle");
        toast({ title: "Payment Timeout", description: "We haven't received confirmation yet. If you paid, it may take a moment to process.", variant: "destructive" });
      }
    }, 120000);

    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [paymentStatus, currentPaymentId, organizationId]);

  const handlePay = async () => {
    if (!selectedPlan) return;

    setPaymentStatus("sending");

    try {
      let res: Response;

      if (gateway === "mpesa") {
        if (!phone) return setPaymentStatus("idle");
        res = await fetch(`/api/organizations/${organizationId}/subscription/pay-mpesa`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ plan_id: selectedPlan.id, phone, billing_period: billingPeriod })
        });
      } else if (gateway === "stripe") {
        res = await fetch(`/api/organizations/${organizationId}/subscription/pay-stripe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ plan_id: selectedPlan.id, billing_period: billingPeriod })
        });
      } else {
        if (!email) return setPaymentStatus("idle");
        res = await fetch(`/api/organizations/${organizationId}/subscription/pay-paystack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            plan_id: selectedPlan.id,
            email,
            billing_period: billingPeriod,
            channels: [paystackChannel]
          })
        });
      }

      const data = await res.json();

      if (!res.ok) {
        setPaymentStatus("failed");
        toast({ title: "Payment Failed", description: data.detail || "Failed to initiate payment", variant: "destructive" });
        return;
      }

      setCurrentPaymentId(data.payment_id);
      setPaymentStatus("waiting");

      if (gateway === "mpesa") {
        toast({ title: "Check Your Phone", description: data.message || "Enter your M-Pesa PIN to confirm" });
      } else if (gateway === "stripe" && data.checkout_url) {
        window.open(data.checkout_url, "_blank");
        toast({ title: "Stripe Checkout Opened", description: "Complete your payment in the new tab." });
      } else if (gateway === "paystack" && data.authorization_url) {
        window.open(data.authorization_url, "_blank");
        toast({ title: "Payment Page Opened", description: "Complete your payment in the new tab." });
      }
    } catch {
      setPaymentStatus("failed");
      toast({ title: "Error", description: "Failed to initiate payment. Please try again.", variant: "destructive" });
    }
  };

  const openPaymentDialog = (plan: Plan) => {
    setSelectedPlan(plan);
    setBillingPeriod("monthly");
    setGateway("mpesa");
    setPaystackChannel("card");
    setPhone("");
    setEmail("");
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
        toast({ title: "Inquiry Sent", description: data.message || "We'll get back to you soon!" });
        setShowContactDialog(false);
        setContactForm({ name: "", email: "", organization: "", message: "" });
      } else {
        toast({ title: "Error", description: data.error || "Failed to send inquiry.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send inquiry. Please try again later.", variant: "destructive" });
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

  const saasPlans = plans?.filter(p => p.pricing_model === "saas") || plans || [];
  const paymentAmount = selectedPlan ? getPlanPrice(selectedPlan, gateway, billingPeriod) : 0;
  const showAnnual = selectedPlan ? hasAnnualForGateway(selectedPlan, gateway) : false;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Subscription Plans</h1>
        <p className="text-sm md:text-base text-muted-foreground">Choose the plan that best fits your organization's needs</p>
      </div>

      <div className="grid gap-4 md:gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}>
        {saasPlans.map((plan) => {
          const colors = PLAN_COLORS[plan.plan_type] || PLAN_COLORS.starter;
          const isPopular = plan.plan_type === "growth";

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col mt-4 ${plan.is_current ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md transition-shadow"}`}
            >
              {plan.is_current && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-primary text-primary-foreground shadow-sm whitespace-nowrap">
                    <Crown className="w-3 h-3 mr-1" />Current Plan
                  </Badge>
                </div>
              )}
              {isPopular && !plan.is_current && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-blue-600 text-white shadow-sm whitespace-nowrap">
                    <Sparkles className="w-3 h-3 mr-1" />Popular
                  </Badge>
                </div>
              )}

              <CardHeader className={`${colors.bg} rounded-t-lg border-b ${colors.border} p-4 md:p-6`}>
                <CardTitle className="text-base md:text-lg capitalize">{plan.name}</CardTitle>
                <CardDescription className="pt-2">
                  <span className="text-2xl md:text-3xl font-bold text-foreground">
                    KES {plan.monthly_price.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </CardDescription>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {plan.usd_monthly_price > 0 && (
                    <span className="text-xs text-muted-foreground">${plan.usd_monthly_price}/mo</span>
                  )}
                  {plan.ngn_monthly_price > 0 && (
                    <span className="text-xs text-muted-foreground">NGN {plan.ngn_monthly_price.toLocaleString()}/mo</span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 pt-4 md:pt-6 p-4 md:p-6">
                <div className="space-y-4 md:space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Limits</h4>
                    <div className="grid grid-cols-1 gap-1.5 text-sm">
                      <div className="flex justify-between py-1 px-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground text-xs md:text-sm">Members</span>
                        <span className="font-medium text-xs md:text-sm">{plan.max_members >= 999999 ? "Unlimited" : plan.max_members.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1 px-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground text-xs md:text-sm">Staff</span>
                        <span className="font-medium text-xs md:text-sm">{plan.max_staff >= 999999 ? "Unlimited" : plan.max_staff}</span>
                      </div>
                      <div className="flex justify-between py-1 px-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground text-xs md:text-sm">Branches</span>
                        <span className="font-medium text-xs md:text-sm">{plan.max_branches >= 999999 ? "Unlimited" : plan.max_branches}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Features</h4>
                    <ul className="space-y-1.5">
                      {(plan.features?.enabled || []).slice(0, 6).map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs md:text-sm">
                          <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="break-words min-w-0">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>

              <div className="p-4 md:p-6 pt-0 mt-auto">
                {plan.is_current ? (
                  <Button className="w-full" size="lg" variant="outline" disabled>Current Plan</Button>
                ) : (
                  <Button className="w-full" size="lg" variant={plan.is_upgrade ? "default" : "secondary"} onClick={() => openPaymentDialog(plan)}>
                    {plan.is_upgrade ? "Upgrade Now" : plan.is_downgrade ? "Switch Plan" : "Select Plan"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 md:py-6">
          <div className="text-center sm:text-left">
            <h3 className="text-base md:text-lg font-semibold">Need a custom solution?</h3>
            <p className="text-slate-300 text-xs md:text-sm">Contact our sales team for Enterprise pricing and custom development options.</p>
          </div>
          <Button variant="secondary" className="whitespace-nowrap w-full sm:w-auto" onClick={() => setShowContactDialog(true)}>
            <Mail className="h-4 w-4 mr-2" />Contact Sales
          </Button>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => {
        if (!open && paymentStatus === "waiting") return;
        setShowPaymentDialog(open);
        if (!open) { setPaymentStatus("idle"); setCurrentPaymentId(null); }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscribe to {selectedPlan?.name}</DialogTitle>
            <DialogDescription>Choose your preferred payment method</DialogDescription>
          </DialogHeader>

          {paymentStatus === "success" ? (
            <div className="flex flex-col items-center py-6 gap-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div className="text-center">
                <h3 className="text-lg font-semibold">Payment Successful!</h3>
                <p className="text-sm text-muted-foreground mt-1">Your {selectedPlan?.name} subscription is now active.</p>
              </div>
              <Button onClick={() => setShowPaymentDialog(false)} className="mt-2">Done</Button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Step 1: Gateway Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Gateway</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "mpesa" as Gateway, label: "M-Pesa", sub: "KES", icon: Smartphone, color: "text-green-600" },
                    { id: "paystack" as Gateway, label: "Paystack", sub: "NGN", icon: Globe, color: "text-blue-600" },
                    { id: "stripe" as Gateway, label: "Stripe", sub: "USD", icon: CreditCard, color: "text-purple-600" },
                  ]).map((g) => {
                    const Icon = g.icon;
                    const active = gateway === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => { setGateway(g.id); setPaymentStatus("idle"); setBillingPeriod("monthly"); }}
                        disabled={paymentStatus === "sending" || paymentStatus === "waiting"}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                          active ? "border-primary bg-primary/5 shadow-sm" : "border-muted hover:border-muted-foreground/30"
                        } ${paymentStatus === "sending" || paymentStatus === "waiting" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <Icon className={`h-5 w-5 ${active ? g.color : "text-muted-foreground"}`} />
                        <span className="text-xs font-semibold">{g.label}</span>
                        <span className="text-[10px] text-muted-foreground">{g.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Paystack Channel Selection */}
              {gateway === "paystack" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYSTACK_CHANNELS.map((ch) => {
                      const Icon = ch.icon;
                      const active = paystackChannel === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setPaystackChannel(ch.id)}
                          disabled={paymentStatus === "sending" || paymentStatus === "waiting"}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left ${
                            active ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"
                          } ${paymentStatus === "sending" || paymentStatus === "waiting" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{ch.label}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{ch.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price Display */}
              {selectedPlan && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{selectedPlan.name} Plan</span>
                    <Badge variant="outline" className="capitalize">{billingPeriod}</Badge>
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {formatPrice(paymentAmount, gateway)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{billingPeriod === "annual" ? "year" : "month"}
                    </span>
                  </div>
                  {paymentAmount === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Price not set for this currency. Contact admin.
                    </p>
                  )}
                </div>
              )}

              {/* Billing Period */}
              {showAnnual && (
                <div className="space-y-2">
                  <Label>Billing Period</Label>
                  <Select value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as "monthly" | "annual")} disabled={paymentStatus !== "idle"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">
                        Monthly ({formatPrice(selectedPlan ? getPlanPrice(selectedPlan, gateway, "monthly") : 0, gateway)}/mo)
                      </SelectItem>
                      <SelectItem value="annual">
                        Annual ({formatPrice(selectedPlan ? getPlanPrice(selectedPlan, gateway, "annual") : 0, gateway)}/yr)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* M-Pesa: Phone Number */}
              {gateway === "mpesa" && (
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
                  <p className="text-xs text-muted-foreground">A payment prompt will be sent to this number</p>
                </div>
              )}

              {/* Paystack: Email */}
              {gateway === "paystack" && (
                <div className="space-y-2">
                  <Label htmlFor="paystack-email">Email Address</Label>
                  <Input
                    id="paystack-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={paymentStatus !== "idle" && paymentStatus !== "failed"}
                  />
                  <p className="text-xs text-muted-foreground">Paystack will send a receipt to this email</p>
                </div>
              )}

              {/* Status Messages */}
              {paymentStatus === "waiting" && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      {gateway === "mpesa" ? "Waiting for M-Pesa confirmation..." : "Waiting for payment confirmation..."}
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      {gateway === "mpesa" ? "Check your phone and enter your M-Pesa PIN" : "Complete the payment in the opened tab"}
                    </p>
                  </div>
                </div>
              )}

              {paymentStatus === "failed" && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300">Payment failed or was cancelled. Please try again.</p>
                </div>
              )}

              {/* Pay Button */}
              <Button
                className="w-full"
                size="lg"
                disabled={
                  (gateway === "mpesa" && !phone) ||
                  (gateway === "paystack" && !email) ||
                  paymentStatus === "sending" ||
                  paymentStatus === "waiting" ||
                  paymentAmount === 0
                }
                onClick={handlePay}
              >
                {paymentStatus === "sending" ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
                ) : paymentStatus === "waiting" ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Awaiting payment...</>
                ) : (
                  <>
                    {gateway === "mpesa" && <Smartphone className="h-4 w-4 mr-2" />}
                    {gateway === "stripe" && <CreditCard className="h-4 w-4 mr-2" />}
                    {gateway === "paystack" && <Globe className="h-4 w-4 mr-2" />}
                    Pay {formatPrice(paymentAmount, gateway)}
                    {gateway === "stripe" && " with Card"}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contact Sales Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Contact Sales</DialogTitle>
            <DialogDescription>Fill out the form below and we'll get back to you about Enterprise pricing and custom solutions.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name *</Label>
                <Input id="name" placeholder="John Doe" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cemail">Email Address *</Label>
                <Input id="cemail" type="email" placeholder="john@company.com" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization">Organization Name</Label>
              <Input id="organization" placeholder="Your Sacco or Bank Name" value={contactForm.organization} onChange={(e) => setContactForm({ ...contactForm, organization: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea id="message" placeholder="Tell us about your requirements..." rows={4} value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} required />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowContactDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSending}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Inquiry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
