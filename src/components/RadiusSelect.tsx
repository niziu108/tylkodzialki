'use client';

// Własny dropdown „Zasięg" zamiast natywnego <select>. Powód: natywny popup
// <select> w Chrome maluje podświetlenie aktywnej/hover opcji własnym systemowym
// niebieskim, którego nie da się pokryć CSS-em (accent-color koloruje tylko
// :checked). Tu mamy pełną kontrolę — podświetlenie leci naszą zielenią (bg-brand).
// Dostępność: rola listbox/option, aria-expanded/selected, obsługa klawiatury
// (strzałki, Enter/Spacja, Esc, Home/End) i zamknięcie po kliknięciu poza.

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
  className?: string;
  format?: (v: number) => string;
  ariaLabel?: string;
};

export default function RadiusSelect({
  value,
  options,
  onChange,
  className = '',
  format = (v) => `+ ${v} km`,
  ariaLabel = 'Zasięg',
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.indexOf(value)));
  const rootRef = useRef<HTMLDivElement>(null);

  // zamknięcie po kliknięciu poza komponentem
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // przy otwarciu ustaw aktywną pozycję na aktualnie zaznaczoną
  useEffect(() => {
    if (open) setActiveIndex(Math.max(0, options.indexOf(value)));
  }, [open, value, options]);

  const commit = (i: number) => {
    const v = options[i];
    if (v != null) onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between rounded-xl border border-fg/25 bg-transparent px-4 py-3 text-left text-fg/90 outline-none transition focus-visible:border-fg/45"
      >
        <span>{format(value)}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-fg/50 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-xl border border-fg/15 bg-bg py-1 shadow-[0_16px_40px_rgba(0,0,0,0.14)]"
        >
          {options.map((opt, i) => {
            const selected = opt === value;
            const active = i === activeIndex;
            return (
              <li
                key={opt}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(i)}
                className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                  active ? 'bg-brand/20 text-fg' : 'text-fg/85'
                }`}
              >
                <span className={selected ? 'font-semibold' : ''}>{format(opt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
