type Props = {
  className?: string;
};

/**
 * Logo marki = `public/logomail.png` (litery w grubości zielonego „d", od 21.09.2026).
 * JEDEN plik używany wszędzie: menu, stopka, mobile (oraz maile przez ten sam plik).
 * Podmiana `public/logomail.png` = zmiana logo w całym serwisie i mailach naraz
 * (przy podmianie podbij `?v=`, bo przeglądarki i CDN trzymają stary plik kilka godzin).
 * `className` steruje wysokością (np. h-10), szerokość auto. `object-contain`: gdy flex
 * ściśnie obrazek (wąski tablet z pełnym menu), logo się zmniejsza, a nie rozciąga.
 */
export default function Logo({ className = '' }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logomail.png?v=3"
      alt="tylkodzialki.pl"
      className={`w-auto select-none object-contain object-left ${className}`}
      draggable={false}
    />
  );
}
