// Komponent SERWEROWY: liczba ofert renderuje się od razu w HTML (jest elementem
// w pierwszym malowaniu, nie czeka na pobranie i hydrację JS). Wcześniej licził od
// zera po stronie klienta (animacja), przez co duża liczba pojawiała się dopiero po
// doładowaniu JS i podbijała LCP na wolnym mobile. Świadomie bez animacji count-up.

function fmt(n: number): string {
  return n.toLocaleString('pl-PL');
}

export default function HeroCounter({
  target,
  tone = 'onDark',
}: {
  target: number;
  tone?: 'onDark' | 'onLight';
}) {
  const isLight = tone === 'onLight';

  return (
    <div className="mt-4 flex flex-col items-center leading-none">
      <span
        className={`tabular-nums text-[44px] font-bold md:text-[56px] ${
          isLight
            ? 'text-brand'
            : 'text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.45)]'
        }`}
      >
        {fmt(target)}
      </span>
      <span
        className={`mt-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] ${
          isLight
            ? 'text-fg/70'
            : 'text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]'
        }`}
      >
        ofert w całej Polsce
      </span>
    </div>
  );
}
