/* Znak partnera strategicznego. Jedno źródło prawdy dla trzech miejsc, w których się pojawia:
 * wizytówki biura, karty oferty na liście i strony ogłoszenia.
 *
 * Świadomie NIE jest to pigułka ani kafelek. Znak siedzi na podkreśleniu w kolorze marki,
 * tak jak wiersze specyfikacji i linki w reszcie serwisu — ma czytać się jak pieczęć, a nie
 * jak naklejka promocyjna. Przy 800 ofertach jednego partnera kolorowa plakietka zamieniłaby
 * listę wyników w choinkę, a cienka linia znosi tę skalę bez szkody.
 *
 * Dwa warianty. `hero` na wizytówce, gdzie znak jest deklaracją i ma być widoczny od progu.
 * `inline` przy ofertach, gdzie ZASTĘPUJE zwykłe „Oferta biura nieruchomości", zamiast dokładać
 * kolejny wiersz — ta sama linia, mocniejsza treść.
 */

export function PartnerBadge({
  variant = 'inline',
  className = '',
}: {
  variant?: 'hero' | 'inline';
  className?: string;
}) {
  if (variant === 'hero') {
    return (
      <span
        className={`inline-block border-b-2 border-brand pb-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-text ${className}`}
      >
        Partner strategiczny
      </span>
    );
  }

  return (
    <span
      className={`inline-block border-b border-brand/70 pb-0.5 text-[12px] font-medium uppercase tracking-[0.14em] text-brand-text ${className}`}
    >
      Partner strategiczny
    </span>
  );
}
