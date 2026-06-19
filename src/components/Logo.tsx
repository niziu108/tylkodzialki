type Props = {
  className?: string;
};

/**
 * Logo marki = `public/logomail.png` (wordmark zaprojektowany przez właściciela).
 * JEDEN plik używany wszędzie: menu, stopka, mobile (oraz maile przez ten sam plik).
 * Podmiana `public/logomail.png` = zmiana logo w całym serwisie i mailach naraz.
 * `className` steruje wysokością (np. h-10), szerokość auto.
 */
export default function Logo({ className = '' }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/logomail.png"
      alt="tylkodzialki.pl"
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  );
}
