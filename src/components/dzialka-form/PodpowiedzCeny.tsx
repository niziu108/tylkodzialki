'use client';

import {
  kwotaOrientacyjna,
  porownanieCeny,
  PROG_TYLE_SAMO_PROC,
  type PodpowiedzCeny,
} from '@/lib/kreatorDzialki';
import { plural } from '@/lib/plural';

// Podpowiedź ceny z tych samych danych co raport „Sprawdź działkę": ogłoszenia w okolicy i kwoty
// z aktów notarialnych (RCN). Celowo same liczby i jedna linijka zastrzeżenia: długi tekst przy
// formularzu zniechęca (feedback Daniela 2026-09-15). Kwota za całą działkę i procent tylko przy
// działkach podobnej wielkości, bo za metr dużej działki płaci się kilka razy mniej.

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
  const podobne = ogloszenia && !ogloszenia.widelki && ogloszenia.podobnaWielkosc ? ogloszenia : null;

  return (
    <div className="rounded-2xl border border-fg/12 bg-fg/[0.03] px-4 py-3 md:px-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">Ceny w okolicy</div>

      <dl className="mt-2 space-y-1 text-[14px]">
        {ogloszenia ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <dt className="text-fg/70">
              Ogłoszenia{' '}
              <span className="text-fg/45">
                ({ogloszenia.liczba} {plural(ogloszenia.liczba, 'oferta', 'oferty', 'ofert')},{' '}
                {ogloszenia.promienKm} km)
              </span>
            </dt>
            <dd className="font-semibold text-fg">
              {ogloszenia.widelki
                ? `${liczba(ogloszenia.low)}-${liczba(ogloszenia.high)} zł/m²`
                : `${liczba(ogloszenia.mediana)} zł/m²`}
            </dd>
          </div>
        ) : null}

        {transakcje ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <dt className="text-fg/70">
              Akty notarialne{' '}
              <span className="text-fg/45">
                ({transakcje.liczba} {plural(transakcje.liczba, 'transakcja', 'transakcje', 'transakcji')},{' '}
                {transakcje.promienKm} km)
              </span>
            </dt>
            <dd className="font-semibold text-fg">{liczba(transakcje.mediana)} zł/m²</dd>
          </div>
        ) : null}
      </dl>

      {zlM2 !== null ? (
        <p className="mt-2 text-[14px] text-fg/80">
          Twoja cena: <span className="font-semibold text-fg">{liczba(zlM2)} zł/m²</span>
          {porownanie
            ? Math.abs(porownanie.procent) < PROG_TYLE_SAMO_PROC
              ? ', tyle co podobne działki'
              : `, o ${Math.abs(porownanie.procent)}% ${porownanie.procent > 0 ? 'więcej' : 'mniej'} niż podobne działki`
            : ''}
        </p>
      ) : podobne && powierzchniaM2 > 0 ? (
        <p className="mt-2 text-[14px] text-fg/80">
          Za Twoją działkę około{' '}
          <span className="font-semibold text-fg">
            {liczba(kwotaOrientacyjna(podobne.mediana, powierzchniaM2))} zł
          </span>
        </p>
      ) : null}

      <p className="mt-1.5 text-[12px] text-fg/50">
        {podobne ? 'Orientacyjnie, nie wycena rzeczoznawcy.' : 'Orientacyjnie: działki różnej wielkości.'}
      </p>
    </div>
  );
}
