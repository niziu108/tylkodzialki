// Wybór liczby, którą prowadzimy w raporcie „Sprawdź działkę".
//
// Jedno źródło prawdy dla ekranu (components/sprawdz/Raport.tsx) i pliku PDF
// (lib/raportPdf.ts). Gdy te dwa rozjadą się choć raz, użytkownik dostanie na papierze inną
// cenę niż widział na ekranie i przestanie ufać obu ([[project-sprawdz-dzialke]]).

import type { MpzpInfo } from './mpzp';
import { isFarAndThin, isWideSpread, type PointValuation, type PriceStat, type RangeStat } from './seoHub';

export type LeadKind = 'similar' | 'type';

export type Lead = { label: string; stat: PriceStat; kind: LeadKind };

export type CenaDecision = {
  lead: Lead | null;
  // mediana/zakres do pokazania; null = milczymy (za mało porównywalnych działek)
  value: RangeStat | null;
  // true = prowadzimy widełkami zamiast mediany (dwa rynki w próbce, niezawężonej wielkością)
  mixed: boolean;
};

// Czy plan wskazuje grunt rolny/leśny. Wtedy raport prowadzi medianą działek rolnych —
// porównywanie pola uprawnego do budowlanych sąsiadów zawyża tak samo, jak odwrotnie zaniżało.
// Konserwatywnie: „zabudowa zagrodowa w gospodarstwach rolnych" to wciąż teren pod budowę.
export function looksRolny(mpzp: MpzpInfo | null): boolean {
  if (!mpzp) return false;
  const symbol = (mpzp.functionSymbol ?? '').trim().toUpperCase();
  if (/^(R|RP|RL|ZL|ZR)\d*$/.test(symbol)) return true;
  const name = (mpzp.functionName ?? '').toLowerCase();
  if (!name || /zabudow/.test(name)) return false;
  return /roln|leśn|lesn|upraw|grunt orn/.test(name);
}

// Kolejność: najpierw działki ZBLIŻONEJ WIELKOŚCI, bo to największe źródło rozrzutu w okolicy
// (za metr działki pod dom płaci się kilka razy tyle co za metr wielohektarowego pola). Dopiero
// gdy podobnych brakuje, schodzimy do „wszystkie budowlane".
export function pickLead(valuation: PointValuation, mpzp: MpzpInfo | null): Lead | null {
  const sim: Lead = {
    label: 'działki podobnej wielkości',
    stat: valuation.similarSize,
    kind: 'similar',
  };
  const bud: Lead = { label: 'działki budowlane', stat: valuation.budowlana, kind: 'type' };
  const rol: Lead = { label: 'działki rolne', stat: valuation.rolna, kind: 'type' };
  const order = looksRolny(mpzp) ? [rol, bud] : [sim, bud, rol];

  for (const cand of order) if (cand.stat.pricePerM2) return cand;
  if (valuation.pricePerM2) {
    return {
      label: 'wszystkie typy działek',
      stat: { pricePerM2: valuation.pricePerM2, sampleCount: valuation.sampleCount },
      kind: 'type',
    };
  }
  return null;
}

export function decydujCene(valuation: PointValuation, mpzp: MpzpInfo | null): CenaDecision {
  const lead = pickLead(valuation, mpzp);
  // Gate pewności: gdy compary zebrały się dopiero na największym kole i jest ich mało, nie
  // prowadzimy liczbą — spada do gałęzi „za mało porównywalnych działek".
  const farThin = lead ? isFarAndThin(valuation.radiusKm, lead.stat.sampleCount) : false;
  const value = farThin ? null : lead?.stat.pricePerM2 ?? null;
  // Widełki zamiast mediany tylko wtedy, gdy próbka NIE jest zawężona do podobnych działek.
  // Przy zawężonej mediana jest uczciwa, bo z rozrzutu wypadł jego największy składnik.
  const mixed = isWideSpread(value) && lead?.kind !== 'similar';
  return { lead, value, mixed };
}
