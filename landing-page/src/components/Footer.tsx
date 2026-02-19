import { Link } from 'wouter';
import { useBranding } from '../context/BrandingContext';

export default function Footer() {
  const { platform_name, theme_primary_color } = useBranding();

  return (
    <footer className="bg-gray-900 text-gray-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="w-8 h-8 text-white rounded-lg flex items-center justify-center font-bold"
                style={{ backgroundColor: theme_primary_color }}
              >
                {platform_name.charAt(0)}
              </span>
              <span className="text-xl font-bold text-white">{platform_name}</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              The all-in-one platform for banks, Saccos, microfinance institutions, and chamas across Africa. Loans, savings, accounting, M-Pesa -- all in one place.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="/#features" className="hover:text-white transition">Features</a></li>
              <li><a href="/#pricing" className="hover:text-white transition">Pricing</a></li>
              <li><a href="/#how-it-works" className="hover:text-white transition">How It Works</a></li>
              <li><a href="/#testimonials" className="hover:text-white transition">Testimonials</a></li>
              <li><Link href="/docs" className="hover:text-white transition">Documentation</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/contact" className="hover:text-white transition">Contact Us</Link></li>
              <li><a href="/#faq" className="hover:text-white transition">FAQ</a></li>
              <li><a href="mailto:sales@banky.co.ke" className="hover:text-white transition">Enterprise Sales</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">
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
          <div className="flex items-center gap-4">
            <a href="mailto:info@banky.co.ke" className="text-sm hover:text-white transition">
              info@banky.co.ke
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
