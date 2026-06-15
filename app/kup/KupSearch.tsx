'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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

type ApiResponse = {
  ok: boolean;
  total?: number;
  count?: number;
  items?: ApiDzialka[];
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

export type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'area_asc' | 'area_desc';

type AppliedFilters = {
  locText: string;
  radiusKm: (typeof KM_OPTIONS)[number];
  center: { lat: number; lng: number } | null;
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
  przezn: Przeznaczenie[];
  sort: SortOption;
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
  sort: 'newest',
};

const VALID_SORTS: SortOption[] = ['newest', 'oldest', 'price_asc', 'price_desc', 'area_asc', 'area_desc'];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Najnowsze' },
  { value: 'oldest', label: 'Najstarsze' },
  { value: 'area_asc', label: 'Pow. rosnąco' },
  { value: 'area_desc', label: 'Pow. malejąco' },
];

function loadPlaces(apiKey: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.maps?.places) return resolve();

    const id = 'google-places-js';
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      // Script tag exists but Maps not ready yet (Next.js client-side nav keeps DOM alive).
      // Attach to the existing script's load/error events instead of resolving immediately.
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Places load failed')), { once: true });
      return;
    }

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

async function geocodeTypedLocation(
  text: string
): Promise<{ lat: number; lng: number } | null> {
  const q = text.trim();
  if (!q) return null;

  // Primary: client-side Geocoder — requests come from the browser on tylkodzialki.pl,
  // so they pass HTTP Referrer restrictions on the API key.
  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    const clientResult = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
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
    if (clientResult) return clientResult;
  }

  // Fallback: server-side — used when Maps JS API is not yet loaded on page mount
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

  const withoutPostalCode = value
    .replace(/\b\d{2}-\d{3}\b/g, ' ')
    .replace(/\b\d{5}\b/g, ' ');

  return normalizeText(withoutPostalCode)
    .split(' ')
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .filter((x) => !ignored.has(x))
    .filter((x) => !/^\d+$/.test(x))
    .join(' ');
}

function buildMobilePages(page: number, total: number): Array<number | '…'> {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, '…', total];
  if (page >= total - 2) return [1, '…', total - 3, total - 2, total - 1, total];
  return [1, '…', page - 1, page, page + 1, '…', total];
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
  if (filters.sort && filters.sort !== 'newest') sp.set('sort', filters.sort);
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

    if (!VALID_SORTS.includes(parsed.filters.sort)) {
      parsed.filters.sort = 'newest';
    }

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
  const radiusKm = KM_OPTIONS.includes(radiusRaw as unknown as (typeof KM_OPTIONS)[number])
    ? (radiusRaw as (typeof KM_OPTIONS)[number])
    : 5;

  const przeznRaw = sp.get('przezn') ?? '';
  const przezn = przeznRaw
    .split(',')
    .filter(Boolean)
    .filter((x): x is Przeznaczenie => PRZEZN.some((p) => p.key === x));

  const pageRaw = Number(sp.get('page') ?? '1');

  const sortRaw = sp.get('sort') ?? 'newest';
  const sort: SortOption = VALID_SORTS.includes(sortRaw as SortOption) ? (sortRaw as SortOption) : 'newest';

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
      sort,
    },
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1,
  };
}

async function fetchDzialki(params: URLSearchParams): Promise<ApiResponse> {
  const res = await fetch(`/api/dzialki?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/dzialki -> ${res.status}`);

  return (await res.json()) as ApiResponse;
}

function makeParams(filters: AppliedFilters, page: number) {
  const sp = new URLSearchParams();

  const cleanedTextQuery = cleanSearchQuery(filters.locText);
  const rawTextQuery = filters.locText.trim();

  if (cleanedTextQuery) sp.set('q', cleanedTextQuery);
  if (rawTextQuery) sp.set('qRaw', rawTextQuery);

  if (filters.center) {
    sp.set('lat', String(filters.center.lat));
    sp.set('lng', String(filters.center.lng));
    sp.set('radius', String(filters.radiusKm));
  }

  if (filters.priceMin) sp.set('priceMin', filters.priceMin);
  if (filters.priceMax) sp.set('priceMax', filters.priceMax);
  if (filters.areaMin) sp.set('areaMin', filters.areaMin);
  if (filters.areaMax) sp.set('areaMax', filters.areaMax);
  if (filters.przezn.length) sp.set('przeznaczenia', filters.przezn.join(','));

  sp.set('skip', String((page - 1) * PAGE_SIZE));
  sp.set('take', String(PAGE_SIZE));
  sp.set('sort', filters.sort);

  return sp;
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
        <div className="flex w-full max-w-full items-center justify-center gap-1 overflow-hidden px-0">
          <button
            type="button"
            onClick={onPrev}
            disabled={page <= 1}
            aria-label="Poprzednia strona"
            className={[
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[30px] leading-none transition',
              page <= 1 ? 'text-white/25' : 'text-white/80 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            ‹
          </button>

          <div className="flex min-w-0 items-center justify-center gap-1">
            {mobilePages.map((x, idx) => {
              if (x === '…') {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="shrink-0 px-0.5 text-[13px] tracking-[0.04em] text-white/35"
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
                    'shrink-0 min-w-[25px] px-1 text-center text-[13px] tracking-[0.04em] transition',
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
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[30px] leading-none transition',
              page >= totalPages ? 'text-white/25' : 'text-white/80 hover:bg-white/10 hover:text-white',
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

export default function KupSearch({
  initialFilters,
  initialPage = 1,
  seoMode = false,
  navigationMode = false,
}: {
  initialFilters?: Partial<AppliedFilters>;
  initialPage?: number;
  seoMode?: boolean;
  navigationMode?: boolean;
}) {
  const initial = useMemo(() => {
    const fromUrl = readStateFromUrl();

    if (!initialFilters) return fromUrl;

    return {
      page: initialPage,
      filters: {
        ...EMPTY_APPLIED,
        ...initialFilters,
        center: initialFilters.center ?? null,
        przezn: initialFilters.przezn ?? [],
      },
    };
  }, [initialFilters, initialPage]);

  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<ApiDzialka[]>([]);
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
  const [expanded, setExpanded] = useState(
    initial.filters.przezn.length > 0 ||
      !!initial.filters.priceMin ||
      !!initial.filters.priceMax ||
      !!initial.filters.areaMin ||
      !!initial.filters.areaMax
  );
  const [locError, setLocError] = useState<string | null>(null);

  const [sortOpen, setSortOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchTopRef = useRef<HTMLDivElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollRef = useRef(false);

  useEffect(() => {
    if (!sortOpen) return;
    function onOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [sortOpen]);

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

  async function fetchDataWith(nextApplied: AppliedFilters, nextPage = 1, replaceUrl = false) {
    setLoading(true);
    setErr(null);

    try {
      updateBrowserUrl(nextApplied, nextPage, replaceUrl);

      const params = makeParams(nextApplied, nextPage);
      const data = await fetchDzialki(params);

      const nextItems = data.items ?? [];
      const total = Number(data.total ?? data.count ?? nextItems.length);

      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const safeNextPage = Math.max(1, Math.min(totalPages, nextPage));

      if (safeNextPage !== nextPage) {
        const safeParams = makeParams(nextApplied, safeNextPage);
        const safeData = await fetchDzialki(safeParams);

        setItems(safeData.items ?? []);
        setCount(Number(safeData.total ?? safeData.count ?? 0));
        setPage(safeNextPage);
        saveState(nextApplied, safeNextPage);
        updateBrowserUrl(nextApplied, safeNextPage, true);
        return;
      }

      setItems(nextItems);
      setCount(total);
      setPage(safeNextPage);
      saveState(nextApplied, safeNextPage);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Błąd pobierania');
      setItems([]);
      setCount(0);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }

  function changePage(nextPage: number) {
    const totalPagesNow = Math.max(1, Math.ceil(count / PAGE_SIZE));
    const clamped = Math.max(1, Math.min(totalPagesNow, nextPage));

    if (clamped === page) return;

    fetchDataWith(applied, clamped);

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

  useEffect(() => {
    let cancelled = false;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    async function initMapsAndSearch() {
      // Case B: locText in URL but no coords — needs geocoding before first search
      const needsGeocode =
        !navigationMode &&
        initial.filters.locText.trim() !== '' &&
        initial.filters.center === null;

      // Cases A (coords in URL) and C (no location): search immediately, no Maps needed yet
      if (!navigationMode && !needsGeocode && !cancelled) {
        fetchDataWith(initial.filters, initial.page, true);
      }

      // Load Maps — needed for autocomplete (all modes) and Case B geocoding
      if (key) {
        await loadPlaces(key).catch(() => {});
      }

      // Autocomplete widget — attach after Maps loads, works in both navigationMode and /kup
      if (!cancelled && inputRef.current && window.google?.maps?.places) {
        const widget = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'pl' },
          types: ['geocode'],
          fields: ['formatted_address', 'geometry', 'name'],
        });

        widget.addListener('place_changed', () => {
          const place = widget.getPlace();
          // Some API versions return empty formatted_address — fall back to DOM input value
          const inputVal = inputRef.current?.value?.trim() ?? '';
          const label = place.formatted_address || place.name || inputVal;

          if (label) setLocText(label);

          if (place.geometry?.location) {
            setCenter({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          } else if (label) {
            // Fallback: API returned no geometry, geocode the selected text
            geocodeTypedLocation(label).then((coords) => {
              if (coords && !cancelled) setCenter(coords);
            });
          }
        });
      }

      // Case B: geocode text from URL, then search
      if (needsGeocode && !cancelled) {
        const geocoded = await geocodeTypedLocation(initial.filters.locText);

        if (!cancelled) {
          const geoFilters = geocoded
            ? { ...initial.filters, center: geocoded }
            : initial.filters;

          if (geocoded) {
            setCenter(geocoded);
            setApplied(geoFilters);
          }

          fetchDataWith(geoFilters, initial.page, true);
        }
      }
    }

    initMapsAndSearch();

    return () => {
      cancelled = true;
    };

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
  }, [loading, page, items.length]);

  async function applyAndSearch() {
    // Fallback: browser autocomplete may fill the DOM input without triggering React onChange
    const effectiveLocText = locText.trim() || (inputRef.current?.value?.trim() ?? '');

    let nextCenter = center;

    if (effectiveLocText) {
      if (!nextCenter) {
        nextCenter = await geocodeTypedLocation(effectiveLocText);
        if (nextCenter) setCenter(nextCenter);
      }

      // Homepage: require valid coordinates — if geocoding failed, block navigation
      if (navigationMode && !nextCenter) {
        setLocError('Wybierz lokalizację z podpowiedzi albo wpisz poprawną miejscowość.');
        return;
      }
    }

    setLocError(null);

    const next: AppliedFilters = {
      locText: effectiveLocText,
      radiusKm,
      center: nextCenter,
      priceMin: digitsOnly(priceMin),
      priceMax: digitsOnly(priceMax),
      areaMin: digitsOnly(areaMin),
      areaMax: digitsOnly(areaMax),
      przezn,
      sort: applied.sort,
    };

    if (navigationMode) {
      saveState(next, 1);
      router.push(buildUrlFromState(next, 1));
    } else {
      setApplied(next);
      fetchDataWith(next, 1);
    }
  }

  function reset() {
    setLocText('');
    setCenter(null);
    setLocError(null);
    setRadiusKm(5);
    setPriceMin('');
    setPriceMax('');
    setAreaMin('');
    setAreaMax('');
    setPrzezn([]);

    if (navigationMode) {
      return;
    }

    const next: AppliedFilters = seoMode
      ? {
          ...EMPTY_APPLIED,
          ...initialFilters,
          center: initialFilters?.center ?? null,
          przezn: initialFilters?.przezn ?? [],
        }
      : { ...EMPTY_APPLIED };

    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('TD_KUP_URL');
      sessionStorage.removeItem('TD_KUP_SCROLL_Y');
      sessionStorage.removeItem('TD_KUP_RESTORE_Y');
    } catch {}

    setApplied(next);
    fetchDataWith(next, 1);
  }

  function changeSort(newSort: SortOption) {
    if (newSort === applied.sort) return;
    const next: AppliedFilters = { ...applied, sort: newSort };
    setApplied(next);
    fetchDataWith(next, 1);
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.max(1, Math.min(totalPages, page));

  const goPrev = () => changePage(safePage - 1);
  const goNext = () => changePage(safePage + 1);
  const goTo = (p: number) => changePage(p);

  const filterContent = (
    <div className="text-left">
      {/* Row 1: Lokalizacja + Zasięg — always visible */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_200px]">
        <div>
          <label className="block text-[12px] uppercase tracking-[0.26em] text-white/85">
            Lokalizacja
          </label>
          <div className={`mt-3 rounded-xl border bg-transparent ${locError ? 'border-red-400/70' : 'border-white/25'}`}>
            <input
              ref={inputRef}
              value={locText}
              onChange={(e) => {
                setLocText(e.target.value);
                setCenter(null);
                if (locError) setLocError(null);
              }}
              placeholder="Wpisz lokalizację"
              className="w-full bg-transparent px-4 py-3 text-white/90 outline-none placeholder:text-white/35"
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyAndSearch();
              }}
            />
          </div>
          {locError && (
            <p className="mt-2 text-[11px] tracking-[0.10em] text-red-400/80">{locError}</p>
          )}
        </div>

        <div>
          <label className="block text-[12px] uppercase tracking-[0.26em] text-white/85">
            Zasięg
          </label>
          <div className="mt-3 rounded-xl border border-white/25">
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value) as (typeof KM_OPTIONS)[number])}
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

      {/* Row 2: Toggle only */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/50 transition hover:text-white/80"
        >
          <span className="text-[8px]">{expanded ? '▲' : '▼'}</span>
          {expanded ? 'Mniej filtrów' : 'Więcej filtrów'}
        </button>
      </div>

      {/* Expanded: Powierzchnia + Cena + Przeznaczenie */}
      {expanded && (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        </div>
      )}

      {/* Action buttons — always at the bottom */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {/* Results count (only on /kup) */}
        {!navigationMode ? (
          <div className="text-[12px] uppercase tracking-[0.18em] text-white/55">
            {loading && items.length === 0 ? 'Ładowanie ofert...' : `Wyniki: ${count}`}
          </div>
        ) : (
          <div />
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-white/20 px-4 py-3 text-[12px] uppercase tracking-[0.22em] text-white/75 transition hover:border-white/40"
          >
            Wyczyść
          </button>
          <button
            type="button"
            onClick={applyAndSearch}
            className="rounded-xl bg-white px-6 py-3 text-[12px] font-medium uppercase tracking-[0.22em] text-black transition hover:bg-white/90 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Szukam…' : 'Szukaj'}
          </button>
        </div>
      </div>
    </div>
  );

  if (navigationMode) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0b0b0b]/78 p-5 backdrop-blur-sm md:p-8">
        {filterContent}
      </div>
    );
  }

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
            {filterContent}
          </div>

          <div className="h-6 md:h-10" />
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-6xl px-3 md:px-4">
        <div ref={sortRef} className="relative mb-5 inline-flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.22em] text-white/35">Sortuj:</span>
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-white/80 transition hover:border-white/40"
          >
            {SORT_OPTIONS.find((o) => o.value === applied.sort)?.label ?? 'Najnowsze'}
            <span className="text-[8px] text-white/40">{sortOpen ? '▲' : '▼'}</span>
          </button>
          {sortOpen && (
            <div className="absolute left-[5.5rem] top-full z-30 mt-1.5 min-w-[180px] rounded-xl border border-white/12 bg-[#181818] py-1.5 shadow-2xl">
              {SORT_OPTIONS.map((opt) => {
                const active = applied.sort === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      changeSort(opt.value);
                      setSortOpen(false);
                    }}
                    className={[
                      'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.18em] transition',
                      active ? 'text-white' : 'text-white/50 hover:text-white/85',
                    ].join(' ')}
                  >
                    <span className={active ? 'text-white/60 text-[7px]' : 'w-[0.7em]'}>
                      {active ? '●' : ''}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <PagerResponsive
          page={safePage}
          totalPages={totalPages}
          onPrev={goPrev}
          onNext={goNext}
          onGo={goTo}
          className="mb-6"
        />

        <KupList items={items} loading={loading} error={err} />

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