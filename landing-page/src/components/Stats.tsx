import { TrendingUp, Users, CreditCard, Clock } from 'lucide-react';

export default function Stats() {
  const stats = [
    { value: '500+', label: 'Banks, Saccos & Chamas', icon: Users, color: 'blue' },
    { value: 'KES 2B+', label: 'Transactions Processed', icon: CreditCard, color: 'green' },
    { value: '1M+', label: 'Members Managed', icon: TrendingUp, color: 'purple' },
    { value: '99.9%', label: 'Uptime Guarantee', icon: Clock, color: 'orange' },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    purple: 'bg-purple-500/10 text-purple-400',
    orange: 'bg-orange-500/10 text-orange-400',
  };

  return (
    <section className="py-16 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="text-center">
                <div className={`w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center ${colorClasses[stat.color]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
