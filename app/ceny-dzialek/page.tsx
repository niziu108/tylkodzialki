import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import PriceStatsTable from '@/components/PriceStatsTable';
import { getVoivodeshipPriceStats } from '@/lib/priceStats';
import { getSeoRegion } from '@/lib/seo-locations';
import { formatIntPL } from '@/lib/format';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Ceny działek w Polsce: średnie stawki zł/m² po województwach',
  description:
    'Aktualne ceny działek w Polsce. Mediana ceny za metr kwadratowy w każdym województwie, liczona na bieżąco z ofert na sprzedaż. Sprawdź, gdzie działki są tańsze, a gdzie droższe.',
  alternates: {
    canonical: '/ceny-dzialek',
  },
};

function formatPlDate(d: Date) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export default async function CenyDzialekPage() {
  const stats = await getVoivodeshipPriceStats();

  const withData = stats.regions.filter((r) => r.hasData);
  const cheapest = withData[withData.length - 1];
  const priciest = withData[0];

  return (
    <main className="pb-24 pt-0">
      <div className="mx-auto max-w-6xl px-3 pt-6 md:px-4">
        <Breadcrumbs
          items={[
            { label: 'Strona główna', href: '/' },
            { label: 'Ceny działek' },
          ]}
        />
      </div>

      <section className="mx-auto mt-8 max-w-6xl px-3 md:px-4">
        <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-4xl">
          Ceny działek w Polsce
        </h1>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-fg/72 md:text-[15px]">
          Ile kosztuje metr kwadratowy działki? Poniżej znajdziesz medianę ceny za
          metr w każdym województwie, policzoną na bieżąco z aktualnych ofert na
          sprzedaż. Mediana lepiej niż średnia oddaje typową cenę, bo nie zawyżają
          jej pojedyncze drogie działki. Kliknij województwo, aby przejść do ofert
          w okolicy.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <div className="rounded-2xl border border-brand/25 bg-brand/10 px-5 py-4">
            <div className="text-[12px] uppercase tracking-[0.16em] text-fg/55">
              Mediana krajowa
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-brand-bright">
              {formatIntPL(stats.nationalMedian)} zł/m²
            </div>
          </div>

          {priciest ? (
            <div className="rounded-2xl border border-fg/10 bg-fg/[0.025] px-5 py-4">
              <div className="text-[12px] uppercase tracking-[0.16em] text-fg/55">
                Najdrożej
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-fg">
                {formatIntPL(priciest.median)} zł/m²
              </div>
              <div className="text-[12px] text-fg/55">
                {getSeoRegion(priciest.slug)?.name ?? priciest.label}
              </div>
            </div>
          ) : null}

          {cheapest && cheapest !== priciest ? (
            <div className="rounded-2xl border border-fg/10 bg-fg/[0.025] px-5 py-4">
              <div className="text-[12px] uppercase tracking-[0.16em] text-fg/55">
                Najtaniej
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-fg">
                {formatIntPL(cheapest.median)} zł/m²
              </div>
              <div className="text-[12px] text-fg/55">
                {getSeoRegion(cheapest.slug)?.name ?? cheapest.label}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-3 md:px-4">
        <h2 className="text-lg font-semibold text-fg md:text-xl">
          Średnie ceny działek według województw
        </h2>
        <p className="mt-2 text-[13px] text-fg/55">
          Mediana zł/m², malejąco. W nawiasie pomocniczo średnia. Dane na dzień{' '}
          {formatPlDate(stats.computedAt)}, próba {formatIntPL(stats.nationalSample)} ofert.
        </p>

        <div className="mt-6">
          <PriceStatsTable regions={stats.regions} showAvg />
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-3 md:px-4">
        <div className="rounded-3xl border border-fg/10 bg-fg/[0.025] p-6 md:p-8">
          <h2 className="text-lg font-semibold text-fg md:text-xl">
            Jak liczymy ceny działek
          </h2>
          <div className="mt-4 max-w-4xl space-y-3 text-sm leading-7 text-fg/70 md:text-[15px]">
            <p>
              Dla każdej aktywnej oferty dzielimy cenę przez powierzchnię i tak
              otrzymujemy cenę za metr kwadratowy. Dla województwa podajemy medianę
              tych stawek, czyli wartość środkową: połowa działek jest tańsza, a
              połowa droższa. Mediana jest odporna na pojedyncze skrajne oferty,
              dlatego pokazuje typową cenę lepiej niż zwykła średnia.
            </p>
            <p>
              Pod uwagę bierzemy tylko oferty z podaną ceną i powierzchnią, a
              skrajne, nierealne stawki za metr odrzucamy jako błędy w danych.
              Województwo ustalamy na podstawie lokalizacji oferty. Liczby
              aktualizują się automatycznie razem z napływem i wygasaniem ogłoszeń,
              więc zestawienie zawsze odzwierciedla bieżący rynek.
            </p>
            <p>
              Województwa, w których mamy jeszcze za mało ofert na wiarygodną
              statystykę, oznaczamy jako {'„za mało ofert"'}. Pojawią się w zestawieniu,
              gdy przybędzie ogłoszeń.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-3 md:px-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Link
            href="/kup"
            className="inline-flex text-sm text-fg/72 transition hover:text-fg"
          >
            Przeglądaj działki na sprzedaż →
          </Link>
          <Link
            href="/dzialki"
            className="inline-flex text-sm text-fg/72 transition hover:text-fg"
          >
            Działki według lokalizacji →
          </Link>
        </div>
      </section>
    </main>
  );
}
