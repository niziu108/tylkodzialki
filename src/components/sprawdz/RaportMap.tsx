'use client';

import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import type { LatLng } from '@/lib/uldk';

// P24: mapa raportu — obrys działki (z ULDK, WGS84) na zdjęciu lotniczym. Reuse jedynej ładowarki
// Google Maps w portalu (src/lib/googleMaps.ts), żeby skrypt nie doklejał się drugi raz.
export default function RaportMap({ rings, center }: { rings: LatLng[][]; center: LatLng }) {
  const divRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !divRef.current || !window.google?.maps) return;

        const map = new google.maps.Map(divRef.current, {
          center,
          zoom: 17,
          mapTypeId: 'hybrid',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });

        const polygon = new google.maps.Polygon({
          paths: rings,
          strokeColor: '#7aa333',
          strokeOpacity: 0.95,
          strokeWeight: 2,
          fillColor: '#7aa333',
          fillOpacity: 0.22,
        });
        polygon.setMap(map);

        // Dopasuj kadr do działki (nie zostawiaj sztywnego zoomu — działki mają różną wielkość).
        const bounds = new google.maps.LatLngBounds();
        for (const ring of rings) for (const p of ring) bounds.extend(p);
        if (!bounds.isEmpty()) map.fitBounds(bounds, 32);
      })
      .catch(() => {
        /* brak mapy nie może wywalić raportu — dane tekstowe i tak są */
      });

    return () => {
      cancelled = true;
    };
  }, [rings, center]);

  return <div ref={divRef} className="h-full w-full" />;
}
