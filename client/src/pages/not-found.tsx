import { Link } from "wouter";
import { Landmark, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/context/BrandingContext";

export default function NotFound() {
  const { platform_name } = useBranding();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md mb-8">
        <Landmark className="h-8 w-8 text-primary-foreground" />
      </div>

      <div className="text-center max-w-md">
        <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">404</p>
        <h1 className="text-3xl font-bold mb-3">Page not found</h1>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or may have been moved. Everything else is working perfectly fine.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Back to {platform_name || "Dashboard"}
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </Button>
        </div>
      </div>

      <p className="mt-16 text-xs text-muted-foreground">
        {platform_name || "BankyKit"} &mdash; Secure Banking Management
      </p>
    </div>
  );
}
