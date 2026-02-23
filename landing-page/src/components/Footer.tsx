import { Link } from 'wouter';
import { useBranding } from '../context/BrandingContext';

export default function Footer() {
  const { platform_name, theme_primary_color } = useBranding();

  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 text-white rounded-md flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: theme_primary_color }}
            >
              {platform_name.charAt(0)}
            </span>
            <span className="text-white font-semibold">{platform_name}</span>
            <span className="text-gray-600 text-sm ml-2">
              &copy; {new Date().getFullYear()}
            </span>
          </div>

          <nav className="flex items-center flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
            <a href="/#features" className="hover:text-white transition">Features</a>
            <a href="/#pricing" className="hover:text-white transition">Pricing</a>
            <Link href="/docs" className="hover:text-white transition">Docs</Link>
            <Link href="/contact" className="hover:text-white transition">Contact</Link>
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
          </nav>

          <a
            href="mailto:info@banky.co.ke"
            className="text-sm text-gray-400 hover:text-white transition"
          >
            info@banky.co.ke
          </a>
        </div>
      </div>
    </footer>
  );
}
