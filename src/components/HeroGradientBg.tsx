// Wspólne tło hero (główna, /kup, /sprawdź działkę, /blog): lekki gradient
// zamiast zdjęcia — zero ciężkiego obrazu, więc LCP to tekst => pewny, wysoki
// wynik szybkości także na mobilnym LTE.
//
// Styl „premium/minimalizm": zamiast plamistych poświat w rogach (rozjeżdżały
// się na szerokim ekranie) — jeden RÓWNOMIERNY, delikatny tint zieleni od góry
// + miękki SPOTLIGHT na środku u góry, żeby oko miało fokus za nagłówkiem.
// Ten sam język na mobile i desktopie (na desktopie spotlight węższy = pula
// światła, nie rozlana płachta).
export default function HeroGradientBg() {
  return (
    <>
      {/* subtelna siatka (DNA /dla-biur) — ledwie widoczna tekstura */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:54px_54px] opacity-30" />

      {/* równomierny, delikatny tint zieleni od góry — jeden kierunek, bez plam */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(122,163,51,0.10),rgba(122,163,51,0.028)_45%,transparent_80%)]" />

      {/* SPOTLIGHT — miękka poświata w górnej części, fokus za nagłówkiem */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(78%_56%_at_50%_28%,rgba(122,163,51,0.2),transparent_72%)] md:bg-[radial-gradient(50%_56%_at_50%_30%,rgba(122,163,51,0.24),transparent_70%)]" />
    </>
  );
}
