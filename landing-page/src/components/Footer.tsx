import { Link } from 'wouter';
import { useBranding } from '../context/BrandingContext';

export default function Footer() {
  const { platform_name, theme_primary_color } = useBranding();

  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span 
              className="w-8 h-8 text-white rounded-lg flex items-center justify-center font-bold"
              style={{ backgroundColor: theme_primary_color }}
            >
              {platform_name.charAt(0)}
            </span>
            <span className="text-xl font-bold text-white">{platform_name}</span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <Link href="/docs" className="hover:text-white transition">Docs</Link>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          <p>
            &copy; {new Date().getFullYear()} {platform_name}. Built by{' '}
            <a 
              href="https://reggycodas.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition"
            >
              ReggyCodas
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
