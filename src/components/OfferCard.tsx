'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import type {
  Przeznaczenie,
  TransakcjaTyp,
  PradStatus,
  WodaStatus,
  KanalizacjaStatus,
  GazStatus,
  SprzedajacyTyp,
} from '@prisma/client';
import { CardBody } from './CardBody';
import { IconCamera } from './CardIcons';
import { parcelMediaLabel } from '@/lib/media';

/* ────────────────────────────────────────────────────────────────────────────
 *  Wspólna karta oferty — jedno źródło prawdy dla listy /kup i raili na stronie
 *  głównej / podobnych ofert. Dzięki temu wszędzie wygląda i działa identycznie
 *  (karuzela zdjęć, ulubione, plakietka „WYRÓŻNIONE", śledzenie odsłon).
 * ──────────────────────────────────────────────────────────────────────────── */

const trackedListViewIds = new Set<string>();

function trackListView(dzialkaId: string) {
  if (!dzialkaId || trackedListViewIds.has(dzialkaId)) return;

  trackedListViewIds.add(dzialkaId);

  const url = `/api/dzialki/${dzialkaId}/track-view`;

  try {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const sent = navigator.sendBeacon(url, new Blob([], { type: 'application/json' }));
      if (sent) return;
    }

    fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
  } catch {
    fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
  }
}

type Photo = {
  id?: string;
  url: string;
  publicId?: string;
  kolejnosc?: number;
};

export type OfferData = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  transakcja?: TransakcjaTyp | null;
  locationLabel?: string | null;
  przeznaczenia?: Przeznaczenie[];
  zdjecia?: Photo[];
  isFeatured?: boolean | null;
  featuredUntil?: string | Date | null;
  prad?: PradStatus | null;
  woda?: WodaStatus | null;
  kanalizacja?: KanalizacjaStatus | null;
  gaz?: GazStatus | null;
  sprzedajacyTyp?: SprzedajacyTyp | null;
  biuroNazwa?: string | null;
  biuroLogoUrl?: string | null;
  /** Fallback logo/nazwy biura z konta właściciela (oferty CRM nie mają własnego logo). */
  owner?: { defaultBiuroLogoUrl?: string | null; defaultBiuroLogoBg?: boolean | null; defaultBiuroNazwa?: string | null } | null;
};

function labelPrzeznaczenie(p: Przeznaczenie) {
  const map: Record<string, string> = {
    INWESTYCYJNA: 'Inwestycyjna',
    BUDOWLANA: 'Budowlana',
    ROLNA: 'Rolna',
    LESNA: 'Leśna',
    REKREACYJNA: 'Rekreacyjna',
    SIEDLISKOWA: 'Siedliskowa',
  };

  return map[p] ?? String(p);
}

function isFeaturedActive(d: OfferData) {
  return !!d.isFeatured && !!d.featuredUntil && new Date(d.featuredUntil).getTime() > Date.now();
}

function SmartImg({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  );
}

export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Stan ulubionych dla listy ofert: jedno zapytanie po wszystkie id naraz,
 * optymistyczny toggle, prośba o logowanie dla niezalogowanych.
 */
export function useOfferFavorites(items: { id: string }[]) {
  const { status } = useSession();
  const isLogged = status === 'authenticated';
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);

  useEffect(() => {
    if (!isLogged || !items.length) {
      setFavoriteIds(new Set());
      return;
    }

    const ids = items.map((d) => d.id).join(',');

    fetch(`/api/favorites?ids=${encodeURIComponent(ids)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.favoriteIds)) {
          setFavoriteIds(new Set(data.favoriteIds));
        }
      })
      .catch(() => {});
  }, [isLogged, items]);

  const toggleFavorite = useCallback(
    async (dzialkaId: string) => {
      if (!isLogged) {
        setLoginPromptOpen(true);
        return;
      }

      const wasFavorite = favoriteIds.has(dzialkaId);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(dzialkaId);
        else next.add(dzialkaId);
        return next;
      });

      try {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dzialkaId }),
        });

        if (!res.ok) throw new Error('Nie udało się zapisać ulubionej oferty.');

        const data = await res.json();

        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (data?.isFavorite) next.add(dzialkaId);
          else next.delete(dzialkaId);
          return next;
        });
      } catch {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(dzialkaId);
          else next.delete(dzialkaId);
          return next;
        });
      }
    },
    [favoriteIds, isLogged]
  );

  return { favoriteIds, toggleFavorite, loginPromptOpen, setLoginPromptOpen };
}

export function LoginPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-fg/12 bg-bg p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand/35 bg-brand/12 text-brand-text">
          <HeartIcon />
        </div>

        <h2 className="mt-5 font-display text-[24px] uppercase tracking-[0.08em] text-fg">
          Zapisz ofertę
        </h2>

        <p className="mt-3 text-sm leading-6 text-fg/70">
          Zaloguj się lub zarejestruj, aby dodać ofertę do ulubionych.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl border border-fg/14 bg-transparent px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-fg/75 transition hover:border-fg/30 hover:text-fg"
          >
            Przeglądaj dalej
          </button>

          <button
            type="button"
            onClick={() => {
              const cb = encodeURIComponent(window.location.pathname + window.location.search);
              window.location.href = `/logowanie?callbackUrl=${cb}`;
            }}
            className="h-12 rounded-2xl border border-brand/60 bg-brand px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink transition hover:bg-brand-strong"
          >
            Przejdź do logowania
          </button>
        </div>
      </div>
    </div>
  );
}

function Carousel({
  photos,
  coverFallback,
  title,
  featured,
  rent = false,
  eagerImage = false,
  horizontal = false,
}: {
  photos: { url: string }[];
  coverFallback: string | null;
  title: string;
  featured: boolean;
  rent?: boolean;
  eagerImage?: boolean;
  /** Desktop: zdjęcie po lewej, wypełnia wysokość karty (układ poziomy). */
  horizontal?: boolean;
}) {
  const list = useMemo(
    () => (photos.length ? photos.map((p) => p.url) : coverFallback ? [coverFallback] : []),
    [photos, coverFallback]
  );

  const has = list.length > 0;
  const [i, setI] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const goPrev = () => {
    if (list.length < 2) return;
    setI((v) => (v - 1 + list.length) % list.length);
  };

  const goNext = () => {
    if (list.length < 2) return;
    setI((v) => (v + 1) % list.length);
  };

  const prev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    goPrev();
  };

  const next = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    goNext();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (list.length < 2) return;
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
    touchEndX.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (list.length < 2) return;
    touchEndX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (list.length < 2) return;

    const start = touchStartX.current;
    const end = touchEndX.current ?? e.changedTouches[0]?.clientX ?? null;

    if (start == null || end == null) return;

    const diff = start - end;
    const threshold = 40;

    if (Math.abs(diff) < threshold) return;

    e.preventDefault();
    e.stopPropagation();

    if (diff > 0) {
      goNext();
    } else {
      goPrev();
    }
  };

  return (
    <div
      className={`relative aspect-[16/10] overflow-hidden bg-fg/5 md:aspect-video ${
        horizontal ? 'lg:aspect-auto lg:h-full lg:w-[42%] lg:shrink-0' : ''
      }`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {has ? (
        <>
          <SmartImg
            src={list[i] ?? list[0]}
            alt={title}
            className="h-full w-full object-cover"
            eager={eagerImage}
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />

          {featured ? (
            <div className="absolute left-4 top-4 z-10">
              <span className="inline-flex items-center rounded-full border border-brand/35 bg-brand/85 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-black shadow-lg">
                WYRÓŻNIONE
              </span>
            </div>
          ) : null}

          {rent ? (
            <div className="absolute bottom-4 left-4 z-10">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-black/65 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-white shadow-lg backdrop-blur-sm">
                NA WYNAJEM
              </span>
            </div>
          ) : null}

          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-3 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-black/40 text-white opacity-100 backdrop-blur-sm transition md:opacity-0 md:group-hover:opacity-100"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-3 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-black/40 text-white opacity-100 backdrop-blur-sm transition md:opacity-0 md:group-hover:opacity-100"
              >
                ›
              </button>

              <div className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium tabular-nums text-white backdrop-blur-sm">
                <IconCamera className="h-3.5 w-3.5" />
                {i + 1}/{list.length}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center bg-surface">
          <span className="text-[12px] tracking-[0.12em] text-fg/30">Zdjęcie wkrótce</span>
        </div>
      )}
    </div>
  );
}

export function OfferCard({
  d,
  eagerImage = false,
  horizontal = false,
  isFavorite,
  onToggleFavorite,
  onClick,
  scroll = true,
  preview = false,
}: {
  d: OfferData;
  eagerImage?: boolean;
  /** Lista /kup: na desktopie układ poziomy (zdjęcie z lewej). Raile zostają pionowe. */
  horizontal?: boolean;
  isFavorite: boolean;
  onToggleFavorite: (dzialkaId: string) => void;
  /** /kup: zapis pozycji scrolla przed nawigacją (przywracanie przy powrocie). */
  onClick?: () => void;
  /** /kup ustawia false, by Next nie skakał na górę (działa restore scrolla). */
  scroll?: boolean;
  /** Podgląd w kreatorze: bez śledzenia odsłon; klik nie nawiguje, tylko woła onClick. */
  preview?: boolean;
}) {
  const photos = (d.zdjecia ?? []).slice().sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));

  const coverFallback = photos[0]?.url ?? null;
  const loc = d.locationLabel?.trim() || 'Lokalizacja niepodana';
  const area = d.powierzchniaM2 ?? 0;
  const isRent = d.transakcja === 'WYNAJEM';
  const przezn = d.przeznaczenia?.length
    ? d.przeznaczenia.map(labelPrzeznaczenie).join(', ')
    : '—';

  const featured = isFeaturedActive(d);
  const cardRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || trackedListViewIds.has(d.id)) return;
    if (preview) return;

    if (typeof IntersectionObserver === 'undefined') {
      const timeout = window.setTimeout(() => trackListView(d.id), 600);
      return () => window.clearTimeout(timeout);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        trackListView(d.id);
        observer.disconnect();
      },
      { root: null, rootMargin: '120px 0px', threshold: 0.35 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [d.id, preview]);

  return (
    <Link
      ref={cardRef}
      href={`/dzialka/${d.id}`}
      scroll={scroll}
      onClick={(e) => {
        // W podglądzie nie nawigujemy do realnej oferty — klik tylko przełącza widok.
        if (preview) e.preventDefault();
        onClick?.();
      }}
      className={`group block overflow-hidden rounded-3xl border transition duration-200 ${
        horizontal ? 'lg:flex lg:items-stretch lg:h-[256px]' : ''
      } ${
        featured
          ? 'border-brand/55 bg-surface shadow-[0_0_0_1px_rgba(122,163,51,0.30),0_0_24px_rgba(122,163,51,0.20)] hover:border-brand/80 hover:shadow-[0_0_0_1px_rgba(122,163,51,0.45),0_0_30px_rgba(122,163,51,0.30)]'
          : 'border-fg/14 bg-surface hover:border-fg/30'
      }`}
    >
      <Carousel
        photos={photos}
        coverFallback={coverFallback}
        title={d.tytul}
        featured={featured}
        rent={isRent}
        eagerImage={eagerImage}
        horizontal={horizontal}
      />

      <div className={horizontal ? 'lg:flex-1' : ''}>
        <CardBody
          cena={d.cenaPln}
          isRent={isRent}
          tytul={d.tytul}
          loc={loc}
          area={area}
          przezn={przezn}
          media={parcelMediaLabel(d)}
          horizontal={horizontal}
          sellerType={d.sprzedajacyTyp ?? null}
          biuroNazwa={d.biuroNazwa ?? d.owner?.defaultBiuroNazwa ?? null}
          biuroLogoUrl={d.biuroLogoUrl ?? d.owner?.defaultBiuroLogoUrl ?? null}
          biuroLogoBg={d.owner?.defaultBiuroLogoBg ?? false}
          heartSlot={
            <button
              type="button"
              aria-label={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(d.id);
              }}
              className={`flex h-8 w-8 items-center justify-center transition active:scale-90 ${
                isFavorite ? 'text-brand-text' : 'text-brand-text/80 hover:text-brand-text'
              }`}
            >
              <HeartIcon filled={isFavorite} />
            </button>
          }
        />
      </div>
    </Link>
  );
}
