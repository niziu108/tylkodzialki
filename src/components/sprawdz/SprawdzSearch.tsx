'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import Raport, { type RaportData } from './Raport';

// P24: wyszukiwarka narzędzia w stylu wyszukiwarki z głównej (/kup) — karta na zdjęciu hero,
// wyśrodkowana, z tytułem „Sprawdź działkę". Punkt wskazuje UŻYTKOWNIK (adres / numer / pinezka).
// Darmowe, bez logowania. Mapa i raport pojawiają się pod spodem, na jasnym tle.

type Point = { lat: number; lng: number };

export default function SprawdzSearch({ example }: { example?: RaportData | null }) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const addrRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const [mapOpen, setMapOpen] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const [parcelId, setParcelId] = useState('');
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

  async function handleCheck() {
    if (loading) return;
    setError(null);

    const body = parcelId.trim()
      ? { parcelId: parcelId.trim() }
      : point
        ? { lat: point.lat, lng: point.lng }
        : null;

    if (!body) {
      setError('Wskaż działkę: wpisz adres, numer ewidencyjny albo kliknij ją na mapie.');
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
      {/* HERO z wyszukiwarką — jasna oprawa jak na /dla-biur (gradient + siateczka + poświata) */}
      <div className="relative overflow-hidden rounded-[28px] border border-fg/10 bg-bg">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] opacity-35" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(122,163,51,0.18),transparent_36%),radial-gradient(circle_at_82%_78%,rgba(47,94,70,0.05),transparent_34%)]" />
        <div className="pointer-events-none absolute left-[-140px] top-16 h-[420px] w-[420px] rounded-full bg-brand/10 blur-[120px]" />

        <div className="relative mx-auto max-w-2xl px-4 py-12 md:py-16">
          <div className="rounded-2xl border border-fg/10 bg-surface-2/85 p-6 backdrop-blur-sm md:p-8">
            <h1 className="text-center text-[24px] font-semibold tracking-tight text-fg md:text-[30px]">
              Sprawdź działkę
            </h1>
            <p className="mt-2 text-center text-[15px] text-fg/65">
              Wpisz adres i otrzymaj raport. Za darmo, bez logowania.
            </p>

            <div className="mt-6 grid gap-4 text-left">
              <div>
                <label className="block text-[12px] uppercase tracking-[0.18em] text-fg/70">
                  Adres lub miejscowość
                </label>
                <div className="mt-2 rounded-xl border border-fg/25">
                  <input
                    ref={addrRef}
                    onKeyDown={onKey}
                    placeholder="np. Warszawa, ul. Marszałkowska"
                    className="w-full bg-transparent px-4 py-3 text-[15px] text-fg outline-none placeholder:text-fg/45"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] uppercase tracking-[0.18em] text-fg/70">
                  Numer ewidencyjny (opcjonalnie)
                </label>
                <div className="mt-2 rounded-xl border border-fg/25">
                  <input
                    value={parcelId}
                    onChange={(e) => setParcelId(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="np. 146502_8.1103.110/4"
                    className="w-full bg-transparent px-4 py-3 text-[15px] text-fg outline-none placeholder:text-fg/45"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMapOpen((s) => !s)}
                className="text-sm font-medium text-brand-text underline decoration-1 underline-offset-4 transition hover:text-brand-bright"
              >
                {mapOpen ? 'Ukryj mapę' : 'wskaż na mapie'}
              </button>

              <button
                type="button"
                onClick={handleCheck}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-8 text-[15px] font-semibold text-ink transition hover:bg-brand-bright disabled:opacity-60"
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
      </div>

      {/* WYNIK / PRZYKŁAD — pod spodem, na jasnym tle, od lewej */}
      <div className="mt-14">
        {result ? <Raport data={result} /> : example ? <Raport data={example} isExample /> : null}
      </div>
    </div>
  );
}
