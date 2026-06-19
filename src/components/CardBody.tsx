// Wspólne CIAŁO karty oferty (cena → tytuł → lokalizacja → fakty → CTA), wyrównane do lewej.
// Jedno źródło prawdy dla listy /kup, raili (home / podobne) i popupu mapy — Wariant B.
// Styl premium i powściągliwy: bez ramek, bez ikon, fakty jako czysty tekst z separatorami,
// zieleń wyłącznie jako akcent na hover/status. Bez 'use client' → serwer i klient.

import type { ReactNode } from 'react';
import { offerPriceLabel, pricePerM2, formatIntPL } from '@/lib/format';

export function CardBody({
  cena,
  isRent,
  tytul,
  loc,
  area,
  przezn,
  media,
  cta = true,
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
  cta?: boolean;
  compact?: boolean;
  /** Dodatkowy slot przed CTA (np. plakietka „Lokalizacja przybliżona" na mapie). */
  extra?: ReactNode;
}) {
  const price = offerPriceLabel(cena);
  const zlM2 = isRent ? 0 : pricePerM2(cena, area);
  const facts = [
    `${formatIntPL(area)} m²`,
    przezn && przezn !== '—' ? przezn : null,
    media || null,
  ]
    .filter(Boolean)
    .join('  ·  ');

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
        {zlM2 ? <span className="text-[13px] leading-none text-white/40">· {formatIntPL(zlM2)} zł/m²</span> : null}
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
        className={`truncate text-white/55 ${tytul ? 'mt-1.5' : 'mt-2'} ${compact ? 'text-[13px]' : 'text-[14px]'}`}
      >
        {loc}
      </div>

      {facts ? (
        <div className={`leading-relaxed text-white/45 ${compact ? 'mt-2.5 text-[12px]' : 'mt-3 text-[13px]'}`}>
          {facts}
        </div>
      ) : null}

      {extra ? <div className="mt-3">{extra}</div> : null}

      {cta ? (
        <div className="mt-4">
          <span className="flex items-center justify-center rounded-xl bg-white/[0.08] py-2.5 text-[12px] font-medium text-white transition group-hover:bg-[#7aa333] group-hover:text-[#0c0c0c]">
            Zobacz ofertę
          </span>
        </div>
      ) : null}
    </div>
  );
}
