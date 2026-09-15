// Komponent SERWEROWY, jak HeroCounter: liczba biur stoi od razu w HTML. Wcześniej rosła od zera
// po stronie klienta, więc roboty bez JavaScriptu (w tym ChatGPT) czytały „Zaufało nam 0 biur".
// Świadomie bez animacji count-up. Układ: "Zaufało nam" / liczba / "biur nieruchomości".

function fmt(n: number): string {
  return n.toLocaleString('pl-PL');
}

export default function AgencyCounter({ target }: { target: number }) {
  return (
    <div className="flex flex-col items-start leading-none">
      <span className="text-[18px] font-medium text-fg/80 md:text-[22px] lg:text-[26px]">
        Zaufało nam
      </span>

      <span className="mt-2 tabular-nums text-[88px] font-bold text-brand md:text-[120px] lg:text-[150px]">
        {fmt(target)}
      </span>

      <span className="mt-1 text-[13px] uppercase tracking-[0.26em] text-brand-text md:text-[16px] lg:text-[18px]">
        biur nieruchomości
      </span>
    </div>
  );
}
