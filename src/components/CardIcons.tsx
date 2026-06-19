// Dopracowany zestaw ikon kart (styl Lucide: outline, stroke 1.6, zaokrąglone końce).
// Spójna geometria i optyczne wyważenie — ma wyglądać jak w dopracowanej aplikacji,
// nie jak klipart. Bez 'use client' → serwer i klient. Rozmiar/kolor z klas. Dekoracyjne.

type IconProps = { className?: string };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** Lokalizacja — pinezka. */
export function IconPin({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21c-4.4-4.1-7-7.5-7-11a7 7 0 1 1 14 0c0 3.5-2.6 6.9-7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

/** Powierzchnia — narożniki kadru (działka/obszar). */
export function IconArea({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9V6a2 2 0 0 1 2-2h3" />
      <path d="M15 4h3a2 2 0 0 1 2 2v3" />
      <path d="M20 15v3a2 2 0 0 1-2 2h-3" />
      <path d="M9 20H6a2 2 0 0 1-2-2v-3" />
    </svg>
  );
}

/** Przeznaczenie — etykieta. */
export function IconTag({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 13.4V5a1 1 0 0 1 1-1h8.4a1 1 0 0 1 .7.3l6.6 6.6a1 1 0 0 1 0 1.4l-6.6 6.6a1 1 0 0 1-1.4 0L4.3 14.1a1 1 0 0 1-.3-.7Z" />
      <circle cx="8" cy="8" r="1.2" />
    </svg>
  );
}

/** Media/uzbrojenie — wtyczka. */
export function IconPlug({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 2.5v5" />
      <path d="M15 2.5v5" />
      <path d="M6.5 7.5h11v3.5a5.5 5.5 0 0 1-11 0V7.5Z" />
      <path d="M12 16.5V21.5" />
    </svg>
  );
}

/** Licznik zdjęć — aparat. */
export function IconCamera({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8a2 2 0 0 1 2-2h1.4l1-1.6a1 1 0 0 1 .85-.47h5.5a1 1 0 0 1 .85.47L16.6 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}
