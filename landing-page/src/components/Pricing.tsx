import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  plan_type: string;
  pricing_model: string;
  business_type?: string;
  monthly_price: number;
  annual_price: number;
  one_time_price: number;
  max_members: number;
  max_staff: number;
  max_branches: number;
  is_popular?: boolean;
  features: string[] | { enabled?: string[]; custom?: string[] } | Record<string, boolean>;
}

interface PlansResponse {
  title: string;
  subtitle: string;
  saas_label: string;
  enterprise_label: string;
  currency: string;
  currency_symbol: string;
  saas: Plan[];
  enterprise: Plan[];
  by_type?: Record<string, { saas: Plan[]; enterprise: Plan[] }>;
}

const BUSINESS_TYPES = [
  { id: 'all', label: 'All' },
  { id: 'chama', label: 'Chama / Group' },
  { id: 'sacco', label: 'SACCO' },
  { id: 'mfi', label: 'Microfinance' },
  { id: 'bank', label: 'Bank' },
];

const TYPE_DESCRIPTIONS: Record<string, string> = {
  all: 'Plans for every type of financial institution',
  chama: 'Ideal for savings groups, investment clubs, and welfare groups',
  sacco: 'Built for savings and credit cooperative societies',
  mfi: 'Perfect for microfinance institutions and lending companies',
  bank: 'Enterprise-grade for community banks and financial institutions',
};

function extractFeatures(f: Plan['features']): string[] {
  if (Array.isArray(f)) return f;
  if (f && typeof f === 'object' && 'enabled' in f) {
    const fObj = f as { enabled?: string[]; custom?: string[] };
    return [...(fObj.enabled || []), ...(fObj.custom || [])];
  }
  return [];
}

const FEATURE_LABELS: Record<string, string> = {
  members: 'Members & KYC',
  savings: 'Savings Accounts',
  loans: 'Loans',
  audit_logs: 'Audit Logs',
  mpesa_integration: 'M-Pesa Integration',
  sms_notifications: 'SMS Notifications',
  core_banking: 'Core Banking Engine',
  shares: 'Share Capital',
  dividends: 'Dividends',
  fixed_deposits: 'Fixed Deposits',
  expenses: 'Expense Tracking',
  accounting: 'Accounting (GL)',
  teller_station: 'Teller Station',
  float_management: 'Float Management',
  collateral: 'Collateral & Insurance',
  crm: 'CRM',
  analytics: 'Analytics Dashboard',
  analytics_export: 'Analytics Export',
  custom_reports: 'Custom Reports',
  bulk_sms: 'Bulk SMS',
  multiple_branches: 'Multiple Branches',
  leave_management: 'Leave Management',
  payroll: 'Payroll',
  hr: 'HR Management',
};

function humaniseFeature(f: string): string {
  return FEATURE_LABELS[f] || f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getPlanFeatures(plan: Plan): string[] {
  const result: string[] = [];
  if (plan.max_members > 0) result.push(`Up to ${plan.max_members.toLocaleString()} members`);
  if (plan.max_staff > 0) result.push(`${plan.max_staff} staff accounts`);
  if (plan.max_branches > 0) result.push(`${plan.max_branches} branch${plan.max_branches > 1 ? 'es' : ''}`);
  extractFeatures(plan.features).forEach(f => result.push(humaniseFeature(f)));
  return result;
}

function PlanCard({
  plan,
  currencySymbol,
  billingPeriod,
  mode,
}: {
  plan: Plan;
  currencySymbol: string;
  billingPeriod: 'monthly' | 'annual';
  mode: 'saas' | 'enterprise';
}) {
  const isPopular = plan.is_popular;
  const features = getPlanFeatures(plan);
  const price = mode === 'saas'
    ? (billingPeriod === 'annual' && plan.annual_price > 0 ? Math.round(plan.annual_price / 12) : plan.monthly_price)
    : plan.one_time_price;
  const annualEquiv = mode === 'saas' && billingPeriod === 'annual' && plan.annual_price > 0;

  return (
    <div
      className={`relative bg-white rounded-2xl p-8 flex flex-col ${
        isPopular ? 'ring-2 ring-blue-600 shadow-xl' : 'border border-gray-200'
      }`}
    >
      {isPopular && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-sm font-medium px-4 py-1 rounded-full whitespace-nowrap">
          Most Popular
        </span>
      )}
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
        <div className="text-4xl font-bold text-gray-900">
          {currencySymbol}{price.toLocaleString()}
          <span className="text-lg font-normal text-gray-500">
            {mode === 'saas' ? '/month' : ' one-time'}
          </span>
        </div>
        {annualEquiv && (
          <p className="text-sm text-gray-500 mt-1">
            {currencySymbol}{plan.annual_price.toLocaleString()}/year (billed annually)
          </p>
        )}
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-gray-600 text-sm">{f}</span>
          </li>
        ))}
      </ul>
      <a
        href={mode === 'saas' ? '/register' : '/contact'}
        className={`block w-full py-3 rounded-lg font-medium transition text-center ${
          isPopular
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'border border-gray-300 text-gray-700 hover:border-gray-400'
        }`}
      >
        {mode === 'saas' ? 'Start Free Trial' : 'Contact Sales'}
      </a>
    </div>
  );
}

export default function Pricing() {
  const [pricingModel, setPricingModel] = useState<'saas' | 'enterprise'>('saas');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [activeType, setActiveType] = useState('chama');
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [byType, setByType] = useState<Record<string, { saas: Plan[]; enterprise: Plan[] }>>({});
  const [title, setTitle] = useState('Choose Your Plan');
  const [subtitle, setSubtitle] = useState('Flexible options for every financial institution');
  const [saasLabel, setSaasLabel] = useState('SaaS (Subscription)');
  const [enterpriseLabel, setEnterpriseLabel] = useState('Perpetual Licence');
  const [currencySymbol, setCurrencySymbol] = useState('KES ');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch('/api/public/plans', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('Bad response');
        const data: PlansResponse = await res.json();
        if (data.title) setTitle(data.title);
        if (data.subtitle) setSubtitle(data.subtitle);
        if (data.saas_label) setSaasLabel(data.saas_label);
        if (data.enterprise_label) setEnterpriseLabel(data.enterprise_label);
        if (data.currency_symbol) setCurrencySymbol(data.currency_symbol);
        setAllPlans([...data.saas, ...data.enterprise]);
        if (data.by_type) setByType(data.by_type);
      })
      .catch(() => setError(true))
      .finally(() => { clearTimeout(timeout); setLoading(false); });
    return () => controller.abort();
  }, [retryCount]);

  const getPlansToShow = (): Plan[] => {
    if (activeType === 'all') {
      return allPlans.filter(p => p.pricing_model === pricingModel || (pricingModel === 'enterprise' && p.pricing_model === 'perpetual_license'));
    }
    const group = byType[activeType];
    if (!group) return [];
    if (pricingModel === 'saas') return group.saas || [];
    return group.enterprise || [];
  };

  const plansToShow = getPlansToShow();
  const hasAnnualPricing = allPlans.some(p => p.annual_price > 0 && p.pricing_model === 'saas');
  const availableTypes = BUSINESS_TYPES.filter(t => {
    if (t.id === 'all') return true;
    return byType[t.id] && (
      (pricingModel === 'saas' ? byType[t.id].saas : byType[t.id].enterprise)?.length > 0
    );
  });

  return (
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h2>
          <p className="text-xl text-gray-600">{subtitle}</p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-gray-200 rounded-lg p-1">
            <button
              className={`px-6 py-2 rounded-md font-medium transition ${
                pricingModel === 'saas' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
              onClick={() => setPricingModel('saas')}
            >
              {saasLabel}
            </button>
            <button
              className={`px-6 py-2 rounded-md font-medium transition ${
                pricingModel === 'enterprise' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
              onClick={() => { setPricingModel('enterprise'); }}
            >
              {enterpriseLabel}
            </button>
          </div>
        </div>

        {pricingModel === 'saas' && hasAnnualPricing && !loading && !error && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-3">
              <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
              <button
                onClick={() => setBillingPeriod(b => b === 'monthly' ? 'annual' : 'monthly')}
                className={`relative w-12 h-6 rounded-full transition ${billingPeriod === 'annual' ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${billingPeriod === 'annual' ? 'translate-x-6' : ''}`} />
              </button>
              <span className={`text-sm font-medium ${billingPeriod === 'annual' ? 'text-gray-900' : 'text-gray-500'}`}>Annual</span>
              {billingPeriod === 'annual' && (
                <span className="ml-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Save up to 20%</span>
              )}
            </div>
          </div>
        )}

        {!loading && !error && availableTypes.length > 1 && (
          <div className="flex justify-center mb-8">
            <div className="flex gap-2 flex-wrap justify-center">
              {availableTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveType(t.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeType === t.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-300 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && activeType !== 'all' && TYPE_DESCRIPTIONS[activeType] && (
          <p className="text-center text-gray-500 text-sm mb-8">{TYPE_DESCRIPTIONS[activeType]}</p>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-gray-500 text-sm">Loading plans...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-gray-600 mb-4">Could not load pricing plans. Please try again.</p>
            <button
              onClick={() => setRetryCount(c => c + 1)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              Retry
            </button>
          </div>
        ) : plansToShow.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No plans available for this selection.</div>
        ) : activeType === 'all' ? (
          <div className="space-y-12">
            {BUSINESS_TYPES.filter(t => t.id !== 'all').map(t => {
              const group = byType[t.id];
              const groupPlans = group ? (pricingModel === 'saas' ? group.saas : group.enterprise) || [] : [];
              if (groupPlans.length === 0) return null;
              return (
                <div key={t.id}>
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">{t.label}</h3>
                    <p className="text-sm text-gray-500">{TYPE_DESCRIPTIONS[t.id]}</p>
                  </div>
                  <div className={`grid gap-8 ${
                    groupPlans.length === 1 ? 'max-w-sm mx-auto' :
                    groupPlans.length === 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' :
                    groupPlans.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' :
                    'md:grid-cols-3'
                  }`}>
                    {groupPlans.map((plan) => (
                      <PlanCard
                        key={plan.id || plan.name}
                        plan={plan}
                        currencySymbol={currencySymbol}
                        billingPeriod={billingPeriod}
                        mode={pricingModel}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`grid gap-8 ${
            plansToShow.length === 1 ? 'max-w-sm mx-auto' :
            plansToShow.length === 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' :
            plansToShow.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' :
            'md:grid-cols-3'
          }`}>
            {plansToShow.map((plan) => (
              <PlanCard
                key={plan.id || plan.name}
                plan={plan}
                currencySymbol={currencySymbol}
                billingPeriod={billingPeriod}
                mode={pricingModel}
              />
            ))}
          </div>
        )}

        {pricingModel === 'enterprise' && !loading && !error && (
          <div className="mt-16 bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
            <div className="max-w-3xl mx-auto">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">How Perpetual Licensing Works</h3>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { step: 1, title: 'Purchase Licence', desc: 'Contact our sales team to purchase the edition that fits your institution type and size' },
                  { step: 2, title: 'Receive Licence Key', desc: 'Get your unique licence key tied to your plan\'s features, member limits, and branch count' },
                  { step: 3, title: 'Deploy & Activate', desc: 'Install on your server, add your licence key, and start using BANKYKIT immediately' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-blue-600">{step}</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
                    <p className="text-gray-600 text-sm">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 text-center">
                  <strong>Licence Key Format:</strong> BANKYKIT-XXX-YEAR-XXXXXXXX<br />
                  Your licence key unlocks features based on your purchased edition and includes the specified support duration.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
