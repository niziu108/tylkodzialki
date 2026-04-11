'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

const COOKIE_NAME = 'td_cookie_consent';
const GA_ID = 'G-V9YZ7E7EBD';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));

  return match ? decodeURIComponent(match[1]) : null;
}

function readConsent(): ConsentState | null {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ConsentState;
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    __tdGaConfigured?: boolean;
  }
}

export default function GoogleAnalyticsConsent() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    setEnabled(existing?.analytics === true);

    const onUpdate = (event: Event) => {
      const custom = event as CustomEvent<ConsentState>;
      const consent = custom.detail ?? readConsent();
      setEnabled(consent?.analytics === true);
    };

    window.addEventListener('cookie-consent-updated', onUpdate);
    return () => window.removeEventListener('cookie-consent-updated', onUpdate);
  }, []);

  if (!enabled) return null;

  return (
    <Script
      id="td-ga-script"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      strategy="afterInteractive"
      onLoad={() => {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag(...args: unknown[]) {
          window.dataLayer.push(args);
        };

        if (window.__tdGaConfigured) return;
        window.__tdGaConfigured = true;

        window.gtag('js', new Date());
        window.gtag('config', GA_ID, {
          debug_mode: true,
          anonymize_ip: true,
          send_page_view: true,
        });

        console.log('[TD] GA loaded');
      }}
    />
  );
}