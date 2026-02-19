import { useState } from 'react';
import { Route, Switch } from 'wouter';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import DocsPage from './pages/DocsPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import ContactPage from './pages/ContactPage';

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
    </div>
  );
}
