'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type FeaturedPackageKey = 'featured_1' | 'featured_3';
type InvoiceChoice = 'NONE' | 'COMPANY';

type InvoiceFormState = {
  companyName: string;
  nip: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  email: string;
};

type PricingResponse = {
  ok: boolean;
  pricing?: {
    listingSinglePriceGrossPln: number;
    listingPack10PriceGrossPln: number;
    listingPack40PriceGrossPln: number;
    featuredSinglePriceGrossPln: number;
    featuredPack3PriceGrossPln: number;
  };
};

type CreditsResponse = {
  ok: boolean;
  credits?: {
    listingCredits: number;
    listingCreditsExpiresAt: string | null;
    featuredCredits: number;
    featuredCreditsExpiresAt: string | null;
  };
};

const initialInvoiceState: InvoiceFormState = {
  companyName: '',
  nip: '',
  addressLine1: '',
  postalCode: '',
  city: '',
  email: '',
};

function formatPrice(grosze: number) {
  return `${Math.round(grosze / 100)} zł`;
}

function formatDatePL(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('pl-PL');
}

function WyroznieniaPageContent() {
  const [loadingKey, setLoadingKey] = useState<FeaturedPackageKey | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [invoiceType, setInvoiceType] = useState<InvoiceChoice>('NONE');
  const [invoice, setInvoice] = useState<InvoiceFormState>(initialInvoiceState);

  const [pricing, setPricing] = useState({
    featuredSinglePriceGrossPln: 1900,
    featuredPack3PriceGrossPln: 3900,
  });

  const [credits, setCredits] = useState<CreditsResponse['credits'] | null>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function loadCredits() {
      try {
        const res = await fetch('/api/user/credits', { cache: 'no-store' });
        const data = (await res.json().catch(() => null)) as CreditsResponse | null;

        if (!cancelled && data?.ok && data.credits) {
          setCredits(data.credits);
        }
      } catch (e) {
        console.error('LOAD_CREDITS_ERROR', e);
      }
    }

    loadCredits();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      try {
        const res = await fetch('/api/pricing', { cache: 'no-store' });
        const data = (await res.json().catch(() => null)) as PricingResponse | null;

        if (!cancelled && data?.ok && data.pricing) {
          setPricing({
            featuredSinglePriceGrossPln: data.pricing.featuredSinglePriceGrossPln,
            featuredPack3PriceGrossPln: data.pricing.featuredPack3PriceGrossPln,
          });
        }
      } catch (e) {
        console.error('LOAD_PRICING_ERROR', e);
      }
    }

    loadPricing();

    return () => {
      cancelled = true;
    };
  }, []);

  const dzialkaId = useMemo(() => {
    const raw = searchParams.get('dzialkaId');
    return raw && raw.trim() ? raw.trim() : null;
  }, [searchParams]);

  function updateInvoiceField(key: keyof InvoiceFormState, value: string) {
    setInvoice((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleCheckout(packageKey: FeaturedPackageKey) {
    try {
      setCheckoutError(null);
      setLoadingKey(packageKey);

      const body =
        invoiceType === 'COMPANY'
          ? {
              packageKey,
              dzialkaId,
              invoiceType,
              invoice,
            }
          : {
              packageKey,
              dzialkaId,
              invoiceType: 'NONE' as const,
            };

      const res = await fetch('/api/stripe/checkout-featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.url) {
        throw new Error(data?.message || 'Nie udało się rozpocząć płatności.');
      }

      window.location.href = data.url;
    } catch (e: any) {
      setCheckoutError(e?.message || 'Nie udało się rozpocząć płatności.');
      setLoadingKey(null);
    }
  }

  return (
    <main className="min-h-screen bg-bg px-6 py-6 text-fg/85">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-4xl">
            Kupione wyróżnienia są przypisane do Twojego konta i nie wygasają.
          </h1>

          {credits && credits.featuredCredits > 0 ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/12 px-5 py-2 text-sm font-semibold text-brand-bright">
              Dostępne wyróżnienia: {credits.featuredCredits}
              {credits.featuredCreditsExpiresAt
                ? ` · ważne do ${formatDatePL(credits.featuredCreditsExpiresAt)}`
                : ''}
            </div>
          ) : null}
        </div>

        {checkoutError ? (
          <div className="mx-auto mb-6 max-w-[920px] rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {checkoutError}
          </div>
        ) : null}

        <div className="mx-auto mb-6 max-w-[920px]">
          <div className="rounded-[28px] border border-fg/10 bg-fg/[0.04] p-4 md:p-5">
            <div className="mx-auto flex max-w-[520px] gap-3">
              <button
                type="button"
                onClick={() => setInvoiceType('NONE')}
                className={`flex-1 rounded-2xl border px-4 py-4 text-left transition ${
                  invoiceType === 'NONE'
                    ? 'border-brand/60 bg-brand/12 text-fg'
                    : 'border-fg/10 bg-surface text-fg/75 hover:border-fg/20'
                }`}
              >
                <div className="text-sm font-semibold">Osoba prywatna</div>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType('COMPANY')}
                className={`flex-1 rounded-2xl border px-4 py-4 text-left transition ${
                  invoiceType === 'COMPANY'
                    ? 'border-brand/60 bg-brand/12 text-fg'
                    : 'border-fg/10 bg-surface text-fg/75 hover:border-fg/20'
                }`}
              >
                <div className="text-sm font-semibold">Firma</div>
              </button>
            </div>

            {invoiceType === 'COMPANY' ? (
              <div className="mx-auto mt-5 max-w-[920px]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <input
                      value={invoice.companyName}
                      onChange={(e) =>
                        updateInvoiceField('companyName', e.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-fg/20 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/35 focus:border-fg/40"
                      placeholder="Nazwa firmy"
                    />

                    <input
                      value={invoice.email}
                      onChange={(e) => updateInvoiceField('email', e.target.value)}
                      className="h-12 w-full rounded-2xl border border-fg/20 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/35 focus:border-fg/40"
                      placeholder="Email"
                    />

                    <input
                      value={invoice.nip}
                      onChange={(e) => updateInvoiceField('nip', e.target.value)}
                      className="h-12 w-full rounded-2xl border border-fg/20 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/35 focus:border-fg/40"
                      placeholder="NIP"
                    />
                  </div>

                  <div className="space-y-4">
                    <input
                      value={invoice.addressLine1}
                      onChange={(e) =>
                        updateInvoiceField('addressLine1', e.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-fg/20 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/35 focus:border-fg/40"
                      placeholder="Adres"
                    />

                    <input
                      value={invoice.postalCode}
                      onChange={(e) =>
                        updateInvoiceField('postalCode', e.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-fg/20 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/35 focus:border-fg/40"
                      placeholder="Kod pocztowy"
                    />

                    <input
                      value={invoice.city}
                      onChange={(e) => updateInvoiceField('city', e.target.value)}
                      className="h-12 w-full rounded-2xl border border-fg/20 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/35 focus:border-fg/40"
                      placeholder="Miasto"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-[28px] border border-fg/10 bg-fg/5 p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-fg/20 hover:bg-fg/[0.07]">
            <div className="mb-4">
              <h3 className="text-[32px] font-semibold leading-none text-fg">
                Pakiet 1
              </h3>
              <p className="mt-3 text-sm text-fg/55">
                Dobry wybór, jeśli chcesz wyróżnić jedno ogłoszenie.
              </p>
            </div>

            <div className="mb-2 text-5xl font-bold tracking-tight text-fg">
              {formatPrice(pricing.featuredSinglePriceGrossPln)}
            </div>

            <p className="mx-auto max-w-[240px] text-sm leading-relaxed text-fg/70">
              Jedno wyróżnienie gotowe do użycia od razu po zakupie.
            </p>

            <div className="mt-5 rounded-2xl border border-fg/10 bg-surface p-4 text-left">
              <div className="text-sm font-medium text-fg/85">
                Co otrzymujesz:
              </div>
              <ul className="mt-3 space-y-2 text-sm text-fg/70">
                <li>• 1 wyróżnienie ogłoszenia</li>
                <li>• aktywność przez 7 dni</li>
                <li>• zieloną ramkę premium</li>
                <li>• wyższą pozycję na liście ofert</li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('featured_1')}
              disabled={loadingKey !== null}
              className="mt-5 h-12 w-full rounded-2xl bg-brand text-base font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
            >
              {loadingKey === 'featured_1' ? 'Przekierowanie…' : 'Kup pakiet'}
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-brand/35 bg-[linear-gradient(180deg,rgba(122,163,51,0.16),rgba(255,255,255,0.04))] p-6 text-center shadow-[0_0_0_1px_rgba(122,163,51,0.08)] transition duration-300 hover:-translate-y-1">
            <div className="absolute right-4 top-4 rounded-full border border-brand/30 bg-brand/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-bright">
              Najczęściej wybierany
            </div>

            <div className="mb-4 pt-5">
              <h3 className="text-[32px] font-semibold leading-none text-fg">
                Pakiet 3
              </h3>
              <p className="mt-3 text-sm text-brand-text">
                Dla osób, które chcą promować więcej ofert i taniej.
              </p>
            </div>

            <div className="mb-2 text-5xl font-bold tracking-tight text-fg">
              {formatPrice(pricing.featuredPack3PriceGrossPln)}
            </div>

            <div className="text-sm font-medium text-brand-bright">
              Najlepsza cena za wyróżnienie
            </div>

            <p className="mx-auto mt-3 max-w-[250px] text-sm leading-relaxed text-brand-text">
              Najlepszy balans ceny i liczby wyróżnień.
            </p>

            <div className="mt-5 rounded-2xl border border-brand/20 bg-surface p-4 text-left">
              <div className="text-sm font-medium text-fg">
                Co otrzymujesz:
              </div>
              <ul className="mt-3 space-y-2 text-sm text-brand-text">
                <li>• 3 wyróżnienia do wykorzystania</li>
                <li>• każde działa przez 7 dni</li>
                <li>• wyższe pozycje na liście ofert</li>
                <li>• najlepszą opłacalność</li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('featured_3')}
              disabled={loadingKey !== null}
              className="mt-5 h-12 w-full rounded-2xl bg-brand text-base font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
            >
              {loadingKey === 'featured_3' ? 'Przekierowanie…' : 'Kup pakiet'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function WyroznieniaPageFallback() {
  return (
    <main className="min-h-screen bg-bg px-6 py-6 text-fg/85">
      <div className="mx-auto max-w-[1120px]">
        <div className="text-center text-fg/60">Ładowanie…</div>
      </div>
    </main>
  );
}

export default function WyroznieniaPage() {
  return (
    <Suspense fallback={<WyroznieniaPageFallback />}>
      <WyroznieniaPageContent />
    </Suspense>
  );
}