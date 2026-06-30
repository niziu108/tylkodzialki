'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import KupList from './KupList';
import AlertBar from '@/components/AlertBar';
import type { MapPoint } from '@/components/KupMap';
import { loadGoogleMaps } from '@/lib/googleMaps';

// Lazy-load: KupMap ciągnie @googlemaps/markerclusterer i całą logikę mapy. Mapa
// jest opt-in (otwiera się przyciskiem), więc nie ma jej w paczce startowej ani na
// stronie głównej (gdzie wyszukiwarka tylko przekierowuje), ani na /kup do czasu
// kliknięcia „Mapa". Mniej JS do pobrania => szybsza hydracja i niższe LCP/TTI.
const KupMap = dynamic(() => import('@/components/KupMap'), { ssr: false });
import type { AlertCriteria } from '@/lib/alertCriteria';
import type { Przeznaczenie, TransakcjaTyp } from '@prisma/client';

type BBox = { n: number; s: number; e: number; w: number };

type ApiPhoto = { id?: string; url: string; publicId?: string; kolejnosc?: number };

type ApiDzialka = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  transakcja?: TransakcjaTyp | null;
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

export type MediaKey = 'prad' | 'woda' | 'kanalizacja' | 'gaz';

const MEDIA: { key: MediaKey; label: string }[] = [
  { key: 'prad', label: 'Prąd' },
  { key: 'woda', label: 'Woda' },
  { key: 'kanalizacja', label: 'Kanalizacja' },
  { key: 'gaz', label: 'Gaz' },
];

const MEDIA_KEYS: MediaKey[] = MEDIA.map((m) => m.key);

export type TransakcjaKey = 'SPRZEDAZ' | 'WYNAJEM';

const TRANSAKCJA: { key: TransakcjaKey; label: string }[] = [
  { key: 'SPRZEDAZ', label: 'Sprzedaż' },
  { key: 'WYNAJEM', label: 'Wynajem' },
];

const TRANSAKCJA_KEYS: TransakcjaKey[] = TRANSAKCJA.map((t) => t.key);

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
  media: MediaKey[];
  transakcja: TransakcjaKey[];
  bbox: BBox | null;
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
  media: [],
  transakcja: [],
  bbox: null,
  sort: 'newest',
};

const VALID_SORTS: SortOption[] = ['newest', 'oldest', 'price_asc', 'price_desc', 'area_asc', 'area_desc'];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Najnowsze' },
  { value: 'oldest', label: 'Najstarsze' },
  { value: 'price_asc', label: 'Cena rosnąco' },
  { value: 'price_desc', label: 'Cena malejąco' },
  { value: 'area_asc', label: 'Pow. rosnąco' },
  { value: 'area_desc', label: 'Pow. malejąco' },
];

// Ładowanie Maps JS (z libraries=places) idzie przez jedną współdzieloną funkcję
// loadGoogleMaps() z @/lib/googleMaps — wspólny strażnik z mapą KupMap, żeby skrypt
// nie doklejał się drugi raz („multiple times on this page").

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

  if (filters.bbox) {
    // „Szukaj w tym obszarze" — prostokąt z mapy zastępuje lokalizację tekstową/promień.
    sp.set('n', filters.bbox.n.toFixed(5));
    sp.set('s', filters.bbox.s.toFixed(5));
    sp.set('e', filters.bbox.e.toFixed(5));
    sp.set('w', filters.bbox.w.toFixed(5));
  } else {
    if (filters.locText.trim()) sp.set('loc', filters.locText.trim());

    if (filters.center) {
      sp.set('lat', String(filters.center.lat));
      sp.set('lng', String(filters.center.lng));
    }

    if (filters.radiusKm !== 5) sp.set('radius', String(filters.radiusKm));
  }
  if (filters.priceMin) sp.set('priceMin', filters.priceMin);
  if (filters.priceMax) sp.set('priceMax', filters.priceMax);
  if (filters.areaMin) sp.set('areaMin', filters.areaMin);
  if (filters.areaMax) sp.set('areaMax', filters.areaMax);
  if (filters.przezn.length) sp.set('przezn', filters.przezn.join(','));
  if (filters.media.length) sp.set('media', filters.media.join(','));
  if (filters.transakcja.length) sp.set('transakcja', filters.transakcja.join(','));
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

    // Sesje sprzed P11 nie mają pola bbox.
    if (parsed.filters.bbox === undefined) parsed.filters.bbox = null;

    return parsed;
  } catch {
    return null;
  }
}

function readStateFromUrl(useStorageFallback = true): StoredState {
  if (typeof window === 'undefined') {
    return { filters: EMPTY_APPLIED, page: 1 };
  }

  const sp = new URLSearchParams(window.location.search);
  const hasQuery = Array.from(sp.keys()).length > 0;

  // Brak parametrów = wejście na „czyste" /kup. Na starcie przywracamy ostatnią
  // sesję ze sessionStorage, ale przy cofnięciu (popstate) chcemy dokładnie tego,
  // co jest w adresie — wtedy fallback jest wyłączony.
  if (!hasQuery && useStorageFallback) {
    const stored = loadStoredState();
    if (stored) return stored;
  }

  const nRaw = sp.get('n');
  const sRaw = sp.get('s');
  const eRaw = sp.get('e');
  const wRaw = sp.get('w');
  const bn = Number(nRaw);
  const bs = Number(sRaw);
  const be = Number(eRaw);
  const bw = Number(wRaw);
  const bbox: BBox | null =
    nRaw !== null &&
    sRaw !== null &&
    eRaw !== null &&
    wRaw !== null &&
    Number.isFinite(bn) &&
    Number.isFinite(bs) &&
    Number.isFinite(be) &&
    Number.isFinite(bw) &&
    bn > bs &&
    be > bw
      ? { n: bn, s: bs, e: be, w: bw }
      : null;

  const locText = bbox ? '' : sp.get('loc') ?? '';

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

  const mediaRaw = sp.get('media') ?? '';
  const media = mediaRaw
    .split(',')
    .filter(Boolean)
    .filter((x): x is MediaKey => MEDIA_KEYS.includes(x as MediaKey));

  const transakcjaRaw = sp.get('transakcja') ?? '';
  const transakcja = transakcjaRaw
    .split(',')
    .filter(Boolean)
    .filter((x): x is TransakcjaKey => TRANSAKCJA_KEYS.includes(x as TransakcjaKey));

  const pageRaw = Number(sp.get('page') ?? '1');

  const sortRaw = sp.get('sort') ?? 'newest';
  const sort: SortOption = VALID_SORTS.includes(sortRaw as SortOption) ? (sortRaw as SortOption) : 'newest';

  return {
    filters: {
      locText,
      radiusKm,
      center: bbox ? null : hasRealCenter ? { lat, lng } : null,
      priceMin: digitsOnly(sp.get('priceMin') ?? ''),
      priceMax: digitsOnly(sp.get('priceMax') ?? ''),
      areaMin: digitsOnly(sp.get('areaMin') ?? ''),
      areaMax: digitsOnly(sp.get('areaMax') ?? ''),
      przezn,
      media,
      transakcja,
      bbox,
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

  if (filters.bbox) {
    // Tryb „szukaj w tym obszarze" — prostokąt wyklucza wyszukiwanie tekstowe/promieniem.
    sp.set('n', String(filters.bbox.n));
    sp.set('s', String(filters.bbox.s));
    sp.set('e', String(filters.bbox.e));
    sp.set('w', String(filters.bbox.w));
  } else {
    const cleanedTextQuery = cleanSearchQuery(filters.locText);
    const rawTextQuery = filters.locText.trim();

    if (cleanedTextQuery) sp.set('q', cleanedTextQuery);
    if (rawTextQuery) sp.set('qRaw', rawTextQuery);

    if (filters.center) {
      sp.set('lat', String(filters.center.lat));
      sp.set('lng', String(filters.center.lng));
      sp.set('radius', String(filters.radiusKm));
    }
  }

  if (filters.priceMin) sp.set('priceMin', filters.priceMin);
  if (filters.priceMax) sp.set('priceMax', filters.priceMax);
  if (filters.areaMin) sp.set('areaMin', filters.areaMin);
  if (filters.areaMax) sp.set('areaMax', filters.areaMax);
  if (filters.przezn.length) sp.set('przeznaczenia', filters.przezn.join(','));
  if (filters.media.length) sp.set('media', filters.media.join(','));
  if (filters.transakcja.length) sp.set('transakcja', filters.transakcja.join(','));

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
              page <= 1 ? 'text-fg/25' : 'text-fg/80 hover:bg-fg/10 hover:text-fg',
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
                    className="shrink-0 px-0.5 text-[13px] tracking-[0.04em] text-fg/62"
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
                    active ? 'font-semibold text-brand' : 'text-fg/72 hover:text-fg',
                  ].join(' ')}
                  style={{
                    // tylko `color` w przejściu — animacja text-decoration-color
                    // zacina się w Chromium na wartości startowej (podkreślenie znika)
                    transitionProperty: 'color',
                    textDecoration: active ? 'underline' : 'none',
                    textUnderlineOffset: '8px',
                    textDecorationThickness: '2px',
                    textDecorationColor: active ? 'var(--brand)' : 'transparent',
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
              page >= totalPages ? 'text-fg/25' : 'text-fg/80 hover:bg-fg/10 hover:text-fg',
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
              page <= 1 ? 'text-fg/30' : 'text-fg/70 hover:text-fg',
            ].join(' ')}
            style={{
              transitionProperty: 'color',
              textDecoration: 'underline',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: page <= 1 ? 'var(--line)' : 'var(--line-strong)',
            }}
          >
            Poprzednia
          </button>

          <div className="text-fg/70 text-[12px] tracking-[0.22em] uppercase">
            <span className="font-semibold text-brand">{page}</span>/{totalPages}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={page >= totalPages}
            className={[
              'text-[12px] tracking-[0.22em] uppercase transition',
              page >= totalPages ? 'text-fg/30' : 'text-fg/70 hover:text-fg',
            ].join(' ')}
            style={{
              transitionProperty: 'color',
              textDecoration: 'underline',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: page >= totalPages ? 'var(--line)' : 'var(--line-strong)',
            }}
          >
            Następna
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-fg/62 text-[11px] tracking-[0.22em] uppercase">Idź do</div>

          <input
            value={val}
            onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            className="w-[72px] rounded-xl border border-fg/20 bg-transparent px-3 py-2 text-center text-[13px] text-fg/85 outline-none focus:border-fg/45 selection:bg-fg/20 selection:text-fg"
            placeholder="…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') go();
            }}
          />

          <button
            type="button"
            onClick={go}
            className="rounded-xl border border-fg/20 px-3 py-2 text-[11px] tracking-[0.22em] uppercase text-fg/75 transition hover:border-fg/40"
          >
            Idź
          </button>
        </div>
      </div>
    </div>
  );
}

function MapGlyph({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" />
      <path d="M9 3v16M15 5v16" />
    </svg>
  );
}

export default function KupSearch({
  initialFilters,
  initialPage = 1,
  initialFocusId = null,
  seoMode = false,
  navigationMode = false,
}: {
  initialFilters?: Partial<AppliedFilters>;
  initialPage?: number;
  initialFocusId?: string | null;
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
        media: initialFilters.media ?? [],
        transakcja: initialFilters.transakcja ?? [],
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
  const [media, setMedia] = useState<MediaKey[]>(initial.filters.media);
  const [transakcja, setTransakcja] = useState<TransakcjaKey[]>(initial.filters.transakcja);
  const [applied, setApplied] = useState<AppliedFilters>(initial.filters);
  const [expanded, setExpanded] = useState(
    initial.filters.przezn.length > 0 ||
      initial.filters.media.length > 0 ||
      initial.filters.transakcja.length > 0 ||
      !!initial.filters.priceMin ||
      !!initial.filters.priceMax ||
      !!initial.filters.areaMin ||
      !!initial.filters.areaMax
  );
  const [locError, setLocError] = useState<string | null>(null);

  const [sortOpen, setSortOpen] = useState(false);

  // Mapa (P11) — przycisk „Mapa" → pełnoekranowy overlay (desktop i mobile tak samo).
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(initialFocusId);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);

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

  // Ustawia pola wyszukiwarki na podstawie stanu z adresu URL — używane przy montażu
  // oraz po cofnij/dalej w przeglądarce, żeby filtry i pager zgadzały się z adresem.
  function applyStateToInputs(f: AppliedFilters) {
    setLocText(f.locText);
    setRadiusKm(f.radiusKm);
    setCenter(f.center);
    setPriceMin(formatPLThousands(f.priceMin));
    setPriceMax(formatPLThousands(f.priceMax));
    setAreaMin(formatPLThousands(f.areaMin));
    setAreaMax(formatPLThousands(f.areaMax));
    setPrzezn(f.przezn);
    setMedia(f.media);
    setTransakcja(f.transakcja);
    setApplied(f);
    setExpanded(
      f.przezn.length > 0 ||
        f.media.length > 0 ||
        f.transakcja.length > 0 ||
        !!f.priceMin ||
        !!f.priceMax ||
        !!f.areaMin ||
        !!f.areaMax
    );
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

  function toggleMedia(k: MediaKey) {
    setMedia((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  function toggleTransakcja(k: TransakcjaKey) {
    setTransakcja((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  useEffect(() => {
    let cancelled = false;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    async function initMapsAndSearch() {
      // Stan startowy bierzemy ze ŚWIEŻEGO adresu URL (po stronie klienta), a nie
      // z propsów serwera. Po cofnięciu z oferty Next przywraca zcache'owany render
      // strony (zwykle 1), ale w pasku adresu jest właściwy numer strony i filtry.
      const startState = navigationMode ? initial : readStateFromUrl();
      const startFilters = startState.filters;
      const startPage = startState.page;

      if (!navigationMode) {
        applyStateToInputs(startFilters);
      }

      // Case B: locText in URL but no coords — needs geocoding before first search
      const needsGeocode =
        !navigationMode &&
        startFilters.locText.trim() !== '' &&
        startFilters.center === null;

      // Cases A (coords in URL) and C (no location): search immediately, no Maps needed yet
      if (!navigationMode && !needsGeocode && !cancelled) {
        fetchDataWith(startFilters, startPage, true);
      }

      // Load Maps — needed for autocomplete (all modes) and Case B geocoding
      if (key) {
        await loadGoogleMaps().catch(() => {});
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
        const geocoded = await geocodeTypedLocation(startFilters.locText);

        if (!cancelled) {
          const geoFilters = geocoded
            ? { ...startFilters, center: geocoded }
            : startFilters;

          if (geocoded) {
            setCenter(geocoded);
            setApplied(geoFilters);
          }

          fetchDataWith(geoFilters, startPage, true);
        }
      }
    }

    initMapsAndSearch();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cofnij/Dalej w przeglądarce: zsynchronizuj wyszukiwarkę i wyniki z adresem URL.
  // Bez tego numer strony (i filtry) „gubią się" przy strzałkach przeglądarki —
  // np. cofnięcie ze strony 3 wracało zawsze na stronę 1.
  useEffect(() => {
    if (navigationMode) return;

    function onPopState() {
      const s = readStateFromUrl(false);
      applyStateToInputs(s.filters);

      const needsGeo =
        s.filters.locText.trim() !== '' && s.filters.center === null;

      if (needsGeo) {
        geocodeTypedLocation(s.filters.locText).then((c) => {
          const f = c ? { ...s.filters, center: c } : s.filters;
          if (c) setCenter(c);
          fetchDataWith(f, s.page, true);
        });
      } else {
        fetchDataWith(s.filters, s.page, true);
      }
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationMode]);

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

    // Jeśli użytkownik nie zmienił lokalizacji, a ma aktywny obszar z mapy — zachowaj obszar
    // (dopracowuje filtry w ramach „szukaj w tym obszarze"). Wpisanie lokalizacji kasuje obszar.
    const keepBBox = !effectiveLocText && applied.bbox ? applied.bbox : null;

    const next: AppliedFilters = {
      locText: effectiveLocText,
      radiusKm,
      center: keepBBox ? null : nextCenter,
      priceMin: digitsOnly(priceMin),
      priceMax: digitsOnly(priceMax),
      areaMin: digitsOnly(areaMin),
      areaMax: digitsOnly(areaMax),
      przezn,
      media,
      transakcja,
      bbox: keepBBox,
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
    setMedia([]);
    setTransakcja([]);

    if (navigationMode) {
      return;
    }

    const next: AppliedFilters = seoMode
      ? {
          ...EMPTY_APPLIED,
          ...initialFilters,
          center: initialFilters?.center ?? null,
          przezn: initialFilters?.przezn ?? [],
          transakcja: initialFilters?.transakcja ?? [],
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

  const alertCriteria: AlertCriteria = useMemo(
    () => ({
      query: applied.locText.trim() || null,
      lat: applied.center?.lat ?? null,
      lng: applied.center?.lng ?? null,
      radiusKm: applied.center ? applied.radiusKm : null,
      priceMin: applied.priceMin ? Number(applied.priceMin) : null,
      priceMax: applied.priceMax ? Number(applied.priceMax) : null,
      areaMin: applied.areaMin ? Number(applied.areaMin) : null,
      areaMax: applied.areaMax ? Number(applied.areaMax) : null,
      przeznaczenia: applied.przezn,
      transakcja: applied.transakcja,
    }),
    [applied]
  );

  const openMap = useCallback(() => {
    setMapMounted(true);
    setMapOpen(true);
  }, []);

  // Wejście z oferty (?focus=…) — od razu otwieramy pełnoekranową mapę ofert,
  // wyśrodkowaną na działce; jej pin jest podświetlony (activeId = initialFocusId).
  useEffect(() => {
    if (initialFocusId) {
      setMapMounted(true);
      setMapOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Klucz filtrów (bez sortowania/strony) — zmienia się tylko gdy zmieniają się wyniki na mapie.
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        q: applied.locText.trim(),
        c: applied.center,
        r: applied.center ? applied.radiusKm : null,
        pmin: applied.priceMin,
        pmax: applied.priceMax,
        amin: applied.areaMin,
        amax: applied.areaMax,
        pz: applied.przezn,
        md: applied.media,
        tr: applied.transakcja,
        bb: applied.bbox,
      }),
    [applied]
  );

  const mapEnabled = mapOpen;

  // Pobranie pinów — lekki payload, tylko gdy mapa jest widoczna, niezależnie od stronicowania.
  useEffect(() => {
    if (!mapEnabled) return;

    let cancelled = false;
    setMapLoading(true);

    const params = makeParams(applied, 1);
    params.set('mode', 'map');
    params.delete('skip');
    params.delete('take');
    params.delete('sort');

    fetch(`/api/dzialki?${params.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.points)) setMapPoints(d.points as MapPoint[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMapLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, mapEnabled]);

  const onSearchArea = useCallback(
    (b: BBox) => {
      const next: AppliedFilters = { ...applied, locText: '', center: null, bbox: b };
      setLocText('');
      setCenter(null);
      setApplied(next);
      fetchDataWith(next, 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applied]
  );

  const mapAsideClass = mapOpen ? 'fixed inset-0 z-[120] bg-[#e8eaed]' : 'hidden';

  const filterContent = (
    <div className="text-left">
      {/* Row 1: Lokalizacja + Zasięg — always visible */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_200px]">
        <div>
          <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
            Lokalizacja
          </label>
          <div className={`mt-3 rounded-xl border bg-transparent ${locError ? 'border-red-400/70' : 'border-fg/25'}`}>
            <input
              ref={inputRef}
              value={locText}
              onChange={(e) => {
                setLocText(e.target.value);
                setCenter(null);
                if (locError) setLocError(null);
              }}
              placeholder="Wpisz lokalizację"
              className="w-full bg-transparent px-4 py-3 text-fg/90 outline-none placeholder:text-fg/62"
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
          <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
            Zasięg
          </label>
          <div className="mt-3 rounded-xl border border-fg/25">
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value) as (typeof KM_OPTIONS)[number])}
              className="w-full bg-transparent px-4 py-3 text-fg/90 outline-none"
            >
              {KM_OPTIONS.map((km) => (
                <option key={km} value={km} className="bg-bg">
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
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-fg/85 transition hover:text-fg"
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
              <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
                Powierzchnia
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="relative rounded-xl border border-fg/25">
                  <input
                    value={areaMin}
                    onChange={makeAutoPLHandler(setAreaMin)}
                    inputMode="numeric"
                    placeholder="od"
                    className="w-full bg-transparent px-4 py-3 pr-16 text-fg/90 outline-none placeholder:text-fg/62"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-fg/72">
                    m²
                  </span>
                </div>
                <div className="relative rounded-xl border border-fg/25">
                  <input
                    value={areaMax}
                    onChange={makeAutoPLHandler(setAreaMax)}
                    inputMode="numeric"
                    placeholder="do"
                    className="w-full bg-transparent px-4 py-3 pr-16 text-fg/90 outline-none placeholder:text-fg/62"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-fg/72">
                    m²
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
                Cena
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="relative rounded-xl border border-fg/25">
                  <input
                    value={priceMin}
                    onChange={makeAutoPLHandler(setPriceMin)}
                    inputMode="numeric"
                    placeholder="od"
                    className="w-full bg-transparent px-4 py-3 pr-14 text-fg/90 outline-none placeholder:text-fg/62"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-fg/72">
                    zł
                  </span>
                </div>
                <div className="relative rounded-xl border border-fg/25">
                  <input
                    value={priceMax}
                    onChange={makeAutoPLHandler(setPriceMax)}
                    inputMode="numeric"
                    placeholder="do"
                    className="w-full bg-transparent px-4 py-3 pr-14 text-fg/90 outline-none placeholder:text-fg/62"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-fg/72">
                    zł
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
              Typ oferty
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {TRANSAKCJA.map((t) => {
                const active = transakcja.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggleTransakcja(t.key)}
                    className={[
                      'rounded-full border px-3 py-2 text-[12px] uppercase tracking-[0.14em] transition',
                      active
                        ? 'border-brand bg-brand/20 text-brand-bright'
                        : 'border-fg/25 text-fg/70 hover:border-fg/45',
                    ].join(' ')}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
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
                        ? 'border-brand bg-brand/20 text-brand-bright'
                        : 'border-fg/25 text-fg/70 hover:border-fg/45',
                    ].join(' ')}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
              Media
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {MEDIA.map((m) => {
                const active = media.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMedia(m.key)}
                    className={[
                      'rounded-full border px-3 py-2 text-[12px] uppercase tracking-[0.14em] transition',
                      active
                        ? 'border-brand bg-brand/20 text-brand-bright'
                        : 'border-fg/25 text-fg/70 hover:border-fg/45',
                    ].join(' ')}
                  >
                    {m.label}
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
          <div className="text-[12px] uppercase tracking-[0.18em] text-fg">
            {loading && items.length === 0 ? 'Ładowanie ofert...' : `Wyniki: ${count}`}
          </div>
        ) : (
          <div />
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-fg/20 px-4 py-3 text-[12px] uppercase tracking-[0.22em] text-fg/75 transition hover:border-fg/40"
          >
            Wyczyść
          </button>
          <button
            type="button"
            onClick={applyAndSearch}
            className="rounded-xl bg-brand px-6 py-3 text-[12px] font-medium uppercase tracking-[0.22em] text-ink transition hover:bg-brand-strong disabled:opacity-60"
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
      <div className="rounded-2xl border border-fg/10 bg-surface-2/78 p-5 backdrop-blur-sm md:p-8">
        {filterContent}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-hidden">
      <section ref={searchTopRef} className="relative w-full overflow-hidden">
        {/* To samo zdjęcie co na stronie głównej (hero-kup), przez next/image z priority. */}
        <Image
          src="/hero-kup.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          quality={82}
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-black/24 to-black/38" />

        <div className="relative mx-auto max-w-6xl px-3 py-10 md:px-4 md:py-14">
          <div className="rounded-2xl border border-fg/10 bg-surface-2/78 p-5 backdrop-blur-sm md:p-8">
            {filterContent}
          </div>

          <div className="h-6 md:h-10" />
        </div>
      </section>

      {/* Odstępy listy (czyste tło — bez siatki i poświaty, właściciel woli przejrzystość). */}
      <div className="pt-8 pb-20">
      <section className="mx-auto max-w-6xl px-3 md:px-4">
        <div ref={sortRef} className="relative mb-5 inline-flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.22em] text-fg/62">Sortuj:</span>
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-fg/25 px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-fg/80 transition hover:border-fg/40"
          >
            {SORT_OPTIONS.find((o) => o.value === applied.sort)?.label ?? 'Najnowsze'}
            <span className="text-[8px] text-fg/64">{sortOpen ? '▲' : '▼'}</span>
          </button>
          {sortOpen && (
            <div className="absolute left-[5.5rem] top-full z-30 mt-1.5 min-w-[180px] rounded-xl border border-fg/12 bg-surface py-1.5 shadow-2xl">
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
                      active ? 'text-fg' : 'text-fg/70 hover:text-fg/85',
                    ].join(' ')}
                  >
                    <span className={active ? 'text-fg/72 text-[7px]' : 'w-[0.7em]'}>
                      {active ? '●' : ''}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <AlertBar criteria={alertCriteria} />

        <PagerResponsive
          page={safePage}
          totalPages={totalPages}
          onPrev={goPrev}
          onNext={goNext}
          onGo={goTo}
          className="mb-6 mt-6"
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

        {/* Mapa: przycisk → pełnoekranowy overlay (desktop i mobile tak samo). */}
        {mapMounted && (
          <aside className={mapAsideClass}>
            <KupMap
              points={mapPoints}
              loading={mapLoading}
              center={applied.center}
              radiusKm={applied.radiusKm}
              focusKey={filterKey}
              activeId={activeId}
              selfId={initialFocusId}
              onActiveChange={setActiveId}
              onSearchArea={onSearchArea}
              onClose={() => {
                // Weszliśmy z konkretnej oferty → zamknięcie mapy wraca do tej oferty,
                // a nie zrzuca do wyszukiwarki. Cofamy w historii (zachowana pozycja
                // na stronie oferty); gdy historii brak (np. wejście z linku), idziemy wprost.
                if (initialFocusId) {
                  if (typeof window !== 'undefined' && window.history.length > 1) router.back();
                  else router.push(`/dzialka/${initialFocusId}`);
                } else {
                  setMapOpen(false);
                }
              }}
              closeLabel={initialFocusId ? 'Wróć do oferty' : undefined}
            />
          </aside>
        )}

        {!mapOpen && (
          <button
            type="button"
            onClick={openMap}
            className="fixed bottom-5 left-1/2 z-[110] flex -translate-x-1/2 items-center gap-2 rounded-full border border-brand/60 bg-bg/95 px-6 py-3 text-[13px] font-medium uppercase tracking-[0.16em] text-fg shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur transition hover:border-brand hover:bg-surface"
          >
            <MapGlyph />
            Mapa
          </button>
        )}
      </section>
      </div>
    </div>
  );
}