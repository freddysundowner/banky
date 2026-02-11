# BANKY - Bank & Sacco Management System

## Overview
BANKY is a comprehensive multi-tenant bank and Sacco management system designed with a database-per-tenant SaaS architecture. This ensures complete data isolation, with each organization receiving a dedicated Neon PostgreSQL database. The project aims to provide a robust, scalable, and secure platform for managing banking and Sacco operations, including core financial functionalities, advanced loan management, comprehensive accounting, and administrative tools.

## User Preferences
I want iterative development. Ask before making major changes.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18 and TypeScript, utilizing Shadcn UI components styled with Tailwind CSS for a professional, responsive, and modern banking theme. Key design elements include a blue primary color, Inter font family, consistent spacing and typography, and full mobile responsiveness achieved through dynamic layouts, responsive padding, and mobile-first breakpoints. Dark mode is supported.

### Technical Implementations
- **Frontend**: React 18, TypeScript, TanStack Query, Wouter for routing.
- **Backend**: Python FastAPI with SQLAlchemy ORM.
- **Database**: PostgreSQL with Neon for database-per-tenant provisioning.
- **Authentication**: 
    - **Master Users (Owners/Admins)**: Stored in master database with session tokens using `master:token` cookie format.
    - **Staff Users**: Fully tenant-isolated authentication. Staff records and sessions (StaffSession table) exist only in tenant databases. Cookie format: `tenant:org_id:token`. No master database involvement for staff authentication.
    - AuthContext abstraction handles both authentication types uniformly.
- **Performance Optimization**: 
    - Database connection pooling with cached engines and session factories (pool_size=10, max_overflow=20).
    - Session bundle endpoint (`/api/auth/session/{org_id}`) returns user + permissions + features in a single API call, reducing the waterfall of sequential requests.
    - `useSession` hook pre-populates React Query cache for permissions and features, eliminating redundant API calls on navigation.
    - Request timing middleware logs API response times for monitoring.
- **Multi-Tenancy**: Each organization's data is isolated in its own Neon PostgreSQL database, managed through a master database for organization metadata only.
- **Core Features**: Includes member, staff, and branch management, configurable loan products, and a comprehensive dashboard.
- **Advanced Loan Features**: Supports loan applications, disbursement (M-Pesa, bank, cash), repayment tracking, restructuring, and a guarantor system.
- **Financial Management**:
    - **Teller Station**: Dedicated interface for deposits, withdrawals, and loan repayments, with cash float tracking and end-of-day reconciliation.
    - **Float Management**: Supervisor interface for allocating floats, managing vault cash, approving replenishment requests, and shift handovers.
    - **Fixed Deposits Module**: Manages fixed deposit products, member deposits, interest calculation, maturity alerts, and early withdrawals. Funds for fixed deposits must originate from savings accounts.
    - **Dividends Module**: Manages dividend declaration, automatic calculation based on share balance, approval workflow, and distribution options (savings or shares).
    - **Transactions**: Supports deposits, withdrawals, and transfers across savings, shares, and fixed deposits.
    - **Defaults & Collections**: Automatic overdue detection, aging analysis, and collection tracking.
    - **Accounting Module**: A full double-entry bookkeeping system with a default Chart of Accounts, journal entries, General Ledger, and auto-posting for all financial operations. It generates Trial Balance, Income Statement, and Balance Sheet reports.
- **M-Pesa Payment Gateways**: Dual gateway support:
    - **Direct Daraja API**: Organizations connect directly to Safaricom's API with their own credentials (Consumer Key, Secret, Passkey)
    - **SunPay (Managed Gateway)**: Simplified M-Pesa integration via SunPay.co.ke - only requires an API key. Supports STK Push, C2B (Paybill), B2C (disbursements), and transaction reversals. Pricing: 1.5% per transaction.
    - Gateway selection per org in Settings > M-Pesa tab
    - Webhook endpoint: `/api/webhooks/sunpay/{org_id}` for automatic payment processing
    - Service module: `python_backend/services/sunpay.py`, Routes: `python_backend/routes/sunpay.py`
    - **M-Pesa Loan Repayment**: STK Push with loan_id auto-applies payment to the loan via webhook. Paybill deposits go to savings. Shared loan service: `python_backend/services/mpesa_loan_service.py`
    - **M-Pesa Loan Disbursement**: When disbursing via M-Pesa, B2C is called (SunPay or Daraja based on gateway setting). The unified STK Push endpoint (`/api/organizations/{org_id}/mpesa/stk-push`) auto-routes to the correct gateway.
- **Subscription Payments (M-Pesa)**: Organizations pay for subscription plans via M-Pesa STK Push.
    - Uses platform-level SunPay API key (configured in Admin Panel > Settings as `subscription_sunpay_api_key`)
    - Flow: Select plan → Enter phone → STK Push → Webhook confirms → Subscription activated
    - Model: `SubscriptionPayment` in master database tracks all payment attempts
    - Routes: `python_backend/routes/subscription_payments.py` (initiate payment, check status, history)
    - Webhook: `/api/webhooks/subscription-payment` processes SunPay callbacks, uses `SUB:{payment_id}` external ref format
    - Frontend: Upgrade page (`client/src/pages/upgrade.tsx`) with multi-gateway payment selector (M-Pesa/Stripe/Paystack), dynamic currency display, and real-time polling
    - Sidebar shows subscription status (trial/active/expired) with link to upgrade page
    - Trial banner has "Upgrade Now" button that navigates to plans page
- **Multi-Gateway Subscription Payments**: Three payment gateways for subscription billing:
    - **M-Pesa (KES)**: STK Push via SunPay, webhook at `/api/webhooks/subscription-payment`
    - **Stripe (USD)**: Checkout Session via Replit connection API, webhook at `/api/webhooks/stripe-subscription`, service: `python_backend/services/stripe_service.py`
    - **Paystack (NGN)**: Transaction initialization, webhook at `/api/webhooks/paystack-subscription`, service: `python_backend/services/paystack_service.py`
    - Multi-currency pricing: Each plan has KES (monthly_price/annual_price), USD (usd_monthly_price/usd_annual_price), NGN (ngn_monthly_price/ngn_annual_price)
    - SubscriptionPayment model tracks gateway, currency, stripe_session_id, paystack_reference
    - Check-payment endpoint polls all 3 gateways as fallback when webhooks don't arrive
    - Admin panel: Paystack API key in Settings, multi-currency fields in Plans management
- **Operations**: SMS notifications with templates, analytics dashboards for performance insights, HR management (staff lock/unlock, performance reviews), audit logs for complete traceability, and configurable organization settings.
- **Automation**: Includes a cron-based script for processing matured fixed deposits with options for regular maturity or auto-rollover.
- **Loan Notifications**: Automated SMS notifications via cron (`python_backend/cron_loan_notifications.py`):
  - **Due Today Reminder**: SMS sent ~1 hour before instalment is due (run with `due_today` mode)
  - **Overdue Notice**: SMS sent after instalment becomes overdue/defaulted (run with `overdue` mode)
  - Duplicate prevention: only one notification per loan per type per day
  - SMS templates auto-seeded during tenant migration

## Business Model

BANKY operates as a hybrid SaaS + Enterprise License product:

### SaaS Model (Small-Medium Saccos)
- **Starter Plan** ($50/mo): Up to 500 members, 3 staff, 1 branch - Core banking features
- **Growth Plan** ($150/mo): Up to 2,000 members, 10 staff, 5 branches - Adds analytics, SMS, float management
- **Professional Plan** ($400/mo): Up to 10,000 members, 50 staff, 20 branches - All features including dividends, fixed deposits, API access
- **Enterprise Plan**: Custom pricing for large Saccos

### Enterprise License (Self-Hosted)
- **Basic Edition** ($10,000): Core banking features
- **Standard Edition** ($20,000): + Analytics, SMS, Float Management
- **Premium Edition** ($35,000): + Fixed Deposits, Dividends, Payroll
- **Enterprise Edition** ($50,000+): All features + custom development

### Feature Flag System
Features are controlled via:
- **SaaS**: Subscription plan in admin panel (stored in master database)
- **Enterprise**: License key + DEPLOYMENT_MODE=enterprise environment variable

### Trial Subscription System
New organizations start with a configurable trial period (default 14 days on starter plan):
- **Trial Banner**: Main app displays warning banner when trial is ending soon (7 days remaining)
- **Automatic Expiration**: Cron job (`python_backend/cron_check_trials.py`) checks and expires trials daily
- **Feature Blocking**: When subscription expires, all features are disabled (returns empty feature list)
- **Admin Controls**: Platform admins can manually change subscription status (trial, active, expired, cancelled)
- **Platform Settings**: Default trial period and plan configurable via admin panel settings

## Admin Panel
A separate admin application for platform management running on port 3001:
- **Location**: `/admin-client/`
- **Access**: Separate login for platform administrators
- **Features**: 
  - Dashboard with platform-wide analytics
  - Organization management (view all tenants, set subscription plans)
  - Subscription plan configuration
  - License key generation and management for enterprise sales

## Mobile App
A Flutter-based mobile application for members located in `/mobile-app/`:
- **Technology**: Flutter 3.x with GetX state management
- **Features (Phase 1)**: Member login, dashboard with balances, transaction history, loan management, profile
- **Features (Phase 2)**: M-Pesa loan repayment, push notifications (Firebase), statement downloads
- **Build Instructions**: See `mobile-app/README.md` for setup and build instructions
- **Note**: Flutter SDK not available in Replit - download the folder and build locally

## External Dependencies
- **Neon**: For PostgreSQL database provisioning and management for each tenant.
- **M-Pesa**: Integrated for loan disbursements and potentially other financial transactions.
- **SMS Gateway**: Used for sending SMS notifications and reminders.
- **Firebase**: For mobile app push notifications (FCM).