'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import type { LatLng } from '@/lib/uldk';

// P24: mapa raportu — obrys działki (z ULDK, WGS84). Domyślnie zwykła mapa (roadmap), podgląd z
// satelity pod przełącznikiem. Reuse jedynej ładowarki Google Maps.
type MapType = 'roadmap' | 'hybrid';

export default function RaportMap({ rings, center }: { rings: LatLng[][]; center: LatLng }) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<MapType>('roadmap');

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !divRef.current || !window.google?.maps) return;

        const map = new google.maps.Map(divRef.current, {
          center,
          zoom: 17,
          mapTypeId: 'roadmap',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });
        mapRef.current = map;

        const polygon = new google.maps.Polygon({
          paths: rings,
          strokeColor: '#5f7d28',
          strokeOpacity: 1,
          strokeWeight: 2.5,
          fillColor: '#7aa333',
          fillOpacity: 0.22,
        });
        polygon.setMap(map);

        const bounds = new google.maps.LatLngBounds();
        for (const ring of rings) for (const p of ring) bounds.extend(p);
        if (!bounds.isEmpty()) map.fitBounds(bounds, 56);
      })
      .catch(() => {
        /* brak mapy nie może wywalić raportu — dane tekstowe i tak są */
      });

    return () => {
      cancelled = true;
    };
  }, [rings, center]);

  useEffect(() => {
    mapRef.current?.setMapTypeId(mapType);
  }, [mapType]);

  return (
    <div className="relative h-full w-full">
      <div ref={divRef} className="h-full w-full" />

      <div className="absolute right-4 top-4 z-10 flex overflow-hidden rounded-full border border-white/20 bg-black/45 text-[13px] backdrop-blur">
        {(['roadmap', 'hybrid'] as MapType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMapType(t)}
            className={`px-4 py-1.5 font-medium transition ${
              mapType === t ? 'bg-white/90 text-black' : 'text-white/85 hover:text-white'
            }`}
          >
            {t === 'roadmap' ? 'Mapa' : 'Satelita'}
          </button>
        ))}
      </div>
    </div>
  );
}
