# BANKY - Bank & Sacco Management System

## Overview
BANKY is a comprehensive multi-tenant bank and Sacco management system designed with a database-per-tenant SaaS architecture. This ensures complete data isolation, with each organization receiving a dedicated Neon PostgreSQL database. The project aims to provide a robust, scalable, and secure platform for managing banking and Sacco operations, including core financial functionalities, advanced loan management, comprehensive accounting, and administrative tools.

## User Preferences
I want iterative development. Ask before making major changes.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 and TypeScript with Shadcn UI components and Tailwind CSS for a modern, responsive banking theme. It features a blue primary color, Inter font, consistent spacing, and full mobile responsiveness with dark mode support.

### Technical Implementations
- **Frontend**: React 18, TypeScript, TanStack Query, Wouter.
- **Backend**: Python FastAPI with SQLAlchemy ORM.
- **Database**: PostgreSQL. SaaS mode uses Neon for database-per-tenant provisioning. Enterprise mode uses a single database for everything.
- **Authentication**: Supports both master users (stored in master DB) and tenant-isolated staff users (stored in tenant DBs).
- **Performance Optimization**: Includes database connection pooling, a session bundle API endpoint to reduce requests, and React Query caching for permissions and features.
- **Multi-Tenancy**: SaaS mode: each org gets its own isolated Neon PostgreSQL database. Enterprise mode: single database, single org, no Neon required.
- **Core Features**: Member, staff, and branch management; configurable loan products; comprehensive dashboard.
- **Advanced Loan Features**: Loan applications, various disbursement methods, repayment tracking, restructuring, and guarantor system.
- **Financial Management**:
    - **Transaction Handling**: Quick Transactions for basic recording and a dedicated Teller Station for advanced operations with float management and reconciliation.
    - **Fixed Deposits & Dividends**: Modules for managing fixed deposit products, calculating interest, and handling dividend declarations and distributions.
    - **Accounting**: Full double-entry bookkeeping system with Chart of Accounts, journal entries, General Ledger, and automated report generation (Trial Balance, Income Statement, Balance Sheet).
    - **Payroll Integration**: Automatic journal entries for payroll disbursement and statutory deductions.
- **M-Pesa Payment Gateways**: Supports direct Safaricom Daraja API integration and a simplified SunPay managed gateway for STK Push, C2B, B2C, and reversals. Includes M-Pesa loan repayment and disbursement functionalities.
- **Subscription Payments**: Multi-gateway support for subscription billing via M-Pesa (SunPay), Stripe, and Paystack, with USD-only pricing and dynamic currency conversion.
- **M-Pesa Deposits via STK Push**: Secure deposit mechanism requiring dual confirmation (callback or STK Query polling) to prevent fraudulent transactions.
- **Operations**: SMS notifications, analytics dashboards, HR management, audit logs, and configurable organization settings.
- **Automation**: Cron-based scripts for processing matured fixed deposits, auto-deducting loan repayments, and sending automated loan notifications (due and overdue).
- **Business Model**: Hybrid SaaS (Starter, Growth, Professional, Enterprise plans) and Enterprise License (Basic, Standard, Premium, Enterprise editions) with database-driven feature flags.
- **Trial System**: Configurable trial period for new organizations with automatic expiration and feature blocking.
- **Admin Panel**: Separate application for platform management, organization oversight, subscription configuration, and license key generation.
- **Mobile App**: Flutter-based mobile application for members for balances, transaction history, loan management, and profile access.

## External Dependencies
- **Neon**: PostgreSQL database provisioning.
- **M-Pesa**: Payment gateway for transactions and subscriptions.
- **SMS Gateway**: For notifications.
- **Firebase**: For mobile app push notifications.
- **Stripe**: Subscription payment gateway.
- **Paystack**: Subscription payment gateway.
- **exchangerate-api.com**: For currency exchange rates.

## Recent Changes

### 2026-02-19: Enterprise Single-Database Support
- **Change**: Enterprise/CodeCanyon deployments now work with a single PostgreSQL database (no Neon API required).
- **Organization Creation**: When `DEPLOYMENT_MODE=enterprise`, `routes/organization.py` skips Neon API call and sets `org.connection_string = DATABASE_URL`. Tenant tables (57) are created in the same database as master tables (13) — no name collisions.
- **Single-Org Enforcement**: Enterprise mode allows only one organization per deployment. Second org creation returns HTTP 400.
- **Migration Safety**: Master uses `_master_migration_meta`, tenant uses `_migration_meta` — no conflict in shared database.
- **No Other Code Changes**: All routes, login, cron jobs, and frontend hooks work unchanged because they all use `org.connection_string` which is now set to `DATABASE_URL`.
- **Delete Safety**: `delete_organization` already checks `if org.neon_project_id` before calling Neon API, so enterprise orgs skip Neon cleanup automatically.
- **Build Script**: Updated enterprise and CodeCanyon READMEs to clarify single-database architecture.

### 2026-02-18: Loan Term Calculation Fix
- **Change**: `term_months` field now always represents months. The system converts to the correct number of payment instalments based on repayment frequency (weekly=52/12, bi-weekly=26/12, daily=365/12 periods per month).
- **Conversion**: `term_months_to_instalments(term_months, frequency)` and `instalments_to_term_months(instalments, frequency)` utility functions added to `routes/loans.py` and `services/instalment_service.py`.
- **Frontend**: Term always displays as "months" with instalment count shown for non-monthly frequencies (e.g., "1 month (4 weekly instalments)"). Loan form preview now correctly converts rates and computes instalment count.
- **Backend**: `calculate_loan`, `generate_instalment_schedule`, `regenerate_instalments_after_restructure`, restructure endpoints, and repayment allocation all updated to use proper month-to-instalment conversion.
- **Impact**: All new loans will use correct calculations. Existing loan LN0001 was created with old logic (term=4 treated as 4 periods).

### 2026-02-19: Platform Improvements
- **Landing Page Enhancements**: Added Testimonials section (6 reviews with color-coded avatars), How It Works (3-step process with numbered steps), Terms of Service and Privacy Policy pages, Contact page with form, annual/monthly pricing toggle, improved footer with legal links.
- **Auth Security**: Rate limiting on login (10/15min) and register (5/hr) endpoints using in-memory rate limiter (`python_backend/middleware/rate_limit.py`).
- **Welcome Email**: Automated welcome/onboarding email sent via Brevo API on signup (fire-and-forget async via `asyncio.create_task`).
- **Subscription Renewal Reminders**: Cron job (`cron_renewal_reminders.py`) runs every 12 hours to check for trial expiry (3 days), subscription renewal (7 days), and past-due subscriptions.
- **Usage Dashboard**: New "Usage" tab in Settings page showing plan limits vs current usage (members, staff, branches, SMS) with progress bars and upgrade CTA. Backend endpoint: `GET /api/organizations/{org_id}/usage`.
- **In-App Notification Center**: Bell icon in header with notification popover. Model `InAppNotification` in tenant DB. Backend routes in `python_backend/routes/notifications.py`. Migration version bumped to 21.
- **CSV Data Export**: Export endpoints for members, transactions, and loans at `/api/organizations/{org_id}/export/{type}`. Export buttons added to Members and Transactions pages.
- **Landing Page CTAs**: Navbar Sign In/Start Free Trial buttons now properly link to /login and /register.

### 2026-02-19: User Authentication Enhancements
- **Password Reset Flow**: Full forgot-password flow with email-based reset tokens (1hr expiry). Backend endpoints: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/verify-reset-token/{token}`. Frontend pages: `/forgot-password`, `/reset-password`. Rate limited (5/15min). Emails sent via Brevo.
- **Optional Email Verification**: Verification tokens (24hr expiry) sent on registration. Backend endpoints: `POST /api/auth/send-verification-email`, `GET /api/auth/verify-email/{token}`, `POST /api/auth/skip-email-verification`. Frontend page: `/verify-email`. Dismissible amber banner on dashboard. Non-blocking - users can skip.
- **Onboarding Wizard**: 3-step dialog wizard for new org owners (Org Details, Create Branch, Done). Auto-detects new orgs without branches. Fully skippable. Stored dismissal in localStorage.
- **Terms of Service Checkbox**: Required checkbox on registration form with links to Terms of Service and Privacy Policy.
- **New Models**: `PasswordResetToken`, `EmailVerificationToken` in master.py.

### 2026-02-19: Master Database Migration System
- **Migration System**: Added automatic master DB migration system in `python_backend/main.py` (mirrors tenant migration pattern).
- **How it works**: `_MASTER_SCHEMA_VERSION` tracks version. On startup, `run_master_migrations()` checks `_master_migration_meta` table and applies any pending column additions.
- **Adding new columns**: Add column to model in `master.py`, add to `run_master_migrations()` column list, bump `_MASTER_SCHEMA_VERSION`.
- **Current version**: 2 (covers `users.is_email_verified`, `users.approval_pin`, org columns, subscription columns, platform settings columns).
- **CMS Legal Pages**: Terms of Service and Privacy Policy managed via admin Settings > Legal Pages tab. Content served from `GET /api/admin/public/legal/{terms|privacy}`. Frontend falls back to default content if admin hasn't set custom content.

### 2026-02-19: Landing Page CMS Content Management
- **CMS API**: Admin endpoints `GET/PUT /api/admin/landing-content/{section}` for features, testimonials, faq, how_it_works, cta_section. Public endpoint `GET /api/public/landing-content/{section}`.
- **Storage**: JSON content stored in `platform_settings` table with keys like `landing_content_features`, `landing_content_testimonials`, etc.
- **Admin UI**: 9 tabs in Landing Page settings (Hero, Buttons, Stats, URLs, Features, Testimonials, FAQ, How It Works, CTA Section) with full CRUD, reordering, and inline editing.
- **Docs Page**: Single unified self-hosted installation guide. Support email configurable via `landing_docs_support_email` in platform_settings. Public endpoint: `GET /api/public/docs-config`.
- **Landing Page Components**: Features, Testimonials, FAQ, HowItWorks, and CTA components fetch from API with hardcoded defaults as fallback.
- **Validation**: Server-side payload validation ensures correct data shapes per section type.
- **Icon/Color Options**: 24 Lucide icons and 13 color schemes available for features and steps.

### 2026-02-19: Unified License Key System
- **Change**: All self-hosted distributions use license keys.
- **Perpetual keys**: Format `BANKY-{EDITION}-PERP-{UNIQUE}`. Build script auto-generates one for bundled packages and pre-fills in `.env.example`. Validated in `feature_flags.py` to always grant ALL_FEATURES and UNLIMITED_LIMITS regardless of DB state.
- **Non-perpetual keys**: Format `BANKY-{EDITION}-{YEAR}-{UNIQUE}`. Features/limits resolved from DB or edition defaults.
- **Fallback**: No license key = BASELINE_FEATURES only (core banking basics). Warning logged to help diagnose.
- **Admin panel**: License generation supports `perpetual: true` flag. License list shows perpetual status.

### 2026-02-18: Loan Eligibility Rules
- **No Duplicate Product Loans**: `allow_multiple_loans` flag on LoanProduct (default: true). When disabled, a member cannot have two active loans (pending/approved/disbursed/defaulted/restructured) of the same product type.
- **Good Standing Requirement**: `require_good_standing` flag on LoanProduct (default: false). When enabled, blocks loan applications if the member has any overdue instalments on existing loans.
- **Migration**: Version 19 adds both columns to `loan_products` table.
- **Frontend**: Toggle switches added to loan product configuration form.