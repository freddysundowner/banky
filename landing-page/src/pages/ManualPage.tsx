import { useState, useRef } from 'react';
import {
  BookOpen, Users, Building2, Banknote, CreditCard, FileText, Wallet,
  Receipt, PiggyBank, BarChart3, MessageSquare, Shield, Settings,
  ChevronRight, Search, UserCog, ScrollText, Calendar, AlertTriangle,
  Clock, ArrowRight, CheckCircle, HardDrive, Landmark, Layers
} from 'lucide-react';

type SectionId =
  | 'getting-started'
  | 'dashboard'
  | 'branches'
  | 'staff'
  | 'roles'
  | 'members'
  | 'loan-products'
  | 'loan-applications'
  | 'repayments'
  | 'transactions'
  | 'teller-station'
  | 'float-management'
  | 'queue-system'
  | 'fixed-deposits'
  | 'dividends'
  | 'chart-of-accounts'
  | 'journal-entries'
  | 'opening-balances'
  | 'reports'
  | 'analytics'
  | 'sms'
  | 'defaults-collections'
  | 'hr'
  | 'leave'
  | 'expenses'
  | 'audit-logs'
  | 'mpesa'
  | 'settings'
  | 'my-account';

interface NavGroup {
  label: string;
  items: { id: SectionId; label: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Getting Started',
    items: [
      { id: 'getting-started', label: 'First Steps', icon: BookOpen },
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    ],
  },
  {
    label: 'Organization',
    items: [
      { id: 'branches', label: 'Branches', icon: Building2 },
      { id: 'staff', label: 'Staff', icon: UserCog },
      { id: 'roles', label: 'Roles & Permissions', icon: Shield },
      { id: 'members', label: 'Members', icon: Users },
    ],
  },
  {
    label: 'Loans',
    items: [
      { id: 'loan-products', label: 'Loan Products', icon: CreditCard },
      { id: 'loan-applications', label: 'Loan Applications', icon: FileText },
      { id: 'repayments', label: 'Repayments', icon: Receipt },
      { id: 'defaults-collections', label: 'Defaults & Collections', icon: AlertTriangle },
    ],
  },
  {
    label: 'Transactions & Teller',
    items: [
      { id: 'transactions', label: 'Transactions', icon: Wallet },
      { id: 'teller-station', label: 'Teller Station', icon: Banknote },
      { id: 'float-management', label: 'Float Management', icon: HardDrive },
      { id: 'queue-system', label: 'Queue System', icon: Clock },
    ],
  },
  {
    label: 'Savings & Investments',
    items: [
      { id: 'fixed-deposits', label: 'Fixed Deposits', icon: PiggyBank },
      { id: 'dividends', label: 'Dividends', icon: Wallet },
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
    label: 'Reports & Analytics',
    items: [
      { id: 'reports', label: 'Reports', icon: FileText },
      { id: 'analytics', label: 'Analytics Dashboard', icon: BarChart3 },
    ],
  },
  {
    label: 'Communication',
    items: [
      { id: 'sms', label: 'SMS Notifications', icon: MessageSquare },
    ],
  },
  {
    label: 'HR & Operations',
    items: [
      { id: 'hr', label: 'HR Management', icon: Users },
      { id: 'leave', label: 'Leave Management', icon: Calendar },
      { id: 'expenses', label: 'Expenses', icon: Receipt },
      { id: 'audit-logs', label: 'Audit Logs', icon: ScrollText },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { id: 'mpesa', label: 'M-Pesa Setup', icon: Banknote },
      { id: 'settings', label: 'Organization Settings', icon: Settings },
      { id: 'my-account', label: 'My Account', icon: UserCog },
    ],
  },
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">{n}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
        <div className="text-gray-600 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm">{children}</div>;
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function SectionWrapper({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <Icon className="w-7 h-7 text-purple-600" />
          {title}
        </h2>
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}

function GettingStartedSection() {
  return (
    <SectionWrapper title="Getting Started" icon={BookOpen}>
      <p className="text-gray-600">After logging in for the first time, you'll be guided through setting up your organization. Here's the recommended order to get everything running.</p>
      <div className="space-y-6">
        <Step n={1} title="Create Your Organization">
          <p>After registration, you'll be prompted to create your organization. Enter your organization name, choose your currency, and set your country. This creates your isolated workspace where all your data will live.</p>
        </Step>
        <Step n={2} title="Set Up Your First Branch">
          <p>The onboarding wizard will ask you to create your first branch. Enter the branch name, location, and contact details. Every member, transaction, and staff member is associated with a branch.</p>
        </Step>
        <Step n={3} title="Add Staff Members">
          <p>Go to <strong>Staff</strong> in the sidebar and add your team. Assign each person a role (Owner, Admin, Manager, Teller, Loan Officer, or a custom role) that determines what they can see and do in the system.</p>
        </Step>
        <Step n={4} title="Configure Loan Products">
          <p>Go to <strong>Loan Products</strong> and create the loan types your organization offers. Set interest rates, repayment frequencies, fees, and eligibility rules. These products are templates used when members apply for loans.</p>
        </Step>
        <Step n={5} title="Register Members">
          <p>Go to <strong>Members</strong> and start adding your members. Enter their personal details, ID numbers, contact information, and next of kin. Members can then apply for loans, make deposits, and access all services.</p>
        </Step>
        <Step n={6} title="Configure Settings">
          <p>Go to <strong>Settings</strong> to set up SMS notifications, M-Pesa integration, email settings, business hours, and other organization-wide preferences.</p>
        </Step>
      </div>
      <Tip>
        <strong>Quick start:</strong> At minimum, you need one branch, one staff member (yourself as owner), and at least one member to start processing transactions and loans.
      </Tip>
    </SectionWrapper>
  );
}

function DashboardSection() {
  return (
    <SectionWrapper title="Dashboard" icon={BarChart3}>
      <p className="text-gray-600">The dashboard is your overview of the entire organization at a glance. It loads automatically when you log in.</p>
      <h3 className="font-semibold text-gray-900">What You'll See</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Membership</h4>
          <FeatureList items={['Total members', 'Total staff', 'Number of branches']} />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Loans Overview</h4>
          <FeatureList items={['Total loans by status (pending, approved, disbursed)', 'Total amount disbursed', 'Outstanding balance', 'Default count']} />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Savings</h4>
          <FeatureList items={['Total savings balance across all members', 'Total shares value']} />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Performance</h4>
          <FeatureList items={['Collection rate percentage', 'Total repaid amount']} />
        </div>
      </div>
      <Tip><strong>Refresh:</strong> Click the refresh button at the top right of the dashboard to load the latest figures.</Tip>
    </SectionWrapper>
  );
}

function BranchesSection() {
  return (
    <SectionWrapper title="Branch Management" icon={Building2}>
      <p className="text-gray-600">Branches represent physical locations or operational units within your organization. All members, staff, and transactions are linked to a specific branch.</p>
      <h3 className="font-semibold text-gray-900">How to Manage Branches</h3>
      <div className="space-y-4">
        <Step n={1} title="Create a Branch">
          <p>Click <strong>Add Branch</strong>, enter the branch name, location/address, phone number, and email. The branch code is generated automatically.</p>
        </Step>
        <Step n={2} title="Edit a Branch">
          <p>Click on any branch in the list to edit its details. You can update the name, location, and contact information at any time.</p>
        </Step>
        <Step n={3} title="Delete a Branch">
          <p>Branches can only be deleted if they have no members or staff assigned to them. Reassign members and staff to another branch before deleting.</p>
        </Step>
      </div>
      <Tip><strong>Plan limits:</strong> The number of branches you can create depends on your subscription plan or license edition.</Tip>
    </SectionWrapper>
  );
}

function StaffSection() {
  return (
    <SectionWrapper title="Staff Management" icon={UserCog}>
      <p className="text-gray-600">Staff are the people who use BANKY to manage your organization -- administrators, tellers, loan officers, and managers.</p>
      <h3 className="font-semibold text-gray-900">Adding Staff</h3>
      <div className="space-y-4">
        <Step n={1} title="Create a Staff Account">
          <p>Click <strong>Add Staff</strong>. Enter their full name, email address, phone number, and assign them to a branch. Choose their role (which determines permissions).</p>
        </Step>
        <Step n={2} title="Set Login Credentials">
          <p>Set a temporary password for the staff member. They can change it after their first login from <strong>My Account</strong>.</p>
        </Step>
        <Step n={3} title="Manage Staff">
          <p>You can edit staff details, change their role or branch, suspend their account (prevents login), or delete the account entirely.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Built-in Roles</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {[
          { role: 'Owner', desc: 'Full access to everything. Can manage subscriptions and delete the organization.' },
          { role: 'Admin', desc: 'Full access except billing and organization deletion.' },
          { role: 'Manager', desc: 'Can manage members, staff, loans, and transactions within their branch.' },
          { role: 'Teller', desc: 'Can process transactions, deposits, withdrawals, and serve queue tickets.' },
          { role: 'Loan Officer', desc: 'Can manage loan applications, approvals, and repayments.' },
          { role: 'Viewer', desc: 'Read-only access to dashboards and reports.' },
        ].map(r => (
          <div key={r.role} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{r.role}:</span>{' '}
            <span className="text-sm text-gray-600">{r.desc}</span>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}

function RolesSection() {
  return (
    <SectionWrapper title="Roles & Permissions" icon={Shield}>
      <p className="text-gray-600">Roles control what each staff member can see and do. Beyond the built-in roles, you can create custom roles with specific permissions.</p>
      <h3 className="font-semibold text-gray-900">How Permissions Work</h3>
      <p className="text-gray-600 text-sm">Each feature in the system has permission levels: <strong>Read</strong> (view data), <strong>Write</strong> (create and edit), and sometimes <strong>Approve</strong> (for sensitive actions like loan approval). A role is a set of these permission combinations.</p>
      <h3 className="font-semibold text-gray-900 mt-4">Creating a Custom Role</h3>
      <div className="space-y-4">
        <Step n={1} title="Navigate to Settings > Roles">
          <p>Open <strong>Settings</strong> from the sidebar, then click the <strong>Roles</strong> tab.</p>
        </Step>
        <Step n={2} title="Create New Role">
          <p>Click <strong>Add Role</strong>, give it a name (e.g., "Senior Teller"), and toggle on/off permissions for each module -- Members, Loans, Transactions, Reports, etc.</p>
        </Step>
        <Step n={3} title="Assign to Staff">
          <p>When creating or editing a staff member, select your custom role from the role dropdown.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Permission Categories</h3>
      <FeatureList items={[
        'Dashboard, Members, Branches, Staff',
        'Loan Products, Loans, Repayments, Defaults',
        'Transactions, Teller Station, Float Management',
        'Fixed Deposits, Dividends',
        'Chart of Accounts, Journal Entries',
        'Reports, Analytics, SMS, Audit Logs',
        'HR, Leave, Expenses, Settings',
      ]} />
    </SectionWrapper>
  );
}

function MembersSection() {
  return (
    <SectionWrapper title="Member Management" icon={Users}>
      <p className="text-gray-600">Members are the customers of your organization -- the people who save, borrow, and transact through your institution.</p>
      <h3 className="font-semibold text-gray-900">Registering a Member</h3>
      <div className="space-y-4">
        <Step n={1} title="Click Add Member">
          <p>From the Members page, click <strong>Add Member</strong>.</p>
        </Step>
        <Step n={2} title="Fill in Personal Details">
          <p>Enter their full name, National ID number, phone number, email, date of birth, gender, occupation, and employer.</p>
        </Step>
        <Step n={3} title="Assign to a Branch">
          <p>Select which branch this member belongs to.</p>
        </Step>
        <Step n={4} title="Add Next of Kin">
          <p>Enter the name, phone number, and relationship of their next of kin (emergency contact).</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Managing Members</h3>
      <FeatureList items={[
        'Edit profile: Update any personal or contact information',
        'Activate / Suspend: Control whether a member can transact',
        'View statement: See a full history of deposits, withdrawals, loans, and repayments',
        'Upload documents: Attach ID copies, photos, or other files to the member record',
        'Export: Download the full member list as a CSV file',
        'Delete: Remove a member record (only if no active loans or balances)',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-6">Member Statement</h3>
      <p className="text-gray-600 text-sm">Click on any member to view their full statement. This shows every transaction (deposits, withdrawals, fees), every loan (with status and balance), and running balances for savings and shares accounts.</p>
    </SectionWrapper>
  );
}

function LoanProductsSection() {
  return (
    <SectionWrapper title="Loan Products" icon={CreditCard}>
      <p className="text-gray-600">Loan products are the templates that define the terms and conditions for each type of loan your organization offers. You must create at least one product before members can apply for loans.</p>
      <h3 className="font-semibold text-gray-900">Creating a Loan Product</h3>
      <div className="space-y-4">
        <Step n={1} title="Basic Information">
          <p>Enter the product name (e.g., "Emergency Loan", "Development Loan"), description, and select the interest calculation method: <strong>Flat Rate</strong> (interest on original amount) or <strong>Reducing Balance</strong> (interest on remaining principal).</p>
        </Step>
        <Step n={2} title="Interest & Terms">
          <p>Set the annual interest rate, repayment frequency (daily, weekly, bi-weekly, monthly), and the minimum/maximum loan amount and term (in months).</p>
        </Step>
        <Step n={3} title="Fees & Insurance">
          <p>Configure optional processing fee (percentage of loan amount) and insurance rate (charged upfront or spread across instalments).</p>
        </Step>
        <Step n={4} title="Eligibility Rules">
          <p>Set the <strong>shares multiplier</strong> (e.g., 3x means a member can borrow up to 3 times their shares balance). Toggle whether multiple active loans of this product are allowed, and whether borrowers must be in good standing (no overdue instalments on other loans).</p>
        </Step>
        <Step n={5} title="Guarantor Requirements">
          <p>Set the minimum number of guarantors required and the maximum amount each guarantor can cover.</p>
        </Step>
      </div>
      <Tip><strong>Preview:</strong> When creating a product, the form shows a real-time preview of what a sample loan would look like -- monthly instalment amount, total repayment, and total interest.</Tip>
    </SectionWrapper>
  );
}

function LoanApplicationsSection() {
  return (
    <SectionWrapper title="Loan Applications" icon={FileText}>
      <p className="text-gray-600">This is where you process member loan requests from application through to disbursement.</p>
      <h3 className="font-semibold text-gray-900">Loan Lifecycle</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {['Pending', 'Approved', 'Disbursed', 'Fully Repaid', 'Defaulted', 'Rejected', 'Restructured'].map(status => (
          <span key={status} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">{status}</span>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900">Processing a Loan</h3>
      <div className="space-y-4">
        <Step n={1} title="Create Application">
          <p>Click <strong>New Loan</strong>. Select the member, choose a loan product, enter the amount and term (months), purpose, and repayment start date. The system validates against the product's min/max limits and the member's eligibility.</p>
        </Step>
        <Step n={2} title="Add Guarantors (if required)">
          <p>If the loan product requires guarantors, search for and add other members as guarantors. Each guarantor must have sufficient shares to cover their guaranteed amount.</p>
        </Step>
        <Step n={3} title="Approve or Reject">
          <p>Review the application details and instalment schedule. Click <strong>Approve</strong> to move the loan forward, or <strong>Reject</strong> with a reason.</p>
        </Step>
        <Step n={4} title="Disburse">
          <p>After approval, click <strong>Disburse</strong> to release the funds. Choose the disbursement method (cash, bank transfer, M-Pesa, or credit to savings). The system generates the full repayment schedule with due dates.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Instalment Schedule</h3>
      <p className="text-gray-600 text-sm">Each disbursed loan shows a detailed schedule with: instalment number, due date, principal portion, interest portion, total amount due, amount paid, balance, and status (paid/overdue/upcoming).</p>
      <h3 className="font-semibold text-gray-900 mt-6">Loan Restructuring</h3>
      <p className="text-gray-600 text-sm">If a borrower is struggling to repay, you can restructure the loan by modifying the interest rate, extending the term, or adjusting the outstanding balance. This creates a new repayment schedule while preserving the original loan history.</p>
      <h3 className="font-semibold text-gray-900 mt-6">Export</h3>
      <p className="text-gray-600 text-sm">Download the full loan list as a CSV file by clicking the <strong>Export</strong> button.</p>
    </SectionWrapper>
  );
}

function RepaymentsSection() {
  return (
    <SectionWrapper title="Repayments" icon={Receipt}>
      <p className="text-gray-600">Track and record loan repayments from members. Repayments are allocated to the oldest overdue instalments first.</p>
      <h3 className="font-semibold text-gray-900">Recording a Repayment</h3>
      <div className="space-y-4">
        <Step n={1} title="Select the Loan">
          <p>From the Repayments page, find the loan by member name or loan number.</p>
        </Step>
        <Step n={2} title="Enter Payment Details">
          <p>Enter the amount, payment method (cash, M-Pesa, bank transfer), and reference number. The system shows how the payment will be allocated across instalments.</p>
        </Step>
        <Step n={3} title="Submit">
          <p>The repayment is recorded and the instalment schedule is updated. If the full loan is paid off, its status changes to <strong>Fully Repaid</strong>.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Auto-Deduction</h3>
      <p className="text-gray-600 text-sm">Enable automatic loan deductions from member savings. When configured, the system automatically deducts the instalment amount from the member's savings account on the due date. This can be triggered manually from Settings or runs automatically via the scheduled cron job.</p>
    </SectionWrapper>
  );
}

function DefaultsSection() {
  return (
    <SectionWrapper title="Defaults & Collections" icon={AlertTriangle}>
      <p className="text-gray-600">Monitor overdue loans and manage collection activities. This module helps you track which loans are in arrears and take action.</p>
      <h3 className="font-semibold text-gray-900">What You'll See</h3>
      <FeatureList items={[
        'List of all loans with overdue instalments',
        'Days past due for each loan',
        'Total arrears amount',
        'Member contact information for follow-up',
        'Loan status indicators (overdue, defaulted)',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Actions</h3>
      <FeatureList items={[
        'Contact the member via SMS directly from the list',
        'Mark a loan as defaulted if recovery is unlikely',
        'Restructure the loan to create manageable new terms',
        'Record partial repayments',
      ]} />
    </SectionWrapper>
  );
}

function TransactionsSection() {
  return (
    <SectionWrapper title="Transactions" icon={Wallet}>
      <p className="text-gray-600">Record all financial movements -- deposits, withdrawals, transfers, and fees -- for member accounts.</p>
      <h3 className="font-semibold text-gray-900">Transaction Types</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {[
          { type: 'Deposit', desc: 'Add funds to a member\'s savings or shares account' },
          { type: 'Withdrawal', desc: 'Member withdraws from their savings account' },
          { type: 'Transfer', desc: 'Move funds between a member\'s accounts (savings to shares, etc.)' },
          { type: 'Fee', desc: 'Charge a service fee to a member\'s account' },
        ].map(t => (
          <div key={t.type} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{t.type}:</span>{' '}
            <span className="text-sm text-gray-600">{t.desc}</span>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Processing a Transaction</h3>
      <div className="space-y-4">
        <Step n={1} title="Select the Member">
          <p>Search by name, member number, or phone number.</p>
        </Step>
        <Step n={2} title="Choose Transaction Type">
          <p>Select deposit, withdrawal, transfer, or fee. Choose the account (savings or shares).</p>
        </Step>
        <Step n={3} title="Enter Details">
          <p>Enter the amount, payment method (cash, M-Pesa, cheque, bank transfer), and an optional reference number or note.</p>
        </Step>
        <Step n={4} title="Submit">
          <p>The transaction is recorded and the member's balance is updated immediately.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Export</h3>
      <p className="text-gray-600 text-sm">Download all transactions as a CSV file using the <strong>Export</strong> button. Filter by date range, member, or transaction type before exporting.</p>
    </SectionWrapper>
  );
}

function TellerStationSection() {
  return (
    <SectionWrapper title="Teller Station" icon={Banknote}>
      <p className="text-gray-600">The Teller Station is the front-desk interface designed for tellers serving members at the counter. It combines transaction processing with queue management for fast, efficient service.</p>
      <h3 className="font-semibold text-gray-900">How It Works</h3>
      <div className="space-y-4">
        <Step n={1} title="Call Next Customer">
          <p>When a member arrives, click <strong>Call Next</strong> to pull the next ticket from the queue. The member's details and account summary load automatically.</p>
        </Step>
        <Step n={2} title="Process Services">
          <p>From the teller interface, you can process deposits, withdrawals, loan repayments, cheque deposits, and bank transfers -- all without leaving the page.</p>
        </Step>
        <Step n={3} title="Complete or Redirect">
          <p>When done, click <strong>Complete</strong> to close the ticket and move to the next customer. If the member needs a different service (e.g., loans), redirect them to the appropriate counter.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Teller Services</h3>
      <FeatureList items={[
        'Quick deposits and withdrawals',
        'Loan repayment processing',
        'Cheque deposit recording',
        'Bank transfer processing',
        'Member search and account lookup',
        'Real-time balance display',
      ]} />
    </SectionWrapper>
  );
}

function FloatManagementSection() {
  return (
    <SectionWrapper title="Float Management" icon={HardDrive}>
      <p className="text-gray-600">Float management tracks the physical cash that each teller holds during their shift. It ensures accountability and reconciliation at the end of every business day.</p>
      <h3 className="font-semibold text-gray-900">Daily Float Workflow</h3>
      <div className="space-y-4">
        <Step n={1} title="Open Float">
          <p>At the start of the day, the teller records their opening cash balance -- the amount received from the vault or carried over from the previous day.</p>
        </Step>
        <Step n={2} title="Process Transactions">
          <p>Throughout the day, deposits increase the float and withdrawals decrease it. The system tracks all movements automatically.</p>
        </Step>
        <Step n={3} title="Replenish or Return">
          <p>If the teller runs low on cash, they can request a <strong>replenishment</strong> from the vault. If they have excess cash, they <strong>return</strong> it to the vault.</p>
        </Step>
        <Step n={4} title="Physical Cash Count">
          <p>At the end of the day, the teller performs a physical cash count. Enter the actual amount in the till.</p>
        </Step>
        <Step n={5} title="Close Float">
          <p>The system compares the expected balance (opening + deposits - withdrawals) with the physical count. Any variance (shortage or excess) is recorded and may require manager approval.</p>
        </Step>
      </div>
      <Tip><strong>Approval PIN:</strong> Sensitive float operations like approving shortages require a manager's approval PIN for security.</Tip>
    </SectionWrapper>
  );
}

function QueueSystemSection() {
  return (
    <SectionWrapper title="Queue System" icon={Clock}>
      <p className="text-gray-600">The queue system manages customer flow in your branch. It includes a self-service kiosk for members and a display board for calling ticket numbers.</p>
      <h3 className="font-semibold text-gray-900">Components</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Ticketing Kiosk</h4>
          <p className="text-sm text-gray-600 mb-2">A self-service screen where members select the service they need:</p>
          <FeatureList items={['Transactions (deposits, withdrawals)', 'Loan inquiries', 'Account opening', 'General inquiries']} />
          <p className="text-sm text-gray-600 mt-2">After selecting, a numbered ticket is generated (e.g., T-001, L-002).</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Queue Display Board</h4>
          <p className="text-sm text-gray-600 mb-2">A screen visible in the banking hall showing:</p>
          <FeatureList items={['Currently serving ticket numbers', 'Which counter is serving which ticket', 'Audio announcements when tickets are called', 'Waiting count per service type']} />
        </div>
      </div>
      <Tip><strong>Setup:</strong> Open the Ticketing Kiosk on a tablet at the entrance and the Queue Display Board on a TV screen in the waiting area. Tellers call tickets from their Teller Station.</Tip>
    </SectionWrapper>
  );
}

function FixedDepositsSection() {
  return (
    <SectionWrapper title="Fixed Deposits" icon={PiggyBank}>
      <p className="text-gray-600">Fixed deposits are investment products where members lock in a sum of money for a set period at a guaranteed interest rate.</p>
      <h3 className="font-semibold text-gray-900">Setting Up Fixed Deposit Products</h3>
      <div className="space-y-4">
        <Step n={1} title="Create a Product">
          <p>Go to <strong>Fixed Deposits</strong> and create a product. Set the name, term (in months), annual interest rate, minimum deposit amount, and early withdrawal penalty percentage.</p>
        </Step>
        <Step n={2} title="Open a Member Deposit">
          <p>Select a member and the product. Enter the deposit amount. The system calculates the maturity date and expected interest automatically.</p>
        </Step>
        <Step n={3} title="At Maturity">
          <p>When the deposit matures, the system processes the payout -- the principal plus earned interest. Matured deposits can be processed automatically via the scheduled cron job or manually.</p>
        </Step>
      </div>
      <Tip><strong>Early withdrawal:</strong> If a member needs their money before the maturity date, the early withdrawal penalty (set on the product) is deducted from the interest earned.</Tip>
    </SectionWrapper>
  );
}

function DividendsSection() {
  return (
    <SectionWrapper title="Dividends" icon={Wallet}>
      <p className="text-gray-600">Distribute profits to members based on their shareholding. Dividends are typically declared annually at the end of the fiscal year.</p>
      <h3 className="font-semibold text-gray-900">Declaring Dividends</h3>
      <div className="space-y-4">
        <Step n={1} title="Create a Dividend Declaration">
          <p>Specify the fiscal year, the dividend rate (percentage), and the total amount available for distribution.</p>
        </Step>
        <Step n={2} title="Preview Distribution">
          <p>The system calculates each member's share based on their shares balance and the declared rate. Review the distribution before processing.</p>
        </Step>
        <Step n={3} title="Process Distribution">
          <p>Confirm the distribution. Each member's dividend is credited to their savings account (or other account as configured).</p>
        </Step>
      </div>
    </SectionWrapper>
  );
}

function ChartOfAccountsSection() {
  return (
    <SectionWrapper title="Chart of Accounts" icon={Layers}>
      <p className="text-gray-600">The Chart of Accounts is the foundation of the accounting system. It lists every financial account used to categorize your organization's income, expenses, assets, liabilities, and equity.</p>
      <h3 className="font-semibold text-gray-900">Account Types</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {[
          { type: 'Assets', desc: 'Cash, bank accounts, loans receivable, equipment' },
          { type: 'Liabilities', desc: 'Member savings, deposits payable, loans payable' },
          { type: 'Equity', desc: 'Share capital, retained earnings, reserves' },
          { type: 'Income', desc: 'Interest income, fees, commissions' },
          { type: 'Expenses', desc: 'Salaries, rent, utilities, stationery' },
        ].map(t => (
          <div key={t.type} className="bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">{t.type}:</span>{' '}
            <span className="text-sm text-gray-600">{t.desc}</span>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Managing Accounts</h3>
      <FeatureList items={[
        'Create accounts with a unique code, name, and type',
        'Organize accounts in a hierarchical structure (parent/child)',
        'View the current balance of any account',
        'Accounts used by the system (member savings, loans, etc.) are created automatically',
      ]} />
    </SectionWrapper>
  );
}

function JournalEntriesSection() {
  return (
    <SectionWrapper title="Journal Entries" icon={ScrollText}>
      <p className="text-gray-600">Journal entries record financial transactions in the double-entry bookkeeping system. Every entry must have equal debits and credits.</p>
      <h3 className="font-semibold text-gray-900">Creating a Journal Entry</h3>
      <div className="space-y-4">
        <Step n={1} title="Start a New Entry">
          <p>Click <strong>New Journal Entry</strong>. Enter the date, a reference number, and a description of the transaction.</p>
        </Step>
        <Step n={2} title="Add Debit and Credit Lines">
          <p>For each line, select an account from the Chart of Accounts and enter either a debit or credit amount. The total debits must equal total credits.</p>
        </Step>
        <Step n={3} title="Save as Draft or Post">
          <p><strong>Draft:</strong> Save for review later. <strong>Post:</strong> Finalize the entry and update account balances. Posted entries cannot be edited -- they can only be reversed.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Automatic Journal Entries</h3>
      <p className="text-gray-600 text-sm">The system automatically creates journal entries for: loan disbursements, repayments, member deposits/withdrawals, fee charges, payroll processing, and fixed deposit transactions. You don't need to manually record these.</p>
      <h3 className="font-semibold text-gray-900 mt-6">Reversals</h3>
      <p className="text-gray-600 text-sm">If a posted entry contains an error, click <strong>Reverse</strong> to create a new entry that cancels it out (debits become credits and vice versa).</p>
    </SectionWrapper>
  );
}

function OpeningBalancesSection() {
  return (
    <SectionWrapper title="Opening Balances" icon={Landmark}>
      <p className="text-gray-600">When migrating from another system or starting fresh, use opening balances to set the initial values of your accounts so your books match reality.</p>
      <h3 className="font-semibold text-gray-900">How to Set Opening Balances</h3>
      <div className="space-y-4">
        <Step n={1} title="Review Suggested Balances">
          <p>The system compares account balances from the General Ledger with sub-ledger totals (e.g., total member savings vs. the savings liability account). It suggests adjustments where there are discrepancies.</p>
        </Step>
        <Step n={2} title="Enter or Adjust">
          <p>Enter the correct opening balance for each account. The system creates the necessary journal entries to bring the accounts to the correct values.</p>
        </Step>
        <Step n={3} title="Post">
          <p>Once all balances are correct, post the opening balance entries. This should typically be done only once, at the very beginning.</p>
        </Step>
      </div>
    </SectionWrapper>
  );
}

function ReportsSection() {
  return (
    <SectionWrapper title="Reports" icon={FileText}>
      <p className="text-gray-600">Generate comprehensive financial and operational reports for your organization.</p>
      <h3 className="font-semibold text-gray-900">Available Reports</h3>
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { name: 'Trial Balance', desc: 'Lists all accounts with their debit and credit balances. Should always balance to zero.' },
          { name: 'Income Statement (P&L)', desc: 'Shows income minus expenses for a selected period. Tells you whether you are profitable.' },
          { name: 'Balance Sheet', desc: 'Snapshot of assets, liabilities, and equity at a specific date.' },
          { name: 'General Ledger', desc: 'Detailed transaction history for any account in the Chart of Accounts.' },
          { name: 'Loan Aging Report', desc: 'Breaks down outstanding loans by how many days past due (30, 60, 90, 180+ days).' },
          { name: 'Member Summary', desc: 'Overview of savings, shares, and loan balances per member.' },
        ].map(r => (
          <div key={r.name} className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-1">{r.name}</h4>
            <p className="text-sm text-gray-600">{r.desc}</p>
          </div>
        ))}
      </div>
      <Tip><strong>Date range:</strong> Most reports can be filtered by date range and branch. Select your dates before generating.</Tip>
    </SectionWrapper>
  );
}

function AnalyticsSection() {
  return (
    <SectionWrapper title="Analytics Dashboard" icon={BarChart3}>
      <p className="text-gray-600">Visual charts and trends that help you understand how your organization is performing over time.</p>
      <h3 className="font-semibold text-gray-900">Charts & Metrics</h3>
      <FeatureList items={[
        'Loan disbursement trends (monthly chart)',
        'Savings growth over time',
        'Repayment collection rates',
        'Default rate trends',
        'Member growth (new registrations per month)',
        'Transaction volume by type',
        'Branch-level performance comparisons',
        'Institution health score (composite metric based on savings, loan quality, and collections)',
      ]} />
    </SectionWrapper>
  );
}

function SMSSection() {
  return (
    <SectionWrapper title="SMS Notifications" icon={MessageSquare}>
      <p className="text-gray-600">Send SMS messages to members for transaction confirmations, loan updates, reminders, and custom communications.</p>
      <h3 className="font-semibold text-gray-900">Sending SMS</h3>
      <div className="space-y-4">
        <Step n={1} title="Single SMS">
          <p>Select a member and type your message. Click <strong>Send</strong> to deliver immediately.</p>
        </Step>
        <Step n={2} title="Bulk SMS">
          <p>Send the same message to multiple members at once. Select recipients by branch or choose specific members.</p>
        </Step>
        <Step n={3} title="SMS Templates">
          <p>Create reusable templates for common messages (e.g., payment reminders, welcome messages). Templates can include placeholders for member name, amount, and date.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Automatic SMS</h3>
      <p className="text-gray-600 text-sm">When enabled, the system automatically sends SMS for: deposits, withdrawals, loan disbursements, loan approvals, payment reminders (due and overdue), and repayment confirmations.</p>
      <h3 className="font-semibold text-gray-900 mt-6">Delivery Logs</h3>
      <p className="text-gray-600 text-sm">View the status of every SMS sent (delivered, pending, failed) along with the timestamp and recipient.</p>
      <Tip><strong>Setup:</strong> Configure your SMS gateway credentials (API key and sender ID) in <strong>Settings &gt; SMS</strong> before you can send messages.</Tip>
    </SectionWrapper>
  );
}

function HRSection() {
  return (
    <SectionWrapper title="HR Management" icon={Users}>
      <p className="text-gray-600">Manage your staff beyond just system access -- track attendance, process payroll, and maintain employee records.</p>
      <h3 className="font-semibold text-gray-900">Features</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Attendance</h4>
          <FeatureList items={[
            'Staff clock in and clock out from their dashboard',
            'Automatic calculation of hours worked',
            'Late arrival tracking',
            'Overtime calculation',
          ]} />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Payroll</h4>
          <FeatureList items={[
            'Process monthly payroll for all staff',
            'Calculate gross pay, deductions, and net pay',
            'Statutory deductions (PAYE, NHIF, NSSF)',
            'Automatic journal entries for payroll',
          ]} />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Training</h4>
          <FeatureList items={['Record training courses and certifications', 'Track completion and expiry dates']} />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Disciplinary</h4>
          <FeatureList items={['Log incidents and disciplinary actions', 'Track resolution and follow-up']} />
        </div>
      </div>
    </SectionWrapper>
  );
}

function LeaveSection() {
  return (
    <SectionWrapper title="Leave Management" icon={Calendar}>
      <p className="text-gray-600">Manage staff leave requests, approvals, and balance tracking.</p>
      <h3 className="font-semibold text-gray-900">Leave Workflow</h3>
      <div className="space-y-4">
        <Step n={1} title="Staff Submits Request">
          <p>The staff member selects the leave type (annual, sick, maternity, etc.), start date, end date, and adds any notes.</p>
        </Step>
        <Step n={2} title="Manager Reviews">
          <p>The request appears in the manager's leave queue. They can approve or reject with a reason.</p>
        </Step>
        <Step n={3} title="Leave Balance Updated">
          <p>On approval, the leave days are deducted from the staff member's available balance for that leave type.</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-4">Leave Types</h3>
      <FeatureList items={['Annual leave', 'Sick leave', 'Maternity / Paternity leave', 'Compassionate leave', 'Study leave', 'Custom leave types']} />
    </SectionWrapper>
  );
}

function ExpensesSection() {
  return (
    <SectionWrapper title="Expenses" icon={Receipt}>
      <p className="text-gray-600">Track and manage organizational expenses -- office supplies, utilities, travel, and other operational costs.</p>
      <h3 className="font-semibold text-gray-900">Recording an Expense</h3>
      <div className="space-y-4">
        <Step n={1} title="Create Expense">
          <p>Click <strong>Add Expense</strong>. Enter the description, category, amount, date, and payment method. Attach a receipt image if available.</p>
        </Step>
        <Step n={2} title="Approval (Optional)">
          <p>Depending on your organization's workflow, expenses above a certain threshold may require manager approval.</p>
        </Step>
        <Step n={3} title="Accounting">
          <p>Approved expenses automatically create corresponding journal entries, debiting the expense account and crediting cash or bank.</p>
        </Step>
      </div>
    </SectionWrapper>
  );
}

function AuditLogsSection() {
  return (
    <SectionWrapper title="Audit Logs" icon={ScrollText}>
      <p className="text-gray-600">Every sensitive action in the system is recorded in the audit log. This creates a complete trail of who did what and when.</p>
      <h3 className="font-semibold text-gray-900">What Gets Logged</h3>
      <FeatureList items={[
        'Member creation, editing, and status changes',
        'Loan applications, approvals, rejections, and disbursements',
        'Transactions (deposits, withdrawals, transfers)',
        'Staff account changes and role assignments',
        'Settings modifications',
        'Float operations and reconciliations',
        'Login and logout events',
      ]} />
      <h3 className="font-semibold text-gray-900 mt-4">Log Details</h3>
      <p className="text-gray-600 text-sm">Each log entry records: the action performed, who performed it, the timestamp, the affected entity (member, loan, etc.), and a comparison of old vs. new values where applicable.</p>
      <Tip><strong>Read-only:</strong> Audit logs cannot be edited or deleted. They provide an immutable record for compliance and accountability.</Tip>
    </SectionWrapper>
  );
}

function MpesaSection() {
  return (
    <SectionWrapper title="M-Pesa Setup" icon={Banknote}>
      <p className="text-gray-600">Integrate M-Pesa mobile money to allow members to make deposits, loan repayments, and other payments directly from their phone.</p>
      <h3 className="font-semibold text-gray-900">Integration Options</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className="font-medium text-gray-900 mb-2">Direct Safaricom Daraja API</h4>
          <p className="text-sm text-gray-600">Connect directly to Safaricom. You'll need to register at developer.safaricom.co.ke, create an app, and get your consumer key, secret, shortcode, and passkey.</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h4 className="font-medium text-gray-900 mb-2">SunPay Managed Gateway</h4>
          <p className="text-sm text-gray-600">Simplified setup through SunPay. They handle the Safaricom compliance. You just need a single API key from SunPay.</p>
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">Configuration</h3>
      <div className="space-y-4">
        <Step n={1} title="Go to Settings > M-Pesa">
          <p>Open <strong>Settings</strong> from the sidebar and click the <strong>M-Pesa</strong> tab.</p>
        </Step>
        <Step n={2} title="Enter Credentials">
          <p>For Daraja: enter your consumer key, consumer secret, shortcode, passkey, and environment (sandbox or production). For SunPay: enter your API key.</p>
        </Step>
        <Step n={3} title="Set Callback URL">
          <p>The callback URL is where Safaricom sends payment confirmations. It must be a publicly accessible HTTPS URL (e.g., https://yourdomain.com/api/mpesa/callback).</p>
        </Step>
      </div>
      <h3 className="font-semibold text-gray-900 mt-6">M-Pesa Features</h3>
      <FeatureList items={[
        'STK Push: Send a payment prompt to a member\'s phone',
        'C2B: Receive payments when members pay to your paybill/till',
        'B2C: Send money to members (loan disbursement, refunds)',
        'Loan repayments via M-Pesa with automatic allocation',
        'Deposit via STK Push with dual confirmation for security',
      ]} />
      <Tip><strong>SSL Required:</strong> M-Pesa callbacks require HTTPS. Make sure your domain has a valid SSL certificate before setting up M-Pesa.</Tip>
    </SectionWrapper>
  );
}

function SettingsSection() {
  return (
    <SectionWrapper title="Organization Settings" icon={Settings}>
      <p className="text-gray-600">Configure your organization's preferences, integrations, and operational parameters.</p>
      <h3 className="font-semibold text-gray-900">Settings Tabs</h3>
      <div className="space-y-3">
        {[
          { tab: 'General', desc: 'Organization name, currency, country, financial year start, and branding.' },
          { tab: 'Loans', desc: 'Default loan settings, auto-deduction toggle, and grace period configuration.' },
          { tab: 'Members', desc: 'Member number format, required fields, and registration defaults.' },
          { tab: 'SMS', desc: 'SMS gateway API key, sender ID, and auto-notification preferences.' },
          { tab: 'Email', desc: 'Email provider credentials (Brevo), sender address, and email templates.' },
          { tab: 'M-Pesa', desc: 'Daraja API credentials or SunPay API key, callback URLs, and environment.' },
          { tab: 'Business Hours', desc: 'Operating days and hours for each day of the week.' },
          { tab: 'Roles', desc: 'Create and manage custom roles and permissions.' },
          { tab: 'Usage', desc: 'View current plan limits vs. usage (members, staff, branches, SMS sent).' },
        ].map(s => (
          <div key={s.tab} className="flex gap-3 bg-gray-50 rounded-lg p-3">
            <ArrowRight className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-900">{s.tab}:</span>{' '}
              <span className="text-sm text-gray-600">{s.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}

function MyAccountSection() {
  return (
    <SectionWrapper title="My Account" icon={UserCog}>
      <p className="text-gray-600">Manage your personal profile and security settings.</p>
      <h3 className="font-semibold text-gray-900">What You Can Do</h3>
      <FeatureList items={[
        'Update your name and email address',
        'Change your password',
        'Set or update your approval PIN (used for sensitive operations like float approval)',
        'View which organizations you belong to',
        'Verify your email address',
      ]} />
    </SectionWrapper>
  );
}

function SectionContent({ sectionId }: { sectionId: SectionId }) {
  switch (sectionId) {
    case 'getting-started': return <GettingStartedSection />;
    case 'dashboard': return <DashboardSection />;
    case 'branches': return <BranchesSection />;
    case 'staff': return <StaffSection />;
    case 'roles': return <RolesSection />;
    case 'members': return <MembersSection />;
    case 'loan-products': return <LoanProductsSection />;
    case 'loan-applications': return <LoanApplicationsSection />;
    case 'repayments': return <RepaymentsSection />;
    case 'defaults-collections': return <DefaultsSection />;
    case 'transactions': return <TransactionsSection />;
    case 'teller-station': return <TellerStationSection />;
    case 'float-management': return <FloatManagementSection />;
    case 'queue-system': return <QueueSystemSection />;
    case 'fixed-deposits': return <FixedDepositsSection />;
    case 'dividends': return <DividendsSection />;
    case 'chart-of-accounts': return <ChartOfAccountsSection />;
    case 'journal-entries': return <JournalEntriesSection />;
    case 'opening-balances': return <OpeningBalancesSection />;
    case 'reports': return <ReportsSection />;
    case 'analytics': return <AnalyticsSection />;
    case 'sms': return <SMSSection />;
    case 'hr': return <HRSection />;
    case 'leave': return <LeaveSection />;
    case 'expenses': return <ExpensesSection />;
    case 'audit-logs': return <AuditLogsSection />;
    case 'mpesa': return <MpesaSection />;
    case 'settings': return <SettingsSection />;
    case 'my-account': return <MyAccountSection />;
    default: return null;
  }
}

export default function ManualPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const handleSectionChange = (sectionId: SectionId) => {
    setActiveSection(sectionId);
    setSearchQuery('');
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const filteredGroups = searchQuery.trim()
    ? navGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter(group => group.items.length > 0)
    : navGroups;

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
            <BookOpen className="w-4 h-4" />
            User Manual
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            System Manual
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Step-by-step guide to every feature in the system.
          </p>
        </div>

        <div className="flex gap-8">
          <nav className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-1 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search sections..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  data-testid="input-manual-search"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              {filteredGroups.map(group => (
                <div key={group.label} className="mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 px-3">{group.label}</p>
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSectionChange(item.id)}
                      data-testid={`button-nav-${item.id}`}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition flex items-center gap-2 ${
                        activeSection === item.id
                          ? 'bg-purple-100 text-purple-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0" ref={contentRef} style={{ scrollMarginTop: '100px' }}>
            <div className="lg:hidden mb-6">
              <select
                value={activeSection}
                onChange={e => handleSectionChange(e.target.value as SectionId)}
                data-testid="select-manual-section"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white"
              >
                {navGroups.flatMap(g => g.items).map(item => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>

            <SectionContent sectionId={activeSection} />

            <div className="flex justify-between mt-8">
              {(() => {
                const allItems = navGroups.flatMap(g => g.items);
                const currentIndex = allItems.findIndex(i => i.id === activeSection);
                const prev = currentIndex > 0 ? allItems[currentIndex - 1] : null;
                const next = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;
                return (
                  <>
                    {prev ? (
                      <button
                        onClick={() => handleSectionChange(prev.id)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                        {prev.label}
                      </button>
                    ) : <div />}
                    {next ? (
                      <button
                        onClick={() => handleSectionChange(next.id)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        {next.label}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : <div />}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
