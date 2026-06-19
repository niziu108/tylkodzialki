'use client';

import { useEffect, useRef, useState } from 'react';
import type { MapPoint } from './KupMap';
import { CardBody } from './CardBody';
import { IconCamera } from './CardIcons';
import { parcelMediaLabel } from '@/lib/media';

/* ────────────────────────────────────────────────────────────────────────────
 *  Karta oferty pokazywana po kliknięciu pinu (P11). Renderowana jako WŁASNY
 *  panel nad mapą (nie w dymku Google) — pełna kontrola nad wyglądem: ostry
 *  tekst, spójne kolory, responsywna szerokość, brak obcinania na telefonie.
 *  Ciało (cena/lokalizacja/chipy/CTA) to wspólny `CardBody` — identyczne z listą
 *  i „podobnymi" (Wariant B). Bez tytułu (w ciasnym popupie zbędny). Zdjęcia
 *  (karuzela) doładowywane dopiero po kliknięciu pinu — mapa zostaje lekka.
 * ──────────────────────────────────────────────────────────────────────────── */

const PRZEZN_LABEL: Record<string, string> = {
  INWESTYCYJNA: 'Inwestycyjna',
  BUDOWLANA: 'Budowlana',
  ROLNA: 'Rolna',
  LESNA: 'Leśna',
  REKREACYJNA: 'Rekreacyjna',
  SIEDLISKOWA: 'Siedliskowa',
};

type Photo = { url: string; kolejnosc?: number };

export default function MapOfferCard({ point, onClose }: { point: MapPoint; onClose?: () => void }) {
  const [photos, setPhotos] = useState<string[]>(point.thumb ? [point.thumb] : []);
  const [i, setI] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dzialki/${point.id}`, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list: Photo[] = Array.isArray(data.zdjecia) ? data.zdjecia : [];
        const urls = list
          .slice()
          .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0))
          .map((p) => p.url)
          .filter(Boolean);
        if (urls.length) setPhotos(urls);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [point.id]);

  const has = photos.length > 0;
  const total = photos.length;

  const go = (dir: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (total < 2) return;
    setI((v) => (v + dir + total) % total);
  };

  const isRent = point.transakcja === 'WYNAJEM';
  const przezn =
    (point.przezn ?? []).map((x) => PRZEZN_LABEL[x] ?? x).filter(Boolean).join(', ') || '—';
  const loc = (point.loc ?? '').trim() || 'Lokalizacja niepodana';

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/12 bg-[#131313] shadow-[0_18px_60px_rgba(0,0,0,0.6)]">
      {/* Zamknij */}
      <button
        type="button"
        aria-label="Zamknij"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose?.();
        }}
        className="absolute right-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-[18px] leading-none text-white backdrop-blur-sm transition hover:bg-black/75"
      >
        ×
      </button>

      <a href={`/dzialka/${point.id}`} className="group block text-left text-white no-underline">
        {/* Karuzela */}
        <div
          className="relative aspect-[16/10] w-full overflow-hidden bg-[#0d0d0d]"
          onTouchStart={(e) => {
            touchStartX.current = e.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchStartX.current;
            const end = e.changedTouches[0]?.clientX ?? null;
            if (start == null || end == null || total < 2) return;
            const diff = start - end;
            if (Math.abs(diff) < 40) return;
            setI((v) => (v + (diff > 0 ? 1 : -1) + total) % total);
          }}
        >
          {has ? (
            <img
              src={photos[i] ?? photos[0]}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#0d0d0d]">
              <span className="text-[11px] tracking-[0.12em] text-white/30">Zdjęcie wkrótce</span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent" />

          {point.featured && (
            <span className="absolute left-3 top-3 rounded-full border border-[#7aa333]/40 bg-[#7aa333]/90 px-2.5 py-1 text-[9px] font-semibold tracking-[0.14em] text-black">
              WYRÓŻNIONE
            </span>
          )}

          {isRent && (
            <span className="absolute left-3 bottom-3 rounded-full border border-white/30 bg-black/65 px-2.5 py-1 text-[9px] font-semibold tracking-[0.14em] text-white backdrop-blur-sm">
              NA WYNAJEM
            </span>
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                aria-label="Poprzednie zdjęcie"
                onClick={(e) => go(-1, e)}
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/70"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Następne zdjęcie"
                onClick={(e) => go(1, e)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/70"
              >
                ›
              </button>
              <div className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white backdrop-blur-sm">
                <IconCamera className="h-3 w-3" />
                {i + 1}/{total}
              </div>
            </>
          )}
        </div>

        {/* Ciało — wspólne z listą i „podobnymi" (bez tytułu, kompaktowo). */}
        <CardBody
          cena={point.cena}
          isRent={isRent}
          loc={loc}
          area={point.area}
          przezn={przezn}
          media={parcelMediaLabel(point)}
          compact
          sellerType={
            point.sprzedajacyTyp === 'BIURO' || point.sprzedajacyTyp === 'PRYWATNIE'
              ? point.sprzedajacyTyp
              : null
          }
          biuroNazwa={point.biuroNazwa ?? null}
          biuroLogoUrl={point.biuroLogoUrl ?? null}
          extra={
            point.approx ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7aa333]/30 bg-[#7aa333]/12 px-2.5 py-1 text-[10px] text-[#9fd14b]">
                ◎ Lokalizacja przybliżona
              </span>
            ) : undefined
          }
        />
      </a>
    </div>
  );
}
