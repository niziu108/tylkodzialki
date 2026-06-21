'use client';

import { useEffect, useRef } from 'react';

/**
 * Warstwa, która na TELEFONIE napełnia białą sekcję zielenią w miarę scrolla.
 * Zieleń wstaje od dołu i robi się coraz mocniejsza („cień coraz bardziej").
 *
 * Sam render to przezroczysty gradient sterowany zmienną --p (0..1); całą
 * matematykę robi globalny .scrollfill w globals.css. Na desktopie i przy
 * prefers-reduced-motion --p zostaje 0, więc warstwa jest niewidoczna.
 *
 * Wkładamy <ScrollFill /> jako warstwę wewnątrz sekcji (sekcja musi być
 * position: relative). Mierzymy rodzica, więc nie trzeba podawać refów z page.
 */
export default function ScrollFill({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const section = el?.parentElement;
    if (!el || !section) return;

    const mqMobile = window.matchMedia('(max-width: 767px)');
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let raf = 0;
    let active = false;

    const update = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 1;

      // p rośnie od 0 (sekcja dopiero wjeżdża od dołu) do 1 (przewinięta przez
      // ekran). Pełna zieleń mniej więcej wtedy, gdy widać już całą sekcję.
      const span = rect.height + vh * 0.15;
      const traveled = vh - rect.top;
      let p = traveled / span;
      if (p < 0) p = 0;
      else if (p > 1) p = 1;

      el.style.setProperty('--p', p.toFixed(3));
    };

    const onScroll = () => {
      if (active && !raf) raf = requestAnimationFrame(update);
    };

    const apply = () => {
      active = mqMobile.matches && !mqReduce.matches;
      if (active) {
        update();
      } else {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        el.style.setProperty('--p', '0');
      }
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', apply, { passive: true });
    mqMobile.addEventListener?.('change', apply);
    mqReduce.addEventListener?.('change', apply);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', apply);
      mqMobile.removeEventListener?.('change', apply);
      mqReduce.removeEventListener?.('change', apply);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`scrollfill pointer-events-none absolute inset-0 z-0 ${className}`}
    />
  );
}
