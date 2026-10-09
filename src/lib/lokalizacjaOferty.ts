// Lokalizacja oferty do wyświetlenia. Feedy CRM podają miejscowość wersalikami („NOWA WIEŚ",
// „BROGI"), a gminę i powiat mamy osobno z geokodowania (adminGmina/adminPowiat/adminWoj).
// Poprawiamy tylko wyświetlanie, dane w bazie zostają takie, jak przyszły z feedu.

/** Słowo wersalikami → „Nowa Wieś". Tekst z małymi literami zostawiamy, jak go wpisano. */
function ladnySegment(s: string): string {
  const t = s.trim();
  if (!/\p{L}/u.test(t) || t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .replace(/(^|[\s(-])(\p{L})/gu, (_m, przed: string, litera: string) => przed + litera.toUpperCase());
}

/** „NOWA WIEŚ, Nowa wieś" → „Nowa Wieś". Każdy człon osobno, bez powtórzeń. */
export function ladnaLokalizacja(label?: string | null): string {
  const czesci = (label ?? '')
    .split(',')
    .map(ladnySegment)
    .filter(Boolean);
  const widziane = new Set<string>();
  const wynik: string[] = [];
  for (const c of czesci) {
    const klucz = c.toLowerCase();
    if (widziane.has(klucz)) continue;
    widziane.add(klucz);
    wynik.push(c);
  }
  return wynik.join(', ');
}

function bezDopisku(nazwa: string): string {
  // „Człuchów (miasto)", „Bełżyce (gw)" → sama nazwa.
  return nazwa.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Linia pod tytułem oferty: „Nowa Wieś, gm. Pasłęk, pow. elbląski, woj. warmińsko-mazurskie".
 * Gminę i powiat pomijamy, gdy powtarzają miejscowość (miasto na prawach gminy/powiatu).
 */
export function pelnaLokalizacja(o: {
  label?: string | null;
  gmina?: string | null;
  powiat?: string | null;
  woj?: string | null;
}): string {
  const miejsce = ladnaLokalizacja(o.label);
  const miejsceKlucz = miejsce.toLowerCase();
  const czesci: string[] = miejsce ? [miejsce] : [];

  const gmina = o.gmina ? ladnySegment(bezDopisku(o.gmina)) : '';
  if (gmina && !miejsceKlucz.split(', ').includes(gmina.toLowerCase())) {
    czesci.push(`gm. ${gmina}`);
  }

  const powiat = o.powiat ? bezDopisku(o.powiat).replace(/^powiat\s+/i, '').trim() : '';
  if (powiat) {
    const p = ladnySegment(powiat);
    // Miasto na prawach powiatu („powiat m. Kraków", „Kraków") nie potrzebuje dopisku.
    const czyMiasto = /^m\.\s*/i.test(p) || miejsceKlucz.split(', ').includes(p.toLowerCase());
    if (!czyMiasto) czesci.push(`pow. ${p}`);
  }

  const woj = (o.woj ?? '').trim().toLowerCase();
  if (woj) czesci.push(`woj. ${woj}`);

  return czesci.join(', ');
}
