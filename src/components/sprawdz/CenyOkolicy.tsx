import Link from 'next/link';
import { formatIntPL, plDate } from '@/lib/format';
import { decydujCene, type CenaDecision } from '@/lib/raportCena';
import type { RcnOkolica } from '@/lib/rcnStats';
import type { PointValuation } from '@/lib/seoHub';
import type { AreaPriceTrend } from '@/lib/dzialkaPriceHistory';
import { Eyebrow } from './Raport';

// Ceny okolicy pod ofertą: mediana z naszych ogłoszeń obok aktów notarialnych (RCN). Wspólne dla
// raportu działki (RaportOferty) i dla ofert bez raportu (CenyOkolicySekcja), dlatego bez
// 'use client': strona oferty renderuje to na serwerze i Google dostaje liczby w HTML.
//
// Dane tak, komentarz nie: NIE ma „ta oferta jest o X% droższa" ani zdania, że ogłoszenia są
// zawyżone względem aktów. Taki werdykt pod ofertą biura uderzałby w naszą podaż, a kupujący i tak
// widzi obie liczby obok siebie (decyzja 2026-09-15). Zawsze podajemy promień, próbkę i lata.

// Przy takim promieniu w próbce siedzą już inne miejscowości; pod konkretną ofertą to myli.
const RCN_MAX_PROMIEN_KM = 35;

export type CenyOkolicyDane = {
  wycena: PointValuation | null;
  cena: CenaDecision | null;
  rcn: RcnOkolica | null;
  trend: AreaPriceTrend | null;
};

/** Co z policzonych danych nadaje się do pokazania. `null` = sekcji nie ma (za mała próbka). */
export function cenyOkolicy(
  wycena: PointValuation | null,
  rcn: RcnOkolica | null,
  trend: AreaPriceTrend | null,
  rolny: boolean
): CenyOkolicyDane | null {
  // Pula (podobna wielkość / budowlane / rolne) i „mediana czy widełki" jak w „Sprawdź działkę"
  // (lib/raportCena.ts). `value` = null, gdy porównywalnych ofert jest za mało: wtedy milczymy.
  const cena = wycena ? decydujCene(wycena, null, rolny) : null;
  const zOfert = cena?.lead && cena.value ? cena : null;
  const rcnPokaz = rcn && rcn.promienKm < RCN_MAX_PROMIEN_KM ? rcn : null;
  if (!zOfert && !rcnPokaz) return null;
  return { wycena, cena: zOfert, rcn: rcnPokaz, trend: zOfert ? trend : null };
}

export default function CenyOkolicy({ dane, className = '' }: { dane: CenyOkolicyDane; className?: string }) {
  const { wycena, cena, rcn, trend } = dane;
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

  return (
    <div className={`grid gap-x-12 gap-y-8 lg:grid-cols-2 ${className}`}>
      {v && cena?.lead ? (
        <div className="min-w-0">
          <Eyebrow>Orientacyjna cena okolicy</Eyebrow>
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
        </div>
      ) : null}

      {rcn ? (
        <div className="min-w-0">
          <Eyebrow>Ile realnie płacono w okolicy</Eyebrow>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
            <span className="text-[30px] font-semibold tracking-tight text-fg">{formatIntPL(rcn.medianaZlM2)}</span>
            <span className="text-base font-medium text-fg/55">zł/m²</span>
            <span className="text-[12px] uppercase tracking-[0.1em] text-fg/45">
              {rcn.klasa === 'rolna' ? 'grunty rolne' : 'działki budowlane'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-fg/65">
            Mediana z {rcn.liczba} transakcji z aktów notarialnych (Rejestr Cen Nieruchomości) w promieniu{' '}
            {rcn.promienKm} km
            {rcn.odRoku === rcn.doRoku ? `, ${rcn.odRoku} rok` : `, lata ${rcn.odRoku}-${rcn.doRoku}`}. Połowa
            transakcji zamknęła się między {formatIntPL(rcn.low)} a {formatIntPL(rcn.high)} zł/m².
          </p>
        </div>
      ) : null}
    </div>
  );
}

// Sekcja pod ofertą BEZ raportu działki (ok. 90% ofert: nie znamy numeru działki). Liczymy od
// punktu oferty, który przy lokalizacji przybliżonej jest środkiem miejscowości, dlatego drabinki
// promieni zaczynają się od 3 km (wycena) i 10 km (akty), a stopka mówi, od czego liczymy.
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
          Ile kosztują działki w okolicy
        </h2>
        {miejsce ? <p className="mt-2 text-[15px] text-fg/65">{miejsce} i okolice</p> : null}

        <CenyOkolicy dane={dane} className="mt-8 border-t border-fg/12 pt-8" />

        <p className="mt-10 max-w-3xl text-xs leading-6 text-fg/45">
          {przyblizona
            ? 'Ogłoszenie podaje tylko miejscowość, więc promień liczymy od jej środka.'
            : 'Promień liczymy od miejsca oferty na mapie.'}{' '}
          Ceny liczone na bieżąco z ogłoszeń w naszym serwisie i z Rejestru Cen Nieruchomości.{' '}
          <Link href="/sprawdz-dzialke" className="text-fg/70 underline decoration-1 underline-offset-2 hover:text-fg">
            Sprawdź konkretną działkę
          </Link>
        </p>
      </div>
    </section>
  );
}
