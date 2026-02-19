import { 
  Users, 
  DollarSign, 
  CreditCard, 
  Wallet, 
  UserPlus, 
  BookOpen,
  LayoutGrid,
  Bell,
  Shield,
  BarChart3,
  Building2,
  Database,
  Briefcase
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Member Management',
    description: 'Complete member lifecycle management with KYC, documents, next-of-kin, and account status tracking.',
    color: 'blue'
  },
  {
    icon: DollarSign,
    title: 'Loan Management',
    description: 'Configurable loan products, applications, guarantors, disbursement via M-Pesa/Bank/Cash, and repayment tracking.',
    color: 'green'
  },
  {
    icon: CreditCard,
    title: 'Savings & Shares',
    description: 'Multiple account types with deposits, withdrawals, transfers, and interest calculation.',
    color: 'purple'
  },
  {
    icon: Wallet,
    title: 'Fixed Deposits',
    description: 'Fixed deposit products with maturity tracking, interest calculation, and auto-rollover options.',
    color: 'orange'
  },
  {
    icon: UserPlus,
    title: 'Dividends',
    description: 'Dividend declaration, automatic calculation based on share balance, approval workflow, and distribution.',
    color: 'pink'
  },
  {
    icon: BookOpen,
    title: 'Accounting',
    description: 'Double-entry bookkeeping, Chart of Accounts, journal entries, Trial Balance, Income Statement, Balance Sheet.',
    color: 'teal'
  },
  {
    icon: LayoutGrid,
    title: 'Teller Station',
    description: 'Dedicated teller interface for deposits, withdrawals, loan repayments with cash float tracking.',
    color: 'indigo'
  },
  {
    icon: Bell,
    title: 'SMS Notifications',
    description: 'Automated SMS alerts for transactions, loan reminders, and custom notifications.',
    color: 'red'
  },
  {
    icon: Shield,
    title: 'Audit Logs',
    description: 'Complete traceability of all actions with user, timestamp, and change details.',
    color: 'cyan'
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Real-time insights on portfolio performance, member growth, and financial health.',
    color: 'lime'
  },
  {
    icon: Building2,
    title: 'Staff & Branch Management',
    description: 'Multi-branch support with role-based access control and staff performance tracking.',
    color: 'amber'
  },
  {
    icon: Briefcase,
    title: 'HR Management',
    description: 'Employee records, payroll processing, leave management, and statutory deductions with automatic journal entries.',
    color: 'rose'
  },
  {
    icon: Database,
    title: 'Multi-Tenant Architecture',
    description: 'Database-per-tenant isolation for complete data security and privacy.',
    color: 'violet'
  },
];

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  pink: 'bg-pink-100 text-pink-600',
  teal: 'bg-teal-100 text-teal-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  red: 'bg-red-100 text-red-600',
  cyan: 'bg-cyan-100 text-cyan-600',
  lime: 'bg-lime-100 text-lime-600',
  amber: 'bg-amber-100 text-amber-600',
  rose: 'bg-rose-100 text-rose-600',
  violet: 'bg-violet-100 text-violet-600',
};

export default function Features() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Run Your Sacco
          </h2>
          <p className="text-xl text-gray-600">Comprehensive tools for modern financial institutions</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="p-6 rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-lg transition-all">
              <div className={`w-12 h-12 rounded-lg ${colorClasses[feature.color]} flex items-center justify-center mb-4`}>
                <feature.icon size={24} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
