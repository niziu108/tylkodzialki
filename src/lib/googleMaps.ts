let loadingPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  // już jest
  // @ts-ignore
  if (window.google?.maps) return Promise.resolve();

  if (loadingPromise) return loadingPromise;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.reject(new Error('Brak NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'));
  }

  loadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-google-maps="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.dataset.googleMaps = '1';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=weekly`;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Nie udało się załadować Google Maps JS'));

    document.head.appendChild(script);
  });

  return loadingPromise;
}