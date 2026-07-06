// Wspólne tło hero (główna, /kup, /sprawdź działkę): lekki gradient jak na
// /dla-biur zamiast zdjęcia — siatka + zielone poświaty. Zero ciężkiego obrazu,
// więc LCP to tekst => pewny, wysoki wynik szybkości także na mobilnym LTE.
//
// Na desktopie (md:) poświaty są BOGATSZE i we wszystkich 4 rogach, żeby duże
// pole widzenia nie było pustą białą płachtą (właściciel: „za biało na kompie").
// Na mobile delikatniejsze, bo pole jest wąskie.
export default function HeroGradientBg() {
  return (
    <>
      {/* subtelna siatka */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] opacity-35" />

      {/* poświaty — mobile: delikatne, dwa narożniki */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_15%,rgba(122,163,51,0.18),transparent_36%),radial-gradient(circle_at_82%_82%,rgba(47,94,70,0.06),transparent_34%)] md:hidden" />

      {/* poświaty — desktop: mocniejsze, wszystkie 4 rogi (mniej bieli) */}
      <div className="pointer-events-none absolute inset-0 z-0 hidden bg-[radial-gradient(circle_at_10%_12%,rgba(122,163,51,0.26),transparent_36%),radial-gradient(circle_at_90%_14%,rgba(122,163,51,0.16),transparent_32%),radial-gradient(circle_at_8%_90%,rgba(47,94,70,0.12),transparent_36%),radial-gradient(circle_at_92%_88%,rgba(122,163,51,0.2),transparent_34%)] md:block" />

      {/* miękka plama brandu w rogu */}
      <div className="pointer-events-none absolute left-[-140px] top-24 z-0 h-[420px] w-[420px] rounded-full bg-brand/10 blur-[120px] md:h-[560px] md:w-[560px]" />
    </>
  );
}
