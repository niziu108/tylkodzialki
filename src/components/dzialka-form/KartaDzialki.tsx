'use client';

import { czystaNazwaGminy, ladnaNazwa, type ZapisanaDzialka } from '@/lib/kreatorDzialki';
import type { LatLng } from '@/lib/uldk';
import { powiatLabelFromUldk } from '@/lib/uldkQuery';

// Potwierdzenie „to ta działka": zdjęcie z lotu ptaka z obrysem (w kreatorze to samo, które trafia
// do ogłoszenia) albo sam obrys i to, co mówi o działce ewidencja. Właściciel zna obręb i
// powierzchnię z dokumentów, więc od razu widzi, czy trafiliśmy.

function liczba(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function KartaDzialki({
  dzialka,
  miejscowosc,
  zdjecieUrl = null,
  zdjecieLadowanie = false,
  onZmien,
  wariant = 'kreator',
}: {
  dzialka: ZapisanaDzialka;
  miejscowosc: string;
  // nasze zdjęcie z lotu ptaka, gdy już się wgrało (strona wyceny go nie robi: pokazuje sam obrys)
  zdjecieUrl?: string | null;
  zdjecieLadowanie?: boolean;
  onZmien: () => void;
  // kreator mówi, co uzupełnił; strona wyceny tylko pokazuje działkę
  wariant?: 'kreator' | 'wycena';
}) {
  const gmina = ladnaNazwa(czystaNazwaGminy(dzialka.commune));
  const obreb = ladnaNazwa(dzialka.region);
  const gdzie = [
    obreb ? `obręb ${obreb}` : null,
    gmina ? `gmina ${gmina}` : null,
    dzialka.county ? powiatLabelFromUldk(dzialka.county) : null,
    dzialka.voivodeship ? `woj. ${dzialka.voivodeship}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const plan = dzialka.plan ? [dzialka.plan.symbol, dzialka.plan.nazwa].filter(Boolean).join(' · ') : '';

  return (
    <div className="overflow-hidden rounded-3xl border border-fg/10 bg-fg/[0.03]">
      <div className="relative aspect-[16/10] bg-surface">
        {zdjecieUrl ? (
          <img
            src={zdjecieUrl}
            alt={`Działka ${dzialka.parcelNumber} z lotu ptaka`}
            className="h-full w-full object-cover"
          />
        ) : (
          <Obrys rings={dzialka.rings} />
        )}

        {!zdjecieUrl && zdjecieLadowanie ? (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs text-white/85">
            Pobieramy zdjęcie z lotu ptaka…
          </div>
        ) : null}
      </div>

      <div className="p-5 md:p-7">
        <div className="text-[11px] uppercase tracking-[0.18em] text-brand-text">Znaleźliśmy Twoją działkę</div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-fg md:text-2xl">
          Działka {dzialka.parcelNumber}
          {miejscowosc ? `, ${miejscowosc}` : ''}
        </h2>
        {gdzie ? <p className="mt-1 text-[14px] leading-6 text-fg/65">{gdzie}</p> : null}

        <dl className="mt-5 divide-y divide-fg/10 border-y border-fg/10 text-[14px]">
          <Wiersz etykieta="Powierzchnia z ewidencji" wartosc={`ok. ${liczba(dzialka.areaM2)} m²`} />
          <Wiersz
            etykieta="Plan miejscowy"
            wartosc={
              plan ||
              // Serwer gminy nie odpowiedział: nie wiemy, a to nie to samo co „brak planu".
              (dzialka.planNiedostepny ? 'serwer gminy nie odpowiedział' : 'nie znaleźliśmy planu dla tej działki')
            }
          />
          <Wiersz etykieta="Identyfikator" wartosc={dzialka.id} />
        </dl>

        {wariant === 'kreator' ? (
          <p className="mt-4 text-[13px] leading-6 text-fg/65">
            Uzupełniliśmy za Ciebie lokalizację, powierzchnię
            {dzialka.przeznaczeniaZPlanu.length > 0 ? ', przeznaczenie' : ''} i tytuł
            {zdjecieUrl ? ', a jako pierwsze zdjęcie dodaliśmy widok z lotu ptaka' : ''}. Wszystko możesz
            poprawić w kolejnych krokach.
          </p>
        ) : null}

        <button
          type="button"
          onClick={onZmien}
          className="mt-4 text-[14px] font-semibold text-fg/75 underline decoration-fg/30 underline-offset-4 transition hover:text-fg hover:decoration-fg"
        >
          {wariant === 'kreator' ? 'To nie ta działka? Wybierz inną' : 'Sprawdź inną działkę'}
        </button>
      </div>
    </div>
  );
}

function Wiersz({ etykieta, wartosc }: { etykieta: string; wartosc: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
      <dt className="text-fg/60">{etykieta}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-fg">{wartosc}</dd>
    </div>
  );
}

// Obrys z geometrii ewidencji, zanim dojedzie zdjęcie (albo gdy ortofotomapa nie odpowie). Stopnie
// długości mnożymy przez cos(szerokości), żeby działka nie wyszła rozciągnięta w poziomie.
function Obrys({ rings }: { rings: LatLng[][] }) {
  const punkty = rings.flat();
  if (punkty.length === 0) return null;

  const lat0 = punkty.reduce((s, p) => s + p.lat, 0) / punkty.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of punkty) {
    const x = p.lng * k;
    const y = -p.lat;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const S = 1000;
  const bok = Math.max(maxX - minX, maxY - minY) || 1;
  const przesX = (bok - (maxX - minX)) / 2;
  const przesY = (bok - (maxY - minY)) / 2;
  const d = rings
    .map(
      (ring) =>
        ring
          .map((p, i) => {
            const x = ((p.lng * k - minX + przesX) / bok) * S;
            const y = ((-p.lat - minY + przesY) / bok) * S;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(' ') + ' Z'
    )
    .join(' ');

  return (
    <svg
      viewBox={`-150 -150 ${S + 300} ${S + 300}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="rgba(122,163,51,0.18)"
        stroke="#7aa333"
        strokeWidth={3}
        strokeLinejoin="round"
        fillRule="evenodd"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
