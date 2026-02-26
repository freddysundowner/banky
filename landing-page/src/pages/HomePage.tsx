import Hero from '../components/Hero';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import MobileApp from '../components/MobileApp';
import Pricing from '../components/Pricing';
import FAQ from '../components/FAQ';
import CTA from '../components/CTA';
import { useBranding } from '../context/BrandingContext';

export default function HomePage() {
  const branding = useBranding();
  const isSaaS = branding.deployment_mode !== 'enterprise';

  return (
    <>
      <Hero />
      <Features />
      <MobileApp />
      <HowItWorks />
      {isSaaS && <Pricing />}
      <FAQ />
      <CTA />
    </>
  );
}
