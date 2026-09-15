'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatIntPL } from '@/lib/format';
import { ladnaNazwaObrebu } from '@/lib/dzialkaZOpisu';
import type { RaportOfertyDane, ZrodloDzialki } from '@/lib/raportOferty';
import type { RcnOkolica } from '@/lib/rcnStats';
import RaportMap from './RaportMap';
import { areaLabel, Eyebrow, plDate, Row } from './Raport';

// Raport działki pod ofertą (zapisany w DzialkaRaport, lib/raportOferty.ts). Te same dane co
// „Sprawdź działkę", skrócone do tego, o co kupujący pyta przy konkretnym ogłoszeniu: co wolno tu
// zbudować, co mówi ewidencja i ile realnie płacono w okolicy.
//
// Świadomie BEZ wyceny z naszych ofert i bez porównania „ogłoszenia chcą o X% więcej": pod ofertą
// biura taka liczba czyta się jak ocena jego ceny, a biura to nasza podaż. Fakty z rejestrów tak,
// werdykt o cenie nie.

// Przy takim promieniu w próbce siedzą już inne miejscowości; pod konkretną ofertą to myli.
const RCN_MAX_PROMIEN_KM = 35;

export default function RaportOferty({
  dane,
  zrodlo,
  sprawdzono,
  rcn,
}: {
  dane: RaportOfertyDane;
  zrodlo: ZrodloDzialki;
  sprawdzono: string; // ISO: kiedy pobraliśmy ewidencję i plany
  rcn: RcnOkolica | null;
}) {
  const { parcel, mpzp, pog, niedostepne = [] } = dane;
  const mpzpNieznany = niedostepne.includes('mpzp');
  const [mapShown, setMapShown] = useState(false);
  const obreb = ladnaNazwaObrebu(parcel.region);
  const przeznaczenie = mpzp?.functionName
    ? mpzp.functionSymbol
      ? `${mpzp.functionName} (${mpzp.functionSymbol})`
      : mpzp.functionName
    : (mpzp?.functionSymbol ?? null);
  const strefa = pog
    ? pog.strefa.nazwa
      ? `${pog.strefa.nazwa}${pog.strefa.oznaczenie ? ` (${pog.strefa.oznaczenie})` : ''}`
      : (pog.strefa.oznaczenie ?? pog.strefa.symbol)
    : null;
  // Gdy serwer planu miejscowego nie odpowiedział, nie wiemy, czy plan jest, więc zdanie
  // o warunkach zabudowy mówi „gdy nie ma planu", a nie „bez planu".
  const bezPlanu = mpzpNieznany ? 'Gdy nie ma planu miejscowego,' : 'Bez planu miejscowego';
  const zdaniePog = !pog
    ? null
    : mpzp
      ? 'O zabudowie rozstrzyga jednak plan miejscowy.'
      : pog.ouz
        ? `${bezPlanu} to warunek, żeby gmina mogła wydać warunki zabudowy.`
        : `${bezPlanu} gmina co do zasady nie wyda tu warunków zabudowy pod nowy dom (wyjątkiem jest m.in. zabudowa zagrodowa). To pytanie zadaj w gminie w pierwszej kolejności.`;

  return (
    <section id="raport-dzialki" aria-labelledby="raport-dzialki-tytul" className="scroll-mt-24 border-t border-fg/5">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="text-[12px] uppercase tracking-[0.16em] text-brand-bright">Raport działki</div>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 id="raport-dzialki-tytul" className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">
              Działka nr {parcel.parcelNumber}
              {obreb ? `, obręb ${obreb}` : ''}
            </h2>
            <p className="mt-2 text-[15px] text-fg/65">
              {[areaLabel(parcel.areaM2), parcel.commune, parcel.county].filter(Boolean).join(' · ')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMapShown((s) => !s)}
            className="inline-flex items-center gap-2 rounded-xl border border-fg/20 px-4 py-2.5 text-sm font-medium text-fg/80 transition hover:border-brand/50 hover:text-fg"
          >
            {mapShown ? 'Ukryj mapę' : 'Granice na mapie'}
            <span aria-hidden>→</span>
          </button>
        </div>

        {/* Mapa ładuje Google Maps dopiero na kliknięcie: większość czytających jej nie otworzy. */}
        {mapShown ? (
          <div className="relative left-1/2 mt-6 w-screen -translate-x-1/2 border-y border-fg/12 md:left-auto md:w-full md:translate-x-0 md:overflow-hidden md:rounded-2xl md:border">
            <div className="h-[60vh] max-h-[560px] min-h-[340px] w-full md:h-[420px] md:max-h-none md:min-h-0">
              <RaportMap rings={parcel.rings} center={parcel.center} />
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-2">
          <div className="min-w-0">
            <Eyebrow>Plan miejscowy (MPZP)</Eyebrow>
            {mpzp ? (
              <div className="mt-4 border-t border-fg/10">
                <Row label="Przeznaczenie" value={przeznaczenie} />
                <Row label="Maks. wysokość" value={mpzp.maxHeight ? `${mpzp.maxHeight} m` : null} />
                <Row label="Intensywność" value={mpzp.intensity} />
                <Row label="Plan" value={mpzp.planName} />
                <Row label="Uchwała" value={mpzp.resolution} />
                <Row label="Obowiązuje od" value={plDate(mpzp.effectiveFrom)} />
              </div>
            ) : mpzpNieznany ? (
              <p className="mt-3 text-[15px] leading-7 text-fg/70">
                Serwer planów tej gminy nie odpowiedział, gdy sprawdzaliśmy działkę. Sprawdzimy ponownie,
                a do tego czasu o plan miejscowy zapytaj w gminie {parcel.commune}.
              </p>
            ) : (
              <p className="mt-3 text-[15px] leading-7 text-fg/70">
                Krajowa integracja planów nie ma planu miejscowego dla tej działki. Nie każda gmina
                przesyła tam swoje plany, więc warto dopytać w gminie. Bez planu o zabudowie decydują
                warunki zabudowy.{' '}
                <Link
                  href="/blog/warunki-zabudowy-wz-co-to-jest"
                  className="text-brand-text underline decoration-1 underline-offset-2 hover:text-brand-bright"
                >
                  Czym są warunki zabudowy
                </Link>
              </p>
            )}

            {/* Plan ogólny odpowiada tam, gdzie planu miejscowego nie ma: bez obszaru uzupełnienia
                zabudowy gmina co do zasady nie wyda warunków zabudowy. Gdy gmina nie przysłała
                jeszcze danych, sekcji nie ma (nie mylimy „brak danych" z „poza obszarem"). */}
            {pog ? (
              <div className="mt-10">
                <Eyebrow>Plan ogólny gminy</Eyebrow>
                <p className="mt-3 text-[15px] leading-7 text-fg/75">
                  <span className="font-medium text-fg">
                    {pog.ouz
                      ? 'Działka leży w obszarze uzupełnienia zabudowy.'
                      : 'Działka leży poza obszarem uzupełnienia zabudowy.'}
                  </span>{' '}
                  {zdaniePog}
                </p>
                <div className="mt-4 border-t border-fg/10">
                  <Row label="Strefa" value={strefa} />
                  <Row
                    label="Maks. wysokość"
                    value={pog.strefa.maksWysokoscZabudowy ? `${pog.strefa.maksWysokoscZabudowy} m` : null}
                  />
                  <Row
                    label="Maks. zabudowa"
                    value={pog.strefa.maksUdzialPowierzchniZabudowy ? `${pog.strefa.maksUdzialPowierzchniZabudowy}%` : null}
                  />
                  <Row
                    label="Min. biologicznie czynna"
                    value={
                      pog.strefa.minUdzialPowierzchniBiologicznieCzynnej
                        ? `${pog.strefa.minUdzialPowierzchniBiologicznieCzynnej}%`
                        : null
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-w-0">
            <Eyebrow>Dane z ewidencji</Eyebrow>
            <div className="mt-4 border-t border-fg/10">
              <Row label="Numer działki" value={parcel.parcelNumber} />
              <Row label="Obręb" value={obreb || null} />
              <Row label="Identyfikator" value={parcel.id} />
              <Row label="Powierzchnia" value={areaLabel(parcel.areaM2)} />
              <Row label="Gmina" value={parcel.commune} />
              <Row label="Powiat" value={parcel.county} />
              <Row label="Województwo" value={parcel.voivodeship} />
            </div>

            {rcn && rcn.promienKm < RCN_MAX_PROMIEN_KM ? (
              <div className="mt-10">
                <Eyebrow>Ile realnie płacono w okolicy</Eyebrow>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[30px] font-semibold tracking-tight text-fg">
                    {formatIntPL(rcn.medianaZlM2)}
                  </span>
                  <span className="text-base font-medium text-fg/55">zł/m²</span>
                  <span className="text-[12px] uppercase tracking-[0.1em] text-fg/45">
                    {rcn.klasa === 'rolna' ? 'grunty rolne' : 'działki budowlane'}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-fg/65">
                  Mediana z {rcn.liczba} transakcji z aktów notarialnych (Rejestr Cen Nieruchomości)
                  w promieniu {rcn.promienKm} km
                  {rcn.odRoku === rcn.doRoku ? `, ${rcn.odRoku} rok` : `, lata ${rcn.odRoku}-${rcn.doRoku}`}.
                  Połowa transakcji zamknęła się między {formatIntPL(rcn.low)} a {formatIntPL(rcn.high)} zł/m².
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-10 max-w-3xl text-xs leading-6 text-fg/45">
          {zrodlo === 'OPIS'
            ? 'Działkę wskazał numer podany w ogłoszeniu i sprawdzony w ewidencji gruntów: zgadza się gmina, położenie i powierzchnia. Przed zakupem potwierdź numer u sprzedającego.'
            : 'Działkę wskazał ogłoszeniodawca, stawiając pinezkę na mapie.'}{' '}
          Ewidencja gruntów (ULDK) i plany (GUGiK): stan na {plDate(sprawdzono)}. Ceny transakcyjne:
          Rejestr Cen Nieruchomości.{' '}
          <Link href="/sprawdz-dzialke" className="text-fg/70 underline decoration-1 underline-offset-2 hover:text-fg">
            Sprawdź inną działkę
          </Link>
        </p>
      </div>
    </section>
  );
}
