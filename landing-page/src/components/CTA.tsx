import { ArrowRight, Calendar } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

export default function CTA() {
  const { platform_name } = useBranding();

  return (
    <section className="py-20 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
        backgroundSize: '24px 24px'
      }}></div>
      
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Stop Managing Finances on Spreadsheets
        </h2>
        <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
          500+ banks, Saccos, and chamas have already switched to {platform_name}. 
          Start your free trial today and see why they never looked back.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a 
            href="#pricing" 
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-blue-700 rounded-xl text-lg font-semibold hover:bg-blue-50 transition shadow-xl"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <button 
            className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/30 text-white rounded-xl text-lg font-semibold hover:bg-white/10 transition"
          >
            <Calendar className="w-5 h-5" />
            Schedule a Demo
          </button>
        </div>
      </div>
    </section>
  );
}
