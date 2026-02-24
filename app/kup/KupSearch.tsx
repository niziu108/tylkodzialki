'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import KupList from './KupList';
import type { Przeznaczenie } from '@prisma/client';

type ApiPhoto = { id?: string; url: string; publicId?: string; kolejnosc?: number };
type ApiDzialka = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  locationLabel?: string | null;
  locationFull?: string | null;
  lat?: number | null;
  lng?: number | null;
  przeznaczenia?: Przeznaczenie[];
  zdjecia?: ApiPhoto[];
};

const KM_OPTIONS = [0, 5, 10, 20, 40] as const;

const PRZEZN: { key: Przeznaczenie; label: string }[] = [
  { key: 'BUDOWLANA', label: 'BUDOWLANA' },
  { key: 'USLUGOWA', label: 'USŁUGOWA' },
  { key: 'ROLNA', label: 'ROLNA' },
  { key: 'LESNA', label: 'LEŚNA' },
  { key: 'INWESTYCYJNA', label: 'INWESTYCYJNA' },
];

const PAGE_SIZE = 20;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

function loadPlaces(apiKey: string) {
  return new Promise<void>((resolve, reject) => {
    // @ts-ignore
    if (window.google?.maps?.places) return resolve();
    const id = 'google-places-js';
    if (document.getElementById(id)) return resolve();

    const s = document.createElement('script');
    s.id = id;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=pl`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Nie udało się załadować Google Places.'));
    document.head.appendChild(s);
  });
}

// ✅ tylko cyfry (usuwa spacje, przecinki, kropki itd.)
function digitsOnly(s: string) {
  return s.replace(/\D/g, '');
}

// ✅ format PL: 1000 -> "1 000", 10000 -> "10 000", 1000000 -> "1 000 000"
function formatPLThousands(digits: string) {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ✅ handler: user nie wpisze spacji, a my je dodamy automatycznie
function makeAutoPLHandler(setter: (v: string) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = digitsOnly(e.target.value);
    setter(formatPLThousands(d));
  };
}

function buildMobilePages(page: number, total: number): Array<number | '…'> {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  // start
  if (page <= 4) return [1, 2, 3, 4, '…', total];

  // end
  if (page >= total - 3) return [1, '…', total - 3, total - 2, total - 1, total];

  // middle
  return [1, '…', page - 1, page, page + 1, '…', total];
}

function PagerResponsive({
  page,
  totalPages,
  onPrev,
  onNext,
  onGo,
  className,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onGo: (p: number) => void;
  className?: string;
}) {
  const [val, setVal] = React.useState(String(page));

  React.useEffect(() => {
    setVal(String(page));
  }, [page]);

  const go = () => {
    const n = Number(String(val).replace(/[^\d]/g, ''));
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(1, Math.min(totalPages, n));
    onGo(clamped);
  };

  const mobilePages = useMemo(() => buildMobilePages(page, totalPages), [page, totalPages]);

  return (
    <div className={className || ''}>
      {/* ✅ MOBILE (ładne numerki) */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={page <= 1}
            className={[
              'text-[12px] tracking-[0.22em] uppercase transition',
              page <= 1 ? 'text-white/30' : 'text-white/70 hover:text-white',
            ].join(' ')}
            style={{
              textDecoration: 'underline',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: page <= 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.30)',
            }}
          >
            Poprzednia
          </button>

          <div className="flex items-center gap-2">
            {mobilePages.map((x, idx) => {
              if (x === '…') {
                return (
                  <span key={`dots-${idx}`} className="text-white/35 text-[12px] tracking-[0.18em]">
                    …
                  </span>
                );
              }

              const active = x === page;
              return (
                <button
                  key={x}
                  type="button"
                  onClick={() => onGo(x)}
                  className={[
                    'min-w-[26px] text-center text-[12px] tracking-[0.14em] uppercase transition',
                    active ? 'text-white' : 'text-white/60 hover:text-white',
                  ].join(' ')}
                  style={{
                    textDecoration: active ? 'underline' : 'none',
                    textUnderlineOffset: '10px',
                    textDecorationThickness: '1px',
                    textDecorationColor: active ? 'rgba(255,255,255,0.65)' : 'transparent',
                  }}
                >
                  {x}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={page >= totalPages}
            className={[
              'text-[12px] tracking-[0.22em] uppercase transition',
              page >= totalPages ? 'text-white/30' : 'text-white/70 hover:text-white',
            ].join(' ')}
            style={{
              textDecoration: 'underline',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: page >= totalPages ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.30)',
            }}
          >
            Następna
          </button>
        </div>
      </div>

      {/* ✅ DESKTOP (twoje idealne: prev 7/23 next + Idź do) */}
      <div className="hidden md:flex items-center justify-between gap-4">
        {/* LEFT */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={onPrev}
            disabled={page <= 1}
            className={[
              'text-[12px] tracking-[0.22em] uppercase transition',
              page <= 1 ? 'text-white/30' : 'text-white/70 hover:text-white',
            ].join(' ')}
            style={{
              textDecoration: 'underline',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: page <= 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.30)',
            }}
          >
            Poprzednia
          </button>

          <div className="text-white/55 text-[12px] tracking-[0.22em] uppercase">
            {page}/{totalPages}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={page >= totalPages}
            className={[
              'text-[12px] tracking-[0.22em] uppercase transition',
              page >= totalPages ? 'text-white/30' : 'text-white/70 hover:text-white',
            ].join(' ')}
            style={{
              textDecoration: 'underline',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: page >= totalPages ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.30)',
            }}
          >
            Następna
          </button>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">
          <div className="text-white/35 text-[11px] tracking-[0.22em] uppercase">Idź do</div>

          <input
            value={val}
            onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            className="w-[72px] rounded-xl border border-white/20 bg-transparent px-3 py-2 text-white/85 text-[13px] outline-none
                     focus:border-white/45 selection:bg-white/20 selection:text-white text-center"
            placeholder="…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') go();
            }}
          />

          <button
            type="button"
            onClick={go}
            className="rounded-xl border border-white/20 px-3 py-2 text-[11px] tracking-[0.22em] uppercase text-white/75 hover:border-white/40 transition"
          >
            Idź
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KupSearch() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ trzymamy pełną listę po filtrach (po API + radius)
  const [allItems, setAllItems] = useState<ApiDzialka[]>([]);
  const [count, setCount] = useState(0);

  // ✅ paginacja
  const [page, setPage] = useState(1);

  // FORM (to co user wpisuje)
  const [locText, setLocText] = useState('');
  const [radiusKm, setRadiusKm] = useState<(typeof KM_OPTIONS)[number]>(0);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

  // UWAGA: trzymamy string z formatem (np "10 000")
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [areaMin, setAreaMin] = useState('');
  const [areaMax, setAreaMax] = useState('');

  const [przezn, setPrzezn] = useState<Przeznaczenie[]>([]);

  // APPLIED (faktyczne filtry użyte do szukania) — tu trzymamy JUŻ same cyfry
  const [applied, setApplied] = useState({
    locText: '',
    radiusKm: 0 as (typeof KM_OPTIONS)[number],
    center: null as { lat: number; lng: number } | null,
    priceMin: '',
    priceMax: '',
    areaMin: '',
    areaMax: '',
    przezn: [] as Przeznaczenie[],
  });

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Google Places autocomplete (miasto/obszar)
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    loadPlaces(key)
      .then(() => {
        if (!inputRef.current) return;
        // @ts-ignore
        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ['geometry', 'formatted_address', 'name'],
          types: ['(cities)'],
        });

        ac.addListener('place_changed', () => {
          const p = ac.getPlace();
          const label = p?.formatted_address || p?.name || '';
          const loc = p?.geometry?.location;

          setLocText(label);
          if (loc?.lat && loc?.lng) {
            setCenter({ lat: loc.lat(), lng: loc.lng() });
          }
        });
      })
      .catch(() => {
        // działa dalej bez podpowiedzi
      });
  }, []);

  function togglePrzezn(k: Przeznaczenie) {
    setPrzezn((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  // ✅ POBIERANIE zawsze na konkretnym obiekcie filtrów
  async function fetchDataWith(nextApplied: typeof applied) {
    setLoading(true);
    setErr(null);
    try {
      const sp = new URLSearchParams();

      if (nextApplied.locText.trim()) sp.set('q', nextApplied.locText.trim());
      if (nextApplied.priceMin) sp.set('priceMin', nextApplied.priceMin);
      if (nextApplied.priceMax) sp.set('priceMax', nextApplied.priceMax);
      if (nextApplied.areaMin) sp.set('areaMin', nextApplied.areaMin);
      if (nextApplied.areaMax) sp.set('areaMax', nextApplied.areaMax);
      if (nextApplied.przezn.length) sp.set('przeznaczenia', nextApplied.przezn.join(','));

      // ✅ pobieramy więcej, bo radius jest po stronie klienta
      sp.set('take', '200');
      sp.set('skip', '0');
      sp.set('sort', 'newest');

      const res = await fetch(`/api/dzialki?${sp.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`GET /api/dzialki -> ${res.status}`);
      const data = await res.json();

      const list: ApiDzialka[] = data?.items ?? [];
      let filtered = list;

      // Radius (tylko jeśli mamy center + radius > 0)
      if (nextApplied.center && nextApplied.radiusKm > 0) {
        filtered = list.filter((d) => {
          if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return false;
          return haversineKm(nextApplied.center!.lat, nextApplied.center!.lng, d.lat, d.lng) <= nextApplied.radiusKm;
        });
      }

      setAllItems(filtered);
      setCount(filtered.length);

      // ✅ jak zmieniasz filtry — wracamy na 1 stronę
      setPage(1);
    } catch (e: any) {
      setErr(e?.message ?? 'Błąd pobierania');
      setAllItems([]);
      setCount(0);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }

  // pierwszy load listy
  useEffect(() => {
    fetchDataWith(applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyAndSearch() {
    const next = {
      locText,
      radiusKm,
      center,
      // ✅ do API lecą TYLKO cyfry
      priceMin: digitsOnly(priceMin),
      priceMax: digitsOnly(priceMax),
      areaMin: digitsOnly(areaMin),
      areaMax: digitsOnly(areaMax),
      przezn,
    };
    setApplied(next);
    fetchDataWith(next);
  }

  function reset() {
    setLocText('');
    setCenter(null);
    setRadiusKm(0);

    setPriceMin('');
    setPriceMax('');
    setAreaMin('');
    setAreaMax('');

    setPrzezn([]);

    const next = {
      locText: '',
      radiusKm: 0 as (typeof KM_OPTIONS)[number],
      center: null as { lat: number; lng: number } | null,
      priceMin: '',
      priceMax: '',
      areaMin: '',
      areaMax: '',
      przezn: [] as Przeznaczenie[],
    };

    setApplied(next);
    fetchDataWith(next);
  }

  // ✅ wyliczenia paginacji
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.max(1, Math.min(totalPages, page));

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return allItems.slice(start, start + PAGE_SIZE);
  }, [allItems, safePage]);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const goTo = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  return (
    <div className="w-full">
      {/* HERO z tłem */}
      <section className="relative w-full">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(/sprzedaj.webp)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* delikatny gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/0" />

        <div className="relative mx-auto max-w-6xl px-4 py-10 md:py-14">
          {/* WYSZUKIWARKA */}
          <div className="rounded-2xl border border-white/10 bg-[#0b0b0b]/78 backdrop-blur-sm p-5 md:p-8">
            {/* Rząd 1: Lokalizacja + km */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
              <div>
                <label className="block text-[12px] tracking-[0.26em] text-white/85 uppercase">Lokalizacja</label>
                <div className="mt-3 rounded-xl border border-white/25 bg-transparent">
                  <input
                    ref={inputRef}
                    value={locText}
                    onChange={(e) => {
                      setLocText(e.target.value);
                      setCenter(null);
                    }}
                    placeholder="Wpisz lokalizację"
                    className="w-full bg-transparent outline-none text-white/90 placeholder:text-white/35 px-4 py-3"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyAndSearch();
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] tracking-[0.26em] text-white/85 uppercase">Zasięg</label>
                <div className="mt-3 rounded-xl border border-white/25">
                  <select
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value) as any)}
                    className="w-full bg-transparent outline-none text-white/90 px-4 py-3"
                  >
                    {KM_OPTIONS.map((km) => (
                      <option key={km} value={km} className="bg-[#131313]">
                        + {km} km
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Rząd 2: Powierzchnia + Cena */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] tracking-[0.26em] text-white/85 uppercase">Powierzchnia</label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="relative rounded-xl border border-white/25">
                    <input
                      value={areaMin}
                      onChange={makeAutoPLHandler(setAreaMin)}
                      inputMode="numeric"
                      placeholder="od"
                      className="w-full bg-transparent outline-none text-white/90 placeholder:text-white/35 px-4 py-3 pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 text-sm">m²</span>
                  </div>

                  <div className="relative rounded-xl border border-white/25">
                    <input
                      value={areaMax}
                      onChange={makeAutoPLHandler(setAreaMax)}
                      inputMode="numeric"
                      placeholder="do"
                      className="w-full bg-transparent outline-none text-white/90 placeholder:text-white/35 px-4 py-3 pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 text-sm">m²</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[12px] tracking-[0.26em] text-white/85 uppercase">Cena</label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="relative rounded-xl border border-white/25">
                    <input
                      value={priceMin}
                      onChange={makeAutoPLHandler(setPriceMin)}
                      inputMode="numeric"
                      placeholder="od"
                      className="w-full bg-transparent outline-none text-white/90 placeholder:text-white/35 px-4 py-3 pr-14"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 text-sm">zł</span>
                  </div>

                  <div className="relative rounded-xl border border-white/25">
                    <input
                      value={priceMax}
                      onChange={makeAutoPLHandler(setPriceMax)}
                      inputMode="numeric"
                      placeholder="do"
                      className="w-full bg-transparent outline-none text-white/90 placeholder:text-white/35 px-4 py-3 pr-14"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 text-sm">zł</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rząd 3: Przeznaczenie + przyciski */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 items-end">
              <div>
                <label className="block text-[12px] tracking-[0.26em] text-white/85 uppercase">Przeznaczenie</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRZEZN.map((p) => {
                    const active = przezn.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePrzezn(p.key)}
                        className={[
                          'px-3 py-2 rounded-full text-[12px] tracking-[0.14em] uppercase border transition',
                          active ? 'border-white/80 text-white' : 'border-white/25 text-white/70 hover:border-white/45',
                        ].join(' ')}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-[12px] tracking-[0.22em] uppercase text-white/75 hover:border-white/40 transition"
                >
                  Wyczyść
                </button>

                <button
                  type="button"
                  onClick={applyAndSearch}
                  className="flex-1 rounded-xl bg-white text-black px-4 py-3 text-[12px] tracking-[0.22em] uppercase font-medium hover:bg-white/90 transition disabled:opacity-60"
                  disabled={loading}
                  title={radiusKm > 0 && !center ? 'Żeby radius działał po kilometrach, wybierz lokalizację z podpowiedzi Google.' : ''}
                >
                  {loading ? 'Szukam…' : 'Wyszukaj'}
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-white/55 text-[12px] tracking-[0.18em] uppercase">Wyniki: {count}</div>
              {err && <div className="text-red-300 text-sm">{err}</div>}
            </div>
          </div>

          <div className="h-6 md:h-10" />
        </div>
      </section>

      {/* LISTA */}
      <section className="mx-auto max-w-6xl px-4 mt-8">
        <PagerResponsive
          page={safePage}
          totalPages={totalPages}
          onPrev={goPrev}
          onNext={goNext}
          onGo={goTo}
          className="mb-6"
        />

        <KupList items={pageItems} loading={loading} error={err} />

        <PagerResponsive
          page={safePage}
          totalPages={totalPages}
          onPrev={goPrev}
          onNext={goNext}
          onGo={goTo}
          className="mt-10"
        />
      </section>
    </div>
  );
}