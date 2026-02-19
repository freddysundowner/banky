import { useState } from 'react';
import { Link } from 'wouter';
import { Server, Key, Terminal, CheckCircle, ArrowRight, Shield, Settings, Globe, HardDrive, RefreshCw, Mail, AlertTriangle, FileText } from 'lucide-react';

type SectionId = 'overview' | 'requirements' | 'installation' | 'license' | 'nginx' | 'ssl' | 'mpesa' | 'sms' | 'backup' | 'updates' | 'troubleshooting';

const sections: { id: SectionId; label: string }[] = [
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

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
            <Server className="w-4 h-4" />
            Enterprise Self-Hosted
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Installation & Setup Guide
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to deploy BANKY on your own server after purchasing a license from CodeCanyon or directly from us.
          </p>
        </div>

        <div className="flex gap-8">
          <nav className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">Documentation</p>
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
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

          <div className="flex-1 min-w-0">
            <div className="lg:hidden mb-6">
              <select
                value={activeSection}
                onChange={e => setActiveSection(e.target.value as SectionId)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {activeSection === 'overview' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-100">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">What You Get</h2>
                  <p className="text-gray-600 mb-6">
                    When you purchase BANKY (from CodeCanyon or directly), you receive a complete self-hosted banking and Sacco management system that runs on your own server. Your license key unlocks features based on your edition.
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
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />License-based feature unlocking</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />M-Pesa integration ready</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />SMS notifications support</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Complete data ownership on your server</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />No recurring subscription fees</li>
                      </ul>
                    </div>
                  </div>
                </div>

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
              </div>
            )}

            {activeSection === 'requirements' && (
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
                        <li className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div><strong className="text-gray-900">OS:</strong> Ubuntu 22.04 or 24.04 LTS (recommended), Debian 12, CentOS 9</div>
                        </li>
                        <li className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div><strong className="text-gray-900">CPU:</strong> 2 vCPUs minimum (4 recommended)</div>
                        </li>
                        <li className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div><strong className="text-gray-900">RAM:</strong> 2 GB minimum (4 GB recommended)</div>
                        </li>
                        <li className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div><strong className="text-gray-900">Disk:</strong> 20 GB SSD minimum</div>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Software Requirements</h3>
                      <ul className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div><strong className="text-gray-900">Node.js 18+</strong> (v20 LTS recommended)</div>
                        </li>
                        <li className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div><strong className="text-gray-900">Python 3.11+</strong></div>
                        </li>
                        <li className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div><strong className="text-gray-900">PostgreSQL 14+</strong> (self-hosted, AWS RDS, Neon, Supabase, or any provider)</div>
                        </li>
                        <li className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div><strong className="text-gray-900">Nginx</strong> (reverse proxy)</div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-8 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Install Prerequisites</h3>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Update system
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
sudo npm install -g pm2`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'installation' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-8 border border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                    <Terminal className="w-7 h-7 text-purple-600" />
                    Step-by-Step Installation
                  </h2>

                  <div className="space-y-8">
                    <div className="border-l-4 border-purple-500 pl-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">1</span>
                        <h3 className="font-semibold text-gray-900 text-lg">Create the Database</h3>
                      </div>
                      <p className="text-gray-600 mb-4">Create a PostgreSQL database for BANKY. You can use a local database or any cloud provider (AWS RDS, Neon, Supabase, etc.):</p>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# If using local PostgreSQL:
sudo -u postgres psql << EOF
CREATE USER banky WITH PASSWORD 'your_secure_password';
CREATE DATABASE banky OWNER banky;
GRANT ALL PRIVILEGES ON DATABASE banky TO banky;
EOF

# Your connection string will be:
# postgresql://banky:your_secure_password@localhost:5432/banky

# If using a cloud provider, copy the connection string they provide.`}
                        </pre>
                      </div>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">2</span>
                        <h3 className="font-semibold text-gray-900 text-lg">Extract & Configure</h3>
                      </div>
                      <p className="text-gray-600 mb-4">Upload the BANKY package to your server and configure the environment:</p>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Extract the package
unzip banky-enterprise-v*.zip
cd banky

# Copy the environment template
cp .env.example .env

# Edit with your settings
nano .env`}
                        </pre>
                      </div>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">3</span>
                        <h3 className="font-semibold text-gray-900 text-lg">Environment Configuration</h3>
                      </div>
                      <p className="text-gray-600 mb-4">Fill in your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env</code> file with these required values:</p>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# ── Required ──────────────────────────────────────────────
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
# FROM_EMAIL=noreply@yourorganization.co.ke`}
                        </pre>
                      </div>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">4</span>
                        <h3 className="font-semibold text-gray-900 text-lg">Run the Installer</h3>
                      </div>
                      <p className="text-gray-600 mb-4">The install script installs dependencies, builds the frontend, and sets up the database:</p>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Make the installer executable
chmod +x install.sh

# Run the installer
./install.sh

# The script will:
# 1. Install Node.js dependencies
# 2. Install Python dependencies
# 3. Build the React frontend
# 4. Run database migrations
# 5. Create the first admin user`}
                        </pre>
                      </div>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">5</span>
                        <h3 className="font-semibold text-gray-900 text-lg">Start the Application</h3>
                      </div>
                      <p className="text-gray-600 mb-4">Start BANKY using PM2 for automatic restarts and log management:</p>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Start all services with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration (survives reboots)
pm2 save

# Set PM2 to auto-start on server boot
pm2 startup

# Check status
pm2 status

# View logs
pm2 logs

# BANKY is now running on http://localhost:5000`}
                        </pre>
                      </div>
                    </div>

                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        <strong>First Login:</strong> After installation, open <code className="bg-green-100 px-1 rounded">http://your-server-ip:5000</code> in your browser. Register your organization and the system will activate using your license key automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'license' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-8 border border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                    <Key className="w-7 h-7 text-purple-600" />
                    License Activation
                  </h2>
                  <p className="text-gray-600 mb-6">Your license key determines which features and limits are available in your installation. It is provided after purchase.</p>

                  <div className="space-y-6">
                    <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                      <h3 className="font-semibold text-gray-900 mb-3">License Key Format</h3>
                      <div className="font-mono text-lg text-purple-700 mb-4">BANKY-{'{EDITION}'}-{'{YEAR}'}-{'{UNIQUE_ID}'}</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                          <div className="font-mono font-bold text-purple-600">BAS</div>
                          <div className="text-gray-500 mt-1">Basic</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                          <div className="font-mono font-bold text-purple-600">STD</div>
                          <div className="text-gray-500 mt-1">Standard</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                          <div className="font-mono font-bold text-purple-600">PRE</div>
                          <div className="text-gray-500 mt-1">Premium</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                          <div className="font-mono font-bold text-purple-600">ENT</div>
                          <div className="text-gray-500 mt-1">Enterprise</div>
                        </div>
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

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>CodeCanyon Buyers:</strong> Your license key is emailed to you after purchase. If you haven't received it, check your spam folder or contact us at <a href="mailto:support@banky.co.ke" className="text-amber-900 underline">support@banky.co.ke</a>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'nginx' && (
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
                            <tr>
                              <td className="py-3 px-4 font-mono">A</td>
                              <td className="py-3 px-4 font-mono">@ or app</td>
                              <td className="py-3 px-4 font-mono text-purple-600">YOUR_SERVER_IP</td>
                            </tr>
                            <tr>
                              <td className="py-3 px-4 font-mono">A</td>
                              <td className="py-3 px-4 font-mono">www</td>
                              <td className="py-3 px-4 font-mono text-purple-600">YOUR_SERVER_IP</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">2. Nginx Site Configuration</h3>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Create Nginx site configuration
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
}`}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">3. Enable & Test</h3>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Enable the site
sudo ln -s /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'ssl' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-8 border border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                    <Shield className="w-7 h-7 text-purple-600" />
                    SSL Certificates (HTTPS)
                  </h2>
                  <p className="text-gray-600 mb-6">Secure your BANKY installation with free SSL certificates from Let's Encrypt.</p>

                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto mb-6">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate (replace with your domain)
sudo certbot --nginx -d yoursite.com -d www.yoursite.com

# Follow the prompts:
# 1. Enter your email address
# 2. Agree to terms of service
# 3. Select "2" to redirect HTTP to HTTPS

# Verify auto-renewal is configured
sudo certbot renew --dry-run`}
                    </pre>
                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>Auto-Renewal:</strong> Certbot automatically renews certificates every 60 days. No manual action needed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'mpesa' && (
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
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Add these to your .env file:

# Daraja API credentials
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret

# Your Paybill / Till number
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_lipa_na_mpesa_passkey

# Callback URL (must be publicly accessible HTTPS)
MPESA_CALLBACK_URL=https://yoursite.com/api/mpesa/callback

# Environment: "sandbox" for testing, "production" for live
MPESA_ENVIRONMENT=production`}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">3. Configure Callback URL</h3>
                      <p className="text-gray-600 text-sm">
                        Your callback URL must be a publicly accessible HTTPS endpoint. Safaricom sends transaction confirmations to this URL. Make sure your Nginx and SSL are configured before enabling M-Pesa in production.
                      </p>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>Testing:</strong> Use Daraja sandbox credentials first. Switch to production credentials only after verifying STK Push works correctly in the sandbox environment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'sms' && (
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
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Add to your .env file:

# SMS provider: "africastalking" or "twilio"
SMS_PROVIDER=africastalking

# Africa's Talking
SMS_API_KEY=your_africastalking_api_key
SMS_USERNAME=your_africastalking_username
SMS_SENDER_ID=BANKY

# OR Twilio
# TWILIO_ACCOUNT_SID=your_twilio_sid
# TWILIO_AUTH_TOKEN=your_twilio_token
# TWILIO_PHONE_NUMBER=+1234567890`}
                        </pre>
                      </div>
                    </div>

                    <p className="text-sm text-gray-500">SMS can also be configured from the Settings page within BANKY after logging in.</p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'backup' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-8 border border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                    <HardDrive className="w-7 h-7 text-purple-600" />
                    Backup & Restore
                  </h2>

                  <div className="space-y-8">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Manual Database Backup</h3>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Create a backup
pg_dump -h localhost -U banky -d banky -F c -f backup_$(date +%Y%m%d).dump

# Or using the included backup script
./scripts/backup.sh`}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Automated Daily Backups</h3>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Add a daily backup cron job (runs at 2 AM)
crontab -e

# Add this line:
0 2 * * * /opt/banky/scripts/backup.sh >> /var/log/banky-backup.log 2>&1`}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Restore from Backup</h3>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Stop the application first
pm2 stop all

# Restore the database
pg_restore -h localhost -U banky -d banky -c backup_20260219.dump

# Restart the application
pm2 restart all`}
                        </pre>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Recommendation:</strong> Store backups on a separate server or cloud storage (AWS S3, Google Cloud Storage) for disaster recovery. Never keep backups only on the same server.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'updates' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-8 border border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                    <RefreshCw className="w-7 h-7 text-purple-600" />
                    Updating BANKY
                  </h2>
                  <p className="text-gray-600 mb-6">When a new version is released, follow these steps to update your installation. Updates are included during your support period.</p>

                  <div className="space-y-6">
                    <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# 1. Backup your database first (always!)
./scripts/backup.sh

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
curl http://localhost:5000/health`}
                      </pre>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>Important:</strong> Always backup your database before updating. Database migrations run automatically on startup, but having a backup ensures you can roll back if needed.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">How to Get Updates</h3>
                      <ul className="space-y-2 text-gray-600 text-sm">
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /><strong>CodeCanyon buyers:</strong> Download the latest version from your CodeCanyon downloads page</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /><strong>Direct purchase buyers:</strong> Updates are emailed to you or available in your customer portal</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Updates are free during your support period (varies by edition)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'troubleshooting' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-8 border border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                    <AlertTriangle className="w-7 h-7 text-amber-600" />
                    Troubleshooting
                  </h2>

                  <div className="space-y-6">
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">Application won't start</h3>
                      </div>
                      <div className="p-4 text-sm text-gray-600 space-y-2">
                        <p>Check the PM2 logs for error details:</p>
                        <div className="bg-gray-900 rounded p-3"><pre className="text-green-400 font-mono text-xs">pm2 logs --lines 50</pre></div>
                        <p>Common causes: missing <code className="bg-gray-100 px-1 rounded">.env</code> file, incorrect <code className="bg-gray-100 px-1 rounded">DATABASE_URL</code>, or port already in use.</p>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">Database connection failed</h3>
                      </div>
                      <div className="p-4 text-sm text-gray-600 space-y-2">
                        <p>Verify your PostgreSQL connection:</p>
                        <div className="bg-gray-900 rounded p-3"><pre className="text-green-400 font-mono text-xs">psql "postgresql://banky:password@localhost:5432/banky" -c "SELECT 1;"</pre></div>
                        <p>Check that PostgreSQL is running: <code className="bg-gray-100 px-1 rounded">sudo systemctl status postgresql</code></p>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">License key not recognized</h3>
                      </div>
                      <div className="p-4 text-sm text-gray-600 space-y-2">
                        <p>Make sure the key is copied exactly with no extra spaces. Check your <code className="bg-gray-100 px-1 rounded">.env</code> file:</p>
                        <div className="bg-gray-900 rounded p-3"><pre className="text-green-400 font-mono text-xs">grep LICENSE_KEY .env</pre></div>
                        <p>If the key is correct but still failing, contact <a href="mailto:support@banky.co.ke" className="text-blue-600 hover:underline">support@banky.co.ke</a> with your purchase receipt.</p>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">M-Pesa callbacks not received</h3>
                      </div>
                      <div className="p-4 text-sm text-gray-600 space-y-2">
                        <p>Callbacks require a publicly accessible HTTPS URL. Verify:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>SSL certificate is valid and not expired</li>
                          <li>Nginx is proxying to the correct port</li>
                          <li>Firewall allows incoming HTTPS traffic on port 443</li>
                          <li>Callback URL in <code className="bg-gray-100 px-1 rounded">.env</code> matches your Daraja app settings</li>
                        </ul>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">Page loads slowly or times out</h3>
                      </div>
                      <div className="p-4 text-sm text-gray-600 space-y-2">
                        <p>Check server resources and PM2 status:</p>
                        <div className="bg-gray-900 rounded p-3"><pre className="text-green-400 font-mono text-xs">{`# Check memory and CPU usage
free -h && top -bn1 | head -5

# Check PM2 process status
pm2 status

# Restart if processes are stuck
pm2 restart all`}</pre></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-2xl p-8 border border-purple-200 text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Still Need Help?</h3>
                  <p className="text-gray-600 mb-6">Our support team is available during your license support period.</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <a href="mailto:support@banky.co.ke" className="bg-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-purple-700 transition">
                      Email Support
                    </a>
                    <Link href="/contact" className="border border-purple-300 text-purple-700 px-8 py-3 rounded-lg font-medium hover:border-purple-400 transition">
                      Contact Form
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
