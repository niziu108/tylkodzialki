// Komponent SERWEROWY, jak HeroCounter: liczba ofert stoi od razu w HTML. Wcześniej rosła od zera
// po stronie klienta, więc roboty bez JavaScriptu czytały „W bazie już 0 ofert".
// Świadomie bez animacji count-up. Układ: "W bazie już" / liczba / "ofert działek".

function fmt(n: number): string {
  return n.toLocaleString('pl-PL');
}

export default function OffersCounter({ target }: { target: number }) {
  return (
    <div className="flex flex-col items-start leading-none">
      <span className="text-[18px] font-medium text-fg/80 md:text-[22px] lg:text-[26px]">
        W bazie już
      </span>

      <span className="mt-2 tabular-nums text-[72px] font-bold text-brand md:text-[110px] lg:text-[140px]">
        {fmt(target)}
      </span>

      <span className="mt-1 text-[13px] uppercase tracking-[0.26em] text-brand-text md:text-[16px] lg:text-[18px]">
        ofert działek
      </span>
    </div>
  );
}
