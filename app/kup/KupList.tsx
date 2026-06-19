'use client';

import { useEffect, useMemo } from 'react';
import { OfferCard, useOfferFavorites, LoginPrompt, type OfferData } from '@/components/OfferCard';

export type Dzialka = OfferData;

export default function KupList({
  items,
  loading,
  error,
  singleColumn = false,
  onItemHover,
}: {
  items: OfferData[];
  loading: boolean;
  error: string | null;
  /** Split lista+mapa: lista w węższej kolumnie → jedna kolumna kart. */
  singleColumn?: boolean;
  /** Najazd na kartę → podświetlenie pinu na mapie. */
  onItemHover?: (id: string | null) => void;
}) {
  const { favoriteIds, toggleFavorite, loginPromptOpen, setLoginPromptOpen } =
    useOfferFavorites(items);

  const gridClass = singleColumn
    ? 'grid grid-cols-1 gap-5'
    : 'grid grid-cols-1 gap-5 lg:grid-cols-2';

  // Zapis pozycji scrolla — przywracanie widoku przy powrocie na /kup.
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
        <div className={gridClass}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-3xl border border-white/12 bg-[#0f0f0f]/20"
            >
              <div className="aspect-[16/10] animate-pulse bg-white/5 md:aspect-video" />
              <div className="space-y-3 p-5">
                <div className="h-6 w-32 animate-pulse rounded bg-white/5" />
                <div className="h-4 w-11/12 animate-pulse rounded bg-white/5" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
                <div className="flex gap-2 pt-1">
                  <div className="h-6 w-16 animate-pulse rounded-full bg-white/5" />
                  <div className="h-6 w-24 animate-pulse rounded-full bg-white/5" />
                </div>
                <div className="h-10 w-full animate-pulse rounded-xl bg-white/5" />
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
      <div className={gridClass}>
        {items.map((d, index) => (
          <div
            key={d.id}
            className="min-w-0"
            onMouseEnter={onItemHover ? () => onItemHover(d.id) : undefined}
            onMouseLeave={onItemHover ? () => onItemHover(null) : undefined}
          >
            <OfferCard
              d={d}
              eagerImage={index < 2}
              isFavorite={favoriteIds.has(d.id)}
              onToggleFavorite={toggleFavorite}
              scroll={false}
              onClick={() => {
                try {
                  sessionStorage.setItem('TD_KUP_SCROLL_Y', String(window.scrollY || 0));
                  sessionStorage.setItem(
                    'TD_KUP_URL',
                    window.location.pathname + window.location.search
                  );
                } catch {}
              }}
            />
          </div>
        ))}
      </div>
    );
  }, [items, loading, error, favoriteIds, toggleFavorite, gridClass, onItemHover]);

  return (
    <>
      <div>{content}</div>
      <LoginPrompt open={loginPromptOpen} onClose={() => setLoginPromptOpen(false)} />
    </>
  );
}
