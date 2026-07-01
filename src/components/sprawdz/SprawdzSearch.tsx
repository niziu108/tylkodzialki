'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import Raport, { type RaportData } from './Raport';

// P24: wyszukiwarka narzędzia. Punkt wskazuje UŻYTKOWNIK (pinezka / adres / numer ewidencyjny) —
// to daje precyzję, której nie mają nasze przybliżone geo ofert (omija blokadę P23). Reuse jedynej
// ładowarki Google Maps (src/lib/googleMaps.ts).

type Point = { lat: number; lng: number };

export default function SprawdzSearch() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const addrRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const [point, setPoint] = useState<Point | null>(null);
  const [parcelId, setParcelId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RaportData | null>(null);

  // Trzymamy najświeższy punkt w refie, żeby listenery mapy (rejestrowane raz) widziały aktualny stan.
  const pointRef = useRef<Point | null>(null);
  pointRef.current = point;

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
          mapTypeId: 'hybrid',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;

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

  async function handleCheck() {
    if (loading) return;
    setError(null);

    const body = parcelId.trim()
      ? { parcelId: parcelId.trim() }
      : point
        ? { lat: point.lat, lng: point.lng }
        : null;

    if (!body) {
      setError('Wskaż działkę: kliknij ją na mapie, wpisz adres albo numer ewidencyjny.');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/sprawdz-dzialke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as RaportData | { error: string };

      if (!res.ok || 'error' in json) {
        setError('error' in json ? json.error : 'Nie udało się sprawdzić działki.');
        return;
      }

      setResult(json);
      // Ustaw pin na środku znalezionej działki (gdy szukano po numerze — mapa skoczy na miejsce).
      placeMarker(json.parcel.center);
    } catch {
      setError('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-fg/12 bg-surface-2/60 p-5 backdrop-blur md:p-7">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            ref={addrRef}
            placeholder="Wpisz adres lub miejscowość…"
            className="w-full rounded-xl border border-fg/15 bg-surface px-4 py-3 text-fg outline-none placeholder:text-fg/55 focus:border-brand/60"
          />
          <input
            value={parcelId}
            onChange={(e) => setParcelId(e.target.value)}
            placeholder="Numer ewidencyjny (opcjonalnie)"
            className="w-full rounded-xl border border-fg/15 bg-surface px-4 py-3 text-fg outline-none placeholder:text-fg/55 focus:border-brand/60"
          />
        </div>

        <p className="mt-3 text-[13px] text-fg/60">
          Najprościej: kliknij swoją działkę na mapie (możesz przeciągnąć pinezkę, żeby trafić
          dokładnie).
        </p>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-fg/12">
          <div ref={mapDivRef} className="h-[300px] w-full sm:h-[360px]" />

          {loading ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg/80 backdrop-blur-sm">
              <HourglassIcon className="h-9 w-9 animate-spin text-brand-bright" />
              <p className="px-6 text-center text-sm text-fg/80">
                Zbieramy dane z ewidencji. To dobry moment na kawę, raport będzie za chwilę.
              </p>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleCheck}
          disabled={loading}
          className="mt-5 inline-flex h-13 w-full items-center justify-center rounded-2xl bg-brand px-8 py-4 text-[15px] font-semibold text-ink transition hover:bg-brand-bright disabled:opacity-60 sm:w-auto"
        >
          {loading ? 'Sprawdzam…' : 'Sprawdź działkę'}
        </button>
      </div>

      {result ? <Raport data={result} /> : null}
    </div>
  );
}

function HourglassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M6 3h12M6 21h12M7 3c0 4 5 5 5 9s-5 5-5 9M17 3c0 4-5 5-5 9s5 5 5 9"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
