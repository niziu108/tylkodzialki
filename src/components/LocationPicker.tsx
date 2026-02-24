'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

type LocationMode = 'EXACT' | 'APPROX';

export type LocationValue = {
  placeId: string | null;
  locationFull: string | null;
  locationLabel: string; // ✅ zawsze non-empty
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

export default function LocationPicker({ value, onChange }: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  const [mode, setMode] = useState<LocationMode>(value?.locationMode ?? 'EXACT');
  const [parcelText, setParcelText] = useState(value?.parcelText ?? '');

  const center = useMemo(() => {
    if (value?.lat != null && value?.lng != null) return { lat: value.lat, lng: value.lng };
    return DEFAULT_CENTER;
  }, [value?.lat, value?.lng]);

  // ✅ emit always provides locationLabel (never empty)
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
      locationLabel: label, // ✅ always non-empty
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

      const map = new google.maps.Map(mapDivRef.current, {
        center,
        zoom: value?.lat ? 15 : 6,
        backgroundColor: '#ffffff',
        clickableIcons: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapRef.current = map;

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
        fillColor: '#000000',
        fillOpacity: 0.12,
        strokeColor: '#000000',
        strokeOpacity: 0.35,
        strokeWeight: 1,
        visible: false,
      });
      circleRef.current = circle;

      // click on map -> sets point and also creates label fallback
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;

        marker.setPosition(e.latLng);
        circle.setCenter(e.latLng);

        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        emit({ lat, lng, locationMode: mode, parcelText });
      });

      // drag marker
      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (!pos) return;

        circle.setCenter(pos);

        const lat = pos.lat();
        const lng = pos.lng();

        emit({ lat, lng, locationMode: mode, parcelText });
      });

      // Places autocomplete
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

  // visuals on mode change
  useEffect(() => {
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!marker || !circle) return;

    const isApprox = mode === 'APPROX';
    circle.setVisible(isApprox);
    marker.setOpacity(isApprox ? 0.7 : 1);

    // keep value consistent
    if (value?.lat != null && value?.lng != null) {
      emit({ lat: value.lat, lng: value.lng, locationMode: mode, parcelText });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // keep parcel text synced
  useEffect(() => {
    if (value?.lat != null && value?.lng != null) {
      emit({ lat: value.lat, lng: value.lng, locationMode: mode, parcelText });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelText]);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        placeholder="Wpisz miejscowość lub adres…"
        defaultValue={value?.locationLabel ?? ''}
        className="w-full rounded-lg border border-white/20 bg-white text-black px-3 py-2 outline-none"
      />

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'EXACT'} onChange={() => setMode('EXACT')} />
          <span>Dokładna lokalizacja</span>
        </label>

        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'APPROX'} onChange={() => setMode('APPROX')} />
          <span>Przybliżona</span>
        </label>
      </div>

      <input
        placeholder="Numer działki / obręb (opcjonalnie)"
        className="w-full rounded-lg border border-white/20 bg-black text-white px-3 py-2 outline-none"
        value={parcelText}
        onChange={(e) => setParcelText(e.target.value)}
      />

      <div className="rounded-xl border border-white/15 bg-white p-2">
        <div ref={mapDivRef} className="h-80 w-full rounded-lg" />
      </div>

      {value?.lat != null && value?.lng != null && (
        <div className="text-xs opacity-70">
          Punkt: {value.lat.toFixed(6)}, {value.lng.toFixed(6)} | tryb: {mode}
        </div>
      )}
    </div>
  );
}