// Wspólne CIAŁO karty oferty (cena → tytuł → lokalizacja → fakty), wyrównane do lewej.
// Jedno źródło prawdy dla listy /kup, raili (home / podobne) i popupu mapy — Wariant B.
// Hierarchia: cena i tytuł na biało (mocno), lokalizacja szara (oddech), reszta (powierzchnia,
// przeznaczenie, media) znów na biało z dopracowanymi białymi ikonami. Bez przycisku CTA —
// cała karta jest klikalna, osobny przycisk byłby zbędny i mylący. Bez 'use client'.
//
// `horizontal` (lista /kup na desktopie): karta pozioma o stałej wysokości; treść u góry,
// a w wolnym miejscu na dole kreska + „Oferta prywatna" / logo biura. Mobile bez zmian.

import type { ReactNode } from 'react';
import type { SprzedajacyTyp } from '@prisma/client';
import { offerPriceLabel, pricePerM2, formatIntPL } from '@/lib/format';
import { IconPin, IconArea, IconLayers, IconPlug, IconUser, IconBuilding } from './CardIcons';
import { OfficeLogo } from './OfficeLogo';

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
  horizontal = false,
  sellerType,
  biuroNazwa,
  biuroLogoUrl,
  heartSlot,
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
  /** Lista /kup na desktopie: karta pozioma o stałej wysokości; stopka sprzedawcy u dołu. */
  horizontal?: boolean;
  sellerType?: SprzedajacyTyp | null;
  biuroNazwa?: string | null;
  biuroLogoUrl?: string | null;
  /** Serduszko ulubionych (klienckie) — renderowane w prawym dolnym rogu, nad kreską sprzedawcy. */
  heartSlot?: ReactNode;
}) {
  const price = offerPriceLabel(cena);
  const zlM2 = isRent ? 0 : pricePerM2(cena, area);
  const ic = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className={`${compact ? 'px-4 py-4' : 'p-5 pt-6 lg:pt-5'} ${horizontal ? 'lg:flex lg:h-full lg:flex-col' : ''}`}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {price ? (
              <span className={`${compact ? 'text-[19px]' : 'text-[22px]'} font-semibold leading-none text-fg`}>
                {price}
                {isRent ? <span className="text-[13px] font-normal text-fg/72">/mc</span> : null}
              </span>
            ) : (
              <span className="rounded-full bg-brand/15 px-3 py-1 text-[14px] font-medium leading-none text-brand-bright">
                Zapytaj o cenę
              </span>
            )}
            {zlM2 ? <span className="text-[13px] leading-none text-fg/68">· {formatIntPL(zlM2)} zł/m²</span> : null}
          </div>
          {heartSlot ? <div className="-mt-1 shrink-0">{heartSlot}</div> : null}
        </div>

        {tytul ? (
          <div
            className={`mt-2 line-clamp-2 font-medium leading-snug text-fg/95 ${
              compact ? 'text-[15px]' : 'text-[16px] md:text-[17px]'
            }`}
          >
            {tytul}
          </div>
        ) : null}

        <div
          className={`flex items-center gap-1.5 text-fg/68 ${tytul ? 'mt-2' : 'mt-2.5'} ${
            compact ? 'text-[13px]' : 'text-[15px]'
          }`}
        >
          <IconPin className={`${ic} shrink-0 text-fg/64`} />
          <span className="truncate">{loc}</span>
        </div>

        <div
          className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-fg/90 ${
            compact ? 'mt-2.5 text-[12px]' : 'mt-3 text-[14px]'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <IconArea className={`${ic} shrink-0 text-fg/75`} />
            {formatIntPL(area)} m²
          </span>
          {przezn && przezn !== '—' ? (
            <span className="inline-flex items-center gap-1.5">
              <IconLayers className={`${ic} shrink-0 text-fg/75`} />
              {przezn}
            </span>
          ) : null}
          {media ? (
            <span className="inline-flex items-center gap-1.5">
              <IconPlug className={`${ic} shrink-0 text-fg/75`} />
              {media}
            </span>
          ) : null}
        </div>

        {extra ? <div className="mt-3">{extra}</div> : null}
      </div>

      {sellerType ? (
        <div
          className={`mt-4 flex items-center gap-2.5 border-t border-fg/10 pt-3.5 ${
            horizontal ? 'lg:mt-auto' : ''
          }`}
        >
          {sellerType === 'BIURO' ? (
            biuroLogoUrl ? (
              <OfficeLogo src={biuroLogoUrl} alt={biuroNazwa ?? ''} variant="card" />
            ) : (
              <IconBuilding className="h-4 w-4 shrink-0 text-fg/70" />
            )
          ) : (
            <IconUser className="h-4 w-4 shrink-0 text-fg/70" />
          )}
          <span className="text-[13px] text-fg/70">
            {sellerType === 'BIURO' ? 'Oferta biura nieruchomości' : 'Oferta prywatna'}
          </span>
        </div>
      ) : null}
    </div>
  );
}
