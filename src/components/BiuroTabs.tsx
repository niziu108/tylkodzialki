'use client';

import { useState, type ReactNode } from 'react';

/* Zakładki wizytówki — ten sam język, co w panelu klienta: rząd etykiet i podkreślenie
 * pod aktywną, bez pigułek i kafelków. W panelu przełączają się linkiem `?tab=`, tu
 * stanem, żeby zmiana zakładki nie przeładowywała listy ofert pod spodem. */
export type BiuroTab = { key: string; label: string; content: ReactNode };

export default function BiuroTabs({ tabs }: { tabs: BiuroTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');

  if (!tabs.length) return null;

  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div className="border-b border-fg/12">
        <div className="flex flex-wrap justify-center gap-7 text-[15px] md:text-[16px]">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`pb-4 transition ${
                current.key === t.key
                  ? 'border-b-2 border-brand text-fg'
                  : 'text-fg/68 hover:text-fg'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-8">{current.content}</div>
    </div>
  );
}
