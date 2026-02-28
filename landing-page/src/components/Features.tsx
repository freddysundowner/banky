import { useState, useEffect } from 'react';
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
  Briefcase,
  Smartphone,
  Globe,
  Lock,
  Settings,
  TrendingUp,
  PieChart,
  FileText,
  Mail,
  Phone,
  Map,
  Award,
  Package,
  PhoneCall,
  type LucideIcon
} from 'lucide-react';

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
  color: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Users, DollarSign, CreditCard, Wallet, UserPlus, BookOpen,
  LayoutGrid, Bell, Shield, BarChart3, Building2, Database,
  Briefcase, Smartphone, Globe, Lock, Settings, TrendingUp,
  PieChart, FileText, Mail, Phone, Map, Award, Package, PhoneCall,
};

const defaultFeatures: FeatureItem[] = [
  { icon: 'Users', title: 'Member Management', description: 'Register members in seconds. Track KYC documents, next-of-kin, shares, and account status -- whether you have 20 members or 200,000.', color: 'blue' },
  { icon: 'DollarSign', title: 'Loan Management', description: 'Create unlimited loan products with custom interest rates, terms, and repayment schedules. Disburse via M-Pesa, bank, or cash -- and track every shilling.', color: 'green' },
  { icon: 'CreditCard', title: 'Savings & Shares', description: 'Multiple account types for savings, shares, and special deposits. Automatic interest calculations and seamless member withdrawals.', color: 'purple' },
  { icon: 'Wallet', title: 'Fixed Deposits', description: 'Offer competitive fixed deposit products with automatic maturity tracking, interest accrual, and flexible rollover options.', color: 'orange' },
  { icon: 'UserPlus', title: 'Dividends & Profit Sharing', description: 'Declare dividends, calculate payouts based on share balances, and distribute to members -- perfect for Saccos and chama profit-sharing.', color: 'pink' },
  { icon: 'BookOpen', title: 'Full Accounting Suite', description: 'Double-entry bookkeeping that runs itself. Chart of Accounts, journal entries, Trial Balance, Income Statement, and Balance Sheet -- all automated.', color: 'teal' },
  { icon: 'LayoutGrid', title: 'Teller Station', description: 'A dedicated counter interface for daily operations. Process deposits, withdrawals, and repayments with real-time cash float tracking.', color: 'indigo' },
  { icon: 'Smartphone', title: 'Member Mobile App', description: 'A branded Android app lets members check balances, deposit via M-Pesa, apply for loans, and download statements — all from their phone. Included in every plan.', color: 'green' },
  { icon: 'Bell', title: 'SMS & Notifications', description: 'Keep members informed with automated SMS alerts for every transaction, loan approval, due date reminder, and dividend payout.', color: 'red' },
  { icon: 'Shield', title: 'Audit & Compliance', description: 'Every action is logged. Full audit trails with user, timestamp, and change details for regulatory compliance and internal governance.', color: 'cyan' },
  { icon: 'BarChart3', title: 'Real-time Analytics', description: 'Live dashboards showing portfolio performance, loan arrears, member growth, and financial health. Generate regulator reports in one click.', color: 'lime' },
  { icon: 'Building2', title: 'Multi-Branch Operations', description: 'Manage headquarters, branches, and satellite offices from one platform. Role-based access ensures staff see only what they need.', color: 'amber' },
  { icon: 'Briefcase', title: 'HR & Payroll', description: 'Manage employee records, process payroll, track leave, and handle statutory deductions -- with automatic journal entries to your books.', color: 'rose' },
  { icon: 'Package', title: 'Collateral Management', description: 'Register and track every asset pledged as loan security. Record valuations, monitor LTV coverage, manage insurance policies, and get alerts when collateral falls below required levels.', color: 'amber' },
  { icon: 'PhoneCall', title: 'CRM & Lead Management', description: 'Turn prospects into members. Log calls, emails, and meetings, schedule follow-ups, track pipeline stages, and convert contacts to full member accounts in one click.', color: 'teal' },
  { icon: 'Database', title: 'Isolated & Secure', description: "Every organization gets its own dedicated database. Your data never mixes with anyone else's. Bank-grade encryption at rest and in transit.", color: 'violet' },
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
  const [features, setFeatures] = useState<FeatureItem[]>(defaultFeatures);

  useEffect(() => {
    fetch('/api/public/landing-content/features')
      .then(res => res.json())
      .then(data => { if (data.data) setFeatures(data.data); })
      .catch(() => {});
  }, []);

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything Your Financial Institution Needs
          </h2>
          <p className="text-xl text-gray-600">Whether you run a bank, a Sacco, or a chama -- BANKYKIT has the tools to replace spreadsheets, reduce errors, and save you hours every day.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const IconComponent = ICON_MAP[feature.icon] || Users;
            return (
              <div key={feature.title} className="p-6 rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-lg transition-all">
                <div className={`w-12 h-12 rounded-lg ${colorClasses[feature.color] || colorClasses.blue} flex items-center justify-center mb-4`}>
                  <IconComponent size={24} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
