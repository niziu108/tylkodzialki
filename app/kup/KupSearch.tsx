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
const SCROLL_OFFSET = -450;
const STORAGE_KEY = 'TD_KUP_STATE_V2';

type AppliedFilters = {
  locText: string;
  radiusKm: (typeof KM_OPTIONS)[number];
  center: { lat: number; lng: number } | null;
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
  przezn: Przeznaczenie[];
};

type StoredState = {
  filters: AppliedFilters;
  page: number;
};

const EMPTY_APPLIED: AppliedFilters = {
  locText: '',
  radiusKm: 5,
  center: null,
  priceMin: '',
  priceMax: '',
  areaMin: '',
  areaMax: '',
  przezn: [],
};

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
    setter(formatPLThousands(digitsOnly(e.target.value)));
  };
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSearchQuery(value: string) {
  const ignored = new Set([
    'polska',
    'poland',
    'wojewodztwo',
    'woj',
    'powiat',
    'gmina',
    'miasto',
    'okolice',
  ]);

  return normalizeText(value)
    .split(' ')
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .filter((x) => !ignored.has(x))
    .join(' ');
}

function matchesTextSearch(d: ApiDzialka, query: string) {
  const q = cleanSearchQuery(query);
  if (!q) return false;

  const haystack = normalizeText(
    [d.locationLabel, d.locationFull, d.tytul].filter(Boolean).join(' ')
  );

  if (!haystack) return false;

  const tokens = q.split(' ').filter((x) => x.length >= 2);
  if (!tokens.length) return haystack.includes(q);

  return tokens.every((token) => haystack.includes(token));
}

function buildMobilePages(page: number, total: number): Array<number | '…'> {
  if (total <= 4) return Array.from({ length: total }, (_, i) => i + 1);

  if (page <= 2) return [1, 2, 3, '…', total];

  if (page >= total - 1) return [1, '…', total - 2, total - 1, total];

  return [1, '…', page, '…', total];
}

function isFeaturedActive(item: ApiDzialka) {
  return (
    !!item.isFeatured &&
    !!item.featuredUntil &&
    new Date(item.featuredUntil).getTime() > Date.now()
  );
}

function sortPublicItems(list: ApiDzialka[], rankMap?: Map<string, number>) {
  return [...list].sort((a, b) => {
    const aFeatured = isFeaturedActive(a);
    const bFeatured = isFeaturedActive(b);

    if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;

    const aRank = rankMap?.get(a.id) ?? 99;
    const bRank = rankMap?.get(b.id) ?? 99;
    if (aRank !== bRank) return aRank - bRank;

    const aFeaturedUntil = a.featuredUntil ? new Date(a.featuredUntil).getTime() : 0;
    const bFeaturedUntil = b.featuredUntil ? new Date(b.featuredUntil).getTime() : 0;

    if (aFeatured && bFeatured && aFeaturedUntil !== bFeaturedUntil) {
      return bFeaturedUntil - aFeaturedUntil;
    }

    return 0;
  });
}

function buildUrlFromState(filters: AppliedFilters, page: number) {
  const sp = new URLSearchParams();

  if (filters.locText.trim()) sp.set('loc', filters.locText.trim());

  if (filters.center) {
    sp.set('lat', String(filters.center.lat));
    sp.set('lng', String(filters.center.lng));
  }

  if (filters.radiusKm !== 5) sp.set('radius', String(filters.radiusKm));
  if (filters.priceMin) sp.set('priceMin', filters.priceMin);
  if (filters.priceMax) sp.set('priceMax', filters.priceMax);
  if (filters.areaMin) sp.set('areaMin', filters.areaMin);
  if (filters.areaMax) sp.set('areaMax', filters.areaMax);
  if (filters.przezn.length) sp.set('przezn', filters.przezn.join(','));
  if (page > 1) sp.set('page', String(page));

  const qs = sp.toString();
  return qs ? `/kup?${qs}` : '/kup';
}

function saveState(filters: AppliedFilters, page: number) {
  if (typeof window === 'undefined') return;

  const url = buildUrlFromState(filters, page);

  try {
    const data: StoredState = { filters, page };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    sessionStorage.setItem('TD_KUP_URL', url);
  } catch {}
}

function loadStoredState(): StoredState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredState;
    if (!parsed?.filters) return null;

    return parsed;
  } catch {
    return null;
  }
}

function readStateFromUrl(): StoredState {
  if (typeof window === 'undefined') {
    return { filters: EMPTY_APPLIED, page: 1 };
  }

  const sp = new URLSearchParams(window.location.search);
  const hasQuery = Array.from(sp.keys()).length > 0;

  if (!hasQuery) {
    const stored = loadStoredState();
    if (stored) return stored;
  }

  const locText = sp.get('loc') ?? '';

  const latRaw = sp.get('lat');
  const lngRaw = sp.get('lng');

  const lat = latRaw ? Number(latRaw) : NaN;
  const lng = lngRaw ? Number(lngRaw) : NaN;

  const hasRealCenter =
    latRaw !== null &&
    lngRaw !== null &&
    latRaw !== '' &&
    lngRaw !== '' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0);

  const radiusRaw = Number(sp.get('radius') ?? '5');
  const radiusKm = KM_OPTIONS.includes(radiusRaw as any)
    ? (radiusRaw as (typeof KM_OPTIONS)[number])
    : 5;

  const przeznRaw = sp.get('przezn') ?? '';
  const przezn = przeznRaw
    .split(',')
    .filter(Boolean)
    .filter((x): x is Przeznaczenie => PRZEZN.some((p) => p.key === x));

  const pageRaw = Number(sp.get('page') ?? '1');

  return {
    filters: {
      locText,
      radiusKm,
      center: hasRealCenter ? { lat, lng } : null,
      priceMin: digitsOnly(sp.get('priceMin') ?? ''),
      priceMax: digitsOnly(sp.get('priceMax') ?? ''),
      areaMin: digitsOnly(sp.get('areaMin') ?? ''),
      areaMax: digitsOnly(sp.get('areaMax') ?? ''),
      przezn,
    },
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1,
  };
}

async function fetchDzialki(params: URLSearchParams) {
  const res = await fetch(`/api/dzialki?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/dzialki -> ${res.status}`);

  const data = await res.json();
  return (data?.items ?? []) as ApiDzialka[];
}

function makeBaseParams(filters: AppliedFilters) {
  const sp = new URLSearchParams();

  if (filters.priceMin) sp.set('priceMin', filters.priceMin);
  if (filters.priceMax) sp.set('priceMax', filters.priceMax);
  if (filters.areaMin) sp.set('areaMin', filters.areaMin);
  if (filters.areaMax) sp.set('areaMax', filters.areaMax);
  if (filters.przezn.length) sp.set('przeznaczenia', filters.przezn.join(','));

  sp.set('skip', '0');
  sp.set('sort', 'newest');

  return sp;
}

function mergeById(lists: ApiDzialka[][]) {
  const map = new Map<string, ApiDzialka>();

  for (const list of lists) {
    for (const item of list) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
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
    onGo(Math.max(1, Math.min(totalPages, n)));
  };

  const mobilePages = useMemo(() => buildMobilePages(page, totalPages), [page, totalPages]);

  return (
    <div className={className || ''}>
      <div className="md:hidden">
        <div className="flex w-full max-w-full items-center justify-center gap-2 overflow-hidden px-1">
          <button
            type="button"
            onClick={onPrev}
            disabled={page <= 1}
            aria-label="Poprzednia strona"
            className={[
              'shrink-0 px-2 text-[18px] leading-none transition',
              page <= 1 ? 'text-white/25' : 'text-white/75 hover:text-white',
            ].join(' ')}
          >
            ‹
          </button>

          <div className="flex min-w-0 items-center justify-center gap-1.5">
            {mobilePages.map((x, idx) => {
              if (x === '…') {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="shrink-0 px-0.5 text-[12px] tracking-[0.08em] text-white/35"
                  >
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
                    'shrink-0 min-w-[24px] px-1 text-center text-[12px] tracking-[0.08em] transition',
                    active ? 'text-white' : 'text-white/60 hover:text-white',
                  ].join(' ')}
                  style={{
                    textDecoration: active ? 'underline' : 'none',
                    textUnderlineOffset: '8px',
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
            aria-label="Następna strona"
            className={[
              'shrink-0 px-2 text-[18px] leading-none transition',
              page >= totalPages ? 'text-white/25' : 'text-white/75 hover:text-white',
            ].join(' ')}
          >
            ›
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
  const initial = useMemo(() => readStateFromUrl(), []);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [allItems, setAllItems] = useState<ApiDzialka[]>([]);
  const [count, setCount] = useState(0);

  const [page, setPage] = useState(initial.page);

  const [locText, setLocText] = useState(initial.filters.locText);
  const [radiusKm, setRadiusKm] = useState<(typeof KM_OPTIONS)[number]>(initial.filters.radiusKm);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(initial.filters.center);

  const [priceMin, setPriceMin] = useState(formatPLThousands(initial.filters.priceMin));
  const [priceMax, setPriceMax] = useState(formatPLThousands(initial.filters.priceMax));
  const [areaMin, setAreaMin] = useState(formatPLThousands(initial.filters.areaMin));
  const [areaMax, setAreaMax] = useState(formatPLThousands(initial.filters.areaMax));

  const [przezn, setPrzezn] = useState<Przeznaczenie[]>(initial.filters.przezn);
  const [applied, setApplied] = useState<AppliedFilters>(initial.filters);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchTopRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollRef = useRef(false);

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

  function updateBrowserUrl(filters: AppliedFilters, nextPage: number, replace = false) {
    const url = buildUrlFromState(filters, nextPage);

    try {
      if (replace) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);

      saveState(filters, nextPage);
    } catch {}
  }

  function scrollToSearchTop() {
    const el = searchTopRef.current;
    if (!el) return;

    const top = window.scrollY + el.getBoundingClientRect().top - SCROLL_OFFSET;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth',
    });
  }

  function changePage(nextPage: number) {
    const totalPagesNow = Math.max(1, Math.ceil(count / PAGE_SIZE));
    const clamped = Math.max(1, Math.min(totalPagesNow, nextPage));

    if (clamped === page) return;

    setPage(clamped);
    updateBrowserUrl(applied, clamped);

    requestAnimationFrame(() => {
      scrollToSearchTop();

      try {
        sessionStorage.setItem(
          'TD_KUP_SCROLL_Y',
          String(
            Math.max(
              0,
              window.scrollY +
                (searchTopRef.current?.getBoundingClientRect().top ?? 0) -
                SCROLL_OFFSET
            )
          )
        );
        sessionStorage.setItem('TD_KUP_URL', buildUrlFromState(applied, clamped));
      } catch {}
    });
  }

  function togglePrzezn(k: Przeznaczenie) {
    setPrzezn((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function fetchDataWith(nextApplied: AppliedFilters, nextPage = 1, replaceUrl = false) {
    setLoading(true);
    setErr(null);

    try {
      updateBrowserUrl(nextApplied, nextPage, replaceUrl);

      const useRadiusSearch = !!nextApplied.center && nextApplied.radiusKm > 0;
      const cleanedTextQuery = cleanSearchQuery(nextApplied.locText);

      const baseParams = makeBaseParams(nextApplied);

      const broadParams = new URLSearchParams(baseParams);
      broadParams.set('take', useRadiusSearch ? '1000' : '300');

      if (!useRadiusSearch && cleanedTextQuery) {
        broadParams.set('q', cleanedTextQuery);
      }

      const fetches: Promise<ApiDzialka[]>[] = [fetchDzialki(broadParams)];

      if (useRadiusSearch && cleanedTextQuery) {
        const textParams = new URLSearchParams(baseParams);
        textParams.set('q', cleanedTextQuery);
        textParams.set('take', '300');
        fetches.push(fetchDzialki(textParams));
      }

      const lists = await Promise.all(fetches);
      const list = mergeById(lists);

      let filtered = list;
      const rankMap = new Map<string, number>();

      if (useRadiusSearch) {
        filtered = list.filter((d) => {
          const hasCoords = typeof d.lat === 'number' && typeof d.lng === 'number';

          const inRadius = hasCoords
            ? haversineKm(nextApplied.center!.lat, nextApplied.center!.lng, d.lat!, d.lng!) <=
              nextApplied.radiusKm
            : false;

          const textMatch = cleanedTextQuery ? matchesTextSearch(d, cleanedTextQuery) : false;

          if (inRadius) {
            rankMap.set(d.id, 1);
            return true;
          }

          if (textMatch) {
            rankMap.set(d.id, 2);
            return true;
          }

          return false;
        });
      } else if (cleanedTextQuery) {
        filtered = list.filter((d) => {
          const textMatch = matchesTextSearch(d, cleanedTextQuery);
          if (textMatch) rankMap.set(d.id, 1);
          return textMatch;
        });
      }

      const sorted = sortPublicItems(filtered, rankMap);

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const safeNextPage = Math.max(1, Math.min(totalPages, nextPage));

      setAllItems(sorted);
      setCount(total);
      setPage(safeNextPage);

      saveState(nextApplied, safeNextPage);

      if (safeNextPage !== nextPage) {
        updateBrowserUrl(nextApplied, safeNextPage, true);
      }
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
    fetchDataWith(initial.filters, initial.page, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    if (restoredScrollRef.current) return;

    try {
      const restoreY = sessionStorage.getItem('TD_KUP_RESTORE_Y');
      if (!restoreY) return;

      restoredScrollRef.current = true;
      sessionStorage.removeItem('TD_KUP_RESTORE_Y');

      const y = Number(restoreY);
      if (!Number.isFinite(y)) return;

      setTimeout(() => {
        window.scrollTo({
          top: Math.max(0, y),
          left: 0,
          behavior: 'instant' as ScrollBehavior,
        });
      }, 80);
    } catch {}
  }, [loading, page, allItems.length]);

  function applyAndSearch() {
    const next: AppliedFilters = {
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
    fetchDataWith(next, 1);
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

    const next = { ...EMPTY_APPLIED };

    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('TD_KUP_URL');
      sessionStorage.removeItem('TD_KUP_SCROLL_Y');
      sessionStorage.removeItem('TD_KUP_RESTORE_Y');
    } catch {}

    setApplied(next);
    fetchDataWith(next, 1);
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.max(1, Math.min(totalPages, page));

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return allItems.slice(start, start + PAGE_SIZE);
  }, [allItems, safePage]);

  const goPrev = () => changePage(safePage - 1);
  const goNext = () => changePage(safePage + 1);
  const goTo = (p: number) => changePage(p);

  return (
    <div className="w-full overflow-x-hidden">
      <section ref={searchTopRef} className="relative w-full">
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