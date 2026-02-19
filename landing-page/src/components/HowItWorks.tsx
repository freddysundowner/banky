import { useState, useEffect } from 'react';
import { UserPlus, Settings, Rocket, ArrowRight } from 'lucide-react';

interface HowItWorksItem {
  title: string;
  description: string;
  color: string;
}

const defaultSteps: HowItWorksItem[] = [
  { title: 'Sign Up in 2 Minutes', description: 'Create your account and set up your bank, Sacco, or chama. No credit card needed. Your dedicated database is provisioned instantly.', color: 'blue' },
  { title: 'Configure Your Way', description: 'Add branches, invite staff, set up loan products, connect M-Pesa, and customize your chart of accounts. The system adapts to how you operate.', color: 'green' },
  { title: 'Go Live & Grow', description: 'Register members, disburse loans, collect deposits, and track everything on real-time dashboards. Your members get SMS updates automatically.', color: 'purple' },
];

const stepIcons = [UserPlus, Settings, Rocket];

const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-200' },
  lime: { bg: 'bg-lime-100', text: 'text-lime-600', border: 'border-lime-200' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
};

export default function HowItWorks() {
  const [steps, setSteps] = useState<HowItWorksItem[]>(defaultSteps);

  useEffect(() => {
    fetch('/api/public/landing-content/how_it_works')
      .then(res => res.json())
      .then(data => { if (data.data) setSteps(data.data); })
      .catch(() => {});
  }, []);

  return (
    <section id="how-it-works" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            From Signup to First Loan in Under an Hour
          </h2>
          <p className="text-xl text-gray-600">
            No consultants. No lengthy onboarding. Three simple steps to digitize your operations.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-20 left-[20%] right-[20%] h-0.5 bg-gray-200"></div>

          {steps.map((step, index) => {
            const colors = colorClasses[step.color] || colorClasses.blue;
            const Icon = stepIcons[index] || Rocket;
            return (
              <div key={index} className="relative text-center">
                <div className="flex justify-center mb-6">
                  <div className={`relative w-16 h-16 rounded-2xl ${colors.bg} flex items-center justify-center`}>
                    <Icon className={`w-8 h-8 ${colors.text}`} />
                    <span className={`absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white ${colors.border} border-2 flex items-center justify-center text-sm font-bold ${colors.text}`}>
                      {index + 1}
                    </span>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed max-w-sm mx-auto">{step.description}</p>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <a href="#pricing" className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">
            Start Your Free Trial
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
}
