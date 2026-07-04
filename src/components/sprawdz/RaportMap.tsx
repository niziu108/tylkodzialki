'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import type { LatLng } from '@/lib/uldk';
import { MPZP_WMS, MPZP_LAYER } from '@/lib/mpzp';

// P24: mapa raportu — obrys działki (z ULDK, WGS84). Domyślnie zwykła mapa (roadmap), podgląd z
// satelity i nakładka planu miejscowego (MPZP z KIMPZP, WMS) pod przełącznikami. Reuse jedynej
// ładowarki Google Maps.
type MapType = 'roadmap' | 'hybrid';

const WEB_MERCATOR_EXTENT = 20037508.342789244;

// Kafel Google (x,y,zoom) -> BBOX w EPSG:3857 dla WMS GetMap.
function tileBbox3857(x: number, y: number, zoom: number): string {
  const worldSize = WEB_MERCATOR_EXTENT * 2;
  const tileMeters = worldSize / Math.pow(2, zoom);
  const minX = -WEB_MERCATOR_EXTENT + x * tileMeters;
  const maxX = -WEB_MERCATOR_EXTENT + (x + 1) * tileMeters;
  const maxY = WEB_MERCATOR_EXTENT - y * tileMeters;
  const minY = WEB_MERCATOR_EXTENT - (y + 1) * tileMeters;
  return `${minX},${minY},${maxX},${maxY}`;
}

function mpzpTileUrl(coord: google.maps.Point, zoom: number): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: MPZP_LAYER,
    STYLES: '',
    CRS: 'EPSG:3857',
    BBOX: tileBbox3857(coord.x, coord.y, zoom),
    WIDTH: '256',
    HEIGHT: '256',
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
  });
  return `${MPZP_WMS}?${params.toString()}`;
}

export default function RaportMap({ rings, center }: { rings: LatLng[][]; center: LatLng }) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mpzpLayerRef = useRef<google.maps.ImageMapType | null>(null);
  const [mapType, setMapType] = useState<MapType>('roadmap');
  const [showMpzp, setShowMpzp] = useState(false);

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

        mpzpLayerRef.current = new google.maps.ImageMapType({
          getTileUrl: (coord, zoom) => mpzpTileUrl(coord, zoom),
          tileSize: new google.maps.Size(256, 256),
          opacity: 0.6,
          name: 'MPZP',
        });

        const polygon = new google.maps.Polygon({
          paths: rings,
          strokeColor: '#5f7d28',
          strokeOpacity: 1,
          strokeWeight: 2.5,
          fillColor: '#7aa333',
          fillOpacity: 0.24,
        });
        polygon.setMap(map);

        const bounds = new google.maps.LatLngBounds();
        for (const ring of rings) for (const p of ring) bounds.extend(p);
        if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
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

  useEffect(() => {
    const map = mapRef.current;
    const layer = mpzpLayerRef.current;
    if (!map || !layer) return;
    map.overlayMapTypes.clear();
    if (showMpzp) map.overlayMapTypes.push(layer);
  }, [showMpzp]);

  return (
    <div className="relative h-full w-full">
      <div ref={divRef} className="h-full w-full" />

      <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        <div className="flex overflow-hidden rounded-full border border-white/20 bg-black/45 text-[13px] backdrop-blur">
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

        <button
          type="button"
          onClick={() => setShowMpzp((s) => !s)}
          className={`rounded-full border px-4 py-1.5 text-[13px] font-medium backdrop-blur transition ${
            showMpzp
              ? 'border-brand bg-brand text-ink'
              : 'border-white/20 bg-black/45 text-white/85 hover:text-white'
          }`}
        >
          Plan miejscowy
        </button>
      </div>
    </div>
  );
}
