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
- **Database**: PostgreSQL with Neon for database-per-tenant provisioning.
- **Authentication**: Supports both master users (stored in master DB) and tenant-isolated staff users (stored in tenant DBs).
- **Performance Optimization**: Includes database connection pooling, a session bundle API endpoint to reduce requests, and React Query caching for permissions and features.
- **Multi-Tenancy**: Each organization has its own isolated Neon PostgreSQL database.
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

### 2026-02-18: Loan Term Calculation Fix
- **Change**: `term_months` field now always represents months. The system converts to the correct number of payment instalments based on repayment frequency (weekly=52/12, bi-weekly=26/12, daily=365/12 periods per month).
- **Conversion**: `term_months_to_instalments(term_months, frequency)` and `instalments_to_term_months(instalments, frequency)` utility functions added to `routes/loans.py` and `services/instalment_service.py`.
- **Frontend**: Term always displays as "months" with instalment count shown for non-monthly frequencies (e.g., "1 month (4 weekly instalments)"). Loan form preview now correctly converts rates and computes instalment count.
- **Backend**: `calculate_loan`, `generate_instalment_schedule`, `regenerate_instalments_after_restructure`, restructure endpoints, and repayment allocation all updated to use proper month-to-instalment conversion.
- **Impact**: All new loans will use correct calculations. Existing loan LN0001 was created with old logic (term=4 treated as 4 periods).

### 2026-02-18: Loan Eligibility Rules
- **No Duplicate Product Loans**: `allow_multiple_loans` flag on LoanProduct (default: true). When disabled, a member cannot have two active loans (pending/approved/disbursed/defaulted/restructured) of the same product type.
- **Good Standing Requirement**: `require_good_standing` flag on LoanProduct (default: false). When enabled, blocks loan applications if the member has any overdue instalments on existing loans.
- **Migration**: Version 19 adds both columns to `loan_products` table.
- **Frontend**: Toggle switches added to loan product configuration form.