'use client';

import Link from "next/link";
import Logo from "./Logo";

// Stopka jak na dużych portalach: jeden rząd (marka + cztery kolumny według tego, kim jest
// czytający), na telefonie linki w dwóch kolumnach. Wcześniej dwa rzędy po trzy kolumny
// z dużymi odstępami, „Blog" w „Koncie" i bez „Sprawdź działkę".

const KOLUMNY: { tytul: string; linki: { href: string; label: string }[] }[] = [
  {
    tytul: "Kupujący",
    linki: [
      { href: "/kup", label: "Szukaj działki" },
      { href: "/kup?widok=mapa", label: "Mapa ofert" },
      { href: "/dzialki", label: "Działki według lokalizacji" },
      { href: "/ceny", label: "Ceny działek" },
      { href: "/sprawdz-dzialke", label: "Sprawdź działkę" },
    ],
  },
  {
    tytul: "Sprzedający",
    linki: [
      { href: "/sprzedaj", label: "Sprzedaj działkę" },
      { href: "/dla-biur", label: "Dla biur nieruchomości" },
      { href: "/partnerstwo", label: "Zostań partnerem" },
      { href: "/panel", label: "Moje konto" },
    ],
  },
  {
    tytul: "Informacje",
    linki: [
      { href: "/blog", label: "Wiedza o działkach" },
      { href: "/regulamin", label: "Regulamin" },
      { href: "/polityka-prywatnosci", label: "Polityka prywatności" },
      { href: "/cookies", label: "Polityka cookies" },
    ],
  },
];

const naglowek = "text-[12px] font-semibold uppercase tracking-[0.22em] text-brand-text";
const link = "text-[15px] text-fg/72 transition hover:text-fg";

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer id="footer" className="border-t border-fg/10 bg-surface-2">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid gap-10 py-14 md:py-16 lg:grid-cols-[1.3fr_repeat(4,1fr)] lg:gap-8">
          {/* MARKA */}
          <div className="space-y-5">
            <Link href="/" className="inline-flex items-center" aria-label="tylkodzialki.pl, strona główna">
              <Logo className="h-9" />
            </Link>
            <p className="max-w-xs text-[15px] leading-7 text-fg/70">
              Portal ogłoszeniowy skupiony wyłącznie na działkach w całej Polsce.
            </p>
            <div className="flex items-center gap-2.5">
              <a
                href="https://www.instagram.com/tylkodzialki.pl/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram tylkodzialki.pl"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-fg/12 text-fg/70 transition hover:border-fg/30 hover:text-fg"
              >
                <IconInstagram />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61573292127976"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook tylkodzialki.pl"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-fg/12 text-fg/70 transition hover:border-fg/30 hover:text-fg"
              >
                <IconFacebook />
              </a>
            </div>
          </div>

          {/* KOLUMNY LINKÓW: na telefonie po dwie obok siebie */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:col-span-4 lg:grid-cols-4 lg:gap-8">
            {KOLUMNY.map((k, i) => (
              // Trzecia kolumna (Informacje) na telefonie na całą szerokość, linki w dwóch
              // kolumnach: przy nieparzystej liczbie sekcji zostawałaby sama z pustką obok.
              <div key={k.tytul} className={`space-y-5 ${i === 2 ? 'col-span-2 lg:col-span-1' : ''}`}>
                <h3 className={naglowek}>{k.tytul}</h3>
                <nav className={i === 2 ? 'grid grid-cols-2 gap-x-6 gap-y-3.5 lg:flex lg:flex-col' : 'flex flex-col gap-3.5'}>
                  {k.linki.map((l) => (
                    <Link key={l.href} href={l.href} className={link}>
                      {l.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}

            {/* Na telefonie cała szerokość: adres e-mail nie mieści się w połowie ekranu. */}
            <div className="col-span-2 space-y-5 lg:col-span-1">
              <h3 className={naglowek}>Kontakt</h3>
              <div className="flex flex-col gap-3.5 text-[15px] max-lg:flex-row max-lg:flex-wrap max-lg:gap-x-10">
                <div>
                  <p className="text-[13px] text-fg/62">Obsługa klienta</p>
                  <a href="mailto:kontakt@tylkodzialki.pl" className="whitespace-nowrap text-brand-text transition hover:opacity-80">
                    kontakt@tylkodzialki.pl
                  </a>
                </div>
                <div>
                  <p className="text-[13px] text-fg/62">Dla firm i biur</p>
                  <a href="mailto:biuro@tylkodzialki.pl" className="whitespace-nowrap text-brand-text transition hover:opacity-80">
                    biuro@tylkodzialki.pl
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DÓŁ: dane firmy i drobne linki w jednej linii */}
        <div className="flex flex-col gap-3 border-t border-fg/10 py-6 text-[12px] text-fg/62 md:flex-row md:items-center md:justify-between">
          <p>
            © 2026 tylkodzialki.pl · Ultima Reality Sp. z o.o. · NIP 7252337429 · KRS 0001068696 · ul. Piotrkowska 44/10, 90-265 Łódź
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={() => window.openCookieSettings?.()}
              className="transition hover:text-fg"
            >
              Ustawienia cookies
            </button>
            {/* Zwykły <a>: to plik tekstowy z trasy, nie strona do nawigacji klienckiej. */}
            <a href="/llms.txt" className="transition hover:text-fg">
              Dla agentów AI
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
