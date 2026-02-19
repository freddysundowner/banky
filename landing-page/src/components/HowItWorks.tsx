import { UserPlus, Settings, Rocket, ArrowRight } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    step: '1',
    title: 'Sign Up & Create Organization',
    description: 'Register your account and set up your Sacco or microfinance organization in under 2 minutes. Start with a free trial - no credit card required.',
    color: 'blue',
  },
  {
    icon: Settings,
    step: '2',
    title: 'Configure Your Setup',
    description: 'Add your branches, create staff accounts, configure loan products, set up M-Pesa integration, and customize your Chart of Accounts.',
    color: 'green',
  },
  {
    icon: Rocket,
    step: '3',
    title: 'Start Managing',
    description: 'Register members, process loans, handle deposits and withdrawals through the teller station, and track everything with real-time dashboards.',
    color: 'purple',
  },
];

const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Get Started in Minutes
          </h2>
          <p className="text-xl text-gray-600">
            Three simple steps to modernize your Sacco operations
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-20 left-[20%] right-[20%] h-0.5 bg-gray-200"></div>

          {steps.map((step) => {
            const colors = colorClasses[step.color];
            const Icon = step.icon;
            return (
              <div key={step.step} className="relative text-center">
                <div className="flex justify-center mb-6">
                  <div
                    className={`relative w-16 h-16 rounded-2xl ${colors.bg} flex items-center justify-center`}
                  >
                    <Icon className={`w-8 h-8 ${colors.text}`} />
                    <span
                      className={`absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white ${colors.border} border-2 flex items-center justify-center text-sm font-bold ${colors.text}`}
                    >
                      {step.step}
                    </span>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed max-w-sm mx-auto">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            Start Your Free Trial
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
}
