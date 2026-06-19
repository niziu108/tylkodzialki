'use client';

import { useEffect, useMemo } from 'react';
import { OfferCard, useOfferFavorites, LoginPrompt, type OfferData } from '@/components/OfferCard';

export type Dzialka = OfferData;

export default function KupList({
  items,
  loading,
  error,
  onItemHover,
}: {
  items: OfferData[];
  loading: boolean;
  error: string | null;
  /** Najazd na kartę → podświetlenie pinu na mapie. */
  onItemHover?: (id: string | null) => void;
}) {
  const { favoriteIds, toggleFavorite, loginPromptOpen, setLoginPromptOpen } =
    useOfferFavorites(items);

  // Lista ofert = jedna kolumna szerokich kart; na desktopie poziomych (zdjęcie z lewej).
  const gridClass = 'grid grid-cols-1 gap-5';

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
              className="overflow-hidden rounded-3xl border border-fg/12 bg-surface-2/20 lg:flex lg:h-[256px]"
            >
              <div className="aspect-[16/10] animate-pulse bg-fg/5 md:aspect-video lg:aspect-auto lg:w-[42%] lg:shrink-0" />
              <div className="flex flex-col p-5 lg:flex-1">
                <div className="space-y-3">
                  <div className="h-6 w-32 animate-pulse rounded bg-fg/5" />
                  <div className="h-4 w-11/12 animate-pulse rounded bg-fg/5" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-fg/5" />
                  <div className="flex gap-3 pt-1">
                    <div className="h-5 w-16 animate-pulse rounded bg-fg/5" />
                    <div className="h-5 w-28 animate-pulse rounded bg-fg/5" />
                  </div>
                </div>
                <div className="mt-auto hidden h-5 w-40 animate-pulse rounded bg-fg/5 lg:block" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-3xl border border-fg/12 bg-surface-2/20 p-6">
          <div className="font-medium text-fg/90">Nie udało się pobrać ofert</div>
          <div className="mt-2 text-sm text-fg/72">{error}</div>
          <button
            className="mt-4 rounded-full border border-fg/20 px-4 py-2 text-[12px] uppercase tracking-[0.18em] text-fg/75 transition hover:border-fg/40"
            onClick={() => window.location.reload()}
          >
            Odśwież
          </button>
        </div>
      );
    }

    if (!items.length) {
      return (
        <div className="rounded-3xl border border-fg/12 bg-surface-2/20 p-6 text-fg/70">
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
              horizontal
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
