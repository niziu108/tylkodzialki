// Komponent SERWEROWY: liczba ofert renderuje się od razu w HTML (jest elementem
// w pierwszym malowaniu, nie czeka na pobranie i hydrację JS). Wcześniej licził od
// zera po stronie klienta (animacja), przez co duża liczba pojawiała się dopiero po
// doładowaniu JS i podbijała LCP na wolnym mobile. Świadomie bez animacji count-up.

// Poniżej tego progu linijki o nowych ofertach nie pokazujemy: mała liczba nic nie mówi
// kupującemu, a liczba zawsze jest prawdziwa (ostatnie 7 dni), nie wybieramy „ładnych".
const PROG_NOWYCH = 50;

function fmt(n: number): string {
  return n.toLocaleString('pl-PL');
}

export default function HeroCounter({
  target,
  tone = 'onDark',
  noweTydzien = 0,
}: {
  target: number;
  tone?: 'onDark' | 'onLight';
  noweTydzien?: number;
}) {
  const isLight = tone === 'onLight';

  return (
    <div className="mt-4 flex flex-col items-center leading-none">
      <span
        className={`tabular-nums text-[44px] font-bold md:text-[40px] ${
          isLight
            ? 'text-brand-strong'
            : 'text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.45)]'
        }`}
      >
        {fmt(target)}
      </span>
      <span
        className={`mt-1.5 text-[12px] font-semibold uppercase tracking-[0.28em] ${
          isLight
            ? 'text-fg/70'
            : 'text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]'
        }`}
      >
        ofert w całej Polsce
      </span>
      {noweTydzien >= PROG_NOWYCH ? (
        <span className={`mt-2.5 text-[13px] font-medium ${isLight ? 'text-brand-text' : 'text-white/90'}`}>
          +{fmt(noweTydzien)} nowych w tym tygodniu
        </span>
      ) : null}
    </div>
  );
}
