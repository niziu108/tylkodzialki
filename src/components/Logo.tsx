type Props = {
  className?: string;
};

/**
 * Wordmark marki: „tylkodzialki.pl" jako żywy tekst (krój Jost, cienki).
 * Zielone „d" to sygnatura marki; pozostałe litery dziedziczą kolor tekstu
 * (text-fg), więc logo само dopasowuje się do motywu (jasny/ciemny) bez
 * podmiany pliku graficznego. Domena pisana „działki" (poprawna polszczyzna),
 * mimo że adres jest ASCII „dzialki".
 */
export default function Logo({ className = '' }: Props) {
  return (
    <span
      aria-label="tylkodzialki.pl"
      className={`font-logo select-none lowercase leading-none tracking-[0.005em] text-fg ${className}`}
    >
      <span className="font-light">tylko</span>
      <span className="font-black text-brand">d</span>
      <span className="font-light">ziałki.pl</span>
    </span>
  );
}
