'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { createParcelOverlay } from '@/lib/parcelOverlay';

type LocationMode = 'EXACT' | 'APPROX';

export type LocationValue = {
  placeId: string | null;
  locationFull: string | null;
  locationLabel: string;
  lat: number;
  lng: number;
  mapsUrl: string | null;
  locationMode: LocationMode;
  parcelText: string | null;
};

type Props = {
  value?: LocationValue;
  onChange: (val: LocationValue) => void;
};

const DEFAULT_CENTER = { lat: 52.2297, lng: 21.0122 };

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function fallbackLabel(lat: number, lng: number, typed?: string) {
  const t = (typed ?? '').trim();
  if (t) return t;
  return `Punkt: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// Publiczna etykieta oferty ma być miejscowością (Bełchatów, Radomsko…), nie surowymi
// współrzędnymi. Z odwrotnego geokodowania wybieramy najbardziej „ludzki" poziom nazwy.
function pickLocalityLabel(results: google.maps.GeocoderResult[]): string | null {
  const wanted = [
    'locality',
    'postal_town',
    'administrative_area_level_3',
    'sublocality',
    'administrative_area_level_2',
  ];
  for (const type of wanted) {
    for (const r of results) {
      const comp = r.address_components?.find((c) => c.types.includes(type));
      if (comp?.long_name) return comp.long_name;
    }
  }
  return null;
}

export default function LocationPicker({ value, onChange }: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const lastGeocodedRef = useRef<string | null>(null);

  const [mode, setMode] = useState<LocationMode>(value?.locationMode ?? 'EXACT');
  // Mapa nie jest już zawsze na widoku (za duża na telefonie i desktopie). Otwiera się
  // pełnoekranowo z zielonego przycisku „Wskaż na mapie" — spójnie z „Sprawdź działkę".
  const [mapOpen, setMapOpen] = useState(false);
  // parcelText już się nie zmienia w UI (usunęliśmy autouzupełnianie), ale zostaje jako
  // wartość początkowa z wartości/draftu i leci dalej w emit().
  const [parcelText] = useState(value?.parcelText ?? '');

  const center = useMemo(() => {
    if (value?.lat != null && value?.lng != null) return { lat: value.lat, lng: value.lng };
    return DEFAULT_CENTER;
  }, [value?.lat, value?.lng]);

  function emit(partial: Partial<LocationValue> & { lat: number; lng: number }) {
    const lat = partial.lat;
    const lng = partial.lng;

    const typed = inputRef.current?.value ?? '';
    const currentLabel = (value?.locationLabel ?? '').trim();
    const incomingLabel = (partial.locationLabel ?? '').trim();

    const label = incomingLabel || currentLabel || fallbackLabel(lat, lng, typed);

    const incomingFull = (partial.locationFull ?? '').trim();
    const currentFull = (value?.locationFull ?? '').trim();
    const full = incomingFull || currentFull || (typed.trim() ? typed.trim() : '');

    onChange({
      placeId: partial.placeId ?? value?.placeId ?? null,
      locationFull: full || null,
      locationLabel: label,
      lat,
      lng,
      mapsUrl: partial.mapsUrl ?? mapsUrl(lat, lng),
      locationMode: partial.locationMode ?? mode,
      parcelText: (partial.parcelText ?? parcelText ?? '').trim() || null,
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!mapDivRef.current) return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
        return;
      }

      const loader = new Loader({
        apiKey,
        libraries: ['places'],
        language: 'pl',
        region: 'PL',
      });

      await loader.load();
      if (cancelled) return;

      geocoderRef.current = new google.maps.Geocoder();

      const map = new google.maps.Map(mapDivRef.current, {
        center,
        zoom: value?.lat ? 15 : 6,
        backgroundColor: 'var(--surface)',
        clickableIcons: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        // Sterowanie jak w Google Maps / „Sprawdź działkę": kółko zbliża bez CTRL,
        // na telefonie jeden palec przesuwa mapę (dwa = zoom).
        gestureHandling: 'greedy',
      });

      mapRef.current = map;

      // Nakładka granic działek ewidencyjnych (WMS GUGiK / KIEG). Renderuje się po
      // przybliżeniu — user widzi obrys każdej działki z numerem i klika w swoją.
      map.overlayMapTypes.push(createParcelOverlay());

      const marker = new google.maps.Marker({
        map,
        position: center,
        draggable: true,
      });
      markerRef.current = marker;

      const circle = new google.maps.Circle({
        map,
        center,
        radius: 800,
        fillColor: '#7aa333',
        fillOpacity: 0.14,
        strokeColor: '#7aa333',
        strokeOpacity: 0.4,
        strokeWeight: 1,
        visible: false,
      });
      circleRef.current = circle;

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;

        marker.setPosition(e.latLng);
        circle.setCenter(e.latLng);

        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        emit({ lat, lng, locationMode: mode, parcelText });
      });

      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (!pos) return;

        circle.setCenter(pos);

        const lat = pos.lat();
        const lng = pos.lng();

        emit({ lat, lng, locationMode: mode, parcelText });
      });

      if (inputRef.current) {
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'pl' },
          fields: ['place_id', 'formatted_address', 'geometry', 'name'],
        });

        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          const loc = place.geometry?.location;
          if (!loc) return;

          const lat = loc.lat();
          const lng = loc.lng();

          map.setCenter({ lat, lng });
          map.setZoom(15);
          marker.setPosition({ lat, lng });
          circle.setCenter({ lat, lng });

          const label = (place.name ?? place.formatted_address ?? '').trim();

          emit({
            lat,
            lng,
            placeId: place.place_id ?? null,
            locationFull: place.formatted_address ?? null,
            locationLabel: label || fallbackLabel(lat, lng, inputRef.current?.value),
            locationMode: mode,
            parcelText,
          });
        });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mapa startuje ukryta (opacity-0), więc przy otwarciu wymuszamy przerysowanie i wracamy
  // na aktualną pinezkę — inaczej kafelki bywają szare do pierwszego ruchu.
  useEffect(() => {
    if (!mapOpen) return;
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    google.maps.event.trigger(map, 'resize');
    const pos = markerRef.current?.getPosition();
    if (pos) map.setCenter(pos);
  }, [mapOpen]);

  useEffect(() => {
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!marker || !circle) return;

    const isApprox = mode === 'APPROX';
    circle.setVisible(isApprox);
    marker.setOpacity(isApprox ? 0.7 : 1);

    if (value?.lat != null && value?.lng != null) {
      emit({ lat: value.lat, lng: value.lng, locationMode: mode, parcelText });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (value?.lat != null && value?.lng != null) {
      emit({ lat: value.lat, lng: value.lng, locationMode: mode, parcelText });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelText]);

  // Gdy user postawi pinezkę bez wpisywania miejscowości, publiczna etykieta to na razie
  // „Punkt: 51.2, 19.1". Odwrotnym geokodowaniem zamieniamy ją na nazwę miejscowości —
  // współrzędne zostają tylko wewnętrznie (pinezka na mapie oferty). Jeden strzał na punkt.
  useEffect(() => {
    const lat = value?.lat;
    const lng = value?.lng;
    if (lat == null || lng == null) return;
    const geocoder = geocoderRef.current;
    if (!geocoder) return;

    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (lastGeocodedRef.current === key) return;

    const label = (value?.locationLabel ?? '').trim();
    const needsTown = !label || label.startsWith('Punkt:');
    if (!needsTown) {
      lastGeocodedRef.current = key;
      return;
    }

    lastGeocodedRef.current = key;
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== 'OK' || !results || results.length === 0) return;
      const town = pickLocalityLabel(results);
      if (!town) return;
      emit({ lat, lng, locationLabel: town, locationMode: mode, parcelText });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, value?.locationLabel]);

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        placeholder="Wpisz miejscowość lub adres…"
        defaultValue={value?.locationLabel ?? ''}
        className="field-line w-full bg-transparent pb-2 text-[18px] text-fg/90 outline-none placeholder:text-fg/62 focus:ring-0 md:text-[19px] selection:bg-fg/20 selection:text-fg"
      />

      <div className="flex flex-wrap gap-8">
        {(['EXACT', 'APPROX'] as LocationMode[]).map((v) => {
          const label = v === 'EXACT' ? 'Dokładna lokalizacja' : 'Przybliżona';
          const active = mode === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setMode(v)}
              aria-pressed={active}
              className={`text-[15px] font-semibold tracking-tight transition ${active ? 'text-fg' : 'text-fg/70 hover:text-fg'}`}
              style={{
                textDecoration: active ? 'underline' : 'none',
                textUnderlineOffset: '10px',
                textDecorationThickness: '1px',
                textDecorationColor: active ? 'var(--brand-bright)' : 'transparent',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Zielony przycisk otwiera mapę na cały ekran (mapa inicjuje się w tle). */}
      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-[12px] font-medium uppercase tracking-[0.18em] text-ink transition hover:bg-brand-bright"
      >
        <PinGlyph />
        {value?.lat != null && value?.lng != null ? 'Popraw na mapie' : 'Wskaż na mapie'}
      </button>

      {value?.lat != null && value?.lng != null && (
        <p className="text-xs text-fg/68">
          {mode === 'EXACT'
            ? 'Pinezka ustawiona. Na mapie ogłoszenia pokażemy dokładny punkt.'
            : 'Pinezka ustawiona. Na mapie ogłoszenia pokażemy przybliżony obszar (okrąg ok. 800 m).'}
        </p>
      )}

      {/* MAPA NA CAŁY EKRAN — spójna ze „Sprawdź działkę". Zawsze zamontowana (mapa inicjuje
          się w pełnym rozmiarze), zamknięta chowa się przez opacity/-z bez display:none. */}
      <div
        className={[
          'fixed inset-0 transition-opacity duration-200',
          mapOpen ? 'z-[120] opacity-100' : 'pointer-events-none -z-10 opacity-0',
        ].join(' ')}
        aria-hidden={!mapOpen}
      >
        <div ref={mapDivRef} className="h-full w-full bg-[#e8eaed]" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <div className="pointer-events-auto max-w-[70%] rounded-xl bg-surface/95 px-4 py-2.5 text-[13px] leading-snug text-fg/80 shadow-lg backdrop-blur">
            Przybliż mapę, pokażą się granice działek z numerami. Kliknij swoją i dociągnij
            pinezkę.
          </div>
          <button
            type="button"
            onClick={() => setMapOpen(false)}
            className="pointer-events-auto inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-surface/95 px-4 text-[12px] font-medium uppercase tracking-[0.18em] text-fg/80 shadow-lg backdrop-blur transition hover:text-fg"
          >
            Zamknij ✕
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex justify-center p-5">
          <button
            type="button"
            onClick={() => setMapOpen(false)}
            disabled={value?.lat == null || value?.lng == null}
            className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-8 text-[12px] font-medium uppercase tracking-[0.22em] text-ink shadow-[0_12px_40px_rgba(0,0,0,0.25)] transition hover:bg-brand-bright disabled:opacity-60"
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
}

function PinGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}