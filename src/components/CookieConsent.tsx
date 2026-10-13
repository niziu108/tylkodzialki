'use client';

import { useEffect, useMemo, useState } from 'react';

type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

const COOKIE_NAME = 'td_cookie_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 365 dni

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));

  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === 'undefined') return;

  const isHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
    isHttps ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;

  const isHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

  document.cookie = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
    isHttps ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function readConsent(): ConsentState | null {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;

    if (
      parsed &&
      parsed.necessary === true &&
      typeof parsed.analytics === 'boolean' &&
      typeof parsed.marketing === 'boolean' &&
      typeof parsed.updatedAt === 'string'
    ) {
      return {
        necessary: true,
        analytics: parsed.analytics,
        marketing: parsed.marketing,
        updatedAt: parsed.updatedAt,
      };
    }

    deleteCookie(COOKIE_NAME);
    return null;
  } catch {
    deleteCookie(COOKIE_NAME);
    return null;
  }
}

function saveConsent(consent: ConsentState) {
  setCookie(COOKIE_NAME, JSON.stringify(consent), COOKIE_MAX_AGE);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cookie-consent-updated', { detail: consent })
    );
  }
}

declare global {
  interface Window {
    openCookieSettings?: () => void;
  }
}

export default function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setMounted(true);

    const existing = readConsent();

    if (!existing) {
      setShowBanner(true);
      return;
    }

    setAnalytics(existing.analytics);
    setMarketing(existing.marketing);
    setShowBanner(false);
    setShowSettings(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.openCookieSettings = () => {
      const existing = readConsent();

      setAnalytics(existing?.analytics ?? false);
      setMarketing(existing?.marketing ?? false);
      setShowSettings(true);
      setShowBanner(false);
    };

    return () => {
      delete window.openCookieSettings;
    };
  }, []);

  const consentPreview = useMemo<ConsentState>(
    () => ({
      necessary: true,
      analytics,
      marketing,
      updatedAt: new Date().toISOString(),
    }),
    [analytics, marketing]
  );

  const acceptAll = () => {
    const consent: ConsentState = {
      necessary: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    };

    saveConsent(consent);
    setAnalytics(true);
    setMarketing(true);
    setShowBanner(false);
    setShowSettings(false);
  };

  const rejectOptional = () => {
    const consent: ConsentState = {
      necessary: true,
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
    };

    saveConsent(consent);
    setAnalytics(false);
    setMarketing(false);
    setShowBanner(false);
    setShowSettings(false);
  };

  const saveSelected = () => {
    saveConsent(consentPreview);
    setShowBanner(false);
    setShowSettings(false);
  };

  if (!mounted) return null;

  return (
    <>
      {showBanner && (
        // Wąski pasek przy dole ekranu, jak na dużych portalach: jedno zdanie i przyciski
        // w jednej linii. Wcześniej karta na ok. 300 px zasłaniała środek strony głównej.
        // „Odrzucam" jest tak samo dostępne jak „Akceptuję" (wymóg RODO, bez ukrywania odmowy).
        <div className="fixed inset-x-0 bottom-0 z-[160] px-3 pb-3 sm:px-6 sm:pb-5">
          <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl border border-fg/10 bg-surface/95 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.12)] backdrop-blur-md md:flex-row md:items-center md:gap-6 md:px-5 md:py-3.5">
            <p className="text-[13px] leading-5 text-fg/75 md:flex-1 md:text-[14px]">
              Używamy cookies niezbędnych do działania serwisu, a za Twoją zgodą także analitycznych
              i marketingowych.{' '}
              <a href="/cookies" className="text-fg/80 underline decoration-fg/25 underline-offset-2 transition hover:text-fg">
                Polityka cookies
              </a>
            </p>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSettings(true);
                  setShowBanner(false);
                }}
                className="mr-1 px-2 text-[13px] text-fg/70 underline decoration-fg/25 underline-offset-4 transition hover:text-fg"
              >
                Ustawienia
              </button>
              <button
                type="button"
                onClick={rejectOptional}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-fg/15 px-4 text-[13px] font-medium text-fg/85 transition hover:bg-fg/5 hover:text-fg md:flex-none"
              >
                Odrzucam
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-brand px-4 text-[13px] font-semibold text-ink transition hover:bg-brand-strong md:flex-none"
              >
                Akceptuję
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[32px] border border-fg/10 bg-surface-2 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.12)] sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-brand-text">
                  Ustawienia cookies
                </p>
                <h2 className="text-2xl font-semibold text-fg">
                  Zarządzaj zgodą
                </h2>
                <p className="text-sm leading-7 text-fg/70">
                  Możesz w każdej chwili zmienić swoje preferencje. Cookies
                  niezbędne są zawsze aktywne, ponieważ odpowiadają za podstawowe
                  działanie serwisu.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const existing = readConsent();
                  setShowSettings(false);
                  if (!existing) setShowBanner(true);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-fg/10 text-fg/70 transition hover:bg-fg/5 hover:text-fg"
                aria-label="Zamknij"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-fg/10 bg-fg/[0.03] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-fg">
                      Niezbędne
                    </h3>
                    <p className="text-sm leading-7 text-fg/72">
                      Odpowiadają za logowanie, bezpieczeństwo, zapis sesji i
                      podstawowe działanie strony.
                    </p>
                  </div>

                  <div className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-brand-text">
                    Zawsze aktywne
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-fg/10 bg-fg/[0.03] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-fg">
                      Analityczne
                    </h3>
                    <p className="text-sm leading-7 text-fg/72">
                      Pomagają mierzyć ruch i ulepszać portal na podstawie
                      statystyk odwiedzin.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAnalytics((v) => !v)}
                    className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
                      analytics ? 'bg-brand' : 'bg-fg/15'
                    }`}
                    aria-pressed={analytics}
                    aria-label="Przełącz cookies analityczne"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        analytics ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-fg/10 bg-fg/[0.03] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-fg">
                      Marketingowe
                    </h3>
                    <p className="text-sm leading-7 text-fg/72">
                      Umożliwiają mierzenie skuteczności reklam i korzystanie z
                      narzędzi marketingowych.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMarketing((v) => !v)}
                    className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
                      marketing ? 'bg-brand' : 'bg-fg/15'
                    }`}
                    aria-pressed={marketing}
                    aria-label="Przełącz cookies marketingowe"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        marketing ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={rejectOptional}
                className="inline-flex h-11 items-center justify-center rounded-full border border-fg/12 px-5 text-sm text-fg/80 transition hover:bg-fg/5 hover:text-fg"
              >
                Odrzucam opcjonalne
              </button>

              <button
                type="button"
                onClick={saveSelected}
                className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-medium text-fg transition hover:opacity-90"
              >
                Zapisz ustawienia
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}