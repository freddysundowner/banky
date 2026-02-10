import { useState } from 'react';
import { Route, Switch } from 'wouter';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import DocsPage from './pages/DocsPage';

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <Switch>
      <Route path="/docs">
        <DocsPage />
      </Route>
      <Route>
        <div className="min-h-screen bg-white">
          <Navbar 
            mobileMenuOpen={mobileMenuOpen} 
            setMobileMenuOpen={setMobileMenuOpen} 
          />
          <HomePage />
          <Footer />
        </div>
      </Route>
    </Switch>
  );
}
