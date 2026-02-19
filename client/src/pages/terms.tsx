import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";
import { useBranding } from "@/context/BrandingContext";

const DEFAULT_TERMS = `<section>
<h2>1. Acceptance of Terms</h2>
<p>By accessing or using this platform ("the Service"), you agree to be bound by these Terms of Service.</p>
</section>
<section>
<h2>2. Description of Service</h2>
<p>This platform provides a cloud-based banking and Sacco management platform that enables organizations to manage members, loans, savings, fixed deposits, dividends, and other financial operations.</p>
</section>
<section>
<h2>3. Account Registration</h2>
<p>To use the Service, you must create an account and provide accurate, complete information. You are responsible for maintaining the confidentiality of your account credentials and all activities that occur under your account.</p>
</section>
<section>
<h2>4. Subscription Plans &amp; Billing</h2>
<p>The Service offers multiple subscription tiers. Subscriptions renew automatically unless cancelled. Prices are denominated in USD. Refunds are handled on a case-by-case basis within 30 days of payment.</p>
</section>
<section>
<h2>5. Data Ownership &amp; Privacy</h2>
<p>You retain all ownership rights to your data. Each organization's data is stored in an isolated database. We will not access, share, or sell your data except as necessary to provide the Service or as required by law.</p>
</section>
<section>
<h2>6. Acceptable Use</h2>
<p>You agree not to use the Service for any unlawful purpose, attempt unauthorized access, interfere with the Service, or reverse engineer the platform.</p>
</section>
<section>
<h2>7. Limitation of Liability</h2>
<p>To the maximum extent permitted by law, this platform shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of the Service.</p>
</section>
<section>
<h2>8. Changes to Terms</h2>
<p>We may update these terms from time to time. We will notify you of significant changes via email or in-app notification at least 30 days before they take effect.</p>
</section>`;

export default function TermsPage() {
  const { platform_name } = useBranding();
  const [content, setContent] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/public/legal/terms")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.content) {
          setContent(data.content);
          setLastUpdated(data.last_updated || "");
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const displayContent = content || DEFAULT_TERMS;
  const displayDate = lastUpdated || "February 2026";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="w-full px-6 sm:px-10 py-10">
        <div className="mb-6">
          <Link href="/register" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to registration
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">{platform_name} Terms of Service</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {displayDate}</p>

        <div
          className="bg-card border border-border rounded-xl p-6 sm:p-8 prose prose-sm max-w-none
            [&_section]:mb-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-2
            [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mb-1.5
            [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-2
            [&_ul]:list-disc [&_ul]:list-inside [&_ul]:text-muted-foreground [&_ul]:space-y-1 [&_ul]:ml-4
            [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:text-muted-foreground [&_ol]:space-y-1 [&_ol]:ml-4
            [&_li]:text-muted-foreground
            [&_a]:text-primary [&_a:hover]:underline
            [&_strong]:text-foreground"
          dangerouslySetInnerHTML={{ __html: displayContent }}
        />
      </div>
    </div>
  );
}
