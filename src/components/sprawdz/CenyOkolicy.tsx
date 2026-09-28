import Link from 'next/link';
import { formatIntPL, plDate } from '@/lib/format';
import { decydujCene, type CenaDecision } from '@/lib/raportCena';
import { rcnRozjechane, RCN_MIESIECY, RCN_PROMIENIE, type RcnAkt, type RcnOkolica } from '@/lib/rcnStats';
import { RADIUS_LADDER, type PointValuation } from '@/lib/seoHub';
import type { AreaPriceTrend } from '@/lib/dzialkaPriceHistory';
import { Eyebrow } from './Raport';

// Ceny okolicy pod ofertą: mediana z naszych ogłoszeń obok aktów notarialnych (RCN). Wspólne dla
// raportu działki (RaportOferty) i dla ofert bez raportu (CenyOkolicySekcja), dlatego bez
// 'use client': strona oferty renderuje to na serwerze i Google dostaje liczby w HTML.
//
// Układ stały (decyzja 2026-09-28): zawsze dwie kolumny, „ile chcą" i „ile płacono". Gdy jednej
// strony brakuje, mówimy to wprost zamiast chować kolumnę, bo znikające bloki wyglądały jak błąd.
// Pod spodem jedna skala z kropką oglądanej oferty i najbliższe akty, żeby medianę dało się
// sprawdzić. Kropka to fakt, nie werdykt: nadal NIE piszemy „ta oferta jest o X% droższa" ani że
// ogłoszenia są zawyżone (pod ofertą biura uderzałoby to w naszą podaż, decyzja 2026-09-15).

// Akty spoza tego koła i tak nie przychodzą (RCN_PROMIENIE), to tylko bezpiecznik.
const RCN_MAX_PROMIEN_KM = RCN_PROMIENIE[RCN_PROMIENIE.length - 1];

export type CenyOkolicyDane = {
  wycena: PointValuation | null;
  cena: CenaDecision | null;
  rcn: RcnOkolica | null;
  trend: AreaPriceTrend | null;
  rolny: boolean;
  /** zł/m² oglądanej oferty (kropka na skali); null, gdy brak ceny albo powierzchni. */
  cenaOferty: number | null;
  /** Czy punkt to działka/pinezka (true), czy środek miejscowości; bez tego nie podajemy odległości. */
  dokladna: boolean;
};

/** Co z policzonych danych nadaje się do pokazania. `null` = sekcji nie ma (za mała próbka). */
export function cenyOkolicy(
  wycena: PointValuation | null,
  rcn: RcnOkolica | null,
  trend: AreaPriceTrend | null,
  rolny: boolean,
  cenaOferty: number | null = null,
  dokladna = true
): CenyOkolicyDane | null {
  // Pula (podobna wielkość / budowlane / rolne) i „mediana czy widełki" jak w „Sprawdź działkę"
  // (lib/raportCena.ts). `value` = null, gdy porównywalnych ofert jest za mało: wtedy milczymy.
  const cena = wycena ? decydujCene(wycena, null, rolny) : null;
  // Próg próbki i „nie mieszamy rynków" pilnuje decydujCene (audyt 2026-09-25).
  const zOfert = cena?.lead && cena.value ? cena : null;
  const rcnPokaz = rcn && rcn.promienKm <= RCN_MAX_PROMIEN_KM ? rcn : null;
  if (!zOfert && !rcnPokaz) return null;
  return {
    wycena,
    cena: zOfert,
    rcn: rcnPokaz,
    trend: zOfert ? trend : null,
    rolny,
    cenaOferty: cenaOferty && cenaOferty > 0 ? Math.round(cenaOferty) : null,
    dokladna,
  };
}

function Brak({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-7 text-fg/55">{children}</p>;
}

export default function CenyOkolicy({ dane, className = '' }: { dane: CenyOkolicyDane; className?: string }) {
  const { wycena, cena, rcn, trend, rolny, cenaOferty, dokladna } = dane;
  const rcnWidelki = !!rcn && rcnRozjechane(rcn);
  const v = cena?.value ?? null;
  // Oba źródła dostają ten sam kod gminy ze strony oferty, więc flaga wyceny mówi o obu.
  const gm = wycena?.gmina || rcn?.gmina ? 'w tej samej gminie, ' : '';
  const opisPuli =
    !wycena || !cena?.lead || !v
      ? null
      : cena.lead.kind === 'similar' && wycena.similarSizeBand
        ? `Działki od ${formatIntPL(wycena.similarSizeBand.minM2)} do ${formatIntPL(wycena.similarSizeBand.maxM2)} m² ${gm}w promieniu ${wycena.radiusKm} km, większość między ${formatIntPL(v.low)} a ${formatIntPL(v.high)} zł/m².`
        : cena.mixed
          ? `${gm ? 'W tej samej gminie, w' : 'W'} promieniu ${wycena.radiusKm} km ceny rozjeżdżają się za mocno na jedną liczbę, dlatego widełki.`
          : `${gm ? 'W tej samej gminie, w' : 'W'} promieniu ${wycena.radiusKm} km, większość między ${formatIntPL(v.low)} a ${formatIntPL(v.high)} zł/m².`;
  const zdanieTrendu = !trend
    ? null
    : Math.abs(trend.changePct) < 0.005
      ? `Ceny ofert w okolicy stoją w miejscu od ${plDate(trend.fromDate)}.`
      : `Od ${plDate(trend.fromDate)} ceny ofert w okolicy ${trend.changePct > 0 ? 'wzrosły' : 'spadły'} o ${Math.abs(
          trend.changePct * 100
        ).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}% (liczone na ${trend.sampleCount} ofertach, które wisiały wtedy i wiszą dziś).`;
  const pula = rolny ? 'działek rolnych' : 'działek budowlanych';

  const pasy: Pas[] = [];
  if (v && cena) pasy.push({ etykieta: 'Ceny w ogłoszeniach', low: v.low, high: v.high });
  if (rcn) pasy.push({ etykieta: 'Ceny zapłacone u notariusza', low: rcn.low, high: rcn.high });

  return (
    <div className={className}>
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <div className="min-w-0">
          <Eyebrow>Ile chcą sprzedający</Eyebrow>
          {v && cena?.lead ? (
            <>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[30px] font-semibold tracking-tight text-fg">
                  {cena.mixed ? `${formatIntPL(v.low)}-${formatIntPL(v.high)}` : formatIntPL(v.median)}
                </span>
                <span className="text-base font-medium text-fg/55">zł/m²</span>
                <span className="text-[12px] uppercase tracking-[0.1em] text-fg/45">{cena.lead.label}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-fg/65">
                {opisPuli} Liczone z {cena.lead.stat.sampleCount} ofert w naszym serwisie, bez tej oferty. To
                orientacja z ogłoszeń, nie operat rzeczoznawcy: konkretna działka potrafi kosztować zupełnie
                inaczej, bo decyduje dojazd, prąd i woda na działce, kształt i odległość od zabudowy.
              </p>
              {zdanieTrendu ? <p className="mt-2 text-sm leading-6 text-fg/65">{zdanieTrendu}</p> : null}
            </>
          ) : (
            <Brak>
              {gm ? 'W tej gminie, w promieniu' : 'W promieniu'} {RADIUS_LADDER[RADIUS_LADDER.length - 1]} km mamy za mało ogłoszeń {pula}, żeby
              podać uczciwą cenę.
            </Brak>
          )}
        </div>

        <div className="min-w-0">
          <Eyebrow>Ile realnie płacono</Eyebrow>
          {rcn ? (
            <>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[30px] font-semibold tracking-tight text-fg">
                  {rcnWidelki ? `${formatIntPL(rcn.low)}-${formatIntPL(rcn.high)}` : formatIntPL(rcn.medianaZlM2)}
                </span>
                <span className="text-base font-medium text-fg/55">zł/m²</span>
                <span className="text-[12px] uppercase tracking-[0.1em] text-fg/45">
                  {rcn.klasa === 'rolna' ? 'grunty rolne' : 'działki budowlane'}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-fg/65">
                {rcnWidelki ? 'Środkowa połowa z' : 'Mediana z'} {rcn.liczba} transakcji z aktów notarialnych (Rejestr Cen Nieruchomości)
                {rcn.pasmoM2
                  ? `, działki od ${formatIntPL(rcn.pasmoM2.minM2)} do ${formatIntPL(rcn.pasmoM2.maxM2)} m²,`
                  : ''}{' '}
                {gm}w promieniu {rcn.promienKm} km
                {rcn.odRoku === rcn.doRoku ? `, ${rcn.odRoku} rok` : `, lata ${rcn.odRoku}-${rcn.doRoku}`}.{' '}
                {rcnWidelki
                  ? 'Ceny w aktach rozjeżdżają się za mocno na jedną liczbę, bo w okolicy sprzedaje się grunty bardzo różnego rodzaju, dlatego widełki.'
                  : `Połowa transakcji zamknęła się między ${formatIntPL(rcn.low)} a ${formatIntPL(rcn.high)} zł/m².`}
              </p>
            </>
          ) : (
            <Brak>
              {gm ? 'W tej gminie, w promieniu' : 'W promieniu'} {RCN_MAX_PROMIEN_KM} km mamy za mało aktów notarialnych {pula} z ostatnich{' '}
              {RCN_MIESIECY / 12} lat, żeby podać uczciwą liczbę.
            </Brak>
          )}
        </div>
      </div>

      {pasy.length ? <Skala pasy={pasy} cenaOferty={cenaOferty} /> : null}
      {rcn?.najblizsze?.length ? <NajblizszeAkty akty={rcn.najblizsze} dokladna={dokladna} /> : null}
    </div>
  );
}

type Pas = { etykieta: string; low: number; high: number };

// Skala od zera: długość paska to proporcja ceny, więc „dwa razy dalej" znaczy „dwa razy drożej".
// Celowo bez median, percentyli i osi (uwaga Pauli 2026-09-28: pierwsza wersja była czytelna dla
// wprawnych, nie dla każdego). Zostają trzy rzeczy: gdzie zwykle są ceny (pasek z kwotami na
// końcach), gdzie jest ta oferta (kropka) i jedno zdanie, jak to czytać.
const POZA_SKALA = 2.5;

// Podpis przy samej krawędzi wyjechałby poza ekran telefonu, więc tam kotwiczymy go do brzegu.
const kotwica = (pct: number) => (pct < 10 ? '' : pct > 90 ? '-translate-x-full' : '-translate-x-1/2');

export function Skala({ pasy, cenaOferty }: { pasy: Pas[]; cenaOferty: number | null }) {
  const maxPasow = Math.max(...pasy.map((p) => p.high));
  // Oferta dużo powyżej obu przedziałów zgniotłaby paski w kreskę przy lewej krawędzi. Wtedy kropka
  // staje na końcu skali ze strzałką, a paski zostają czytelne.
  const poza = cenaOferty !== null && cenaOferty > maxPasow * POZA_SKALA;
  const koniec = Math.max(maxPasow, poza || cenaOferty === null ? 0 : cenaOferty) * 1.12;
  const x = (zl: number) => Math.min(100, Math.max(0, (zl / koniec) * 100));
  const ofertaX = cenaOferty === null ? null : poza ? 100 : x(cenaOferty);

  return (
    <div className="mt-10 border-t border-fg/12 pt-8">
      <Eyebrow>{cenaOferty !== null ? 'Gdzie wypada ta oferta' : 'Typowe ceny w okolicy'}</Eyebrow>
      {cenaOferty !== null ? (
        <p className="mt-3 flex items-center gap-2 text-[15px] text-fg">
          <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full bg-brand-bright" aria-hidden />
          Ta oferta: <span className="font-semibold">{formatIntPL(cenaOferty)} zł/m²</span>
        </p>
      ) : null}

      <div className="mt-6 max-w-3xl space-y-7">
        {pasy.map((p) => (
          <div key={p.etykieta}>
            <div className="text-sm text-fg/70">{p.etykieta}</div>
            <div className="relative mt-2 h-4">
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-fg/8" />
              <div
                className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-brand-bright/35"
                style={{ left: `${x(p.low)}%`, width: `${Math.max(x(p.high) - x(p.low), 1)}%` }}
              />
              {ofertaX !== null ? (
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-brand-bright"
                  style={{ left: `${ofertaX}%` }}
                />
              ) : null}
            </div>
            {/* Kwoty pod końcami zielonego paska: to one są treścią, nie oś liczbowa. */}
            <div className="relative mt-1.5 h-5 text-xs font-medium text-fg/70">
              <span className={`absolute whitespace-nowrap ${kotwica(x(p.low))}`} style={{ left: `${x(p.low)}%` }}>
                {formatIntPL(p.low)} zł/m²
              </span>
              <span className={`absolute whitespace-nowrap ${kotwica(x(p.high))}`} style={{ left: `${x(p.high)}%` }}>
                {formatIntPL(p.high)} zł/m²
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-6 text-fg/60">
        Zielony pasek pokazuje, w jakich cenach za metr mieści się większość działek w okolicy.
        {cenaOferty !== null ? ' Kropka to cena tej działki.' : ''}
        {poza ? ' Ta oferta jest daleko poza paskiem, dlatego kropka stoi na samym końcu.' : ''}
      </p>
    </div>
  );
}

// ISO -> „02.2025". Ręcznie, nie toLocaleDateString: RaportOferty renderuje się też w przeglądarce
// i inny zapis daty na serwerze i u klienta rozjechałby hydratację.
function miesiacRok(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}.${m[1]}` : iso;
}

function odleglosc(km: number): string {
  return km < 1 ? 'do 1 km' : `${String(Math.round(km * 10) / 10).replace('.', ',')} km`;
}

// Najbliższe akty z tej samej puli, z której liczymy medianę. Jak „sprzedane w pobliżu" na dużych
// portalach: liczbę da się sprawdzić. Zwinięte (natywne <details>, działa bez JS i zostaje w HTML
// dla Google), bo większości wystarczy liczba, a lista jest dla dociekliwych.
// Odległość tylko przy dokładnej lokalizacji: przy przybliżonej liczylibyśmy ją od środka
// miejscowości, a „2,1 km" sugerowałoby precyzję, której nie mamy.
function NajblizszeAkty({ akty, dokladna }: { akty: RcnAkt[]; dokladna: boolean }) {
  return (
    <details className="group mt-8 max-w-3xl border-t border-fg/12 pt-6">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-medium text-fg/80 hover:text-fg [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition group-open:rotate-90" aria-hidden>
          ›
        </span>
        <span className="group-open:hidden">Pokaż {akty.length} najbliższych transakcji</span>
        <span className="hidden group-open:inline">Najbliższe transakcje</span>
      </summary>
      <div className="mt-4 border-t border-fg/10">
        {akty.map((a, i) => (
          <div
            key={`${a.data}-${a.cenaPln}-${i}`}
            className={`grid items-baseline gap-x-4 border-b border-fg/10 py-2.5 text-sm ${
              dokladna
                ? 'grid-cols-[4.5rem_1fr_auto] sm:grid-cols-[5rem_7rem_8rem_1fr_auto]'
                : 'grid-cols-[4.5rem_1fr_auto] sm:grid-cols-[5rem_7rem_1fr_auto]'
            }`}
          >
            <span className="text-fg/55">{miesiacRok(a.data)}</span>
            <span className="text-fg/75">{formatIntPL(a.powierzchniaM2)} m²</span>
            <span className="hidden text-fg/75 sm:block">{formatIntPL(a.cenaPln)} zł</span>
            {dokladna ? <span className="hidden text-right text-fg/45 sm:block">{odleglosc(a.km)}</span> : null}
            <span className="text-right font-medium text-fg">{formatIntPL(a.zlM2)} zł/m²</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-6 text-fg/50">
        Kwoty z aktów notarialnych za całe działki niezabudowane, sprzedane na wolnym rynku
        {dokladna ? ', odległość w linii prostej od działki.' : '.'}
      </p>
    </details>
  );
}

// Sekcja pod ofertą BEZ raportu działki (ok. 90% ofert: nie znamy numeru działki). Liczymy od
// punktu oferty, który przy lokalizacji przybliżonej jest środkiem miejscowości, dlatego drabinki
// promieni zaczynają się od 3 km (wycena) i 5 km (akty), a stopka mówi, od czego liczymy.
export function CenyOkolicySekcja({
  dane,
  miejsce,
  przyblizona,
}: {
  dane: CenyOkolicyDane;
  miejsce: string | null;
  przyblizona: boolean;
}) {
  return (
    <section id="ceny-okolicy" aria-labelledby="ceny-okolicy-tytul" className="scroll-mt-24 border-t border-fg/5">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="text-[12px] uppercase tracking-[0.16em] text-brand-bright">Ceny działek</div>
        <h2 id="ceny-okolicy-tytul" className="mt-2 text-2xl font-semibold tracking-tight text-fg md:text-3xl">
          {miejsce ? `${miejsce} i okolice` : 'Ceny działek w okolicy'}
        </h2>

        <CenyOkolicy dane={dane} className="mt-8 border-t border-fg/12 pt-8" />

        <p className="mt-10 max-w-3xl text-xs leading-6 text-fg/45">
          {przyblizona
            ? 'Ogłoszenie podaje tylko miejscowość, więc promień liczymy od jej środka.'
            : 'Promień i odległości liczymy od miejsca oferty na mapie.'}{' '}
          Ceny liczone na bieżąco z ogłoszeń w naszym serwisie i z Rejestru Cen Nieruchomości.{' '}
          <Link href="/sprawdz-dzialke" className="text-fg/70 underline decoration-1 underline-offset-2 hover:text-fg">
            Sprawdź konkretną działkę
          </Link>
        </p>
      </div>
    </section>
  );
}
