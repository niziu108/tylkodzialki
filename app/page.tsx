import Link from "next/link";

const ACCENT = "#2F5E46";

export default function HomePage() {
  return (
    <main className="h-[100svh] w-full bg-[#0f0f0f]">
      <div className="flex h-full flex-col md:flex-row">
        {/* KUP */}
        <Link
          href="/kup"
          className="group relative flex flex-1 items-center justify-center overflow-hidden"
        >
          {/* tło (bez zoom) */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/kup.webp)" }}
          />

          {/* przyciemnienie */}
          <div className="absolute inset-0 bg-black/45" />

          {/* content */}
          <div className="relative z-10 flex flex-col items-center text-center px-6">
            <h1 className="font-bungee text-[30px] md:text-[52px] tracking-wide text-[#F3EFF5]">
              KUP DZIAŁKĘ
            </h1>

            <div
              className="mt-8 inline-flex items-center rounded-2xl border px-8 py-3 text-sm md:text-base text-[#F3EFF5] transition-all duration-300 group-hover:bg-[#2F5E46]/25"
              style={{ borderColor: ACCENT }}
            >
              PRZEJDŹ DO WYSZUKIWANIA
            </div>
          </div>

          {/* separator mobile */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-[#2F5E46]/40 md:hidden" />
        </Link>

        {/* separator desktop */}
        <div className="hidden md:block w-px bg-[#2F5E46]/45" />

        {/* SPRZEDAJ */}
        <Link
          href="/sprzedaj"
          className="group relative flex flex-1 items-center justify-center overflow-hidden"
        >
          {/* tło (bez zoom) */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/sprzedaj.webp)" }}
          />

          {/* przyciemnienie */}
          <div className="absolute inset-0 bg-black/40" />

          {/* content */}
          <div className="relative z-10 flex flex-col items-center text-center px-6">
            <h2 className="font-bungee text-[30px] md:text-[52px] tracking-wide text-[#F3EFF5]">
              SPRZEDAJ DZIAŁKĘ
            </h2>

            <div
              className="mt-8 inline-flex items-center rounded-2xl border px-8 py-3 text-sm md:text-base text-[#F3EFF5] transition-all duration-300 group-hover:bg-[#2F5E46]/25"
              style={{ borderColor: ACCENT }}
            >
              DODAJ OGŁOSZENIE
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}