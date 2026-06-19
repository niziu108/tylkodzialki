// Jedno źródło prawdy: które statusy mediów znaczą „medium fizycznie NA DZIAŁCE" (P10).
// Świadomie wykluczamy „brak", „możliwość podłączenia", „w drodze" i „warunki wydane" — to znaczy,
// że medium na działce jeszcze NIE MA (decyzja właściciela). Studnia/szambo/oczyszczalnia liczą się.
// Tej samej listy używa filtr w `app/api/dzialki/route.ts` ORAZ chip „media" na kartach oferty,
// więc filtr i etykieta nigdy się nie rozjadą.

// `import type` (nie wartości) → ten moduł trafia do bundla klienta (chip „media" na karcie),
// więc NIE wciągamy runtime'u @prisma/client do przeglądarki. Statusy jako literały, a `satisfies`
// pilnuje, że pokrywają się z enumami Prisma (literówka nie przejdzie kompilacji).
import type { PradStatus, WodaStatus, KanalizacjaStatus, GazStatus } from '@prisma/client';

export const MEDIA_AVAILABLE = {
  prad: ['PRZYLACZE_NA_DZIALCE'],
  woda: ['WODOCIAG_NA_DZIALCE', 'STUDNIA_GLEBINOWA'],
  kanalizacja: ['MIEJSKA_NA_DZIALCE', 'SZAMBO', 'PRZYDOMOWA_OCZYSZCZALNIA'],
  gaz: ['GAZ_NA_DZIALCE'],
} as const satisfies {
  prad: readonly PradStatus[];
  woda: readonly WodaStatus[];
  kanalizacja: readonly KanalizacjaStatus[];
  gaz: readonly GazStatus[];
};

export type MediaSource = {
  prad?: PradStatus | string | null;
  woda?: WodaStatus | string | null;
  kanalizacja?: KanalizacjaStatus | string | null;
  gaz?: GazStatus | string | null;
};

export type MediaFlags = { prad: boolean; woda: boolean; kanalizacja: boolean; gaz: boolean };

function has(set: readonly string[], v: unknown): boolean {
  return typeof v === 'string' && set.includes(v);
}

export function getParcelMedia(d: MediaSource | null | undefined): MediaFlags {
  return {
    prad: has(MEDIA_AVAILABLE.prad, d?.prad),
    woda: has(MEDIA_AVAILABLE.woda, d?.woda),
    kanalizacja: has(MEDIA_AVAILABLE.kanalizacja, d?.kanalizacja),
    gaz: has(MEDIA_AVAILABLE.gaz, d?.gaz),
  };
}

export const MEDIA_LABEL: Record<keyof MediaFlags, string> = {
  prad: 'Prąd',
  woda: 'Woda',
  kanalizacja: 'Kanalizacja',
  gaz: 'Gaz',
};

/**
 * Skrócona etykieta mediów obecnych NA DZIAŁCE, np. „Prąd, Woda".
 * `null`, gdy żadne medium nie jest fizycznie na działce → karta nie pokazuje mediów.
 */
export function parcelMediaLabel(d: MediaSource | null | undefined): string | null {
  const m = getParcelMedia(d);
  const parts = (Object.keys(MEDIA_LABEL) as (keyof MediaFlags)[])
    .filter((k) => m[k])
    .map((k) => MEDIA_LABEL[k]);
  return parts.length ? parts.join(', ') : null;
}
