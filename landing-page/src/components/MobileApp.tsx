import { useState, useEffect } from 'react';
import { Smartphone, Wallet, Receipt, CreditCard, Bell, ShieldCheck } from 'lucide-react';

const screens = [
  {
    src: '/screenshots/app-splash.png',
    label: 'Branded Splash',
  },
  {
    src: '/screenshots/app-home-hidden.png',
    label: 'Dashboard',
  },
  {
    src: '/screenshots/app-home-visible.png',
    label: 'Balance View',
  },
];

const highlights = [
  {
    icon: Wallet,
    color: 'bg-green-100 text-green-600',
    title: 'Savings & Share Capital',
    desc: 'View savings balance and share capital at a glance, with one-tap balance reveal.',
  },
  {
    icon: Receipt,
    color: 'bg-blue-100 text-blue-600',
    title: 'Transaction History',
    desc: 'Full statement with downloadable PDF receipts and detailed transaction records.',
  },
  {
    icon: CreditCard,
    color: 'bg-purple-100 text-purple-600',
    title: 'Loans on the Go',
    desc: 'Apply for loans, check active loan balances, and track repayment schedules.',
  },
  {
    icon: Smartphone,
    color: 'bg-orange-100 text-orange-600',
    title: 'M-Pesa Deposits',
    desc: 'Deposit straight from the app via M-Pesa STK Push — no queue, no teller needed.',
  },
  {
    icon: Bell,
    color: 'bg-red-100 text-red-600',
    title: 'Real-time Alerts',
    desc: 'Instant notifications for every deposit, disbursement, and repayment.',
  },
  {
    icon: ShieldCheck,
    color: 'bg-cyan-100 text-cyan-600',
    title: 'Secure & Private',
    desc: 'PIN-protected sessions with balance masking — members control what they see.',
  },
];

export default function MobileApp() {
  const [androidUrl, setAndroidUrl] = useState('');
  const [iosUrl, setIosUrl] = useState('');

  useEffect(() => {
    fetch('/api/public/landing-settings')
      .then(res => res.json())
      .then(data => {
        setAndroidUrl(data.android_url || '');
        setIosUrl(data.ios_url || '');
      })
      .catch(() => {});
  }, []);

  return (
    <section id="mobile-app" className="py-24 bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            Mobile App
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Banking in Your Members' Pockets
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            The BANKY mobile app gives every member a full-featured banking experience — deposits, loans, statements, and more — right from their phone.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="flex justify-center gap-4 lg:gap-6">
            {screens.map((screen, i) => (
              <div
                key={screen.label}
                className={`flex-shrink-0 transition-all duration-300 ${
                  i === 1
                    ? 'scale-110 z-10 shadow-2xl'
                    : 'scale-95 opacity-80 shadow-lg'
                }`}
                style={{ marginTop: i === 1 ? '0px' : '32px' }}
              >
                <div className="relative bg-gray-900 rounded-[2.5rem] p-2 shadow-xl" style={{ width: '160px' }}>
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-gray-700 rounded-full z-10"></div>
                  <div className="rounded-[2rem] overflow-hidden bg-white">
                    <img
                      src={screen.src}
                      alt={screen.label}
                      className="w-full h-auto block"
                      style={{ minHeight: '280px', objectFit: 'cover' }}
                    />
                  </div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-600 rounded-full"></div>
                </div>
                <p className="text-center text-xs font-medium text-gray-500 mt-3">{screen.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-5">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
                  <div className={`w-11 h-11 rounded-lg ${item.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-0.5">{item.title}</h3>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                </div>
              );
            })}

            {(androidUrl || iosUrl) && (
              <div className="pt-4 flex flex-wrap gap-3">
                {androidUrl && (
                  <a
                    href={androidUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    <Smartphone size={16} />
                    Get it on Android
                  </a>
                )}
                {iosUrl && (
                  <a
                    href={iosUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    Download on App Store
                  </a>
                )}
              </div>
            )}

            {!androidUrl && !iosUrl && (
              <div className="pt-4 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium">
                  <Smartphone size={16} />
                  Android (APK)
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">
                  <ShieldCheck size={16} />
                  Included with every plan
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
