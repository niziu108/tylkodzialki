'use client';

import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer id="footer" className="border-t border-white/10 bg-[#111111]">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="py-20">

          {/* GÓRNY RZĄD */}
          <div className="grid gap-12 pb-10 md:grid-cols-3">

            {/* LOGO + OPIS */}
            <div className="space-y-6">
              <Link href="/" className="inline-flex items-center">
                <Image
                  src="/logo1.png"
                  alt="TylkoDziałki"
                  width={180}
                  height={46}
                  className="object-contain"
                />
              </Link>

              <p className="max-w-sm text-[15px] leading-7 text-white/65">
                Portal ogłoszeniowy skupiony wyłącznie na działkach w całej Polsce.
              </p>
            </div>

            {/* KONTAKT */}
            <div className="space-y-6">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7aa333]">
                Kontakt
              </h3>

              <div className="space-y-5 text-[15px]">
                <div>
                  <p className="mb-1 text-sm text-white/40">Obsługa klienta</p>
                  <a
                    href="mailto:kontakt@tylkodzialki.pl"
                    className="text-[#7aa333] transition hover:opacity-80"
                  >
                    kontakt@tylkodzialki.pl
                  </a>
                </div>

                <div>
                  <p className="mb-1 text-sm text-white/40">Dla partnerów biznesowych</p>
                  <a
                    href="mailto:biuro@tylkodzialki.pl"
                    className="text-[#7aa333] transition hover:opacity-80"
                  >
                    biuro@tylkodzialki.pl
                  </a>
                </div>
              </div>
            </div>

            {/* SOCIAL */}
            <div className="space-y-6">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7aa333]">
                Media społecznościowe
              </h3>

              <div className="flex flex-col gap-4 text-[15px] text-white/70">

                <a
                  href="https://www.instagram.com/tylkodzialki.pl/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-3 transition hover:text-white"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 2C4.239 2 2 4.239 2 7v10c0 2.761 2.239 5 5 5h10c2.761 0 5-2.239 5-5V7c0-2.761-2.239-5-5-5H7zm0 2h10c1.657 0 3 1.343 3 3v10c0 1.657-1.343 3-3 3H7c-1.657 0-3-1.343-3-3V7c0-1.657 1.343-3 3-3zm10.5 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
                  </svg>
                  Instagram
                </a>

                <a
                  href="https://www.facebook.com/profile.php?id=61573292127976"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-3 transition hover:text-white"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.7-1.6H17V4.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.2V11H8v3h2.6v8h2.9z" />
                  </svg>
                  Facebook
                </a>

              </div>
            </div>
          </div>

          {/* DOLNY RZĄD */}
          <div className="grid gap-12 pt-16 md:grid-cols-3">

            {/* OFERTY */}
            <div className="space-y-6">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7aa333]">
                Oferty
              </h3>

              <nav className="flex flex-col gap-4 text-[15px] text-white/70">
                <Link href="/kup" className="transition hover:text-white">
                  Szukaj działki
                </Link>
                <Link href="/sprzedaj" className="transition hover:text-white">
                  Wystaw działkę
                </Link>
                <Link href="/kup?sort=newest" className="transition hover:text-white">
                  Najnowsze
                </Link>
                <Link href="/kup?featured=true" className="transition hover:text-white">
                  Wyróżnione
                </Link>
              </nav>
            </div>

            {/* KONTO */}
            <div className="space-y-6">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7aa333]">
                Konto
              </h3>

              <nav className="flex flex-col gap-4 text-[15px] text-white/70">
                <Link href="/panel" className="transition hover:text-white">
                  Moje konto
                </Link>
                <Link href="/sprzedaj" className="transition hover:text-white">
                  Wystaw działkę
                </Link>
                <Link href="/blog" className="transition hover:text-white">
                  Blog
                </Link>
              </nav>
            </div>

            {/* INFORMACJE */}
            <div className="space-y-6">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7aa333]">
                Informacje
              </h3>

              <nav className="flex flex-col gap-4 text-[15px] text-white/70">
                <Link href="/regulamin" className="transition hover:text-white">
                  Regulamin
                </Link>
                <Link href="/polityka-prywatnosci" className="transition hover:text-white">
                  Polityka prywatności
                </Link>
                <Link href="/cookies" className="transition hover:text-white">
                  Polityka cookies
                </Link>

                <button
                  type="button"
                  onClick={() => window.openCookieSettings?.()}
                  className="text-left text-[15px] text-white/70 transition hover:text-white"
                >
                  Ustawienia cookies
                </button>
              </nav>
            </div>
          </div>

          {/* DÓŁ */}
          <div className="mt-16 border-t border-white/10 pt-6">
            <div className="flex flex-col gap-3 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
              <p>© 2026 TylkoDziałki. Wszelkie prawa zastrzeżone.</p>
              <p>Ultima Reality Sp. z o.o.</p>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}