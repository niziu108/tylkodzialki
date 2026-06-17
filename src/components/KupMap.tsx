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
  tytul: string;
  przezn?: string[];
  featured?: boolean;
  thumb?: string | null;
  loc?: string | null;
  approx?: boolean;
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
  onActiveChange?: (id: string | null) => void;
  onSearchArea?: (b: Bounds) => void;
  onClose?: () => void;
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
  onActiveChange,
  onSearchArea,
  onClose,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const labelsRef = useRef<Map<string, string>>(new Map());
  const circleRef = useRef<google.maps.Circle | null>(null);

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
        if (m && label != null) {
          const featured = m.get('td_featured') as boolean;
          m.setIcon(pinIcon(label, featured ? 'featured' : 'normal'));
          m.setZIndex(featured ? 200 : 100);
        }
      }
      if (id) {
        const m = markersRef.current.get(id);
        const label = labelsRef.current.get(id);
        if (m && label != null) {
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

    const markers: google.maps.Marker[] = [];

    for (const p of points) {
      if (p.lat == null || p.lng == null) continue;

      const label = formatShortPLN(p.cena);
      const featured = !!p.featured;

      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        icon: pinIcon(label, featured ? 'featured' : 'normal'),
        zIndex: featured ? 200 : 100,
        optimized: false,
      });
      marker.set('td_featured', featured);

      marker.addListener('click', () => {
        setSelectedPoint(p);
        if (p.lat != null && p.lng != null) mapRef.current?.panTo({ lat: p.lat, lng: p.lng });

        const c = circleRef.current;
        if (c) {
          if (p.approx && p.lat != null && p.lng != null) {
            c.setCenter({ lat: p.lat, lng: p.lng });
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
      markers.push(marker);
    }

    clusterer.addMarkers(markers);
    fitToData();

    // Odśwież podświetlenie aktywnego po przebudowie.
    if (activeId) setActive(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, ready]);

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
            className="pointer-events-auto rounded-full border border-[#7aa333]/60 bg-[#131313]/95 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur transition hover:border-[#7aa333] hover:bg-[#1b1b1b] sm:px-5 sm:py-2.5 sm:text-[12px]"
          >
            Szukaj w tym obszarze
          </button>
        </div>
      )}

      {/* Licznik pinów (chowany, gdy otwarta karta) */}
      {ready && !error && !selectedPoint && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[5] rounded-full bg-[#131313]/90 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/70 backdrop-blur">
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

      {/* Zamknij (mobile) */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-[6] flex items-center gap-2 rounded-full border border-white/20 bg-[#131313]/95 px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.16em] text-white shadow-lg backdrop-blur transition hover:border-white/40"
        >
          <span className="text-[15px] leading-none">×</span> Lista
        </button>
      )}

      {error && (
        <div className="absolute inset-0 z-[7] flex items-center justify-center bg-[#131313] p-6 text-center text-sm text-white/60">
          {error}
        </div>
      )}
    </div>
  );
}
