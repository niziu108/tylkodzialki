'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import KupList from './KupList';
import AlertBar from '@/components/AlertBar';
import RadiusSelect from '@/components/RadiusSelect';
import { loadGoogleMaps } from '@/lib/googleMaps';
import {
  DOJAZD_FILTR_KEYS,
  DOJAZD_FILTR_WIDOCZNY,
  DOJAZD_LABEL,
  type DojazdKey,
} from '@/lib/dojazd';
import { plural } from '@/lib/plural';
// Stałe promienia leżą poza tym plikiem, bo czyta je też komponent serwerowy app/kup/page.tsx
// (import z modułu 'use client' oddaje serwerowi referencję klienta, nie wartość).
import { KM_OPTIONS, DEFAULT_RADIUS_KM, parseRadiusKm, type RadiusKm } from '@/lib/searchRadius';

// Lazy-load: KupMap ciągnie całą logikę mapy. Mapa
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
const STORAGE_KEY = 'TD_KUP_STATE_V2';

export type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'area_asc' | 'area_desc';

type AppliedFilters = {
  locText: string;
  radiusKm: RadiusKm;
  center: { lat: number; lng: number } | null;
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
  przezn: Przeznaczenie[];
  media: MediaKey[];
  dojazd: DojazdKey[];
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
  radiusKm: DEFAULT_RADIUS_KM,
  center: null,
  priceMin: '',
  priceMax: '',
  areaMin: '',
  areaMax: '',
  przezn: [],
  media: [],
  dojazd: [],
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

// Odmiana „oferta" po polsku: 1 oferta · 2-4 oferty · 5+ ofert (z wyjątkami 12-14 → ofert,
// 22-24 → oferty itd. — reguła mod10/mod100).
function ofertaLabel(n: number): string {
  const abs = Math.abs(n);
  const m10 = abs % 10;
  const m100 = abs % 100;
  if (abs === 1) return 'oferta';
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return 'oferty';
  return 'ofert';
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

    if (filters.radiusKm !== DEFAULT_RADIUS_KM) sp.set('radius', String(filters.radiusKm));
  }
  if (filters.priceMin) sp.set('priceMin', filters.priceMin);
  if (filters.priceMax) sp.set('priceMax', filters.priceMax);
  if (filters.areaMin) sp.set('areaMin', filters.areaMin);
  if (filters.areaMax) sp.set('areaMax', filters.areaMax);
  if (filters.przezn.length) sp.set('przezn', filters.przezn.join(','));
  if (filters.media.length) sp.set('media', filters.media.join(','));
  if (filters.dojazd.length) sp.set('dojazd', filters.dojazd.join(','));
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

  const radiusKm = parseRadiusKm(sp.get('radius'));

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

  const dojazdRaw = sp.get('dojazd') ?? '';
  const dojazd = dojazdRaw
    .split(',')
    .filter(Boolean)
    .filter((x): x is DojazdKey => (DOJAZD_FILTR_KEYS as readonly string[]).includes(x));

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
      dojazd,
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

type PlaceHint = { label: string; lat: number; lng: number; count: number };

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
  if (filters.dojazd.length) sp.set('dojazd', filters.dojazd.join(','));
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
            className="w-[72px] rounded-xl border border-fg/20 bg-transparent px-3 py-2 text-center text-[13px] text-fg/85 outline-none focus:border-fg/45"
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

function MapPinGlyph({ className = 'h-4 w-4' }: { className?: string }) {
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
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export default function KupSearch({
  initialFilters,
  initialPage = 1,
  initialItems,
  initialCount,
  initialFocusId = null,
  initialOpenMap = false,
  seoMode = false,
  navigationMode = false,
}: {
  initialFilters?: Partial<AppliedFilters>;
  initialPage?: number;
  // Wyniki 1. strony policzone na serwerze (SSR z /kup). Gdy pasują do stanu z URL, klient
  // pomija startowy fetch — lista jest od razu w HTML-u, bez drugiego round-tripu do API.
  initialItems?: ApiDzialka[];
  initialCount?: number;
  initialFocusId?: string | null;
  // Wejście od razu na mapę (np. przycisk „Mapa" na stronie głównej → /kup?widok=mapa).
  initialOpenMap?: boolean;
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
        dojazd: initialFilters.dojazd ?? [],
        transakcja: initialFilters.transakcja ?? [],
      },
    };
  }, [initialFilters, initialPage]);

  const router = useRouter();

  // Na /kup (lista) startujemy w stanie ładowania => pierwszy render pokazuje od razu
  // szkielety (ta sama wysokość co 20 realnych kart), a nie malutki box „Brak wyników",
  // który po doczytaniu rozdmuchiwał się do pełnej listy i spychał stopkę (to był
  // CLS 0,469 na /kup). Na głównej (navigationMode) listy nie ma, a przycisk nie może
  // od startu mówić „Szukam…", więc tam false.
  // Gdy serwer podał wyniki (SSR), startujemy od nich — bez szkieletów i bez „ładowania".
  // Pierwszy render klienta = render serwera (te same items, loading=false) → brak niezgody
  // hydracji. Bez SSR działamy jak dotąd: na /kup start w loading (szkielety), na głównej nie.
  const hasSsrItems = initialItems != null;

  const [loading, setLoading] = useState(hasSsrItems ? false : !navigationMode);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<ApiDzialka[]>(initialItems ?? []);
  const [count, setCount] = useState(initialCount ?? 0);

  // Podpowiedź „w szerszym promieniu coś jest" — liczona dopiero, gdy wynik wyjdzie pusty.
  const [wider, setWider] = useState<{ radiusKm: RadiusKm; total: number } | null>(null);
  // „Czy chodziło o…" — nazwy miejscowości z naszej podaży, najbliższe literowo temu, co wpisał user.
  const [suggestions, setSuggestions] = useState<PlaceHint[]>([]);
  // Dopóki false, sprawdzanie trwa (albo zaraz ruszy) — bez tego przy pustym wyniku mignęłaby
  // na chwilę propozycja „Szukaj w całej Polsce", zanim policzymy szerszy promień.
  const [widerChecked, setWiderChecked] = useState(false);

  const [page, setPage] = useState(initial.page);

  const [locText, setLocText] = useState(initial.filters.locText);
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(initial.filters.radiusKm);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(initial.filters.center);

  const [priceMin, setPriceMin] = useState(formatPLThousands(initial.filters.priceMin));
  const [priceMax, setPriceMax] = useState(formatPLThousands(initial.filters.priceMax));
  const [areaMin, setAreaMin] = useState(formatPLThousands(initial.filters.areaMin));
  const [areaMax, setAreaMax] = useState(formatPLThousands(initial.filters.areaMax));

  const [przezn, setPrzezn] = useState<Przeznaczenie[]>(initial.filters.przezn);
  const [media, setMedia] = useState<MediaKey[]>(initial.filters.media);
  const [dojazd, setDojazd] = useState<DojazdKey[]>(initial.filters.dojazd);
  const [transakcja, setTransakcja] = useState<TransakcjaKey[]>(initial.filters.transakcja);
  const [applied, setApplied] = useState<AppliedFilters>(initial.filters);
  // Na stronach SEO (huby) trzymamy wyszukiwarkę zwiniętą do docelowej, małej wersji
  // (lokalizacja + zasięg). Typ/filtry są ustawione w środku, ale panel „więcej filtrów"
  // startuje zamknięty — kto chce doprecyzować, sam go rozwinie.
  const [expanded, setExpanded] = useState(
    !seoMode &&
      (initial.filters.przezn.length > 0 ||
        initial.filters.media.length > 0 ||
        initial.filters.dojazd.length > 0 ||
        initial.filters.transakcja.length > 0 ||
        !!initial.filters.priceMin ||
        !!initial.filters.priceMax ||
        !!initial.filters.areaMin ||
        !!initial.filters.areaMax)
  );
  const [locError, setLocError] = useState<string | null>(null);

  const [sortOpen, setSortOpen] = useState(false);

  // Na wejściu (zwłaszcza z Google na hub) wyszukiwarka jest ZWINIĘTA do paska (adres +
  // Mapa|Filtry), żeby oferty były widoczne od razu (jak Otodom/OLX). Tap rozwija kartę.
  // Tak samo na mobile i desktop (spójność).
  const [searchOpen, setSearchOpen] = useState(false);

  // Mapa (P11) — przycisk „Mapa" → pełnoekranowy overlay (desktop i mobile tak samo).
  // Dane pinów pobiera sobie sama KupMap, dla bieżącego kadru (P27) — tutaj podajemy
  // jej tylko filtry, bo tylko one decydują, CO ma pokazać.
  const [activeId, setActiveId] = useState<string | null>(initialFocusId);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchTopRef = useRef<HTMLDivElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollRef = useRef(false);
  // Ustawiane przy zmianie strony w pagerze — po wczytaniu nowych ofert dociągamy scroll
  // na samą górę (patrz efekt niżej). Smooth-scroll przy kliknięciu bywał przerywany
  // podmianą listy (scroll anchoring wrzucał widok w środek), więc korygujemy po fetchu.
  const pendingTopScrollRef = useRef(false);

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
    // Na stronach SEO (huby /dzialki/...) trzymamy ładny, kanoniczny adres huba i NIE
    // przepisujemy go na /kup?… — inaczej pasek adresu rozjeżdża się z okruszkami, a
    // sesja huba zaśmiecałaby stan przywracany na /kup.
    if (seoMode) return;

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
    setDojazd(f.dojazd);
    setTransakcja(f.transakcja);
    setApplied(f);
    setExpanded(
      !seoMode &&
        (f.przezn.length > 0 ||
          f.media.length > 0 ||
          f.dojazd.length > 0 ||
          f.transakcja.length > 0 ||
          !!f.priceMin ||
          !!f.priceMax ||
          !!f.areaMin ||
          !!f.areaMax)
    );
  }

  function scrollToSearchTop() {
    // Zmiana strony wraca na SAMĄ GÓRĘ strony (nad wyszukiwarkę), nie w środek listy.
    // Instant, nie smooth — smooth animował ~400ms i był przerywany podmianą ofert.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
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
        if (!seoMode) saveState(nextApplied, safeNextPage);
        updateBrowserUrl(nextApplied, safeNextPage, true);
        return;
      }

      setItems(nextItems);
      setCount(total);
      setPage(safeNextPage);
      if (!seoMode) saveState(nextApplied, safeNextPage);
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

    // Zaznacz, że po wczytaniu nowej strony scroll ma dociągnąć na górę (efekt niżej).
    pendingTopScrollRef.current = true;

    fetchDataWith(applied, clamped);

    // Natychmiast na górę (nowe oferty jeszcze się ładują) — snappy feedback.
    scrollToSearchTop();

    try {
      sessionStorage.setItem('TD_KUP_SCROLL_Y', '0');
      sessionStorage.setItem('TD_KUP_URL', buildUrlFromState(applied, clamped));
    } catch {}
  }

  function togglePrzezn(k: Przeznaczenie) {
    setPrzezn((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  function toggleDojazd(k: DojazdKey) {
    setDojazd((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  function toggleMedia(k: MediaKey) {
    setMedia((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  function toggleTransakcja(k: TransakcjaKey) {
    setTransakcja((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  // Autocomplete lokalizacji ładujemy LENIWIE — dopiero przy pierwszym kliknięciu w
  // pole. Wcześniej Google Maps JS leciało na starcie KAŻDEJ strony z wyszukiwarką
  // (też na głównej), konkurując o pasmo z obrazem hero i głównym JS => na zdławionym
  // mobile podbijało LCP. Geokodowanie po wpisaniu i tak ma serwerowy fallback
  // (/api/geocode), więc „Szukaj" działa nawet bez załadowanego Maps.
  const autocompleteRef = useRef(false);
  const ensureLocationAutocomplete = useCallback(async () => {
    if (autocompleteRef.current) return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    autocompleteRef.current = true;

    await loadGoogleMaps().catch(() => {});
    if (!inputRef.current || !window.google?.maps?.places) {
      autocompleteRef.current = false;
      return;
    }

    const widget = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'pl' },
      types: ['geocode'],
      fields: ['formatted_address', 'geometry', 'name'],
    });

    widget.addListener('place_changed', () => {
      const place = widget.getPlace();
      const inputVal = inputRef.current?.value?.trim() ?? '';
      const label = place.formatted_address || place.name || inputVal;

      if (label) setLocText(label);

      if (place.geometry?.location) {
        setCenter({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      } else if (label) {
        geocodeTypedLocation(label).then((coords) => {
          if (coords) setCenter(coords);
        });
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initMapsAndSearch() {
      // Stan startowy bierzemy ze ŚWIEŻEGO adresu URL (po stronie klienta), a nie
      // z propsów serwera. Po cofnięciu z oferty Next przywraca zcache'owany render
      // strony (zwykle 1), ale w pasku adresu jest właściwy numer strony i filtry.
      const startState = navigationMode || seoMode ? initial : readStateFromUrl();
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

      // Seed z SSR jest ważny, gdy odpowiada stanowi, którego klient użyje na starcie:
      // stan z ADRESU (hasQuery) zawsze zgadza się z tym, co policzył serwer; „czyste" /kup
      // bez zapisanej sesji też (serwer wyrenderował pustą listę). Gdy w sessionStorage jest
      // inny stan (powrót na /kup bez parametrów) — seed nie pasuje, dociągamy normalnie.
      const hasUrlQuery =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).toString() !== '';
      // Na hubach /dzialki/... seed z SSR jest zawsze prawidłowy: stan startowy bierzemy
      // z propsów (startState = initial), a nie z adresu czy sesji, więc zapisany stan
      // z /kup nie ma jak go nadpisać. Serwer liczy tę samą pierwszą stronę co klient
      // (skip 0, take 20, sort newest — patrz queryHubListing), więc startowy fetch był
      // czystym round-tripem po dane, które już są na ekranie.
      const seedValid =
        hasSsrItems &&
        !needsGeocode &&
        startPage === initialPage &&
        (seoMode || hasUrlQuery || !loadStoredState());

      // Cases A (coords in URL) and C (no location): search immediately, no Maps needed yet
      if (!navigationMode && !needsGeocode && !cancelled) {
        if (seedValid) {
          // Dane już są w stanie (z SSR) — pomijamy startowy fetch. Normalizujemy tylko adres
          // i zapisujemy sesję (to samo, co robi fetchDataWith z replace=true, bez round-tripu).
          updateBrowserUrl(startFilters, startPage, true);
        } else {
          fetchDataWith(startFilters, startPage, true);
        }
      }

      // Google Maps NIE jest już ładowane na starcie. Autocomplete podpina się
      // leniwie przy pierwszym focusie pola (ensureLocationAutocomplete), a poniższe
      // geokodowanie z URL korzysta z serwerowego fallbacku w geocodeTypedLocation.

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

  // Po zmianie strony w pagerze: gdy nowe oferty się wczytają (loading→false), dociągnij
  // scroll na samą górę. Instant, bo w trakcie ładowania przeglądarka (scroll anchoring)
  // potrafi wrzucić widok w środek listy — ta korekta to naprawia po fakcie.
  useEffect(() => {
    if (loading) return;
    if (!pendingTopScrollRef.current) return;
    pendingTopScrollRef.current = false;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [loading, page]);

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

  /* Zero wyników z konkretnego punktu to dziś ślepy zaułek: „Brak wyników" i koniec
     rozmowy. Zamiast tego pytamy bazę, czy w szerszym promieniu coś jest, i podajemy to
     jednym kliknięciem. Zapytanie leci TYLKO przy pustym wyniku (take=1, sama liczba),
     więc normalne przeglądanie nic za to nie płaci. */
  useEffect(() => {
    if (loading || err || count > 0 || !applied.center || applied.bbox) {
      setWider(null);
      setWiderChecked(true);
      return;
    }

    const bigger = KM_OPTIONS.filter((km) => km > applied.radiusKm);
    if (!bigger.length) {
      setWider(null);
      setWiderChecked(true);
      return;
    }

    let cancelled = false;
    setWider(null);
    setWiderChecked(false);

    (async () => {
      for (const km of bigger) {
        try {
          const params = makeParams({ ...applied, radiusKm: km }, 1);
          params.set('take', '1');

          const data = await fetchDzialki(params);
          if (cancelled) return;

          const total = Number(data.total ?? data.count ?? 0);
          if (total > 0) {
            setWider({ radiusKm: km, total });
            break;
          }
        } catch {
          if (cancelled) return;
        }
      }

      if (!cancelled) setWiderChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, err, count, applied]);

  /* Literówka w nazwie („Radmosko") daje dziś zero wyników i koniec — Google podpowiada tylko
     temu, kto KLIKNIE podpowiedź, a wpisany z palca tekst z przestawioną literą nie geokoduje
     się na nic. Przy pustej liście pytamy więc własną bazę o najbliższą nazwę, w której
     naprawdę mamy oferty. Zapytanie leci wyłącznie przy zerowym wyniku. */
  useEffect(() => {
    const query = applied.locText.trim();

    if (loading || err || count > 0 || !query) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/dzialki/podpowiedzi?q=${encodeURIComponent(query)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;

        const data = (await res.json()) as { items?: PlaceHint[] };
        if (!cancelled) setSuggestions(Array.isArray(data.items) ? data.items.slice(0, 3) : []);
      } catch {
        // Podpowiedź to dodatek — cisza zamiast błędu na liście.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, err, count, applied]);

  async function applyAndSearch(asMap = false) {
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
      dojazd,
      transakcja,
      bbox: keepBBox,
      sort: applied.sort,
    };

    if (navigationMode) {
      saveState(next, 1);
      const base = buildUrlFromState(next, 1);
      // „Mapa" ze strony głównej: te same filtry, ale /kup otwiera się od razu na mapie.
      router.push(asMap ? `${base}${base.includes('?') ? '&' : '?'}widok=mapa` : base);
    } else {
      setApplied(next);
      fetchDataWith(next, 1);
      // Na /kup „Mapa" po filtrowaniu: zastosuj filtry i od razu otwórz pełnoekranową mapę.
      if (asMap) {
        setMapMounted(true);
        setMapOpen(true);
      }
      // Mobile: po wyszukaniu zwiń pasek, żeby od razu było widać wyniki (desktop
      // i tak trzyma kartę otwartą przez `md:block`, więc stan tu nie szkodzi).
      setSearchOpen(false);
      // Wróć na górę strony — po zwinięciu karty user widzi skondensowany pasek
      // + pierwsze oferty, a nie środek listy w miejscu, gdzie był przycisk. Skok
      // (instant, jak przy nowych wynikach w Google/Amazon) po zwinięciu karty —
      // płynna animacja i tak rozbijałaby się o layout shift zwijanej karty.
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }), 80);
    }
  }

  /* Zmiana zasięgu jednym kliknięciem, wprost nad wynikami — bez wchodzenia w Filtry.
     Kupujący działkę myśli „a co jest kawałek dalej", więc promień musi być widoczny
     i przestawialny tam, gdzie patrzy na liczbę ofert. */
  function applyRadiusKm(km: RadiusKm) {
    if (km === applied.radiusKm || !applied.center || applied.bbox) return;

    setRadiusKm(km);
    const next: AppliedFilters = { ...applied, radiusKm: km };
    setApplied(next);
    fetchDataWith(next, 1);
  }

  /* Klik w „Czy chodziło o: Radomsko" — wchodzimy w tę miejscowość ze współrzędnymi jej
     własnej podaży, więc wynik nie zależy już od tego, czy Google rozpozna literówkę. */
  function applySuggestion(hint: PlaceHint) {
    setLocText(hint.label);
    setCenter({ lat: hint.lat, lng: hint.lng });
    setLocError(null);

    const next: AppliedFilters = {
      ...applied,
      locText: hint.label,
      center: { lat: hint.lat, lng: hint.lng },
      bbox: null,
    };

    setApplied(next);
    fetchDataWith(next, 1);
  }

  /* Ostatnia deska ratunku przy pustym wyniku: zdejmujemy samą lokalizację (obszar/punkt),
     a filtry ceny, powierzchni i przeznaczenia zostają — user ich nie ustawiał po to,
     żeby mu je skasować. */
  function searchWholeCountry() {
    setLocText('');
    setCenter(null);
    setLocError(null);

    const next: AppliedFilters = { ...applied, locText: '', center: null, bbox: null };
    setApplied(next);
    fetchDataWith(next, 1);
  }

  function reset() {
    setLocText('');
    setCenter(null);
    setLocError(null);
    setRadiusKm(DEFAULT_RADIUS_KM);
    setPriceMin('');
    setPriceMax('');
    setAreaMin('');
    setAreaMax('');
    setPrzezn([]);
    setMedia([]);
    setDojazd([]);
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
  // Albo wejście z przycisku „Mapa" (?widok=mapa) — mapa bez konkretnej oferty.
  useEffect(() => {
    if (initialFocusId || initialOpenMap) {
      setMapMounted(true);
      setMapOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Querystring filtrów dla mapy — bez stronicowania i sortu, bo mapa ich nie używa.
  // Zmiana tego stringa = nowe wyszukiwanie: mapa czyści zaznaczenie, dopasowuje kadr
  // i dociąga dane. Stabilny (nie zmienia się przy przewijaniu listy), więc mapa nie
  // przeładowuje się bez powodu.
  const mapQuery = useMemo(() => {
    const params = makeParams(applied, 1);
    params.delete('skip');
    params.delete('take');
    params.delete('sort');
    return params.toString();
  }, [applied]);

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
              onFocus={ensureLocationAutocomplete}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyAndSearch();
              }}
            />
          </div>
          {locError && (
            <p className="mt-2 text-[11px] tracking-[0.10em] text-red-400/80">{locError}</p>
          )}
        </div>

        {/* Zasięg zawsze w wierszu 1 (na mobile stackuje się pod Lokalizacją). Pasek już
            chowa wszystko na wejściu, więc gdy user ŚWIADOMIE rozwija kartę, Zasięg ma być
            od razu widoczny — a nie pod kolejnym tapnięciem „Więcej filtrów". */}
        <div>
          <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
            Zasięg
          </label>
          <RadiusSelect
            className="mt-3"
            value={radiusKm}
            options={KM_OPTIONS}
            onChange={(v) => setRadiusKm(v as RadiusKm)}
          />
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

          {DOJAZD_FILTR_WIDOCZNY ? (
          <div>
            <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
              Dojazd
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Filtr twardy: „brak informacji" nie jest opcją do zaznaczenia, więc oferta bez
                  potwierdzonej nawierzchni nigdy nie wpadnie do wyników. Obiecujemy tylko to,
                  co wiemy od sprzedającego albo z feedu biura. */}
              {DOJAZD_FILTR_KEYS.map((k) => {
                const active = dojazd.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleDojazd(k)}
                    className={[
                      'rounded-full border px-3 py-2 text-[12px] uppercase tracking-[0.14em] transition',
                      active
                        ? 'border-brand bg-brand/20 text-brand-bright'
                        : 'border-fg/25 text-fg/70 hover:border-fg/45',
                    ].join(' ')}
                  >
                    {DOJAZD_LABEL[k]}
                  </button>
                );
              })}
            </div>
          </div>
          ) : null}
        </div>
      )}

      {/* Action buttons — always at the bottom. Mapa jest w zwiniętym pasku (mobile i
          desktop), więc w rozwiniętej karcie jej nie ma — wtedy filtrujesz, a po „Szukaj"
          pasek z Mapą wraca. Liczba ofert żyje w wierszu sortowania. */}
      {/* Akcje. Mobile: „Wyczyść”+„Mapa” po połowie w jednym rzędzie, „Szukaj” pełną szerokością
          pod spodem (główne CTA, największy cel dotyku). Desktop (sm+): inner div = display:contents,
          więc trzy przyciski trafiają wprost do rzędu po prawej, auto-szerokość — jak wcześniej. */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex gap-3 sm:contents">
          <button
            type="button"
            onClick={reset}
            className="flex flex-1 items-center justify-center rounded-xl border border-fg/20 px-4 py-3 text-[12px] uppercase tracking-[0.22em] text-fg/75 transition hover:border-fg/40 sm:flex-none"
          >
            Wyczyść
          </button>
          <button
            type="button"
            onClick={() => void applyAndSearch(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-fg/25 px-5 py-3 text-[12px] font-medium uppercase tracking-[0.16em] text-fg/85 transition hover:border-fg/45 disabled:opacity-60 sm:flex-none"
            disabled={loading}
          >
            <MapGlyph className="h-4 w-4 text-brand" />
            Mapa
          </button>
        </div>
        <button
          type="button"
          onClick={() => void applyAndSearch()}
          className="w-full rounded-xl bg-brand px-6 py-3 text-[12px] font-medium uppercase tracking-[0.22em] text-ink transition hover:bg-brand-strong disabled:opacity-60 sm:w-auto"
          disabled={loading}
        >
          {loading ? 'Szukam…' : 'Szukaj'}
        </button>
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

  // Adres do zwiniętego paska na mobile (sam adres, bez zasięgu/liczby — te są niżej).
  const summaryLoc = applied.bbox
    ? 'Zaznaczony obszar'
    : applied.locText.trim() || 'Cała Polska';
  const countLabel = loading && items.length === 0 ? 'Ładowanie ofert…' : `${count} ${ofertaLabel(count)}`;

  const scopeLoc = applied.locText.trim();

  // Czy wynik zawężają filtry poza lokalizacją — przy pustej liście warto o tym powiedzieć.
  const hasNarrowingFilters =
    applied.przezn.length > 0 ||
    applied.media.length > 0 ||
    applied.transakcja.length > 0 ||
    !!applied.priceMin ||
    !!applied.priceMax ||
    !!applied.areaMin ||
    !!applied.areaMax;

  const emptyTitle = applied.bbox
    ? 'W zaznaczonym obszarze nie ma ofert.'
    : applied.center
      ? `Brak ofert w promieniu ${applied.radiusKm} km${scopeLoc ? ` (${scopeLoc})` : ''}.`
      : scopeLoc
        ? `Nic nie pasuje do: ${scopeLoc}.`
        : 'Nic nie pasuje do tych filtrów.';

  // Czy w ogóle jest dokąd poszerzać — po tym poznajemy, że sprawdzanie ma sens i trwa.
  const canWiden =
    !!applied.center && !applied.bbox && KM_OPTIONS.some((km) => km > applied.radiusKm);

  const linkClass =
    'border-b border-fg/40 pb-px text-fg transition hover:border-fg/70 disabled:opacity-50';

  return (
    <div className="w-full overflow-x-hidden">
      {/* bez overflow-hidden: rozwijana lista „Zasięg" wysuwa się poniżej karty i
          była nią ucinana. HeroGradientBg jest absolute inset-0, więc nie wycieka;
          poziomy scroll trzyma zewnętrzny wrapper (overflow-x-hidden). */}
      <section ref={searchTopRef} className="relative w-full">
        {/* Bez zielonej poświaty (HeroGradientBg) — to strona wyników, nie landing. Zieleń
            zostaje tylko w akcentach (pinezka, ikona mapy, powiadomienia); tło czyste jak
            lista ofert pod spodem. Hero z gradientem zostaje na głównej/sprawdź/blogu. */}
        <div
          className={`relative z-10 mx-auto max-w-6xl px-3 md:px-4 md:py-10 ${
            searchOpen ? 'py-8' : 'py-4'
          }`}
        >
          {/* Zwinięty pasek (mobile I desktop — spójnie): adres (tap rozwija kartę) + dwa
              przyciski Mapa|Filtry. Pływający przycisk mapy zniknął, mapa żyje tu. Na mobile
              przyciski pod adresem (pół na pół), na desktopie w jednym rzędzie po prawej.
              Znika gdy karta jest rozwinięta (searchOpen). */}
          <div className={searchOpen ? 'hidden' : 'block'}>
            <div className="md:flex md:items-center md:gap-2.5">
              <button
                type="button"
                onClick={() => {
                  // Tap w adres = „chcę zmienić lokalizację": rozwiń kartę i od razu ustaw
                  // kursor w polu lokalizacji z zaznaczonym tekstem. flushSync wymusza
                  // synchroniczne rozwinięcie (pole trafia do DOM natychmiast), żeby fokus
                  // złapał się w TYM SAMYM geście dotyku — inaczej iOS nie pokaże klawiatury.
                  flushSync(() => {
                    setSearchOpen(true);
                    setExpanded(false);
                  });
                  const el = inputRef.current;
                  if (el) {
                    el.focus();
                    el.select();
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-2xl border border-fg/22 bg-surface-2/78 px-4 py-3 text-left backdrop-blur-sm md:flex-1"
              >
                <MapPinGlyph className="h-[18px] w-[18px] shrink-0 text-brand" />
                <span className="truncate text-[15px] text-fg">{summaryLoc}</span>
              </button>
              <div className="mt-2.5 flex gap-2.5 md:mt-0 md:shrink-0">
                <button
                  type="button"
                  onClick={openMap}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-fg/25 bg-surface-2/78 py-3 text-[13px] font-medium uppercase tracking-[0.10em] text-fg/90 backdrop-blur-sm transition hover:border-fg/40 md:flex-none md:px-8"
                >
                  <MapGlyph className="h-4 w-4 text-brand" />
                  Mapa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // „Filtry" prowadzi wprost do wszystkich filtrów (bez kroku „Więcej
                    // filtrów"). Tap w adres otwiera samą lokalizację (expanded=false).
                    setSearchOpen(true);
                    setExpanded(true);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-fg/25 bg-surface-2/78 py-3 text-[13px] font-medium uppercase tracking-[0.10em] text-fg/90 backdrop-blur-sm transition hover:border-fg/40 md:flex-none md:px-8"
                >
                  Filtry
                  <span className="text-[10px] text-brand">▼</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pełna karta: chowana gdy zwinięte (mobile i desktop tak samo). */}
          <div
            className={`rounded-2xl border border-fg/10 bg-surface-2/78 p-5 backdrop-blur-sm md:p-8 ${
              searchOpen ? 'block' : 'hidden'
            }`}
          >
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-fg/60 transition hover:text-fg"
              >
                Zwiń
                <span className="text-[8px]">▲</span>
              </button>
            </div>
            {filterContent}
          </div>
        </div>
      </section>

      {/* Odstępy listy (czyste tło — bez siatki i poświaty, właściciel woli przejrzystość).
          Na mobile ciasny odstęp nad Sortuj — wcześniej przerwa wyszukiwarka→Sortuj była
          jak menu→wyszukiwarka; Sortuj ma siedzieć tuż pod paskiem. */}
      <div className="pt-2 pb-20 md:pt-8">
      <section className="mx-auto max-w-6xl px-3 md:px-4">
        {/* „Sortuj:" zdjęte — w to miejsce liczba ofert (po lewej), a sam wybór sortowania
            po prawej. Krócej i użyteczniej niż zbędna etykieta. */}
        <div ref={sortRef} className="relative mb-5 flex items-center justify-between gap-3">
          <span className="text-[15px] font-medium tracking-[0.01em] text-fg">{countLabel}</span>
          <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-fg/25 px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-fg/80 transition hover:border-fg/40"
          >
            {SORT_OPTIONS.find((o) => o.value === applied.sort)?.label ?? 'Najnowsze'}
            <span className="text-[8px] text-fg/64">{sortOpen ? '▲' : '▼'}</span>
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full z-30 mt-1.5 min-w-[180px] rounded-xl border border-fg/12 bg-surface py-1.5 shadow-2xl">
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

        {!loading && !err && items.length === 0 ? (
          /* Zamiast „Brak wyników." i ślepego zaułka: mówimy, CZEGO nie znaleziono, i dajemy
             następny ruch. Najczęściej to po prostu szerszy promień, który sprawdzamy w tle. */
          <div className="rounded-3xl border border-fg/12 bg-surface-2/20 p-6">
            <div className="text-[15px] text-fg/85">{emptyTitle}</div>

            {suggestions.length > 0 ? (
              <div className="mt-3 text-[14px] text-fg/70">
                Czy chodziło o:{' '}
                {suggestions.map((hint, i) => (
                  <span key={`${hint.label}-${hint.lat}`}>
                    {i > 0 ? ', ' : ''}
                    {/* Bez liczby ofert przy nazwie: podpowiedź prowadzi do wyszukania z
                        promieniem, więc wynik i tak wyjdzie inny niż liczba samych ofert
                        podpisanych tą miejscowością. Podaż rozstrzyga tylko kolejność. */}
                    <button type="button" className={linkClass} onClick={() => applySuggestion(hint)}>
                      {hint.label}
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[14px]">
              {wider ? (
                <button type="button" className={linkClass} onClick={() => applyRadiusKm(wider.radiusKm)}>
                  {/* Biernik, nie mianownik: „Pokaż 1 ofertę", a nie „Pokaż 1 oferta". */}
                  Pokaż {wider.total} {plural(wider.total, 'ofertę', 'oferty', 'ofert')} w promieniu{' '}
                  {wider.radiusKm} km
                </button>
              ) : canWiden && !widerChecked ? (
                <span className="text-fg/55">Sprawdzam większy promień…</span>
              ) : applied.center || applied.bbox || scopeLoc ? (
                <button type="button" className={linkClass} onClick={searchWholeCountry}>
                  Szukaj w całej Polsce
                </button>
              ) : null}

              {hasNarrowingFilters ? (
                <button type="button" className={linkClass} onClick={reset}>
                  Wyczyść filtry
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <KupList items={items} loading={loading} error={err} />
        )}

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
              filterQuery={mapQuery}
              center={applied.center}
              radiusKm={applied.radiusKm}
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

      </section>
      </div>
    </div>
  );
}