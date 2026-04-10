'use client';

import { useEffect, useMemo, useState } from 'react';

type PackageKey = 'single' | 'pack10' | 'pack40';
type InvoiceChoice = 'NONE' | 'COMPANY';

type InvoiceFormState = {
  companyName: string;
  nip: string;
  addressLine1: string;
  addressLine2: string;
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

const initialInvoiceState: InvoiceFormState = {
  companyName: '',
  nip: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  email: '',
};

function formatPrice(grosze: number) {
  return `${Math.round(grosze / 100)} zł`;
}

export default function PakietyPage() {
  const [loadingKey, setLoadingKey] = useState<PackageKey | null>(null);
  const [invoiceType, setInvoiceType] = useState<InvoiceChoice>('NONE');
  const [invoice, setInvoice] = useState<InvoiceFormState>(initialInvoiceState);

  const [pricing, setPricing] = useState({
    listingSinglePriceGrossPln: 1900,
    listingPack10PriceGrossPln: 14900,
    listingPack40PriceGrossPln: 39900,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      try {
        const res = await fetch('/api/pricing', { cache: 'no-store' });
        const data = (await res.json().catch(() => null)) as PricingResponse | null;

        if (!cancelled && data?.ok && data.pricing) {
          setPricing({
            listingSinglePriceGrossPln: data.pricing.listingSinglePriceGrossPln,
            listingPack10PriceGrossPln: data.pricing.listingPack10PriceGrossPln,
            listingPack40PriceGrossPln: data.pricing.listingPack40PriceGrossPln,
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

  const singlePrice = pricing.listingSinglePriceGrossPln;
  const pack10Price = pricing.listingPack10PriceGrossPln;
  const pack40Price = pricing.listingPack40PriceGrossPln;

  const savingsPack10 = useMemo(() => {
    const value = singlePrice * 10 - pack10Price;
    return value > 0 ? value : 0;
  }, [singlePrice, pack10Price]);

  function updateInvoiceField(key: keyof InvoiceFormState, value: string) {
    setInvoice((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleCheckout(packageKey: PackageKey) {
    try {
      setLoadingKey(packageKey);

      const body =
        invoiceType === 'COMPANY'
          ? {
              packageKey,
              invoiceType,
              invoice,
            }
          : {
              packageKey,
              invoiceType: 'NONE' as const,
            };

      const res = await fetch('/api/stripe/checkout', {
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
      alert(e?.message || 'Nie udało się rozpocząć płatności.');
      setLoadingKey(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#131313] px-6 py-6 text-[#d9d9d9]">
      <div className="mx-auto max-w-[1450px]">
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
            Kupione publikacje są przypisane do Twojego konta i nie wygasają.
          </h1>
        </div>

        <div className="mx-auto mb-6 max-w-[920px]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 md:p-5">
            <div className="mx-auto flex max-w-[520px] gap-3">
              <button
                type="button"
                onClick={() => setInvoiceType('NONE')}
                className={`flex-1 rounded-2xl border px-4 py-4 text-left transition ${
                  invoiceType === 'NONE'
                    ? 'border-[#7aa333]/60 bg-[#7aa333]/12 text-white'
                    : 'border-white/10 bg-black/20 text-white/75 hover:border-white/20'
                }`}
              >
                <div className="text-sm font-semibold">Osoba prywatna</div>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType('COMPANY')}
                className={`flex-1 rounded-2xl border px-4 py-4 text-left transition ${
                  invoiceType === 'COMPANY'
                    ? 'border-[#7aa333]/60 bg-[#7aa333]/12 text-white'
                    : 'border-white/10 bg-black/20 text-white/75 hover:border-white/20'
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
                      className="h-12 w-full rounded-2xl border border-white/20 bg-[#171717] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/40"
                      placeholder="Nazwa firmy"
                    />

                    <input
                      value={invoice.email}
                      onChange={(e) =>
                        updateInvoiceField('email', e.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-white/20 bg-[#171717] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/40"
                      placeholder="Email"
                    />

                    <input
                      value={invoice.nip}
                      onChange={(e) => updateInvoiceField('nip', e.target.value)}
                      className="h-12 w-full rounded-2xl border border-white/20 bg-[#171717] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/40"
                      placeholder="NIP"
                    />
                  </div>

                  <div className="space-y-4">
                    <input
                      value={invoice.addressLine1}
                      onChange={(e) =>
                        updateInvoiceField('addressLine1', e.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-white/20 bg-[#171717] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/40"
                      placeholder="Adres"
                    />

                    <input
                      value={invoice.postalCode}
                      onChange={(e) =>
                        updateInvoiceField('postalCode', e.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-white/20 bg-[#171717] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/40"
                      placeholder="Kod pocztowy"
                    />

                    <input
                      value={invoice.city}
                      onChange={(e) => updateInvoiceField('city', e.target.value)}
                      className="h-12 w-full rounded-2xl border border-white/20 bg-[#171717] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/40"
                      placeholder="Miasto"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]">
            <div className="mb-4">
              <h3 className="text-[32px] font-semibold leading-none text-white">
                Pakiet 1
              </h3>
              <p className="mt-3 text-sm text-[#9f9f9f]">
                Dobry wybór, jeśli chcesz dodać jedną działkę.
              </p>
            </div>

            <div className="mb-2 text-5xl font-bold tracking-tight text-white">
              {formatPrice(singlePrice)}
            </div>

            <p className="mx-auto max-w-[240px] text-sm leading-relaxed text-[#bdbdbd]">
              Pojedyncza publikacja gotowa do użycia od razu po zakupie.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
              <div className="text-sm font-medium text-[#d9d9d9]">
                Co otrzymujesz:
              </div>
              <ul className="mt-3 space-y-2 text-sm text-[#bdbdbd]">
                <li>• 1 publikację ogłoszenia</li>
                <li>• ogłoszenie aktywne 30 dni</li>
                <li>• szybki start sprzedaży</li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('single')}
              disabled={loadingKey !== null}
              className="mt-5 h-12 w-full rounded-2xl bg-[#7aa333] text-base font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
            >
              {loadingKey === 'single' ? 'Przekierowanie…' : 'Kup pakiet'}
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-[#7aa333]/35 bg-[linear-gradient(180deg,rgba(122,163,51,0.16),rgba(255,255,255,0.04))] p-6 text-center shadow-[0_0_0_1px_rgba(122,163,51,0.08)] transition duration-300 hover:-translate-y-1">
            <div className="absolute right-4 top-4 rounded-full border border-[#7aa333]/30 bg-[#7aa333]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9fd14b]">
              Najczęściej wybierany
            </div>

            <div className="mb-4 pt-5">
              <h3 className="text-[32px] font-semibold leading-none text-white">
                Pakiet 10
              </h3>
              <p className="mt-3 text-sm text-[#c8d7a6]">
                Dla osób, które chcą publikować więcej i taniej.
              </p>
            </div>

            <div className="mb-2 text-5xl font-bold tracking-tight text-white">
              {formatPrice(pack10Price)}
            </div>

            <div className="text-sm font-medium text-[#9fd14b]">
              {savingsPack10 > 0
                ? `Oszczędzasz ${formatPrice(savingsPack10)}`
                : 'Lepsza cena za publikację'}
            </div>

            <p className="mx-auto mt-3 max-w-[250px] text-sm leading-relaxed text-[#d6dec4]">
              Najlepszy balans ceny i liczby publikacji.
            </p>

            <div className="mt-5 rounded-2xl border border-[#7aa333]/20 bg-black/20 p-4 text-left">
              <div className="text-sm font-medium text-white">
                Co otrzymujesz:
              </div>
              <ul className="mt-3 space-y-2 text-sm text-[#d6dec4]">
                <li>• 10 publikacji ogłoszeń</li>
                <li>• 1 wyróżnienie do wykorzystania</li>
                <li>• lepszą cenę za publikację</li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('pack10')}
              disabled={loadingKey !== null}
              className="mt-5 h-12 w-full rounded-2xl bg-[#7aa333] text-base font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
            >
              {loadingKey === 'pack10' ? 'Przekierowanie…' : 'Kup pakiet'}
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]">
            <div className="mb-4">
              <h3 className="text-[32px] font-semibold leading-none text-white">
                Pakiet 40
              </h3>
              <p className="mt-3 text-sm text-[#9f9f9f]">
                Dla biur, inwestorów i osób publikujących regularnie.
              </p>
            </div>

            <div className="mb-2 text-5xl font-bold tracking-tight text-white">
              {formatPrice(pack40Price)}
            </div>

            <div className="text-sm font-medium text-[#9fd14b]">
              Najlepsza cena za ogłoszenie
            </div>

            <p className="mx-auto mt-3 max-w-[250px] text-sm leading-relaxed text-[#bdbdbd]">
              Najmocniejsza opcja dla tych, którzy działają szerzej.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
              <div className="text-sm font-medium text-[#d9d9d9]">
                Co otrzymujesz:
              </div>
              <ul className="mt-3 space-y-2 text-sm text-[#bdbdbd]">
                <li>• 40 publikacji ogłoszeń</li>
                <li>• 3 wyróżnienia do wykorzystania</li>
                <li>• najwyższą opłacalność</li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('pack40')}
              disabled={loadingKey !== null}
              className="mt-5 h-12 w-full rounded-2xl bg-[#7aa333] text-base font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
            >
              {loadingKey === 'pack40' ? 'Przekierowanie…' : 'Kup pakiet'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}