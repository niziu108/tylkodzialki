// Silnik raportu „Dane rynkowe" (/admin/rynek).
//
// Trzy rzeczy, których nie ma nikt inny w Polsce dla gruntów, bo wymagają zbierania w czasie:
//   1. czas sprzedaży działki (jak długo oferta wisi, zanim zejdzie),
//   2. obniżki cen w trakcie wiszenia,
//   3. gęstość i poziom cen podaży w danym regionie.
// Punkt 3 mamy od ręki, 1 i 2 dopiero się zbierają. Raport pokazuje je od razu, ale z uczciwą
// informacją, ile obserwacji za tym stoi. Liczba bez próby jest gorsza niż brak liczby: pójdzie
// na posta i będzie nas obciążać przez lata.

import { prisma } from "@/lib/prisma";
import { adminOf } from "@/lib/seoPowiaty";
import { getSeoRegion } from "@/lib/seo-locations";
import { SPELL_TRUSTED_FROM } from "@/lib/listing-spells";

// Poniżej tylu obserwacji nie pokazujemy mediany, tylko „za mało danych".
export const MIN_PROBA = 20;
// Poniżej tylu dni obserwacji mediana czasu sprzedaży jest z definicji zaniżona: w krótkim oknie
// widać wyłącznie oferty, które zeszły szybko. Te, które wiszą, jeszcze się nie policzyły.
export const MIN_OKNO_DNI = 90;

const DAY = 24 * 60 * 60 * 1000;

export type MedianaRow = {
  klucz: string;
  etykieta: string;
  n: number;
  medianaDni: number | null;
};

export type PodazRow = {
  wojSlug: string;
  etykieta: string;
  aktywne: number;
  medianaPpm2: number | null;
  medianaCena: number | null;
  medianaPow: number | null;
};

export type ObnizkaRow = {
  dzialkaId: string;
  tytul: string;
  locationLabel: string | null;
  cenaOd: number;
  cenaDo: number;
  zmianaPct: number;
  powierzchniaM2: number;
};

export type RynekReport = {
  podsumowanie: {
    aktywne: number;
    epizodyOtwarte: number;
    epizodyZamkniete: number;
    obserwacje: number;
    oknoOd: Date | null;
    oknoDni: number;
    snapshotyOd: Date | null;
    snapshotyRekordow: number;
    snapshotyDzialek: number;
  };
  czasSprzedazy: {
    // `ogolem` jest null, dopóki próba nie zasługuje na publikację. `surowa` jest policzona
    // zawsze i służy wyłącznie do podglądu w panelu, żeby było widać, czy licznik w ogóle chodzi.
    ogolem: number | null;
    surowa: number | null;
    n: number;
    wiarygodny: boolean;
    powod: string | null;
    wgWojewodztw: MedianaRow[];
    wgCeny: MedianaRow[];
    wgWielkosci: MedianaRow[];
  };
  obnizki: {
    obserwowanych: number;
    zeZmiana: number;
    medianaZmianyPct: number | null;
    najwieksze: ObnizkaRow[];
  };
  podaz: PodazRow[];
};

function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

function wojEtykieta(slug: string): string {
  return getSeoRegion(slug)?.name ?? slug;
}

const PRZEDZIALY_CENY: Array<{ etykieta: string; do: number }> = [
  { etykieta: "do 100 tys.", do: 100_000 },
  { etykieta: "100 do 200 tys.", do: 200_000 },
  { etykieta: "200 do 400 tys.", do: 400_000 },
  { etykieta: "400 tys. i więcej", do: Infinity },
];

const PRZEDZIALY_POW: Array<{ etykieta: string; do: number }> = [
  { etykieta: "do 800 m²", do: 800 },
  { etykieta: "800 do 1500 m²", do: 1500 },
  { etykieta: "1500 do 3000 m²", do: 3000 },
  { etykieta: "3000 m² i więcej", do: Infinity },
];

function grupuj<T>(
  items: T[],
  przedzialy: Array<{ etykieta: string; do: number }>,
  wartosc: (t: T) => number,
  dni: (t: T) => number,
): MedianaRow[] {
  return przedzialy.map((p, idx) => {
    const dolna = idx === 0 ? -Infinity : przedzialy[idx - 1].do;
    const wybrane = items.filter((t) => wartosc(t) > dolna && wartosc(t) <= p.do);
    const d = wybrane.map(dni);
    return {
      klucz: p.etykieta,
      etykieta: p.etykieta,
      n: wybrane.length,
      medianaDni: d.length >= MIN_PROBA ? mediana(d) : null,
    };
  });
}

export async function getRynekReport(): Promise<RynekReport> {
  const [aktywne, otwarte, zamkniete, zamknieteWiarygodne, snapAgg, podazRaw, obnizkiRaw] =
    await Promise.all([
      prisma.dzialka.count({ where: { status: "AKTYWNE" } }),
      prisma.dzialkaListingSpell.count({ where: { endedAt: null } }),
      prisma.dzialkaListingSpell.count({ where: { endedAt: { not: null } } }),
      prisma.dzialkaListingSpell.findMany({
        where: { endedAt: { not: null }, reliable: true },
        select: {
          startedAt: true,
          endedAt: true,
          cenaStart: true,
          cenaEnd: true,
          powierzchniaM2: true,
          dzialka: { select: { locationFull: true, adminWoj: true, adminPowiat: true } },
        },
      }),
      prisma.$queryRaw<Array<{ rekordow: bigint; dzialek: bigint; od: Date | null }>>`
        SELECT COUNT(*)::bigint AS rekordow,
               COUNT(DISTINCT "dzialkaId")::bigint AS dzialek,
               MIN(date) AS od
        FROM "DzialkaPriceSnapshot"`,
      prisma.dzialka.findMany({
        where: { status: "AKTYWNE", powierzchniaM2: { gt: 0 } },
        select: {
          cenaPln: true,
          powierzchniaM2: true,
          locationFull: true,
          adminWoj: true,
          adminPowiat: true,
        },
      }),
      // Działki, których cena zmieniła się od pierwszego snapshotu. Bierzemy pierwszą i ostatnią
      // obserwację, a nie min/max: interesuje nas kierunek, w którym poszedł sprzedający.
      prisma.$queryRaw<
        Array<{
          dzialkaId: string;
          pierwsza: number;
          ostatnia: number;
          tytul: string;
          locationLabel: string | null;
          powierzchniaM2: number;
          status: string;
        }>
      >`
        WITH agg AS (
          SELECT "dzialkaId",
                 (array_agg("cenaPln" ORDER BY date ASC))[1]  AS pierwsza,
                 (array_agg("cenaPln" ORDER BY date DESC))[1] AS ostatnia
          FROM "DzialkaPriceSnapshot"
          GROUP BY "dzialkaId"
        )
        SELECT a."dzialkaId", a.pierwsza, a.ostatnia,
               d.tytul, d."locationLabel", d."powierzchniaM2", d.status::text AS status
        FROM agg a
        JOIN "Dzialka" d ON d.id = a."dzialkaId"
        WHERE a.pierwsza <> a.ostatnia`,
    ]);

  const snap = snapAgg[0];

  // Czas sprzedaży liczymy wyłącznie z epizodów wiarygodnych: zmierzonych, nie odtworzonych.
  const obs = zamknieteWiarygodne.map((s) => ({
    dni: (s.endedAt!.getTime() - s.startedAt.getTime()) / DAY,
    cena: s.cenaEnd ?? s.cenaStart,
    pow: s.powierzchniaM2,
    woj: adminOf(s.dzialka)?.wojSlug ?? null,
  }));

  const oknoOd = zamknieteWiarygodne.length
    ? zamknieteWiarygodne.reduce(
        (min, s) => (s.endedAt! < min ? s.endedAt! : min),
        zamknieteWiarygodne[0].endedAt!,
      )
    : null;
  const oknoDni = Math.max(0, Math.round((Date.now() - SPELL_TRUSTED_FROM.getTime()) / DAY));

  const wgWoj = new Map<string, number[]>();
  for (const o of obs) {
    if (!o.woj) continue;
    const arr = wgWoj.get(o.woj) ?? [];
    arr.push(o.dni);
    wgWoj.set(o.woj, arr);
  }

  const wgWojewodztw: MedianaRow[] = [...wgWoj.entries()]
    .map(([slug, dni]) => ({
      klucz: slug,
      etykieta: wojEtykieta(slug),
      n: dni.length,
      medianaDni: dni.length >= MIN_PROBA ? mediana(dni) : null,
    }))
    .sort((a, b) => b.n - a.n);

  let powod: string | null = null;
  if (obs.length < MIN_PROBA) {
    powod = `Za mało zamkniętych ofert: ${obs.length} z ${MIN_PROBA} potrzebnych.`;
  } else if (oknoDni < MIN_OKNO_DNI) {
    powod =
      `Okno obserwacji to dopiero ${oknoDni} dni. W tak krótkim oknie widać głównie oferty, ` +
      `które zeszły szybko, więc mediana jest zaniżona. Wiarygodna od ${MIN_OKNO_DNI} dni.`;
  }

  // Podaż: mediany liczone na aktywnych ofertach, per województwo. Te dane są kompletne od dziś.
  const podazMap = new Map<string, { ppm2: number[]; cena: number[]; pow: number[] }>();
  for (const d of podazRaw) {
    const woj = adminOf(d)?.wojSlug;
    if (!woj) continue;
    const e = podazMap.get(woj) ?? { ppm2: [], cena: [], pow: [] };
    e.ppm2.push(d.cenaPln / d.powierzchniaM2);
    e.cena.push(d.cenaPln);
    e.pow.push(d.powierzchniaM2);
    podazMap.set(woj, e);
  }

  const podaz: PodazRow[] = [...podazMap.entries()]
    .map(([slug, e]) => ({
      wojSlug: slug,
      etykieta: wojEtykieta(slug),
      aktywne: e.cena.length,
      medianaPpm2: mediana(e.ppm2),
      medianaCena: mediana(e.cena),
      medianaPow: mediana(e.pow),
    }))
    .sort((a, b) => b.aktywne - a.aktywne);

  const zmiany = obnizkiRaw.map((r) => ({
    dzialkaId: r.dzialkaId,
    tytul: r.tytul,
    locationLabel: r.locationLabel,
    cenaOd: r.pierwsza,
    cenaDo: r.ostatnia,
    zmianaPct: ((r.ostatnia - r.pierwsza) / r.pierwsza) * 100,
    powierzchniaM2: r.powierzchniaM2,
  }));

  return {
    podsumowanie: {
      aktywne,
      epizodyOtwarte: otwarte,
      epizodyZamkniete: zamkniete,
      obserwacje: obs.length,
      oknoOd,
      oknoDni,
      snapshotyOd: snap?.od ?? null,
      snapshotyRekordow: Number(snap?.rekordow ?? 0),
      snapshotyDzialek: Number(snap?.dzialek ?? 0),
    },
    czasSprzedazy: {
      ogolem: powod === null ? mediana(obs.map((o) => o.dni)) : null,
      surowa: mediana(obs.map((o) => o.dni)),
      n: obs.length,
      wiarygodny: powod === null,
      powod,
      wgWojewodztw,
      wgCeny: grupuj(
        obs,
        PRZEDZIALY_CENY,
        (o) => o.cena,
        (o) => o.dni,
      ),
      wgWielkosci: grupuj(
        obs,
        PRZEDZIALY_POW,
        (o) => o.pow,
        (o) => o.dni,
      ),
    },
    obnizki: {
      obserwowanych: Number(snap?.dzialek ?? 0),
      zeZmiana: zmiany.length,
      medianaZmianyPct: mediana(zmiany.map((z) => z.zmianaPct)),
      najwieksze: zmiany.sort((a, b) => a.zmianaPct - b.zmianaPct).slice(0, 15),
    },
    podaz,
  };
}
