'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google: any;
  }
}

export default function MapsTestPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!key) {
      setStatus('Brak NEXT_PUBLIC_GOOGLE_MAPS_API_KEY w .env.local');
      return;
    }

    const existing = document.querySelector('script[data-google-maps="1"]');
    if (existing) {
      setStatus('loaded');
      init();
      return;
    }

    const script = document.createElement('script');
    script.dataset.googleMaps = '1';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=weekly`;

    script.onload = () => {
      setStatus('loaded');
      init();
    };

    script.onerror = () => setStatus('Nie udało się załadować Google Maps JS');

    document.head.appendChild(script);

    function init() {
      if (!mapRef.current) return;

      const center = { lat: 51.368, lng: 19.356 }; // Bełchatów

      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
      });

      const marker = new window.google.maps.Marker({
        position: center,
        map,
      });

      // Autocomplete (Places)
      if (inputRef.current) {
        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ['place_id', 'formatted_address', 'geometry', 'name'],
          types: ['geocode'],
        });

        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (!place?.geometry?.location) return;

          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();

          map.setCenter({ lat, lng });
          map.setZoom(14);
          marker.setPosition({ lat, lng });

          console.log('PLACE:', {
            placeId: place.place_id,
            formattedAddress: place.formatted_address,
            name: place.name,
            lat,
            lng,
          });
        });
      }
    }
  }, []);

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ fontWeight: 800 }}>Maps + Places test</div>

      <input
        ref={inputRef}
        placeholder='Wpisz: "Bełchatów" lub "Łódź Sienkiewicza 4"'
        style={{
          height: 44,
          padding: '0 12px',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.06)',
          color: 'white',
          outline: 'none',
        }}
      />

      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: 420,
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      />

      <div style={{ opacity: 0.75, fontSize: 12 }}>Status: {status}</div>
      <div style={{ opacity: 0.75, fontSize: 12 }}>
        Otwórz konsolę (F12 → Console). Po wyborze z listy autocomplete zobaczysz log z placeId/lat/lng.
      </div>
    </div>
  );
}