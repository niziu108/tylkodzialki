// Komponent SERWEROWY, jak HeroCounter: liczba biur stoi od razu w HTML. Wcześniej rosła od zera
// po stronie klienta, więc roboty bez JavaScriptu (w tym ChatGPT) czytały „Zaufało nam 0 biur".
// Świadomie bez animacji count-up. Układ: "Zaufało nam" / liczba / "biur nieruchomości".

function fmt(n: number): string {
  return n.toLocaleString('pl-PL');
}

// 1 biuro / 2-4 biura (bez 12-14) / 5+ biur. Wcześniej zawsze „biur", czyli „153 biur".
export function odmianaBiur(n: number): string {
  const d = n % 10;
  const s = n % 100;
  if (n === 1) return 'biuro';
  if (d >= 2 && d <= 4 && !(s >= 12 && s <= 14)) return 'biura';
  return 'biur';
}

export default function AgencyCounter({ target }: { target: number }) {
  return (
    <div className="flex flex-col items-start leading-none">
      <span className="text-[18px] font-medium text-fg/80 md:text-[22px] lg:text-[26px]">
        Zaufało nam
      </span>

      <span className="mt-2 tabular-nums text-[88px] font-bold text-brand-strong md:text-[120px] lg:text-[150px]">
        {fmt(target)}
      </span>

      <span className="mt-1 text-[13px] uppercase tracking-[0.26em] text-brand-text md:text-[16px] lg:text-[18px]">
        {odmianaBiur(target)} nieruchomości
      </span>
    </div>
  );
}
