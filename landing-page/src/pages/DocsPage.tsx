import { useState, useEffect, useRef } from 'react';
import { Server, Key, Terminal, CheckCircle, ArrowRight, Shield, Globe, HardDrive, RefreshCw, Mail, AlertTriangle, FileText, Settings } from 'lucide-react';

type SectionId = 'overview' | 'requirements' | 'installation' | 'license' | 'database' | 'pm2' | 'nginx' | 'ssl' | 'backup' | 'updates' | 'troubleshooting';

interface DocsConfig {
  support_email: string;
}

const allSections: { id: SectionId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'installation', label: 'Installation' },
  { id: 'license', label: 'License Activation' },
  { id: 'database', label: 'Database Setup' },
  { id: 'pm2', label: 'PM2 Process Manager' },
  { id: 'nginx', label: 'Nginx Reverse Proxy' },
  { id: 'ssl', label: 'SSL Certificates' },
  { id: 'backup', label: 'Backup & Restore' },
  { id: 'updates', label: 'Updates' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

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

function OverviewSection() {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">What You Get</h2>
        <p className="text-gray-600 mb-6">
          BANKY is a complete self-hosted banking and Sacco management system. Deploy it on your own server with full data ownership and no recurring platform fees.
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
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Database migration scripts (run automatically)</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />PM2 production process manager config</li>
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
              </tr>
            </thead>
            <tbody className="text-gray-900 divide-y divide-gray-100">
              <tr className="hover:bg-purple-50/50">
                <td className="py-4 px-4 font-medium">Basic</td>
                <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-BAS-XXXX-XXXX</td>
                <td className="py-4 px-4 text-center">1,000</td>
                <td className="py-4 px-4 text-center">5</td>
                <td className="py-4 px-4 text-center">1</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="py-4 px-4 font-medium">Standard</td>
                <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-STD-XXXX-XXXX</td>
                <td className="py-4 px-4 text-center">5,000</td>
                <td className="py-4 px-4 text-center">20</td>
                <td className="py-4 px-4 text-center">10</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="py-4 px-4 font-medium">Premium</td>
                <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-PRE-XXXX-XXXX</td>
                <td className="py-4 px-4 text-center">20,000</td>
                <td className="py-4 px-4 text-center">100</td>
                <td className="py-4 px-4 text-center">50</td>
              </tr>
              <tr className="hover:bg-purple-50/50">
                <td className="py-4 px-4 font-medium">Enterprise</td>
                <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-ENT-XXXX-XXXX</td>
                <td className="py-4 px-4 text-center font-medium text-green-600">Unlimited</td>
                <td className="py-4 px-4 text-center font-medium text-green-600">Unlimited</td>
                <td className="py-4 px-4 text-center font-medium text-green-600">Unlimited</td>
              </tr>
              <tr className="hover:bg-purple-50/50 bg-green-50/30">
                <td className="py-4 px-4 font-medium">Perpetual (Lifetime)</td>
                <td className="py-4 px-4 font-mono text-green-600 text-xs">BANKY-ENT-PERP-XXXX</td>
                <td className="py-4 px-4 text-center font-medium text-green-600">Unlimited</td>
                <td className="py-4 px-4 text-center font-medium text-green-600">Unlimited</td>
                <td className="py-4 px-4 text-center font-medium text-green-600">Unlimited</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Tip type="info">
          <strong>Perpetual keys</strong> (containing <code className="bg-blue-100 px-1 rounded text-sm">PERP</code>) never expire and unlock all features with no limits. Other keys are tied to their edition limits.
        </Tip>
      </div>
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

      <Tip type="info">
        <strong>Installation guides:</strong> See the <strong>Database Setup</strong>, <strong>PM2 Process Manager</strong>, <strong>Nginx Reverse Proxy</strong>, and <strong>SSL Certificates</strong> sections for step-by-step setup instructions for each component.
      </Tip>
    </div>
  );
}

function InstallationSection() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
          <Terminal className="w-7 h-7 text-purple-600" />
          Application Installation
        </h2>

        <Tip type="info">
          <strong>What does install.sh do?</strong> The install script only sets up the BANKY application itself — Node.js dependencies, Python virtual environment, and frontend build. Server infrastructure (PostgreSQL, Nginx, PM2, SSL) is set up separately. See the guides below.
        </Tip>

        <div className="space-y-8 mt-8">
          <div className="border-l-4 border-purple-500 pl-6">
            <div className="flex items-center gap-3 mb-3">
              <StepNumber n={1} />
              <h3 className="font-semibold text-gray-900 text-lg">Upload & Extract</h3>
            </div>
            <p className="text-gray-600 mb-4">Upload the BANKY package to your server and extract it:</p>
            <CodeBlock>{`# Upload the zip file to your server (using scp, rsync, or SFTP)
# Then extract:
unzip banky-*.zip
cd banky`}</CodeBlock>
          </div>

          <div className="border-l-4 border-purple-500 pl-6">
            <div className="flex items-center gap-3 mb-3">
              <StepNumber n={2} />
              <h3 className="font-semibold text-gray-900 text-lg">Configure Environment</h3>
            </div>
            <p className="text-gray-600 mb-4">Copy the template and fill in your settings:</p>
            <CodeBlock>{`# Copy the environment template
cp .env.example .env

# Edit with your settings
nano .env`}</CodeBlock>
            <p className="text-gray-600 mt-4 mb-3">Key settings in your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env</code> file:</p>
            <CodeBlock>{`# Your PostgreSQL connection string (required)
DATABASE_URL=postgresql://banky:your_password@localhost:5432/banky

# Must be "enterprise" for self-hosted installations
DEPLOYMENT_MODE=enterprise

# Random secret for session encryption (auto-generated by installer)
SESSION_SECRET=your-secret-here

# Application port
PORT=5000`}</CodeBlock>
          </div>

          <div className="border-l-4 border-purple-500 pl-6">
            <div className="flex items-center gap-3 mb-3">
              <StepNumber n={3} />
              <h3 className="font-semibold text-gray-900 text-lg">Run the Installer</h3>
            </div>
            <p className="text-gray-600 mb-4">The install script checks prerequisites, installs dependencies, and builds the frontend:</p>
            <CodeBlock>{`chmod +x install.sh
./install.sh`}</CodeBlock>
            <p className="text-gray-600 mt-4 mb-2">The installer will:</p>
            <ul className="space-y-1 text-sm text-gray-600 ml-4">
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Check that Node.js and Python 3 are installed</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Create .env from template (if not already present)</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Install Node.js dependencies</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Create Python virtual environment and install packages</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />Build the frontend for production</li>
            </ul>
          </div>

          <div className="border-l-4 border-purple-500 pl-6">
            <div className="flex items-center gap-3 mb-3">
              <StepNumber n={4} />
              <h3 className="font-semibold text-gray-900 text-lg">Start the Application</h3>
            </div>
            <p className="text-gray-600 mb-4">Start the application using PM2:</p>
            <CodeBlock>{`pm2 start ecosystem.config.js

# Opens at http://localhost:5000`}</CodeBlock>
            <Tip type="info">
              <strong>PM2 recommended:</strong> PM2 keeps BANKY running in the background and restarts it automatically if it crashes. See the <strong>PM2 Process Manager</strong> section below for full setup including auto-start on server reboot.
            </Tip>
          </div>

          <Tip type="success">
            <strong>First Login:</strong> Open BANKY in your browser, register your account, and create your organization. All features are unlocked automatically in enterprise mode.
          </Tip>
        </div>
      </div>
    </div>
  );
}

function LicenseSection({ supportEmail }: { supportEmail: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <Key className="w-7 h-7 text-purple-600" />
          License Activation
        </h2>

        <div className="space-y-6">
          <Tip type="success">
            <strong>No license key required!</strong> All features and limits are automatically unlocked in enterprise mode. License keys are optional and only needed if you want to restrict features to a specific edition.
          </Tip>

          <p className="text-gray-600 mt-4">If you do choose to use a license key to control edition limits, set it in your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env</code> file.</p>

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

          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <h3 className="font-semibold text-gray-900 mb-3">Perpetual (Lifetime) Keys</h3>
            <div className="font-mono text-lg text-green-700 mb-3">BANKY-ENT-PERP-XXXXXXXX</div>
            <p className="text-sm text-gray-600">Keys containing <code className="bg-white px-1.5 py-0.5 rounded text-sm">PERP</code> are perpetual lifetime keys. They never expire and unlock all features with no limits. If your <code className="bg-white px-1.5 py-0.5 rounded text-sm">.env.example</code> already has a key pre-filled, it is a lifetime key — do not remove it.</p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Activation Steps</h3>
            <ol className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                <span>Open your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env</code> file and set the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">LICENSE_KEY</code> value</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                <span>Start or restart the application — the key is validated automatically on startup</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                <span>Features and limits are applied based on your key's edition</span>
              </li>
            </ol>
          </div>

          <Tip type="warning">
            <strong>Important:</strong> Do not modify your license key. If your key is not working, verify there are no extra spaces and that the full key is copied correctly. Contact <a href={`mailto:${supportEmail}`} className="text-amber-900 underline">{supportEmail}</a> if you need assistance.
          </Tip>
        </div>
      </div>
    </div>
  );
}

function DatabaseSection() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <HardDrive className="w-7 h-7 text-purple-600" />
          Database Setup
        </h2>

        <p className="text-gray-600 mb-6">BANKY requires PostgreSQL 14 or higher. You can use a local installation, a managed cloud database (AWS RDS, Neon, Supabase), or any PostgreSQL provider.</p>

        <div className="space-y-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Option 1: Local PostgreSQL (Ubuntu/Debian)</h3>
            <CodeBlock>{`# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start and enable the service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create the database and user
sudo -u postgres psql << EOF
CREATE USER banky WITH PASSWORD 'your_secure_password';
CREATE DATABASE banky OWNER banky;
GRANT ALL PRIVILEGES ON DATABASE banky TO banky;
EOF

# Your connection string:
# DATABASE_URL=postgresql://banky:your_secure_password@localhost:5432/banky`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Option 2: Local PostgreSQL (macOS)</h3>
            <CodeBlock>{`# Install with Homebrew
brew install postgresql@16
brew services start postgresql@16

# Create the database
createdb banky

# Your connection string:
# DATABASE_URL=postgresql://$(whoami)@localhost:5432/banky`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Option 3: Cloud Database</h3>
            <p className="text-gray-600 mb-3">If using a managed database service, simply copy the connection string they provide and paste it into your <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">.env</code> file as <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">DATABASE_URL</code>.</p>
            <Tip type="info">
              Cloud providers like <strong>Neon</strong>, <strong>Supabase</strong>, and <strong>AWS RDS</strong> all work with BANKY. Just make sure SSL is enabled if required by your provider (add <code className="bg-blue-100 px-1 rounded text-sm">?sslmode=require</code> to the connection string).
            </Tip>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Verify Connection</h3>
            <CodeBlock>{`# Test your connection string
psql "postgresql://banky:your_password@localhost:5432/banky" -c "SELECT 1;"

# If successful, you'll see:
#  ?column?
# ----------
#         1`}</CodeBlock>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pm2Section() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <RefreshCw className="w-7 h-7 text-purple-600" />
          PM2 Process Manager
        </h2>

        <p className="text-gray-600 mb-6">PM2 keeps BANKY running in the background, restarts it if it crashes, and auto-starts it when your server reboots. This is the recommended way to run BANKY in production.</p>

        <div className="space-y-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Install PM2</h3>
            <CodeBlock>{`# Install PM2 globally
sudo npm install -g pm2`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Start BANKY with PM2</h3>
            <p className="text-gray-600 mb-3">BANKY includes an <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">ecosystem.config.js</code> file pre-configured for PM2:</p>
            <CodeBlock>{`# Navigate to your BANKY directory
cd /opt/banky

# Start all services
pm2 start ecosystem.config.js

# Save the process list (survives reboots)
pm2 save

# Set PM2 to auto-start on server boot
pm2 startup
# Follow the instructions PM2 prints (copy & paste the command it gives you)`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Useful PM2 Commands</h3>
            <CodeBlock>{`# Check running services
pm2 status

# View logs (all services)
pm2 logs

# View API logs only
pm2 logs banky

# Restart all services
pm2 restart all

# Restart just the API
pm2 restart banky

# Stop all services
pm2 stop all

# Monitor CPU/memory usage
pm2 monit`}</CodeBlock>
          </div>

          <Tip type="info">
            <strong>What gets started?</strong> The ecosystem config runs two processes: <code className="bg-blue-100 px-1 rounded text-sm">banky</code> (the main application server on port 5000) and <code className="bg-blue-100 px-1 rounded text-sm">banky-scheduler</code> (handles automated tasks like loan notifications and fixed deposit maturity).
          </Tip>
        </div>
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
          Nginx Reverse Proxy
        </h2>

        <p className="text-gray-600 mb-6">Nginx sits in front of BANKY and forwards web traffic to the application. This is standard practice for production deployments and required for SSL/HTTPS.</p>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">1. Install Nginx</h3>
            <CodeBlock>{`sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">2. Create the Configuration</h3>
            <p className="text-gray-600 mb-4">Create a new Nginx config file for BANKY:</p>
            <CodeBlock>{`sudo nano /etc/nginx/sites-available/banky`}</CodeBlock>
            <p className="text-gray-600 mt-3 mb-4">Paste the following (replace <code className="bg-gray-100 px-1 rounded text-sm">yourdomain.com</code> with your actual domain):</p>
            <CodeBlock>{`server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 20M;

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
        proxy_read_timeout 86400;
    }
}`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">3. Enable & Test</h3>
            <CodeBlock>{`# Enable the site
sudo ln -sf /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/banky

# Optionally remove the default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration for errors
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx`}</CodeBlock>
          </div>

          <Tip type="info">
            <strong>DNS Setup:</strong> Point your domain's A record to your server's IP address. DNS changes can take up to 48 hours to propagate, but usually take 5-15 minutes.
          </Tip>
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

        <div className="space-y-6">
          <p className="text-gray-600">Secure your BANKY installation with a free SSL certificate from Let's Encrypt. This is required for M-Pesa callbacks and recommended for all deployments.</p>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Install & Configure Certbot</h3>
            <CodeBlock>{`# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain and configure SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts - Certbot will:
# 1. Verify domain ownership
# 2. Obtain the certificate
# 3. Update Nginx configuration
# 4. Set up auto-renewal`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Verify Auto-Renewal</h3>
            <CodeBlock>{`# Test the renewal process
sudo certbot renew --dry-run

# Certificates auto-renew every 90 days via systemd timer
sudo systemctl status certbot.timer`}</CodeBlock>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Configure Firewall</h3>
            <CodeBlock>{`# Allow HTTPS and SSH traffic
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status`}</CodeBlock>
          </div>
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

function UpdatesSection({ supportEmail }: { supportEmail: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <RefreshCw className="w-7 h-7 text-purple-600" />
          Updating BANKY
        </h2>
        <p className="text-gray-600 mb-6">When a new version is released, follow these steps to update your installation.</p>

        <div className="space-y-6">
          <CodeBlock>{`# 1. Backup your database first (always!)
pg_dump "$DATABASE_URL" -F c -f backup_$(date +%Y%m%d).dump

# 2. Stop the application
pm2 stop all

# 3. Extract the new version
unzip banky-v2.x.zip -d /tmp/banky-update

# 4. Copy new files (preserving your .env)
rsync -av --exclude='.env' /tmp/banky-update/ /opt/banky/

# 5. Install any new dependencies
cd /opt/banky && ./install.sh

# 6. Build frontend
npx vite build

# 7. Start the application (migrations run automatically)
pm2 restart all

# 8. Verify everything is working
pm2 status
curl http://localhost:5000`}</CodeBlock>

          <Tip type="warning">
            <strong>Important:</strong> Always backup your database before updating. Database migrations run automatically on startup, but having a backup ensures you can roll back if needed.
          </Tip>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Support</h3>
            <p className="text-gray-600 text-sm">For assistance with updates or any issues, contact <a href={`mailto:${supportEmail}`} className="text-blue-600 hover:underline">{supportEmail}</a>.</p>
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

function GuideContent({ activeSection, supportEmail }: { activeSection: SectionId; supportEmail: string }) {
  switch (activeSection) {
    case 'overview': return <OverviewSection />;
    case 'requirements': return <RequirementsSection />;
    case 'installation': return <InstallationSection />;
    case 'license': return <LicenseSection supportEmail={supportEmail} />;
    case 'database': return <DatabaseSection />;
    case 'pm2': return <Pm2Section />;
    case 'nginx': return <NginxSection />;
    case 'ssl': return <SslSection />;
    case 'backup': return <BackupSection />;
    case 'updates': return <UpdatesSection supportEmail={supportEmail} />;
    case 'troubleshooting': return <TroubleshootingSection supportEmail={supportEmail} />;
    default: return null;
  }
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const contentRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<DocsConfig>({
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
          setConfig({ support_email: data.support_email || 'support@banky.co.ke' });
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

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
            Self-Hosted
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Installation & Setup Guide
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to deploy BANKY on your own server.
          </p>
        </div>

        <div className="flex gap-8">
          <nav className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">Documentation</p>
              {allSections.map(s => (
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
                {allSections.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <GuideContent activeSection={activeSection} supportEmail={config.support_email} />
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
