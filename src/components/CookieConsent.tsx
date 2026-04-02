'use client';

import { useEffect, useMemo, useState } from 'react';

type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

const COOKIE_NAME = 'td_cookie_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 dni

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function readConsent(): ConsentState | null {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ConsentState;
    if (
      parsed &&
      parsed.necessary === true &&
      typeof parsed.analytics === 'boolean' &&
      typeof parsed.marketing === 'boolean'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveConsent(consent: ConsentState) {
  setCookie(COOKIE_NAME, JSON.stringify(consent), COOKIE_MAX_AGE);
  window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: consent }));
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
  }, []);

  useEffect(() => {
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
        <div className="fixed inset-x-0 bottom-0 z-[160] px-4 pb-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-[#111111]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[1.5fr_auto] lg:items-end">
              <div className="space-y-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7aa333]">
                  Pliki cookies
                </p>

                <p className="text-sm leading-7 text-white/72">
                  Używamy niezbędnych plików cookies, aby serwis działał prawidłowo. Za Twoją zgodą
                  możemy także używać cookies analitycznych i marketingowych. Możesz zaakceptować,
                  odrzucić opcjonalne albo ustawić swoje preferencje.
                </p>

                <p className="text-xs leading-6 text-white/45">
                  Więcej informacji znajdziesz w Polityce cookies i Polityce prywatności.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={rejectOptional}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/12 px-5 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  Odrzucam opcjonalne
                </button>

                <button
                  onClick={() => {
                    setShowSettings(true);
                    setShowBanner(false);
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/12 px-5 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  Ustawienia
                </button>

                <button
                  onClick={acceptAll}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#7aa333] px-5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Akceptuję wszystkie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-[#111111] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7aa333]">
                  Ustawienia cookies
                </p>
                <h2 className="text-2xl font-semibold text-white">Zarządzaj zgodą</h2>
                <p className="text-sm leading-7 text-white/65">
                  Możesz w każdej chwili zmienić swoje preferencje. Cookies niezbędne są zawsze aktywne,
                  ponieważ odpowiadają za podstawowe działanie serwisu.
                </p>
              </div>

              <button
                onClick={() => {
                  const existing = readConsent();
                  setShowSettings(false);
                  if (!existing) setShowBanner(true);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/5 hover:text-white"
                aria-label="Zamknij"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-white">Niezbędne</h3>
                    <p className="text-sm leading-7 text-white/60">
                      Odpowiadają za logowanie, bezpieczeństwo, zapis sesji i podstawowe działanie strony.
                    </p>
                  </div>

                  <div className="rounded-full border border-[#7aa333]/30 bg-[#7aa333]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#7aa333]">
                    Zawsze aktywne
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-white">Analityczne</h3>
                    <p className="text-sm leading-7 text-white/60">
                      Pomagają mierzyć ruch i ulepszać portal na podstawie statystyk odwiedzin.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAnalytics((v) => !v)}
                    className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
                      analytics ? 'bg-[#7aa333]' : 'bg-white/15'
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

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-white">Marketingowe</h3>
                    <p className="text-sm leading-7 text-white/60">
                      Umożliwiają mierzenie skuteczności reklam i korzystanie z narzędzi marketingowych.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMarketing((v) => !v)}
                    className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
                      marketing ? 'bg-[#7aa333]' : 'bg-white/15'
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
                onClick={rejectOptional}
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/12 px-5 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Odrzucam opcjonalne
              </button>

              <button
                onClick={saveSelected}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#7aa333] px-5 text-sm font-medium text-white transition hover:opacity-90"
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