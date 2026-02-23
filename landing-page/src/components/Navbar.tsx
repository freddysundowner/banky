import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'wouter';
import { useBranding } from '../context/BrandingContext';

interface NavbarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export default function Navbar({ mobileMenuOpen, setMobileMenuOpen }: NavbarProps) {
  const { platform_name, theme_primary_color } = useBranding();
  const [ctaUrl, setCtaUrl] = useState('/register');
  const [ctaText, setCtaText] = useState('Start Free Trial');
  const [signInUrl, setSignInUrl] = useState('/login');

  useEffect(() => {
    fetch('/api/public/landing-settings')
      .then(res => res.json())
      .then(data => {
        if (data.cta_primary_url) setCtaUrl(data.cta_primary_url);
        if (data.cta_primary_text) setCtaText(data.cta_primary_text);
        if (data.app_url) setSignInUrl(data.app_url);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <span 
                className="w-8 h-8 text-white rounded-lg flex items-center justify-center font-bold"
                style={{ backgroundColor: theme_primary_color }}
              >
                {platform_name.charAt(0)}
              </span>
              <span className="text-xl font-bold text-gray-900">{platform_name}</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="/#features" className="text-gray-600 hover:text-gray-900 transition">Features</a>
              <a href="/#pricing" className="text-gray-600 hover:text-gray-900 transition">Pricing</a>
              <Link href="/docs" className="text-gray-600 hover:text-gray-900 transition">Docs</Link>
              <Link href="/manual" className="text-gray-600 hover:text-gray-900 transition">Manual</Link>
              <Link href="/contact" className="text-gray-600 hover:text-gray-900 transition">Contact</Link>
            </div>
            
            <div className="hidden md:flex items-center gap-4">
              <a href={signInUrl} className="px-4 py-2 text-gray-700 hover:text-gray-900 transition">Sign In</a>
              <a 
                href={ctaUrl} 
                className="px-4 py-2 text-white rounded-lg transition"
                style={{ backgroundColor: theme_primary_color }}
              >
                {ctaText}
              </a>
            </div>
            
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 top-16 bg-white z-40 md:hidden">
          <div className="flex flex-col p-6 gap-4">
            <a href="/#features" className="py-3 text-lg text-gray-700" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="/#pricing" className="py-3 text-lg text-gray-700" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <Link href="/docs" className="py-3 text-lg text-gray-700" onClick={() => setMobileMenuOpen(false)}>Docs</Link>
            <Link href="/manual" className="py-3 text-lg text-gray-700" onClick={() => setMobileMenuOpen(false)}>Manual</Link>
            <Link href="/contact" className="py-3 text-lg text-gray-700" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
            <a href="/#faq" className="py-3 text-lg text-gray-700" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <hr className="my-2" />
            <a href={signInUrl} className="py-3 text-center border border-gray-300 rounded-lg" onClick={() => setMobileMenuOpen(false)}>Sign In</a>
            <a 
              href={ctaUrl} 
              className="py-3 text-center text-white rounded-lg" 
              style={{ backgroundColor: theme_primary_color }}
              onClick={() => setMobileMenuOpen(false)}
            >
              {ctaText}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
