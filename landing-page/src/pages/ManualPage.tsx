import { useState, useRef, useEffect } from 'react';
import {
  BookOpen, Users, Building2, Banknote, CreditCard, FileText, Wallet,
  Receipt, PiggyBank, BarChart3, MessageSquare, Shield, Settings,
  ChevronRight, Search, UserCog, ScrollText, Calendar, AlertTriangle,
  Clock, CheckCircle, HardDrive, Landmark, Layers,
  Bell, LogIn, UserPlus, KeyRound, Mail, Star, Download, Printer,
  HeartHandshake, RefreshCw, DollarSign, ClipboardList, MonitorSmartphone,
  Trash2, Package, PhoneCall
} from 'lucide-react';

type SectionId =
  | 'getting-started'
  | 'registration'
  | 'login'
  | 'password-reset'
  | 'email-verification'
  | 'org-creation'
  | 'onboarding-wizard'
  | 'dashboard'
  | 'branches'
  | 'staff'
  | 'roles'
  | 'members'
  | 'member-statements'
  | 'loan-products'
  | 'loan-applications'
  | 'guarantors'
  | 'loan-restructuring'
  | 'repayments'
  | 'defaults-collections'
  | 'transactions'
  | 'teller-station'
  | 'teller-services'
  | 'float-management'
  | 'queue-kiosk'
  | 'queue-display'
  | 'fixed-deposits'
  | 'dividends'
  | 'chart-of-accounts'
  | 'journal-entries'
  | 'opening-balances'
  | 'reports'
  | 'analytics'
  | 'csv-export'
  | 'sms'
  | 'notifications'
  | 'hr'
  | 'attendance'
  | 'payroll'
  | 'leave'
  | 'expenses'
  | 'audit-logs'
  | 'mpesa'
  | 'settings-general'
  | 'settings-loans'
  | 'settings-sms'
  | 'settings-email'
  | 'settings-mpesa'
  | 'settings-hours'
  | 'settings-roles'
  | 'settings-usage'
  | 'settings-danger'
  | 'my-account'
  | 'subscriptions'
  | 'trial-system'
  | 'collateral'
  | 'loan-eligibility'
  | 'crm';

interface NavGroup {
  label: string;
  items: { id: SectionId; label: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Account & Setup',
    items: [
      { id: 'getting-started', label: 'Quick Start Guide', icon: BookOpen },
      { id: 'registration', label: 'Registration', icon: UserPlus },
      { id: 'login', label: 'Logging In', icon: LogIn },
      { id: 'password-reset', label: 'Password Reset', icon: KeyRound },
      { id: 'email-verification', label: 'Email Verification', icon: Mail },
      { id: 'org-creation', label: 'Organization Setup', icon: Building2 },
      { id: 'onboarding-wizard', label: 'Onboarding Wizard', icon: Star },
    ],
  },
  {
    label: 'Dashboard & Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { id: 'notifications', label: 'Notification Center', icon: Bell },
    ],
  },
  {
    label: 'Organization',
    items: [
      { id: 'branches', label: 'Branches', icon: Building2 },
      { id: 'staff', label: 'Staff Management', icon: UserCog },
      { id: 'roles', label: 'Roles & Permissions', icon: Shield },
    ],
  },
  {
    label: 'Members',
    items: [
      { id: 'members', label: 'Member Management', icon: Users },
      { id: 'member-statements', label: 'Member Statements', icon: FileText },
    ],
  },
  {
    label: 'Loans',
    items: [
      { id: 'loan-products', label: 'Loan Products', icon: CreditCard },
      { id: 'loan-applications', label: 'Loan Applications', icon: FileText },
      { id: 'loan-eligibility', label: 'Loan Eligibility Checker', icon: ClipboardList },
      { id: 'guarantors', label: 'Guarantor System', icon: HeartHandshake },
      { id: 'loan-restructuring', label: 'Loan Restructuring', icon: RefreshCw },
      { id: 'repayments', label: 'Repayments', icon: Receipt },
      { id: 'defaults-collections', label: 'Defaults & Collections', icon: AlertTriangle },
      { id: 'collateral', label: 'Collateral Management', icon: Package },
    ],
  },
  {
    label: 'Transactions & Teller',
    items: [
      { id: 'transactions', label: 'Quick Transactions', icon: Wallet },
      { id: 'teller-station', label: 'Teller Station', icon: Banknote },
      { id: 'teller-services', label: 'Teller Services', icon: ClipboardList },
      { id: 'float-management', label: 'Float Management', icon: HardDrive },
      { id: 'queue-kiosk', label: 'Ticketing Kiosk', icon: Printer },
      { id: 'queue-display', label: 'Queue Display Board', icon: MonitorSmartphone },
    ],
  },
  {
    label: 'Savings & Investments',
    items: [
      { id: 'fixed-deposits', label: 'Fixed Deposits', icon: PiggyBank },
      { id: 'dividends', label: 'Dividends', icon: DollarSign },
    ],
  },
  {
    label: 'Accounting',
    items: [
      { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: Layers },
      { id: 'journal-entries', label: 'Journal Entries', icon: ScrollText },
      { id: 'opening-balances', label: 'Opening Balances', icon: Landmark },
    ],
  },
  {
    label: 'Reports & Data',
    items: [
      { id: 'reports', label: 'Financial Reports', icon: FileText },
      { id: 'analytics', label: 'Analytics Dashboard', icon: BarChart3 },
      { id: 'csv-export', label: 'CSV & Data Export', icon: Download },
    ],
  },
  {
    label: 'Communication',
    items: [
      { id: 'sms', label: 'SMS Notifications', icon: MessageSquare },
    ],
  },
  {
    label: 'CRM & Leads',
    items: [
      { id: 'crm', label: 'CRM & Contact Management', icon: PhoneCall },
    ],
  },
  {
    label: 'HR & Operations',
    items: [
      { id: 'hr', label: 'HR Management', icon: Users },
      { id: 'attendance', label: 'Attendance Tracking', icon: Clock },
      { id: 'payroll', label: 'Payroll Processing', icon: DollarSign },
      { id: 'leave', label: 'Leave Management', icon: Calendar },
      { id: 'expenses', label: 'Expenses', icon: Receipt },
      { id: 'audit-logs', label: 'Audit Logs', icon: ScrollText },
    ],
  },
  {
    label: 'Payments & M-Pesa',
    items: [
      { id: 'mpesa', label: 'M-Pesa Integration', icon: Banknote },
    ],
  },
  {
    label: 'Settings',
    items: [
      { id: 'settings-general', label: 'General Settings', icon: Settings },
      { id: 'settings-loans', label: 'Loan Settings', icon: CreditCard },
      { id: 'settings-sms', label: 'SMS Settings', icon: MessageSquare },
      { id: 'settings-email', label: 'Email Settings', icon: Mail },
      { id: 'settings-mpesa', label: 'M-Pesa Settings', icon: Banknote },
      { id: 'settings-hours', label: 'Business Hours', icon: Clock },
      { id: 'settings-roles', label: 'Role Management', icon: Shield },
      { id: 'settings-usage', label: 'Usage & Limits', icon: BarChart3 },
      { id: 'settings-danger', label: 'Danger Zone', icon: Trash2 },
    ],
  },
  {
    label: 'Account & Billing',
    items: [
      { id: 'my-account', label: 'My Account', icon: UserCog },
      { id: 'subscriptions', label: 'Subscriptions & Upgrade', icon: Star },
      { id: 'trial-system', label: 'Trial Period', icon: Clock },
    ],
  },
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">{n}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
        <div className="text-gray-600 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm leading-relaxed">{children}</div>;
}

function Warning({ children }: { children: React.ReactNode }) {
  return <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm leading-relaxed">{children}</div>;
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-2">{title}</h4>
      <div className="text-sm text-gray-600">{children}</div>
    </div>
  );
}

function SectionWrapper({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3" data-testid={`text-section-title-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          <Icon className="w-7 h-7 text-blue-600" />
          {title}
        </h2>
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}

function GettingStartedSection() {
  return (
    <SectionWrapper title="Quick Start Guide" icon={BookOpen}>
      <p className="text-gray-600">Welcome to the system! This guide walks you through every step from creating your account to processing your first transaction. Follow these steps in order for the smoothest setup.</p>
      <div className="space-y-6">
        <Step n={1} title="Create Your Account">
          <p>Visit the registration page. Enter your first name, last name, email, phone number (optional), and password. You must accept the Terms of Service and Privacy Policy to proceed. After registering, you will receive a welcome email.</p>
        </Step>
        <Step n={2} title="Verify Your Email (Optional)">
          <p>A verification email is sent automatically. Click the link to verify. This step is optional -- you can skip it and verify later from the dashboard banner.</p>
        </Step>
        <Step n={3} title="Create Your Organization">
          <p>After your first login, the onboarding wizard appears. Enter your organization name, select your currency (KES, USD, UGX, TZS, NGN, GHS, ZAR, GBP, EUR), and provide your organization email and phone.</p>
        </Step>
        <Step n={4} title="Set Up Your First Branch">
          <p>The wizard walks you through creating your first branch. Enter the branch name (e.g., "Head Office") -- the branch code is generated automatically. Add the location and contact details.</p>
        </Step>
        <Step n={5} title="Add Staff Members">
          <p>Go to <strong>Staff</strong> in the sidebar. Add your team members with their name, email, phone, branch, and role. Each staff member gets their own login credentials.</p>
        </Step>
        <Step n={6} title="Create Loan Products">
          <p>Go to <strong>Loan Products</strong> and define the loan types you offer. Set interest rates, fees, terms, and eligibility rules. These are templates used when members apply for loans.</p>
        </Step>
        <Step n={7} title="Register Members">
          <p>Go to <strong>Members</strong> and start adding your members with their personal details, ID numbers, and contact information.</p>
        </Step>
        <Step n={8} title="Configure Integrations">
          <p>Go to <strong>Settings</strong> to configure M-Pesa payments, SMS notifications, email settings, and business hours.</p>
        </Step>
      </div>
      <Tip>
        <strong>Minimum to start:</strong> You need at least one branch, one staff member (yourself as owner), and one member to begin processing transactions and loans.
      </Tip>
    </SectionWrapper>
  );
}

function RegistrationSection() {
  return (
    <SectionWrapper title="Registration" icon={UserPlus}>
      <p className="text-gray-600">Create a new account to get started with the platform.</p>
      <h3 className="font-semibold text-gray-900">Registration Form Fields</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { field: 'First Name', req: 'Required' },
          { field: 'Last Name', req: 'Required' },
          { field: 'Email Address', req: 'Required -- used for login' },
          { field: 'Phone Number', req: 'Optional' },
          { field: 'Password', req: 'Required -- minimum 8 characters' },
          { field: 'Confirm Password', req: 'Required -- must match password' },
        ].map(f => (
          <div key={f.field} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{f.field}</span>
            <p className="text-xs text-gray-500 mt-0.5">{f.req}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Required Agreements</h3>
      <p className="text-gray-600 text-sm">You must check the box agreeing to the Terms of Service and Privacy Policy before you can register. These documents are accessible via links on the registration form.</p>
      <h3 className="font-semibold text-gray-900 mt-4">After Registration</h3>
      <FeatureList items={[
        'A welcome email is sent to your address automatically',
        'A verification email is sent with a link valid for 24 hours',
        'You are logged in and redirected to the onboarding wizard',
        'If you already have an account, click "Sign in" at the bottom of the form',
      ]} />
    </SectionWrapper>
  );
}

function LoginSection() {
  return (
    <SectionWrapper title="Logging In" icon={LogIn}>
      <p className="text-gray-600">Access your account by entering your email and password.</p>
      <h3 className="font-semibold text-gray-900">Login Process</h3>
      <div className="space-y-4">
        <Step n={1} title="Enter Credentials">
          <p>Enter your email address and password. Use the eye icon to toggle password visibility.</p>
        </Step>
        <Step n={2} title="Loading Sequence">
          <p>After clicking Sign In, you'll see a progress indicator as the system loads your organization data, permissions, and preferences. This takes just a few seconds.</p>
        </Step>
        <Step n={3} title="Dashboard">
          <p>Once loaded, you land on the Dashboard showing your organization overview.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Troubleshooting</h3>
      <FeatureList items={[
        'Forgot your password? Click "Forgot your password?" below the login form',
        'Don\'t have an account? Click "Create one" to register',
        'Login is rate-limited to 10 attempts per 15 minutes for security',
      ]} />
    </SectionWrapper>
  );
}

function PasswordResetSection() {
  return (
    <SectionWrapper title="Password Reset" icon={KeyRound}>
      <p className="text-gray-600">Reset your password if you've forgotten it or need to change it for security reasons.</p>
      <div className="space-y-4">
        <Step n={1} title="Request Reset Link">
          <p>On the login page, click <strong>"Forgot your password?"</strong>. Enter your email address and click Send Reset Link. If an account exists with that email, a reset link is sent.</p>
        </Step>
        <Step n={2} title="Check Your Email">
          <p>Open the email and click the reset link. The link is valid for <strong>1 hour</strong>. If expired, request a new one.</p>
        </Step>
        <Step n={3} title="Set New Password">
          <p>Enter your new password (minimum 8 characters) and confirm it. Click Reset Password to save.</p>
        </Step>
        <Step n={4} title="Log In">
          <p>After resetting, you're redirected to the login page. Sign in with your new password.</p>
        </Step>
      </div>
    </SectionWrapper>
  );
}

function EmailVerificationSection() {
  return (
    <SectionWrapper title="Email Verification" icon={Mail}>
      <p className="text-gray-600">Verify your email address to confirm your identity. This step is optional but recommended.</p>
      <h3 className="font-semibold text-gray-900">How Verification Works</h3>
      <div className="space-y-4">
        <Step n={1} title="Automatic Email">
          <p>After registration, a verification email is sent automatically. The link inside is valid for <strong>24 hours</strong>.</p>
        </Step>
        <Step n={2} title="Click the Link">
          <p>Open the email and click the verification link. You'll see a success message confirming your email is verified.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Dashboard Banner</h3>
      <p className="text-gray-600 text-sm">If you haven't verified your email, an amber banner appears on your dashboard with two options:</p>
      <FeatureList items={[
        '"Verify Now" -- resends the verification email',
        '"Set up later" -- dismisses the banner and skips verification',
      ]} />
      <Tip><strong>Non-blocking:</strong> Email verification does not prevent you from using any features. You can use the full system without verifying.</Tip>
    </SectionWrapper>
  );
}

function OrgCreationSection() {
  return (
    <SectionWrapper title="Organization Setup" icon={Building2}>
      <p className="text-gray-600">Your organization is your isolated workspace. All members, staff, transactions, loans, and settings live within your organization.</p>
      <h3 className="font-semibold text-gray-900">Creating an Organization</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { field: 'Organization Name', desc: 'The name of your bank, Sacco, chama, or MFI' },
          { field: 'Staff Email Domain', desc: 'Domain for staff emails (e.g., mysacco.co.ke)' },
          { field: 'Currency', desc: 'KES, USD, UGX, TZS, NGN, GHS, ZAR, GBP, EUR' },
          { field: 'Email', desc: 'Organization contact email' },
          { field: 'Phone', desc: 'Organization contact phone' },
          { field: 'Address', desc: 'Physical address (optional)' },
        ].map(f => (
          <div key={f.field} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{f.field}</span>
            <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Database Provisioning</h3>
      <p className="text-gray-600 text-sm">When you create your organization, the system provisions a dedicated database and configures security. You'll see a progress indicator showing: "Provisioning database...", "Setting up security...", and "Configuring your environment..." This takes about 10-30 seconds.</p>
      <Tip><strong>Data isolation:</strong> Each organization has its own completely separate database. No data is shared between organizations.</Tip>
    </SectionWrapper>
  );
}

function OnboardingWizardSection() {
  return (
    <SectionWrapper title="Onboarding Wizard" icon={Star}>
      <p className="text-gray-600">The onboarding wizard appears automatically for new organizations that don't have any branches yet. It walks you through the essential first-time setup in three steps.</p>
      <div className="space-y-4">
        <Step n={1} title="Organization Details">
          <p>Confirm your organization name, select your currency from the dropdown, and enter your contact email and phone number.</p>
        </Step>
        <Step n={2} title="Create Your First Branch">
          <p>Enter the branch name (defaults to "Head Office"). The branch code is auto-generated from the name (uppercase letters and numbers, max 10 characters). Add the branch location and phone number.</p>
        </Step>
        <Step n={3} title="You're All Set!">
          <p>The wizard shows a checklist of what was completed and provides quick-start links to:</p>
          <FeatureList items={[
            'Add Staff Members',
            'Create Loan Products',
            'Register Members',
          ]} />
        </Step>
      </div>
      <Tip><strong>Skippable:</strong> You can skip the wizard at any time and set things up later. The wizard won't appear again once you have at least one branch.</Tip>
    </SectionWrapper>
  );
}

function DashboardSection() {
  return (
    <SectionWrapper title="Dashboard" icon={BarChart3}>
      <p className="text-gray-600">The dashboard is your operational overview. It loads automatically when you log in and shows key metrics at a glance.</p>
      <h3 className="font-semibold text-gray-900">Stats Cards</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard title="Membership">
          <FeatureList items={['Total members', 'Total staff', 'Number of branches']} />
        </InfoCard>
        <InfoCard title="Loans Overview">
          <FeatureList items={['Total loans by status (pending, approved, disbursed)', 'Total amount disbursed', 'Outstanding balance', 'Default count']} />
        </InfoCard>
        <InfoCard title="Savings & Shares">
          <FeatureList items={['Total savings balance across all members', 'Total shares value', 'Savings-to-loans ratio']} />
        </InfoCard>
        <InfoCard title="Collection Performance">
          <FeatureList items={['Collection rate percentage', 'Total repaid amount', 'Due vs overdue comparison']} />
        </InfoCard>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Dashboard Features</h3>
      <FeatureList items={[
        'Refresh button to reload latest figures',
        'Email verification banner (if unverified) with verify/dismiss options',
        'Trial expiration banner with days remaining',
        'Setup progress indicator for new organizations',
      ]} />
    </SectionWrapper>
  );
}

function NotificationsSection() {
  return (
    <SectionWrapper title="Notification Center" icon={Bell}>
      <p className="text-gray-600">The notification center keeps you informed of important events across the system, all accessible from the bell icon in the top navigation bar.</p>
      <h3 className="font-semibold text-gray-900">How It Works</h3>
      <FeatureList items={[
        'Bell icon in the header shows a red badge with unread count',
        'Click the bell to open the notification popover',
        'Each notification shows a title, description, and timestamp',
        'Click any notification to view details or navigate to the related item',
        'Mark individual notifications as read or "Mark all as read"',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Notification Types</h3>
      <FeatureList items={[
        'New loan applications requiring approval',
        'Loan disbursement confirmations',
        'Member registration alerts',
        'System alerts and announcements',
        'Overdue loan reminders',
        'Subscription and trial expiry warnings',
      ]} />
    </SectionWrapper>
  );
}

function BranchesSection() {
  return (
    <SectionWrapper title="Branch Management" icon={Building2}>
      <p className="text-gray-600">Branches represent physical locations or operational units. Every member, staff member, and transaction is linked to a branch.</p>
      <h3 className="font-semibold text-gray-900">Creating a Branch</h3>
      <div className="space-y-4">
        <Step n={1} title="Click Add Branch">
          <p>From the Branches page in the sidebar, click the <strong>Add Branch</strong> button.</p>
        </Step>
        <Step n={2} title="Fill in Details">
          <p>Enter the branch name, location/address, phone number, and email. The branch code is generated automatically from the name.</p>
        </Step>
        <Step n={3} title="Save">
          <p>The branch appears in the list immediately and can be assigned to staff and members.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Managing Branches</h3>
      <FeatureList items={[
        'Edit branch details at any time',
        'View which staff and members are assigned to each branch',
        'Delete a branch only if no members or staff are assigned to it',
        'Filter other pages (members, transactions, reports) by branch',
      ]} />
      <Warning><strong>Plan limits:</strong> The number of branches you can create depends on your subscription plan. Check Settings &gt; Usage to see your limit.</Warning>
    </SectionWrapper>
  );
}

function StaffSection() {
  return (
    <SectionWrapper title="Staff Management" icon={UserCog}>
      <p className="text-gray-600">Staff are the people who use the system -- administrators, managers, tellers, and loan officers. Each staff member has their own login credentials and role-based access.</p>
      <h3 className="font-semibold text-gray-900">Adding a Staff Member</h3>
      <div className="space-y-4">
        <Step n={1} title="Click Add Staff">
          <p>Navigate to <strong>Staff</strong> in the sidebar and click <strong>Add Staff</strong>.</p>
        </Step>
        <Step n={2} title="Personal Information">
          <p>Enter: Full name, email address (used for login), phone number, National ID (optional), and staff number (auto-generated or custom).</p>
        </Step>
        <Step n={3} title="Assignment">
          <p>Select the branch they work at and assign a role (Owner, Admin, Manager, Teller, Loan Officer, Viewer, or a custom role).</p>
        </Step>
        <Step n={4} title="Set Credentials">
          <p>Set a temporary password. The staff member should change this after their first login via My Account.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Built-in Roles</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { role: 'Owner', desc: 'Full system access. Manages billing, subscriptions, and can delete the organization.' },
          { role: 'Admin', desc: 'Full access to all features except billing and organization deletion.' },
          { role: 'Manager', desc: 'Manages members, staff, loans, and transactions within their branch. Can approve loans and float variances.' },
          { role: 'Teller', desc: 'Processes deposits, withdrawals, and serves queue tickets at the counter.' },
          { role: 'Loan Officer', desc: 'Manages loan applications, approvals, disbursements, and repayments.' },
          { role: 'Viewer', desc: 'Read-only access to dashboards and reports. Cannot create or modify anything.' },
        ].map(r => (
          <div key={r.role} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{r.role}</span>
            <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Staff-Member Linking</h3>
      <p className="text-gray-600 text-sm">Staff members can be linked to a member account, allowing them to access financial services like loans, savings, and shares just like any other member.</p>
      <FeatureList items={[
        'Link a staff member to an existing member account or create a new one during staff setup',
        'Linked staff appear as "Staff" membership type in the member register',
        'Staff with linked accounts can apply for and receive loans through the lending module',
        'Active loans are automatically deducted from payroll during disbursement (see Payroll Processing)',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Staff Actions</h3>
      <FeatureList items={[
        'Edit personal details, role, or branch assignment',
        'Suspend a staff account (prevents login while preserving data)',
        'Reactivate a suspended staff account',
        'Delete a staff account permanently',
      ]} />
    </SectionWrapper>
  );
}

function RolesSection() {
  return (
    <SectionWrapper title="Roles & Permissions" icon={Shield}>
      <p className="text-gray-600">Roles control exactly what each staff member can see and do. Beyond the 6 built-in roles, you can create custom roles with granular permissions.</p>
      <h3 className="font-semibold text-gray-900">Permission Levels</h3>
      <div className="grid sm:grid-cols-3 gap-3">
        <InfoCard title="Read">
          <p>View data (e.g., see member list, view loan details). No ability to change anything.</p>
        </InfoCard>
        <InfoCard title="Write">
          <p>Create and edit data (e.g., register members, create loans, process transactions).</p>
        </InfoCard>
        <InfoCard title="Approve">
          <p>Authorize sensitive actions (e.g., approve loan applications, approve float shortages).</p>
        </InfoCard>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Creating a Custom Role</h3>
      <div className="space-y-4">
        <Step n={1} title="Go to Settings > Roles Tab">
          <p>Open Settings from the sidebar and click the Roles tab.</p>
        </Step>
        <Step n={2} title="Click Add Role">
          <p>Enter a role name (e.g., "Senior Teller", "Branch Accountant").</p>
        </Step>
        <Step n={3} title="Configure Permissions">
          <p>Toggle on/off Read, Write, and Approve for each module.</p>
        </Step>
        <Step n={4} title="Assign to Staff">
          <p>When creating or editing a staff member, your custom role appears in the role dropdown.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Permission Categories</h3>
      <div className="grid sm:grid-cols-2 gap-2">
        {[
          'Dashboard', 'Members', 'Branches', 'Staff',
          'Loan Products', 'Loans', 'Repayments', 'Defaults & Collections',
          'Transactions', 'Teller Station', 'Float Management', 'Ticketing & Queue',
          'Fixed Deposits', 'Dividends', 'Expenses',
          'Chart of Accounts', 'Journal Entries',
          'Reports', 'Analytics', 'SMS Notifications', 'Audit Logs',
          'HR Management', 'Leave Management', 'Settings',
        ].map(cat => (
          <div key={cat} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            {cat}
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}

function MembersSection() {
  return (
    <SectionWrapper title="Member Management" icon={Users}>
      <p className="text-gray-600">Members are the customers of your organization -- the people who save, borrow, and transact through your institution.</p>
      <h3 className="font-semibold text-gray-900">Registering a New Member</h3>
      <div className="space-y-4">
        <Step n={1} title="Click Add Member">
          <p>From the Members page, click <strong>Add Member</strong>.</p>
        </Step>
        <Step n={2} title="Personal Details">
          <p>Enter: Full name, National ID number, phone number, email (optional), date of birth, gender, marital status, occupation, and employer.</p>
        </Step>
        <Step n={3} title="Branch Assignment">
          <p>Select which branch this member belongs to from the dropdown.</p>
        </Step>
        <Step n={4} title="Next of Kin">
          <p>Enter the name, phone number, and relationship of their emergency contact / next of kin.</p>
        </Step>
        <Step n={5} title="Save">
          <p>A unique member number is generated automatically (e.g., M0001). The member is now active and ready to transact.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Member Actions</h3>
      <FeatureList items={[
        'Edit profile -- update any personal or contact information',
        'View full statement -- see complete transaction and loan history',
        'Activate / Suspend -- control whether a member can transact',
        'Upload documents -- attach ID copies, photos, or other files',
        'Export full member list as CSV',
        'Delete a member (only if no active loans or balances)',
        'Search by name, member number, phone, or National ID',
        'Filter members by branch or status (active/suspended)',
      ]} />
    </SectionWrapper>
  );
}

function MemberStatementsSection() {
  return (
    <SectionWrapper title="Member Statements" icon={FileText}>
      <p className="text-gray-600">A member statement is a comprehensive view of all financial activity for a single member. Access it by clicking any member's name in the Members list.</p>
      <h3 className="font-semibold text-gray-900">What the Statement Shows</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard title="Account Balances">
          <FeatureList items={['Current savings balance', 'Current shares balance', 'Total deposits balance', 'Total loan outstanding']} />
        </InfoCard>
        <InfoCard title="Transaction History">
          <FeatureList items={['All deposits with dates and amounts', 'All withdrawals', 'Transfer records', 'Fee charges', 'Running balance after each transaction']} />
        </InfoCard>
        <InfoCard title="Loan Summary">
          <FeatureList items={['Active loans with status and balance', 'Repayment history', 'Instalment schedule', 'Overdue amounts highlighted']} />
        </InfoCard>
        <InfoCard title="Actions">
          <FeatureList items={['Print statement', 'Download as PDF', 'Filter by date range', 'Quick deposit/withdrawal buttons']} />
        </InfoCard>
      </div>
    </SectionWrapper>
  );
}

function LoanProductsSection() {
  return (
    <SectionWrapper title="Loan Products" icon={CreditCard}>
      <p className="text-gray-600">Loan products are templates that define the rules for each type of loan. You must create at least one product before processing any loan applications.</p>
      <h3 className="font-semibold text-gray-900">Creating a Loan Product</h3>
      <div className="space-y-4">
        <Step n={1} title="Basic Information">
          <p>Enter product name (e.g., "Emergency Loan", "Development Loan"), and a description.</p>
        </Step>
        <Step n={2} title="Interest Configuration">
          <p>Choose the interest method: <strong>Flat Rate</strong> (interest calculated on the original principal) or <strong>Reducing Balance</strong> (interest calculated on remaining principal -- lower total cost for the borrower). Set the annual interest rate.</p>
        </Step>
        <Step n={3} title="Term & Frequency">
          <p>Set the repayment frequency: <strong>Daily</strong>, <strong>Weekly</strong>, <strong>Bi-weekly</strong>, or <strong>Monthly</strong>. Set minimum and maximum loan term in months, and minimum and maximum loan amount.</p>
        </Step>
        <Step n={4} title="Fees & Insurance">
          <p><strong>Processing fee:</strong> A percentage of the loan amount charged upfront. <strong>Insurance rate:</strong> Can be charged upfront or spread across instalments.</p>
        </Step>
        <Step n={5} title="Eligibility Rules">
          <p><strong>Shares multiplier:</strong> How many times their shares balance a member can borrow (e.g., 3x means a member with KES 10,000 in shares can borrow up to KES 30,000).</p>
          <p className="mt-1"><strong>Allow multiple loans:</strong> Toggle whether members can have multiple active loans of this same product type simultaneously.</p>
          <p className="mt-1"><strong>Require good standing:</strong> When enabled, members with overdue payments on any existing loan cannot apply for this product.</p>
        </Step>
        <Step n={6} title="Guarantor Requirements">
          <p>Set the minimum number of guarantors required and the maximum amount each guarantor can cover.</p>
        </Step>
      </div>
      <Tip><strong>Live preview:</strong> As you configure the product, a real-time preview shows what a sample loan would look like -- monthly instalment amount, total repayment, and total interest cost.</Tip>
    </SectionWrapper>
  );
}

function LoanApplicationsSection() {
  return (
    <SectionWrapper title="Loan Applications" icon={FileText}>
      <p className="text-gray-600">Process loan requests from application through approval to disbursement.</p>
      <h3 className="font-semibold text-gray-900">Loan Status Lifecycle</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { status: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
          { status: 'Approved', color: 'bg-blue-100 text-blue-700' },
          { status: 'Disbursed', color: 'bg-green-100 text-green-700' },
          { status: 'Fully Repaid', color: 'bg-emerald-100 text-emerald-700' },
          { status: 'Defaulted', color: 'bg-red-100 text-red-700' },
          { status: 'Rejected', color: 'bg-gray-100 text-gray-700' },
          { status: 'Restructured', color: 'bg-purple-100 text-purple-700' },
        ].map(s => (
          <span key={s.status} className={`px-3 py-1 ${s.color} rounded-full text-xs font-medium`}>{s.status}</span>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900">Creating a Loan Application</h3>
      <div className="space-y-4">
        <Step n={1} title="Click New Loan">
          <p>From the Loan Applications page, click <strong>New Loan</strong>.</p>
        </Step>
        <Step n={2} title="Select Member & Product">
          <p>Search and select the member. Choose the loan product. The system checks eligibility automatically (shares balance, existing loans, good standing).</p>
        </Step>
        <Step n={3} title="Enter Loan Details">
          <p>Enter the loan amount (must be within product min/max), term in months, purpose, and repayment start date. The system calculates instalments and total repayment automatically.</p>
        </Step>
        <Step n={4} title="Add Guarantors (if required)">
          <p>If the product requires guarantors, search for other members and add them. Each guarantor must have sufficient shares to cover their guaranteed amount. See the <strong>Guarantor System</strong> section for details.</p>
        </Step>
        <Step n={5} title="Submit Application">
          <p>The loan is saved with <strong>Pending</strong> status and waits for approval.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Approving & Disbursing</h3>
      <div className="space-y-4">
        <Step n={1} title="Review">
          <p>Open the pending application. Review the member's profile, loan details, instalment schedule, and guarantor list.</p>
        </Step>
        <Step n={2} title="Approve or Reject">
          <p>Click <strong>Approve</strong> to advance the loan, or <strong>Reject</strong> with a written reason.</p>
        </Step>
        <Step n={3} title="Disburse">
          <p>After approval, click <strong>Disburse</strong>. Choose the disbursement method:</p>
          <FeatureList items={['Cash -- direct cash payout at the counter', 'M-Pesa -- sent to the member\'s phone', 'Credit to Savings -- deposited into the member\'s savings account']} />
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Instalment Schedule</h3>
      <p className="text-gray-600 text-sm">After disbursement, a detailed schedule is generated showing each instalment: number, due date, principal portion, interest portion, total amount, amount paid, remaining balance, and status (paid / overdue / upcoming).</p>
    </SectionWrapper>
  );
}

function GuarantorsSection() {
  return (
    <SectionWrapper title="Guarantor System" icon={HeartHandshake}>
      <p className="text-gray-600">Guarantors are members who vouch for a borrower's loan. If the borrower defaults, guarantors share responsibility for repayment.</p>
      <h3 className="font-semibold text-gray-900">How Guarantors Work</h3>
      <div className="space-y-4">
        <Step n={1} title="Eligibility Check">
          <p>When adding a guarantor, the system automatically checks:</p>
          <FeatureList items={[
            'Sufficient shares balance to cover the guaranteed amount',
            'No existing defaults on their own loans',
            'Total exposure (how much they are already guaranteeing for other loans)',
          ]} />
        </Step>
        <Step n={2} title="Add Guarantor to Loan">
          <p>Search for the guarantor by name or member number. Select their relationship to the borrower (Spouse, Family, Colleague, Friend, etc.) and enter the guaranteed amount.</p>
        </Step>
        <Step n={3} title="Consent Process">
          <p>Each guarantor has a consent status:</p>
          <FeatureList items={[
            'Pending -- awaiting the guarantor\'s consent',
            'Accepted -- guarantor has agreed to guarantee the loan',
            'Rejected -- guarantor has declined',
          ]} />
          <p className="mt-1">The system tracks the consent date for audit purposes.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Guarantor Details</h3>
      <FeatureList items={[
        'Relationship type (Spouse, Family, Colleague, Friend, Other)',
        'Guaranteed amount for this specific loan',
        'Consent status and date',
        'Total exposure across all guaranteed loans',
        'Guarantor capacity (shares balance minus existing guarantees)',
      ]} />
    </SectionWrapper>
  );
}

function LoanRestructuringSection() {
  return (
    <SectionWrapper title="Loan Restructuring" icon={RefreshCw}>
      <p className="text-gray-600">When a borrower is struggling to repay, you can modify the loan terms instead of marking it as defaulted. This preserves the original loan history while creating manageable new terms.</p>
      <h3 className="font-semibold text-gray-900">Restructuring Types</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { type: 'Extend Term', desc: 'Add more months to the repayment period, lowering each instalment amount' },
          { type: 'Reduce Instalment', desc: 'Lower the monthly payment amount and adjust the term accordingly' },
          { type: 'Adjust Interest Rate', desc: 'Change the interest rate on the remaining balance' },
          { type: 'Waive Penalty', desc: 'Remove accumulated late payment penalties' },
          { type: 'Grant Grace Period', desc: 'Pause repayment for a specified number of months' },
        ].map(t => (
          <div key={t.type} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{t.type}</span>
            <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Restructuring Process</h3>
      <div className="space-y-4">
        <Step n={1} title="Select the Loan">
          <p>Open the disbursed loan that needs restructuring.</p>
        </Step>
        <Step n={2} title="Choose Restructuring Type">
          <p>Select the type of modification and enter the new terms.</p>
        </Step>
        <Step n={3} title="Preview Comparison">
          <p>The system shows a side-by-side comparison of <strong>Current vs. Proposed</strong> terms, including the monthly savings for the borrower.</p>
        </Step>
        <Step n={4} title="Apply">
          <p>Confirm the restructuring. A new repayment schedule is generated. The loan status changes to <strong>Restructured</strong> and the original schedule is preserved for audit.</p>
        </Step>
      </div>
    </SectionWrapper>
  );
}

function RepaymentsSection() {
  return (
    <SectionWrapper title="Repayments" icon={Receipt}>
      <p className="text-gray-600">Record loan repayments from members. Payments are automatically allocated to the oldest overdue instalments first (principal, then interest, then penalties).</p>
      <h3 className="font-semibold text-gray-900">Recording a Repayment</h3>
      <div className="space-y-4">
        <Step n={1} title="Find the Loan">
          <p>Search by member name, member number, or loan number.</p>
        </Step>
        <Step n={2} title="Enter Payment">
          <p>Enter the amount received, select the payment method (Cash, M-Pesa, Bank Transfer, Cheque), and enter a reference number if applicable.</p>
        </Step>
        <Step n={3} title="Review Allocation">
          <p>The system shows how the payment will be applied across instalments before you submit.</p>
        </Step>
        <Step n={4} title="Submit">
          <p>The repayment is recorded, balances updated, and if the full loan is paid off, the status changes to <strong>Fully Repaid</strong>.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Auto-Deduction</h3>
      <p className="text-gray-600 text-sm">When enabled in Settings &gt; Loans, the system can automatically deduct instalment amounts from member savings accounts on due dates. This runs via a scheduled background job and can also be triggered manually.</p>
      <h3 className="font-semibold text-gray-900 mt-4">M-Pesa Repayments</h3>
      <p className="text-gray-600 text-sm">Members can repay via M-Pesa. The payment is received, matched to the member's loan, and allocated automatically.</p>
    </SectionWrapper>
  );
}

function DefaultsSection() {
  return (
    <SectionWrapper title="Defaults & Collections" icon={AlertTriangle}>
      <p className="text-gray-600">Track overdue loans and manage recovery efforts. This module gives you a complete view of all loans with missed payments.</p>
      <h3 className="font-semibold text-gray-900">Dashboard View</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard title="Due Today">
          <p>Instalments due on the current date that haven't been paid yet.</p>
        </InfoCard>
        <InfoCard title="Overdue">
          <p>All instalments past their due date. Shows days overdue and total arrears amount.</p>
        </InfoCard>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Aging Categories</h3>
      <p className="text-gray-600 text-sm">Defaults are categorized by how long they've been overdue:</p>
      <div className="flex flex-wrap gap-2 mt-2">
        {['1-30 days', '31-60 days', '61-90 days', '91-180 days', '180+ days'].map(age => (
          <span key={age} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">{age}</span>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Collection Actions</h3>
      <FeatureList items={[
        'Assign a staff member to manage a specific default case',
        'Record collection notes and follow-up actions',
        'Set a "Next Action Date" for follow-up reminders',
        'Send SMS reminder to the member directly',
        'Record partial repayments',
        'Mark the loan as defaulted if recovery is not possible',
        'Restructure the loan to create new manageable terms',
      ]} />
    </SectionWrapper>
  );
}

function TransactionsSection() {
  return (
    <SectionWrapper title="Quick Transactions" icon={Wallet}>
      <p className="text-gray-600">Record financial transactions -- deposits, withdrawals, transfers, and fees -- for any member. This is the basic transaction interface for recording individual transactions.</p>
      <h3 className="font-semibold text-gray-900">Transaction Types</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { type: 'Deposit', desc: 'Add funds to a member\'s savings or shares account', icon: '+ ' },
          { type: 'Withdrawal', desc: 'Member withdraws from their savings account', icon: '- ' },
          { type: 'Transfer', desc: 'Move funds between a member\'s accounts (savings to shares, etc.)', icon: '  ' },
          { type: 'Fee', desc: 'Charge a service or processing fee to a member\'s account', icon: '  ' },
        ].map(t => (
          <div key={t.type} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{t.type}</span>
            <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Processing a Transaction</h3>
      <div className="space-y-4">
        <Step n={1} title="Search Member">
          <p>Search by name, member number, or phone number.</p>
        </Step>
        <Step n={2} title="Choose Type & Account">
          <p>Select deposit/withdrawal/transfer/fee and choose the account (Savings or Shares).</p>
        </Step>
        <Step n={3} title="Enter Details">
          <p>Enter the amount, payment method (Cash, M-Pesa, Cheque, Bank Transfer), and optional reference number or note.</p>
        </Step>
        <Step n={4} title="Submit">
          <p>The transaction is recorded instantly and the member's balance is updated. A confirmation receipt can be printed.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Payment Methods</h3>
      <FeatureList items={['Cash', 'M-Pesa (mobile money)', 'Cheque', 'Bank Transfer']} />
      <Tip><strong>For tellers serving customers at the counter:</strong> Use the <strong>Teller Station</strong> instead -- it's optimized for fast, back-to-back transactions with integrated queue management.</Tip>
    </SectionWrapper>
  );
}

function TellerStationSection() {
  return (
    <SectionWrapper title="Teller Station" icon={Banknote}>
      <p className="text-gray-600">The Teller Station is the primary counter interface for tellers. It combines transaction processing with queue management for fast, efficient member service.</p>
      <h3 className="font-semibold text-gray-900">Workflow</h3>
      <div className="space-y-4">
        <Step n={1} title="Open Your Station">
          <p>Log in and navigate to Teller Station. Your counter number is assigned automatically based on your profile.</p>
        </Step>
        <Step n={2} title="Call Next Customer">
          <p>Click <strong>Call Next</strong> to pull the next ticket from the queue. The member's full profile, account balances, and recent transactions load automatically.</p>
        </Step>
        <Step n={3} title="Process Services">
          <p>From the single interface, you can perform any combination of:</p>
          <FeatureList items={[
            'Deposits to savings or shares',
            'Withdrawals from savings',
            'Loan repayments',
            'Cheque deposits',
            'Bank transfers',
            'Member information lookup',
          ]} />
        </Step>
        <Step n={4} title="Complete Service">
          <p>Click <strong>Complete</strong> to close the ticket and move to the next member.</p>
        </Step>
      </div>
      <Tip><strong>Difference from Quick Transactions:</strong> The Teller Station integrates queue management, shows member summaries automatically, and is designed for high-volume counter operations. Use Quick Transactions for one-off back-office recordings.</Tip>
    </SectionWrapper>
  );
}

function TellerServicesSection() {
  return (
    <SectionWrapper title="Teller Services" icon={ClipboardList}>
      <p className="text-gray-600">Advanced teller features for managing cheques, M-Pesa reconciliation, and specialized counter operations.</p>
      <h3 className="font-semibold text-gray-900">Cheque Management</h3>
      <div className="space-y-4">
        <Step n={1} title="Record a Cheque">
          <p>When a member deposits a cheque, record: cheque number, bank name, drawer name (who wrote the cheque), amount, and expected clearance date.</p>
        </Step>
        <Step n={2} title="Track Status">
          <p>Cheques move through statuses: <strong>Pending</strong> (waiting for clearance), <strong>Cleared</strong> (funds available), <strong>Bounced</strong> (rejected by the bank), or <strong>Cancelled</strong>.</p>
        </Step>
        <Step n={3} title="Process Clearance">
          <p>On the expected clearance date, clear the cheque to credit the member's account, or mark it as bounced if it was returned.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">M-Pesa Payment Reconciliation</h3>
      <p className="text-gray-600 text-sm">View unmatched M-Pesa payments that have come in but haven't been linked to a member account. Match them by entering the member's ID for each M-Pesa transaction code.</p>
    </SectionWrapper>
  );
}

function FloatManagementSection() {
  return (
    <SectionWrapper title="Float Management" icon={HardDrive}>
      <p className="text-gray-600">Float tracks the physical cash each teller holds during their shift. It ensures accountability and accurate reconciliation at the end of every business day.</p>
      <h3 className="font-semibold text-gray-900">Daily Float Workflow</h3>
      <div className="space-y-4">
        <Step n={1} title="Open Float">
          <p>At the start of the shift, record your opening cash balance -- the amount received from the vault or carried over from the previous day.</p>
        </Step>
        <Step n={2} title="Process Transactions">
          <p>As you work, deposits increase your float (cash in) and withdrawals decrease it (cash out). The system tracks all movements automatically.</p>
        </Step>
        <Step n={3} title="Replenish or Return">
          <p>Running low? Request a <strong>replenishment</strong> from the vault. Have excess? <strong>Return cash</strong> to the vault. Both are recorded with amounts and timestamps.</p>
        </Step>
        <Step n={4} title="Physical Cash Count">
          <p>At end of day, count the actual cash in your till and enter the physical count amount.</p>
        </Step>
        <Step n={5} title="Close Float">
          <p>The system compares: <strong>Expected balance</strong> (opening + deposits - withdrawals +/- vault movements) vs. <strong>Physical count</strong>. Any variance is recorded.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Float Reconciliation</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <InfoCard title="Shortage">
          <p>If the physical count is LESS than expected. Requires a manager to approve the variance using their Approval PIN.</p>
        </InfoCard>
        <InfoCard title="Excess">
          <p>If the physical count is MORE than expected. Also recorded for investigation.</p>
        </InfoCard>
      </div>
      <Warning><strong>Approval PIN:</strong> Manager approval is required for float shortages. Managers set their Approval PIN (4-6 digits) in My Account &gt; Security.</Warning>
    </SectionWrapper>
  );
}

function QueueKioskSection() {
  return (
    <SectionWrapper title="Ticketing Kiosk" icon={Printer}>
      <p className="text-gray-600">The Ticketing Kiosk is a self-service screen where members select the service they need and receive a numbered ticket. It's designed to run on a tablet or touchscreen at the branch entrance.</p>
      <h3 className="font-semibold text-gray-900">Service Categories</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { cat: 'Transactions (T)', desc: 'Deposits, withdrawals, balance inquiries', prefix: 'T-001, T-002...' },
          { cat: 'Loans (L)', desc: 'Loan applications, inquiries, repayments', prefix: 'L-001, L-002...' },
          { cat: 'Account Opening (A)', desc: 'New member registration', prefix: 'A-001, A-002...' },
          { cat: 'Inquiries (I)', desc: 'General questions, statements, other', prefix: 'I-001, I-002...' },
        ].map(c => (
          <div key={c.cat} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{c.cat}</span>
            <p className="text-xs text-gray-500">{c.desc}</p>
            <p className="text-xs text-blue-600 mt-1">Ticket format: {c.prefix}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">How It Works</h3>
      <div className="space-y-4">
        <Step n={1} title="Member Selects Service">
          <p>The member taps the service category they need on the touchscreen.</p>
        </Step>
        <Step n={2} title="Ticket Generated">
          <p>A numbered ticket is generated instantly (e.g., T-005) and a print window opens automatically for the member to collect their ticket.</p>
        </Step>
        <Step n={3} title="Wait for Call">
          <p>The member waits in the hall until their number is called on the Queue Display Board and announced over speakers.</p>
        </Step>
      </div>
      <Tip><strong>Setup:</strong> Open the Ticketing Kiosk URL on a dedicated tablet at the branch entrance. Set the browser to full-screen/kiosk mode for the best experience.</Tip>
    </SectionWrapper>
  );
}

function QueueDisplaySection() {
  return (
    <SectionWrapper title="Queue Display Board" icon={MonitorSmartphone}>
      <p className="text-gray-600">The Queue Display Board shows which ticket numbers are being served at which counters. It's designed to run on a large TV screen visible in the banking hall.</p>
      <h3 className="font-semibold text-gray-900">What It Shows</h3>
      <FeatureList items={[
        'Currently serving ticket number at each counter',
        'Which teller is at which counter',
        'Color-coded service categories (Transactions, Loans, Account Opening, Inquiries)',
        'Total waiting count per service type',
        'Auto-refreshing -- updates in real-time as tellers call tickets',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Voice Announcements</h3>
      <p className="text-gray-600 text-sm">When a teller calls the next ticket, the display board uses text-to-speech to announce: <em>"Ticket T-0-0-5, please proceed to Counter 2."</em> The ticket number is spelled out digit by digit for clarity, and the announcement is repeated twice.</p>
      <Tip><strong>Setup:</strong> Open the Queue Display Board URL on a TV or large monitor connected to speakers. Set the browser to full-screen mode. Make sure the volume is audible in the banking hall.</Tip>
    </SectionWrapper>
  );
}

function FixedDepositsSection() {
  return (
    <SectionWrapper title="Fixed Deposits" icon={PiggyBank}>
      <p className="text-gray-600">Fixed deposits allow members to lock in a sum of money for a set period at a guaranteed interest rate. The longer the term, the higher the interest.</p>
      <h3 className="font-semibold text-gray-900">Setting Up Fixed Deposit Products</h3>
      <div className="space-y-4">
        <Step n={1} title="Create a Product">
          <p>Define the product name, term length (in months), annual interest rate, minimum deposit amount, and early withdrawal penalty percentage.</p>
        </Step>
        <Step n={2} title="Open a Deposit for a Member">
          <p>Select a member and the product. Enter the deposit amount. The system calculates the maturity date and expected interest payout automatically.</p>
        </Step>
        <Step n={3} title="Maturity Processing">
          <p>When the deposit reaches its maturity date, the full payout (principal + interest) is processed. This can happen automatically via the scheduled cron job or be triggered manually.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Early Withdrawal</h3>
      <p className="text-gray-600 text-sm">If a member needs their funds before maturity, the early withdrawal penalty (set on the product) is deducted from the earned interest. The remaining balance is returned to their savings account.</p>
    </SectionWrapper>
  );
}

function DividendsSection() {
  return (
    <SectionWrapper title="Dividends" icon={DollarSign}>
      <p className="text-gray-600">Distribute profits to members based on their shareholding. Dividends are typically declared once per year at the end of the fiscal period.</p>
      <h3 className="font-semibold text-gray-900">Declaring & Distributing Dividends</h3>
      <div className="space-y-4">
        <Step n={1} title="Create Declaration">
          <p>Specify the fiscal year, the dividend rate (as a percentage), and the total amount available for distribution.</p>
        </Step>
        <Step n={2} title="Preview Distribution">
          <p>The system calculates each member's share based on their shares balance multiplied by the dividend rate. Review the distribution list before processing.</p>
        </Step>
        <Step n={3} title="Process Distribution">
          <p>Confirm the distribution. Each member's dividend is credited to their savings account. The system creates corresponding journal entries automatically.</p>
        </Step>
      </div>
    </SectionWrapper>
  );
}

function ChartOfAccountsSection() {
  return (
    <SectionWrapper title="Chart of Accounts" icon={Layers}>
      <p className="text-gray-600">The Chart of Accounts is the foundation of your double-entry bookkeeping system. It categorizes every financial account in your organization.</p>
      <h3 className="font-semibold text-gray-900">Account Types</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { type: 'Assets', desc: 'Cash on hand, bank accounts, loans receivable, equipment, property', color: 'text-blue-700' },
          { type: 'Liabilities', desc: 'Member savings, deposits payable, loans payable, accrued expenses', color: 'text-red-700' },
          { type: 'Equity', desc: 'Share capital, retained earnings, reserves, surplus', color: 'text-purple-700' },
          { type: 'Income', desc: 'Interest income, processing fees, commissions, penalty charges', color: 'text-green-700' },
          { type: 'Expenses', desc: 'Staff salaries, rent, utilities, stationery, depreciation', color: 'text-amber-700' },
        ].map(t => (
          <div key={t.type} className="bg-gray-50 rounded-lg p-3">
            <span className={`font-medium ${t.color}`}>{t.type}</span>
            <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Managing Accounts</h3>
      <FeatureList items={[
        'Create accounts with a unique code (e.g., 1001), name, and type',
        'Organize in a hierarchical structure with parent/child accounts',
        'View the current balance of any account',
        'System accounts (member savings, loans receivable, etc.) are created automatically',
        'Mark accounts as active or inactive',
      ]} />
    </SectionWrapper>
  );
}

function JournalEntriesSection() {
  return (
    <SectionWrapper title="Journal Entries" icon={ScrollText}>
      <p className="text-gray-600">Journal entries record transactions in the double-entry system. Every entry must have equal debits and credits -- this is the fundamental rule of accounting.</p>
      <h3 className="font-semibold text-gray-900">Creating a Manual Journal Entry</h3>
      <div className="space-y-4">
        <Step n={1} title="New Entry">
          <p>Click <strong>New Journal Entry</strong>. Enter the date, a reference number (or let the system auto-generate), and a description of the transaction.</p>
        </Step>
        <Step n={2} title="Add Lines">
          <p>For each line, select an account from the Chart of Accounts and enter either a debit or credit amount. Add as many lines as needed.</p>
        </Step>
        <Step n={3} title="Balance Check">
          <p>The system shows the total debits and credits. They must be equal before you can save.</p>
        </Step>
        <Step n={4} title="Save or Post">
          <p><strong>Save as Draft:</strong> Save for review later -- can still be edited. <strong>Post:</strong> Finalize the entry and update account balances. Posted entries are permanent and cannot be edited.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Automatic Journal Entries</h3>
      <p className="text-gray-600 text-sm mb-2">The system automatically creates journal entries for these operations -- you don't need to record them manually:</p>
      <FeatureList items={[
        'Loan disbursements (debit Loans Receivable, credit Cash/Bank)',
        'Loan repayments (debit Cash, credit Loans Receivable + Interest Income)',
        'Member deposits (debit Cash, credit Member Savings)',
        'Member withdrawals (debit Member Savings, credit Cash)',
        'Fee charges (debit Member Account, credit Fee Income)',
        'Payroll processing (debit Salary Expense, credit Cash + Statutory accounts)',
        'Fixed deposit maturity (debit Fixed Deposits + Interest Expense, credit Cash)',
        'Dividend distribution',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Reversals</h3>
      <p className="text-gray-600 text-sm">If a posted entry has an error, click <strong>Reverse</strong>. This creates a new entry that mirrors the original but with debits and credits swapped, effectively cancelling the original. The reversal is linked to the original for audit.</p>
    </SectionWrapper>
  );
}

function OpeningBalancesSection() {
  return (
    <SectionWrapper title="Opening Balances" icon={Landmark}>
      <p className="text-gray-600">When migrating from another system or starting a new financial period, use opening balances to set the initial values of your accounts so your books match reality.</p>
      <div className="space-y-4">
        <Step n={1} title="Review Suggested Balances">
          <p>The system compares General Ledger account balances with sub-ledger totals (e.g., total of all member savings vs. the savings liability account). It suggests adjustments where discrepancies exist.</p>
        </Step>
        <Step n={2} title="Enter or Adjust">
          <p>Enter the correct balance for each account. The system creates the necessary journal entries to bring accounts to the correct values.</p>
        </Step>
        <Step n={3} title="Post">
          <p>Post the opening balance entries. This should typically be done only once, during initial setup.</p>
        </Step>
      </div>
      <Warning><strong>One-time operation:</strong> Opening balances should only be posted once during initial system setup. Contact support if you need to adjust them later.</Warning>
    </SectionWrapper>
  );
}

function ReportsSection() {
  return (
    <SectionWrapper title="Financial Reports" icon={FileText}>
      <p className="text-gray-600">Generate comprehensive financial and operational reports for your organization.</p>
      <h3 className="font-semibold text-gray-900">Available Reports</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { name: 'Summary Report', desc: 'High-level overview of total savings, loans, collections, and key ratios.' },
          { name: 'Trial Balance', desc: 'All accounts listed with their debit and credit balances. Total debits must equal total credits.' },
          { name: 'Income Statement (P&L)', desc: 'Revenue minus expenses for a selected period. Shows whether you are making a profit or loss.' },
          { name: 'Balance Sheet', desc: 'Snapshot of assets, liabilities, and equity at a specific date. Assets must equal Liabilities + Equity.' },
          { name: 'General Ledger', desc: 'Complete transaction history for any account. Shows every debit and credit with running balance.' },
          { name: 'Loan Report', desc: 'All loans with status, disbursed amount, outstanding balance, and repayment progress.' },
          { name: 'Member Report', desc: 'Individual and aggregate savings, shares, and loan balances per member.' },
          { name: 'Aging Report', desc: 'Outstanding loans categorized by days overdue: 1-30, 31-60, 61-90, 91-180, 180+ days.' },
          { name: 'Statement Report', desc: 'Detailed member account statements with all transactions and running balances.' },
        ].map(r => (
          <InfoCard key={r.name} title={r.name}>
            <p>{r.desc}</p>
          </InfoCard>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Report Filters</h3>
      <FeatureList items={[
        'Date range (start and end date)',
        'Branch filter (specific branch or all branches)',
        'Export any report to CSV',
        'Print-friendly formatting',
      ]} />
    </SectionWrapper>
  );
}

function AnalyticsSection() {
  return (
    <SectionWrapper title="Analytics Dashboard" icon={BarChart3}>
      <p className="text-gray-600">Visual charts and trend analysis to help you understand your organization's performance over time.</p>
      <h3 className="font-semibold text-gray-900">Available Charts & Metrics</h3>
      <FeatureList items={[
        'Loan disbursement trends (monthly bar chart)',
        'Savings growth trajectory',
        'Repayment collection rate over time',
        'Default rate trends and patterns',
        'Member growth (new registrations per month)',
        'Transaction volume by type (deposits, withdrawals, transfers)',
        'Branch-level performance comparisons',
        'Institution health score -- a composite metric based on:',
      ]} />
      <div className="ml-6 mt-2">
        <FeatureList items={[
          'Member savings and deposit ratios',
          'Loan portfolio quality (performing vs. non-performing)',
          'Collection efficiency percentage',
          'Capital adequacy',
        ]} />
      </div>
    </SectionWrapper>
  );
}

function CSVExportSection() {
  return (
    <SectionWrapper title="CSV & Data Export" icon={Download}>
      <p className="text-gray-600">Export your data as CSV files for analysis in spreadsheets, reporting tools, or regulatory submissions.</p>
      <h3 className="font-semibold text-gray-900">What You Can Export</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { what: 'Members List', where: 'Members page > Export button' },
          { what: 'Transaction History', where: 'Transactions page > Export button' },
          { what: 'Loan List', where: 'Loan Applications page > Export button' },
          { what: 'Financial Reports', where: 'Reports page > Export per report' },
          { what: 'Member Statements', where: 'Member detail > Download/Print' },
        ].map(e => (
          <div key={e.what} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{e.what}</span>
            <p className="text-xs text-gray-500 mt-0.5">{e.where}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">How to Export</h3>
      <div className="space-y-4">
        <Step n={1} title="Apply Filters">
          <p>Before exporting, apply any date range, branch, or status filters. The export includes only the filtered data.</p>
        </Step>
        <Step n={2} title="Click Export">
          <p>Click the <strong>Export</strong> or <strong>Download</strong> button. The CSV file downloads to your computer immediately.</p>
        </Step>
        <Step n={3} title="Open in Spreadsheet">
          <p>Open the CSV file in Excel, Google Sheets, or any spreadsheet application for analysis.</p>
        </Step>
      </div>
    </SectionWrapper>
  );
}

function SMSSection() {
  return (
    <SectionWrapper title="SMS Notifications" icon={MessageSquare}>
      <p className="text-gray-600">Send SMS messages to members for transaction confirmations, reminders, and custom communications.</p>
      <h3 className="font-semibold text-gray-900">Sending SMS</h3>
      <div className="space-y-4">
        <Step n={1} title="Single SMS">
          <p>Select a member and type your message. Click <strong>Send</strong> for immediate delivery.</p>
        </Step>
        <Step n={2} title="Bulk SMS">
          <p>Send the same message to multiple members at once. Filter recipients by branch or select specific members.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">SMS Templates</h3>
      <p className="text-gray-600 text-sm mb-2">Create reusable templates with dynamic placeholders that auto-fill with member data:</p>
      <div className="bg-gray-50 rounded-lg p-4 text-sm font-mono text-gray-700">
        <p>Dear {'{{name}}'}, your deposit of {'{{amount}}'} has been received. New balance: {'{{balance}}'}. Thank you!</p>
      </div>
      <p className="text-gray-500 text-xs mt-2">Available placeholders: {'{{name}}'}, {'{{amount}}'}, {'{{balance}}'}, {'{{due_date}}'}, {'{{loan_number}}'}</p>
      <h3 className="font-semibold text-gray-900 mt-6">Automatic SMS</h3>
      <p className="text-gray-600 text-sm mb-2">When enabled in Settings, the system auto-sends SMS for:</p>
      <FeatureList items={[
        'Deposit confirmations with new balance',
        'Withdrawal confirmations',
        'Loan approval notifications',
        'Loan disbursement confirmations',
        'Payment due reminders (sent before due date)',
        'Overdue payment alerts',
        'Repayment confirmations',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Delivery Logs</h3>
      <p className="text-gray-600 text-sm">View the status of every SMS: Sent, Pending, or Failed. Each log shows the recipient, message content, timestamp, and delivery status.</p>
    </SectionWrapper>
  );
}

function HRSection() {
  return (
    <SectionWrapper title="HR Management" icon={Users}>
      <p className="text-gray-600">Manage your internal staff beyond system access -- maintain employee records, track training, and handle disciplinary matters.</p>
      <h3 className="font-semibold text-gray-900">Employee Records</h3>
      <FeatureList items={[
        'Personal details: name, ID, contact, address',
        'Employment details: hire date, department, position, salary',
        'Contract type and status',
        'Emergency contacts',
        'Document uploads (contracts, certificates, IDs)',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Training Management</h3>
      <FeatureList items={[
        'Record training courses and certifications',
        'Track completion dates and expiry dates',
        'Training history per staff member',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Disciplinary Records</h3>
      <FeatureList items={[
        'Log incidents with descriptions and dates',
        'Record disciplinary actions taken',
        'Track resolution and follow-up status',
        'Maintain audit trail of all disciplinary proceedings',
      ]} />
    </SectionWrapper>
  );
}

function AttendanceSection() {
  return (
    <SectionWrapper title="Attendance Tracking" icon={Clock}>
      <p className="text-gray-600">Track staff attendance with digital clock-in and clock-out. The system records exact timestamps and automatically calculates hours worked and overtime.</p>

      <h3 className="font-semibold text-gray-900">How Clock In &amp; Clock Out Works</h3>
      <div className="space-y-4">
        <Step n={1} title="Clock In">
          <p>When a staff member arrives, they click the <strong>Clock In</strong> button in the top header bar. The system records the exact date and time of clock-in. Each staff member can only clock in once per day — attempting to clock in again returns an error.</p>
        </Step>
        <Step n={2} title="Work the Day">
          <p>The header shows the staff member's clocked-in time throughout the day. Managers can see who has clocked in across their branch from the Attendance page.</p>
        </Step>
        <Step n={3} title="Clock Out">
          <p>At the end of the shift, the staff member clicks <strong>Clock Out</strong>. The system records the exact time and automatically calculates total minutes worked. Each staff member can only clock out once per day — and must have clocked in first.</p>
        </Step>
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">Automatic Calculations</h3>
      <FeatureList items={[
        'Total minutes worked = Clock Out time minus Clock In time',
        'Overtime: Any work beyond 8 hours (480 minutes) is recorded as overtime minutes automatically',
        'Attendance status is set to "present" when a staff member clocks in',
        'Attendance records are tied to each staff member\'s branch',
      ]} />

      <h3 className="font-semibold text-gray-900 mt-4">Require Clock In (Access Control)</h3>
      <p className="text-gray-600 text-sm">When the <strong>Require Clock In</strong> setting is enabled (in Settings → Business Hours), staff cannot access any part of the system until they have clocked in for the day. Instead of the normal dashboard, they see a full-screen prompt with a single <strong>Clock In</strong> button. Once clocked in, they gain full access. Admin users are not blocked by this restriction.</p>

      <h3 className="font-semibold text-gray-900 mt-4">Manual Attendance Records</h3>
      <p className="text-gray-600 text-sm">Managers with HR permissions can also create or edit attendance records manually from the Attendance page — useful for correcting missed clock-ins or adding records for field staff.</p>

      <Tip><strong>Header buttons:</strong> The Clock In and Clock Out buttons only appear in the top bar when <strong>Require Clock In</strong> is enabled. If this setting is off, attendance is still tracked but not enforced.</Tip>
    </SectionWrapper>
  );
}

function PayrollSection() {
  return (
    <SectionWrapper title="Payroll Processing" icon={DollarSign}>
      <p className="text-gray-600">Process monthly payroll for all staff members including salary, allowances, statutory deductions, and automatic loan repayments.</p>
      <h3 className="font-semibold text-gray-900">Salary Components</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard title="Earnings">
          <FeatureList items={[
            'Basic Salary',
            'House Allowance',
            'Transport Allowance',
            'Other Allowances',
          ]} />
        </InfoCard>
        <InfoCard title="Statutory Deductions">
          <FeatureList items={[
            'PAYE (Pay As You Earn tax)',
            'NHIF (National Hospital Insurance Fund)',
            'NSSF (National Social Security Fund)',
          ]} />
        </InfoCard>
        <InfoCard title="Loan Deductions">
          <FeatureList items={[
            'Automatic loan repayment deducted from net pay',
            'Covers all overdue and currently due loan instalments',
            'Proactively includes the next upcoming instalment even if not yet due',
            'Supports multiple active loans per staff member',
            'Shown as a separate line item on each payslip',
          ]} />
        </InfoCard>
        <InfoCard title="Advance Deductions">
          <FeatureList items={[
            'Recovery of salary advances previously issued to staff',
            'Tracked separately from loan deductions on payslips',
            'Deducted after statutory deductions but before final net pay',
          ]} />
        </InfoCard>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Processing Payroll</h3>
      <div className="space-y-4">
        <Step n={1} title="Review Staff Salary Details">
          <p>Ensure all staff have their salary components entered correctly in their HR profile.</p>
        </Step>
        <Step n={2} title="Run Payroll">
          <p>Select the month and run the payroll. The system calculates gross pay, applies all statutory deductions, calculates loan and advance deductions for linked staff members, and shows net pay for each staff member.</p>
        </Step>
        <Step n={3} title="Approve & Disburse">
          <p>Review the payroll summary including loan deductions. Approve and choose the disbursement method. When disbursed, loan repayments are automatically processed -- updating loan balances, marking paid instalments, recording repayment transactions, and updating the loan outstanding balance.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Automatic Loan Deduction from Payroll</h3>
      <p className="text-gray-600 text-sm">For staff members with linked member accounts and active loans, the system automatically calculates and deducts loan repayments during payroll:</p>
      <FeatureList items={[
        'Staff must have a linked member account with an active (disbursed) loan',
        'All overdue and due instalments are collected first, then the next upcoming instalment is included proactively',
        'Repayment is allocated in order: penalties, then interest, then insurance, then principal',
        'If net pay is insufficient to cover the full loan amount, a partial deduction is made and logged',
        'Each loan repayment creates a transaction record and updates the loan outstanding balance',
        'Loans are marked as "fully paid" automatically when the total repaid reaches the total repayable amount',
      ]} />
      <Tip><strong>Automatic accounting:</strong> When payroll is processed, the system automatically creates journal entries -- debiting salary expense accounts and crediting cash, statutory deduction, and loan repayment accounts.</Tip>
    </SectionWrapper>
  );
}

function LeaveSection() {
  return (
    <SectionWrapper title="Leave Management" icon={Calendar}>
      <p className="text-gray-600">Manage staff leave requests, approvals, and balance tracking.</p>
      <h3 className="font-semibold text-gray-900">Leave Types</h3>
      <div className="grid sm:grid-cols-3 gap-2">
        {['Annual Leave', 'Sick Leave', 'Maternity Leave', 'Paternity Leave', 'Compassionate Leave', 'Study Leave'].map(type => (
          <div key={type} className="bg-gray-50 rounded-lg p-2 text-sm text-gray-700 text-center">{type}</div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Leave Workflow</h3>
      <div className="space-y-4">
        <Step n={1} title="Staff Submits Request">
          <p>Select the leave type, start date, end date, and add any notes or reason. The system shows available leave balance.</p>
        </Step>
        <Step n={2} title="Manager Reviews">
          <p>The request appears in the manager's leave approval queue. They can <strong>Approve</strong> or <strong>Reject</strong> with a reason.</p>
        </Step>
        <Step n={3} title="Balance Updated">
          <p>On approval, the leave days are deducted from the staff member's available balance for that leave type.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Leave Balances</h3>
      <p className="text-gray-600 text-sm">Each leave type tracks: allocated days per year, days used, and remaining balance. Paid and unpaid leave are tracked separately.</p>
    </SectionWrapper>
  );
}

function ExpensesSection() {
  return (
    <SectionWrapper title="Expenses" icon={Receipt}>
      <p className="text-gray-600">Track organizational expenses -- office supplies, utilities, travel, and other operational costs.</p>
      <div className="space-y-4">
        <Step n={1} title="Create Expense">
          <p>Click <strong>Add Expense</strong>. Enter: description, category, amount, date, and payment method. Attach a receipt image if available.</p>
        </Step>
        <Step n={2} title="Approval (if configured)">
          <p>Staff members with the expense approval permission can approve or reject submitted expenses before they are posted to the ledger.</p>
        </Step>
        <Step n={3} title="Automatic Accounting">
          <p>Approved expenses create journal entries automatically -- debiting the expense account and crediting cash or bank.</p>
        </Step>
      </div>
    </SectionWrapper>
  );
}

function AuditLogsSection() {
  return (
    <SectionWrapper title="Audit Logs" icon={ScrollText}>
      <p className="text-gray-600">An immutable record of every important action in the system. Audit logs cannot be edited or deleted -- they provide a complete trail for compliance and accountability.</p>
      <h3 className="font-semibold text-gray-900">What Gets Logged</h3>
      <FeatureList items={[
        'Member creation, editing, activation, suspension, and deletion',
        'Loan applications, approvals, rejections, disbursements, and restructuring',
        'All transactions (deposits, withdrawals, transfers, fees)',
        'Staff account creation, role changes, suspension, and deletion',
        'Settings modifications',
        'Float operations (open, close, replenish, return, variances)',
        'Login and logout events',
        'Permission and role changes',
        'Payroll processing',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Log Entry Details</h3>
      <FeatureList items={[
        'Action performed (e.g., "Member Created", "Loan Approved")',
        'Who performed it (staff name and role)',
        'Exact timestamp',
        'Affected entity (member name, loan number, etc.)',
        'Old vs. New values comparison (for edits)',
        'IP address and session information',
      ]} />
      <Tip><strong>Read-only:</strong> Audit logs are permanent and cannot be modified or deleted by anyone, including administrators.</Tip>
    </SectionWrapper>
  );
}

function MpesaSection() {
  return (
    <SectionWrapper title="M-Pesa Integration" icon={Banknote}>
      <p className="text-gray-600">Accept and send mobile money payments through M-Pesa. Two integration methods are available.</p>
      <h3 className="font-semibold text-gray-900">Integration Options</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className="font-medium text-gray-900 mb-2">Direct Safaricom Daraja API</h4>
          <p className="text-sm text-gray-600 mb-2">Connect directly to Safaricom's payment platform.</p>
          <p className="text-sm text-gray-600"><strong>You'll need:</strong> Consumer Key, Consumer Secret, Shortcode, Passkey, and a registered M-Pesa app at developer.safaricom.co.ke</p>
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">M-Pesa Features</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { feature: 'STK Push', desc: 'Send a payment prompt to a member\'s phone. They enter their PIN to confirm.' },
          { feature: 'C2B (Customer to Business)', desc: 'Receive payments when members pay to your paybill or till number.' },
          { feature: 'B2C (Business to Customer)', desc: 'Send money to members for loan disbursements, refunds, or dividends.' },
          { feature: 'Loan Repayment', desc: 'Members repay loans via M-Pesa with automatic allocation to instalments.' },
          { feature: 'Member Deposits', desc: 'Secure STK Push deposits with dual confirmation (callback + query) for fraud prevention.' },
          { feature: 'Reversals', desc: 'Reverse erroneous M-Pesa transactions.' },
        ].map(f => (
          <div key={f.feature} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{f.feature}</span>
            <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Configuration Steps</h3>
      <div className="space-y-4">
        <Step n={1} title="Go to Settings > M-Pesa">
          <p>Open Settings and click the M-Pesa tab.</p>
        </Step>
        <Step n={2} title="Choose Gateway & Enter Credentials">
          <p>Enter your Daraja API credentials (Consumer Key, Consumer Secret, Passkey, and Shortcode).</p>
        </Step>
        <Step n={3} title="Set Callback URL">
          <p>Enter your publicly accessible HTTPS callback URL (e.g., https://yourdomain.com/api/mpesa/callback). Safaricom sends payment confirmations here.</p>
        </Step>
        <Step n={4} title="Select Environment">
          <p>Choose Sandbox for testing or Production for live transactions.</p>
        </Step>
      </div>
      <Warning><strong>HTTPS required:</strong> M-Pesa callbacks require a valid SSL certificate. Your server must be accessible over HTTPS.</Warning>
    </SectionWrapper>
  );
}

function SettingsGeneralSection() {
  return (
    <SectionWrapper title="General Settings" icon={Settings}>
      <p className="text-gray-600">Core organization configuration accessible from the Settings page in the sidebar.</p>
      <h3 className="font-semibold text-gray-900">What You Can Configure</h3>
      <FeatureList items={[
        'Organization name and contact details (email, phone)',
        'Staff email domain -- restricts staff email registration to your domain (e.g., only @mysacco.co.ke)',
        'Currency selection',
        'Financial year start month',
        'Branding and display preferences',
      ]} />
    </SectionWrapper>
  );
}

function SettingsLoansSection() {
  return (
    <SectionWrapper title="Loan Settings" icon={CreditCard}>
      <p className="text-gray-600">Global loan configuration that applies across all loan products.</p>
      <h3 className="font-semibold text-gray-900">Options</h3>
      <FeatureList items={[
        'Auto-deduction toggle -- enable/disable automatic loan deductions from member savings',
        'Grace period configuration -- number of days after due date before a loan is considered overdue',
        'Default interest rate for new products',
        'Penalty configuration for late payments',
      ]} />
    </SectionWrapper>
  );
}

function SettingsSMSSection() {
  return (
    <SectionWrapper title="SMS Settings" icon={MessageSquare}>
      <p className="text-gray-600">Configure your SMS gateway to send notifications to members.</p>
      <h3 className="font-semibold text-gray-900">Configuration</h3>
      <FeatureList items={[
        'SMS provider selection',
        'API key and authentication credentials',
        'Sender ID (the name that appears on the SMS)',
        'Auto-notification preferences (which events trigger automatic SMS)',
        'SMS template management with placeholders',
      ]} />
    </SectionWrapper>
  );
}

function SettingsEmailSection() {
  return (
    <SectionWrapper title="Email Settings" icon={Mail}>
      <p className="text-gray-600">Configure the email service used for password resets, welcome emails, and notifications.</p>
      <h3 className="font-semibold text-gray-900">Configuration</h3>
      <FeatureList items={[
        'Email provider credentials (currently supports Brevo/Sendinblue)',
        'Sender email address and name',
        'Welcome email toggle and customization',
        'Password reset email configuration',
      ]} />
    </SectionWrapper>
  );
}

function SettingsMpesaSection() {
  return (
    <SectionWrapper title="M-Pesa Settings" icon={Banknote}>
      <p className="text-gray-600">Configure M-Pesa payment integration. See the <strong>M-Pesa Integration</strong> section above for a full guide.</p>
      <h3 className="font-semibold text-gray-900">Fields</h3>
      <FeatureList items={[
        'Consumer Key and Consumer Secret',
        'Shortcode and Passkey',
        'Callback URL',
        'Environment: Sandbox or Production',
      ]} />
    </SectionWrapper>
  );
}

function SettingsHoursSection() {
  return (
    <SectionWrapper title="Business Hours" icon={Clock}>
      <p className="text-gray-600">Configure your organization's working schedule and control how staff access the system based on time and attendance.</p>

      <h3 className="font-semibold text-gray-900">Working Hours Schedule</h3>
      <p className="text-gray-600 text-sm">Set your working schedule for each day of the week. For each day you can:</p>
      <FeatureList items={[
        'Toggle each day as a working day or non-working day (Monday through Sunday)',
        'Set a specific start time and end time for each working day',
        'Days marked as non-working are treated as off-days for enforcement purposes',
      ]} />

      <h3 className="font-semibold text-gray-900 mt-4">Enforce Working Hours</h3>
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 space-y-2">
        <p className="text-sm font-medium text-gray-900">What it does</p>
        <p className="text-sm text-gray-600">When this toggle is <strong>ON</strong>, the system checks the current time against your configured schedule every time a staff member tries to access the system. If they attempt to log in or navigate outside of working hours — or on a non-working day — access is blocked with a message showing the allowed hours.</p>
        <p className="text-sm text-gray-600">When this toggle is <strong>OFF</strong>, the working hours schedule is saved but not enforced — staff can access the system at any time.</p>
      </div>
      <Warning><strong>Important:</strong> Enforce Working Hours checks happen at the session level. If a staff member is already logged in when working hours end, they will not be automatically kicked out — they only get blocked on the next login attempt or page refresh that triggers the check.</Warning>

      <h3 className="font-semibold text-gray-900 mt-4">Require Clock In</h3>
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 space-y-2">
        <p className="text-sm font-medium text-gray-900">What it does</p>
        <p className="text-sm text-gray-600">When this toggle is <strong>ON</strong>, staff members must clock in before they can access any part of the system. Instead of the normal interface, they see a full-screen prompt with only a <strong>Clock In</strong> button. Once they clock in, they have full access for the rest of the day.</p>
        <p className="text-sm text-gray-600">When this toggle is <strong>OFF</strong>, the Clock In and Clock Out buttons are hidden from the header and attendance tracking is not enforced (though records can still be created manually).</p>
        <p className="text-sm text-gray-600"><strong>Admin users are exempt</strong> — they are never blocked, even when this setting is enabled.</p>
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">Auto-Logout Timer</h3>
      <p className="text-gray-600 text-sm">Set the number of minutes of inactivity before a staff session is automatically logged out. This applies across all staff members in the organization.</p>

      <div className="grid sm:grid-cols-2 gap-4 mt-2">
        <InfoCard title="Enforce Working Hours vs. Require Clock In">
          <p>These are two independent controls:</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            <li><strong>Enforce Working Hours</strong> — blocks access based on time of day/day of week</li>
            <li><strong>Require Clock In</strong> — blocks access until the staff member manually clocks in</li>
          </ul>
          <p className="mt-2 text-xs text-gray-600">You can enable either, both, or neither depending on your needs.</p>
        </InfoCard>
        <InfoCard title="Recommended Setup">
          <ul className="space-y-1 text-xs text-gray-600">
            <li>Enable <strong>Require Clock In</strong> to ensure attendance is recorded every day</li>
            <li>Enable <strong>Enforce Working Hours</strong> to prevent after-hours access</li>
            <li>Set the auto-logout timer to 30–60 minutes for shared workstations</li>
          </ul>
        </InfoCard>
      </div>
    </SectionWrapper>
  );
}

function SettingsRolesSection() {
  return (
    <SectionWrapper title="Role Management" icon={Shield}>
      <p className="text-gray-600">Create and manage custom roles from the Roles tab in Settings. See the <strong>Roles & Permissions</strong> section above for a complete guide on creating custom roles.</p>
    </SectionWrapper>
  );
}

function SettingsUsageSection() {
  return (
    <SectionWrapper title="Usage & Limits" icon={BarChart3}>
      <p className="text-gray-600">See how much of your plan's capacity you're using.</p>
      <h3 className="font-semibold text-gray-900">Tracked Metrics</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { metric: 'Members', desc: 'Current count vs. plan maximum' },
          { metric: 'Staff', desc: 'Current count vs. plan maximum' },
          { metric: 'Branches', desc: 'Current count vs. plan maximum' },
          { metric: 'SMS Sent', desc: 'Messages sent this month vs. monthly allowance' },
        ].map(m => (
          <div key={m.metric} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{m.metric}</span>
            <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-gray-600 text-sm mt-3">Each metric shows a visual progress bar. When you're close to a limit, you'll see a warning to upgrade your plan.</p>
    </SectionWrapper>
  );
}

function SettingsDangerSection() {
  return (
    <SectionWrapper title="Danger Zone" icon={Trash2}>
      <p className="text-gray-600">Irreversible actions that permanently affect your organization.</p>
      <Warning>
        <strong>Delete Organization:</strong> Permanently deletes the organization and ALL its data -- members, loans, transactions, settings, everything. This cannot be undone. To confirm, you must type the exact organization name. Only the Owner can perform this action.
      </Warning>
    </SectionWrapper>
  );
}

function MyAccountSection() {
  return (
    <SectionWrapper title="My Account" icon={UserCog}>
      <p className="text-gray-600">Manage your personal profile and security settings. Access it from the bottom of the sidebar.</p>
      <h3 className="font-semibold text-gray-900">Profile</h3>
      <FeatureList items={[
        'Update your first name and last name',
        'Update your phone number',
        'View your email (read-only after registration)',
        'View your role and staff number',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Security</h3>
      <div className="space-y-3">
        <InfoCard title="Change Password">
          <p>Enter your current password and set a new one (minimum 8 characters).</p>
        </InfoCard>
        <InfoCard title="Approval PIN">
          <p>Set or update a 4-6 digit PIN used for approving sensitive operations like float shortage approval, loan overrides, and certain financial actions. This PIN is separate from your password.</p>
        </InfoCard>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Other</h3>
      <FeatureList items={[
        'View which organizations you belong to',
        'Email verification status',
      ]} />
    </SectionWrapper>
  );
}

function SubscriptionsSection() {
  return (
    <SectionWrapper title="Subscriptions & Upgrade" icon={Star}>
      <p className="text-gray-600">Manage your subscription plan and billing. Upgrade to unlock more features and higher limits.</p>
      <h3 className="font-semibold text-gray-900">Available Plans</h3>
      <p className="text-gray-600 text-sm mb-3">Plans differ in the number of members, staff, and branches allowed, as well as which features are available:</p>
      <FeatureList items={[
        'Starter -- Basic core banking for small groups',
        'Growth -- More capacity and advanced features like teller station and fixed deposits',
        'Professional -- Full feature set including analytics, audit logs, and HR',
        'Enterprise -- Unlimited capacity with dedicated support',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-6">Payment Methods</h3>
      <div className="grid sm:grid-cols-3 gap-3">
        <InfoCard title="M-Pesa">
          <p>Enter your phone number. An STK Push is sent to your phone. Enter your M-Pesa PIN to confirm payment.</p>
        </InfoCard>
        <InfoCard title="Stripe">
          <p>Pay by credit/debit card. You'll be redirected to a secure Stripe checkout page to complete payment.</p>
        </InfoCard>
        <InfoCard title="Paystack">
          <p>Supports card payments and mobile money (M-Pesa, MTN, Airtel) through a secure popup.</p>
        </InfoCard>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Billing Cycle</h3>
      <FeatureList items={[
        'Monthly or annual billing (annual pricing includes a discount)',
        'Subscription auto-renews at the end of each period',
        'Renewal reminders sent 7 days before expiry',
        'Past-due notifications for failed payments',
      ]} />
    </SectionWrapper>
  );
}

function TrialSystemSection() {
  return (
    <SectionWrapper title="Trial Period" icon={Clock}>
      <p className="text-gray-600">New organizations start with a free trial period that gives access to all features.</p>
      <h3 className="font-semibold text-gray-900">How the Trial Works</h3>
      <FeatureList items={[
        'Full access to all features during the trial period',
        'Dashboard banner shows days remaining',
        'Warning banner appears when 7 days or fewer remain (blue)',
        'Urgent banner appears when 3 days or fewer remain (amber)',
        'Expired banner appears after trial ends (red) with upgrade prompt',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">After Trial Expires</h3>
      <p className="text-gray-600 text-sm">When the trial expires, access to premium features is restricted. You can still log in and view your data, but you'll need to upgrade to a paid plan to continue using advanced features.</p>
      <Tip><strong>To upgrade:</strong> Click the "Upgrade" banner on your dashboard or navigate to the Upgrade page from the sidebar.</Tip>
    </SectionWrapper>
  );
}

function LoanEligibilitySection() {
  return (
    <SectionWrapper title="Loan Eligibility Checker" icon={ClipboardList}>
      <p className="text-gray-600">The Loan Eligibility Checker is a quick field-assessment tool that lets loan officers instantly determine whether a client is likely to qualify for a loan — before a formal application is submitted.</p>

      <h3 className="font-semibold text-gray-900">Two Modes</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard title="Existing Member">
          Search your member database by name or member number. The system automatically pulls their real savings, shares, and deposits balances. All eight eligibility criteria are checked, including loan history and repayment standing.
        </InfoCard>
        <InfoCard title="Prospect / New Client">
          For a client who does not yet have a member account. Enter their name (optional) and estimated savings, shares, and deposit figures manually. All product-based checks run against the entered numbers. Checks that require a member account (e.g., existing loans, good standing) are flagged as informational and will be verified at application time.
        </InfoCard>
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">How to Run a Check</h3>
      <div className="space-y-4">
        <Step n={1} title="Select Client Mode">
          <p>Toggle between <strong>Existing Member</strong> and <strong>Prospect / New Client</strong> at the top of the Client card.</p>
        </Step>
        <Step n={2} title="Identify the Client">
          <p>For an existing member: search by name or member number and click their record. For a prospect: enter their name and approximate savings, shares, and deposits figures.</p>
        </Step>
        <Step n={3} title="Pick a Loan Product">
          <p>Select a loan product from the dropdown. The product's interest rate, amount range, and term limits are shown below the selector.</p>
        </Step>
        <Step n={4} title="Enter Loan Details">
          <p>Enter the requested loan amount and term in months. If the product requires collateral, enter the estimated market value of the security the client is offering.</p>
        </Step>
        <Step n={5} title="Check Eligibility">
          <p>Click <strong>Check Eligibility</strong>. Results appear instantly with a pass/fail verdict for each criterion.</p>
        </Step>
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">Checks Performed</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { check: 'Member Status', desc: 'Client must be an active member (skipped for prospects)' },
          { check: 'Loan Amount Range', desc: 'Requested amount must be within the product\'s minimum and maximum' },
          { check: 'Loan Term', desc: 'Requested term in months must fall within the product\'s allowed range' },
          { check: 'Shares Coverage', desc: 'Shares balance × product multiplier must cover the requested amount' },
          { check: 'Minimum Shares', desc: 'Shares balance must meet the product\'s minimum shares requirement' },
          { check: 'Active Loans', desc: 'If the product disallows multiple loans, no active loan on the same product may exist' },
          { check: 'Good Standing', desc: 'No overdue repayments on any existing disbursed loan' },
          { check: 'Collateral Coverage', desc: 'Declared security value must meet the product\'s LTV requirement' },
        ].map(r => (
          <div key={r.check} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{r.check}</span>
            <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">Reading the Results</h3>
      <FeatureList items={[
        'Green banner: client meets all checked criteria — "Likely Eligible"',
        'Red banner: one or more criteria failed — "Not Currently Eligible"',
        'Each check shows Pass / Fail with a plain-English explanation',
        'Blue info badges mark checks that were skipped for prospects (will be verified at application)',
        'Member/Prospect Snapshot card shows the balances used for the calculation',
        'Estimated Costs card (shown when eligible) displays monthly payment, total repayable, and itemised fees',
        'Prospect results carry a "Prospect estimate" label to distinguish them from a formal eligibility determination',
      ]} />

      <Tip><strong>Permissions required:</strong> Any staff role with <code>loans:read</code> or <code>loans:write</code> permission can use the Eligibility Checker. It is found under <strong>Loans → Eligibility Checker</strong> in the sidebar.</Tip>
      <Warning>The Eligibility Checker provides an estimate only. Final loan approval follows the full application process including credit review, document verification, and officer approval.</Warning>
    </SectionWrapper>
  );
}

function CollateralSection() {
  return (
    <SectionWrapper title="Collateral Management" icon={Package}>
      <p className="text-gray-600">Collateral Management lets you record, track, and value the assets pledged as security against loans. Each item is linked to a loan application and monitored through its lifecycle from pledge to release or liquidation.</p>

      <h3 className="font-semibold text-gray-900">Key Concepts</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard title="Collateral Types">
          Asset categories your organization accepts as security (e.g., Motor Vehicle, Land Title, Machinery, Listed Shares). Types carry a default LTV ratio and depreciation schedule. Owners can create and edit types in Settings.
        </InfoCard>
        <InfoCard title="Collateral Items">
          Individual assets pledged against a specific loan. Each item records the asset description, type, current valuation, valuer, insurance policy, and status.
        </InfoCard>
        <InfoCard title="Valuations">
          Periodic revaluations are recorded with date, amount, valuer name, and supporting documents. The system tracks whether each loan's collateral coverage meets the product's required LTV threshold.
        </InfoCard>
        <InfoCard title="Insurance">
          Insurance policies on pledged assets are tracked with insurer name, policy number, cover amount, premium, and expiry date. Expiring policies trigger alerts.
        </InfoCard>
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">Adding a Collateral Item</h3>
      <div className="space-y-4">
        <Step n={1} title="Open the Loan">
          <p>Navigate to the loan application and open its Collateral tab, or go to <strong>Loans → Collateral</strong> in the sidebar.</p>
        </Step>
        <Step n={2} title="Add Item">
          <p>Click <strong>Add Collateral</strong>. Select the collateral type, enter the asset description, current value, valuation date, and the name of the valuer.</p>
        </Step>
        <Step n={3} title="Attach Insurance (Optional)">
          <p>Add an insurance policy by entering the insurer, policy number, cover amount, premium, start date, and expiry date.</p>
        </Step>
        <Step n={4} title="Save">
          <p>The item is linked to the loan. The system immediately checks whether total collateral coverage meets the product's LTV requirement and flags the loan as collateral-deficient if not.</p>
        </Step>
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">Collateral Lifecycle Statuses</h3>
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { status: 'Pledged', desc: 'Asset is actively securing the loan' },
          { status: 'Under Lien', desc: 'A legal hold has been placed on the asset' },
          { status: 'Released', desc: 'Asset returned to client after loan repayment' },
          { status: 'Liquidated', desc: 'Asset sold to recover loan funds after default' },
          { status: 'Deficient', desc: 'Loan is flagged because collateral value has fallen below the required LTV' },
        ].map(s => (
          <div key={s.status} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{s.status}</span>
            <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">Recording a Revaluation</h3>
      <FeatureList items={[
        'Open the collateral item and click Revalue / Record Valuation',
        'Enter the new market value, valuation date, and valuer name',
        'Optionally attach a valuation document',
        'The system recalculates LTV coverage and updates the loan\'s collateral-deficient flag automatically',
        'If the loan drops below the required LTV, a notification is created for loan officers',
      ]} />

      <h3 className="font-semibold text-gray-900 mt-4">Placing and Releasing Liens</h3>
      <FeatureList items={[
        'Place Lien: legally freezes the asset — status changes to "Under Lien"',
        'Release: returns the asset to the client — status changes to "Released"',
        'Both actions are logged in the audit trail with the acting staff member and timestamp',
      ]} />

      <Tip><strong>Permissions required:</strong> Viewing collateral requires <code>collateral:read</code>. Adding, editing, and releasing collateral requires <code>collateral:write</code>. These permissions are assigned through Roles & Permissions in Settings.</Tip>
    </SectionWrapper>
  );
}

function CRMSection() {
  return (
    <SectionWrapper title="CRM & Contact Management" icon={PhoneCall}>
      <p className="text-gray-600">The CRM (Customer Relationship Management) module helps your team manage leads, prospects, and client interactions in one place. Track contacts from first enquiry through to member conversion, log every interaction, and schedule follow-ups so no opportunity slips through.</p>

      <h3 className="font-semibold text-gray-900">Core Concepts</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard title="Contacts">
          Individuals or businesses who have expressed interest or are in conversation with your institution. A contact is not yet a member — they exist in the CRM pipeline until they are formally registered.
        </InfoCard>
        <InfoCard title="Interactions">
          Logged touchpoints with a contact: calls, emails, walk-ins, WhatsApp messages, etc. Each interaction records the type, notes, and the staff member responsible.
        </InfoCard>
        <InfoCard title="Follow-ups">
          Scheduled reminders to reconnect with a contact. Set a date, time, and brief note. Overdue follow-ups are highlighted to prevent them being missed.
        </InfoCard>
        <InfoCard title="Pipeline Stats">
          The CRM dashboard shows summary statistics: total contacts, hot leads, follow-ups due today, conversions this month, and staff performance.
        </InfoCard>
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">Adding a Contact</h3>
      <div className="space-y-4">
        <Step n={1} title="Go to CRM">
          <p>Click <strong>CRM</strong> in the sidebar. You'll see the contact list and summary stats at the top.</p>
        </Step>
        <Step n={2} title="Add New Contact">
          <p>Click <strong>Add Contact</strong>. Enter the contact's name, phone number, email, and any notes. Assign the contact to a staff member and set their pipeline status.</p>
        </Step>
        <Step n={3} title="Pipeline Status">
          <p>Set the contact's stage in the pipeline: <strong>New Lead</strong>, <strong>In Conversation</strong>, <strong>Hot Lead</strong>, <strong>Cold</strong>, or <strong>Converted</strong>. Update this as the relationship progresses.</p>
        </Step>
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">Logging an Interaction</h3>
      <FeatureList items={[
        'Open a contact record and click Add Interaction',
        'Select the interaction type: Call, Email, Meeting, Walk-in, WhatsApp, Other',
        'Write notes summarizing what was discussed or agreed',
        'The interaction is timestamped and attributed to the logged-in staff member',
        'All interactions appear in the contact\'s timeline in reverse chronological order',
      ]} />

      <h3 className="font-semibold text-gray-900 mt-4">Scheduling a Follow-up</h3>
      <FeatureList items={[
        'Open a contact record and click Add Follow-up',
        'Set the follow-up date and time and write a brief reminder note',
        'Follow-ups due today are highlighted on the CRM dashboard',
        'Mark a follow-up as complete once the action is taken',
        'Overdue follow-ups are flagged in red to prompt action',
      ]} />

      <h3 className="font-semibold text-gray-900 mt-4">Converting a Contact to a Member</h3>
      <div className="space-y-4">
        <Step n={1} title="Open the Contact">
          <p>Navigate to the contact record of the prospect you want to convert.</p>
        </Step>
        <Step n={2} title="Click Convert to Member">
          <p>Click the <strong>Convert to Member</strong> button. The system pre-fills the member registration form with the contact's existing details.</p>
        </Step>
        <Step n={3} title="Complete Registration">
          <p>Fill in any missing required fields (ID number, branch, date of birth, etc.) and save. The contact status is automatically updated to <strong>Converted</strong> and linked to the new member record.</p>
        </Step>
      </div>

      <h3 className="font-semibold text-gray-900 mt-4">Contact Pipeline Statuses</h3>
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { status: 'New Lead', desc: 'Initial enquiry received, not yet engaged' },
          { status: 'In Conversation', desc: 'Active dialogue ongoing' },
          { status: 'Hot Lead', desc: 'Strong interest shown — prioritize follow-up' },
          { status: 'Cold', desc: 'Interest has stalled or gone quiet' },
          { status: 'Converted', desc: 'Successfully registered as a member' },
        ].map(s => (
          <div key={s.status} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{s.status}</span>
            <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
          </div>
        ))}
      </div>

      <Tip><strong>Permissions required:</strong> Viewing CRM contacts requires <code>crm:read</code>. Adding, editing, and converting contacts requires <code>crm:write</code>. These permissions are assigned through Roles & Permissions in Settings.</Tip>
    </SectionWrapper>
  );
}

function SectionContent({ sectionId }: { sectionId: SectionId }) {
  const sections: Record<SectionId, () => JSX.Element> = {
    'getting-started': GettingStartedSection,
    'registration': RegistrationSection,
    'login': LoginSection,
    'password-reset': PasswordResetSection,
    'email-verification': EmailVerificationSection,
    'org-creation': OrgCreationSection,
    'onboarding-wizard': OnboardingWizardSection,
    'dashboard': DashboardSection,
    'notifications': NotificationsSection,
    'branches': BranchesSection,
    'staff': StaffSection,
    'roles': RolesSection,
    'members': MembersSection,
    'member-statements': MemberStatementsSection,
    'loan-products': LoanProductsSection,
    'loan-applications': LoanApplicationsSection,
    'guarantors': GuarantorsSection,
    'loan-restructuring': LoanRestructuringSection,
    'repayments': RepaymentsSection,
    'defaults-collections': DefaultsSection,
    'transactions': TransactionsSection,
    'teller-station': TellerStationSection,
    'teller-services': TellerServicesSection,
    'float-management': FloatManagementSection,
    'queue-kiosk': QueueKioskSection,
    'queue-display': QueueDisplaySection,
    'fixed-deposits': FixedDepositsSection,
    'dividends': DividendsSection,
    'chart-of-accounts': ChartOfAccountsSection,
    'journal-entries': JournalEntriesSection,
    'opening-balances': OpeningBalancesSection,
    'reports': ReportsSection,
    'analytics': AnalyticsSection,
    'csv-export': CSVExportSection,
    'sms': SMSSection,
    'hr': HRSection,
    'attendance': AttendanceSection,
    'payroll': PayrollSection,
    'leave': LeaveSection,
    'expenses': ExpensesSection,
    'audit-logs': AuditLogsSection,
    'mpesa': MpesaSection,
    'settings-general': SettingsGeneralSection,
    'settings-loans': SettingsLoansSection,
    'settings-sms': SettingsSMSSection,
    'settings-email': SettingsEmailSection,
    'settings-mpesa': SettingsMpesaSection,
    'settings-hours': SettingsHoursSection,
    'settings-roles': SettingsRolesSection,
    'settings-usage': SettingsUsageSection,
    'settings-danger': SettingsDangerSection,
    'my-account': MyAccountSection,
    'subscriptions': SubscriptionsSection,
    'trial-system': TrialSystemSection,
    'collateral': CollateralSection,
    'loan-eligibility': LoanEligibilitySection,
    'crm': CRMSection,
  };
  const Component = sections[sectionId];
  return Component ? <Component /> : null;
}

const subscriptionSectionIds: SectionId[] = ['subscriptions', 'trial-system', 'settings-usage'];

export default function ManualPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showSubscriptionContent, setShowSubscriptionContent] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/public/landing-settings')
      .then(res => res.json())
      .then(data => {
        if (data.show_subscription_content === 'false') {
          setShowSubscriptionContent(false);
        }
      })
      .catch(() => {});
  }, []);

  const handleSectionChange = (sectionId: SectionId) => {
    setActiveSection(sectionId);
    setSearchQuery('');
    setMobileNavOpen(false);
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const visibleGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item =>
        showSubscriptionContent || !subscriptionSectionIds.includes(item.id)
      ),
    }))
    .filter(group => group.items.length > 0);

  const filteredGroups = searchQuery.trim()
    ? visibleGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter(group => group.items.length > 0)
    : visibleGroups;

  const allItems = visibleGroups.flatMap(g => g.items);

  useEffect(() => {
    if (!showSubscriptionContent && subscriptionSectionIds.includes(activeSection)) {
      setActiveSection('getting-started');
    }
  }, [showSubscriptionContent, activeSection]);

  const currentIndex = allItems.findIndex(i => i.id === activeSection);
  const prev = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const next = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;
  const totalSections = allItems.length;

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            <BookOpen className="w-4 h-4" />
            Complete User Manual
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3" data-testid="text-manual-title">
            System User Manual
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Step-by-step guide to every feature. {totalSections} topics covering everything from registration to advanced accounting.
          </p>
        </div>

        <div className="flex gap-8">
          <nav className="hidden lg:block w-64 flex-shrink-0" data-testid="nav-manual-sidebar">
            <div className="sticky top-24 space-y-1 max-h-[calc(100vh-120px)] overflow-y-auto pr-2 pb-8">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  data-testid="input-manual-search"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {filteredGroups.map(group => (
                <div key={group.label} className="mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 px-3">{group.label}</p>
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSectionChange(item.id)}
                      data-testid={`button-nav-${item.id}`}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition flex items-center gap-2 ${
                        activeSection === item.id
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0" ref={contentRef} style={{ scrollMarginTop: '100px' }}>
            <div className="lg:hidden mb-6 space-y-3">
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                data-testid="button-mobile-nav-toggle"
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white"
              >
                <span className="flex items-center gap-2">
                  {(() => { const item = allItems.find(i => i.id === activeSection); return item ? <><item.icon className="w-4 h-4" />{item.label}</> : null; })()}
                </span>
                <ChevronRight className={`w-4 h-4 transition ${mobileNavOpen ? 'rotate-90' : ''}`} />
              </button>
              {mobileNavOpen && (
                <div className="border border-gray-200 rounded-lg bg-white p-3 max-h-80 overflow-y-auto">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search topics..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      data-testid="input-mobile-manual-search"
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {filteredGroups.map(group => (
                    <div key={group.label} className="mb-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 px-2">{group.label}</p>
                      {group.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleSectionChange(item.id)}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                            activeSection === item.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600'
                          }`}
                        >
                          <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <SectionContent sectionId={activeSection} />

            <div className="flex justify-between mt-8 gap-4">
              {prev ? (
                <button
                  onClick={() => handleSectionChange(prev.id)}
                  data-testid="button-prev-section"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition min-w-0"
                >
                  <ChevronRight className="w-4 h-4 rotate-180 flex-shrink-0" />
                  <span className="truncate">{prev.label}</span>
                </button>
              ) : <div />}
              {next ? (
                <button
                  onClick={() => handleSectionChange(next.id)}
                  data-testid="button-next-section"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition min-w-0"
                >
                  <span className="truncate">{next.label}</span>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                </button>
              ) : <div />}
            </div>

            <div className="mt-6 text-center text-xs text-gray-400">
              Section {currentIndex + 1} of {totalSections}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
