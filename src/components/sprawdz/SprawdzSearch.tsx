'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import Raport, { type RaportData } from './Raport';

// P24: wyszukiwarka narzędzia. Punkt wskazuje UŻYTKOWNIK (pinezka / adres / numer ewidencyjny) —
// to daje precyzję, której nie mają nasze przybliżone geo ofert (omija blokadę P23).
// Formularz i mapa na całą szerokość (bez kafelka). Bramka logowania: pierwszy raport bez konta,
// kolejny wymaga zalogowania (daje nam użytkowników).

type Point = { lat: number; lng: number };

const FREE_LIMIT = 1;
const USED_KEY = 'sd_used';

export default function SprawdzSearch({ example }: { example?: RaportData | null }) {
  const { status } = useSession();
  const isLogged = status === 'authenticated';

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const addrRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const [point, setPoint] = useState<Point | null>(null);
  const [parcelId, setParcelId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RaportData | null>(null);
  const [gated, setGated] = useState(false);

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
    setGated(false);

    const body = parcelId.trim()
      ? { parcelId: parcelId.trim() }
      : point
        ? { lat: point.lat, lng: point.lng }
        : null;

    if (!body) {
      setError('Wskaż działkę: kliknij ją na mapie, wpisz adres albo numer ewidencyjny.');
      return;
    }

    // Bramka: pierwszy raport bez konta, kolejny wymaga logowania.
    if (!isLogged) {
      const used = Number(localStorage.getItem(USED_KEY) || '0');
      if (used >= FREE_LIMIT) {
        setGated(true);
        return;
      }
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
      if (!isLogged) {
        const used = Number(localStorage.getItem(USED_KEY) || '0');
        localStorage.setItem(USED_KEY, String(used + 1));
      }
      placeMarker(json.parcel.center);
    } catch {
      setError('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      {/* FORMULARZ — na całą szerokość, bez kafelka */}
      <div className="mx-auto max-w-2xl text-center">
        <input
          ref={addrRef}
          placeholder="Wpisz adres lub miejscowość…"
          className="w-full rounded-2xl border border-fg/15 bg-surface px-5 py-4 text-center text-lg text-fg outline-none placeholder:text-fg/45 focus:border-brand/60"
        />
        <p className="mt-3 text-[13px] text-fg/55">
          albo kliknij działkę na mapie i przeciągnij pinezkę, żeby trafić dokładnie
        </p>
      </div>

      {/* MAPA — pełna szerokość, wysoka */}
      <div className="relative mt-8 overflow-hidden rounded-[24px] border border-fg/12">
        <div ref={mapDivRef} className="h-[440px] w-full md:h-[560px]" />

        {loading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg/80 backdrop-blur-sm">
            <HourglassIcon className="h-9 w-9 animate-spin text-brand" />
            <p className="px-6 text-center text-sm text-fg/80">
              Zbieramy dane z ewidencji. To dobry moment na kawę, raport będzie za chwilę.
            </p>
          </div>
        ) : null}
      </div>

      {/* Numer ewidencyjny (opcja) + akcja */}
      <div className="mx-auto mt-6 flex max-w-2xl flex-col items-center gap-4">
        <input
          value={parcelId}
          onChange={(e) => setParcelId(e.target.value)}
          placeholder="Znasz numer ewidencyjny? Wpisz go tutaj (opcjonalnie)"
          className="w-full rounded-xl border border-fg/12 bg-surface px-4 py-3 text-center text-sm text-fg outline-none placeholder:text-fg/45 focus:border-brand/60"
        />

        {error ? (
          <p className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleCheck}
          disabled={loading}
          className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-brand px-8 text-[16px] font-semibold text-ink transition hover:bg-brand-bright disabled:opacity-60"
        >
          {loading ? 'Sprawdzam…' : 'Sprawdź działkę'}
        </button>
      </div>

      {/* WYNIK / BRAMKA / PRZYKŁAD */}
      <div className="mt-16">
        {result ? (
          <Raport data={result} />
        ) : gated ? (
          <LoginGate />
        ) : example ? (
          <Raport data={example} isExample />
        ) : null}
      </div>
    </div>
  );
}

function LoginGate() {
  return (
    <div className="mx-auto max-w-xl border-y border-fg/12 py-12 text-center">
      <div className="text-[12px] uppercase tracking-[0.2em] text-fg/45">Kolejny raport</div>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-fg md:text-3xl">
        Zaloguj się, żeby sprawdzić dalej
      </h3>
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-7 text-fg/65">
        Pierwsza działka jest bez konta. Załóż darmowe konto albo zaloguj się, a sprawdzisz kolejne
        działki bez limitu i zapiszesz swoje raporty.
      </p>
      <Link
        href="/logowanie?callbackUrl=/sprawdz-dzialke"
        className="mt-7 inline-flex h-13 items-center justify-center rounded-2xl bg-brand px-8 text-[15px] font-semibold text-ink transition hover:bg-brand-bright"
      >
        Zaloguj się lub załóż konto
      </Link>
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
