'use client';

import { useState } from 'react';
import LocationPicker, { LocationValue } from '@/components/LocationPicker';

export default function LocationPickerTest() {
  const [loc, setLoc] = useState<LocationValue>({
    placeId: null,
    locationFull: null,
    locationLabel: null,
    lat: null,
    lng: null,
    mapsUrl: null,
    locationMode: 'EXACT',
    parcelText: '',
  });

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>
        LocationPicker test
      </h1>

      <LocationPicker value={loc} onChange={setLoc} />

      <pre style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.06)' }}>
        {JSON.stringify(loc, null, 2)}
      </pre>
    </div>
  );
}