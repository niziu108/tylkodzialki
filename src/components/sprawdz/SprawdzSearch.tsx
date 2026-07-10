'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { createParcelOverlay } from '@/lib/parcelOverlay';
import HeroGradientBg from '@/components/HeroGradientBg';
import Raport, { type RaportData } from './Raport';

// P24: wyszukiwarka narzędzia w oprawie hero jak na stronie głównej (zdjęcie + ciemna
// nakładka + karta z polami). Punkt wskazuje UŻYTKOWNIK (adres / obręb i numer / pinezka).
// Darmowe, bez logowania. Po sprawdzeniu strona zjeżdża do gotowego raportu.

type Point = { lat: number; lng: number };

export default function SprawdzSearch() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const addrRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const [mapOpen, setMapOpen] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RaportData | null>(null);

  function placeMarker(p: Point, zoom = 17) {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setPosition(p);
    marker.setVisible(true);
    map.setCenter(p);
    map.setZoom(zoom);
  }

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapDivRef.current || !window.google?.maps) return;

        const map = new google.maps.Map(mapDivRef.current, {
          center: { lat: 52.0, lng: 19.2 },
          zoom: 6,
          mapTypeId: 'roadmap',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });
        mapRef.current = map;

        // Nakładka granic działek ewidencyjnych — po przybliżeniu user widzi obrys każdej działki
        // z numerem, więc ma pewność, że kliknął właściwą ([[project-wms-dzialki-overlay]]).
        map.overlayMapTypes.push(createParcelOverlay());

        const marker = new google.maps.Marker({ map, draggable: true, visible: false });
        markerRef.current = marker;

        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.setPosition(p);
          marker.setVisible(true);
          setPoint(p);
          setError(null);
        });

        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          if (!pos) return;
          setPoint({ lat: pos.lat(), lng: pos.lng() });
          setError(null);
        });

        if (addrRef.current) {
          const ac = new google.maps.places.Autocomplete(addrRef.current, {
            componentRestrictions: { country: 'pl' },
            fields: ['geometry'],
          });
          ac.addListener('place_changed', () => {
            const loc = ac.getPlace().geometry?.location;
            if (!loc) return;
            const p = { lat: loc.lat(), lng: loc.lng() };
            setPoint(p);
            setError(null);
            setMapOpen(true);
            placeMarker(p);
          });
        }
      })
      .catch(() => setError('Nie udało się wczytać mapy. Odśwież stronę.'));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Po otrzymaniu raportu zjeżdżamy do niego, żeby było jasne, że jest gotowy.
  useEffect(() => {
    if (result && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  async function handleCheck() {
    if (loading) return;
    setError(null);

    if (!point) {
      setError('Wskaż działkę: wpisz adres i wybierz podpowiedź albo kliknij ją na mapie.');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/sprawdz-dzialke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: point.lat, lng: point.lng }),
      });
      const json = (await res.json()) as RaportData | { error: string };

      if (!res.ok || 'error' in json) {
        setError('error' in json ? json.error : 'Nie udało się sprawdzić działki.');
        return;
      }
      setResult(json);
    } catch {
      setError('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleCheck();
  }

  return (
    <div className="w-full">
      {/* HERO gradient spójny ze stroną główną (bez zdjęcia => szybki LCP). */}
      <section className="relative w-full overflow-hidden">
        <HeroGradientBg />

        <div className="relative z-10 flex flex-col items-center px-4 py-10 md:py-14">
          <div className="w-full max-w-2xl rounded-3xl border border-fg/10 bg-surface-2/92 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm md:p-7">
            {/* Nagłówek dla SEO/czytników — bez wizualnego tytułu, wyszukiwarka jak na /kup. */}
            <h1 className="sr-only">
              Sprawdź działkę: granice, powierzchnia, przeznaczenie z planu i orientacyjna cena okolicy
            </h1>

            <div className="rounded-xl border border-fg/25">
              <input
                ref={addrRef}
                onKeyDown={onKey}
                placeholder="Wpisz adres, a dostaniesz raport"
                aria-label="Adres lub miejscowość działki"
                className="w-full bg-transparent px-4 py-4 text-[16px] text-fg outline-none placeholder:text-fg/45"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMapOpen((s) => !s)}
                className="text-sm font-medium text-brand-text underline decoration-1 underline-offset-4 transition hover:text-brand-bright"
              >
                {mapOpen ? 'Ukryj mapę' : 'Wskaż na mapie (polecane)'}
              </button>

              <button
                type="button"
                onClick={handleCheck}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-8 text-[12px] font-medium uppercase tracking-[0.22em] text-ink transition hover:bg-brand-bright disabled:opacity-60"
              >
                {loading ? 'Sprawdzam…' : 'Sprawdź działkę'}
              </button>
            </div>

            {/* MAPA — rozwijana w karcie */}
            <div
              className={`overflow-hidden transition-all duration-300 ${mapOpen ? 'mt-5 max-h-[460px]' : 'max-h-0'}`}
            >
              <div className="overflow-hidden rounded-xl border border-fg/15">
                <div ref={mapDivRef} className="h-[360px] w-full" />
              </div>
              <p className="mt-2 text-[13px] text-fg/60">
                Kliknij działkę na mapie i przeciągnij pinezkę, żeby trafić dokładnie.
              </p>
            </div>

            {loading ? (
              <p className="mt-4 text-sm text-fg/65">
                Zbieramy dane z ewidencji i planu. To dobry moment na kawę, raport będzie za chwilę.
              </p>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* WYNIK — pod hero, na jasnym tle, od lewej */}
      <div ref={reportRef} className="mx-auto max-w-6xl scroll-mt-24 px-6 md:px-10">
        {result ? (
          <div className="mt-14">
            <Raport data={result} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
