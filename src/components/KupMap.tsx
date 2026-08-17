'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { plural } from '@/lib/plural';
import MapOfferCard from './MapOfferCard';

/* ────────────────────────────────────────────────────────────────────────────
 *  Mapa wyników na /kup (P11). Oryginalna mapa Google (Mapa/Satelita), piny z ceną,
 *  klik na pin otwiera kartę oferty u dołu.
 *
 *  SKALOWANIE (P27). Wcześniej mapa dostawała piny dla całej Polski naraz i budowała
 *  obiekt `google.maps.Marker` dla KAŻDEJ oferty. Pomiar przy 8,3 tys. ofert: payload
 *  2,53 MB i 1,6–6,0 s zablokowanego wątku głównego, z czego 1595 ms to sam konstruktor
 *  markera (klastrowanie: 7 ms). Koszt rósł liniowo, więc przy 50 tys. ofert mapa byłaby
 *  nie do użycia — i tak pokazywała tylko 4000 z 8259 (twardy cap).
 *
 *  Teraz mapa pobiera i rysuje WYŁĄCZNIE bieżący kadr:
 *   • gęsto  → serwer oddaje bąble (zliczenia ofert w komórkach siatki), klik przybliża;
 *   • rzadko → pojedyncze piny, maks. kilkaset.
 *  Do tego pula markerów (recykling przy przesuwaniu) i cache ikon, więc kolejne ruchy
 *  mapy nie tworzą już żadnych nowych obiektów. Liczba obiektów i payload są STAŁE
 *  niezależnie od wielkości bazy. Klastrowanie po stronie klienta stało się zbędne
 *  (liczy je baza), więc @googlemaps/markerclusterer wypadł z paczki.
 * ──────────────────────────────────────────────────────────────────────────── */

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  cena: number;
  transakcja?: 'SPRZEDAZ' | 'WYNAJEM' | string | null;
  featured?: boolean;
  approx?: boolean;
};

export type MapCluster = { lat: number; lng: number; count: number };

type Bounds = { n: number; s: number; e: number; w: number };

type Props = {
  /** Querystring filtrów (bez stronicowania i sortu). Zmiana = nowe wyszukiwanie. */
  filterQuery: string;
  /** Środek wyszukiwania (po wpisaniu lokalizacji) — mapa centruje się tutaj. */
  center?: { lat: number; lng: number } | null;
  radiusKm?: number;
  /** Podświetlany pin (np. najazd na kartę listy). */
  activeId?: string | null;
  /** Oferta, z której weszliśmy na mapę — jej pin jest większy, jaskrawozielony
   *  i zawsze widoczny, żeby było jasne „to ta działka”. */
  selfId?: string | null;
  onActiveChange?: (id: string | null) => void;
  onSearchArea?: (b: Bounds) => void;
  onClose?: () => void;
  /** Etykieta przycisku zamknięcia mapy (domyślnie „Lista"); np. „Wróć do oferty". */
  closeLabel?: string;
  className?: string;
};

const POLAND_CENTER = { lat: 52.07, lng: 19.48 };
// Kadr ustala się dopiero po `idle`, ale przy szybkim przesuwaniu zdarzeń jest kilka —
// krótkie zwlekanie zbija je w jedno zapytanie.
const REFRESH_DEBOUNCE_MS = 160;

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

function pinLabelFor(p: MapPin) {
  return p.transakcja === 'WYNAJEM' ? `${formatShortPLN(p.cena)}/mc` : formatShortPLN(p.cena);
}

/* ── Ikony ────────────────────────────────────────────────────────────────────
 * Ceny się powtarzają („450 tys." itd.), więc te same ikony wracają setki razy.
 * Cache oszczędza budowanie SVG i — ważniejsze — dekodowanie obrazka przez
 * przeglądarkę: zamiast tysiąca unikalnych data-URI mamy ich kilkadziesiąt. */

type PinState = 'normal' | 'featured' | 'active' | 'self';

const pinIconCache = new Map<string, google.maps.Icon>();
const clusterIconCache = new Map<number, google.maps.Icon>();

function svgIcon(svg: string, w: number, h: number, anchorY: number, labelY?: number): google.maps.Icon {
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    size: new google.maps.Size(w, h),
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(w / 2, anchorY),
    ...(labelY != null ? { labelOrigin: new google.maps.Point(w / 2, labelY) } : {}),
  };
}

function pinIcon(text: string, state: PinState): google.maps.Icon {
  const key = `${state}|${text}`;
  const cached = pinIconCache.get(key);
  if (cached) return cached;

  // „self" to pin oferty, z której weszliśmy na mapę: wyższy i jaskrawy, bez krzykliwego
  // napisu — sam rozmiar i kolor robią z niego „pin-bohatera".
  const isSelf = state === 'self';
  const palette =
    state === 'active' || isSelf
      ? { bg: '#9fd14b', fg: '#0c0c0c', border: '#ffffff' }
      : state === 'featured'
        ? { bg: '#7aa333', fg: '#0c0c0c', border: '#8dbb3a' }
        : { bg: '#1b1b1b', fg: '#ffffff', border: '#5f7d2a' };

  const h = isSelf ? 30 : 26;
  const tail = isSelf ? 8 : 7;
  const sw = isSelf ? 2 : 1.5;
  const fs = isSelf ? 13 : 12;
  const w = isSelf
    ? Math.max(54, Math.ceil(text.length * 8) + 28)
    : Math.max(46, Math.ceil(text.length * 7.4) + 22);
  const total = h + tail;
  const cx = w / 2;
  const inset = sw / 2;
  const half = isSelf ? 7 : 6;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${total}" viewBox="0 0 ${w} ${total}">` +
    `<rect x="${inset}" y="${inset}" rx="${isSelf ? 15 : 13}" ry="${isSelf ? 15 : 13}" width="${w - sw}" height="${h - sw}" fill="${palette.bg}" stroke="${palette.border}" stroke-width="${sw}"/>` +
    `<path d="M${cx - half},${h - 1} L${cx},${total - 1} L${cx + half},${h - 1} Z" fill="${palette.bg}" stroke="${palette.border}" stroke-width="${sw}" stroke-linejoin="round"/>` +
    `<rect x="${cx - half - 1}" y="${h - sw - 1}" width="${(half + 1) * 2}" height="${sw + 1}" fill="${palette.bg}"/>` +
    `<text x="${cx}" y="${h / 2}" dominant-baseline="central" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fs}" font-weight="700" fill="${palette.fg}">${text}</text>` +
    `</svg>`;

  const icon = svgIcon(svg, w, total, total);
  pinIconCache.set(key, icon);
  return icon;
}

function clusterIcon(count: number): google.maps.Icon {
  const size = count < 10 ? 42 : count < 50 ? 50 : count < 200 ? 58 : count < 1000 ? 66 : 74;
  const cached = clusterIconCache.get(size);
  if (cached) return cached;

  const r = size / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${r}" cy="${r}" r="${r - 5}" fill="rgba(122,163,51,0.20)"/>` +
    `<circle cx="${r}" cy="${r}" r="${r - 9}" fill="#7aa333" stroke="#cde38f" stroke-width="1.5"/>` +
    `</svg>`;

  const icon = svgIcon(svg, size, size, r, r);
  clusterIconCache.set(size, icon);
  return icon;
}

function clusterLabel(count: number): google.maps.MarkerLabel {
  return {
    text: count >= 1000 ? `${Math.round(count / 100) / 10} tys.` : String(count),
    color: '#0c0c0c',
    fontSize: count < 100 ? '13px' : '12px',
    fontWeight: '800',
  };
}

/* Rozsuwanie pinów o (niemal) tej samej pozycji. Oferty z trybem „przybliżonym"
 * wpisane przez tę samą miejscowość lądują w identycznym punkcie (środek miasta),
 * więc piny nakładają się i nie da się kliknąć żadnej. Liczymy dla nich mały
 * pierścień wokół wspólnego punktu — czysto wizualnie (nie ruszamy zapisanych
 * współrzędnych), deterministycznie (ten sam układ przy każdym renderze) i na tyle
 * delikatnie, żeby nie zafałszować lokalizacji. Grupujemy tylko punkty zaokrąglone
 * do ~1 m, więc realnie różne lokalizacje zostają nietknięte. */
const SPREAD_PRECISION = 5; // miejsca po przecinku (~1 m)

function spreadOverlapping(points: MapPin[]): Map<string, { lat: number; lng: number }> {
  const groups = new Map<string, MapPin[]>();
  for (const p of points) {
    const key = `${p.lat.toFixed(SPREAD_PRECISION)},${p.lng.toFixed(SPREAD_PRECISION)}`;
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  const out = new Map<string, { lat: number; lng: number }>();
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.set(arr[0].id, { lat: arr[0].lat, lng: arr[0].lng });
      continue;
    }

    // Kolejność po id — stabilny układ pierścienia niezależnie od kolejności z API.
    arr.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const baseLat = arr[0].lat;
    const baseLng = arr[0].lng;
    const n = arr.length;
    const radiusM = 14 + Math.min(n, 8) * 4; // 2 oferty ~22 m, większe grupy do ~46 m
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos((baseLat * Math.PI) / 180) || 1;

    arr.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2; // start u góry, zgodnie z zegarem
      out.set(p.id, {
        lat: baseLat + (radiusM * Math.sin(angle)) / mPerDegLat,
        lng: baseLng + (radiusM * Math.cos(angle)) / mPerDegLng,
      });
    });
  }
  return out;
}

export default function KupMap({
  filterQuery,
  center,
  radiusKm,
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
  const circleRef = useRef<google.maps.Circle | null>(null);

  // Pule markerów — tworzymy je raz i przestawiamy przy każdym odświeżeniu.
  // To dzięki nim przesuwanie mapy nie kosztuje już nic: konstruktor `Marker`
  // (0,4 ms sztuka) wykonuje się tylko wtedy, gdy pula musi urosnąć.
  const pinPoolRef = useRef<google.maps.Marker[]>([]);
  const clusterPoolRef = useRef<google.maps.Marker[]>([]);
  const pinByIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const selfMarkerRef = useRef<google.maps.Marker | null>(null);

  const styledActiveRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef<((fit: boolean) => void) | null>(null);
  const skipFitRef = useRef(false);
  const lastQueryRef = useRef<string | null>(null);
  // Kadr ustawiony przez nas (wyśrodkowanie na wyszukiwaniu, dopasowanie do wyników)
  // NIE jest „ręczną zmianą widoku", więc nie ma wywoływać przycisku zawężenia listy.
  // Google nie rozróżnia źródła zdarzenia, więc oznaczamy je sami.
  const programmaticRef = useRef(false);

  const moveCamera = useCallback((fn: () => void) => {
    programmaticRef.current = true;
    fn();
  }, []);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // `loaded` odróżnia „jeszcze nie wiemy" od „wiemy, że zero" — bez tego licznik
  // mrugałby zerem, zanim przyjdzie pierwsza odpowiedź.
  const [loaded, setLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<MapPin | null>(null);

  const setActive = useCallback((id: string | null) => {
    const prev = styledActiveRef.current;
    if (prev && prev !== id) {
      const m = pinByIdRef.current.get(prev);
      const p = m?.get('td_pin') as MapPin | undefined;
      if (m && p) {
        m.setIcon(pinIcon(pinLabelFor(p), p.featured ? 'featured' : 'normal'));
        m.setZIndex(p.featured ? 200 : 100);
      }
    }
    if (id) {
      const m = pinByIdRef.current.get(id);
      const p = m?.get('td_pin') as MapPin | undefined;
      if (m && p) {
        m.setIcon(pinIcon(pinLabelFor(p), 'active'));
        m.setZIndex(999_999);
      }
    }
    styledActiveRef.current = id;
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    circleRef.current?.setVisible(false);
    onActiveChange?.(null);
    setActive(null);
  }, [onActiveChange, setActive]);

  const selectPin = useCallback(
    (p: MapPin, pos: google.maps.LatLng | google.maps.LatLngLiteral) => {
      setSelected(p);
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
    },
    [onActiveChange, setActive]
  );

  /* ── Rysowanie ──────────────────────────────────────────────────────────────
   * Zamiast kasować i tworzyć markery od nowa, przestawiamy te z puli, a nadmiar
   * chowamy. Przy przesuwaniu mapy nie powstaje ani jeden nowy obiekt. */
  const draw = useCallback(
    (points: MapPin[], clusters: MapCluster[]) => {
      const map = mapRef.current;
      if (!map) return;

      // Oferta, z której weszliśmy, ma własny „pin-bohater" poza pulą — z puli ją
      // pomijamy, żeby dwa piny nie stały jeden na drugim.
      const drawn = selfId ? points.filter((p) => p.id !== selfId) : points;

      const spread = drawn.length ? spreadOverlapping(drawn) : null;
      const byId = new Map<string, google.maps.Marker>();
      const pool = pinPoolRef.current;

      drawn.forEach((p, i) => {
        const pos = spread?.get(p.id) ?? { lat: p.lat, lng: p.lng };
        let m = pool[i];
        if (!m) {
          m = new google.maps.Marker({ position: pos, map });
          m.addListener('click', () => {
            const pin = m.get('td_pin') as MapPin | undefined;
            const at = m.getPosition();
            if (pin && at) selectPin(pin, at);
          });
          pool[i] = m;
        } else {
          m.setPosition(pos);
        }
        m.set('td_pin', p);
        m.setIcon(pinIcon(pinLabelFor(p), p.featured ? 'featured' : 'normal'));
        m.setZIndex(p.featured ? 200 : 100);
        m.setLabel(null);
        m.setVisible(true);
        byId.set(p.id, m);
      });
      for (let i = drawn.length; i < pool.length; i++) pool[i].setVisible(false);
      pinByIdRef.current = byId;

      const cPool = clusterPoolRef.current;
      clusters.forEach((c, i) => {
        const pos = { lat: c.lat, lng: c.lng };
        let m = cPool[i];
        if (!m) {
          m = new google.maps.Marker({ position: pos, map });
          m.addListener('click', () => {
            const at = m.getPosition();
            if (!at) return;
            // Klik w bąbel = wejdź głębiej. Trzy poziomy to zwykle skok
            // „województwo → powiat → gmina", czyli jedno kliknięcie = jeden sensowny krok.
            map.panTo(at);
            map.setZoom(Math.min((map.getZoom() ?? 6) + 3, 16));
            setDirty(true); // widok zmieniony przez użytkownika — można zawęzić listę
          });
          cPool[i] = m;
        } else {
          m.setPosition(pos);
        }
        m.setIcon(clusterIcon(c.count));
        m.setLabel(clusterLabel(c.count));
        m.setZIndex(1_000_000 + Math.min(c.count, 900_000));
        m.setVisible(true);
      });
      for (let i = clusters.length; i < cPool.length; i++) cPool[i].setVisible(false);

      // Podświetlany pin mógł wyjechać poza kadr (i wrócić) — po przerysowaniu
      // stan „active" trzeba nałożyć na nowo, bo markery zmieniły przypisanie do ofert.
      styledActiveRef.current = null;
      if (activeId) setActive(activeId);
    },
    [activeId, selfId, selectPin, setActive]
  );

  /* ── Pobranie danych dla bieżącego kadru ─────────────────────────────────── */
  const refresh = useCallback(
    async (wantFit: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      const b = map.getBounds();
      if (!b) return;

      const ne = b.getNorthEast();
      const sw = b.getSouthWest();

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const sp = new URLSearchParams(filterQuery);
      sp.set('mode', 'map');
      sp.set('vn', String(ne.lat()));
      sp.set('vs', String(sw.lat()));
      sp.set('ve', String(ne.lng()));
      sp.set('vw', String(sw.lng()));
      sp.set('z', String(Math.round(map.getZoom() ?? 6)));
      if (wantFit) sp.set('fit', '1');

      try {
        const r = await fetch(`/api/dzialki?${sp.toString()}`, {
          cache: 'no-store',
          signal: ac.signal,
        });
        if (!r.ok) throw new Error('bad status');
        const d = await r.json();
        if (ac.signal.aborted || !d?.ok) return;

        setTotal(typeof d.total === 'number' ? d.total : 0);
        setLoaded(true);
        draw(d.points ?? [], d.clusters ?? []);

        // Dopasowanie kadru po zmianie filtrów. Zmiana kadru wywoła `idle`,
        // które dociągnie właściwe dane dla nowego widoku.
        if (wantFit && d.bounds) {
          moveCamera(() => {
            if (d.bounds.n === d.bounds.s && d.bounds.e === d.bounds.w) {
              map.setCenter({ lat: d.bounds.n, lng: d.bounds.e });
              map.setZoom(13);
            } else {
              map.fitBounds(
                new google.maps.LatLngBounds(
                  { lat: d.bounds.s, lng: d.bounds.w },
                  { lat: d.bounds.n, lng: d.bounds.e }
                ),
                64
              );
            }
          });
        }
      } catch {
        // Ciche pominięcie: nieudane dociągnięcie zostawia na mapie to, co już było,
        // zamiast czyścić kadr i straszyć użytkownika pustką.
      }
    },
    [filterQuery, draw, moveCamera]
  );

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

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

        map.addListener('click', () => {
          setSelected(null);
          circleRef.current?.setVisible(false);
          onActiveChange?.(null);
          setActive(null);
        });

        // „Szukaj w tym obszarze" pojawia się po ręcznej zmianie kadru.
        map.addListener('dragend', () => setDirty(true));
        map.addListener('zoom_changed', () => {
          if (!programmaticRef.current) setDirty(true);
        });

        // Każde ustanie ruchu = dociągnij dane dla tego, co widać.
        map.addListener('idle', () => {
          programmaticRef.current = false;
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => refreshRef.current?.(false), REFRESH_DEBOUNCE_MS);
        });

        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Nie udało się załadować mapy.');
      });

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reakcja na pojawienie się kontenera (mobile: mapa otwierana z ukrycia).
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      const map = mapRef.current;
      if (w > 0 && map) google.maps.event.trigger(map, 'resize');
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [ready]);

  // Nowe wyszukiwanie → wyczyść zaznaczenie, ustaw kadr, pobierz dane.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    const first = lastQueryRef.current === null;
    if (lastQueryRef.current === filterQuery) return;
    lastQueryRef.current = filterQuery;

    setSelected(null);
    setDirty(false);

    if (center) {
      moveCamera(() => {
        map.setCenter(center);
        map.setZoom(zoomForRadius(radiusKm));
      });
      refresh(false);
      return;
    }

    // Po „szukaj w tym obszarze" kadr jest tym, który użytkownik sam ustawił —
    // dopasowywanie go do wyników odebrałoby mu kontrolę.
    if (skipFitRef.current) {
      skipFitRef.current = false;
      refresh(false);
      return;
    }

    refresh(!first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterQuery, ready]);

  // Pin oferty, z której weszliśmy na mapę — poza pulą i poza kadrowaniem, zawsze widoczny.
  useEffect(() => {
    if (!ready || !selfId) return;
    let cancelled = false;

    fetch(`/api/dzialki/${selfId}`, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || d.lat == null || d.lng == null || !mapRef.current) return;
        const label =
          d.transakcja === 'WYNAJEM'
            ? `${formatShortPLN(d.cenaPln)}/mc`
            : formatShortPLN(d.cenaPln);
        selfMarkerRef.current?.setMap(null);
        selfMarkerRef.current = new google.maps.Marker({
          position: { lat: d.lat, lng: d.lng },
          map: mapRef.current,
          icon: pinIcon(label, 'self'),
          zIndex: 2_000_000,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [ready, selfId]);

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

  // Przycisk zawężenia pokazujemy dopiero, gdy znamy liczbę ofert w kadrze — inaczej
  // mrugnąłby etykietą „Brak ofert" w trakcie pierwszego pobierania.
  const showAreaButton = ready && dirty && loaded && !!onSearchArea;

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <div ref={hostRef} className="h-full w-full bg-[#e8eaed]" />

      {/* Zawężenie listy do widocznego obszaru. Piny dociągają się same przy przesuwaniu,
          więc przycisk nie ładuje mapy — mówi wprost, ile ofert przejdzie na listę.
          Liczba w etykiecie zdejmuje pytanie „co się właściwie stanie po kliknięciu". */}
      {showAreaButton && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-[5] -translate-x-1/2 sm:top-4">
          <button
            type="button"
            onClick={handleSearchArea}
            disabled={total === 0}
            className="pointer-events-auto rounded-full border border-brand/60 bg-bg/95 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-fg shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur transition hover:border-brand hover:bg-surface disabled:cursor-default disabled:border-fg/20 disabled:text-fg/45 disabled:hover:bg-bg/95 sm:px-5 sm:py-2.5 sm:text-[12px]"
          >
            {total === 0
              ? 'Brak ofert w tym obszarze'
              : `Pokaż ${formatIntPL(total)} ${plural(total, 'ofertę', 'oferty', 'ofert')} z tego obszaru`}
          </button>
        </div>
      )}

      {/* Licznik ofert w kadrze. Chowany, gdy widać przycisk (ta sama liczba dwa razy)
          albo gdy otwarta jest karta oferty. */}
      {ready && !error && !selected && !showAreaButton && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[5] rounded-full bg-bg/90 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-fg/70 backdrop-blur">
          {loaded ? `${formatIntPL(total)} w tym widoku` : 'Ładowanie…'}
        </div>
      )}

      {/* Karta oferty po kliknięciu pinu — własny panel u dołu (nie dymek Google). */}
      {selected && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] flex justify-center px-3 pb-3">
          <div className="pointer-events-auto w-full max-w-[360px]">
            <MapOfferCard key={selected.id} pin={selected} onClose={clearSelection} />
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
