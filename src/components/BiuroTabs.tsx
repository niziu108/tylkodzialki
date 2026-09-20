'use client';

import { useState, type ReactNode } from 'react';

/* Zakładki wizytówki — ten sam język, co w panelu klienta: rząd etykiet i podkreślenie
 * pod aktywną, bez pigułek i kafelków. W panelu przełączają się linkiem `?tab=`, tu
 * stanem, żeby zmiana zakładki nie przeładowywała listy ofert pod spodem. */
export type BiuroTab = {
  key: string;
  label: string;
  content: ReactNode;
  /** Zakładka tylko na wąskim ekranie: od `lg` jej treść stoi już w kolumnie obok. */
  tylkoMobile?: boolean;
};

export default function BiuroTabs({ tabs }: { tabs: BiuroTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');

  if (!tabs.length) return null;

  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  /* Zakładka mobilna nie ma od `lg` własnego przycisku, więc gdyby ktoś rozciągnął okno
   * z telefonu na desktop (albo obrócił tablet), zostałby panel bez etykiety nad nim.
   * Zamiast nasłuchiwać szerokości okna w JS trzymamy wtedy w DOM oba panele i
   * przełączamy je klasą: wąsko widać wybraną zakładkę, szeroko pierwszą zwykłą. */
  const zapasowa = current.tylkoMobile ? tabs.find((t) => !t.tylkoMobile) ?? null : null;

  return (
    <div>
      <div className="border-b border-fg/12">
        <div className="flex flex-wrap justify-center gap-7 text-[15px] md:text-[16px]">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`pb-4 transition ${t.tylkoMobile ? 'lg:hidden ' : ''}${
                current.key === t.key
                  ? 'border-b-2 border-brand text-fg'
                  : 'text-fg/68 hover:text-fg'
              }${
                // Ta sama sytuacja co przy `zapasowa`: szeroko to jej panel jest na wierzchu,
                // więc podkreślenie musi przeskoczyć na nią, żeby pasek nie został bez aktywnej.
                zapasowa?.key === t.key ? ' lg:border-b-2 lg:border-brand lg:text-fg' : ''
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-8">
        <div className={zapasowa ? 'lg:hidden' : undefined}>{current.content}</div>
        {zapasowa ? <div className="hidden lg:block">{zapasowa.content}</div> : null}
      </div>
    </div>
  );
}
