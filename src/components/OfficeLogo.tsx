'use client';

// Logo biura na kaflu w kolorze PRZECIWNYM do samego logo:
//  - jasne/białe logo -> ciemny kafel (widać je na jasnym motywie),
//  - ciemne/kolorowe   -> biały kafel (widać je też w trybie ciemnym).
// Ton wykrywa serwerowy endpoint /api/logo-tone (omija CORS, ogarnia SVG).
// Oryginalny plik logo zostaje nietknięty — to tylko nakładka w UI.

import { useEffect, useState } from 'react';

type Tone = 'light' | 'dark';

// Pamięć tonu między kartami i renderami — lista nie odpytuje API w kółko,
// a te same logotypy (domyślne biura) liczone są raz.
const toneMemo = new Map<string, Tone>();
const inFlight = new Map<string, Promise<Tone>>();

function loadTone(src: string): Promise<Tone> {
  const memo = toneMemo.get(src);
  if (memo) return Promise.resolve(memo);

  const pending = inFlight.get(src);
  if (pending) return pending;

  const p = (async () => {
    try {
      const res = await fetch(`/api/logo-tone?u=${encodeURIComponent(src)}`);
      const json = (await res.json()) as { tone?: Tone };
      const tone: Tone = json.tone === 'light' ? 'light' : 'dark';
      toneMemo.set(src, tone);
      return tone;
    } catch {
      toneMemo.set(src, 'dark');
      return 'dark';
    } finally {
      inFlight.delete(src);
    }
  })();

  inFlight.set(src, p);
  return p;
}

const VARIANTS = {
  // Stopka karty oferty (lista / mapa / podobne).
  card: { wrap: 'rounded-lg px-1.5 py-1', img: 'h-7 w-auto max-w-[112px]' },
  // Strona oferty — większy kafel jak dotychczasowa ramka.
  detail: { wrap: 'rounded-2xl p-3', img: 'h-16 w-auto max-w-[140px]' },
  // Podgląd w panelu / adminie.
  preview: { wrap: 'rounded-xl p-2', img: 'h-9 w-auto max-w-[160px]' },
} as const;

export function OfficeLogo({
  src,
  alt = '',
  variant = 'card',
  eager = false,
}: {
  src: string;
  alt?: string;
  variant?: keyof typeof VARIANTS;
  eager?: boolean;
}) {
  // Start zawsze od 'dark' (biały kafel) — zgodnie z SSR, bez rozjazdu hydracji.
  const [tone, setTone] = useState<Tone>('dark');

  useEffect(() => {
    let active = true;
    loadTone(src).then((t) => {
      if (active) setTone(t);
    });
    return () => {
      active = false;
    };
  }, [src]);

  const v = VARIANTS[variant];
  const tileLight = tone === 'dark'; // ciemne logo -> jasny kafel i odwrotnie

  return (
    <span
      className={`inline-flex w-fit items-center justify-center overflow-hidden border transition-colors ${v.wrap} ${
        tileLight ? 'border-black/10 bg-white' : 'border-white/10 bg-[#1b1b16]'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`${v.img} object-contain`}
        loading={eager ? 'eager' : 'lazy'}
      />
    </span>
  );
}
