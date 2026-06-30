// Logo biura wprost na tle strony — bez ramki i bez kafla.
// Decyzja właściciela: żadnej automatycznej zmiany koloru tła pod logo
// (wcześniej białe logo dostawało ciemny kafel). Oryginalny plik nietknięty.

const VARIANTS = {
  // Stopka karty oferty (lista / mapa / podobne).
  card: 'h-7 w-auto max-w-[112px]',
  // Strona oferty — większy logotyp.
  detail: 'h-16 w-auto max-w-[140px]',
  // Podgląd w panelu / adminie.
  preview: 'h-9 w-auto max-w-[160px]',
} as const;

export function OfficeLogo({
  src,
  alt = '',
  variant = 'card',
  eager = false,
  bg = false,
}: {
  src: string;
  alt?: string;
  variant?: keyof typeof VARIANTS;
  eager?: boolean;
  // Ciemne tło pod logo (biura z białym/jasnym logotypem). Ustawiane na koncie biura.
  bg?: boolean;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center ${
        bg ? 'rounded-lg bg-[#111111] px-2.5 py-1.5' : ''
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`${VARIANTS[variant]} object-contain`}
        loading={eager ? 'eager' : 'lazy'}
      />
    </span>
  );
}
