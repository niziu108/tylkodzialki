'use client';

import { useEffect, useState } from 'react';
import DzialkaClient from '../../dzialka/[id]/DzialkaClient';

// Jedno źródło prawdy klucza podglądu — ten sam string zapisuje kreator (DzialkaForm).
export const PREVIEW_KEY = 'tylkodzialki:preview:v1';

export default function PodgladClient() {
  const [data, setData] = useState<any | null>(null);
  const [ready, setReady] = useState(false);

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
    //    iframe dostaje zdarzenie storage (inny dokument) i odświeża treść.
    function onStorage(e: StorageEvent) {
      if (e.key === PREVIEW_KEY && e.newValue) {
        try {
          setData(JSON.parse(e.newValue));
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
      }
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  // Zanim wczytamy dane — neutralne tło (bez migotania).
  if (!ready) {
    return <main className="min-h-screen" style={{ background: 'var(--bg)' }} />;
  }

  if (!data) {
    return (
      <main className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
        <div className="mx-auto max-w-3xl px-6 py-20 text-[15px] text-fg/72">
          Brak danych do podglądu. Wróć do formularza i kliknij „Podgląd” ponownie.
        </div>
      </main>
    );
  }

  return <DzialkaClient initial={data} preview />;
}
