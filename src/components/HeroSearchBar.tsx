'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadGoogleMaps } from '@/lib/googleMaps';
import type { Przeznaczenie } from '@prisma/client';

const KM_OPTIONS = [5, 10, 20, 40] as const;

const QUICK_PRZEZN: { key: Przeznaczenie; label: string }[] = [
  { key: 'BUDOWLANA', label: 'Budowlana' },
  { key: 'ROLNA', label: 'Rolna' },
  { key: 'REKREACYJNA', label: 'Rekreacyjna' },
  { key: 'INWESTYCYJNA', label: 'Inwestycyjna' },
];

// Ładowanie Maps JS (z libraries=places) idzie przez jedną współdzieloną funkcję
// loadGoogleMaps() z @/lib/googleMaps — wspólny strażnik z mapą KupMap, żeby skrypt
// nie doklejał się drugi raz („multiple times on this page").

async function geocodeText(text: string): Promise<{ lat: number; lng: number } | null> {
  if (!window.google?.maps?.Geocoder) return null;
  const q = text.trim();
  if (!q) return null;

  return new Promise((resolve) => {
    new window.google.maps.Geocoder().geocode(
      { address: `${q}, Polska`, region: 'pl' },
      (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
        if (status !== 'OK' || !results?.[0]?.geometry?.location) {
          resolve(null);
          return;
        }
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      },
    );
  });
}

export default function HeroSearchBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapsLoadedRef = useRef<Promise<void>>(Promise.resolve());

  const [locText, setLocText] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  // Domyślny promień 20 km — spójnie z /kup (DEFAULT_RADIUS_KM). Przy rzadkiej podaży
  // 10 km w mniejszym mieście dawało za mało; kupujący działkę myśli regionem.
  const [radiusKm, setRadiusKm] = useState<(typeof KM_OPTIONS)[number]>(20);
  const [przezn, setPrzezn] = useState<Przeznaczenie[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    // Store the promise so handleSearch can await Maps before geocoding
    mapsLoadedRef.current = loadGoogleMaps()
      .then(() => {
        if (!inputRef.current) return;

        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'pl' },
          fields: ['geometry', 'formatted_address', 'name'],
        });

        ac.addListener('place_changed', () => {
          const p = ac.getPlace();
          const label = p?.formatted_address || p?.name || '';
          const loc = p?.geometry?.location;

          if (label) setLocText(label);
          if (loc) {
            setCenter({ lat: loc.lat(), lng: loc.lng() });
          }
        });
      })
      .catch(() => {});
  }, []);

  function togglePrzezn(key: Przeznaczenie) {
    setPrzezn((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }

  async function handleSearch() {
    setSearching(true);

    try {
      let resolvedCenter = center;
      const loc = locText.trim();

      if (loc && !resolvedCenter) {
        await mapsLoadedRef.current; // wait for Maps to fully load before geocoding
        resolvedCenter = await geocodeText(loc);
      }

      const sp = new URLSearchParams();
      if (loc) sp.set('loc', loc);
      if (resolvedCenter) {
        sp.set('lat', String(resolvedCenter.lat));
        sp.set('lng', String(resolvedCenter.lng));
        sp.set('radius', String(radiusKm));
      }
      if (przezn.length) sp.set('przezn', przezn.join(','));

      const qs = sp.toString();
      router.push(qs ? `/kup?${qs}` : '/kup');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="pointer-events-auto w-full max-w-2xl">
      <div className="flex gap-2 rounded-2xl border border-white/20 bg-black/55 p-2 shadow-2xl backdrop-blur-md">
        <input
          ref={inputRef}
          value={locText}
          onChange={(e) => {
            setLocText(e.target.value);
            setCenter(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSearch();
          }}
          type="text"
          placeholder="Wpisz miasto lub region…"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none placeholder:text-white/45 md:text-[15px]"
        />

        <select
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value) as (typeof KM_OPTIONS)[number])}
          className="shrink-0 cursor-pointer bg-transparent py-2 pr-1 text-sm text-white/60 outline-none"
          aria-label="Zasięg wyszukiwania"
        >
          {KM_OPTIONS.map((km) => (
            <option key={km} value={km} className="bg-bg text-fg">
              +{km} km
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={searching}
          className="shrink-0 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-black transition hover:bg-brand-bright disabled:opacity-60 md:px-6 md:text-[15px]"
        >
          {searching ? 'Szukam…' : 'Szukaj'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {QUICK_PRZEZN.map(({ key, label }) => {
          const active = przezn.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => togglePrzezn(key)}
              className={[
                'rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-[0.12em] backdrop-blur-sm transition',
                active
                  ? 'border-brand/80 bg-brand/20 text-white'
                  : 'border-white/25 bg-black/30 text-white/65 hover:border-white/45 hover:text-white',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
