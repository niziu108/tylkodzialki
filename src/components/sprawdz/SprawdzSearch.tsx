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

// Geokodowanie wpisanego adresu: najpierw klient (żądania z tylkodzialki.pl przechodzą
// restrykcje klucza po Referrer), potem serwerowy fallback /api/geocode. Reużyte podejście
// z wyszukiwarki /kup, żeby po wpisaniu adresu i kliknięciu „Sprawdź" od razu otworzyć mapę.
async function geocodeAddress(text: string): Promise<Point | null> {
  const q = text.trim();
  if (!q) return null;

  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    const client = await new Promise<Point | null>((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      const address = /polska|poland/i.test(q) ? q : `${q}, Polska`;
      geocoder.geocode(
        { address, region: 'pl' },
        (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
          if (status !== 'OK' || !results?.[0]?.geometry?.location) {
            resolve(null);
          } else {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lng: loc.lng() });
          }
        }
      );
    });
    if (client) return client;
  }

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: unknown; lng?: unknown };
    if (typeof data.lat === 'number' && typeof data.lng === 'number') {
      return { lat: data.lat, lng: data.lng };
    }
  } catch {
    // ignore
  }
  return null;
}

export default function SprawdzSearch() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const addrRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const [mapOpen, setMapOpen] = useState(false);
  // Podkład: zwykła mapa albo satelita (hybrid = zdjęcie + etykiety). Granice działek z WMS
  // są w overlayMapTypes, więc rysują się na wierzchu obu podkładów — na satelicie widać
  // zabudowę i drogi, łatwiej trafić w swoją działkę.
  const [satellite, setSatellite] = useState(false);
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

  // Mapa startuje ukryta (opacity-0), więc przy otwarciu wymuszamy przerysowanie i wracamy
  // na aktualny punkt — inaczej kafelki bywają szare do pierwszego ruchu.
  useEffect(() => {
    if (!mapOpen) return;
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    google.maps.event.trigger(map, 'resize');
    if (point) map.setCenter(point);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapOpen]);

  // Przełączanie podkładu mapa/satelita.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    map.setMapTypeId(satellite ? 'hybrid' : 'roadmap');
  }, [satellite]);

  async function handleCheck() {
    if (loading) return;
    setError(null);

    // Brak wskazanego punktu, ale user wpisał adres → geokodujemy, otwieramy mapę na tym
    // miejscu i pozwalamy dociągnąć pinezkę do właściwej działki (adres ≠ działka ewidencyjna).
    if (!point) {
      const typed = addrRef.current?.value?.trim() ?? '';
      if (!typed) {
        setError('Wpisz adres działki albo wskaż ją na mapie.');
        return;
      }
      setLoading(true);
      const geo = await geocodeAddress(typed);
      setLoading(false);
      if (!geo) {
        setError('Nie znaleźliśmy tego adresu. Doprecyzuj go albo wskaż działkę na mapie.');
        return;
      }
      setPoint(geo);
      setMapOpen(true);
      placeMarker(geo, 17);
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
      setMapOpen(false);
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
          <div className="w-full max-w-2xl rounded-2xl border border-fg/10 bg-surface-2/78 p-5 backdrop-blur-sm md:p-8">
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

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-brand/60 px-4 text-[12px] font-medium uppercase tracking-[0.18em] text-brand-text transition hover:border-brand hover:text-brand-bright"
              >
                Wskaż na mapie
              </button>

              <button
                type="button"
                onClick={handleCheck}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-4 text-[12px] font-medium uppercase tracking-[0.18em] text-ink transition hover:bg-brand-bright disabled:opacity-60"
              >
                {loading ? 'Sprawdzam…' : 'Sprawdź działkę'}
              </button>
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

      {/* MAPA NA CAŁY EKRAN — wskazujesz działkę i zatwierdzasz. Spójne z mapą na /kup.
          Nakładka jest zawsze zamontowana (mapa inicjuje się w pełnym rozmiarze przy starcie),
          a zamknięta chowa się przez opacity/-z bez display:none, żeby kafelki były gotowe. */}
      <div
        className={[
          'fixed inset-0 transition-opacity duration-200',
          mapOpen ? 'z-[120] opacity-100' : 'pointer-events-none -z-10 opacity-0',
        ].join(' ')}
        aria-hidden={!mapOpen}
      >
        <div ref={mapDivRef} className="h-full w-full bg-[#e8eaed]" />

        {/* Pasek górny: podpowiedź + zamknij */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <div className="pointer-events-auto max-w-[70%] rounded-xl bg-surface/95 px-4 py-2.5 text-[13px] leading-snug text-fg/80 shadow-lg backdrop-blur">
            Przybliż mapę, pokażą się granice działek z numerami. Kliknij swoją działkę, a
            potem „Sprawdź tę działkę".
          </div>
          <button
            type="button"
            onClick={() => setMapOpen(false)}
            className="pointer-events-auto inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-surface/95 px-4 text-[12px] font-medium uppercase tracking-[0.18em] text-fg/80 shadow-lg backdrop-blur transition hover:text-fg"
          >
            Zamknij ✕
          </button>
        </div>

        {/* Przełącznik podkładu: zwykła mapa / satelita. Na satelicie łatwiej trafić w działkę
            po zabudowie i drogach, a granice z WMS nadal się rysują na wierzchu. */}
        <div className="absolute left-4 top-32 flex w-44 overflow-hidden rounded-xl bg-surface/95 text-[12px] font-medium uppercase tracking-[0.14em] shadow-lg backdrop-blur md:top-20">
          {([false, true] as const).map((sat) => {
            const active = satellite === sat;
            return (
              <button
                key={String(sat)}
                type="button"
                onClick={() => setSatellite(sat)}
                aria-pressed={active}
                className={`flex-1 py-2.5 text-center transition ${active ? 'bg-brand text-ink' : 'text-fg/75 hover:text-fg'}`}
              >
                {sat ? 'Satelita' : 'Mapa'}
              </button>
            );
          })}
        </div>

        {/* Błąd (np. punkt między działkami) — pokazany na mapie, nie tylko w karcie pod spodem */}
        {error && mapOpen ? (
          <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4">
            <p className="pointer-events-auto max-w-md rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2.5 text-center text-sm text-red-100 shadow-lg backdrop-blur">
              {error}
            </p>
          </div>
        ) : null}

        {/* Zatwierdź wskazaną działkę */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-5">
          <button
            type="button"
            onClick={handleCheck}
            disabled={loading || !point}
            className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-8 text-[12px] font-medium uppercase tracking-[0.22em] text-ink shadow-[0_12px_40px_rgba(0,0,0,0.25)] transition hover:bg-brand-bright disabled:opacity-60"
          >
            {loading ? 'Sprawdzam…' : 'Sprawdź tę działkę'}
          </button>
        </div>
      </div>

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
