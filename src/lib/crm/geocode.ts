/**
 * Wspólny geokoder adresu dla importów CRM. Zwraca współrzędne TYLKO jeśli wynik
 * leży w Polsce (ta sama bramka co reszta systemu — src/lib/geo.ts).
 *
 * Używany jako fallback, gdy feed nie podał współrzędnych albo podał błędne
 * (odrzucone przez sanitizePlCoords). Odpowiada Twojemu punktowi "fallback do
 * lokalizacji miasta/gminy".
 *
 * BUDŻET (po incydencie kosztowym z auto-syncem, który re-geokodował całą bazę co dobę za ~60 zł):
 * reużycie współrzędnych z bazy po stronie silnika jest pierwszą linią obrony, ale nie jedyną.
 * Wystarczy, że kontrola krzyżowa lat/lng odrzuci zapisany pin (rozjazd opisu ze współrzędnymi),
 * a ta sama oferta idzie do płatnego API przy KAŻDYM przebiegu. Przy 4 tys. ofert jednego partnera
 * to kilkadziesiąt dolarów dziennie, w ciszy. Dlatego licznik stoi tutaj, w jedynym miejscu, przez
 * które wychodzi płatne zapytanie: każdy przyszły silnik dostaje ten bezpiecznik za darmo.
 *
 * Wyczerpanie budżetu nie jest błędem importu: oferta wchodzi bez współrzędnych i zostanie
 * uzupełniona w kolejnym przebiegu. Lepiej dzień bez pinu niż niekontrolowany rachunek.
 */
import { isInPoland } from "@/lib/geo";

export type GeocodeHit = { lat: number; lng: number; formattedAddress: string | null };

export const GEOCODE_BUDGET_DEFAULTS = {
  /** Maksymalna liczba płatnych zapytań w jednym przebiegu importu. */
  perRun: 1500,
  /** Maksymalna liczba płatnych zapytań na dobę, licząc wszystkie przebiegi workera. */
  perDay: 3000,
} as const;

export function readGeocodeBudget(env: Record<string, string | undefined> = process.env) {
  const run = Number(env.CRM_GEOCODE_RUN_LIMIT);
  const day = Number(env.CRM_GEOCODE_DAILY_LIMIT);

  return {
    perRun: Number.isFinite(run) && run >= 0 ? run : GEOCODE_BUDGET_DEFAULTS.perRun,
    perDay: Number.isFinite(day) && day >= 0 ? day : GEOCODE_BUDGET_DEFAULTS.perDay,
  };
}

// Licznik żyje w pamięci procesu. Worker na VPS jest jednoinstancyjny i długo żyjący, więc doba
// liczy się poprawnie; restart zeruje licznik dobowy, ale limit na przebieg i tak trzyma sufit.
let runUsed = 0;
let dayUsed = 0;
let dayKey = "";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Zerowanie licznika przebiegu. Wołane na starcie synchronizacji integracji. */
export function beginGeocodeRun(label: string) {
  runUsed = 0;

  if (dayKey !== today()) {
    dayKey = today();
    dayUsed = 0;
  }

  console.log(`[CRM GEOCODE] Start przebiegu ${label}. Zużycie dobowe: ${dayUsed}.`);
}

export function getGeocodeUsage() {
  return { runUsed, dayUsed, dayKey };
}

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

  const budget = readGeocodeBudget();

  if (dayKey !== today()) {
    dayKey = today();
    dayUsed = 0;
  }

  if (runUsed >= budget.perRun) {
    // Jeden komunikat na przebieg, nie na ofertę — inaczej log workera zamienia się w spam.
    if (runUsed === budget.perRun) {
      console.warn(
        `[CRM GEOCODE] Wyczerpany budżet przebiegu (${budget.perRun}). ` +
          `Kolejne oferty wejdą bez współrzędnych i uzupełnią się w następnym imporcie.`
      );
      runUsed += 1;
    }
    return null;
  }

  if (dayUsed >= budget.perDay) {
    if (dayUsed === budget.perDay) {
      console.warn(
        `[CRM GEOCODE] Wyczerpany budżet dobowy (${budget.perDay}). Geokodowanie wstrzymane do jutra.`
      );
      dayUsed += 1;
    }
    return null;
  }

  const address = /polska|poland/i.test(q) ? q : `${q}, Polska`;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("region", "pl");
    url.searchParams.set("language", "pl");
    url.searchParams.set("key", key);

    runUsed += 1;
    dayUsed += 1;

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
