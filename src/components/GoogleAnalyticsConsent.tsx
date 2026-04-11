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
const GA_ID = 'G-QSBPVGMT2W';

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
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="td-google-analytics-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;

          if (!window.__tdGaConfigured) {
            window.__tdGaConfigured = true;
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              anonymize_ip: true,
              send_page_view: true
            });
            console.log('[TD] GA configured: ${GA_ID}');
          }
        `}
      </Script>
    </>
  );
}