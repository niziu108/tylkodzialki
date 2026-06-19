"use client";

import { useState } from "react";
import type { TocHeading } from "@/lib/articleToc";

// Spis treści. Desktop: zawsze rozwinięty (md:block wymusza widoczność,
// niezależnie od stanu — brak skoku układu i niezgodności hydracji).
// Mobile: domyślnie zwinięty, rozwijany przyciskiem.
export default function ArticleToc({ headings }: { headings: TocHeading[] }) {
  const [open, setOpen] = useState(false);

  if (headings.length < 3) return null;

  return (
    <nav className="mb-10 rounded-2xl border border-fg/10 bg-fg/[0.03] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-bright">
          Spis treści
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="text-sm text-fg/62 transition hover:text-fg md:hidden"
        >
          {open ? "Zwiń" : "Rozwiń"}
        </button>
      </div>

      <ol
        className={`mt-4 space-y-2.5 md:block ${open ? "block" : "hidden"}`}
      >
        {headings.map((h, i) => (
          <li key={h.id} className="flex gap-3">
            <span className="text-sm font-semibold text-brand-text/70">
              {String(i + 1).padStart(2, "0")}
            </span>
            <a
              href={`#${h.id}`}
              className="text-[15px] leading-6 text-fg/70 transition hover:text-fg"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
