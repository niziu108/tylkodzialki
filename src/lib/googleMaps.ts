let loadingPromise: Promise<void> | null = null;

/**
 * Jedyna ładowarka Google Maps JS API w całym portalu (mapa /kup + autocomplete
 * lokalizacji w KupSearch i HeroSearchBar). Ładuje też `libraries=places`, więc
 * obsługuje zarówno mapę, jak i Autocomplete/Geocoder. Wszystko musi przechodzić
 * przez tę funkcję — inaczej skrypt doklei się drugi raz i Google rzuci
 * „You have included the Google Maps JavaScript API multiple times on this page".
 *
 * Strażnik jest podwójny: `window.google?.maps` (już załadowane) oraz marker
 * `data-google-maps="1"` na tagu <script> (skrypt już doklejony, np. po nawigacji
 * client-side, gdy DOM przeżył, a stan modułu się zresetował).
 */
export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  // już jest
  if (window.google?.maps) return Promise.resolve();

  if (loadingPromise) return loadingPromise;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.reject(new Error('Brak NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'));
  }

  loadingPromise = new Promise<void>((resolve, reject) => {
    // Skrypt już w DOM (poprzednia instancja modułu / nawigacja client-side),
    // ale API jeszcze się nie wczytało — poczekaj na jego load zamiast od razu
    // rozwiązywać promise (inaczej konsument użyłby google.maps zanim będzie gotowe).
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="1"]');
    if (existing) {
      if (window.google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Nie udało się załadować Google Maps JS')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.dataset.googleMaps = '1';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&language=pl&v=weekly`;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Nie udało się załadować Google Maps JS'));

    document.head.appendChild(script);
  });

  return loadingPromise;
}