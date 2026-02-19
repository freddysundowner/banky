import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";
import { useBranding } from "@/context/BrandingContext";

const DEFAULT_PRIVACY = `<section>
<h2>1. Introduction</h2>
<p>We are committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, store, and protect information when you use our platform.</p>
</section>
<section>
<h2>2. Information We Collect</h2>
<p>We collect account information (name, email, phone), organizational data (member records, transactions, staff data), and usage data (login activity, feature usage).</p>
</section>
<section>
<h2>3. Data Isolation &amp; Security</h2>
<p>Each organization's data is stored in a completely separate, isolated database. Data is encrypted at rest and in transit. Role-based access control and audit logging are enforced.</p>
</section>
<section>
<h2>4. How We Use Your Data</h2>
<p>We use your data to provide and maintain the Service, process transactions, send important notifications, provide support, and improve the Service based on anonymized usage patterns.</p>
</section>
<section>
<h2>5. Data Sharing</h2>
<p>We do not sell or rent your data. We may share data only with payment processors, SMS providers, infrastructure providers, or when required by law.</p>
</section>
<section>
<h2>6. Your Rights</h2>
<p>You have the right to access, correct, delete, and export your data. You may withdraw consent for optional data processing at any time.</p>
</section>
<section>
<h2>7. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of significant changes at least 30 days before they take effect.</p>
</section>`;

export default function PrivacyPage() {
  const { platform_name } = useBranding();
  const [content, setContent] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/public/legal/privacy")
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

  const displayContent = content || DEFAULT_PRIVACY;
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
          <Shield className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">{platform_name} Privacy Policy</h1>
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
