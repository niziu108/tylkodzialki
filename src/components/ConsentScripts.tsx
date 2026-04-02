'use client';

import { useEffect, useState } from 'react';

type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

const COOKIE_NAME = 'td_cookie_consent';

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

export default function ConsentScripts() {
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    setConsent(readConsent());

    const onUpdate = (event: Event) => {
      const custom = event as CustomEvent<ConsentState>;
      setConsent(custom.detail ?? readConsent());
    };

    window.addEventListener('cookie-consent-updated', onUpdate);
    return () => window.removeEventListener('cookie-consent-updated', onUpdate);
  }, []);

  useEffect(() => {
    if (!consent?.analytics) return;

    // TU PÓŹNIEJ WŁĄCZYSZ np. GA4, Plausible albo inne analityczne narzędzie.
    // Na razie nic się nie ładuje bez zgody.
    console.log('Cookies analityczne: aktywne');
  }, [consent?.analytics]);

  useEffect(() => {
    if (!consent?.marketing) return;

    // TU PÓŹNIEJ WŁĄCZYSZ np. Meta Pixel / Google Ads / remarketing.
    console.log('Cookies marketingowe: aktywne');
  }, [consent?.marketing]);

  return null;
}