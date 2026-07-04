'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatIntPL } from '@/lib/format';
import type { ParcelReport } from '@/lib/uldk';
import type { PointValuation } from '@/lib/seoHub';
import type { MpzpInfo } from '@/lib/mpzp';
import RaportMap from './RaportMap';

// P24: raport „Sprawdź działkę" — układ redakcyjny (wszystko od lewej, cienkie linie zamiast
// kafelków), zielone nagłówki. Mapa schowana za przyciskiem „Zobacz na mapie", żeby nie dominowała.
// Zero zmyślania: co niepewne, odsyłamy do źródła ([[feedback-filtry-twarde]]).

export type RaportData = {
  parcel: ParcelReport;
  valuation: PointValuation;
  mpzp: MpzpInfo | null;
};

const NEXT_STEPS: { href: string; label: string }[] = [
  { href: '/blog/jak-sprawdzic-mpzp-dzialki-przed-zakupem', label: 'Jak czytać plan miejscowy (MPZP)' },
  { href: '/blog/jak-sprawdzic-klase-gruntu-dzialki-przed-zakupem', label: 'Jak sprawdzić klasę gruntu' },
  { href: '/blog/jak-sprawdzic-uzbrojenie-dzialki-przed-zakupem', label: 'Jak sprawdzić uzbrojenie' },
  { href: '/blog/jak-sprawdzic-droge-dojazdowa-do-dzialki-przed-zakupem', label: 'Jak sprawdzić drogę dojazdową' },
  { href: '/blog/jak-sprawdzic-ksiege-wieczysta-dzialki-przed-zakupem', label: 'Jak sprawdzić księgę wieczystą' },
  { href: '/blog/jak-sprawdzic-dzialke-przed-zakupem', label: 'Pełna checklista przed zakupem' },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] uppercase tracking-[0.2em] text-brand-text">{children}</div>;
}

function areaLabel(m2: number): string {
  const base = `${formatIntPL(m2)} m²`;
  if (m2 >= 5000) return `${base} · ${(m2 / 10000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} ha`;
  if (m2 >= 1000) return `${base} · ${(m2 / 100).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} ar`;
  return base;
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[10rem_1fr] items-baseline gap-x-6 border-b border-fg/10 py-3 md:grid-cols-[14rem_1fr]">
      <span className="text-[13px] uppercase tracking-[0.1em] text-fg/45">{label}</span>
      <span className="text-[15px] font-medium text-fg">{value}</span>
    </div>
  );
}

export default function Raport({
  data,
  isExample = false,
}: {
  data: RaportData;
  isExample?: boolean;
}) {
  const { parcel, valuation, mpzp } = data;
  const v = valuation.pricePerM2;
  const [mapShown, setMapShown] = useState(false);

  return (
    <div className="w-full text-left">
      {isExample ? (
        <div className="mb-8 border-l-2 border-brand/50 pl-4">
          <Eyebrow>Przykładowy raport</Eyebrow>
          <p className="mt-1 text-sm text-fg/60">
            Tak wygląda raport. Wskaż własną działkę wyżej, a policzymy ją na żywo.
          </p>
        </div>
      ) : null}

      {/* NAGŁÓWEK + przycisk mapy */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Twoja działka</Eyebrow>
          <h3 className="mt-2 text-[26px] font-semibold tracking-tight text-fg md:text-[38px]">
            {areaLabel(parcel.areaM2)}
          </h3>
          <p className="mt-2 text-[15px] text-fg/65">
            {[parcel.commune, parcel.county, parcel.voivodeship].filter(Boolean).join(' · ')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMapShown((s) => !s)}
          className="inline-flex items-center gap-2 rounded-xl border border-fg/20 px-4 py-2.5 text-sm font-medium text-fg/80 transition hover:border-brand/50 hover:text-fg"
        >
          {mapShown ? 'Ukryj mapę' : 'Zobacz na mapie'}
          <span aria-hidden>→</span>
        </button>
      </div>

      {/* MAPA — rozwijana */}
      <div
        className={`overflow-hidden transition-all duration-300 ${mapShown ? 'mt-6 max-h-[520px]' : 'max-h-0'}`}
      >
        <div className="overflow-hidden rounded-2xl border border-fg/12">
          <div className="h-[380px] w-full md:h-[460px]">
            <RaportMap rings={parcel.rings} center={parcel.center} />
          </div>
        </div>
      </div>

      {/* CENA */}
      <div className="mt-8 border-t border-fg/12 pt-8">
        <Eyebrow>Orientacyjna cena okolicy</Eyebrow>
        {v ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[34px] font-semibold tracking-tight text-fg md:text-[46px]">
                {formatIntPL(v.median)}
              </span>
              <span className="text-lg font-medium text-fg/55">zł/m²</span>
            </div>
            <p className="mt-2 text-sm text-fg/65">
              {v.low === v.high
                ? `${formatIntPL(v.low)} zł/m²`
                : `Zakres od ${formatIntPL(v.low)} do ${formatIntPL(v.high)} zł/m²`}{' '}
              · z {valuation.sampleCount} {valuation.sampleCount === 1 ? 'oferty' : 'ofert'} w
              promieniu {valuation.radiusKm} km. To orientacja z ogłoszeń, nie operat rzeczoznawcy.
            </p>
          </>
        ) : (
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-fg/65">
            W promieniu {valuation.radiusKm} km mamy zbyt mało porównywalnych działek, żeby uczciwie
            oszacować cenę. Nie zgadujemy.
          </p>
        )}
      </div>

      {/* PLAN MIEJSCOWY (MPZP) */}
      <div className="mt-8 border-t border-fg/12 pt-8">
        <Eyebrow>Plan miejscowy (MPZP)</Eyebrow>
        {mpzp ? (
          <>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-fg/80">
              Dla tej działki obowiązuje miejscowy plan zagospodarowania
              {mpzp.planName ? (
                <>
                  {' '}
                  „<span className="text-fg">{mpzp.planName}</span>”
                </>
              ) : null}
              . Najważniejsze, co z niego wynika:
            </p>
            <div className="mt-5 border-t border-fg/10">
              <Row
                label="Przeznaczenie"
                value={
                  mpzp.functionName
                    ? mpzp.functionSymbol
                      ? `${mpzp.functionName} (${mpzp.functionSymbol})`
                      : mpzp.functionName
                    : mpzp.functionSymbol
                }
              />
              <Row label="Maks. wysokość zabudowy" value={mpzp.maxHeight ? `${mpzp.maxHeight} m` : null} />
              <Row label="Intensywność zabudowy" value={mpzp.intensity} />
            </div>
          </>
        ) : (
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-fg/70">
            W tym punkcie nie ma planu miejscowego w krajowej integracji. Zwykle znaczy to, że o
            zabudowie decydują warunki zabudowy (WZ).{' '}
            <Link
              href="/blog/warunki-zabudowy-wz-co-to-jest"
              className="text-brand-text underline decoration-1 underline-offset-2 hover:text-brand-bright"
            >
              Sprawdź, czym są warunki zabudowy
            </Link>{' '}
            i dopytaj w gminie.
          </p>
        )}
      </div>

      {/* DANE Z EWIDENCJI */}
      <div className="mt-8 border-t border-fg/12 pt-8">
        <Eyebrow>Dane z ewidencji</Eyebrow>
        <div className="mt-5 border-t border-fg/10">
          <Row label="Numer działki" value={parcel.parcelNumber} />
          <Row label="Obręb" value={parcel.region} />
          <Row label="Identyfikator" value={parcel.id} />
          <Row label="Gmina" value={parcel.commune} />
          <Row label="Powiat" value={parcel.county} />
          <Row label="Województwo" value={parcel.voivodeship} />
        </div>
        <p className="mt-3 text-xs leading-6 text-fg/45">
          Granice, powierzchnia i numer z ewidencji gruntów (ULDK, GUGiK) dla wskazanego punktu.
        </p>
      </div>

      {/* CO SPRAWDZIĆ DALEJ */}
      <div className="mt-10 border-t border-fg/12 pt-8">
        <h3 className="text-xl font-semibold tracking-tight text-brand-text md:text-2xl">
          Co sprawdzić dalej
        </h3>
        <div className="mt-5 border-t border-fg/10">
          {NEXT_STEPS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center justify-between gap-4 border-b border-fg/10 py-3.5 text-[15px] text-fg/85 transition hover:text-fg"
            >
              {s.label}
              <span aria-hidden className="text-fg/35 transition group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
