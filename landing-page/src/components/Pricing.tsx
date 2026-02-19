import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface SaaSPlan {
  name: string;
  plan_type: string;
  monthly_price: number;
  annual_price: number;
  max_members: number;
  max_staff: number;
  max_branches: number;
  features: string[] | { enabled: string[] } | Record<string, boolean>;
}

interface EnterprisePlan {
  name: string;
  price: number;
  max_members: number;
  max_staff: number;
  max_branches: number;
  support_years?: number;
  features: string[] | { enabled: string[] };
}

interface PlansResponse {
  title: string;
  subtitle: string;
  saas_label: string;
  enterprise_label: string;
  saas: SaaSPlan[];
  enterprise: EnterprisePlan[];
}

function extractFeatures(features: string[] | { enabled: string[]; custom?: string[] } | Record<string, boolean>): string[] {
  if (Array.isArray(features)) return features;
  if (features && typeof features === 'object' && 'enabled' in features) {
    const f = features as { enabled: string[]; custom?: string[] };
    const enabled = f.enabled || [];
    const custom = f.custom || [];
    return [...enabled, ...custom];
  }
  return [];
}

function getSaasFeatures(plan: SaaSPlan): string[] {
  const result: string[] = [];
  result.push(`Up to ${plan.max_members.toLocaleString()} members`);
  result.push(`${plan.max_staff} staff accounts`);
  result.push(`${plan.max_branches} branch${plan.max_branches > 1 ? 'es' : ''}`);

  const dbFeatures = extractFeatures(plan.features);
  for (const f of dbFeatures) {
    result.push(f);
  }

  return result;
}

export default function Pricing() {
  const [pricingType, setPricingType] = useState<'saas' | 'enterprise'>('saas');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [saasPlans, setSaasPlans] = useState<SaaSPlan[]>([]);
  const [enterprisePlans, setEnterprisePlans] = useState<EnterprisePlan[]>([]);
  const [title, setTitle] = useState('Choose Your Plan');
  const [subtitle, setSubtitle] = useState('Flexible options for Saccos of all sizes');
  const [saasLabel, setSaasLabel] = useState('SaaS (Monthly)');
  const [enterpriseLabel, setEnterpriseLabel] = useState('Enterprise (One-time)');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch('/api/public/plans');
        if (response.ok) {
          const data: PlansResponse = await response.json();
          if (data.title) setTitle(data.title);
          if (data.subtitle) setSubtitle(data.subtitle);
          if (data.saas_label) setSaasLabel(data.saas_label);
          if (data.enterprise_label) setEnterpriseLabel(data.enterprise_label);
          const filteredSaas = data.saas.filter(p => p.plan_type !== 'enterprise');
          setSaasPlans(filteredSaas);
          setEnterprisePlans(data.enterprise);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Failed to fetch plans:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  const popularSaasPlan = 'growth';
  const popularEnterprisePlan = 'Standard';

  const hasAnnualPricing = saasPlans.some(p => p.annual_price > 0);

  return (
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {title}
          </h2>
          <p className="text-xl text-gray-600">{subtitle}</p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-gray-200 rounded-lg p-1">
            <button
              className={`px-6 py-2 rounded-md font-medium transition ${
                pricingType === 'saas' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
              onClick={() => setPricingType('saas')}
            >
              {saasLabel}
            </button>
            <button
              className={`px-6 py-2 rounded-md font-medium transition ${
                pricingType === 'enterprise' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
              onClick={() => setPricingType('enterprise')}
            >
              {enterpriseLabel}
            </button>
          </div>
        </div>

        {pricingType === 'saas' && hasAnnualPricing && !loading && !error && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-3">
              <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'annual' : 'monthly')}
                className={`relative w-12 h-6 rounded-full transition ${
                  billingPeriod === 'annual' ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    billingPeriod === 'annual' ? 'translate-x-6' : ''
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${billingPeriod === 'annual' ? 'text-gray-900' : 'text-gray-500'}`}>
                Annual
              </span>
              {billingPeriod === 'annual' && (
                <span className="ml-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  Save up to 20%
                </span>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">Failed to load pricing. Please try again later.</p>
          </div>
        ) : pricingType === 'saas' ? (
          <div className="grid gap-8 md:grid-cols-3">
            {saasPlans.map((plan) => {
              const isPopular = plan.plan_type === popularSaasPlan;
              const features = getSaasFeatures(plan);
              const price = billingPeriod === 'annual' && plan.annual_price > 0
                ? Math.round(plan.annual_price / 12)
                : plan.monthly_price;
              const monthlyEquiv = billingPeriod === 'annual' && plan.annual_price > 0;

              return (
                <div
                  key={plan.name}
                  className={`relative bg-white rounded-2xl p-8 ${
                    isPopular ? 'ring-2 ring-blue-600 shadow-xl' : 'border border-gray-200'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-sm font-medium px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="text-4xl font-bold text-gray-900">
                      ${price}
                      <span className="text-lg font-normal text-gray-500">/month</span>
                    </div>
                    {monthlyEquiv && (
                      <p className="text-sm text-gray-500 mt-1">
                        ${plan.annual_price}/year (billed annually)
                      </p>
                    )}
                  </div>
                  <ul className="space-y-4 mb-8">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="/register"
                    className={`block w-full py-3 rounded-lg font-medium transition text-center ${
                      isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Start Free Trial
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`grid gap-8 ${enterprisePlans.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
            {enterprisePlans.map((plan) => {
              const isPopular = plan.name === popularEnterprisePlan;
              const features: string[] = [];
              features.push(plan.max_members === -1 ? 'Unlimited members' : `Up to ${plan.max_members.toLocaleString()} members`);
              features.push(plan.max_staff === -1 ? 'Unlimited staff' : `${plan.max_staff} staff accounts`);
              features.push(plan.max_branches === -1 ? 'Unlimited branches' : `${plan.max_branches} branch${plan.max_branches > 1 ? 'es' : ''}`);
              features.push(...extractFeatures(plan.features));

              return (
                <div
                  key={plan.name}
                  className={`relative bg-white rounded-2xl p-8 ${
                    isPopular ? 'ring-2 ring-blue-600 shadow-xl' : 'border border-gray-200'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-sm font-medium px-4 py-1 rounded-full">
                      Best Value
                    </span>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="text-4xl font-bold text-gray-900">
                      ${plan.price.toLocaleString()}{plan.name === 'Enterprise' ? '+' : ''}
                      <span className="text-lg font-normal text-gray-500"> one-time</span>
                    </div>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="/contact"
                    className={`block w-full py-3 rounded-lg font-medium transition text-center ${
                      isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Contact Sales
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {pricingType === 'enterprise' && !loading && !error && (
          <div className="mt-16 bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
            <div className="max-w-3xl mx-auto">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                How Enterprise Licensing Works
              </h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-blue-600">1</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Purchase License</h4>
                  <p className="text-gray-600 text-sm">
                    Contact our sales team to purchase the edition that fits your needs
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-blue-600">2</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Receive License Key</h4>
                  <p className="text-gray-600 text-sm">
                    Get your unique license key tied to your plan's features and limits
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-blue-600">3</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Deploy & Activate</h4>
                  <p className="text-gray-600 text-sm">
                    Install on your server, add your license key, and start using BANKY
                  </p>
                </div>
              </div>
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 text-center">
                  <strong>License Key Format:</strong> BANKY-XXX-YEAR-XXXXXXXX
                  <br />
                  Your license key unlocks features based on your purchased edition and includes support for the specified duration.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
