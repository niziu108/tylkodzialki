/**
 * Wspólny geokoder adresu dla importów CRM. Zwraca współrzędne TYLKO jeśli wynik
 * leży w Polsce (ta sama bramka co reszta systemu — src/lib/geo.ts).
 *
 * Używany jako fallback, gdy feed nie podał współrzędnych albo podał błędne
 * (odrzucone przez sanitizePlCoords). Odpowiada Twojemu punktowi "fallback do
 * lokalizacji miasta/gminy".
 */
import { isInPoland } from "@/lib/geo";

export type GeocodeHit = { lat: number; lng: number; formattedAddress: string | null };

function getGoogleGeocodeKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

export async function geocodeAddressInPoland(query: string | null | undefined): Promise<GeocodeHit | null> {
  const q = (query ?? "").trim();
  if (!q) return null;

  const key = getGoogleGeocodeKey();
  if (!key) {
    console.log("[CRM GEOCODE] Brak GOOGLE_MAPS_API_KEY - pomijam geokodowanie.");
    return null;
  }

  const address = /polska|poland/i.test(q) ? q : `${q}, Polska`;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("region", "pl");
    url.searchParams.set("language", "pl");
    url.searchParams.set("key", key);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK") {
      console.log("[CRM GEOCODE] Brak wyniku:", data.status, address);
      return null;
    }

    const result = data.results?.[0];
    const loc = result?.geometry?.location;

    if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") {
      console.log("[CRM GEOCODE] Brak lat/lng:", address);
      return null;
    }

    if (!isInPoland(loc.lat, loc.lng)) {
      console.log("[CRM GEOCODE] Wynik poza Polską:", address, result.formatted_address);
      return null;
    }

    console.log("[CRM GEOCODE] OK:", address, "=>", loc.lat, loc.lng);

    return { lat: loc.lat, lng: loc.lng, formattedAddress: result.formatted_address ?? null };
  } catch (error) {
    console.error("[CRM GEOCODE] Błąd geokodowania:", address, error);
    return null;
  }
}
