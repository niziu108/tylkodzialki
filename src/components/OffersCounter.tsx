'use client';

import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function fmt(n: number): string {
  return n.toLocaleString('pl-PL');
}

/**
 * Licznik ofert dla hero /partnerstwo. Animacja jak AgencyCounter na /dla-biur:
 * rośnie od zera do aktualnej liczby ofert przy wejściu na stronę.
 */
export default function OffersCounter({ target }: { target: number }) {
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
    <div className="flex flex-col items-start leading-none">
      <span className="text-[18px] font-medium text-fg/80 md:text-[22px] lg:text-[26px]">
        W bazie już
      </span>

      <span
        className="mt-2 tabular-nums text-[72px] font-bold text-brand md:text-[110px] lg:text-[140px]"
        aria-live="polite"
        aria-atomic="true"
      >
        {fmt(value)}
      </span>

      <span className="mt-1 text-[13px] uppercase tracking-[0.26em] text-brand-text md:text-[16px] lg:text-[18px]">
        ofert działek
      </span>
    </div>
  );
}
