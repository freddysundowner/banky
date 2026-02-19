import { useState, useEffect } from 'react';
import { ArrowRight, Play, Shield, ChevronLeft, ChevronRight, Landmark, HandCoins, UsersRound } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const screenshots = [
  { src: '/screenshots/dashboard.png', label: 'Dashboard' },
  { src: '/screenshots/members.png', label: 'Members' },
  { src: '/screenshots/loans.png', label: 'Loans' },
  { src: '/screenshots/teller.png', label: 'Teller' },
];

interface LandingSettings {
  hero_title: string;
  hero_subtitle: string;
  hero_badge: string;
  cta_primary_text: string;
  cta_primary_url: string;
  cta_secondary_text: string;
  cta_secondary_url: string;
  demo_video_url: string;
  app_url: string;
  stats_saccos: string;
  stats_transactions: string;
  stats_members: string;
  stats_uptime: string;
}

const defaultSettings: LandingSettings = {
  hero_title: "One Platform for Banks, Saccos & Chamas",
  hero_subtitle: "Manage members, loans, savings, fixed deposits, and dividends with a powerful, secure multi-tenant system. Available as SaaS or self-hosted.",
  hero_badge: "Trusted by 500+ organizations across East Africa",
  cta_primary_text: "Start Free Trial",
  cta_primary_url: "#pricing",
  cta_secondary_text: "Watch Demo",
  cta_secondary_url: "",
  demo_video_url: "",
  app_url: "app.banky.co.ke",
  stats_saccos: "500+",
  stats_transactions: "KES 2B+",
  stats_members: "1M+",
  stats_uptime: "99.9%"
};

export default function Hero() {
  const { platform_name } = useBranding();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [settings, setSettings] = useState<LandingSettings>(defaultSettings);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    fetch('/api/public/landing-settings')
      .then(res => res.json())
      .then(data => setSettings({ ...defaultSettings, ...data }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % screenshots.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const goToSlide = (index: number) => setCurrentSlide(index);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + screenshots.length) % screenshots.length);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % screenshots.length);

  const handleSecondaryClick = () => {
    if (settings.demo_video_url) {
      setShowVideoModal(true);
    } else if (settings.cta_secondary_url) {
      window.location.href = settings.cta_secondary_url;
    }
  };

  const formatTitle = (title: string) => {
    const words = title.split(' ');
    if (words.length <= 3) return <>{title}</>;
    const mid = Math.ceil(words.length / 2);
    return (
      <>
        {words.slice(0, mid).join(' ')}
        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">
          {words.slice(mid).join(' ')}
        </span>
      </>
    );
  };

  const getAppDomain = () => {
    try {
      const url = new URL(settings.app_url);
      return url.host;
    } catch {
      return settings.app_url.replace(/^https?:\/\//, '').split('/')[0];
    }
  };

  return (
    <>
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800"></div>
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-full text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                {settings.hero_badge}
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                {formatTitle(settings.hero_title)}
              </h1>
              
              <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-xl mx-auto lg:mx-0">
                {settings.hero_subtitle}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
                <a 
                  href={settings.cta_primary_url}
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-blue-700 rounded-xl text-lg font-semibold hover:bg-blue-50 transition shadow-xl shadow-blue-900/20"
                >
                  {settings.cta_primary_text}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                {settings.cta_secondary_text && (
                  <button 
                    onClick={handleSecondaryClick}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/30 text-white rounded-xl text-lg font-semibold hover:bg-white/10 transition"
                  >
                    <Play className="w-5 h-5" />
                    {settings.cta_secondary_text}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-blue-100">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-cyan-300" />
                  Banks & MFIs
                </div>
                <div className="flex items-center gap-2">
                  <HandCoins className="w-5 h-5 text-green-400" />
                  Saccos
                </div>
                <div className="flex items-center gap-2">
                  <UsersRound className="w-5 h-5 text-yellow-300" />
                  Chamas & Groups
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-300" />
                  Bank-grade Security
                </div>
              </div>
            </div>

            <div className="hidden lg:block relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-3xl blur-2xl"></div>
              <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-400"></span>
                    <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                    <span className="w-3 h-3 rounded-full bg-green-400"></span>
                    <span className="ml-4 text-sm text-gray-500">{getAppDomain()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={prevSlide}
                      className="p-1 hover:bg-gray-200 rounded transition"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-500" />
                    </button>
                    <button 
                      onClick={nextSlide}
                      className="p-1 hover:bg-gray-200 rounded transition"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
                
                <div className="relative overflow-hidden">
                  <div 
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                  >
                    {screenshots.map((screenshot, index) => (
                      <img 
                        key={index}
                        src={screenshot.src} 
                        alt={`${platform_name} ${screenshot.label}`}
                        className="w-full h-auto flex-shrink-0"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 py-3 bg-gray-50 border-t">
                  {screenshots.map((screenshot, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                        currentSlide === index 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {screenshot.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showVideoModal && settings.demo_video_url && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowVideoModal(false)}
        >
          <div 
            className="relative w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowVideoModal(false)}
              className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 text-2xl"
            >
              &times;
            </button>
            <iframe
              src={settings.demo_video_url}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </>
  );
}
