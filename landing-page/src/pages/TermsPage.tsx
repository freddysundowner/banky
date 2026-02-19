import { Link } from 'wouter';
import { ArrowLeft, FileText } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

export default function TermsPage() {
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
          <FileText className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        </div>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              By accessing or using {platform_name} ("the Service"), you agree to be bound by these Terms of Service. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p className="text-gray-600 leading-relaxed">
              {platform_name} provides a cloud-based banking and Sacco management platform ("the Platform") that enables organizations to manage members, loans, savings, fixed deposits, dividends, and other financial operations. The Service is offered as a Software-as-a-Service (SaaS) product and as an Enterprise self-hosted solution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              To use the Service, you must create an account and provide accurate, complete information. You are responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized access</li>
              <li>Ensuring that your use complies with applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Subscription Plans & Billing</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              The Service offers multiple subscription tiers with different feature sets and usage limits. By subscribing to a paid plan:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>You authorize us to charge the applicable fees to your chosen payment method</li>
              <li>Subscriptions renew automatically unless cancelled before the renewal date</li>
              <li>Prices are denominated in USD and may be subject to currency conversion</li>
              <li>Refunds are handled on a case-by-case basis within 30 days of payment</li>
              <li>Free trials automatically convert to paid plans unless cancelled</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Ownership & Privacy</h2>
            <p className="text-gray-600 leading-relaxed">
              You retain all ownership rights to your data. Each organization's data is stored in an isolated database. We will not access, share, or sell your data except as necessary to provide the Service or as required by law. Please refer to our{' '}
              <Link href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
                Privacy Policy
              </Link>{' '}
              for detailed information on data handling practices.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Acceptable Use</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Use the Service for any unlawful purpose or in violation of financial regulations</li>
              <li>Attempt to gain unauthorized access to other users' data or accounts</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code (SaaS customers)</li>
              <li>Use the Service to process transactions for money laundering or fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Service Availability</h2>
            <p className="text-gray-600 leading-relaxed">
              We strive to maintain 99.9% uptime for the Service. However, we do not guarantee uninterrupted access and may perform scheduled maintenance with advance notice. We are not liable for downtime caused by factors outside our control, including internet outages, third-party service failures, or force majeure events.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Enterprise License Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              Enterprise license customers receive a perpetual license to use the software on their own servers, subject to the feature limits and support duration specified in their license key. Enterprise licenses are non-transferable and may not be sublicensed without written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p className="text-gray-600 leading-relaxed">
              To the maximum extent permitted by law, {platform_name} shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of the Service. Our total liability shall not exceed the amounts paid by you in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Termination</h2>
            <p className="text-gray-600 leading-relaxed">
              Either party may terminate the agreement at any time. Upon termination, your access to the Service will be suspended. We will retain your data for 30 days after termination, during which you may request a data export. After this period, data will be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              We may update these terms from time to time. We will notify you of significant changes via email or in-app notification at least 30 days before they take effect. Continued use of the Service after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact</h2>
            <p className="text-gray-600 leading-relaxed">
              For questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:legal@banky.co.ke" className="text-blue-600 hover:text-blue-700 underline">
                legal@banky.co.ke
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
