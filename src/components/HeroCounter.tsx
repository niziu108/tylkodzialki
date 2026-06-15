'use client';

import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function fmt(n: number): string {
  return n.toLocaleString('pl-PL');
}

export default function HeroCounter({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target <= 0) return;

    const duration = 1800;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(t);

      setValue(Math.round(eased * target));

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
    <div className="mt-5 flex flex-col items-center leading-none">
      <span
        className="tabular-nums text-[52px] font-bold text-white md:text-[68px]"
        aria-live="polite"
        aria-atomic="true"
      >
        {fmt(value)}
      </span>
      <span className="mt-1.5 text-[10px] uppercase tracking-[0.32em] text-white/48">
        ofert
      </span>
    </div>
  );
}
