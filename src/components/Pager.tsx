"use client";

import React, { useMemo } from "react";

// Pager identyczny z tym na /kup (mobile: strzałki + numery z „…", desktop:
// Poprzednia N/M Następna + „Idź do"). Wyciągnięty do współdzielonego komponentu,
// żeby blog miał 1:1 ten sam wygląd i zachowanie co lista ofert.

function buildMobilePages(page: number, total: number): Array<number | "…"> {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, "…", total];
  if (page >= total - 2) return [1, "…", total - 3, total - 2, total - 1, total];
  return [1, "…", page - 1, page, page + 1, "…", total];
}

export default function Pager({
  page,
  totalPages,
  onPrev,
  onNext,
  onGo,
  className,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onGo: (p: number) => void;
  className?: string;
}) {
  const [val, setVal] = React.useState(String(page));

  React.useEffect(() => {
    setVal(String(page));
  }, [page]);

  const go = () => {
    const n = Number(String(val).replace(/[^\d]/g, ""));
    if (!Number.isFinite(n)) return;
    onGo(Math.max(1, Math.min(totalPages, n)));
  };

  const mobilePages = useMemo(() => buildMobilePages(page, totalPages), [page, totalPages]);

  return (
    <div className={className || ""}>
      <div className="md:hidden">
        <div className="flex w-full max-w-full items-center justify-center gap-1 overflow-hidden px-0">
          <button
            type="button"
            onClick={onPrev}
            disabled={page <= 1}
            aria-label="Poprzednia strona"
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[30px] leading-none transition",
              page <= 1 ? "text-fg/25" : "text-fg/80 hover:bg-fg/10 hover:text-fg",
            ].join(" ")}
          >
            ‹
          </button>

          <div className="flex min-w-0 items-center justify-center gap-1">
            {mobilePages.map((x, idx) => {
              if (x === "…") {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="shrink-0 px-0.5 text-[13px] tracking-[0.04em] text-fg/62"
                  >
                    …
                  </span>
                );
              }

              const active = x === page;

              return (
                <button
                  key={x}
                  type="button"
                  onClick={() => onGo(x)}
                  className={[
                    "shrink-0 min-w-[25px] px-1 text-center text-[13px] tracking-[0.04em] transition",
                    active ? "font-semibold text-brand" : "text-fg/72 hover:text-fg",
                  ].join(" ")}
                  style={{
                    // tylko `color` w przejściu — animacja text-decoration-color
                    // zacina się w Chromium na wartości startowej (podkreślenie znika)
                    transitionProperty: "color",
                    textDecoration: active ? "underline" : "none",
                    textUnderlineOffset: "8px",
                    textDecorationThickness: "2px",
                    textDecorationColor: active ? "var(--brand)" : "transparent",
                  }}
                >
                  {x}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={page >= totalPages}
            aria-label="Następna strona"
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[30px] leading-none transition",
              page >= totalPages ? "text-fg/25" : "text-fg/80 hover:bg-fg/10 hover:text-fg",
            ].join(" ")}
          >
            ›
          </button>
        </div>
      </div>

      <div className="hidden md:flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={onPrev}
            disabled={page <= 1}
            className={[
              "text-[12px] tracking-[0.22em] uppercase transition",
              page <= 1 ? "text-fg/30" : "text-fg/70 hover:text-fg",
            ].join(" ")}
            style={{
              transitionProperty: "color",
              textDecoration: "underline",
              textUnderlineOffset: "10px",
              textDecorationThickness: "1px",
              textDecorationColor: page <= 1 ? "var(--line)" : "var(--line-strong)",
            }}
          >
            Poprzednia
          </button>

          <div className="text-fg/70 text-[12px] tracking-[0.22em] uppercase">
            <span className="font-semibold text-brand">{page}</span>/{totalPages}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={page >= totalPages}
            className={[
              "text-[12px] tracking-[0.22em] uppercase transition",
              page >= totalPages ? "text-fg/30" : "text-fg/70 hover:text-fg",
            ].join(" ")}
            style={{
              transitionProperty: "color",
              textDecoration: "underline",
              textUnderlineOffset: "10px",
              textDecorationThickness: "1px",
              textDecorationColor: page >= totalPages ? "var(--line)" : "var(--line-strong)",
            }}
          >
            Następna
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-fg/62 text-[11px] tracking-[0.22em] uppercase">Idź do</div>

          <input
            value={val}
            onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className="w-[72px] rounded-xl border border-fg/20 bg-transparent px-3 py-2 text-center text-[13px] text-fg/85 outline-none focus:border-fg/45 selection:bg-fg/20 selection:text-fg"
            placeholder="…"
            onKeyDown={(e) => {
              if (e.key === "Enter") go();
            }}
          />

          <button
            type="button"
            onClick={go}
            className="rounded-xl border border-fg/20 px-3 py-2 text-[11px] tracking-[0.22em] uppercase text-fg/75 transition hover:border-fg/40"
          >
            Idź
          </button>
        </div>
      </div>
    </div>
  );
}
