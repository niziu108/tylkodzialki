'use client';

import {
  kwotaOrientacyjna,
  porownanieCeny,
  PROG_TYLE_SAMO_PROC,
  type PodpowiedzCeny,
} from '@/lib/kreatorDzialki';

// Podpowiedź ceny z tych samych danych co raport „Sprawdź działkę": ogłoszenia w okolicy i kwoty
// z aktów notarialnych (RCN). Prywatny sprzedający zwykle nie wie, ile żądać, a zawyżona cena to
// oferta, która wisi miesiącami. Uczciwie: orientacja, nie wycena rzeczoznawcy, i nic nie wpisujemy
// za sprzedającego.

function liczba(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function PodpowiedzCenyBox({
  podpowiedz,
  cenaPln,
  powierzchniaM2,
}: {
  podpowiedz: PodpowiedzCeny;
  cenaPln: number;
  powierzchniaM2: number;
}) {
  const { ogloszenia, transakcje } = podpowiedz;
  const zlM2 =
    Number.isFinite(cenaPln) && cenaPln > 0 && Number.isFinite(powierzchniaM2) && powierzchniaM2 > 0
      ? cenaPln / powierzchniaM2
      : null;
  const porownanie = zlM2 !== null ? porownanieCeny(zlM2, podpowiedz) : null;
  // Kwotę za całą działkę liczymy tylko z działek podobnej wielkości. Za metr hektara płaci się
  // kilka razy mniej niż za metr działki pod dom, więc mediana „wszystkich budowlanych" razy
  // powierzchnia dużej działki dałaby kwotę do obalenia.
  const podobne = ogloszenia && !ogloszenia.widelki && ogloszenia.podobnaWielkosc ? ogloszenia : null;

  return (
    <div className="rounded-2xl border border-fg/12 bg-fg/[0.03] px-4 py-4 md:px-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">Ceny w okolicy Twojej działki</div>

      <dl className="mt-2 divide-y divide-fg/10">
        {ogloszenia ? (
          <div className="py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <dt className="text-[14px] text-fg/70">Ogłoszenia</dt>
              <dd className="text-[15px] font-semibold text-fg">
                {ogloszenia.widelki
                  ? `od ${liczba(ogloszenia.low)} do ${liczba(ogloszenia.high)} zł/m²`
                  : `${liczba(ogloszenia.mediana)} zł/m²`}
              </dd>
            </div>
            <p className="mt-0.5 text-[12px] leading-5 text-fg/55">
              {ogloszenia.widelki ? 'Widełki' : 'Mediana'} z {ogloszenia.liczba}{' '}
              {ogloszenia.liczba === 1 ? 'oferty' : 'ofert'} ({ogloszenia.etykieta}) w promieniu{' '}
              {ogloszenia.promienKm} km.
            </p>
          </div>
        ) : null}

        {transakcje ? (
          <div className="py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <dt className="text-[14px] text-fg/70">Akty notarialne</dt>
              <dd className="text-[15px] font-semibold text-fg">{liczba(transakcje.mediana)} zł/m²</dd>
            </div>
            <p className="mt-0.5 text-[12px] leading-5 text-fg/55">
              Mediana z {transakcje.liczba} sprzedaży {transakcje.rolne ? 'gruntów rolnych' : 'działek budowlanych'}{' '}
              w promieniu {transakcje.promienKm} km
              {transakcje.odRoku === transakcje.doRoku
                ? ` w ${transakcje.odRoku} roku`
                : `, z lat ${transakcje.odRoku}-${transakcje.doRoku}`}
              . Kwoty zapłacone u notariusza (Rejestr Cen Nieruchomości).
            </p>
          </div>
        ) : null}
      </dl>

      {!podobne ? (
        <p className="mt-2 text-[13px] leading-6 text-fg/65">
          W okolicy brakuje ofert działek podobnej wielkości, więc to ceny działek różnej wielkości. Za
          metr dużej działki płaci się zwykle mniej niż za metr małej, dlatego nie liczymy z tego kwoty
          dla Twojej działki.
        </p>
      ) : null}

      {zlM2 !== null ? (
        <p className="mt-2 text-[14px] leading-6 text-fg/80">
          Twoja cena to <span className="font-semibold text-fg">{liczba(zlM2)} zł/m²</span>
          {porownanie
            ? Math.abs(porownanie.procent) < PROG_TYLE_SAMO_PROC
              ? ', mniej więcej tyle, ile mediana ofert podobnej wielkości.'
              : `, o ${Math.abs(porownanie.procent)}% ${porownanie.procent > 0 ? 'więcej' : 'mniej'} niż mediana ofert podobnej wielkości.`
            : '.'}
        </p>
      ) : podobne && powierzchniaM2 > 0 ? (
        <p className="mt-2 text-[14px] leading-6 text-fg/80">
          Przy Twojej powierzchni mediana daje około{' '}
          <span className="font-semibold text-fg">
            {liczba(kwotaOrientacyjna(podobne.mediana, powierzchniaM2))} zł
          </span>
          .
        </p>
      ) : null}

      <p className="mt-2 text-[12px] leading-5 text-fg/50">
        To orientacja z ogłoszeń i aktów notarialnych, nie wycena rzeczoznawcy. Cenę ustalasz Ty.
      </p>
    </div>
  );
}
