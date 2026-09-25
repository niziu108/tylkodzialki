// Wybór liczby, którą prowadzimy w raporcie „Sprawdź działkę".
//
// Trzymane osobno od komponentu, bo to reguła produktowa (którą pulę porównawczą prowadzimy i
// kiedy milczymy), a nie warstwa widoku — i da się ją testować bez renderowania raportu
// ([[project-sprawdz-dzialke]]).

import type { MpzpInfo } from './mpzp';
import { isWideSpread, type PointValuation, type PriceStat, type RangeStat } from './seoHub';

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

// Pula cenowa oferty bez raportu działki, czyli bez planu miejscowego: z przeznaczenia wpisanego
// w ogłoszeniu. Rolna tylko wtedy, gdy ogłoszenie nie mówi nic o zabudowie (ROLNA/LEŚNA bez
// BUDOWLANEJ). Siedlisko, rekreacja i inwestycja idą do budowlanych, tak samo konserwatywnie
// jak looksRolny traktuje zabudowę zagrodową.
export function klasaZPrzeznaczen(przeznaczenia: readonly string[] | null | undefined): 'rolna' | 'budowlana' {
  const p = przeznaczenia ?? [];
  if (p.includes('BUDOWLANA')) return 'budowlana';
  return p.includes('ROLNA') || p.includes('LESNA') ? 'rolna' : 'budowlana';
}

// Ile ogłoszeń musi być w puli, żeby podać medianę i „większość między". Audyt 2026-09-25
// (150 losowych ofert): przy 4-5 ogłoszeniach cena 30 z 53 ofert wypadała poza widełki p10-p90,
// czyli zdanie „większość między" było nieprawdą. Od 8 wzwyż widełki trzymają się rynku.
// Wcześniej ten sam próg działał tylko na największym kole (isFarAndThin), teraz na każdym.
export const MIN_OFERT_DO_CENY = 8;

// Kolejność: najpierw działki ZBLIŻONEJ WIELKOŚCI, bo to największe źródło rozrzutu w okolicy
// (za metr działki pod dom płaci się kilka razy tyle co za metr wielohektarowego pola). Dopiero
// gdy podobnych brakuje, schodzimy do „wszystkie budowlane".
// Nie mieszamy rynków (audyt 2026-09-25): pod gruntem rolnym tylko ceny rolnych, pod budowlanym
// tylko budowlanych. Wcześniej brak rolnych w okolicy dawał pod polem medianę działek pod dom
// (10 z 13 rolnych ofert), a ostatnią deską była mediana „wszystkich typów", czyli obu rynków
// naraz. Podpis był prawdziwy, ale liczba wprowadzała w błąd. Brak puli = milczymy.
// `rolny` podajemy wprost tam, gdzie planu nie znamy (sekcja cen pod ofertą bez raportu działki):
// wtedy pulę wybiera przeznaczenie z ogłoszenia, patrz klasaZPrzeznaczen.
export function pickLead(
  valuation: PointValuation,
  mpzp: MpzpInfo | null,
  rolny: boolean = looksRolny(mpzp)
): Lead | null {
  const sim: Lead = {
    label: 'działki podobnej wielkości',
    stat: valuation.similarSize,
    kind: 'similar',
  };
  const bud: Lead = { label: 'działki budowlane', stat: valuation.budowlana, kind: 'type' };
  const rol: Lead = { label: 'działki rolne', stat: valuation.rolna, kind: 'type' };
  const order = rolny ? [rol] : [sim, bud];

  for (const cand of order) if (cand.stat.pricePerM2 && cand.stat.sampleCount >= MIN_OFERT_DO_CENY) return cand;
  return null;
}

export function decydujCene(
  valuation: PointValuation,
  mpzp: MpzpInfo | null,
  rolny: boolean = looksRolny(mpzp)
): CenaDecision {
  const lead = pickLead(valuation, mpzp, rolny);
  const value = lead?.stat.pricePerM2 ?? null;
  // Widełki zamiast mediany tylko wtedy, gdy próbka NIE jest zawężona do podobnych działek.
  // Przy zawężonej mediana jest uczciwa, bo z rozrzutu wypadł jego największy składnik.
  const mixed = isWideSpread(value) && lead?.kind !== 'similar';
  return { lead, value, mixed };
}
