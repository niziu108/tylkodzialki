'use client';

import { useEffect, useMemo, useState } from 'react';
import DzialkaClient from '../../dzialka/[id]/DzialkaClient';
import { OfferCard, type OfferData } from '@/components/OfferCard';

// Jedno źródło prawdy klucza podglądu — ten sam string zapisuje kreator (DzialkaForm).
export const PREVIEW_KEY = 'tylkodzialki:preview:v1';

export default function PodgladClient() {
  const [data, setData] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  // Pełnoprawny podgląd: start od listy ofert, klik karty → wejście w ofertę.
  const [view, setView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    // 1. Wczytanie danych przygotowanych przez formularz tuż przed otwarciem iframe.
    try {
      const raw = localStorage.getItem(PREVIEW_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch {
      // uszkodzony JSON — pokażemy komunikat o braku danych
    }
    setReady(true);

    // 2. Aktualizacja na żywo: gdy rodzic nadpisze klucz (edycja + ponowny podgląd),
    //    iframe dostaje zdarzenie storage (inny dokument) i odświeża treść od listy.
    function onStorage(e: StorageEvent) {
      if (e.key === PREVIEW_KEY && e.newValue) {
        try {
          setData(JSON.parse(e.newValue));
          setView('list');
        } catch {
          // ignorujemy uszkodzony zapis
        }
      }
    }

    // 3. Kanał zapasowy: rodzic może też wysłać dane przez postMessage (ten sam origin).
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'td-preview-data' && e.data.payload) {
        setData(e.data.payload);
        setView('list');
      }
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  // Zmiana widoku lista↔oferta przewija na górę, jak prawdziwa nawigacja.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [view]);

  // Dane karty listy (OfferData) z danych formularza — ten sam komponent co /kup.
  const offer = useMemo<OfferData | null>(() => {
    if (!data) return null;
    return {
      id: data.id ?? 'preview',
      tytul: data.tytul ?? '',
      cenaPln: data.cenaPln ?? 0,
      powierzchniaM2: data.powierzchniaM2 ?? 0,
      transakcja: data.transakcja ?? 'SPRZEDAZ',
      locationLabel: data.locationLabel ?? null,
      przeznaczenia: data.przeznaczenia ?? [],
      zdjecia: data.zdjecia ?? [],
      prad: data.prad ?? null,
      woda: data.woda ?? null,
      kanalizacja: data.kanalizacja ?? null,
      gaz: data.gaz ?? null,
      sprzedajacyTyp: data.sprzedajacyTyp ?? null,
      biuroNazwa: data.biuroNazwa ?? null,
      biuroLogoUrl: data.biuroLogoUrl ?? null,
    };
  }, [data]);

  // Zanim wczytamy dane — neutralne tło (bez migotania).
  if (!ready) {
    return <main className="min-h-screen" style={{ background: 'var(--bg)' }} />;
  }

  if (!data || !offer) {
    return (
      <main className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
        <div className="mx-auto max-w-3xl px-6 py-20 text-[15px] text-fg/72">
          Brak danych do podglądu. Wróć do formularza i kliknij „Podgląd” ponownie.
        </div>
      </main>
    );
  }

  // Widok szczegółów — prawdziwa strona oferty; „Wróć do listy" wraca do listy podglądu.
  if (view === 'detail') {
    return (
      <DzialkaClient initial={data} preview onPreviewBack={() => setView('list')} />
    );
  }

  // Widok listy — karta dokładnie tak, jak w wynikach /kup (kontener i siatka jak na /kup).
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <div className="mx-auto max-w-6xl px-3 py-6 md:px-4 md:py-8">
        <div className="mb-4 text-[13px] text-fg/60">
          Tak wygląda Twoja oferta na liście. Kliknij kartę, aby wejść w ofertę.
        </div>

        <div className="grid grid-cols-1 gap-5">
          <div className="min-w-0">
            <OfferCard
              d={offer}
              eagerImage
              horizontal
              preview
              isFavorite={false}
              onToggleFavorite={() => {}}
              scroll={false}
              onClick={() => setView('detail')}
            />
          </div>

          {/* Imitacja kolejnych ofert — daje poczucie realnej listy. Wyciemnione, nieklikalne. */}
          <div className="relative" aria-hidden="true">
            <div className="grid grid-cols-1 gap-5">
              {[0.5, 0.28].map((op, g) => (
                <div
                  key={g}
                  style={{ opacity: op }}
                  className="overflow-hidden rounded-3xl border border-fg/12 bg-surface-2/20 lg:flex lg:h-[256px]"
                >
                  <div className="aspect-[16/10] bg-fg/5 md:aspect-video lg:aspect-auto lg:w-[42%] lg:shrink-0" />
                  <div className="flex flex-col p-5 lg:flex-1">
                    <div className="space-y-3">
                      <div className="h-6 w-32 rounded bg-fg/10" />
                      <div className="h-4 w-11/12 rounded bg-fg/10" />
                      <div className="h-4 w-2/3 rounded bg-fg/10" />
                      <div className="flex gap-3 pt-1">
                        <div className="h-5 w-16 rounded bg-fg/10" />
                        <div className="h-5 w-28 rounded bg-fg/10" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Delikatne wygaszenie ku dołowi — sugeruje dalszą listę. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-[var(--bg)]" />
          </div>
        </div>
      </div>
    </main>
  );
}
