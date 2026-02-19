import { Link } from 'wouter';
import { ArrowLeft, Shield } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

export default function PrivacyPage() {
  const { platform_name } = useBranding();

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
        <p className="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p className="text-gray-600 leading-relaxed">
              {platform_name} ("we", "our", or "us") is committed to protecting the privacy of our users and their members' data. This Privacy Policy explains how we collect, use, store, and protect information when you use our banking and Sacco management platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Account Information</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mb-4">
              <li>Name, email address, and phone number during registration</li>
              <li>Organization name and details</li>
              <li>Billing and payment information for subscription management</li>
            </ul>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Organizational Data</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mb-4">
              <li>Member records including personal details, KYC documents, and account information</li>
              <li>Financial transaction records (deposits, withdrawals, loans, repayments)</li>
              <li>Staff and branch management data</li>
              <li>Accounting records and reports</li>
            </ul>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Usage Data</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Login activity and IP addresses</li>
              <li>Feature usage patterns for service improvement</li>
              <li>Error logs for troubleshooting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Isolation & Security</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              We take data security seriously, especially given the sensitive financial nature of the information we handle:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Database-per-tenant architecture:</strong> Each organization's data is stored in a completely separate, isolated PostgreSQL database</li>
              <li><strong>Encryption:</strong> Data is encrypted at rest and in transit using industry-standard TLS/SSL</li>
              <li><strong>Access control:</strong> Role-based access control ensures staff only see data they are authorized to access</li>
              <li><strong>Audit logging:</strong> All data access and modifications are logged with timestamps and user identification</li>
              <li><strong>Regular backups:</strong> Automated database backups with point-in-time recovery capability</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. How We Use Your Data</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>To provide and maintain the Service</li>
              <li>To process transactions and manage subscriptions</li>
              <li>To send important service notifications (downtime, security alerts)</li>
              <li>To provide customer support</li>
              <li>To improve the Service based on aggregated, anonymized usage patterns</li>
              <li>To comply with legal and regulatory requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Sharing</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              We do not sell or rent your data. We may share data only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Payment processors:</strong> M-Pesa (Safaricom), Stripe, and Paystack for subscription billing</li>
              <li><strong>SMS providers:</strong> For delivering transaction notifications to your members</li>
              <li><strong>Infrastructure providers:</strong> Cloud hosting and database services (Neon PostgreSQL)</li>
              <li><strong>Legal requirements:</strong> When required by law, regulation, or court order</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Retention</h2>
            <p className="text-gray-600 leading-relaxed">
              We retain your organizational data for as long as your account is active. Upon account termination, we retain data for 30 days to allow for data export requests. After this period, all data in your isolated database is permanently deleted. Billing records may be retained for up to 7 years as required by tax regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Access your personal data and request a copy</li>
              <li>Correct inaccurate information in your account</li>
              <li>Request deletion of your data (subject to legal retention requirements)</li>
              <li>Export your organizational data in standard formats</li>
              <li>Withdraw consent for optional data processing</li>
              <li>Lodge a complaint with the relevant data protection authority</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Cookies & Tracking</h2>
            <p className="text-gray-600 leading-relaxed">
              We use essential cookies for authentication and session management. We do not use third-party tracking cookies or sell your browsing data to advertisers. Analytics data is collected in an anonymized, aggregated form solely for service improvement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Children's Privacy</h2>
            <p className="text-gray-600 leading-relaxed">
              The Service is not intended for use by individuals under 18 years of age. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p className="text-gray-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification at least 30 days before they take effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact Us</h2>
            <p className="text-gray-600 leading-relaxed">
              For privacy-related questions or to exercise your data rights, contact our Data Protection Officer at{' '}
              <a href="mailto:privacy@banky.co.ke" className="text-blue-600 hover:text-blue-700 underline">
                privacy@banky.co.ke
              </a>{' '}
              or visit our{' '}
              <Link href="/contact" className="text-blue-600 hover:text-blue-700 underline">
                Contact page
              </Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
