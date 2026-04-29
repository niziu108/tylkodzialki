'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Przeznaczenie } from '@prisma/client';

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

export default function KupList({
  items,
  loading,
  error,
}: {
  items: Dzialka[];
  loading: boolean;
  error: string | null;
}) {
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
          <DzialkaCard key={d.id} d={d} eagerImage={index < 2} />
        ))}
      </div>
    );
  }, [items, loading, error]);

  return <div>{content}</div>;
}

function DzialkaCard({ d, eagerImage = false }: { d: Dzialka; eagerImage?: boolean }) {
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

  return (
    <Link
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
      />

      <div className="p-5 md:p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <MetricBlock
            label="Cena"
            align="center"
            value={
              <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center">
                <span className="text-[20px] font-semibold leading-none md:text-[22px] ${featured ? 'text-[#7aa333]' : 'text-white'}">
                  {formatPLN(d.cenaPln)}
                </span>
                {zlZaM2 ? (
                  <span className="text-[12px] text-white/50">
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
              <div className="text-[20px] font-medium leading-none text-white/95 md:text-[22px]">
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
              <div className="break-words text-[14px] leading-[1.4] text-white/90">
                {loc}
              </div>
            }
          />

          <div className="h-14 w-px bg-white/10" />

          <MetricBlock
            label="Przeznaczenie"
            align="center"
            value={
              <div className="break-words text-[14px] leading-[1.4] text-white/90">
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
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
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
}: {
  photos: { url: string }[];
  coverFallback: string | null;
  title: string;
  featured: boolean;
  eagerImage?: boolean;
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

              <div className="absolute right-4 top-4 flex gap-2">
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