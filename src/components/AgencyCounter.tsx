'use client';

import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function fmt(n: number): string {
  return n.toLocaleString('pl-PL');
}

/**
 * Licznik biur dla hero /dla-biur. Wizualnie i animacyjnie jak HeroCounter:
 * ładuje się od zera na mount. Układ: "Zaufało nam" / liczba / "biur nieruchomości".
 */
export default function AgencyCounter({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target <= 0) return;

    const duration = 1800;
    const startTime = performance.now();

    function tick(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      setValue(Math.round(easeOutExpo(t) * target));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return (
    <div className="flex flex-col items-center leading-none">
      <span className="text-[17px] font-medium text-white/90 [text-shadow:0_2px_10px_rgba(0,0,0,0.45)] md:text-[20px]">
        Zaufało nam
      </span>

      <span
        className="mt-3 tabular-nums text-[64px] font-bold text-white [text-shadow:0_3px_16px_rgba(0,0,0,0.5)] md:text-[88px]"
        aria-live="polite"
        aria-atomic="true"
      >
        {fmt(value)}
      </span>

      <span className="mt-2 text-[11px] uppercase tracking-[0.28em] text-[#9fd14b] [text-shadow:0_1px_4px_rgba(0,0,0,0.55)] md:text-[13px]">
        biur nieruchomości
      </span>
    </div>
  );
}
