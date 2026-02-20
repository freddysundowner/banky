import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Branding {
  platform_name: string;
  support_email: string;
  theme_primary_color: string;
  theme_secondary_color: string;
  theme_accent_color: string;
  theme_sidebar_color: string;
  deployment_mode: string;
}

const defaultBranding: Branding = {
  platform_name: 'BANKY',
  support_email: '',
  theme_primary_color: '#2563eb',
  theme_secondary_color: '#64748b',
  theme_accent_color: '#10b981',
  theme_sidebar_color: '#1e293b',
  deployment_mode: 'saas',
};

const BrandingContext = createContext<Branding>(defaultBranding);

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

  return (
    <BrandingContext.Provider value={branding || defaultBranding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
