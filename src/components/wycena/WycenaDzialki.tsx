'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import HeroGradientBg from '@/components/HeroGradientBg';
import ParcelFinder, { pobierzDaneDzialki } from '@/components/dzialka-form/ParcelFinder';
import KartaDzialki from '@/components/dzialka-form/KartaDzialki';
import PodpowiedzCenyBox from '@/components/dzialka-form/PodpowiedzCeny';
import { decydujCene } from '@/lib/raportCena';
import { nazwaMiejscowosci, zapisanaDzialka, type DaneDzialki } from '@/lib/kreatorDzialki';

// „Sprawdź wartość swojej działki": drzwi dla WŁAŚCICIELA do tego samego silnika co „Sprawdź
// działkę" i formularz dodawania. Kupujący pyta „czy postawię tu dom", właściciel „ile dostanę", więc
// tu prowadzimy ceną, a na końcu jest przejście do formularza z już wskazaną działką
// (/sprzedaj?d=<identyfikator>). Ceny z tymi samymi bramkami uczciwości co w formularzu: kwota za
// całą działkę tylko przy działkach podobnej wielkości. Tekstu mało (feedback Daniela 2026-09-15).

export default function WycenaDzialki() {
  const [dane, setDane] = useState<DaneDzialki | null>(null);
  const [zLinku, setZLinku] = useState(false);
  const [bladLinku, setBladLinku] = useState<string | null>(null);
  const wynikRef = useRef<HTMLDivElement | null>(null);

  // Wejście z gotowym adresem „/wycena-dzialki?d=<identyfikator>" (link z posta, maila albo raportu).
  // Czytamy z `window.location`, nie z `useSearchParams`, bo hak wymusiłby renderowanie strony po
  // stronie klienta i HTML dla Google byłby pusty ([[project-csr-bailout-prerender]]).
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get('d');
    if (!d) return;
    let anulowane = false;
    setZLinku(true);
    pobierzDaneDzialki({ parcelId: d })
      .then((wynik) => {
        if (!anulowane) setDane(wynik);
      })
      .catch((e: unknown) => {
        if (!anulowane) setBladLinku(e instanceof Error ? e.message : 'Nie udało się wczytać działki z linku.');
      })
      .finally(() => {
        if (!anulowane) setZLinku(false);
      });
    return () => {
      anulowane = true;
    };
  }, []);

  // Po wyniku zjeżdżamy do niego, żeby było jasne, że jest gotowy.
  useEffect(() => {
    if (dane) wynikRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [dane]);

  const dzialka = dane ? zapisanaDzialka(dane, decydujCene(dane.valuation, dane.mpzp)) : null;

  return (
    <div className="w-full">
      <section className="relative w-full overflow-hidden">
        <HeroGradientBg />

        <div className="relative z-10 flex flex-col items-center px-4 py-10 md:py-14">
          <div className="mb-7 w-full max-w-2xl text-center md:mb-9">
            <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-fg md:text-[42px]">
              Sprawdź wartość swojej działki
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-fg/70 md:text-base">
              Podaj numer działki albo wskaż ją na mapie. Pokażemy ceny z okolicy, za darmo.
            </p>
          </div>

          <div className="w-full max-w-2xl rounded-2xl border border-fg/10 bg-surface-2/78 p-5 backdrop-blur-sm md:p-8">
            {zLinku ? (
              <p className="text-[14px] leading-6 text-fg/65">Wczytujemy działkę…</p>
            ) : (
              <>
                {bladLinku ? (
                  <p className="mb-5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {bladLinku}
                  </p>
                ) : null}
                <ParcelFinder onFound={setDane} oznaczWymagane={false} />
              </>
            )}
          </div>
        </div>
      </section>

      {dane && dzialka ? (
        <div ref={wynikRef} className="mx-auto max-w-3xl scroll-mt-24 space-y-6 px-6 pb-6 pt-12 md:px-10">
          <KartaDzialki
            dzialka={dzialka}
            miejscowosc={nazwaMiejscowosci(dane.parcel)}
            wariant="wycena"
            onZmien={() => {
              setDane(null);
              setBladLinku(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          {dzialka.podpowiedz ? (
            <PodpowiedzCenyBox podpowiedz={dzialka.podpowiedz} cenaPln={NaN} powierzchniaM2={dzialka.areaM2} />
          ) : (
            <div className="rounded-2xl border border-fg/12 bg-fg/[0.03] px-4 py-3 text-[14px] leading-6 text-fg/70 md:px-5">
              W okolicy jest za mało ofert i transakcji, żeby uczciwie podać cenę.
            </div>
          )}

          <div className="rounded-3xl border border-brand/30 bg-brand/[0.07] p-6 md:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">Sprzedajesz tę działkę?</h2>
            <p className="mt-2 text-[15px] leading-7 text-fg/72">
              Wystaw ją za darmo. Dane działki uzupełnimy za Ciebie.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/sprzedaj?d=${encodeURIComponent(dane.parcel.id)}`}
                className="inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Wystaw działkę za darmo
              </Link>
              <Link
                href={`/sprawdz-dzialke?d=${encodeURIComponent(dane.parcel.id)}`}
                className="inline-flex items-center justify-center rounded-2xl border border-fg/15 bg-fg/[0.03] px-6 py-3 text-sm font-semibold text-fg transition hover:border-fg/30 hover:bg-fg/[0.05]"
              >
                Pełny raport działki
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
