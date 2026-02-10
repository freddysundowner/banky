import { useState } from 'react';
import { Link } from 'wouter';
import { Server, Cloud, Database, Key, Terminal, CheckCircle, ArrowRight, ArrowLeft, BookOpen } from 'lucide-react';

type DeploymentMode = 'saas' | 'enterprise';

export default function DocsPage() {
  const [activeMode, setActiveMode] = useState<DeploymentMode>('saas');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold">B</span>
              <span className="text-xl font-bold text-gray-900">BANKY</span>
            </Link>
            
            <div className="flex items-center gap-4">
              <span className="hidden sm:flex items-center gap-2 text-gray-600">
                <BookOpen className="w-5 h-5" />
                Technical Documentation
              </span>
              <Link href="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Deployment Guide
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Complete technical documentation for deploying BANKY in your environment
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            <button
              className={`px-6 py-3 rounded-md font-medium transition flex items-center gap-2 ${
                activeMode === 'saas' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveMode('saas')}
            >
              <Cloud className="w-5 h-5" />
              SaaS Platform
            </button>
            <button
              className={`px-6 py-3 rounded-md font-medium transition flex items-center gap-2 ${
                activeMode === 'enterprise' ? 'bg-purple-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveMode('enterprise')}
            >
              <Server className="w-5 h-5" />
              Enterprise Self-Hosted
            </button>
          </div>
        </div>

        {activeMode === 'saas' ? (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 md:p-12 border border-blue-100">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Cloud className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">SaaS Multi-Tenant Platform</h2>
                  <p className="text-gray-600 text-lg">
                    Run BANKY as a SaaS platform where each organization gets their own isolated database.
                    Perfect for service providers who want to offer banking software to multiple Saccos.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mt-8">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-lg">
                    <Database className="w-5 h-5 text-blue-600" />
                    Architecture
                  </h3>
                  <ul className="space-y-4 text-gray-600">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Database per Tenant</strong>
                        <p className="text-sm mt-1">Each organization gets a dedicated PostgreSQL database for complete data isolation</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Master Database</strong>
                        <p className="text-sm mt-1">Central database stores organization metadata, subscriptions, and admin users</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Neon Integration</strong>
                        <p className="text-sm mt-1">Automatic database provisioning when new organizations sign up</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Admin Panel</strong>
                        <p className="text-sm mt-1">Separate admin interface for managing organizations, plans, and licenses</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-lg">
                    <Key className="w-5 h-5 text-blue-600" />
                    Requirements
                  </h3>
                  <ul className="space-y-4 text-gray-600">
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Neon Account</strong>
                        <p className="text-sm mt-1">Required for automatic database provisioning (<a href="https://neon.tech" className="text-blue-600 hover:underline" target="_blank" rel="noopener">neon.tech</a>)</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Node.js 18+ & Python 3.11+</strong>
                        <p className="text-sm mt-1">Runtime environments for frontend and backend</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Linux Server</strong>
                        <p className="text-sm mt-1">Ubuntu 22.04 or 24.04 LTS recommended</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Domain with Subdomains</strong>
                        <p className="text-sm mt-1">app.*, admin.*, api.* for different services</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                <Terminal className="w-7 h-7 text-blue-600" />
                SaaS Installation Guide
              </h2>

              <div className="space-y-8">
                <div className="border-l-4 border-blue-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">1</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Server Prerequisites</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Install required software on your Ubuntu server:</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2`}
                    </pre>
                  </div>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">2</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Environment Configuration</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Create your environment file with required settings:</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Create .env file
cat > .env << 'EOF'
# Master database for organization metadata
DATABASE_URL=postgresql://user:password@host:5432/banky_master

# Deployment mode
DEPLOYMENT_MODE=saas

# Neon API key for tenant database provisioning
NEON_API_KEY=your-neon-api-key

# Security
SESSION_SECRET=your-secure-random-secret-min-32-chars
EOF`}
                    </pre>
                  </div>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">3</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Install & Start</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Install dependencies and start the application:</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Extract and enter directory
unzip banky-saas.zip && cd banky

# Run installation script
./install.sh

# Start all services with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup`}
                    </pre>
                  </div>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">4</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Configure DNS Records</h3>
                  </div>
                  <p className="text-gray-600 mb-4">First, add these DNS records pointing to your server IP:</p>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">Type</th>
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">Name</th>
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">Value</th>
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">Service</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-900 divide-y divide-gray-100">
                        <tr>
                          <td className="py-3 px-4 font-mono">A</td>
                          <td className="py-3 px-4 font-mono">@</td>
                          <td className="py-3 px-4 font-mono text-blue-600">YOUR_SERVER_IP</td>
                          <td className="py-3 px-4">Landing Page</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono">A</td>
                          <td className="py-3 px-4 font-mono">www</td>
                          <td className="py-3 px-4 font-mono text-blue-600">YOUR_SERVER_IP</td>
                          <td className="py-3 px-4">Landing Page</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono">A</td>
                          <td className="py-3 px-4 font-mono">app</td>
                          <td className="py-3 px-4 font-mono text-blue-600">YOUR_SERVER_IP</td>
                          <td className="py-3 px-4">Main Application</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono">A</td>
                          <td className="py-3 px-4 font-mono">admin</td>
                          <td className="py-3 px-4 font-mono text-blue-600">YOUR_SERVER_IP</td>
                          <td className="py-3 px-4">Admin Panel</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono">A</td>
                          <td className="py-3 px-4 font-mono">api</td>
                          <td className="py-3 px-4 font-mono text-blue-600">YOUR_SERVER_IP</td>
                          <td className="py-3 px-4">API Server</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>Note:</strong> DNS propagation can take up to 24-48 hours. You can verify with: <code className="bg-amber-100 px-1 rounded">dig +short app.yoursite.com</code>
                    </p>
                  </div>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">5</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Create Nginx Configuration</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Create the Nginx configuration file for all services:</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Create Nginx configuration file
sudo nano /etc/nginx/sites-available/banky`}
                    </pre>
                  </div>
                  <p className="text-gray-600 my-4">Paste the following configuration (replace <code className="bg-gray-100 px-1 rounded">yoursite.com</code> with your domain):</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Landing Page - www.yoursite.com & yoursite.com
server {
    listen 80;
    server_name yoursite.com www.yoursite.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Main Application - app.yoursite.com
server {
    listen 80;
    server_name app.yoursite.com;

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
    }
}

# Admin Panel - admin.yoursite.com
server {
    listen 80;
    server_name admin.yoursite.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API Server - api.yoursite.com
server {
    listen 80;
    server_name api.yoursite.com;

    # Increase request body size for file uploads
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings for long API calls
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}`}
                    </pre>
                  </div>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">6</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Enable Site & Test Configuration</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Enable the site and verify Nginx configuration is valid:</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration for syntax errors
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload Nginx to apply changes
sudo systemctl reload nginx

# Check Nginx status
sudo systemctl status nginx`}
                    </pre>
                  </div>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">7</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Install SSL Certificates</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Use Let's Encrypt (Certbot) for free SSL certificates:</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificates for all domains
# Certbot will automatically modify your Nginx config
sudo certbot --nginx \\
    -d yoursite.com \\
    -d www.yoursite.com \\
    -d app.yoursite.com \\
    -d admin.yoursite.com \\
    -d api.yoursite.com

# Follow the prompts:
# 1. Enter your email address
# 2. Agree to terms of service (Y)
# 3. Choose whether to share email (Y/N)
# 4. Select redirect option: 2 (Redirect HTTP to HTTPS)

# Verify auto-renewal is set up
sudo certbot renew --dry-run

# Check certificate status
sudo certbot certificates`}
                    </pre>
                  </div>
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>Auto-Renewal:</strong> Certbot automatically adds a cron job to renew certificates. They renew every 60 days before expiration.
                    </p>
                  </div>
                </div>

                <div className="border-l-4 border-blue-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">8</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Verify Installation</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Test that all services are accessible via HTTPS:</p>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">Service</th>
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">URL</th>
                          <th className="text-left py-3 px-4 text-gray-600 font-medium">Expected</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-900 divide-y divide-gray-100">
                        <tr>
                          <td className="py-3 px-4">Landing Page</td>
                          <td className="py-3 px-4 font-mono text-blue-600">https://www.yoursite.com</td>
                          <td className="py-3 px-4">Marketing website</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4">Main App</td>
                          <td className="py-3 px-4 font-mono text-blue-600">https://app.yoursite.com</td>
                          <td className="py-3 px-4">Login page</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4">Admin Panel</td>
                          <td className="py-3 px-4 font-mono text-blue-600">https://admin.yoursite.com</td>
                          <td className="py-3 px-4">Admin login</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4">API Health</td>
                          <td className="py-3 px-4 font-mono text-blue-600">https://api.yoursite.com/health</td>
                          <td className="py-3 px-4">{"{ \"status\": \"ok\" }"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 md:p-12 border border-purple-100">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Server className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Enterprise Self-Hosted</h2>
                  <p className="text-gray-600 text-lg">
                    Deploy BANKY on your own infrastructure with a one-time license. 
                    Perfect for large Saccos who want complete control over their data and environment.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mt-8">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-lg">
                    <Database className="w-5 h-5 text-purple-600" />
                    Architecture
                  </h3>
                  <ul className="space-y-4 text-gray-600">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Single Database</strong>
                        <p className="text-sm mt-1">One PostgreSQL database for your entire organization</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Compiled Binary</strong>
                        <p className="text-sm mt-1">Pre-compiled server executable for easy deployment</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">License Protected</strong>
                        <p className="text-sm mt-1">Features unlocked via your unique license key</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">No Admin Panel</strong>
                        <p className="text-sm mt-1">Simplified setup - admin panel is only for SaaS providers</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-lg">
                    <Key className="w-5 h-5 text-purple-600" />
                    Requirements
                  </h3>
                  <ul className="space-y-4 text-gray-600">
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Any PostgreSQL 14+</strong>
                        <p className="text-sm mt-1">Self-hosted, AWS RDS, Azure Database, Google Cloud SQL, etc.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Linux Server</strong>
                        <p className="text-sm mt-1">Ubuntu, Debian, CentOS, or any Linux distribution</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">License Key</strong>
                        <p className="text-sm mt-1">Provided after purchase, tied to your plan features</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">No Neon Required</strong>
                        <p className="text-sm mt-1">Use any PostgreSQL provider of your choice</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                <Terminal className="w-7 h-7 text-purple-600" />
                Enterprise Installation Guide
              </h2>

              <div className="space-y-8">
                <div className="border-l-4 border-purple-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold">1</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Setup PostgreSQL Database</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Use any PostgreSQL 14+ database - self-hosted or cloud:</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Option A: Self-hosted PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql << EOF
CREATE USER banky WITH PASSWORD 'your_secure_password';
CREATE DATABASE banky OWNER banky;
GRANT ALL PRIVILEGES ON DATABASE banky TO banky;
EOF

# Option B: Cloud PostgreSQL (AWS RDS, Azure, GCP)
# Simply copy the connection string provided by your cloud provider
# Format: postgresql://user:password@host:5432/database`}
                    </pre>
                  </div>
                </div>

                <div className="border-l-4 border-purple-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold">2</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Configure Environment & License</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Create your environment file with your license key:</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Create .env file
cat > .env << 'EOF'
# Your PostgreSQL database connection
DATABASE_URL=postgresql://banky:your_password@localhost:5432/banky

# Must be set to 'enterprise' for self-hosted
DEPLOYMENT_MODE=enterprise

# Your license key (provided after purchase)
LICENSE_KEY=BANKY-PRE-2026-XXXXXXXX

# Security
SESSION_SECRET=your-secure-random-secret-min-32-chars
EOF`}
                    </pre>
                  </div>
                  <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-800">
                      <strong>License Key Format:</strong> BANKY-{'{EDITION}'}-{'{YEAR}'}-{'{ID}'}
                      <br /><br />
                      <span className="font-mono">BAS</span> = Basic Edition &nbsp;|&nbsp;
                      <span className="font-mono">STD</span> = Standard Edition &nbsp;|&nbsp;
                      <span className="font-mono">PRE</span> = Premium Edition &nbsp;|&nbsp;
                      <span className="font-mono">ENT</span> = Enterprise Edition
                    </p>
                  </div>
                </div>

                <div className="border-l-4 border-purple-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold">3</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Run BANKY Server</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Extract and run the compiled binary:</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Extract the enterprise package
unzip banky-enterprise.zip
cd banky-enterprise

# Make binary executable (if needed)
chmod +x banky-server

# Run the server
./banky-server

# Server starts on port 5000
# Access at http://your-server:5000`}
                    </pre>
                  </div>
                </div>

                <div className="border-l-4 border-purple-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold">4</span>
                    <h3 className="font-semibold text-gray-900 text-lg">Production Setup (Systemd Service)</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Configure BANKY as a system service for automatic startup:</p>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre">
{`# Create system user
sudo useradd -r -s /bin/false banky

# Move files to /opt
sudo mkdir -p /opt/banky
sudo cp -r banky-enterprise/* /opt/banky/
sudo chown -R banky:banky /opt/banky

# Create systemd service
sudo tee /etc/systemd/system/banky.service << 'EOF'
[Unit]
Description=BANKY Banking Server
After=network.target postgresql.service

[Service]
Type=simple
User=banky
WorkingDirectory=/opt/banky
ExecStart=/opt/banky/banky-server
Restart=always
RestartSec=10
EnvironmentFile=/opt/banky/.env

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable banky
sudo systemctl start banky

# Check status
sudo systemctl status banky`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">License Editions Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-purple-200">
                      <th className="text-left py-3 px-4 text-gray-600 font-semibold">Edition</th>
                      <th className="text-left py-3 px-4 text-gray-600 font-semibold">License Key</th>
                      <th className="text-center py-3 px-4 text-gray-600 font-semibold">Members</th>
                      <th className="text-center py-3 px-4 text-gray-600 font-semibold">Staff</th>
                      <th className="text-center py-3 px-4 text-gray-600 font-semibold">Branches</th>
                      <th className="text-center py-3 px-4 text-gray-600 font-semibold">Support</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-900 divide-y divide-purple-100">
                    <tr className="hover:bg-purple-100/50">
                      <td className="py-4 px-4 font-medium">Basic</td>
                      <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-BAS-XXXX-XXXX</td>
                      <td className="py-4 px-4 text-center">1,000</td>
                      <td className="py-4 px-4 text-center">5</td>
                      <td className="py-4 px-4 text-center">1</td>
                      <td className="py-4 px-4 text-center">1 year</td>
                    </tr>
                    <tr className="hover:bg-purple-100/50">
                      <td className="py-4 px-4 font-medium">Standard</td>
                      <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-STD-XXXX-XXXX</td>
                      <td className="py-4 px-4 text-center">5,000</td>
                      <td className="py-4 px-4 text-center">20</td>
                      <td className="py-4 px-4 text-center">10</td>
                      <td className="py-4 px-4 text-center">1 year</td>
                    </tr>
                    <tr className="hover:bg-purple-100/50">
                      <td className="py-4 px-4 font-medium">Premium</td>
                      <td className="py-4 px-4 font-mono text-purple-600 text-xs">BANKY-PRE-XXXX-XXXX</td>
                      <td className="py-4 px-4 text-center">20,000</td>
                      <td className="py-4 px-4 text-center">100</td>
                      <td className="py-4 px-4 text-center">50</td>
                      <td className="py-4 px-4 text-center">2 years</td>
                    </tr>
                    <tr className="hover:bg-purple-100/50">
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

        <div className="mt-16 text-center bg-white rounded-2xl p-8 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Need Help?</h3>
          <p className="text-gray-600 mb-6">Our team is ready to assist with your deployment</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/#pricing" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition">
              View Pricing
            </Link>
            <button className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:border-gray-400 transition">
              Contact Sales
            </button>
          </div>
        </div>
      </div>

      <footer className="bg-gray-900 text-gray-400 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>&copy; 2026 BANKY. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
