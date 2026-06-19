// Wspólne CIAŁO karty oferty (cena → tytuł → lokalizacja → fakty), wyrównane do lewej.
// Jedno źródło prawdy dla listy /kup, raili (home / podobne) i popupu mapy — Wariant B.
// Hierarchia: cena i tytuł na biało (mocno), lokalizacja szara (oddech), reszta (powierzchnia,
// przeznaczenie, media) znów na biało z dopracowanymi białymi ikonami. Bez przycisku CTA —
// cała karta jest klikalna, osobny przycisk byłby zbędny i mylący. Bez 'use client'.

import type { ReactNode } from 'react';
import { offerPriceLabel, pricePerM2, formatIntPL } from '@/lib/format';
import { IconPin, IconArea, IconLayers, IconPlug } from './CardIcons';

export function CardBody({
  cena,
  isRent,
  tytul,
  loc,
  area,
  przezn,
  media,
  compact = false,
  extra,
}: {
  cena: number;
  isRent: boolean;
  /** Pominięty na mapie (w ciasnym popupie zbędny). */
  tytul?: string | null;
  loc: string;
  area: number;
  /** Gotowa etykieta przeznaczeń, np. „Budowlana, Rolna" lub „—". */
  przezn: string;
  /** Gotowa etykieta mediów, np. „Prąd, Woda" lub null. */
  media: string | null;
  compact?: boolean;
  /** Dodatkowy slot na końcu (np. plakietka „Lokalizacja przybliżona" na mapie). */
  extra?: ReactNode;
}) {
  const price = offerPriceLabel(cena);
  const zlM2 = isRent ? 0 : pricePerM2(cena, area);
  const ic = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className={compact ? 'px-4 py-4' : 'p-5'}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {price ? (
          <span className={`${compact ? 'text-[19px]' : 'text-[22px]'} font-semibold leading-none text-white`}>
            {price}
            {isRent ? <span className="text-[13px] font-normal text-white/60">/mc</span> : null}
          </span>
        ) : (
          <span className="rounded-full bg-[#7aa333]/15 px-3 py-1 text-[14px] font-medium leading-none text-[#9fd14b]">
            Zapytaj o cenę
          </span>
        )}
        {zlM2 ? <span className="text-[13px] leading-none text-white/45">· {formatIntPL(zlM2)} zł/m²</span> : null}
      </div>

      {tytul ? (
        <div
          className={`mt-2 line-clamp-2 font-medium leading-snug text-white/95 ${
            compact ? 'text-[15px]' : 'text-[16px] md:text-[17px]'
          }`}
        >
          {tytul}
        </div>
      ) : null}

      <div
        className={`flex items-center gap-1.5 text-white/45 ${tytul ? 'mt-2' : 'mt-2.5'} ${
          compact ? 'text-[13px]' : 'text-[15px]'
        }`}
      >
        <IconPin className={`${ic} shrink-0 text-white/40`} />
        <span className="truncate">{loc}</span>
      </div>

      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-white/90 ${
          compact ? 'mt-2.5 text-[12px]' : 'mt-3 text-[14px]'
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <IconArea className={`${ic} shrink-0 text-white/75`} />
          {formatIntPL(area)} m²
        </span>
        {przezn && przezn !== '—' ? (
          <span className="inline-flex items-center gap-1.5">
            <IconLayers className={`${ic} shrink-0 text-white/75`} />
            {przezn}
          </span>
        ) : null}
        {media ? (
          <span className="inline-flex items-center gap-1.5">
            <IconPlug className={`${ic} shrink-0 text-white/75`} />
            {media}
          </span>
        ) : null}
      </div>

      {extra ? <div className="mt-3">{extra}</div> : null}
    </div>
  );
}
