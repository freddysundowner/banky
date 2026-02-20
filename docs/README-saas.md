# BANKY SaaS - Deployment Guide

A comprehensive multi-tenant bank and Sacco management platform. Each organization gets its own isolated database provisioned via Neon PostgreSQL.

## Architecture

- **Multi-tenant**: Each organization gets a dedicated Neon PostgreSQL database for complete data isolation
- **Master database**: Stores user accounts, organizations, subscriptions, and platform settings
- **Tenant databases**: Each org's members, loans, transactions, accounting data lives in its own database
- **Admin panel**: Separate application for platform management at your admin subdomain

## Requirements

- Node.js 18+ (v20 LTS recommended)
- Python 3.11+
- PostgreSQL 14+ (master database)
- Neon API key (for provisioning tenant databases)
- Nginx (reverse proxy)
- PM2 (process manager)

## Package Contents

```
saas/
  frontend/           - Main app static files (serve via Nginx)
  admin/              - Admin panel static files (serve via Nginx)
  backend/            - Python API server (FastAPI)
  shared/             - Shared type definitions
  ecosystem.config.js - PM2 process configuration
  .env.example        - Environment variable template
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Master PostgreSQL connection string |
| `DEPLOYMENT_MODE` | Yes | Must be `saas` |
| `NEON_API_KEY` | Yes | Neon API key for provisioning tenant databases |
| `BREVO_API_KEY` | No | For email notifications (welcome, password reset, verification) |
| `SMS_API_KEY` | No | For SMS notifications |
| `STRIPE_SECRET_KEY` | No | For Stripe subscription payments |
| `PAYSTACK_SECRET_KEY` | No | For Paystack subscription payments |
| `SUNPAY_API_KEY` | No | SunPay managed M-Pesa gateway key |
| `EXCHANGE_RATE_API_KEY` | No | For currency conversion (exchangerate-api.com) |
| `SESSION_SECRET` | Recommended | Secret for session encryption (min 32 characters) |

## Setup Steps

### 1. Provision Master Database

Create a PostgreSQL database for the master data (user accounts, organizations, subscriptions):

```bash
sudo -u postgres psql
CREATE USER banky WITH PASSWORD 'your_secure_password';
CREATE DATABASE banky_master OWNER banky;
\q
```

Or use a managed PostgreSQL service and copy the connection string.

### 2. Get Neon API Key

Sign up at [neon.tech](https://neon.tech) and generate an API key from your account settings. This key allows BANKY to automatically create isolated databases for each new organization.

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
# Set DATABASE_URL, DEPLOYMENT_MODE=saas, NEON_API_KEY
```

### 4. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
cd ..
```

### 5. Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. Configure Nginx

You need two Nginx server blocks: one for the main app, one for the admin panel.

**Main App** (`/etc/nginx/sites-available/banky`):

```nginx
server {
    listen 80;
    server_name app.yourplatform.com;
    root /var/www/banky/saas/frontend;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    client_max_body_size 10M;
}
```

**Admin Panel** (`/etc/nginx/sites-available/banky-admin`):

```nginx
server {
    listen 80;
    server_name admin.yourplatform.com;
    root /var/www/banky/saas/admin;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    client_max_body_size 10M;
}
```

Enable both:
```bash
sudo ln -s /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/banky-admin /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Enable HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourplatform.com -d admin.yourplatform.com
```

### 8. Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

## Platform Features

### For Your Customers (Main App)

**Core Banking**
- Member management with KYC details, photos, and document uploads
- Multi-branch support with branch-level data isolation
- Staff management with role-based access control (RBAC)
- Configurable organization settings

**Loan Management**
- Configurable loan products (interest rates, terms, fees, penalties)
- Loan applications with approval workflows
- Multiple disbursement methods (cash, bank transfer, M-Pesa)
- Automated repayment tracking with instalment schedules
- Loan restructuring and rescheduling
- Guarantor system with guarantor liability tracking
- Loan eligibility rules (duplicate product prevention, good standing checks)
- Automated overdue notifications and due-date reminders

**Financial Operations**
- Quick transactions for basic deposit/withdrawal recording
- Teller Station with float management and end-of-day reconciliation
- Fixed deposit products with interest calculation and maturity processing
- Dividend declaration and distribution to members
- Expense tracking and recurring expense automation
- M-Pesa integration (STK Push deposits, B2C disbursements, C2B payments)
- Dual M-Pesa gateway support (direct Safaricom Daraja API or SunPay managed)

**Accounting**
- Full double-entry bookkeeping system
- Chart of Accounts with customizable account hierarchy
- Journal entries (manual and automated)
- General Ledger
- Financial reports: Trial Balance, Income Statement, Balance Sheet
- Payroll journal entries for salary disbursement and statutory deductions

**HR & Payroll**
- Employee records management
- Payroll processing with deductions
- Leave management
- Automated payroll accounting entries

**Reports & Analytics**
- Dashboard with key metrics (total members, active loans, deposits, revenue)
- Analytics with charts and trends
- CSV data export for members, transactions, and loans
- Audit logs for all system actions

**Communication**
- SMS notifications for transactions, loan updates, and reminders
- In-app notification center with bell icon alerts
- Email notifications (welcome emails, password reset)

**Security**
- Password reset via email with secure tokens
- Optional email verification for new accounts
- Rate limiting on login and registration endpoints
- Role-based permissions system
- Comprehensive audit trail

**User Experience**
- Onboarding wizard for new organizations (guided setup)
- Dark mode support
- Fully responsive design (mobile, tablet, desktop)
- Document management and file uploads

### For You (Admin Panel)

- Organization management (view, activate, deactivate, delete)
- Subscription plan configuration (Starter, Growth, Professional, Enterprise)
- Feature flag management per plan
- License key generation for enterprise customers
- Platform settings (trial days, default plans, legal pages)
- Landing page CMS (features, testimonials, FAQ, pricing)
- Revenue and usage analytics

### Subscription & Billing

- Multi-gateway support: Stripe, Paystack, M-Pesa (SunPay)
- USD-only pricing with dynamic currency conversion
- Monthly and annual billing cycles
- Configurable trial period for new organizations
- Automatic trial expiration with feature blocking
- Renewal reminder emails (7 days before expiry)

### Automation (Background Jobs)

- Auto-deduct loan repayments from member accounts
- Process matured fixed deposits
- Send overdue and due-date loan notifications
- Process recurring expenses
- Check trial expirations
- Send subscription renewal reminders

## Useful Commands

```bash
pm2 logs              # View all logs
pm2 logs banky-api    # View API logs only
pm2 restart all       # Restart all processes
pm2 status            # Check process status
pm2 monit             # Real-time monitoring
```

## Updating

1. Back up your master database: `pg_dump banky_master > backup.sql`
2. Replace `backend/`, `frontend/`, and `admin/` with the new version
3. Install updated dependencies: `cd backend && pip install -r requirements.txt`
4. Restart: `pm2 restart all`

Database migrations run automatically on startup for both master and tenant databases.

## Troubleshooting

- **App won't start:** Check `.env` has correct `DATABASE_URL` and `NEON_API_KEY`
- **Org creation fails:** Verify `NEON_API_KEY` is valid and has project creation permissions
- **Blank page:** Ensure Nginx root points to `frontend/` directory
- **API errors:** Check `pm2 logs banky-api` for details
- **Subscription payments failing:** Verify Stripe/Paystack keys in `.env`
