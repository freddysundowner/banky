import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Shield } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const DEFAULT_PRIVACY = `<section>
<h2>1. Introduction</h2>
<p>We are committed to protecting the privacy of our users and their members' data. This Privacy Policy explains how we collect, use, store, and protect information when you use our banking and Sacco management platform.</p>
</section>
<section>
<h2>2. Information We Collect</h2>
<h3>Account Information</h3>
<ul>
<li>Name, email address, and phone number during registration</li>
<li>Organization name and details</li>
<li>Billing and payment information for subscription management</li>
</ul>
<h3>Organizational Data</h3>
<ul>
<li>Member records including personal details, KYC documents, and account information</li>
<li>Financial transaction records (deposits, withdrawals, loans, repayments)</li>
<li>Staff and branch management data</li>
<li>Accounting records and reports</li>
</ul>
<h3>Usage Data</h3>
<ul>
<li>Login activity and IP addresses</li>
<li>Feature usage patterns for service improvement</li>
<li>Error logs for troubleshooting</li>
</ul>
</section>
<section>
<h2>3. Data Isolation &amp; Security</h2>
<p>We take data security seriously, especially given the sensitive financial nature of the information we handle:</p>
<ul>
<li><strong>Database-per-tenant architecture:</strong> Each organization's data is stored in a completely separate, isolated PostgreSQL database</li>
<li><strong>Encryption:</strong> Data is encrypted at rest and in transit using industry-standard TLS/SSL</li>
<li><strong>Access control:</strong> Role-based access control ensures staff only see data they are authorized to access</li>
<li><strong>Audit logging:</strong> All data access and modifications are logged with timestamps and user identification</li>
<li><strong>Regular backups:</strong> Automated database backups with point-in-time recovery capability</li>
</ul>
</section>
<section>
<h2>4. How We Use Your Data</h2>
<ul>
<li>To provide and maintain the Service</li>
<li>To process transactions and manage subscriptions</li>
<li>To send important service notifications (downtime, security alerts)</li>
<li>To provide customer support</li>
<li>To improve the Service based on aggregated, anonymized usage patterns</li>
<li>To comply with legal and regulatory requirements</li>
</ul>
</section>
<section>
<h2>5. Data Sharing</h2>
<p>We do not sell or rent your data. We may share data only in the following circumstances:</p>
<ul>
<li><strong>Payment processors:</strong> M-Pesa (Safaricom), Stripe, and Paystack for subscription billing</li>
<li><strong>SMS providers:</strong> For delivering transaction notifications to your members</li>
<li><strong>Infrastructure providers:</strong> Cloud hosting and database services</li>
<li><strong>Legal requirements:</strong> When required by law, regulation, or court order</li>
</ul>
</section>
<section>
<h2>6. Data Retention</h2>
<p>We retain your organizational data for as long as your account is active. Upon account termination, we retain data for 30 days to allow for data export requests. After this period, all data in your isolated database is permanently deleted. Billing records may be retained for up to 7 years as required by tax regulations.</p>
</section>
<section>
<h2>7. Your Rights</h2>
<p>You have the right to:</p>
<ul>
<li>Access your personal data and request a copy</li>
<li>Correct inaccurate information in your account</li>
<li>Request deletion of your data (subject to legal retention requirements)</li>
<li>Export your organizational data in standard formats</li>
<li>Withdraw consent for optional data processing</li>
<li>Lodge a complaint with the relevant data protection authority</li>
</ul>
</section>
<section>
<h2>8. Cookies &amp; Tracking</h2>
<p>We use essential cookies for authentication and session management. We do not use third-party tracking cookies or sell your browsing data to advertisers.</p>
</section>
<section>
<h2>9. Children's Privacy</h2>
<p>The Service is not intended for use by individuals under 18 years of age. We do not knowingly collect personal information from children.</p>
</section>
<section>
<h2>10. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification at least 30 days before they take effect.</p>
</section>`;

export default function PrivacyPage() {
  const { platform_name } = useBranding();
  const [content, setContent] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/public/legal/privacy')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.content) {
          setContent(data.content);
          setLastUpdated(data.last_updated || '');
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const displayContent = content || DEFAULT_PRIVACY;
  const displayDate = lastUpdated || 'February 2026';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold">
                {platform_name.charAt(0)}
              </span>
              <span className="text-xl font-bold text-gray-900">{platform_name}</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        </div>
        <p className="text-sm text-gray-500 mb-8">Last updated: {displayDate}</p>

        <div
          className="bg-white rounded-xl border border-gray-200 p-8 prose prose-gray max-w-none
            [&_section]:mb-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mb-3
            [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-gray-800 [&_h3]:mb-2
            [&_p]:text-gray-600 [&_p]:leading-relaxed [&_p]:mb-3
            [&_ul]:list-disc [&_ul]:list-inside [&_ul]:text-gray-600 [&_ul]:space-y-2 [&_ul]:ml-4
            [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:text-gray-600 [&_ol]:space-y-2 [&_ol]:ml-4
            [&_li]:text-gray-600
            [&_a]:text-blue-600 [&_a:hover]:text-blue-700 [&_a]:underline
            [&_strong]:text-gray-900"
          dangerouslySetInnerHTML={{ __html: displayContent }}
        />
      </main>
    </div>
  );
}
