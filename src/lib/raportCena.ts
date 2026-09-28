// Wybór liczby, którą prowadzimy w raporcie „Sprawdź działkę".
//
// Trzymane osobno od komponentu, bo to reguła produktowa (którą pulę porównawczą prowadzimy i
// kiedy milczymy), a nie warstwa widoku — i da się ją testować bez renderowania raportu
// ([[project-sprawdz-dzialke]]).

import type { MpzpInfo } from './mpzp';
import { isWideSpread, MIN_OFERT_DO_CENY, type PointValuation, type PriceStat, type RangeStat } from './seoHub';

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

// Pula cenowa oferty z przeznaczenia wpisanego w ogłoszeniu. Porównujemy dwa rynki, dla których
// mamy uczciwą pulę: działka pod dom (BUDOWLANA, SIEDLISKOWA) i grunt rolny/leśny (bez zabudowy).
// `null` = nie porównujemy wcale (audyt 8360 ofert, 2026-09-28): INWESTYCYJNA to usługi, handel,
// przemysł i grunty pod deweloperkę (w centrach po 1000-16 000 zł/m²), a sama REKREACYJNA to
// ogródki i letniska. Pod działką usługową w Olkuszu wisiał pasek działek pod dom i kropka 11x za
// nim. Tak samo pusta lista przeznaczeń: nie wiemy, co to za grunt.
export type PulaOferty = 'rolna' | 'budowlana';
export function klasaZPrzeznaczen(przeznaczenia: readonly string[] | null | undefined): PulaOferty | null {
  const p = przeznaczenia ?? [];
  if (p.includes('INWESTYCYJNA')) return null;
  if (p.includes('BUDOWLANA') || p.includes('SIEDLISKOWA')) return 'budowlana';
  if (p.includes('ROLNA') || p.includes('LESNA')) return 'rolna';
  return null;
}

// Próg 8 ogłoszeń (audyt 2026-09-25) mieszka w seoHub, bo tym samym progiem wycena dobiera promień.
export { MIN_OFERT_DO_CENY };

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
