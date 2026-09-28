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
};

/** Co z policzonych danych nadaje się do pokazania. `null` = sekcji nie ma (za mała próbka). */
export function cenyOkolicy(
  wycena: PointValuation | null,
  rcn: RcnOkolica | null,
  trend: AreaPriceTrend | null,
  rolny: boolean,
  cenaOferty: number | null = null
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
  };
}

function Brak({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-7 text-fg/55">{children}</p>;
}

export default function CenyOkolicy({ dane, className = '' }: { dane: CenyOkolicyDane; className?: string }) {
  const { wycena, cena, rcn, trend, rolny, cenaOferty } = dane;
  const rcnWidelki = !!rcn && rcnRozjechane(rcn);
  const v = cena?.value ?? null;
  const opisPuli =
    !wycena || !cena?.lead || !v
      ? null
      : cena.lead.kind === 'similar' && wycena.similarSizeBand
        ? `Działki od ${formatIntPL(wycena.similarSizeBand.minM2)} do ${formatIntPL(wycena.similarSizeBand.maxM2)} m² w promieniu ${wycena.radiusKm} km, większość między ${formatIntPL(v.low)} a ${formatIntPL(v.high)} zł/m².`
        : cena.mixed
          ? `W promieniu ${wycena.radiusKm} km ceny rozjeżdżają się za mocno na jedną liczbę, dlatego widełki.`
          : `W promieniu ${wycena.radiusKm} km, większość między ${formatIntPL(v.low)} a ${formatIntPL(v.high)} zł/m².`;
  const zdanieTrendu = !trend
    ? null
    : Math.abs(trend.changePct) < 0.005
      ? `Ceny ofert w okolicy stoją w miejscu od ${plDate(trend.fromDate)}.`
      : `Od ${plDate(trend.fromDate)} ceny ofert w okolicy ${trend.changePct > 0 ? 'wzrosły' : 'spadły'} o ${Math.abs(
          trend.changePct * 100
        ).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}% (liczone na ${trend.sampleCount} ofertach, które wisiały wtedy i wiszą dziś).`;
  const pula = rolny ? 'działek rolnych' : 'działek budowlanych';

  const pasy: Pas[] = [];
  if (v && cena) pasy.push({ etykieta: 'Ogłoszenia', low: v.low, high: v.high, mediana: cena.mixed ? null : v.median });
  if (rcn) pasy.push({ etykieta: 'Akty notarialne', low: rcn.low, high: rcn.high, mediana: rcnWidelki ? null : rcn.medianaZlM2 });

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
              W promieniu {RADIUS_LADDER[RADIUS_LADDER.length - 1]} km mamy za mało ogłoszeń {pula}, żeby
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
                w promieniu {rcn.promienKm} km
                {rcn.odRoku === rcn.doRoku ? `, ${rcn.odRoku} rok` : `, lata ${rcn.odRoku}-${rcn.doRoku}`}.{' '}
                {rcnWidelki
                  ? 'Ceny w aktach rozjeżdżają się za mocno na jedną liczbę, bo w okolicy sprzedaje się grunty bardzo różnego rodzaju, dlatego widełki.'
                  : `Połowa transakcji zamknęła się między ${formatIntPL(rcn.low)} a ${formatIntPL(rcn.high)} zł/m².`}
              </p>
            </>
          ) : (
            <Brak>
              W promieniu {RCN_MAX_PROMIEN_KM} km mamy za mało aktów notarialnych {pula} z ostatnich{' '}
              {RCN_MIESIECY / 12} lat, żeby podać uczciwą liczbę.
            </Brak>
          )}
        </div>
      </div>

      {pasy.length ? <Skala pasy={pasy} cenaOferty={cenaOferty} /> : null}
      {rcn?.najblizsze?.length ? <NajblizszeAkty akty={rcn.najblizsze} /> : null}
    </div>
  );
}

type Pas = { etykieta: string; low: number; high: number; mediana: number | null };

// Okrągły koniec skali: 187 -> 200, 1234 -> 1500. Żeby oś nie kończyła się na „193 zł/m²".
export function koniecSkali(x: number): number {
  const rzad = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1))));
  const krok = x / rzad <= 2 ? rzad / 5 : x / rzad <= 5 ? rzad / 2 : rzad;
  return Math.ceil(x / krok) * krok;
}

// Oferta dużo powyżej obu przedziałów zgniotłaby paski w kreskę przy lewej krawędzi. Wtedy kropka
// staje na końcu skali ze strzałką i swoją kwotą, a paski zostają czytelne.
const POZA_SKALA = 2.5;

// Skala od zera: długość paska to proporcja ceny, więc „dwa razy dalej" znaczy „dwa razy drożej".
function Skala({ pasy, cenaOferty }: { pasy: Pas[]; cenaOferty: number | null }) {
  const maxPasow = Math.max(...pasy.map((p) => p.high));
  const poza = cenaOferty !== null && cenaOferty > maxPasow * POZA_SKALA;
  const koniec = koniecSkali(Math.max(maxPasow, poza || cenaOferty === null ? 0 : cenaOferty) * 1.08);
  const x = (zl: number) => Math.min(100, Math.max(0, (zl / koniec) * 100));
  const ofertaX = cenaOferty === null ? null : poza ? 100 : x(cenaOferty);
  const etykietaZLewej = ofertaX !== null && ofertaX > 60;

  const wiersz = 'grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[9rem_1fr]';
  return (
    <div className="mt-10 border-t border-fg/12 pt-8">
      <Eyebrow>Na jednej skali</Eyebrow>
      <div className="mt-5 max-w-3xl space-y-2">
        {pasy.map((p) => (
          <div key={p.etykieta} className={wiersz}>
            <span className="text-sm text-fg/65">{p.etykieta}</span>
            <div className="relative h-8">
              <div className="absolute inset-x-0 top-1/2 h-px bg-fg/15" />
              <div
                className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-brand-bright/40"
                style={{ left: `${x(p.low)}%`, width: `${Math.max(x(p.high) - x(p.low), 0.8)}%` }}
              />
              {p.mediana !== null ? (
                <div
                  className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg/80"
                  style={{ left: `${x(p.mediana)}%` }}
                />
              ) : null}
              {ofertaX !== null ? (
                <div className="absolute inset-y-0 border-l border-dashed border-brand-bright" style={{ left: `${ofertaX}%` }} />
              ) : null}
            </div>
          </div>
        ))}

        {ofertaX !== null && cenaOferty !== null ? (
          <div className={wiersz}>
            <span className="text-sm font-medium text-fg">Ta oferta</span>
            <div className="relative h-8">
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-bright"
                style={{ left: `${ofertaX}%` }}
              />
              <span
                className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-semibold text-fg ${
                  etykietaZLewej ? '-translate-x-full pr-4' : 'pl-4'
                }`}
                style={{ left: `${ofertaX}%` }}
              >
                {formatIntPL(cenaOferty)} zł/m²{poza ? ' →' : ''}
              </span>
            </div>
          </div>
        ) : null}

        <div className={wiersz}>
          <span />
          <div className="flex justify-between text-xs text-fg/45">
            <span>0</span>
            <span>{formatIntPL(koniec)} zł/m²</span>
          </div>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-xs leading-6 text-fg/50">
        {[
          pasy.some((p) => p.etykieta === 'Ogłoszenia')
            ? 'Pasek ogłoszeń obejmuje środkowe 80% ofert (bez skrajnych 10% z każdej strony).'
            : null,
          pasy.some((p) => p.etykieta === 'Akty notarialne')
            ? 'Pasek aktów obejmuje środkową połowę transakcji.'
            : null,
          pasy.some((p) => p.mediana !== null) ? 'Pionowa kreska to mediana.' : null,
          poza ? 'Cena tej oferty wychodzi daleko poza skalę, dlatego kropka stoi na jej końcu.' : null,
        ]
          .filter(Boolean)
          .join(' ')}
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
// portalach: liczbę da się sprawdzić, a nie trzeba wierzyć na słowo.
function NajblizszeAkty({ akty }: { akty: RcnAkt[] }) {
  return (
    <div className="mt-10 border-t border-fg/12 pt-8">
      <Eyebrow>Najbliższe transakcje</Eyebrow>
      <div className="mt-4 max-w-3xl border-t border-fg/10">
        {akty.map((a, i) => (
          <div
            key={`${a.data}-${a.cenaPln}-${i}`}
            className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-x-4 border-b border-fg/10 py-2.5 text-sm sm:grid-cols-[5rem_7rem_8rem_1fr_auto]"
          >
            <span className="text-fg/55">{miesiacRok(a.data)}</span>
            <span className="text-fg/75">{formatIntPL(a.powierzchniaM2)} m²</span>
            <span className="hidden text-fg/75 sm:block">{formatIntPL(a.cenaPln)} zł</span>
            <span className="hidden text-right text-fg/45 sm:block">{odleglosc(a.km)}</span>
            <span className="text-right font-medium text-fg">{formatIntPL(a.zlM2)} zł/m²</span>
          </div>
        ))}
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-6 text-fg/50">
        Kwoty z aktów notarialnych za całe działki niezabudowane, sprzedane na wolnym rynku.
      </p>
    </div>
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
        <div className="text-[12px] uppercase tracking-[0.16em] text-brand-bright">Ceny w okolicy</div>
        <h2 id="ceny-okolicy-tytul" className="mt-2 text-2xl font-semibold tracking-tight text-fg md:text-3xl">
          {miejsce ? `${miejsce} i okolice` : 'Ceny działek w okolicy'}
        </h2>

        <CenyOkolicy dane={dane} className="mt-8 border-t border-fg/12 pt-8" />

        <p className="mt-10 max-w-3xl text-xs leading-6 text-fg/45">
          {przyblizona
            ? 'Ogłoszenie podaje tylko miejscowość, więc promień i odległości liczymy od jej środka.'
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
