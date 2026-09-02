'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatIntPL } from '@/lib/format';
import type { ParcelReport } from '@/lib/uldk';
import { type PointValuation, type PriceStat } from '@/lib/seoHub';
import { decydujCene } from '@/lib/raportCena';
import type { MpzpInfo } from '@/lib/mpzp';
import type { PogInfo } from '@/lib/pog';
import type { AreaPriceTrend } from '@/lib/dzialkaPriceHistory';
import type { RcnOkolica } from '@/lib/rcnStats';
import FeaturedRail from '@/components/FeaturedRail';
import type { OfferData } from '@/components/OfferCard';
import RaportMap from './RaportMap';

// P24: raport „Sprawdź działkę" — układ redakcyjny (wszystko od lewej, cienkie linie zamiast
// kafelków), zielone nagłówki. Mapa schowana za przyciskiem „Zobacz na mapie", żeby nie dominowała.
// Zero zmyślania: co niepewne, odsyłamy do źródła ([[feedback-filtry-twarde]]).

export type RaportData = {
  parcel: ParcelReport;
  valuation: PointValuation;
  mpzp: MpzpInfo | null;
  pog?: PogInfo | null;
  trend?: AreaPriceTrend | null;
  rcn?: RcnOkolica | null;
  nearby?: OfferData[];
};

const NEXT_STEPS: { href: string; label: string }[] = [
  { href: '/blog/jak-sprawdzic-mpzp-dzialki-przed-zakupem', label: 'Jak czytać plan miejscowy (MPZP)' },
  { href: '/blog/jak-sprawdzic-klase-gruntu-dzialki-przed-zakupem', label: 'Jak sprawdzić klasę gruntu' },
  { href: '/blog/jak-sprawdzic-uzbrojenie-dzialki-przed-zakupem', label: 'Jak sprawdzić uzbrojenie' },
  { href: '/blog/jak-sprawdzic-droge-dojazdowa-do-dzialki-przed-zakupem', label: 'Jak sprawdzić drogę dojazdową' },
  { href: '/blog/jak-sprawdzic-ksiege-wieczysta-dzialki-przed-zakupem', label: 'Jak sprawdzić księgę wieczystą' },
  { href: '/blog/jak-sprawdzic-dzialke-przed-zakupem', label: 'Pełna checklista przed zakupem' },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] uppercase tracking-[0.2em] text-brand-text">{children}</div>;
}

function plDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function areaLabel(m2: number): string {
  const base = `${formatIntPL(m2)} m²`;
  if (m2 >= 5000) return `${base} · ${(m2 / 10000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} ha`;
  if (m2 >= 1000) return `${base} · ${(m2 / 100).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} ar`;
  return base;
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[10rem_1fr] items-baseline gap-x-6 border-b border-fg/10 py-3 md:grid-cols-[14rem_1fr]">
      <span className="text-[13px] uppercase tracking-[0.1em] text-fg/45">{label}</span>
      <span className="text-[15px] font-medium text-fg">{value}</span>
    </div>
  );
}

// Wiersz rozbicia cenowego — renderuje się tylko, gdy podpróbka dobiła progu (pricePerM2 != null).
function PriceRow({ label, stat, sub = false }: { label: string; stat: PriceStat; sub?: boolean }) {
  if (!stat.pricePerM2) return null;
  return (
    <div className="grid grid-cols-[10rem_1fr] items-baseline gap-x-6 border-t border-fg/10 py-3 md:grid-cols-[14rem_1fr]">
      <span
        className={`text-[13px] uppercase tracking-[0.1em] text-fg/45 ${sub ? 'normal-case tracking-normal' : ''}`}
      >
        {label}
      </span>
      <span className="text-[15px] font-medium text-fg">
        {formatIntPL(stat.pricePerM2.median)} zł/m²
        <span className="ml-2 text-[13px] font-normal text-fg/45">
          z {stat.sampleCount} {stat.sampleCount === 1 ? 'oferty' : 'ofert'}
        </span>
      </span>
    </div>
  );
}

// `przyklad` = raport pokazywany jako demo pod narzędziem. Ten sam układ i te same dane, ale
// nie wolno mu udawać wyniku użytkownika: nagłówek mówi „Przykładowa działka", a kopiowanie
// linku znika (nikt nie potrzebuje wysyłać komuś linku do cudzej działki).
export default function Raport({ data, przyklad = false }: { data: RaportData; przyklad?: boolean }) {
  const { parcel, valuation, mpzp, pog, trend, rcn, nearby } = data;
  // Wybór puli i decyzja „mediana czy widełki" siedzą w lib/raportCena.ts, żeby dało się je
  // testować bez renderowania komponentu.
  const { lead, value: v, mixed } = decydujCene(valuation, mpzp);
  const [mapShown, setMapShown] = useState(false);
  const [linkSkopiowany, setLinkSkopiowany] = useState(false);

  // Link do TEGO raportu: ten sam adres strony plus numer działki. Wysyłasz go komuś i widzi
  // dokładnie to samo, bez wskazywania działki na mapie od nowa.
  async function kopiujLink() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('d', parcel.id);
      await navigator.clipboard.writeText(url.toString());
      setLinkSkopiowany(true);
      setTimeout(() => setLinkSkopiowany(false), 2500);
    } catch {
      // brak dostępu do schowka (stara przeglądarka, brak HTTPS) nie psuje raportu —
      // adres z numerem działki i tak stoi w pasku przeglądarki
    }
  }

  return (
    <div className="print-report w-full text-left">
      {/* Nagłówek wyłącznie na wydruku: kartka ma mówić, skąd pochodzi i z kiedy jest. */}
      <div className="mb-6 hidden border-b border-fg/25 pb-3 print:block">
        <div className="flex items-baseline justify-between gap-4 text-[11px] uppercase tracking-[0.18em] text-fg/60">
          <span>tylkodzialki.pl · raport działki</span>
          <span>{new Date().toLocaleDateString('pl-PL')}</span>
        </div>
      </div>

      {/* NAGŁÓWEK + przycisk mapy */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{przyklad ? 'Przykładowa działka' : 'Twoja działka'}</Eyebrow>
          <h3 className="mt-2 text-[26px] font-semibold tracking-tight text-fg md:text-[38px]">
            {areaLabel(parcel.areaM2)}
          </h3>
          <p className="mt-2 text-[15px] text-fg/65">
            {[parcel.commune, parcel.county, parcel.voivodeship].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-3">
          {przyklad ? null : (
            <button
              type="button"
              onClick={kopiujLink}
              className="inline-flex items-center gap-2 rounded-xl border border-fg/20 px-4 py-2.5 text-sm font-medium text-fg/80 transition hover:border-brand/50 hover:text-fg"
            >
              {linkSkopiowany ? 'Skopiowano' : 'Skopiuj link'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setMapShown((s) => !s)}
            className="inline-flex items-center gap-2 rounded-xl border border-fg/20 px-4 py-2.5 text-sm font-medium text-fg/80 transition hover:border-brand/50 hover:text-fg"
          >
            {mapShown ? 'Ukryj mapę' : 'Zobacz na mapie'}
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      {/* MAPA — na mobile full-bleed (pełna szerokość ekranu), na desktopie kafelek w kolumnie. */}
      {mapShown ? (
        <div className="no-print relative left-1/2 mt-6 w-screen -translate-x-1/2 border-y border-fg/12 md:left-auto md:w-full md:translate-x-0 md:overflow-hidden md:rounded-2xl md:border">
          <div className="h-[60vh] max-h-[620px] min-h-[360px] w-full md:h-[460px] md:max-h-none md:min-h-0">
            <RaportMap rings={parcel.rings} center={parcel.center} />
          </div>
        </div>
      ) : null}

      {/* CENA */}
      <div className="print-keep mt-8 border-t border-fg/12 pt-8">
        <Eyebrow>Orientacyjna cena okolicy</Eyebrow>
        {v && lead ? (
          <>
            {/* Przy dużym rozrzucie (p90 >= 3x p10) NIE prowadzimy jedną liczbą: w próbce siedzą
                wtedy dwa rynki naraz i mediana kłamie w obie strony. Pokazujemy zakres. */}
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[34px] font-semibold tracking-tight text-fg md:text-[46px]">
                {mixed ? `${formatIntPL(v.low)}–${formatIntPL(v.high)}` : formatIntPL(v.median)}
              </span>
              <span className="text-lg font-medium text-fg/55">zł/m²</span>
              <span className="text-[13px] uppercase tracking-[0.1em] text-fg/45">{lead.label}</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-fg/65">
              {lead.kind === 'similar' && valuation.similarSizeBand
                ? `Porównaliśmy do działek o powierzchni od ${formatIntPL(valuation.similarSizeBand.minM2)} do ${formatIntPL(valuation.similarSizeBand.maxM2)} m², w promieniu ${valuation.radiusKm} km. Większość z nich mieści się między ${formatIntPL(v.low)} a ${formatIntPL(v.high)} zł/m².`
                : mixed
                  ? `Ceny w tej okolicy rozjeżdżają się za mocno, żeby podać jedną liczbę: w promieniu ${valuation.radiusKm} km mamy zarówno teren zabudowany, jak i tańsze działki poza nim. Traktuj to jako widełki, nie wycenę.`
                  : `${v.low === v.high ? `${formatIntPL(v.low)} zł/m²` : `Zakres od ${formatIntPL(v.low)} do ${formatIntPL(v.high)} zł/m²`} · w promieniu ${valuation.radiusKm} km.`}{' '}
              Liczone z {lead.stat.sampleCount}{' '}
              {lead.stat.sampleCount === 1 ? 'oferty' : 'ofert'} w naszym serwisie. To orientacja z
              ogłoszeń, nie operat rzeczoznawcy.
            </p>

            {/* Zamiast tabeli premii za cechy (liczonej krajowo, więc na jednym ekranie stały
                obok siebie liczby z dwóch różnych rynków): jedno zdanie o tym, czego ta średnia
                NIE uwzględnia. Uczciwiej powiedzieć „może być zupełnie inaczej" niż wyliczać
                procenty, które i tak nie trafią w konkretną działkę ([[feedback-prostota-nad-modulami]]). */}
            <p className="mt-4 max-w-2xl text-sm leading-6 text-fg/55">
              Konkretna działka potrafi kosztować zupełnie inaczej niż ta średnia. Decyduje
              odległość od miasta, prąd i woda na działce, dojazd i kształt. Nawet działka
              oddalona o kilometr bywa dwa razy droższa, bo leży bliżej zabudowy.
            </p>

            {/* TREND — liczony na tych samych ofertach, które wisiały wtedy i wiszą dziś.
                Sekcja pojawia się sama, gdy historia cen urośnie; do tego czasu `trend` jest null.
                Tego nie ma żaden portal ogłoszeniowy, bo nikt nie trzyma historii cen ofert. */}
            {trend ? (
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-fg/75">
                {Math.abs(trend.changePct) < 0.005 ? (
                  <>
                    <span className="font-medium text-fg">Ceny w tej okolicy stoją w miejscu</span>{' '}
                    od {plDate(trend.fromDate)}.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-fg">
                      Ceny w tej okolicy {trend.changePct > 0 ? 'wzrosły' : 'spadły'} o{' '}
                      {Math.abs(trend.changePct * 100).toLocaleString('pl-PL', {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </span>{' '}
                    od {plDate(trend.fromDate)} ({formatIntPL(trend.medianThen)} →{' '}
                    {formatIntPL(trend.medianNow)} zł/m²).
                  </>
                )}{' '}
                <span className="text-fg/55">
                  Liczone na {trend.sampleCount}{' '}
                  {trend.sampleCount === 1 ? 'ofercie, która wisiała' : 'ofertach, które wisiały'}{' '}
                  wtedy i wiszą dziś, więc nie myli zmiany cen ze zmianą tego, co akurat jest na
                  sprzedaż.
                </span>
              </p>
            ) : null}

            {/* Druga pula dla kontekstu (budowlane/rolne). Puste rubryki znikają same. */}
            <div className="empty:hidden mt-6">
              {lead.label !== 'działki budowlane' ? (
                <PriceRow label="Wszystkie budowlane w okolicy" stat={valuation.budowlana} />
              ) : null}
              {lead.label !== 'działki rolne' ? (
                <PriceRow label="Działki rolne" stat={valuation.rolna} />
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-fg/65">
            W promieniu {valuation.radiusKm} km mamy zbyt mało porównywalnych działek, żeby uczciwie
            oszacować cenę. Nie zgadujemy.
          </p>
        )}
      </div>

      {/* CENY TRANSAKCYJNE (RCN) — kwoty z aktów notarialnych, a nie życzenia z ogłoszeń.
          Sekcja pojawia się tylko tam, gdzie mamy wiarygodną próbkę aktów dla TEJ SAMEJ puli
          (budowlane / rolne), więc na większości działek jej po prostu nie będzie. Tak ma być:
          rejestr udostępnia dane kaflami i zbieramy je stopniowo wokół naszych ofert. */}
      {rcn ? (
        <div className="print-keep mt-8 border-t border-fg/12 pt-8">
          <Eyebrow>Ile realnie płacono w okolicy</Eyebrow>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
            <span className="text-[34px] font-semibold tracking-tight text-fg md:text-[46px]">
              {formatIntPL(rcn.medianaZlM2)}
            </span>
            <span className="text-lg font-medium text-fg/55">zł/m²</span>
            <span className="text-[13px] uppercase tracking-[0.1em] text-fg/45">
              {rcn.klasa === 'rolna' ? 'grunty rolne' : 'działki budowlane'}
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-fg/65">
            Mediana z {rcn.liczba} {rcn.liczba === 1 ? 'transakcji' : 'transakcji'} zapisanych w
            Rejestrze Cen Nieruchomości (GUGiK) w promieniu {rcn.promienKm} km
            {rcn.odRoku === rcn.doRoku ? ` w ${rcn.odRoku} roku` : `, z lat ${rcn.odRoku}-${rcn.doRoku}`}.
            To kwoty faktycznie zapłacone u notariusza, nie ceny z ogłoszeń. Połowa transakcji
            zamknęła się między {formatIntPL(rcn.low)} a {formatIntPL(rcn.high)} zł/m².
            {rcn.promienKm >= 35
              ? ' Bliżej aktów w rejestrze na razie brakuje, a przy takim promieniu mieszczą się już inne miejscowości, więc traktuj tę liczbę jako tło rynku, nie jako cenę tej konkretnej okolicy.'
              : ''}
          </p>

          {/* Sedno całej sekcji: różnica między tym, czego się chce, a tym, co się dostaje.
              Uczciwie zaznaczamy, że to dwa różne zbiory (inne koło, inny okres), więc czytelnik
              nie weźmie tego za wyliczenie „ile utargujesz". */}
          {v ? (
            (() => {
              const roznica = Math.round(((v.median - rcn.medianaZlM2) / rcn.medianaZlM2) * 100);
              if (Math.abs(roznica) < 5) {
                return (
                  <p className="mt-5 max-w-2xl text-[15px] leading-7 text-fg/75">
                    <span className="font-medium text-fg">
                      Ogłoszenia w tej okolicy trzymają się cen z aktów notarialnych.
                    </span>{' '}
                    Sprzedający chcą dziś {formatIntPL(v.median)} zł/m², czyli mniej więcej tyle,
                    ile realnie płacono.
                  </p>
                );
              }
              return (
                <p className="mt-5 max-w-2xl text-[15px] leading-7 text-fg/75">
                  <span className="font-medium text-fg">
                    Ogłoszenia chcą dziś {formatIntPL(v.median)} zł/m², czyli o{' '}
                    {Math.abs(roznica)}% {roznica > 0 ? 'więcej' : 'mniej'} niż wynosi mediana
                    zapłaconych kwot.
                  </span>{' '}
                  <span className="text-fg/55">
                    Obie liczby liczą się z innych zbiorów (ogłoszenia z promienia{' '}
                    {valuation.radiusKm} km i z dziś, akty z {rcn.promienKm} km i z ostatnich dwóch
                    lat), więc to nie jest gotowa odpowiedź, ile da się utargować. Ale pokazuje, w
                    którą stronę rozjeżdżają się oczekiwania i rzeczywistość.
                  </span>
                </p>
              );
            })()
          ) : null}
        </div>
      ) : null}

      {/* PLAN MIEJSCOWY (MPZP) */}
      <div className="print-keep mt-8 border-t border-fg/12 pt-8">
        <Eyebrow>Plan miejscowy (MPZP)</Eyebrow>
        {mpzp ? (
          (() => {
            const hasPurpose = !!(mpzp.functionName || mpzp.functionSymbol);
            const hasDetails =
              hasPurpose ||
              !!mpzp.maxHeight ||
              !!mpzp.intensity ||
              !!mpzp.effectiveFrom ||
              !!mpzp.resolution ||
              !!mpzp.status;
            return (
              <>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-fg/80">
                  Dla tej działki obowiązuje miejscowy plan zagospodarowania
                  {mpzp.planName ? (
                    <>
                      {' '}
                      „<span className="text-fg">{mpzp.planName}</span>”
                    </>
                  ) : null}
                  .{hasDetails ? ' Najważniejsze, co z niego wynika:' : ''}
                </p>
                {hasDetails ? (
                  <div className="mt-5 border-t border-fg/10">
                    <Row
                      label="Przeznaczenie"
                      value={
                        mpzp.functionName
                          ? mpzp.functionSymbol
                            ? `${mpzp.functionName} (${mpzp.functionSymbol})`
                            : mpzp.functionName
                          : mpzp.functionSymbol
                      }
                    />
                    <Row label="Maks. wysokość zabudowy" value={mpzp.maxHeight ? `${mpzp.maxHeight} m` : null} />
                    <Row label="Intensywność zabudowy" value={mpzp.intensity} />
                    <Row label="Obowiązuje od" value={plDate(mpzp.effectiveFrom)} />
                    <Row label="Uchwała" value={mpzp.resolution} />
                    <Row label="Status planu" value={mpzp.status} />
                  </div>
                ) : null}
                {!hasPurpose ? (
                  <p className="mt-4 max-w-2xl text-[13px] leading-7 text-fg/55">
                    Samo przeznaczenie dla tego punktu nie zostało udostępnione przez gminę w
                    krajowej integracji. Podejrzyj plan jako warstwę na mapie powyżej albo dopytaj w
                    gminie o zapis dla tej działki.
                  </p>
                ) : null}
              </>
            );
          })()
        ) : (
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-fg/70">
            W tym punkcie nie ma planu miejscowego w krajowej integracji. Zwykle znaczy to, że o
            zabudowie decydują warunki zabudowy (WZ).{' '}
            <Link
              href="/blog/warunki-zabudowy-wz-co-to-jest"
              className="text-brand-text underline decoration-1 underline-offset-2 hover:text-brand-bright"
            >
              Sprawdź, czym są warunki zabudowy
            </Link>{' '}
            i dopytaj w gminie.
          </p>
        )}
      </div>

      {/* PLAN OGÓLNY GMINY — od reformy obowiązkowy dla każdej gminy i obejmujący CAŁY jej obszar,
          więc odpowiada tam, gdzie planu miejscowego nie ma (a nie ma go dla większości działek).
          Najważniejszy jest obszar uzupełnienia zabudowy: bez planu miejscowego to od niego zależy,
          czy gmina w ogóle może wydać warunki zabudowy. Gdy gmina nie przysłała jeszcze danych do
          usługi GUGiK, sekcji nie ma — nie mylimy „brak danych" z „poza obszarem". */}
      {pog ? (
        <div className="print-keep mt-8 border-t border-fg/12 pt-8">
          <Eyebrow>Plan ogólny gminy</Eyebrow>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-fg/80">
            Działka leży w strefie:{' '}
            <span className="text-fg">{pog.strefa.nazwa ?? `oznaczonej symbolem ${pog.strefa.symbol}`}</span>
            .
          </p>

          <div className="mt-5 border-t border-fg/10">
            <Row label="Oznaczenie strefy" value={pog.strefa.oznaczenie ?? pog.strefa.symbol} />
            <Row
              label="Maks. wysokość zabudowy"
              value={pog.strefa.maksWysokoscZabudowy ? `${pog.strefa.maksWysokoscZabudowy} m` : null}
            />
            <Row
              label="Maks. powierzchnia zabudowy"
              value={
                pog.strefa.maksUdzialPowierzchniZabudowy
                  ? `${pog.strefa.maksUdzialPowierzchniZabudowy}%`
                  : null
              }
            />
            <Row
              label="Min. powierzchnia biologicznie czynna"
              value={
                pog.strefa.minUdzialPowierzchniBiologicznieCzynnej
                  ? `${pog.strefa.minUdzialPowierzchniBiologicznieCzynnej}%`
                  : null
              }
            />
            <Row
              label="Maks. intensywność zabudowy"
              value={pog.strefa.maksNadziemnaIntensywnoscZabudowy}
            />
            <Row label="Obowiązuje od" value={plDate(pog.strefa.obowiazujeOd)} />
          </div>

          {/* Sedno całej sekcji: czy na tej działce da się w ogóle dostać warunki zabudowy. */}
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-fg/75">
            {pog.ouz ? (
              <>
                <span className="font-medium text-fg">
                  Działka leży w obszarze uzupełnienia zabudowy.
                </span>{' '}
                {mpzp
                  ? 'O zabudowie i tak rozstrzyga plan miejscowy powyżej, bo tam gdzie plan obowiązuje, warunków zabudowy się nie wydaje.'
                  : 'Gdy nie ma planu miejscowego, to warunek konieczny, żeby gmina mogła wydać decyzję o warunkach zabudowy. Sam obszar nie przesądza jeszcze o decyzji, ale bez niego nie ma o czym rozmawiać.'}
              </>
            ) : (
              <>
                <span className="font-medium text-fg">
                  Działka leży poza obszarem uzupełnienia zabudowy.
                </span>{' '}
                {mpzp
                  ? 'Dla tej działki rozstrzyga jednak plan miejscowy powyżej, a warunków zabudowy nie wydaje się tam, gdzie plan obowiązuje.'
                  : 'Bez planu miejscowego gmina co do zasady nie wyda tu warunków zabudowy pod nowy dom. Wyjątki dotyczą między innymi zabudowy zagrodowej w gospodarstwie rolnym. To pytanie zadaj w gminie w pierwszej kolejności.'}
              </>
            )}
          </p>

          {pog.srodmiejska ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-fg/55">
              Teren leży w obszarze zabudowy śródmiejskiej, gdzie obowiązują luźniejsze standardy
              dostępu do terenów zieleni i infrastruktury społecznej.
            </p>
          ) : null}

          <p className="mt-3 max-w-2xl text-xs leading-6 text-fg/45">
            Dane z planów ogólnych gmin (GUGiK). Plan ogólny nie zastępuje planu miejscowego:
            wyznacza ramy, w których gmina uchwala plany i wydaje decyzje o warunkach zabudowy.
          </p>
        </div>
      ) : null}

      {/* DANE Z EWIDENCJI */}
      <div className="print-keep mt-8 border-t border-fg/12 pt-8">
        <Eyebrow>Dane z ewidencji</Eyebrow>
        <div className="mt-5 border-t border-fg/10">
          <Row label="Numer działki" value={parcel.parcelNumber} />
          <Row label="Obręb" value={parcel.region} />
          <Row label="Identyfikator" value={parcel.id} />
          <Row label="Gmina" value={parcel.commune} />
          <Row label="Powiat" value={parcel.county} />
          <Row label="Województwo" value={parcel.voivodeship} />
        </div>
        <p className="mt-3 text-xs leading-6 text-fg/45">
          Granice, powierzchnia i numer z ewidencji gruntów (ULDK, GUGiK) dla wskazanego punktu.
        </p>
      </div>

      {/* DZIAŁKI W OKOLICY — raport ma się kończyć czymś do kliknięcia, a nie samym odesłaniem
          do urzędu. Te same karty co na /kup, więc działają identycznie (galeria, ulubione). */}
      {nearby && nearby.length ? (
        <div className="no-print mt-10 border-t border-fg/12 pt-8">
          <h3 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
            Działki na sprzedaż w okolicy
          </h3>
          <p className="mt-2 text-sm text-fg/60">
            {valuation.offersNearby}{' '}
            {valuation.offersNearby === 1 ? 'oferta' : 'ofert'} w promieniu {valuation.radiusKm} km
            od sprawdzanej działki.{' '}
            <Link
              href={`/kup?lat=${parcel.center.lat}&lng=${parcel.center.lng}&radius=${valuation.radiusKm}`}
              className="text-fg/80 underline decoration-1 underline-offset-4 transition hover:text-fg"
            >
              Zobacz wszystkie
            </Link>
          </p>
          {/* Strzałki karuzeli siedzą 68 px NAD railem (HomeHorizontalSlider), więc bez tego
              odstępu wchodziły na nagłówek i link. Na telefonie strzałek nie ma. */}
          <div className="mt-6 md:mt-[84px]">
            <FeaturedRail items={nearby} />
          </div>
        </div>
      ) : null}

      {/* CO SPRAWDZIĆ DALEJ */}
      <div className="mt-10 border-t border-fg/12 pt-8">
        <h3 className="text-xl font-semibold tracking-tight text-brand-text md:text-2xl">
          Co sprawdzić dalej
        </h3>
        <div className="mt-5 border-t border-fg/10">
          {NEXT_STEPS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center justify-between gap-4 border-b border-fg/10 py-3.5 text-[15px] text-fg/85 transition hover:text-fg"
            >
              {s.label}
              <span aria-hidden className="text-fg/35 transition group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
