'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import Raport, { type RaportData } from './Raport';

// P24: wyszukiwarka narzędzia. Punkt wskazuje UŻYTKOWNIK (adres / numer ewidencyjny / pinezka).
// Wszystko od lewej, kompaktowo (styl /dla-biur). Mapa domyślnie schowana — rozwijana przyciskiem,
// żeby nie dominowała. Bramka logowania: pierwszy raport bez konta, kolejny wymaga zalogowania.

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

  const [mapOpen, setMapOpen] = useState(false);
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
    setGated(false);

    const body = parcelId.trim()
      ? { parcelId: parcelId.trim() }
      : point
        ? { lat: point.lat, lng: point.lng }
        : null;

    if (!body) {
      setError('Wskaż działkę: wpisz adres, numer ewidencyjny albo kliknij ją na mapie.');
      return;
    }

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
    } catch {
      setError('Coś poszło nie tak. Spróbuj ponownie za chwilę.');
    } finally {
      setLoading(false);
    }
  }

  const labelCls = 'block text-[12px] uppercase tracking-[0.14em] text-fg/45';
  const fieldCls =
    'field-line mt-2 w-full bg-transparent px-0 pb-2.5 text-[16px] text-fg outline-none placeholder:text-fg/30';

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleCheck();
  }

  return (
    <div className="w-full text-left">
      {/* FORMULARZ — pola jako linie, przycisk jak na głównej */}
      <div className="max-w-2xl">
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Adres lub miejscowość</label>
            <input
              ref={addrRef}
              onKeyDown={onKey}
              placeholder="np. Warszawa, ul. Marszałkowska"
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>Numer ewidencyjny (opcjonalnie)</label>
            <input
              value={parcelId}
              onChange={(e) => setParcelId(e.target.value)}
              onKeyDown={onKey}
              placeholder="np. 146502_8.1103.110/4"
              className={fieldCls}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start gap-4">
          <button
            type="button"
            onClick={handleCheck}
            disabled={loading}
            className="inline-flex h-13 items-center justify-center rounded-2xl bg-brand px-10 py-4 text-[15px] font-semibold text-ink transition hover:bg-brand-bright disabled:opacity-60"
          >
            {loading ? 'Sprawdzam…' : 'Sprawdź działkę'}
          </button>

          <button
            type="button"
            onClick={() => setMapOpen((s) => !s)}
            className="text-sm font-medium text-brand-text underline decoration-1 underline-offset-4 transition hover:text-brand-bright"
          >
            {mapOpen ? 'Ukryj mapę' : 'albo wskaż na mapie'}
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

      {/* MAPA — rozwijana */}
      <div
        className={`overflow-hidden transition-all duration-300 ${mapOpen ? 'mt-5 max-h-[560px]' : 'max-h-0'}`}
      >
        <div className="overflow-hidden rounded-2xl border border-fg/12">
          <div ref={mapDivRef} className="h-[400px] w-full md:h-[500px]" />
        </div>
        <p className="mt-2 text-[13px] text-fg/55">
          Kliknij działkę na mapie i przeciągnij pinezkę, żeby trafić dokładnie.
        </p>
      </div>

      {/* WYNIK / BRAMKA / PRZYKŁAD */}
      <div className="mt-14">
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
    <div className="max-w-xl border-l-2 border-brand/50 py-2 pl-5">
      <div className="text-[12px] uppercase tracking-[0.2em] text-fg/45">Kolejny raport</div>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
        Zaloguj się, żeby sprawdzić dalej
      </h3>
      <p className="mt-3 max-w-md text-[15px] leading-7 text-fg/65">
        Pierwsza działka jest bez konta. Załóż darmowe konto albo zaloguj się, a sprawdzisz kolejne
        działki bez limitu.
      </p>
      <Link
        href="/logowanie?callbackUrl=/sprawdz-dzialke"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 text-[15px] font-semibold text-ink transition hover:bg-brand-bright"
      >
        Zaloguj się lub załóż konto
      </Link>
    </div>
  );
}
