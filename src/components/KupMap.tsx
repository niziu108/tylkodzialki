'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer';
import { loadGoogleMaps } from '@/lib/googleMaps';
import MapOfferCard from './MapOfferCard';

/* ────────────────────────────────────────────────────────────────────────────
 *  Mapa wyników na /kup (P11). Dark theme spójny z portalem (#131313 / zieleń
 *  #7aa333). Piny pokazują cenę, gęstość zbijana w klastry, klik na pin otwiera
 *  popup z ofertą. „Szukaj w tym obszarze" przeszukuje prostokąt z widoku mapy.
 *  Mapa jest osobnym, lekkim kanałem danych (payload pinów), więc nie spowalnia
 *  listy ani jej nie dubluje.
 * ──────────────────────────────────────────────────────────────────────────── */

export type MapPoint = {
  id: string;
  lat: number | null;
  lng: number | null;
  cena: number;
  area: number;
  transakcja?: 'SPRZEDAZ' | 'WYNAJEM' | string | null;
  tytul: string;
  przezn?: string[];
  featured?: boolean;
  thumb?: string | null;
  loc?: string | null;
  approx?: boolean;
  prad?: string | null;
  woda?: string | null;
  kanalizacja?: string | null;
  gaz?: string | null;
  sprzedajacyTyp?: 'PRYWATNIE' | 'BIURO' | string | null;
  biuroNazwa?: string | null;
  biuroLogoUrl?: string | null;
};

type Bounds = { n: number; s: number; e: number; w: number };

type Props = {
  points: MapPoint[];
  loading?: boolean;
  /** Środek wyszukiwania (po wpisaniu lokalizacji) — mapa centruje się tutaj. */
  center?: { lat: number; lng: number } | null;
  radiusKm?: number;
  /** Zmiana = nowe wyszukiwanie → mapa dopasowuje kadr do wyników. */
  focusKey?: string;
  /** Podświetlany pin (np. najazd na kartę listy). */
  activeId?: string | null;
  /** Oferta, z której weszliśmy na mapę — jej pin dostaje plakietkę „TA OFERTA”
   *  i jest zawsze widoczny (poza klastrem), żeby było jasne „to ta działka”. */
  selfId?: string | null;
  onActiveChange?: (id: string | null) => void;
  onSearchArea?: (b: Bounds) => void;
  onClose?: () => void;
  /** Etykieta przycisku zamknięcia mapy (domyślnie „Lista"); np. „Wróć do oferty". */
  closeLabel?: string;
  className?: string;
};

const POLAND_CENTER = { lat: 52.07, lng: 19.48 };

function zoomForRadius(km?: number) {
  if (!km) return 12;
  if (km <= 5) return 12;
  if (km <= 10) return 11;
  if (km <= 20) return 10;
  return 9;
}

function formatShortPLN(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1_000_000) {
    const mln = value / 1_000_000;
    const txt = mln >= 10 ? Math.round(mln).toString() : mln.toFixed(1).replace('.', ',').replace(',0', '');
    return `${txt} mln`;
  }
  if (value >= 1000) return `${Math.round(value / 1000)} tys.`;
  return `${value} zł`;
}

function formatIntPL(value: number) {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(value);
}

type PinState = 'normal' | 'featured' | 'active';

function pinIcon(text: string, state: PinState): google.maps.Icon {
  const palette =
    state === 'active'
      ? { bg: '#9fd14b', fg: '#0c0c0c', border: '#ffffff' }
      : state === 'featured'
        ? { bg: '#7aa333', fg: '#0c0c0c', border: '#8dbb3a' }
        : { bg: '#1b1b1b', fg: '#ffffff', border: '#5f7d2a' };

  const w = Math.max(46, Math.ceil(text.length * 7.4) + 22);
  const h = 26;
  const total = h + 7;
  const cx = w / 2;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${total}" viewBox="0 0 ${w} ${total}">` +
    `<rect x="0.75" y="0.75" rx="13" ry="13" width="${w - 1.5}" height="${h - 1.5}" fill="${palette.bg}" stroke="${palette.border}" stroke-width="1.5"/>` +
    `<path d="M${cx - 6},${h - 1} L${cx},${total - 1} L${cx + 6},${h - 1} Z" fill="${palette.bg}" stroke="${palette.border}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<rect x="${cx - 7}" y="${h - 2.5}" width="14" height="3" fill="${palette.bg}"/>` +
    `<text x="${cx}" y="${h / 2}" dominant-baseline="central" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="${palette.fg}">${text}</text>` +
    `</svg>`;

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    size: new google.maps.Size(w, total),
    scaledSize: new google.maps.Size(w, total),
    anchor: new google.maps.Point(cx, total),
  };
}

/* Pin oferty, z której weszliśmy na mapę — pigułka z ceną + plakietka „TA OFERTA”
 * nad nią. Jaskrawa zieleń i napis robią z niej jednoznaczne „to ta działka”. */
function selfPinIcon(text: string): google.maps.Icon {
  const CAP = 'TA OFERTA';
  const cap = 15;
  const gap = 4;
  const h = 28;
  const tail = 7;

  const pillW = Math.max(52, Math.ceil(text.length * 7.6) + 26);
  const capW = Math.ceil(CAP.length * 6.2) + 18;
  const w = Math.max(pillW, capW);
  const total = cap + gap + h + tail;
  const cx = w / 2;
  const pillY = cap + gap;
  const pillTop = pillY;
  const pillBottom = pillY + h;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${total}" viewBox="0 0 ${w} ${total}">` +
    // plakietka „TA OFERTA”
    `<rect x="${cx - capW / 2}" y="0.75" rx="7" ry="7" width="${capW}" height="${cap - 1.5}" fill="#7aa333" stroke="#ffffff" stroke-width="1.25"/>` +
    `<text x="${cx}" y="${cap / 2}" dominant-baseline="central" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="800" letter-spacing="0.6" fill="#0c0c0c">${CAP}</text>` +
    // pigułka z ceną
    `<rect x="${cx - pillW / 2}" y="${pillTop}" rx="14" ry="14" width="${pillW}" height="${h}" fill="#9fd14b" stroke="#ffffff" stroke-width="2"/>` +
    `<path d="M${cx - 6},${pillBottom - 1} L${cx},${pillBottom + tail - 1} L${cx + 6},${pillBottom - 1} Z" fill="#9fd14b" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="${cx - 7}" y="${pillBottom - 3}" width="14" height="3.5" fill="#9fd14b"/>` +
    `<text x="${cx}" y="${pillTop + h / 2}" dominant-baseline="central" text-anchor="middle" font-family="Arial, sans-serif" font-size="12.5" font-weight="800" fill="#0c0c0c">${text}</text>` +
    `</svg>`;

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    size: new google.maps.Size(w, total),
    scaledSize: new google.maps.Size(w, total),
    anchor: new google.maps.Point(cx, total),
  };
}

/* Rozsuwanie pinów o (niemal) tej samej pozycji. Oferty z trybem „przybliżonym”
 * wpisane przez tę samą miejscowość lądują w identycznym punkcie (środek miasta),
 * więc piny nakładają się i nie da się kliknąć żadnej. Liczymy dla nich mały
 * pierścień wokół wspólnego punktu — czysto wizualnie (nie ruszamy zapisanych
 * współrzędnych), deterministycznie (ten sam układ przy każdym renderze) i na tyle
 * delikatnie, żeby nie zafałszować lokalizacji. Grupujemy tylko punkty zaokrąglone
 * do ~1 m, więc realnie różne lokalizacje zostają nietknięte. */
const SPREAD_PRECISION = 5; // miejsca po przecinku (~1 m)

function spreadOverlapping(points: MapPoint[]): Map<string, { lat: number; lng: number }> {
  const groups = new Map<string, MapPoint[]>();
  for (const p of points) {
    if (p.lat == null || p.lng == null) continue;
    const key = `${p.lat.toFixed(SPREAD_PRECISION)},${p.lng.toFixed(SPREAD_PRECISION)}`;
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  const out = new Map<string, { lat: number; lng: number }>();
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      const p = arr[0];
      out.set(p.id, { lat: p.lat!, lng: p.lng! });
      continue;
    }

    // Kolejność po id — stabilny układ pierścienia niezależnie od kolejności z API.
    arr.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const baseLat = arr[0].lat!;
    const baseLng = arr[0].lng!;
    const n = arr.length;
    const radiusM = 14 + Math.min(n, 8) * 4; // 2 oferty ~22 m, większe grupy do ~46 m
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos((baseLat * Math.PI) / 180) || 1;

    arr.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2; // start u góry, zgodnie z zegarem
      const dLat = (radiusM * Math.sin(angle)) / mPerDegLat;
      const dLng = (radiusM * Math.cos(angle)) / mPerDegLng;
      out.set(p.id, { lat: baseLat + dLat, lng: baseLng + dLng });
    });
  }
  return out;
}

function clusterRenderer(): Renderer {
  return {
    render: ({ count, position }) => {
      const size = count < 10 ? 42 : count < 50 ? 50 : count < 200 ? 58 : 66;
      const r = size / 2;
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
        `<circle cx="${r}" cy="${r}" r="${r - 5}" fill="rgba(122,163,51,0.20)"/>` +
        `<circle cx="${r}" cy="${r}" r="${r - 9}" fill="#7aa333" stroke="#cde38f" stroke-width="1.5"/>` +
        `</svg>`;
      return new google.maps.Marker({
        position,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          size: new google.maps.Size(size, size),
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(r, r),
          labelOrigin: new google.maps.Point(r, r),
        },
        label: {
          text: String(count),
          color: '#0c0c0c',
          fontSize: count < 100 ? '13px' : '12px',
          fontWeight: '800',
        },
        zIndex: 1_000_000 + count,
      });
    },
  };
}

export default function KupMap({
  points,
  loading = false,
  center,
  radiusKm,
  focusKey,
  activeId,
  selfId,
  onActiveChange,
  onSearchArea,
  onClose,
  closeLabel,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const labelsRef = useRef<Map<string, string>>(new Map());
  const circleRef = useRef<google.maps.Circle | null>(null);
  // Pin oferty „z której weszliśmy” — trzymany poza klastrem, zawsze na wierzchu.
  const selfMarkerRef = useRef<google.maps.Marker | null>(null);

  const styledActiveRef = useRef<string | null>(null);
  const needsFitRef = useRef(false);
  const skipFitRef = useRef(false);
  const lastFocusRef = useRef<string | undefined>(undefined);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);

  const setActive = useCallback(
    (id: string | null) => {
      const prev = styledActiveRef.current;
      if (prev && prev !== id) {
        const m = markersRef.current.get(prev);
        const label = labelsRef.current.get(prev);
        if (m && label != null && !m.get('td_self')) {
          const featured = m.get('td_featured') as boolean;
          m.setIcon(pinIcon(label, featured ? 'featured' : 'normal'));
          m.setZIndex(featured ? 200 : 100);
        }
      }
      if (id) {
        const m = markersRef.current.get(id);
        const label = labelsRef.current.get(id);
        // Pin „self” ma własną, stałą plakietkę — nie nadpisujemy go stanem active.
        if (m && label != null && !m.get('td_self')) {
          m.setIcon(pinIcon(label, 'active'));
          m.setZIndex(999_999);
        }
      }
      styledActiveRef.current = id;
    },
    []
  );

  // Init mapy — raz, po załadowaniu Google Maps.
  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !hostRef.current || mapRef.current) return;

        const map = new google.maps.Map(hostRef.current, {
          center: center ?? POLAND_CENTER,
          zoom: center ? zoomForRadius(radiusKm) : 6,
          backgroundColor: '#e5e3df',
          // Oryginalna mapa Google (bez własnego stylu), z przełącznikiem Mapa/Satelita
          // — satelita jest świetna do oglądania działek.
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
          maxZoom: 19,
          minZoom: 5,
        });
        mapRef.current = map;

        // Okrąg „obszaru" pokazywany po kliknięciu pinu z przybliżoną lokalizacją.
        circleRef.current = new google.maps.Circle({
          map,
          center: POLAND_CENTER,
          radius: 1200,
          fillColor: '#7aa333',
          fillOpacity: 0.12,
          strokeColor: '#7aa333',
          strokeOpacity: 0.5,
          strokeWeight: 1,
          clickable: false,
          visible: false,
          zIndex: 1,
        });

        clustererRef.current = new MarkerClusterer({
          map,
          renderer: clusterRenderer(),
        });

        map.addListener('click', () => {
          setSelectedPoint(null);
          circleRef.current?.setVisible(false);
          onActiveChange?.(null);
          setActive(null);
        });

        // „Szukaj w tym obszarze" pojawia się po ręcznej zmianie kadru.
        map.addListener('dragend', () => setDirty(true));
        map.addListener('zoom_changed', () => setDirty(true));

        needsFitRef.current = true;
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Nie udało się załadować mapy.');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reakcja na pojawienie się kontenera (mobile: mapa otwierana z ukrycia) — resize + dopasowanie.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;

    let prevW = host.clientWidth;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      const map = mapRef.current;
      if (w > 0 && map) {
        google.maps.event.trigger(map, 'resize');
        if (prevW === 0) {
          needsFitRef.current = true;
          fitToData();
        }
      }
      prevW = w;
    });
    ro.observe(host);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const fitToData = useCallback(() => {
    const map = mapRef.current;
    if (!map || !needsFitRef.current) return;
    if (skipFitRef.current) {
      skipFitRef.current = false;
      needsFitRef.current = false;
      return;
    }

    if (center) {
      map.setCenter(center);
      map.setZoom(zoomForRadius(radiusKm));
      needsFitRef.current = false;
      return;
    }

    const coords = points.filter((p) => p.lat != null && p.lng != null);
    if (!coords.length) {
      map.setCenter(POLAND_CENTER);
      map.setZoom(6);
      needsFitRef.current = false;
      return;
    }

    if (coords.length === 1) {
      map.setCenter({ lat: coords[0].lat!, lng: coords[0].lng! });
      map.setZoom(13);
      needsFitRef.current = false;
      return;
    }

    const b = new google.maps.LatLngBounds();
    coords.forEach((p) => b.extend({ lat: p.lat!, lng: p.lng! }));
    map.fitBounds(b, 64);
    needsFitRef.current = false;
  }, [center, radiusKm, points]);

  // Nowe wyszukiwanie (focusKey) → zaplanuj dopasowanie kadru.
  useEffect(() => {
    if (focusKey === lastFocusRef.current) return;
    lastFocusRef.current = focusKey;
    needsFitRef.current = true;
    setDirty(false);
    setSelectedPoint(null);
  }, [focusKey]);

  // Przebudowa pinów przy zmianie danych.
  useEffect(() => {
    if (!ready || !clustererRef.current) return;

    const clusterer = clustererRef.current;
    clusterer.clearMarkers();
    markersRef.current.clear();
    labelsRef.current.clear();
    styledActiveRef.current = null;
    selfMarkerRef.current?.setMap(null);
    selfMarkerRef.current = null;

    // Pozycje po rozsunięciu nakładających się pinów (czysto wizualne).
    const spread = spreadOverlapping(points);

    const markers: google.maps.Marker[] = [];

    for (const p of points) {
      if (p.lat == null || p.lng == null) continue;

      const pos = spread.get(p.id) ?? { lat: p.lat, lng: p.lng };
      const label =
        p.transakcja === 'WYNAJEM' ? `${formatShortPLN(p.cena)}/mc` : formatShortPLN(p.cena);
      const featured = !!p.featured;
      const isSelf = selfId != null && p.id === selfId;

      const marker = new google.maps.Marker({
        position: pos,
        icon: isSelf ? selfPinIcon(label) : pinIcon(label, featured ? 'featured' : 'normal'),
        zIndex: isSelf ? 2_000_000 : featured ? 200 : 100,
        optimized: false,
      });
      marker.set('td_featured', featured);
      marker.set('td_self', isSelf);

      marker.addListener('click', () => {
        setSelectedPoint(p);
        mapRef.current?.panTo(pos);

        const c = circleRef.current;
        if (c) {
          if (p.approx) {
            c.setCenter(pos);
            c.setVisible(true);
          } else {
            c.setVisible(false);
          }
        }

        onActiveChange?.(p.id);
        setActive(p.id);
      });

      markersRef.current.set(p.id, marker);
      labelsRef.current.set(p.id, label);

      // Pin „self” poza klastrem — zawsze widoczny, niezależnie od zoomu.
      if (isSelf) {
        marker.setMap(mapRef.current);
        selfMarkerRef.current = marker;
      } else {
        markers.push(marker);
      }
    }

    clusterer.addMarkers(markers);
    fitToData();

    // Odśwież podświetlenie aktywnego po przebudowie.
    if (activeId) setActive(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, ready, selfId]);

  // Podświetlanie pinu z zewnątrz (najazd na kartę listy).
  useEffect(() => {
    if (!ready) return;
    setActive(activeId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, ready]);

  const handleSearchArea = () => {
    const map = mapRef.current;
    if (!map || !onSearchArea) return;
    const b = map.getBounds();
    if (!b) return;
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    skipFitRef.current = true; // nie przeskakuj kadru — użytkownik sam go ustawił
    setDirty(false);
    onSearchArea({ n: ne.lat(), s: sw.lat(), e: ne.lng(), w: sw.lng() });
  };

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <div ref={hostRef} className="h-full w-full bg-[#e8eaed]" />

      {/* Szukaj w tym obszarze */}
      {ready && dirty && onSearchArea && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-[5] -translate-x-1/2 sm:top-4">
          <button
            type="button"
            onClick={handleSearchArea}
            className="pointer-events-auto rounded-full border border-brand/60 bg-bg/95 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-fg shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur transition hover:border-brand hover:bg-surface sm:px-5 sm:py-2.5 sm:text-[12px]"
          >
            Szukaj w tym obszarze
          </button>
        </div>
      )}

      {/* Licznik pinów (chowany, gdy otwarta karta) */}
      {ready && !error && !selectedPoint && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[5] rounded-full bg-bg/90 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-fg/70 backdrop-blur">
          {loading ? 'Ładowanie…' : `${formatIntPL(points.length)} na mapie`}
        </div>
      )}

      {/* Karta oferty po kliknięciu pinu — własny panel u dołu (nie dymek Google). */}
      {selectedPoint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] flex justify-center px-3 pb-3">
          <div className="pointer-events-auto w-full max-w-[360px]">
            <MapOfferCard
              point={selectedPoint}
              onClose={() => {
                setSelectedPoint(null);
                circleRef.current?.setVisible(false);
                onActiveChange?.(null);
                setActive(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Zamknij mapę: powrót do listy, albo do oferty gdy weszliśmy z niej. */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-[6] flex items-center gap-2 rounded-full border border-fg/20 bg-bg/95 px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.16em] text-fg shadow-lg backdrop-blur transition hover:border-fg/40"
        >
          <span className="text-[15px] leading-none">{closeLabel ? '←' : '×'}</span> {closeLabel ?? 'Lista'}
        </button>
      )}

      {error && (
        <div className="absolute inset-0 z-[7] flex items-center justify-center bg-bg p-6 text-center text-sm text-fg/72">
          {error}
        </div>
      )}
    </div>
  );
}
