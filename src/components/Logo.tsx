import { LOGO } from '@/lib/logoWordmark';

type Props = {
  className?: string;
};

/**
 * Logo marki jako wektor: ostre na każdym ekranie, także na zwykłym monitorze, gdzie pomniejszany
 * PNG rozmywał cienkie litery. Rysunek i proporcje pola są te same co w `public/logomail.png`
 * (ten plik idzie do maili, faktur i PDF-ów), oba generuje lokalny `scripts/_logo.cjs`.
 * `className` steruje wysokością (np. h-10), szerokość wynika z proporcji. Gdy flex ściśnie logo
 * (wąski tablet z pełnym menu), rysunek się zmniejsza przy lewej krawędzi, a nie rozciąga.
 */
export default function Logo({ className = '' }: Props) {
  return (
    <svg
      viewBox={LOGO.viewBox}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label="tylkodzialki.pl"
      className={`w-auto max-w-full select-none ${className}`}
      style={{ aspectRatio: LOGO.ratio }}
    >
      <path d={LOGO.letters} fill="#131313" fillRule="evenodd" />
      <path d={LOGO.d} fill="#7aa333" fillRule="evenodd" />
    </svg>
  );
}
