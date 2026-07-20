'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatIntPL } from '@/lib/format';
import type { ParcelReport } from '@/lib/uldk';
import { isWideSpread, type PointValuation, type PriceStat } from '@/lib/seoHub';
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

function plDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
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

// Wiersz rozbicia cenowego — renderuje się tylko, gdy podpróbka dobiła progu (pricePerM2 != null).
function PriceRow({ label, stat, sub = false }: { label: string; stat: PriceStat; sub?: boolean }) {
  if (!stat.pricePerM2) return null;
  return (
    <div className="grid grid-cols-[10rem_1fr] items-baseline gap-x-6 border-t border-fg/10 py-3 md:grid-cols-[14rem_1fr]">
      <span
        className={`text-[13px] uppercase tracking-[0.1em] text-fg/45 ${sub ? 'normal-case tracking-normal' : ''}`}
      >
        {label}
      </span>
      <span className="text-[15px] font-medium text-fg">
        {formatIntPL(stat.pricePerM2.median)} zł/m²
        <span className="ml-2 text-[13px] font-normal text-fg/45">
          z {stat.sampleCount} {stat.sampleCount === 1 ? 'oferty' : 'ofert'}
        </span>
      </span>
    </div>
  );
}

// Czy plan wskazuje grunt rolny/leśny. Wtedy raport prowadzi medianą działek rolnych — porównywanie
// pola uprawnego do budowlanych sąsiadów zawyża tak samo, jak odwrotnie zaniżało.
// Konserwatywnie: „zabudowa zagrodowa w gospodarstwach rolnych" to wciąż teren pod budowę.
function looksRolny(mpzp: MpzpInfo | null): boolean {
  if (!mpzp) return false;
  const symbol = (mpzp.functionSymbol ?? '').trim().toUpperCase();
  if (/^(R|RP|RL|ZL|ZR)\d*$/.test(symbol)) return true;
  const name = (mpzp.functionName ?? '').toLowerCase();
  if (!name || /zabudow/.test(name)) return false;
  return /roln|leśn|lesn|upraw|grunt orn/.test(name);
}

// Pula, którą prowadzimy raport. Wcześniej dużą liczbą była mediana WSZYSTKICH typów — w okolicy
// z przewagą pól po 15 zł/m² wychodziło z tego 55 zł/m² także dla działki w mieście. Kto sprawdza
// działkę pod dom, chce mediany budowlanych, nie średniej z gruntami rolnymi.
function pickLead(
  valuation: PointValuation,
  mpzp: MpzpInfo | null
): { label: string; stat: PriceStat } | null {
  const bud = { label: 'działki budowlane', stat: valuation.budowlana };
  const rol = { label: 'działki rolne', stat: valuation.rolna };
  const order = looksRolny(mpzp) ? [rol, bud] : [bud, rol];

  for (const cand of order) if (cand.stat.pricePerM2) return cand;
  if (valuation.pricePerM2) {
    return {
      label: 'wszystkie typy działek',
      stat: { pricePerM2: valuation.pricePerM2, sampleCount: valuation.sampleCount },
    };
  }
  return null;
}

export default function Raport({ data }: { data: RaportData }) {
  const { parcel, valuation, mpzp } = data;
  const lead = pickLead(valuation, mpzp);
  const v = lead?.stat.pricePerM2 ?? null;
  const mixed = isWideSpread(v);
  const [mapShown, setMapShown] = useState(false);

  return (
    <div className="w-full text-left">
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

      {/* MAPA — na mobile full-bleed (pełna szerokość ekranu), na desktopie kafelek w kolumnie. */}
      {mapShown ? (
        <div className="relative left-1/2 mt-6 w-screen -translate-x-1/2 border-y border-fg/12 md:left-auto md:w-full md:translate-x-0 md:overflow-hidden md:rounded-2xl md:border">
          <div className="h-[60vh] max-h-[620px] min-h-[360px] w-full md:h-[460px] md:max-h-none md:min-h-0">
            <RaportMap rings={parcel.rings} center={parcel.center} />
          </div>
        </div>
      ) : null}

      {/* CENA */}
      <div className="mt-8 border-t border-fg/12 pt-8">
        <Eyebrow>Orientacyjna cena okolicy</Eyebrow>
        {v && lead ? (
          <>
            {/* Przy dużym rozrzucie (p90 >= 3x p10) NIE prowadzimy jedną liczbą: w próbce siedzą
                wtedy dwa rynki naraz i mediana kłamie w obie strony. Pokazujemy zakres. */}
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[34px] font-semibold tracking-tight text-fg md:text-[46px]">
                {mixed ? `${formatIntPL(v.low)}–${formatIntPL(v.high)}` : formatIntPL(v.median)}
              </span>
              <span className="text-lg font-medium text-fg/55">zł/m²</span>
              <span className="text-[13px] uppercase tracking-[0.1em] text-fg/45">{lead.label}</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-fg/65">
              {mixed
                ? `Ceny w tej okolicy rozjeżdżają się za mocno, żeby podać jedną liczbę: w promieniu ${valuation.radiusKm} km mamy zarówno teren zabudowany, jak i tańsze działki poza nim. Traktuj to jako widełki, nie wycenę.`
                : `${v.low === v.high ? `${formatIntPL(v.low)} zł/m²` : `Zakres od ${formatIntPL(v.low)} do ${formatIntPL(v.high)} zł/m²`} · w promieniu ${valuation.radiusKm} km.`}{' '}
              Liczone z {lead.stat.sampleCount}{' '}
              {lead.stat.sampleCount === 1 ? 'oferty' : 'ofert'} w naszym serwisie. To orientacja z
              ogłoszeń, nie operat rzeczoznawcy.
            </p>

            {/* Rozbicie: uzbrojone vs bez (przy gęstej okolicy) oraz druga pula dla kontekstu.
                Puste rubryki znikają same. */}
            <div className="empty:hidden mt-6">
              {valuation.budowlanaUzbrojona.pricePerM2 &&
              valuation.budowlanaNieuzbrojona.pricePerM2 ? (
                <>
                  <PriceRow label="Budowlane z uzbrojeniem" stat={valuation.budowlanaUzbrojona} />
                  <PriceRow label="Budowlane bez uzbrojenia" stat={valuation.budowlanaNieuzbrojona} />
                </>
              ) : null}
              {lead.label !== 'działki budowlane' ? (
                <PriceRow label="Działki budowlane" stat={valuation.budowlana} />
              ) : null}
              {lead.label !== 'działki rolne' ? (
                <PriceRow label="Działki rolne" stat={valuation.rolna} />
              ) : null}
            </div>
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
          (() => {
            const hasPurpose = !!(mpzp.functionName || mpzp.functionSymbol);
            const hasDetails =
              hasPurpose || !!mpzp.maxHeight || !!mpzp.intensity || !!mpzp.effectiveFrom || !!mpzp.resolution;
            return (
              <>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-fg/80">
                  Dla tej działki obowiązuje miejscowy plan zagospodarowania
                  {mpzp.planName ? (
                    <>
                      {' '}
                      „<span className="text-fg">{mpzp.planName}</span>”
                    </>
                  ) : null}
                  .{hasDetails ? ' Najważniejsze, co z niego wynika:' : ''}
                </p>
                {hasDetails ? (
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
                    <Row label="Obowiązuje od" value={plDate(mpzp.effectiveFrom)} />
                    <Row label="Uchwała" value={mpzp.resolution} />
                  </div>
                ) : null}
                {!hasPurpose ? (
                  <p className="mt-4 max-w-2xl text-[13px] leading-7 text-fg/55">
                    Samo przeznaczenie dla tego punktu nie zostało udostępnione przez gminę w
                    krajowej integracji. Podejrzyj plan jako warstwę na mapie powyżej albo dopytaj w
                    gminie o zapis dla tej działki.
                  </p>
                ) : null}
              </>
            );
          })()
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
