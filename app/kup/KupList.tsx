'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Przeznaczenie } from '@prisma/client';

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

    fetch(url, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {});
  } catch {
    fetch(url, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {});
  }
}

type Photo = {
  id?: string;
  url: string;
  publicId?: string;
  kolejnosc?: number;
};

export type Dzialka = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  locationLabel?: string | null;
  przeznaczenia?: Przeznaczenie[];
  zdjecia?: Photo[];
  isFeatured?: boolean | null;
  featuredUntil?: string | Date | null;
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

function isFeaturedActive(d: Dzialka) {
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

function HeartIcon({ filled = false }: { filled?: boolean }) {
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

export default function KupList({
  items,
  loading,
  error,
}: {
  items: Dzialka[];
  loading: boolean;
  error: string | null;
}) {
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

  const toggleFavorite = useCallback(async (dzialkaId: string) => {
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
  }, [favoriteIds, isLogged]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;

    const save = () => {
      try {
        sessionStorage.setItem('TD_KUP_SCROLL_Y', String(window.scrollY || 0));
        sessionStorage.setItem('TD_KUP_URL', window.location.pathname + window.location.search);
      } catch {}
    };

    const onScroll = () => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        save();
      }, 150);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    save();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (t) clearTimeout(t);
    };
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-3xl border border-white/12 bg-[#0f0f0f]/20"
            >
              <div className="aspect-video animate-pulse bg-white/5" />
              <div className="space-y-6 p-5 md:p-6">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
                  <div className="h-14 animate-pulse rounded bg-white/5" />
                  <div className="w-px bg-white/5" />
                  <div className="h-14 animate-pulse rounded bg-white/5" />
                </div>
                <div className="mx-auto h-5 w-52 animate-pulse rounded bg-white/5" />
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
                  <div className="h-14 animate-pulse rounded bg-white/5" />
                  <div className="w-px bg-white/5" />
                  <div className="h-14 animate-pulse rounded bg-white/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-3xl border border-white/12 bg-[#0f0f0f]/20 p-6">
          <div className="font-medium text-white/90">Nie udało się pobrać ofert</div>
          <div className="mt-2 text-sm text-white/60">{error}</div>
          <button
            className="mt-4 rounded-full border border-white/20 px-4 py-2 text-[12px] uppercase tracking-[0.18em] text-white/75 transition hover:border-white/40"
            onClick={() => window.location.reload()}
          >
            Odśwież
          </button>
        </div>
      );
    }

    if (!items.length) {
      return (
        <div className="rounded-3xl border border-white/12 bg-[#0f0f0f]/20 p-6 text-white/70">
          Brak wyników.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {items.map((d, index) => (
          <DzialkaCard
            key={d.id}
            d={d}
            eagerImage={index < 2}
            isFavorite={favoriteIds.has(d.id)}
            onToggleFavorite={toggleFavorite}
          />
        ))}
      </div>
    );
  }, [items, loading, error, favoriteIds, toggleFavorite]);

  return (
    <>
      <div>{content}</div>

      {loginPromptOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/12 bg-[#131313] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#7aa333]/35 bg-[#7aa333]/12 text-[#7aa333]">
              <HeartIcon />
            </div>

            <h2 className="mt-5 font-display text-[24px] uppercase tracking-[0.08em] text-white">
              Zapisz ofertę
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/65">
              Zaloguj się lub zarejestruj, aby dodać ofertę do ulubionych.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setLoginPromptOpen(false)}
                className="h-12 rounded-2xl border border-white/14 bg-transparent px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Przeglądaj dalej
              </button>

              <button
                type="button"
                onClick={() => {
                  const cb = encodeURIComponent(window.location.pathname + window.location.search);
                  window.location.href = `/auth?callbackUrl=${cb}`;
                }}
                className="h-12 rounded-2xl border border-[#7aa333]/60 bg-[#7aa333] px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#131313] transition hover:bg-[#8dbb3a]"
              >
                Przejdź do logowania
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DzialkaCard({
  d,
  eagerImage = false,
  isFavorite,
  onToggleFavorite,
}: {
  d: Dzialka;
  eagerImage?: boolean;
  isFavorite: boolean;
  onToggleFavorite: (dzialkaId: string) => void;
}) {
  const photos = (d.zdjecia ?? [])
    .slice()
    .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));

  const coverFallback = photos[0]?.url ?? null;
  const loc = d.locationLabel?.trim() || 'Lokalizacja niepodana';
  const area = d.powierzchniaM2 ?? 0;
  const zlZaM2 = area ? Math.round(d.cenaPln / area) : 0;
  const przezn = d.przeznaczenia?.length
    ? d.przeznaczenia.map(labelPrzeznaczenie).join(', ')
    : '—';

  const featured = isFeaturedActive(d);
  const cardRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || trackedListViewIds.has(d.id)) return;

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
      {
        root: null,
        rootMargin: '120px 0px',
        threshold: 0.35,
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [d.id]);

  return (
    <Link
      ref={cardRef}
      href={`/dzialka/${d.id}`}
      scroll={false}
      onClick={() => {
        try {
          sessionStorage.setItem('TD_KUP_SCROLL_Y', String(window.scrollY || 0));
          sessionStorage.setItem('TD_KUP_URL', window.location.pathname + window.location.search);
        } catch {}
      }}
      className={`group block overflow-hidden rounded-3xl border transition ${
        featured
          ? 'border-[#7aa333]/45 bg-[#0f0f0f]/20 shadow-[0_0_0_1px_rgba(122,163,51,0.10)] hover:border-[#7aa333]/70'
          : 'border-white/14 bg-[#0f0f0f]/20 hover:border-white/30'
      }`}
    >
      <Carousel
        photos={photos}
        coverFallback={coverFallback}
        title={d.tytul}
        featured={featured}
        eagerImage={eagerImage}
        isFavorite={isFavorite}
        onToggleFavorite={() => onToggleFavorite(d.id)}
      />

      <div className="p-5 md:p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <MetricBlock
            label="Cena"
            align="center"
            value={
              <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center">
                <span className="text-[20px] font-semibold leading-none text-[#7aa333] md:text-[22px]">
                  {formatPLN(d.cenaPln)}
                </span>
                {zlZaM2 ? (
                  <span className="text-[12px] text-[#7aa333]">
                    ({formatIntPL(zlZaM2)} zł/m²)
                  </span>
                ) : null}
              </div>
            }
          />

          <div className="h-14 w-px bg-white/10" />

          <MetricBlock
            label="Powierzchnia"
            align="center"
            value={
              <div className="text-[20px] font-medium leading-none text-[#7aa333] md:text-[22px]">
                {formatIntPL(area)} m²
              </div>
            }
          />
        </div>

        <div className="mt-6">
          <div className="mx-auto max-w-[92%] text-center text-[16px] font-medium leading-[1.35] text-white/92 md:text-[17px]">
            {d.tytul}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <MetricBlock
            label="Lokalizacja"
            align="center"
            value={
              <div className="break-words text-[14px] leading-[1.4] text-[#7aa333]">
                {loc}
              </div>
            }
          />

          <div className="h-14 w-px bg-white/10" />

          <MetricBlock
            label="Przeznaczenie"
            align="center"
            value={
              <div className="break-words text-[14px] leading-[1.4] text-[#7aa333]">
                {przezn}
              </div>
            }
          />
        </div>
      </div>
    </Link>
  );
}

function MetricBlock({
  label,
  value,
  subValue,
  align = 'center',
}: {
  label: string;
  value: ReactNode;
  subValue?: ReactNode;
  align?: 'left' | 'center' | 'right';
}) {
  const alignClass =
    align === 'left'
      ? 'text-left items-start'
      : align === 'right'
      ? 'text-right items-end'
      : 'text-center items-center';

  return (
    <div className={`min-w-0 flex flex-col ${alignClass}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#7aa333]">
        {label}
      </div>
      <div className="mt-2 min-w-0">{value}</div>
      {subValue ? <div className="min-w-0">{subValue}</div> : null}
    </div>
  );
}

function Carousel({
  photos,
  coverFallback,
  title,
  featured,
  eagerImage = false,
  isFavorite,
  onToggleFavorite,
}: {
  photos: { url: string }[];
  coverFallback: string | null;
  title: string;
  featured: boolean;
  eagerImage?: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const list = useMemo(
    () => (photos.length ? photos.map((p) => p.url) : coverFallback ? [coverFallback] : []),
    [photos, coverFallback]
  );

  const has = list.length > 0;
  const [i, setI] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    setI(0);
  }, [list]);

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
      className="relative aspect-[16/10] bg-white/5 md:aspect-video"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {has ? (
        <>
          <SmartImg
            src={list[i]}
            alt={title}
            className="h-full w-full object-cover"
            eager={eagerImage}
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />

          <button
            type="button"
            aria-label={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${
              isFavorite
                ? 'border-[#7aa333]/70 bg-[#7aa333] text-[#131313]'
                : 'border-white/20 bg-black/45 text-white hover:border-[#7aa333]/70 hover:text-[#7aa333]'
            }`}
          >
            <HeartIcon filled={isFavorite} />
          </button>

          {featured ? (
            <div className="absolute left-4 top-4 z-10">
              <span className="inline-flex items-center rounded-full border border-[#7aa333]/35 bg-[#7aa333]/85 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-black shadow-lg">
                WYRÓŻNIONE
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

              <div className="absolute right-4 top-16 z-10 flex gap-2">
                {list.slice(0, 6).map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-2 w-2 rounded-full ${
                      idx === i ? 'bg-white' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-white/50">Brak zdjęć</div>
      )}
    </div>
  );
}