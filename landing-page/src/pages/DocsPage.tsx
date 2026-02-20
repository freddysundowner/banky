import { useState, useEffect, useRef } from 'react';
import { Server, Key, Terminal, CheckCircle, ArrowRight, Shield, Settings, Globe, HardDrive, RefreshCw, Mail, AlertTriangle, FileText, ShoppingCart, Building2 } from 'lucide-react';

type SectionId = 'overview' | 'requirements' | 'installation' | 'license' | 'nginx' | 'ssl' | 'mpesa' | 'sms' | 'backup' | 'updates' | 'troubleshooting';
type GuideType = 'codecanyon' | 'direct';

interface DocsConfig {
  docs_mode: string;
  codecanyon_title: string;
  codecanyon_subtitle: string;
  direct_title: string;
  direct_subtitle: string;
  support_email: string;
}

const allSections: { id: SectionId; label: string; guidesOnly?: GuideType }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'installation', label: 'Installation' },
  { id: 'license', label: 'License Activation' },
  { id: 'nginx', label: 'Domain & Nginx' },
  { id: 'ssl', label: 'SSL Certificates' },
  { id: 'mpesa', label: 'M-Pesa Setup' },
  { id: 'sms', label: 'SMS Gateway' },
  { id: 'backup', label: 'Backup & Restore' },
  { id: 'updates', label: 'Updates' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

function getSections(guide: GuideType) {
  return allSections.filter(s => !s.guidesOnly || s.guidesOnly === guide);
}

const API_BASE = '';

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
      <pre className="text-green-400 text-sm font-mono whitespace-pre">{children}</pre>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">{n}</span>;
}

function Tip({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const colors = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  };
  return <div className={`p-4 border rounded-lg text-sm ${colors[type]}`}>{children}</div>;
}

function OverviewSection({ guide }: { guide: GuideType }) {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">What You Get</h2>
        <p className="text-gray-600 mb-6">
          {guide === 'codecanyon'
            ? 'When you purchase BANKY from CodeCanyon, you receive a complete self-hosted banking and Sacco management system with a lifetime license key pre-included. Download the package from your CodeCanyon account and follow this guide to deploy on your server.'
            : 'When you purchase BANKY directly from our team, you receive a complete self-hosted banking and Sacco management system with dedicated support. Your license key and package are delivered to your email after purchase.'}
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Package Contents
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Full source code (Python backend + React frontend)</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Installation script for automated setup</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Nginx configuration templates</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Environment configuration template</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Database migration scripts</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Backup and restore scripts</li>
            </ul>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Key Features
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Single dedicated PostgreSQL database</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />{guide === 'codecanyon' ? 'Lifetime license included — all features unlocked' : 'License-based feature unlocking'}</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />M-Pesa integration ready</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />SMS notifications support</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Complete data ownership on your server</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />No recurring subscription fees</li>
            </ul>
          </div>
        </div>
      </div>

      {guide === 'codecanyon' && (
        <Tip type="info">
          <strong>CodeCanyon Support:</strong> Your purchase includes 6 months of support and the full version with all features. You can extend support through Envato.
        </Tip>
      )}

      {guide === 'direct' && (
        <div className="bg-white rounded-2xl p-8 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-6">License Editions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-purple-200">
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold">Edition</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold">License Prefix</th>
                  <th className="text-center py-3 px-4 text-gray-600 font-semibold">Members</th>
                  <th className="text-center py-3 px-4 text-gray-600 font-semibold">Staff</th>
                  <th className="text-center py-3 px-4 text-gray-600 font-semibold">Branches</th>
                  <th className="text-center py-3 px-4 text-gray-600 font-semibold">Support</th>
                </tr>
              </thead>
              <tbody className="text-gray-900 divide-y divide-gray-100">
                <tr className="hover:bg-purple-50/50">
                  <td className="py-4 px-4 font-medium">Basic</td>
                  <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-BAS-XXXX-XXXX</td>
                  <td className="py-4 px-4 text-center">1,000</td>
                  <td className="py-4 px-4 text-center">5</td>
                  <td className="py-4 px-4 text-center">1</td>
                  <td className="py-4 px-4 text-center">6 months</td>
                </tr>
                <tr className="hover:bg-purple-50/50">
                  <td className="py-4 px-4 font-medium">Standard</td>
                  <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-STD-XXXX-XXXX</td>
                  <td className="py-4 px-4 text-center">5,000</td>
                  <td className="py-4 px-4 text-center">20</td>
                  <td className="py-4 px-4 text-center">10</td>
                  <td className="py-4 px-4 text-center">1 year</td>
                </tr>
                <tr className="hover:bg-purple-50/50">
                  <td className="py-4 px-4 font-medium">Premium</td>
                  <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-PRE-XXXX-XXXX</td>
                  <td className="py-4 px-4 text-center">20,000</td>
                  <td className="py-4 px-4 text-center">100</td>
                  <td className="py-4 px-4 text-center">50</td>
                  <td className="py-4 px-4 text-center">2 years</td>
                </tr>
                <tr className="hover:bg-purple-50/50">
                  <td className="py-4 px-4 font-medium">Enterprise</td>
                  <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-ENT-XXXX-XXXX</td>
                  <td className="py-4 px-4 text-center font-medium text-green-600">Unlimited</td>
                  <td className="py-4 px-4 text-center font-medium text-green-600">Unlimited</td>
                  <td className="py-4 px-4 text-center font-medium text-green-600">Unlimited</td>
                  <td className="py-4 px-4 text-center">3 years</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RequirementsSection() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <Settings className="w-7 h-7 text-purple-600" />
          Server Requirements
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Minimum Specifications</h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3"><ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" /><div><strong className="text-gray-900">OS:</strong> Ubuntu 22.04 or 24.04 LTS (recommended), Debian 12, CentOS 9</div></li>
              <li className="flex items-start gap-3"><ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" /><div><strong className="text-gray-900">CPU:</strong> 2 vCPUs minimum (4 recommended)</div></li>
              <li className="flex items-start gap-3"><ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" /><div><strong className="text-gray-900">RAM:</strong> 2 GB minimum (4 GB recommended)</div></li>
              <li className="flex items-start gap-3"><ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" /><div><strong className="text-gray-900">Disk:</strong> 20 GB SSD minimum</div></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Software Requirements</h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3"><ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" /><div><strong className="text-gray-900">Node.js 18+</strong> (v20 LTS recommended)</div></li>
              <li className="flex items-start gap-3"><ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" /><div><strong className="text-gray-900">Python 3.11+</strong></div></li>
              <li className="flex items-start gap-3"><ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" /><div><strong className="text-gray-900">PostgreSQL 14+</strong> (self-hosted, AWS RDS, Neon, Supabase, or any provider)</div></li>
              <li className="flex items-start gap-3"><ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" /><div><strong className="text-gray-900">Nginx</strong> (reverse proxy)</div></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Install Prerequisites</h3>
        <CodeBlock>{`# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL (skip if using external database)
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2`}</CodeBlock>
      </div>
    </div>
  );
}

function InstallationSection({ guide }: { guide: GuideType }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
          <Terminal className="w-7 h-7 text-purple-600" />
          Step-by-Step Installation
        </h2>

        <div className="space-y-8">
          <div className="border-l-4 border-purple-500 pl-6">
            <div className="flex items-center gap-3 mb-3">
              <StepNumber n={1} />
              <h3 className="font-semibold text-gray-900 text-lg">Create the Database</h3>
            </div>
            <p className="text-gray-600 mb-4">Create a PostgreSQL database for BANKY. You can use a local database or any cloud provider (AWS RDS, Neon, Supabase, etc.):</p>
            <CodeBlock>{`# If using local PostgreSQL:
sudo -u postgres psql << EOF
CREATE USER banky WITH PASSWORD 'your_secure_password';
CREATE DATABASE banky OWNER banky;
GRANT ALL PRIVILEGES ON DATABASE banky TO banky;
EOF

# Your connection string will be:
# postgresql://banky:your_secure_password@localhost:5432/banky

# If using a cloud provider, copy the connection string they provide.`}</CodeBlock>
          </div>

          <div className="border-l-4 border-purple-500 pl-6">
            <div className="flex items-center gap-3 mb-3">
              <StepNumber n={2} />
              <h3 className="font-semibold text-gray-900 text-lg">
                {guide === 'codecanyon' ? 'Download & Extract' : 'Extract & Configure'}
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              {guide === 'codecanyon'
                ? 'Download the BANKY package from your CodeCanyon downloads page. Upload it to your server and extract:'
                : 'Upload the BANKY package delivered to your email to your server and extract:'}
            </p>
            <CodeBlock>{guide === 'codecanyon'
              ? `# Upload the zip file to your server first (using scp, rsync, or SFTP)
# Then extract:
unzip banky-codecanyon-*.zip
cd banky

# The CodeCanyon package includes an installable directory
# Copy the environment template
cp .env.example .env

# Edit with your settings
nano .env`
              : `# Extract the package
unzip banky-enterprise-v*.zip
cd banky

# Copy the environment template
cp .env.example .env

# Edit with your settings
nano .env`}</CodeBlock>
          </div>

          <div className="border-l-4 border-purple-500 pl-6">
            <div className="flex items-center gap-3 mb-3">
              <StepNumber n={3} />
              <h3 className="font-semibold text-gray-900 text-lg">Environment Configuration</h3>
            </div>
            <p className="text-gray-600 mb-4">Fill in your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env</code> file with these required values:</p>
            <CodeBlock>{guide === 'codecanyon'
              ? `# ── Required ──────────────────────────────────────────────
# Your PostgreSQL connection string
DATABASE_URL=postgresql://banky:your_password@localhost:5432/banky

# Must be "enterprise" for self-hosted installations
DEPLOYMENT_MODE=enterprise

# Lifetime license key (pre-included — do not remove)
LICENSE_KEY=BANKY-ENT-PERP-XXXXXXXX

# Random secret for session encryption (min 32 characters)
SESSION_SECRET=generate-a-long-random-string-here

# ── Optional ──────────────────────────────────────────────
# M-Pesa (Safaricom Daraja API credentials)
# MPESA_CONSUMER_KEY=your_consumer_key
# MPESA_CONSUMER_SECRET=your_consumer_secret
# MPESA_SHORTCODE=your_shortcode
# MPESA_PASSKEY=your_passkey

# SMS Gateway
# SMS_API_KEY=your_sms_api_key
# SMS_SENDER_ID=BANKY

# Email (Brevo / SMTP)
# BREVO_API_KEY=your_brevo_api_key
# FROM_EMAIL=noreply@yourorganization.co.ke`
              : `# ── Required ──────────────────────────────────────────────
# Your PostgreSQL connection string
DATABASE_URL=postgresql://banky:your_password@localhost:5432/banky

# Must be "enterprise" for self-hosted installations
DEPLOYMENT_MODE=enterprise

# Your license key (received after purchase)
LICENSE_KEY=BANKY-STD-2026-XXXXXXXX

# Random secret for session encryption (min 32 characters)
SESSION_SECRET=generate-a-long-random-string-here

# ── Optional ──────────────────────────────────────────────
# M-Pesa (Safaricom Daraja API credentials)
# MPESA_CONSUMER_KEY=your_consumer_key
# MPESA_CONSUMER_SECRET=your_consumer_secret
# MPESA_SHORTCODE=your_shortcode
# MPESA_PASSKEY=your_passkey

# SMS Gateway
# SMS_API_KEY=your_sms_api_key
# SMS_SENDER_ID=BANKY

# Email (Brevo / SMTP)
# BREVO_API_KEY=your_brevo_api_key
# FROM_EMAIL=noreply@yourorganization.co.ke`}</CodeBlock>
          </div>

          <div className="border-l-4 border-purple-500 pl-6">
            <div className="flex items-center gap-3 mb-3">
              <StepNumber n={4} />
              <h3 className="font-semibold text-gray-900 text-lg">Run the Installer</h3>
            </div>
            <p className="text-gray-600 mb-4">The install script installs dependencies, builds the frontend, and sets up the database:</p>
            <CodeBlock>{`# Make the installer executable
chmod +x install.sh

# Run the installer
./install.sh

# The script will:
# 1. Install Node.js dependencies
# 2. Install Python dependencies
# 3. Build the React frontend
# 4. Run database migrations
# 5. Create the first admin user`}</CodeBlock>
          </div>

          <div className="border-l-4 border-purple-500 pl-6">
            <div className="flex items-center gap-3 mb-3">
              <StepNumber n={5} />
              <h3 className="font-semibold text-gray-900 text-lg">Start the Application</h3>
            </div>
            <p className="text-gray-600 mb-4">Start BANKY using PM2 for automatic restarts and log management:</p>
            <CodeBlock>{`# Start all services with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration (survives reboots)
pm2 save

# Set PM2 to auto-start on server boot
pm2 startup

# Check status
pm2 status

# View logs
pm2 logs

# BANKY is now running on http://localhost:5000`}</CodeBlock>
          </div>

          <Tip type="success">
            <strong>First Login:</strong> After installation, open <code className="bg-green-100 px-1 rounded">http://your-server-ip:5000</code> in your browser. Register your organization {guide === 'codecanyon' ? '— your lifetime license key is already configured and all features are available' : 'and the system will activate using your license key automatically'}.
          </Tip>
        </div>
      </div>
    </div>
  );
}

function LicenseSection({ guide, supportEmail }: { guide: GuideType; supportEmail: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <Key className="w-7 h-7 text-purple-600" />
          License Activation
        </h2>

        {guide === 'codecanyon' ? (
          <div className="space-y-6">
            <p className="text-gray-600">Your CodeCanyon package includes a <strong>lifetime license key</strong> that is already pre-filled in your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env.example</code> file. This key unlocks all features with no limits and never expires.</p>

            <div className="bg-green-50 rounded-xl p-6 border border-green-200">
              <h3 className="font-semibold text-gray-900 mb-3">Your Lifetime Key</h3>
              <div className="font-mono text-lg text-green-700 mb-3">BANKY-ENT-PERP-XXXXXXXX</div>
              <p className="text-sm text-gray-600">The <code className="bg-white px-1.5 py-0.5 rounded text-sm">PERP</code> segment means <strong>perpetual</strong> -- this key never expires. The <code className="bg-white px-1.5 py-0.5 rounded text-sm">ENT</code> segment means <strong>Enterprise edition</strong> -- all features unlocked, no member/staff/branch limits.</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Verification</h3>
              <p className="text-gray-600 mb-3">Your license key should already be set. To verify:</p>
              <ol className="space-y-3 text-gray-600">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                  <span>Open your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env</code> file and confirm the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">LICENSE_KEY</code> line has a value starting with <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">BANKY-ENT-PERP-</code></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                  <span>Start or restart the application -- the key is validated automatically on startup</span>
                </li>
              </ol>
            </div>

            <Tip type="warning">
              <strong>Important:</strong> Do not remove or modify your license key. If your <code className="bg-amber-100 px-1 rounded text-sm">.env</code> file was created fresh without the key, check the <code className="bg-amber-100 px-1 rounded text-sm">.env.example</code> file -- the key is included there. If you still cannot find it, contact us at <a href={`mailto:${supportEmail}`} className="text-amber-900 underline">{supportEmail}</a>.
            </Tip>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-gray-600">Your license key determines which features and limits are available in your installation. It is provided by the admin after purchase.</p>

            <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
              <h3 className="font-semibold text-gray-900 mb-3">License Key Format</h3>
              <div className="font-mono text-lg text-purple-700 mb-4">BANKY-{'{EDITION}'}-{'{YEAR}'}-{'{UNIQUE_ID}'}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                  { code: 'BAS', label: 'Basic' },
                  { code: 'STD', label: 'Standard' },
                  { code: 'PRE', label: 'Premium' },
                  { code: 'ENT', label: 'Enterprise' },
                ].map(e => (
                  <div key={e.code} className="bg-white rounded-lg p-3 text-center border border-purple-100">
                    <div className="font-mono font-bold text-purple-600">{e.code}</div>
                    <div className="text-gray-500 mt-1">{e.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">How to Activate</h3>
              <ol className="space-y-3 text-gray-600">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                  <span>Add your license key to the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">LICENSE_KEY</code> variable in your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env</code> file</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                  <span>Restart the application: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">pm2 restart all</code></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                  <span>The system validates your key on startup and unlocks the corresponding features and limits</span>
                </li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Upgrading Your License</h3>
              <p className="text-gray-600 mb-3">To upgrade from one edition to another (e.g., Basic to Standard):</p>
              <ol className="space-y-2 text-gray-600 text-sm">
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Purchase the higher edition license</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Replace the <code className="bg-gray-100 px-1 rounded">LICENSE_KEY</code> value in your <code className="bg-gray-100 px-1 rounded">.env</code> file</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Restart: <code className="bg-gray-100 px-1 rounded">pm2 restart all</code></li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />All your data is preserved -- only limits and features change</li>
              </ol>
            </div>

            <Tip type="info">
              <strong>Direct Purchase:</strong> Your license key was emailed along with your package download link. If you need it resent, contact <a href={`mailto:${supportEmail}`} className="text-blue-900 underline">{supportEmail}</a> with your order reference.
            </Tip>
          </div>
        )}
      </div>
    </div>
  );
}

function NginxSection() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <Globe className="w-7 h-7 text-purple-600" />
          Domain & Nginx Configuration
        </h2>
        <p className="text-gray-600 mb-6">Point your domain to BANKY using Nginx as a reverse proxy.</p>

        <div className="space-y-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">1. DNS Records</h3>
            <p className="text-gray-600 mb-4">Add an A record pointing your domain to your server's IP address:</p>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Type</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="text-gray-900 divide-y divide-gray-100">
                  <tr><td className="py-3 px-4 font-mono">A</td><td className="py-3 px-4 font-mono">@ or app</td><td className="py-3 px-4 font-mono text-purple-600">YOUR_SERVER_IP</td></tr>
                  <tr><td className="py-3 px-4 font-mono">A</td><td className="py-3 px-4 font-mono">www</td><td className="py-3 px-4 font-mono text-purple-600">YOUR_SERVER_IP</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">2. Nginx Site Configuration</h3>
            <CodeBlock>{`# Create Nginx site configuration
sudo nano /etc/nginx/sites-available/banky

# Paste the following (replace yoursite.com with your domain):

server {
    listen 80;
    server_name yoursite.com www.yoursite.com;

    # Increase body size for file uploads
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for long API calls
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">3. Enable & Test</h3>
            <CodeBlock>{`# Enable the site
sudo ln -s /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx`}</CodeBlock>
          </div>
        </div>
      </div>
    </div>
  );
}

function SslSection() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <Shield className="w-7 h-7 text-purple-600" />
          SSL Certificates (HTTPS)
        </h2>
        <p className="text-gray-600 mb-6">Secure your BANKY installation with free SSL certificates from Let's Encrypt.</p>
        <CodeBlock>{`# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate (replace with your domain)
sudo certbot --nginx -d yoursite.com -d www.yoursite.com

# Follow the prompts:
# 1. Enter your email address
# 2. Agree to terms of service
# 3. Select "2" to redirect HTTP to HTTPS

# Verify auto-renewal is configured
sudo certbot renew --dry-run`}</CodeBlock>
        <div className="mt-6">
          <Tip type="success">
            <strong>Auto-Renewal:</strong> Certbot automatically renews certificates every 60 days. No manual action needed.
          </Tip>
        </div>
      </div>
    </div>
  );
}

function MpesaSection() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <Settings className="w-7 h-7 text-green-600" />
          M-Pesa Integration Setup
        </h2>
        <p className="text-gray-600 mb-6">Connect BANKY to Safaricom's Daraja API for M-Pesa STK Push deposits, loan disbursements, and repayment collection.</p>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">1. Get Daraja API Credentials</h3>
            <ol className="space-y-2 text-gray-600 text-sm">
              <li className="flex items-start gap-2"><span className="font-bold text-gray-900">a.</span> Go to <a href="https://developer.safaricom.co.ke" className="text-blue-600 hover:underline" target="_blank" rel="noopener">developer.safaricom.co.ke</a> and create an account</li>
              <li className="flex items-start gap-2"><span className="font-bold text-gray-900">b.</span> Create a new app and enable "Lipa Na M-Pesa Online" (STK Push)</li>
              <li className="flex items-start gap-2"><span className="font-bold text-gray-900">c.</span> Copy your Consumer Key and Consumer Secret</li>
              <li className="flex items-start gap-2"><span className="font-bold text-gray-900">d.</span> Apply for a production Paybill/Till number through Safaricom</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">2. Add to Environment</h3>
            <CodeBlock>{`# Add these to your .env file:

# Daraja API credentials
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret

# Your Paybill / Till number
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_lipa_na_mpesa_passkey

# Callback URL (must be publicly accessible HTTPS)
MPESA_CALLBACK_URL=https://yoursite.com/api/mpesa/callback

# Environment: "sandbox" for testing, "production" for live
MPESA_ENVIRONMENT=production`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">3. Configure Callback URL</h3>
            <p className="text-gray-600 text-sm">
              Your callback URL must be a publicly accessible HTTPS endpoint. Safaricom sends transaction confirmations to this URL. Make sure your Nginx and SSL are configured before enabling M-Pesa in production.
            </p>
          </div>

          <Tip type="warning">
            <strong>Testing:</strong> Use Daraja sandbox credentials first. Switch to production credentials only after verifying STK Push works correctly in the sandbox environment.
          </Tip>
        </div>
      </div>
    </div>
  );
}

function SmsSection() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <Mail className="w-7 h-7 text-blue-600" />
          SMS Gateway Configuration
        </h2>
        <p className="text-gray-600 mb-6">BANKY sends SMS notifications for transactions, loan approvals, due date reminders, and dividend payouts. Configure your preferred SMS gateway.</p>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Supported Gateways</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Africa's Talking</h4>
                <p className="text-sm text-gray-600">Popular in East Africa. Good rates for Kenya, Uganda, Tanzania.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Twilio</h4>
                <p className="text-sm text-gray-600">Global coverage. Works worldwide with reliable delivery.</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Environment Variables</h3>
            <CodeBlock>{`# Add to your .env file:

# SMS provider: "africastalking" or "twilio"
SMS_PROVIDER=africastalking

# Africa's Talking
SMS_API_KEY=your_africastalking_api_key
SMS_USERNAME=your_africastalking_username
SMS_SENDER_ID=BANKY

# OR Twilio
# TWILIO_ACCOUNT_SID=your_twilio_sid
# TWILIO_AUTH_TOKEN=your_twilio_token
# TWILIO_PHONE_NUMBER=+1234567890`}</CodeBlock>
          </div>

          <p className="text-sm text-gray-500">SMS can also be configured from the Settings page within BANKY after logging in.</p>
        </div>
      </div>
    </div>
  );
}

function BackupSection() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <HardDrive className="w-7 h-7 text-purple-600" />
          Backup & Restore
        </h2>

        <div className="space-y-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Manual Database Backup</h3>
            <CodeBlock>{`# Create a compressed backup
pg_dump -h localhost -U banky -d banky -F c -f backup_$(date +%Y%m%d).dump

# Or using your DATABASE_URL from .env
pg_dump "$DATABASE_URL" -F c -f backup_$(date +%Y%m%d).dump`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Automated Daily Backups</h3>
            <CodeBlock>{`# Create a backup script
cat > /opt/banky/backup.sh << 'SCRIPT'
#!/bin/bash
set -e
BACKUP_DIR="/opt/banky/backups"
mkdir -p "$BACKUP_DIR"
export $(grep -v '^#' /opt/banky/banky/.env | grep -v '^\\s*$' | xargs)
BACKUP_FILE="$BACKUP_DIR/banky_backup_$(date +%Y%m%d_%H%M%S).dump"
pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE"
ls -t "$BACKUP_DIR"/banky_backup_*.dump | tail -n +31 | xargs rm -f 2>/dev/null || true
echo "[$(date)] Backup: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"
SCRIPT
chmod +x /opt/banky/backup.sh

# Schedule daily backup at 2 AM
crontab -e
# Add this line:
0 2 * * * /opt/banky/backup.sh >> /var/log/banky-backup.log 2>&1`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Restore from Backup</h3>
            <CodeBlock>{`# Stop the application first
pm2 stop all

# Restore the database
pg_restore -h localhost -U banky -d banky -c backup_20260219.dump

# Restart the application
pm2 restart all`}</CodeBlock>
          </div>

          <Tip type="info">
            <strong>Recommendation:</strong> Store backups on a separate server or cloud storage (AWS S3, Google Cloud Storage) for disaster recovery. Never keep backups only on the same server.
          </Tip>
        </div>
      </div>
    </div>
  );
}

function UpdatesSection({ guide, supportEmail }: { guide: GuideType; supportEmail: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <RefreshCw className="w-7 h-7 text-purple-600" />
          Updating BANKY
        </h2>
        <p className="text-gray-600 mb-6">When a new version is released, follow these steps to update your installation. Updates are included during your support period.</p>

        <div className="space-y-6">
          <CodeBlock>{`# 1. Backup your database first (always!)
pg_dump "$DATABASE_URL" -F c -f backup_$(date +%Y%m%d).dump

# 2. Stop the application
pm2 stop all

# 3. Extract the new version
unzip banky-enterprise-v2.x.zip -d /tmp/banky-update

# 4. Copy new files (preserving your .env)
rsync -av --exclude='.env' /tmp/banky-update/ /opt/banky/

# 5. Install any new dependencies
cd /opt/banky && ./install.sh --update

# 6. Start the application (migrations run automatically)
pm2 restart all

# 7. Verify everything is working
pm2 status
curl http://localhost:5000/health`}</CodeBlock>

          <Tip type="warning">
            <strong>Important:</strong> Always backup your database before updating. Database migrations run automatically on startup, but having a backup ensures you can roll back if needed.
          </Tip>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">How to Get Updates</h3>
            <ul className="space-y-2 text-gray-600 text-sm">
              {guide === 'codecanyon' ? (
                <>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Download the latest version from your CodeCanyon downloads page</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Updates are available as long as your CodeCanyon support is active</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Extend your support period through Envato to continue receiving updates</li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Updates are emailed to you or available in your customer portal</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Updates are free during your support period (varies by edition)</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Contact <a href={`mailto:${supportEmail}`} className="text-blue-600 hover:underline">{supportEmail}</a> to renew your support</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function TroubleshootingSection({ supportEmail }: { supportEmail: string }) {
  const issues = [
    {
      title: "Application won't start",
      content: (
        <div className="p-4 text-sm text-gray-600 space-y-2">
          <p>Check the PM2 logs for error details:</p>
          <div className="bg-gray-900 rounded p-3"><pre className="text-green-400 font-mono text-xs">pm2 logs --lines 50</pre></div>
          <p>Common causes: missing <code className="bg-gray-100 px-1 rounded">.env</code> file, incorrect <code className="bg-gray-100 px-1 rounded">DATABASE_URL</code>, or port already in use.</p>
        </div>
      ),
    },
    {
      title: "Database connection failed",
      content: (
        <div className="p-4 text-sm text-gray-600 space-y-2">
          <p>Verify your PostgreSQL connection:</p>
          <div className="bg-gray-900 rounded p-3"><pre className="text-green-400 font-mono text-xs">{`psql "postgresql://banky:password@localhost:5432/banky" -c "SELECT 1;"`}</pre></div>
          <p>Check that PostgreSQL is running: <code className="bg-gray-100 px-1 rounded">sudo systemctl status postgresql</code></p>
        </div>
      ),
    },
    {
      title: "License key not recognized",
      content: (
        <div className="p-4 text-sm text-gray-600 space-y-2">
          <p>Make sure the key is copied exactly with no extra spaces. Check your <code className="bg-gray-100 px-1 rounded">.env</code> file:</p>
          <div className="bg-gray-900 rounded p-3"><pre className="text-green-400 font-mono text-xs">grep LICENSE_KEY .env</pre></div>
          <p>If the key is correct but still failing, contact <a href={`mailto:${supportEmail}`} className="text-blue-600 hover:underline">{supportEmail}</a> with your purchase receipt.</p>
        </div>
      ),
    },
    {
      title: "M-Pesa callbacks not received",
      content: (
        <div className="p-4 text-sm text-gray-600 space-y-2">
          <p>Callbacks require a publicly accessible HTTPS URL. Verify:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your SSL certificate is valid and not expired</li>
            <li>Nginx is properly proxying requests</li>
            <li>The callback URL in your <code className="bg-gray-100 px-1 rounded">.env</code> matches what's registered with Safaricom</li>
            <li>Your firewall allows incoming HTTPS traffic on port 443</li>
          </ul>
        </div>
      ),
    },
    {
      title: "Slow performance",
      content: (
        <div className="p-4 text-sm text-gray-600 space-y-2">
          <p>Check server resource usage:</p>
          <div className="bg-gray-900 rounded p-3"><pre className="text-green-400 font-mono text-xs">{`# Check memory usage
free -h

# Check disk space
df -h

# Check CPU usage
top -bn1 | head -5`}</pre></div>
          <p>Consider upgrading your server if resources are consistently maxed out. For large organizations (10,000+ members), a 4 CPU / 8 GB RAM server is recommended.</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-7 h-7 text-amber-600" />
          Troubleshooting
        </h2>

        <div className="space-y-6">
          {issues.map((issue, i) => (
            <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">{issue.title}</h3>
              </div>
              {issue.content}
            </div>
          ))}

          <Tip type="info">
            <strong>Need more help?</strong> Contact us at <a href={`mailto:${supportEmail}`} className="text-blue-900 underline">{supportEmail}</a> with a description of the issue, your PM2 logs, and your server OS/specs. We typically respond within 24 hours during business days.
          </Tip>
        </div>
      </div>
    </div>
  );
}

function GuideContent({ guide, activeSection, supportEmail }: { guide: GuideType; activeSection: SectionId; supportEmail: string }) {
  switch (activeSection) {
    case 'overview': return <OverviewSection guide={guide} />;
    case 'requirements': return <RequirementsSection />;
    case 'installation': return <InstallationSection guide={guide} />;
    case 'license': return <LicenseSection guide={guide} supportEmail={supportEmail} />;
    case 'nginx': return <NginxSection />;
    case 'ssl': return <SslSection />;
    case 'mpesa': return <MpesaSection />;
    case 'sms': return <SmsSection />;
    case 'backup': return <BackupSection />;
    case 'updates': return <UpdatesSection guide={guide} supportEmail={supportEmail} />;
    case 'troubleshooting': return <TroubleshootingSection supportEmail={supportEmail} />;
    default: return null;
  }
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [activeGuide, setActiveGuide] = useState<GuideType>('codecanyon');
  const contentRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<DocsConfig>({
    docs_mode: 'both',
    codecanyon_title: 'CodeCanyon Purchase',
    codecanyon_subtitle: 'Installation guide for buyers who purchased BANKY from CodeCanyon marketplace.',
    direct_title: 'Enterprise License',
    direct_subtitle: 'Installation guide for organizations who purchased BANKY directly from our sales team.',
    support_email: 'support@banky.co.ke',
  });
  const [loading, setLoading] = useState(true);

  const handleSectionChange = (sectionId: SectionId) => {
    setActiveSection(sectionId);
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/docs-config`);
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
          if (data.docs_mode === 'direct') {
            setActiveGuide('direct');
          } else {
            setActiveGuide('codecanyon');
          }
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const showTabs = config.docs_mode === 'both';
  const effectiveGuide: GuideType = config.docs_mode === 'direct' ? 'direct' : config.docs_mode === 'codecanyon' ? 'codecanyon' : activeGuide;
  const sections = getSections(effectiveGuide);

  useEffect(() => {
    const available = getSections(effectiveGuide);
    if (!available.find(s => s.id === activeSection)) {
      setActiveSection('overview');
    }
  }, [effectiveGuide]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
            <Server className="w-4 h-4" />
            Enterprise Self-Hosted
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Installation & Setup Guide
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to deploy BANKY on your own server.
          </p>
        </div>

        {showTabs && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-white rounded-xl border border-gray-200 p-1.5 shadow-sm">
              <button
                onClick={() => setActiveGuide('codecanyon')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition ${
                  activeGuide === 'codecanyon'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                {config.codecanyon_title}
              </button>
              <button
                onClick={() => setActiveGuide('direct')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition ${
                  activeGuide === 'direct'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                {config.direct_title}
              </button>
            </div>
          </div>
        )}

        {showTabs && (
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500">
              {activeGuide === 'codecanyon' ? config.codecanyon_subtitle : config.direct_subtitle}
            </p>
          </div>
        )}

        <div className="flex gap-8">
          <nav className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">Documentation</p>
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSectionChange(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                    activeSection === s.id
                      ? 'bg-purple-100 text-purple-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0" ref={contentRef} style={{ scrollMarginTop: '100px' }}>
            <div className="lg:hidden mb-6">
              <select
                value={activeSection}
                onChange={e => handleSectionChange(e.target.value as SectionId)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <GuideContent guide={effectiveGuide} activeSection={activeSection} supportEmail={config.support_email} />
          </div>
        </div>

        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-3">Need Help?</h2>
            <p className="text-purple-100 mb-6 max-w-xl mx-auto">
              Our support team is here to help you get BANKY up and running. Reach out anytime.
            </p>
            <a
              href={`mailto:${config.support_email}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition"
            >
              <Mail className="w-5 h-5" />
              {config.support_email}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
