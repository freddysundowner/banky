import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDialog } from "@/hooks/use-app-dialog";
import { apiRequest } from "@/lib/queryClient";
import { Landmark, CheckCircle, XCircle, Mail, Loader2 } from "lucide-react";
import { useBranding } from "@/context/BrandingContext";
import { useAuth } from "@/hooks/use-auth";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useAppDialog();
  const { platform_name } = useBranding();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [verificationState, setVerificationState] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const token = new URLSearchParams(searchString).get("token");

  useEffect(() => {
    if (token && verificationState === "idle") {
      setVerificationState("verifying");
      fetch(`/api/auth/verify-email/${token}`, { credentials: "include" })
        .then(async (res) => {
          if (res.ok) {
            setVerificationState("success");
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          } else {
            const data = await res.json().catch(() => ({}));
            setErrorMessage(data.detail || "Invalid or expired verification token");
            setVerificationState("error");
          }
        })
        .catch(() => {
          setErrorMessage("Something went wrong. Please try again.");
          setVerificationState("error");
        });
    }
  }, [token, verificationState]);

  const resendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/send-verification-email");
    },
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: "Please check your inbox for the verification link.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send email",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/skip-email-verification");
    },
    onSuccess: () => {
      navigate("/");
    },
  });

  if (token && verificationState === "verifying") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary mb-4">
              <Landmark className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">{platform_name}</h1>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground" data-testid="text-verifying">Verifying your email...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (token && verificationState === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary mb-4">
              <Landmark className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">{platform_name}</h1>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center py-10">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2" data-testid="text-verification-success">Email Verified</h2>
              <p className="text-muted-foreground text-center mb-6">
                Your email address has been verified successfully.
              </p>
              <Button onClick={() => navigate("/")} data-testid="button-continue-dashboard">
                Continue to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (token && verificationState === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary mb-4">
              <Landmark className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">{platform_name}</h1>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center py-10">
              <XCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2" data-testid="text-verification-error">Verification Failed</h2>
              <p className="text-muted-foreground text-center mb-6">
                {errorMessage}
              </p>
              {user && (
                <Button
                  onClick={() => resendMutation.mutate()}
                  disabled={resendMutation.isPending}
                  data-testid="button-resend-verification"
                >
                  {resendMutation.isPending ? "Sending..." : "Resend Verification Email"}
                </Button>
              )}
              <Link href="/" className="text-sm text-muted-foreground hover:underline mt-4">
                Go to Dashboard
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary mb-4">
              <Landmark className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">{platform_name}</h1>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center py-10">
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Please Sign In</h2>
              <p className="text-muted-foreground text-center mb-6">
                Sign in to your account to verify your email or resend the verification link.
              </p>
              <Button onClick={() => navigate("/login")} data-testid="button-go-to-login">
                Sign In
              </Button>
            </CardContent>
          </Card>
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
          <h1 className="text-2xl font-bold">Verify Your Email</h1>
          <p className="text-muted-foreground mt-1">Complete your {platform_name} account setup</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Check Your Inbox
            </CardTitle>
            <CardDescription>
              We've sent a verification email to your email address. Please check your inbox and click the verification link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
              data-testid="button-resend-verification"
            >
              {resendMutation.isPending ? "Sending..." : "Resend Verification Email"}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => skipMutation.mutate()}
              disabled={skipMutation.isPending}
              data-testid="button-skip-verification"
            >
              {skipMutation.isPending ? "..." : "Set up later"}
            </Button>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
