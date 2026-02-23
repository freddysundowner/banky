import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Branding {
  platform_name: string;
  support_email: string;
  theme_primary_color: string;
  theme_secondary_color: string;
  theme_accent_color: string;
  theme_sidebar_color: string;
  guide_url: string;
  deployment_mode: string;
  logo_url: string;
  favicon_url: string;
}

const defaultBranding: Branding = {
  platform_name: 'BANKYKIT',
  support_email: '',
  theme_primary_color: '#2563eb',
  theme_secondary_color: '#64748b',
  theme_accent_color: '#10b981',
  theme_sidebar_color: '#1e293b',
  guide_url: '',
  deployment_mode: 'saas',
  logo_url: '',
  favicon_url: '',
};

const BrandingContext = createContext<Branding>(defaultBranding);

function generateBankFaviconSvg(primaryColor: string): string {
  const color = encodeURIComponent(primaryColor || '#2563eb');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="6" fill="${primaryColor || '#2563eb'}"/>
    <polygon points="4,13 16,6 28,13" fill="white"/>
    <rect x="7" y="14" width="3" height="10" rx="0.5" fill="white"/>
    <rect x="14.5" y="14" width="3" height="10" rx="0.5" fill="white"/>
    <rect x="22" y="14" width="3" height="10" rx="0.5" fill="white"/>
    <rect x="5" y="24" width="22" height="2.5" rx="0.5" fill="white"/>
  </svg>`.replace(/\n\s*/g, ' ');
  void color;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

async function fetchBranding(): Promise<Branding> {
  const res = await fetch('/api/public/branding');
  if (!res.ok) return defaultBranding;
  const data = await res.json();
  return { ...defaultBranding, ...data };
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: fetchBranding,
    staleTime: 5 * 60 * 1000,
  });

  const active = branding || defaultBranding;

  useEffect(() => {
    if (active.favicon_url) {
      setFavicon(active.favicon_url);
    } else if (active.logo_url) {
      setFavicon(active.logo_url);
    } else {
      setFavicon(generateBankFaviconSvg(active.theme_primary_color));
    }
  }, [active.favicon_url, active.logo_url, active.theme_primary_color]);

  return (
    <BrandingContext.Provider value={active}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
