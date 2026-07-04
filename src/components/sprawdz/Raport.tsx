'use client';

import Link from 'next/link';
import { formatIntPL } from '@/lib/format';
import type { ParcelReport } from '@/lib/uldk';
import type { PointValuation } from '@/lib/seoHub';
import RaportMap from './RaportMap';

// P24: raport „Sprawdź działkę" — układ redakcyjny (przepływ na całą szerokość, cienkie linie
// zamiast kafelków), premium jak „portal za 100M". Cena jest ważna, ale klasą (typografia), nie
// zielenią. Zero zmyślania: co niepewne, odsyłamy do źródła ([[feedback-filtry-twarde]]).

export type RaportData = {
  parcel: ParcelReport;
  valuation: PointValuation;
  elevationM: number | null;
};

// Żywe artykuły (potwierdzone w bazie) — linkowanie wewnętrzne domyka P4b/P25.
const NEXT_STEPS: { href: string; label: string }[] = [
  { href: '/blog/jak-sprawdzic-mpzp-dzialki-przed-zakupem', label: 'Jak sprawdzić plan miejscowy (MPZP)' },
  { href: '/blog/jak-sprawdzic-klase-gruntu-dzialki-przed-zakupem', label: 'Jak sprawdzić klasę gruntu' },
  { href: '/blog/jak-sprawdzic-uzbrojenie-dzialki-przed-zakupem', label: 'Jak sprawdzić uzbrojenie' },
  { href: '/blog/jak-sprawdzic-droge-dojazdowa-do-dzialki-przed-zakupem', label: 'Jak sprawdzić drogę dojazdową' },
  { href: '/blog/jak-sprawdzic-ksiege-wieczysta-dzialki-przed-zakupem', label: 'Jak sprawdzić księgę wieczystą' },
  { href: '/blog/jak-sprawdzic-dzialke-przed-zakupem', label: 'Pełna checklista przed zakupem' },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] uppercase tracking-[0.2em] text-fg/45">{children}</div>;
}

function areaLabel(m2: number): string {
  const base = `${formatIntPL(m2)} m²`;
  if (m2 >= 5000) return `${base} · ${(m2 / 10000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} ha`;
  if (m2 >= 1000) return `${base} · ${(m2 / 100).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} ar`;
  return base;
}

function SpecRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-fg/10 py-4">
      <span className="text-[13px] uppercase tracking-[0.12em] text-fg/45">{label}</span>
      <span className="text-right text-[15px] font-medium text-fg md:text-base">{value}</span>
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
  const { parcel, valuation, elevationM } = data;
  const v = valuation.pricePerM2;
  const media = valuation.mediaShares;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="w-full">
      {isExample ? (
        <div className="mb-6">
          <Eyebrow>Przykładowy raport</Eyebrow>
          <p className="mt-2 text-sm text-fg/60">
            Tak wygląda raport, który dostaniesz. Wskaż własną działkę wyżej, a policzymy ją na
            żywo.
          </p>
        </div>
      ) : null}

      {/* MAPA — pełna szerokość, wysoka */}
      <div className="overflow-hidden rounded-[24px] border border-fg/12">
        <div className="h-[420px] w-full md:h-[560px]">
          <RaportMap rings={parcel.rings} center={parcel.center} />
        </div>
      </div>

      {/* NAGŁÓWEK */}
      <div className="mt-10">
        <Eyebrow>Twoja działka</Eyebrow>
        <h3 className="mt-3 text-3xl font-semibold tracking-tight text-fg md:text-5xl">
          {areaLabel(parcel.areaM2)}
        </h3>
        <p className="mt-3 text-[15px] text-fg/65">
          {[parcel.commune, parcel.county, parcel.voivodeship].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* CENA — ważna klasą, nie zielenią */}
      <div className="mt-10 border-y border-fg/12 py-8">
        <Eyebrow>Orientacyjna cena okolicy</Eyebrow>
        {v ? (
          <>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-4xl font-semibold tracking-tight text-fg md:text-6xl">
                {formatIntPL(v.median)}
              </span>
              <span className="text-lg font-medium text-fg/55 md:text-xl">zł/m²</span>
            </div>
            <p className="mt-3 text-sm text-fg/65">
              {v.low === v.high
                ? `${formatIntPL(v.low)} zł/m²`
                : `Zakres od ${formatIntPL(v.low)} do ${formatIntPL(v.high)} zł/m²`}{' '}
              · na podstawie {valuation.sampleCount}{' '}
              {valuation.sampleCount === 1 ? 'oferty' : 'ofert'} w promieniu {valuation.radiusKm} km.
            </p>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-fg/45">
              To orientacja z aktualnych ogłoszeń, nie operat rzeczoznawcy. O cenie decydują media,
              dojazd, kształt i przeznaczenie konkretnej działki.
            </p>
          </>
        ) : (
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-fg/65">
            W promieniu {valuation.radiusKm} km mamy zbyt mało porównywalnych działek, żeby uczciwie
            oszacować cenę. Nie zgadujemy.
          </p>
        )}
      </div>

      {/* MEDIA W OKOLICY — realny sygnał z naszych danych zamiast zmyślonej odległości do rury */}
      {media ? (
        <div className="mt-10">
          <Eyebrow>Media w okolicy</Eyebrow>
          <p className="mt-2 text-sm text-fg/60">
            Udział działek z danym medium na działce wśród {valuation.offersNearby} ofert w promieniu{' '}
            {valuation.radiusKm} km.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-fg/12 bg-fg/10 md:grid-cols-4">
            {[
              { label: 'Prąd', value: media.prad },
              { label: 'Wodociąg', value: media.woda },
              { label: 'Gaz', value: media.gaz },
              { label: 'Kanalizacja', value: media.kanalizacja },
            ].map((m) => (
              <div key={m.label} className="bg-bg px-5 py-6">
                <div className="text-3xl font-semibold tracking-tight text-fg">{pct(m.value)}</div>
                <div className="mt-1 text-[13px] text-fg/55">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* DANE DZIAŁKI */}
      <div className="mt-10">
        <Eyebrow>Dane z ewidencji</Eyebrow>
        <div className="mt-5 border-t border-fg/10">
          <SpecRow label="Numer działki" value={parcel.parcelNumber} />
          <SpecRow
            label="Wymiary (ok.)"
            value={parcel.dims ? `${parcel.dims.widthM} × ${parcel.dims.depthM} m` : null}
          />
          <SpecRow label="Wysokość n.p.m." value={elevationM != null ? `${elevationM} m` : null} />
          <SpecRow label="Obręb" value={parcel.region} />
          <SpecRow label="Identyfikator" value={parcel.id} />
          <SpecRow label="Gmina" value={parcel.commune} />
          <SpecRow label="Powiat" value={parcel.county} />
          <SpecRow label="Województwo" value={parcel.voivodeship} />
        </div>
        <p className="mt-4 text-xs leading-6 text-fg/45">
          Granice, powierzchnia i numer pochodzą z ewidencji gruntów (ULDK, GUGiK) dla wskazanego
          przez Ciebie punktu. Wymiary to boki prostokąta opisanego na działce, orientacyjnie.
        </p>
      </div>

      {/* CO SPRAWDZIĆ DALEJ — w stylu FAQ (czysta lista z liniami) */}
      <div className="mt-14">
        <h3 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
          Co sprawdzić dalej
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-fg/60">
          Plan miejscowy, uzbrojenie, dojazd i księgę wieczystą sprawdza się osobno w gminie i
          źródłach urzędowych. Prowadzimy Cię krok po kroku:
        </p>
        <div className="mt-6 border-t border-fg/10">
          {NEXT_STEPS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center justify-between gap-4 border-b border-fg/10 py-4 text-[15px] text-fg/85 transition hover:text-fg"
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
