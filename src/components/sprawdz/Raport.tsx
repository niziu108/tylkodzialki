'use client';

import Link from 'next/link';
import { formatIntPL } from '@/lib/format';
import type { ParcelReport } from '@/lib/uldk';
import type { PointValuation } from '@/lib/seoHub';
import RaportMap from './RaportMap';

// P24: raport „Sprawdź działkę" w naszym stylu. Wiersze specyfikacji (linie, nie pigułki —
// [[feedback-ui-podkreslenia]]), obrys na mapie, orientacyjna wycena z naszych ofert i klaster
// linków „co sprawdzić dalej". Zero zmyślania: co niepewne, tam odsyłamy do źródła.

export type RaportData = { parcel: ParcelReport; valuation: PointValuation };

// Żywe artykuły (potwierdzone w bazie) — linkowanie wewnętrzne domyka P4b/P25.
const NEXT_STEPS: { href: string; label: string }[] = [
  { href: '/blog/jak-sprawdzic-mpzp-dzialki-przed-zakupem', label: 'Jak sprawdzić plan miejscowy (MPZP)' },
  { href: '/blog/jak-sprawdzic-klase-gruntu-dzialki-przed-zakupem', label: 'Jak sprawdzić klasę gruntu' },
  { href: '/blog/jak-sprawdzic-uzbrojenie-dzialki-przed-zakupem', label: 'Jak sprawdzić uzbrojenie' },
  { href: '/blog/jak-sprawdzic-droge-dojazdowa-do-dzialki-przed-zakupem', label: 'Jak sprawdzić drogę dojazdową' },
  { href: '/blog/jak-sprawdzic-ksiege-wieczysta-dzialki-przed-zakupem', label: 'Jak sprawdzić księgę wieczystą' },
  { href: '/blog/jak-sprawdzic-dzialke-przed-zakupem', label: 'Pełna checklista przed zakupem' },
];

function areaLabel(m2: number): string {
  const base = `${formatIntPL(m2)} m²`;
  if (m2 >= 5000) {
    const ha = (m2 / 10000).toLocaleString('pl-PL', { maximumFractionDigits: 2 });
    return `${base} (${ha} ha)`;
  }
  if (m2 >= 1000) {
    const ar = (m2 / 100).toLocaleString('pl-PL', { maximumFractionDigits: 0 });
    return `${base} (${ar} ar)`;
  }
  return base;
}

function SpecRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-fg/10 py-3">
      <span className="text-[13px] uppercase tracking-[0.12em] text-fg/55">{label}</span>
      <span className="text-right text-[15px] font-medium text-fg">{value}</span>
    </div>
  );
}

export default function Raport({ data }: { data: RaportData }) {
  const { parcel, valuation } = data;
  const v = valuation.pricePerM2;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Mapa z obrysem */}
      <div className="overflow-hidden rounded-[28px] border border-fg/12 bg-surface-2/60">
        <div className="h-[320px] w-full sm:h-[380px]">
          <RaportMap rings={parcel.rings} center={parcel.center} />
        </div>
      </div>

      {/* Dane działki */}
      <div className="rounded-[28px] border border-fg/12 bg-surface-2/60 p-6 md:p-7">
        <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">Twoja działka</div>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-fg">
          {areaLabel(parcel.areaM2)}
        </h3>

        <div className="mt-5">
          <SpecRow label="Numer działki" value={parcel.parcelNumber} />
          <SpecRow label="Identyfikator" value={parcel.id} />
          <SpecRow label="Obręb" value={parcel.region} />
          <SpecRow label="Gmina" value={parcel.commune} />
          <SpecRow label="Powiat" value={parcel.county} />
          <SpecRow label="Województwo" value={parcel.voivodeship} />
        </div>

        <p className="mt-4 text-xs leading-6 text-fg/55">
          Granice i powierzchnia pochodzą z ewidencji gruntów (ULDK, GUGiK) dla wskazanego przez
          Ciebie punktu.
        </p>
      </div>

      {/* Wycena */}
      <div className="rounded-[28px] border border-fg/12 bg-surface-2/60 p-6 md:p-7">
        <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
          Orientacyjna cena okolicy
        </div>

        {v ? (
          <>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-fg">
              ≈ {formatIntPL(v.median)} zł/m²
            </h3>
            <p className="mt-2 text-sm text-fg/70">
              {v.low === v.high
                ? `${formatIntPL(v.low)} zł/m²`
                : `Zakres od ${formatIntPL(v.low)} do ${formatIntPL(v.high)} zł/m²`}{' '}
              · na podstawie {valuation.sampleCount}{' '}
              {valuation.sampleCount === 1 ? 'oferty' : 'ofert'} w promieniu {valuation.radiusKm} km.
            </p>
            <p className="mt-3 text-xs leading-6 text-fg/55">
              To orientacja z aktualnych ogłoszeń w serwisie, nie operat rzeczoznawcy. O cenie
              decydują media, dojazd, kształt i przeznaczenie konkretnej działki.
            </p>
          </>
        ) : (
          <>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-fg">
              Za mało ofert w okolicy
            </h3>
            <p className="mt-2 text-sm leading-6 text-fg/70">
              W promieniu {valuation.radiusKm} km mamy zbyt mało porównywalnych działek, żeby
              uczciwie oszacować cenę. Nie zgadujemy.
            </p>
          </>
        )}
      </div>

      {/* Co sprawdzić dalej */}
      <div className="rounded-[28px] border border-fg/12 bg-surface-2/60 p-6 md:p-7">
        <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
          Co sprawdzić dalej
        </div>
        <p className="mt-3 text-sm leading-6 text-fg/70">
          Plan miejscowy, uzbrojenie, dojazd i księgę wieczystą sprawdza się osobno w gminie i
          źródłach urzędowych. Prowadzimy Cię krok po kroku:
        </p>

        <div className="mt-4 flex flex-col divide-y divide-fg/10 border-t border-fg/10">
          {NEXT_STEPS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center justify-between gap-4 py-3 text-[15px] text-fg/85 transition hover:text-brand-bright"
            >
              {s.label}
              <span aria-hidden className="text-fg/35">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
