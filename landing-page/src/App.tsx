import { useState } from 'react';
import { Route, Switch } from 'wouter';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import DocsPage from './pages/DocsPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import ContactPage from './pages/ContactPage';
import ManualPage from './pages/ManualPage';
import { useBranding } from './context/BrandingContext';

function WhatsAppButton() {
  const { support_whatsapp } = useBranding();
  if (!support_whatsapp) return null;
  const number = support_whatsapp.replace(/[^0-9]/g, '');
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-110"
      style={{ backgroundColor: '#25D366' }}
    >
      <svg viewBox="0 0 32 32" width="28" height="28" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.002 2C8.269 2 2 8.268 2 16c0 2.49.65 4.826 1.787 6.854L2 30l7.347-1.763A13.94 13.94 0 0016.002 30C23.73 30 30 23.732 30 16S23.73 2 16.002 2zm0 25.385a11.71 11.71 0 01-5.97-1.636l-.428-.254-4.36 1.046 1.075-4.25-.278-.44A11.742 11.742 0 014.25 16c0-6.482 5.273-11.755 11.752-11.755C22.484 4.245 27.75 9.518 27.75 16S22.484 27.385 16.002 27.385zm6.44-8.797c-.353-.177-2.09-1.03-2.413-1.147-.324-.118-.56-.177-.796.177-.235.353-.913 1.147-1.119 1.383-.206.235-.412.265-.765.088-.353-.177-1.49-.549-2.839-1.75-1.05-.935-1.758-2.09-1.964-2.443-.206-.353-.022-.544.155-.72.159-.158.353-.412.53-.618.177-.206.235-.353.353-.589.118-.235.059-.441-.029-.618-.088-.177-.796-1.917-1.09-2.625-.287-.689-.578-.596-.796-.607l-.678-.012c-.235 0-.618.088-.941.441-.324.353-1.237 1.208-1.237 2.948s1.266 3.42 1.443 3.656c.177.235 2.49 3.803 6.03 5.333.843.364 1.5.581 2.012.744.846.27 1.617.232 2.226.14.679-.101 2.09-.853 2.385-1.677.294-.823.294-1.53.206-1.677-.088-.148-.324-.235-.678-.412z"/>
      </svg>
    </a>
  );
}

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <Navbar 
        mobileMenuOpen={mobileMenuOpen} 
        setMobileMenuOpen={setMobileMenuOpen} 
      />
      <Switch>
        <Route path="/docs">
          <DocsPage />
        </Route>
        <Route path="/manual">
          <ManualPage />
        </Route>
        <Route path="/terms">
          <TermsPage />
        </Route>
        <Route path="/privacy">
          <PrivacyPage />
        </Route>
        <Route path="/contact">
          <ContactPage />
        </Route>
        <Route>
          <HomePage />
        </Route>
      </Switch>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
