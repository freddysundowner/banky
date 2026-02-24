# BANKYKIT - Bank & Sacco Management System

## Overview
BANKYKIT is a comprehensive multi-tenant bank and Sacco management system designed with a database-per-tenant SaaS architecture. It provides a robust, scalable, and secure platform for managing banking and Sacco operations, including core financial functionalities, advanced loan management, comprehensive accounting, and administrative tools.

## User Preferences
I want iterative development. Ask before making major changes.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 and TypeScript with Shadcn UI components and Tailwind CSS, featuring a blue primary color, Inter font, consistent spacing, full mobile responsiveness, and dark mode support for a modern banking theme.

### Technical Implementations
- **Frontend**: React 18, TypeScript, TanStack Query, Wouter.
- **Backend**: Python FastAPI with SQLAlchemy ORM.
- **Database**: PostgreSQL. SaaS mode uses Neon for database-per-tenant; Enterprise mode uses a single database.
- **Authentication**: Supports master users (master DB) and tenant-isolated staff users (tenant DBs). Includes full password reset and optional email verification flows.
- **Performance Optimization**: Database connection pooling, session bundle API endpoint, React Query caching.
- **Multi-Tenancy**: SaaS (database-per-tenant) and Enterprise (single database) deployment modes.
- **Core Features**: Member, staff, and branch management; configurable loan products; comprehensive dashboard.
- **Advanced Loan Features**: Applications, disbursements, repayment tracking, restructuring, guarantor system, and eligibility rules (e.g., no duplicate product loans, good standing requirement).
- **Financial Management**:
    - **Transaction Handling**: Quick Transactions and advanced Teller Station with float management.
    - **Fixed Deposits & Dividends**: Management of fixed deposit products, interest calculation, and dividend handling.
    - **Accounting**: Double-entry bookkeeping, Chart of Accounts, journal entries, General Ledger, and automated reports.
    - **Payroll Integration**: Automatic journal entries for payroll and statutory deductions, including automatic loan deductions from payroll.
- **M-Pesa Payment Gateway**: Direct Safaricom Daraja API integration for STK Push, C2B, B2C, reversals, loan repayment, and disbursement. Secure deposit mechanism with dual confirmation. Production-hardened with row-level locking (`SELECT FOR UPDATE`) on all balance-modifying paths to prevent race conditions and double-crediting. Phone number validation (10-15 digit regex) on all STK push endpoints. **Currency-gated**: In production, M-Pesa is only available for orgs using KES and environment must be set to "production"; in demo mode, any currency is allowed so prospects can test all features. `mpesa_enabled` check enforced on all endpoints including mobile (deposit, withdraw, mpesa-pay) and loan disbursement.
- **Subscription Payments**: Multi-gateway support via M-Pesa (Daraja API), Stripe, and Paystack, with USD-only pricing and dynamic currency conversion.
- **Operations**: SMS notifications, analytics dashboards, HR management, audit logs, configurable organization settings (with redesigned UI).
- **Automation**: Cron-based scripts for matured fixed deposits, loan auto-deduction, and automated loan notifications. Subscription renewal reminders.
- **Business Model**: Hybrid SaaS (Starter, Growth, Professional, Enterprise plans) and Enterprise License (Basic, Standard, Premium, Enterprise editions) with database-driven feature flags and a unified license key system. Configurable trial period.
- **Admin Panel**: Separate application for platform management, organization oversight, subscription configuration, and license key generation. Includes CMS for landing page content and legal pages.
- **Mobile App**: Flutter-based mobile application for members.
- **Platform Enhancements**: Rate limiting, welcome emails, usage dashboard, in-app notification center, CSV data export, onboarding wizard.

## External Dependencies
- **Neon**: PostgreSQL database provisioning (for SaaS mode).
- **M-Pesa**: Payment gateway.
- **SMS Gateway**: For notifications.
- **Firebase**: For mobile app push notifications.
- **Stripe**: Subscription payment gateway.
- **Paystack**: Subscription payment gateway.
- **exchangerate-api.com**: For currency exchange rates.
- **Brevo**: For sending emails (e.g., welcome, password reset).