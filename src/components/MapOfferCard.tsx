'use client';

import { useEffect, useRef, useState } from 'react';
import type { MapPoint } from './KupMap';

/* ────────────────────────────────────────────────────────────────────────────
 *  Karta oferty w dymku mapy (P11). Wizualnie spójna z `OfferCard` z listy:
 *  te same bloki Cena/Powierzchnia (zielone etykiety), tytuł, Lokalizacja/
 *  Przeznaczenie, plakietka WYRÓŻNIONE. Zdjęcia (karuzela) doładowywane dopiero
 *  po kliknięciu pinu (osobny fetch /api/dzialki/[id]) — mapa zostaje lekka.
 *  Tło daje sam dymek InfoWindow (#131313), karta jest przezroczysta.
 * ──────────────────────────────────────────────────────────────────────────── */

const PRZEZN_LABEL: Record<string, string> = {
  INWESTYCYJNA: 'Inwestycyjna',
  BUDOWLANA: 'Budowlana',
  ROLNA: 'Rolna',
  LESNA: 'Leśna',
  REKREACYJNA: 'Rekreacyjna',
  SIEDLISKOWA: 'Siedliskowa',
};

function formatPLN(value: number) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatIntPL(value: number) {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(value);
}

type Photo = { url: string; kolejnosc?: number };

export default function MapOfferCard({ point }: { point: MapPoint }) {
  const [photos, setPhotos] = useState<string[]>(point.thumb ? [point.thumb] : []);
  const [i, setI] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Doładowanie pełnej galerii po otwarciu karty (mapa nie wozi wszystkich zdjęć).
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

  const zlM2 = point.area > 0 ? Math.round(point.cena / point.area) : 0;
  const przezn = (point.przezn ?? []).map((x) => PRZEZN_LABEL[x] ?? x).filter(Boolean).join(', ') || '—';
  const loc = (point.loc ?? '').trim() || 'Lokalizacja niepodana';

  return (
    <a
      href={`/dzialka/${point.id}`}
      className="block w-[300px] text-left text-white no-underline"
    >
      {/* Karuzela */}
      <div
        className="relative aspect-[16/10] bg-[#0d0d0d]"
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
            alt={point.tytul}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-white/40">Brak zdjęć</div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent" />

        {point.featured && (
          <span className="absolute left-3 top-3 rounded-full border border-[#7aa333]/40 bg-[#7aa333]/90 px-2.5 py-1 text-[9px] font-semibold tracking-[0.14em] text-black">
            WYRÓŻNIONE
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
            <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
              {photos.slice(0, 8).map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 w-1.5 rounded-full ${idx === i ? 'bg-white' : 'bg-white/45'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Treść — układ jak w karcie listy */}
      <div className="px-4 pb-4 pt-3.5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0 text-center">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#7aa333]">Cena</div>
            <div className="mt-1.5 flex flex-wrap items-baseline justify-center gap-x-1.5">
              <span className="text-[19px] font-semibold leading-none text-white">{formatPLN(point.cena)}</span>
              {zlM2 ? <span className="text-[11px] text-white/55">{formatIntPL(zlM2)} zł/m²</span> : null}
            </div>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div className="min-w-0 text-center">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#7aa333]">Powierzchnia</div>
            <div className="mt-1.5 text-[19px] font-medium leading-none text-white/95">{formatIntPL(point.area)} m²</div>
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-[94%] text-center text-[14px] font-medium leading-[1.35] text-white/92">
          {point.tytul}
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0 text-center">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#7aa333]">Lokalizacja</div>
            <div className="mt-1.5 break-words text-[13px] leading-[1.4] text-white/90">{loc}</div>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div className="min-w-0 text-center">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#7aa333]">Przeznaczenie</div>
            <div className="mt-1.5 break-words text-[13px] leading-[1.4] text-white/90">{przezn}</div>
          </div>
        </div>

        {point.approx && (
          <div className="mt-3.5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7aa333]/30 bg-[#7aa333]/12 px-2.5 py-1 text-[10px] text-[#9fd14b]">
              ◎ Lokalizacja przybliżona
            </span>
          </div>
        )}

        <div className="mt-4">
          <span className="flex w-full items-center justify-center rounded-xl bg-[#7aa333] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0c0c0c]">
            Zobacz ofertę
          </span>
        </div>
      </div>
    </a>
  );
}
