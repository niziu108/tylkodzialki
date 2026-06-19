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

/** Przeznaczenie — warstwy (klasyfikacja/typ działki). */
export function IconLayers({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
      <path d="M3 12l9 4.5 9-4.5" />
      <path d="M3 16.5l9 4.5 9-4.5" />
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

/** Sprzedawca prywatny — osoba. */
export function IconUser({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

/** Biuro nieruchomości — budynek. */
export function IconBuilding({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="6" y="3" width="12" height="18" rx="1.2" />
      <path d="M3.5 21h17" />
      <path d="M9.5 7.5h.01M14.5 7.5h.01M9.5 11.5h.01M14.5 11.5h.01" />
      <path d="M10 21v-2.6a2 2 0 0 1 4 0V21" />
    </svg>
  );
}
