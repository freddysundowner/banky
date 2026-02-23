import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Landmark, Eye, EyeOff, ShieldCheck, Users, CreditCard, BarChart3, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useBranding } from "@/context/BrandingContext";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const IS_DEMO = import.meta.env.VITE_PRODUCTION_MODE === "demo";
const DEMO_PASSWORD = "Demo@1234";
const DEMO_ACCOUNTS = [
  { role: "Owner", email: "demo@demo.bankykit" },
  { role: "Admin", email: "alice@demo.bankykit" },
  { role: "Loan Officer", email: "bob@demo.bankykit" },
  { role: "Teller", email: "carol@demo.bankykit" },
  { role: "HR Officer", email: "dave@demo.bankykit" },
  { role: "Kiosk / Queue", email: "eve@demo.bankykit" },
];

const FEATURES = [
  { icon: Users, text: "Member & account management" },
  { icon: CreditCard, text: "Loan processing & repayments" },
  { icon: BarChart3, text: "Real-time reports & analytics" },
  { icon: ShieldCheck, text: "Role-based access control" },
];

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { platform_name, guide_url } = useBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: IS_DEMO ? DEMO_ACCOUNTS[0].email : "",
      password: IS_DEMO ? DEMO_PASSWORD : "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      return apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: async () => {
      setIsLoggingIn(true);
      setLoadingProgress(20);
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      setLoadingProgress(50);
      await queryClient.prefetchQuery({ queryKey: ["/api/organizations/my"] });
      setLoadingProgress(80);
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
      setLoadingProgress(100);
      setTimeout(() => navigate("/"), 200);
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password.",
        variant: "destructive",
      });
    },
  });

  if (isLoggingIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg mb-6">
          <Landmark className="h-9 w-9 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-1">{platform_name}</h1>
        <p className="text-muted-foreground mb-8 text-sm">Verifying your credentials...</p>
        <div className="w-56">
          <Progress value={loadingProgress} className="h-1.5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[42%] bg-primary flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-blue-800 opacity-100" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
              <Landmark className="h-6 w-6 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">{platform_name}</span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Modern banking<br />management platform
          </h2>
          <p className="text-blue-100 text-base mb-10 leading-relaxed max-w-sm">
            A complete solution for banks and SACCOs — managing members, loans, teller operations, and more from one place.
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-blue-50 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-blue-200 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Bank-grade security · Multi-tenant architecture · Role-based access</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-8 bg-background overflow-y-auto">
        <div className="w-full max-w-[500px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Landmark className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">{platform_name}</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-1">Sign in to your account</h1>
            <p className="text-muted-foreground text-sm">Enter your credentials to access the dashboard</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Email address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        className="h-11"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm font-medium">Password</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-primary hover:underline"
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="h-11 pr-10"
                          {...field}
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 font-semibold mt-2"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline" data-testid="link-register">
              Create one
            </Link>
          </p>

          {IS_DEMO && (
            <div className="mt-6 border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Try a demo account</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click any role below · Password: <span className="font-mono font-semibold text-foreground" data-testid="text-demo-password">{DEMO_PASSWORD}</span>
                </p>
              </div>
              <div className="grid grid-cols-2">
                {DEMO_ACCOUNTS.map((account, i) => (
                  <button
                    key={account.email}
                    type="button"
                    data-testid={`button-demo-${account.role.toLowerCase().replace(/[\s/]+/g, "-")}`}
                    className={`flex flex-col items-start px-4 py-3 text-left hover:bg-muted/70 transition-colors
                      ${i % 2 === 0 ? "border-r border-border" : ""}
                      ${i < DEMO_ACCOUNTS.length - 2 ? "border-b border-border" : ""}
                    `}
                    onClick={() => {
                      form.setValue("email", account.email);
                      form.setValue("password", DEMO_PASSWORD);
                    }}
                  >
                    <span className="text-sm font-medium text-foreground">{account.role}</span>
                    <span
                      className="font-mono text-xs text-muted-foreground truncate w-full mt-0.5"
                      data-testid={`text-demo-email-${account.role.toLowerCase().replace(/[\s/]+/g, "-")}`}
                    >
                      {account.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Lock className="h-3 w-3" />
              <span>Secured with end-to-end encryption</span>
            </div>
            {guide_url && (
              <a
                href={guide_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
                data-testid="link-view-guide"
              >
                View Documentation Guide
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
