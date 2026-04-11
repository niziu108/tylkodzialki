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
  isFeatured?: boolean | null;
  featuredUntil?: string | Date | null;
};

const KM_OPTIONS = [5, 10, 20, 40] as const;

const PRZEZN: { key: Przeznaczenie; label: string }[] = [
  { key: 'INWESTYCYJNA', label: 'INWESTYCYJNA' },
  { key: 'BUDOWLANA', label: 'BUDOWLANA' },
  { key: 'ROLNA', label: 'ROLNA' },
  { key: 'LESNA', label: 'LEŚNA' },
  { key: 'REKREACYJNA', label: 'REKREACYJNA' },
  { key: 'SIEDLISKOWA', label: 'SIEDLISKOWA' },
];

const PAGE_SIZE = 20;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 =
    Math.cos((aLat * Math.PI) / 180) *
    Math.cos((bLat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
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
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&language=pl`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Nie udało się załadować Google Places.'));
    document.head.appendChild(s);
  });
}

function digitsOnly(s: string) {
  return s.replace(/\D/g, '');
}

function formatPLThousands(digits: string) {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function makeAutoPLHandler(setter: (v: string) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = digitsOnly(e.target.value);
    setter(formatPLThousands(d));
  };
}

function buildMobilePages(page: number, total: number): Array<number | '…'> {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  if (page <= 4) return [1, 2, 3, 4, '…', total];
  if (page >= total - 3) return [1, '…', total - 3, total - 2, total - 1, total];

  return [1, '…', page - 1, page, page + 1, '…', total];
}

function isFeaturedActive(item: ApiDzialka) {
  return (
    !!item.isFeatured &&
    !!item.featuredUntil &&
    new Date(item.featuredUntil).getTime() > Date.now()
  );
}

function sortPublicItems(list: ApiDzialka[]) {
  return [...list].sort((a, b) => {
    const aFeatured = isFeaturedActive(a);
    const bFeatured = isFeaturedActive(b);

    if (aFeatured !== bFeatured) {
      return aFeatured ? -1 : 1;
    }

    const aFeaturedUntil = a.featuredUntil ? new Date(a.featuredUntil).getTime() : 0;
    const bFeaturedUntil = b.featuredUntil ? new Date(b.featuredUntil).getTime() : 0;

    if (aFeatured && bFeatured && aFeaturedUntil !== bFeaturedUntil) {
      return bFeaturedUntil - aFeaturedUntil;
    }

    return 0;
  });
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
              textDecorationColor:
                page <= 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.30)',
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
              textDecorationColor:
                page >= totalPages ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.30)',
            }}
          >
            Następna
          </button>
        </div>
      </div>

      <div className="hidden md:flex items-center justify-between gap-4">
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
              textDecorationColor:
                page <= 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.30)',
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
              textDecorationColor:
                page >= totalPages ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.30)',
            }}
          >
            Następna
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-white/35 text-[11px] tracking-[0.22em] uppercase">Idź do</div>

          <input
            value={val}
            onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            className="w-[72px] rounded-xl border border-white/20 bg-transparent px-3 py-2 text-center text-[13px] text-white/85 outline-none focus:border-white/45 selection:bg-white/20 selection:text-white"
            placeholder="…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') go();
            }}
          />

          <button
            type="button"
            onClick={go}
            className="rounded-xl border border-white/20 px-3 py-2 text-[11px] tracking-[0.22em] uppercase text-white/75 transition hover:border-white/40"
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

  const [allItems, setAllItems] = useState<ApiDzialka[]>([]);
  const [count, setCount] = useState(0);

  const [page, setPage] = useState(1);

  const [locText, setLocText] = useState('');
  const [radiusKm, setRadiusKm] = useState<(typeof KM_OPTIONS)[number]>(5);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [areaMin, setAreaMin] = useState('');
  const [areaMax, setAreaMax] = useState('');

  const [przezn, setPrzezn] = useState<Przeznaczenie[]>([]);

  const [applied, setApplied] = useState({
    locText: '',
    radiusKm: 5 as (typeof KM_OPTIONS)[number],
    center: null as { lat: number; lng: number } | null,
    priceMin: '',
    priceMax: '',
    areaMin: '',
    areaMax: '',
    przezn: [] as Przeznaczenie[],
  });

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    loadPlaces(key)
      .then(() => {
        if (!inputRef.current) return;
        // @ts-ignore
        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ['geometry', 'formatted_address', 'name'],
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
      .catch(() => {});
  }, []);

  function togglePrzezn(k: Przeznaczenie) {
    setPrzezn((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function fetchDataWith(nextApplied: typeof applied) {
    setLoading(true);
    setErr(null);

    try {
      const sp = new URLSearchParams();

      const useRadiusSearch = !!nextApplied.center && nextApplied.radiusKm > 0;

      if (!useRadiusSearch && nextApplied.locText.trim()) {
        sp.set('q', nextApplied.locText.trim());
      }

      if (nextApplied.priceMin) sp.set('priceMin', nextApplied.priceMin);
      if (nextApplied.priceMax) sp.set('priceMax', nextApplied.priceMax);
      if (nextApplied.areaMin) sp.set('areaMin', nextApplied.areaMin);
      if (nextApplied.areaMax) sp.set('areaMax', nextApplied.areaMax);
      if (nextApplied.przezn.length) sp.set('przeznaczenia', nextApplied.przezn.join(','));

      sp.set('take', useRadiusSearch ? '500' : '200');
      sp.set('skip', '0');
      sp.set('sort', 'newest');

      const res = await fetch(`/api/dzialki?${sp.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`GET /api/dzialki -> ${res.status}`);

      const data = await res.json();
      const list: ApiDzialka[] = data?.items ?? [];

      let filtered = list;

      if (nextApplied.center && nextApplied.radiusKm > 0) {
        filtered = list.filter((d) => {
          if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return false;

          return (
            haversineKm(
              nextApplied.center!.lat,
              nextApplied.center!.lng,
              d.lat,
              d.lng
            ) <= nextApplied.radiusKm
          );
        });
      }

      const sorted = sortPublicItems(filtered);

      setAllItems(sorted);
      setCount(sorted.length);
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

  useEffect(() => {
    fetchDataWith(applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyAndSearch() {
    const next = {
      locText,
      radiusKm,
      center,
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
    setRadiusKm(5);
    setPriceMin('');
    setPriceMax('');
    setAreaMin('');
    setAreaMax('');
    setPrzezn([]);

    const next = {
      locText: '',
      radiusKm: 5 as (typeof KM_OPTIONS)[number],
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
      <section className="relative w-full">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/sprzedaj.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/0" />

        <div className="relative mx-auto max-w-6xl px-3 py-10 md:px-4 md:py-14">
          <div className="rounded-2xl border border-white/10 bg-[#0b0b0b]/78 p-5 backdrop-blur-sm md:p-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
              <div>
                <label className="block text-[12px] uppercase tracking-[0.26em] text-white/85">
                  Lokalizacja
                </label>
                <div className="mt-3 rounded-xl border border-white/25 bg-transparent">
                  <input
                    ref={inputRef}
                    value={locText}
                    onChange={(e) => {
                      setLocText(e.target.value);
                      setCenter(null);
                    }}
                    placeholder="Wpisz lokalizację"
                    className="w-full bg-transparent px-4 py-3 text-white/90 outline-none placeholder:text-white/35"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyAndSearch();
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] uppercase tracking-[0.26em] text-white/85">
                  Zasięg
                </label>
                <div className="mt-3 rounded-xl border border-white/25">
                  <select
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value) as any)}
                    className="w-full bg-transparent px-4 py-3 text-white/90 outline-none"
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

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-[12px] uppercase tracking-[0.26em] text-white/85">
                  Powierzchnia
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="relative rounded-xl border border-white/25">
                    <input
                      value={areaMin}
                      onChange={makeAutoPLHandler(setAreaMin)}
                      inputMode="numeric"
                      placeholder="od"
                      className="w-full bg-transparent px-4 py-3 pr-16 text-white/90 outline-none placeholder:text-white/35"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/60">
                      m²
                    </span>
                  </div>

                  <div className="relative rounded-xl border border-white/25">
                    <input
                      value={areaMax}
                      onChange={makeAutoPLHandler(setAreaMax)}
                      inputMode="numeric"
                      placeholder="do"
                      className="w-full bg-transparent px-4 py-3 pr-16 text-white/90 outline-none placeholder:text-white/35"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/60">
                      m²
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[12px] uppercase tracking-[0.26em] text-white/85">
                  Cena
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="relative rounded-xl border border-white/25">
                    <input
                      value={priceMin}
                      onChange={makeAutoPLHandler(setPriceMin)}
                      inputMode="numeric"
                      placeholder="od"
                      className="w-full bg-transparent px-4 py-3 pr-14 text-white/90 outline-none placeholder:text-white/35"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/60">
                      zł
                    </span>
                  </div>

                  <div className="relative rounded-xl border border-white/25">
                    <input
                      value={priceMax}
                      onChange={makeAutoPLHandler(setPriceMax)}
                      inputMode="numeric"
                      placeholder="do"
                      className="w-full bg-transparent px-4 py-3 pr-14 text-white/90 outline-none placeholder:text-white/35"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/60">
                      zł
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_260px]">
              <div>
                <label className="block text-[12px] uppercase tracking-[0.26em] text-white/85">
                  Przeznaczenie
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRZEZN.map((p) => {
                    const active = przezn.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePrzezn(p.key)}
                        className={[
                          'rounded-full border px-3 py-2 text-[12px] uppercase tracking-[0.14em] transition',
                          active
                            ? 'border-white/80 text-white'
                            : 'border-white/25 text-white/70 hover:border-white/45',
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
                  className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-[12px] uppercase tracking-[0.22em] text-white/75 transition hover:border-white/40"
                >
                  Wyczyść
                </button>

                <button
                  type="button"
                  onClick={applyAndSearch}
                  className="flex-1 rounded-xl bg-white px-4 py-3 text-[12px] font-medium uppercase tracking-[0.22em] text-black transition hover:bg-white/90 disabled:opacity-60"
                  disabled={loading}
                  title={
                    radiusKm > 0 && !center
                      ? 'Żeby radius działał po kilometrach, wybierz lokalizację z podpowiedzi Google.'
                      : ''
                  }
                >
                  {loading ? 'Szukam…' : 'Wyszukaj'}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div className="text-[12px] uppercase tracking-[0.18em] text-white/55">
                Wyniki: {count}
              </div>
              {err && <div className="text-sm text-red-300">{err}</div>}
            </div>
          </div>

          <div className="h-6 md:h-10" />
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-6xl px-3 md:px-4">
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