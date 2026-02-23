import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Landmark, Eye, EyeOff } from "lucide-react";
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
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary mb-6">
          <Landmark className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{platform_name}</h1>
        <p className="text-muted-foreground mb-6">Signing you in...</p>
        <div className="w-64">
          <Progress value={loadingProgress} className="h-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary mb-4">
            <Landmark className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Sign in to your {platform_name} account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {IS_DEMO && (
              <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <div className="px-4 pt-3 pb-2">
                  <p className="font-medium text-blue-800 dark:text-blue-300 text-sm">Demo Mode — click a role to log in</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Password for all: <span className="font-mono font-semibold" data-testid="text-demo-password">{DEMO_PASSWORD}</span></p>
                </div>
                <div className="border-t border-blue-200 dark:border-blue-800">
                  {DEMO_ACCOUNTS.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      data-testid={`button-demo-${account.role.toLowerCase().replace(" ", "-")}`}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors text-left border-b border-blue-100 dark:border-blue-900 last:border-b-0"
                      onClick={() => {
                        form.setValue("email", account.email);
                        form.setValue("password", DEMO_PASSWORD);
                      }}
                    >
                      <span className="font-medium text-blue-800 dark:text-blue-300 w-28">{account.role}</span>
                      <span className="font-mono text-xs text-blue-600 dark:text-blue-400" data-testid={`text-demo-email-${account.role.toLowerCase().replace(" ", "-")}`}>{account.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter password"
                            {...field}
                            data-testid="input-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>

            <div className="mt-4 text-center">
              <Link href="/forgot-password" className="text-primary hover:underline text-sm" data-testid="link-forgot-password">
                Forgot password?
              </Link>
            </div>

            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">Don't have an account? </span>
              <Link href="/register" className="text-primary hover:underline" data-testid="link-register">
                Create one
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          {guide_url && (
            <a href={guide_url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:underline" data-testid="link-view-guide">
              View Guide
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
