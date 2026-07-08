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

        // Nakładka granic działek ewidencyjnych (WMS GUGiK / KIEG) — obrys każdej działki
        // z numerem, ten sam kafel co w dodawaniu oferty ([[project-wms-dzialki-overlay]]).
        const EXTENT = 20037508.342789244;
        const parcelLayer = new google.maps.ImageMapType({
          name: 'dzialki',
          tileSize: new google.maps.Size(256, 256),
          maxZoom: 21,
          opacity: 0.85,
          getTileUrl: (coord, zoom) => {
            // Działki ewidencyjne mają sens dopiero po przybliżeniu; niżej nie odpytujemy.
            if (zoom < 15) return null as unknown as string;
            const worldSize = 2 * EXTENT;
            const tile = worldSize / Math.pow(2, zoom);
            const minx = -EXTENT + coord.x * tile;
            const maxx = -EXTENT + (coord.x + 1) * tile;
            const maxy = EXTENT - coord.y * tile;
            const miny = EXTENT - (coord.y + 1) * tile;
            const params = new URLSearchParams({
              SERVICE: 'WMS',
              VERSION: '1.1.1',
              REQUEST: 'GetMap',
              LAYERS: 'dzialki,numery_dzialek',
              STYLES: '',
              SRS: 'EPSG:3857',
              BBOX: `${minx},${miny},${maxx},${maxy}`,
              WIDTH: '256',
              HEIGHT: '256',
              FORMAT: 'image/png',
              TRANSPARENT: 'TRUE',
            });
            return `https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow?${params.toString()}`;
          },
        });
        map.overlayMapTypes.push(parcelLayer);

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
