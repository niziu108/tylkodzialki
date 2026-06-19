'use client';

import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer id="footer" className="border-t border-fg/10 bg-surface-2">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="py-20">

          {/* GÓRNY RZĄD */}
          <div className="grid gap-12 pb-10 md:grid-cols-3">

            {/* LOGO + OPIS */}
            <div className="space-y-6">
              <Link href="/" className="inline-flex items-center">
                <Logo className="h-10" />
              </Link>

              <p className="max-w-sm text-[15px] leading-7 text-fg/70">
                Portal ogłoszeniowy skupiony wyłącznie na działkach w całej Polsce.
              </p>
            </div>

            {/* KONTAKT */}
            <div className="space-y-6">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-brand-text">
                Kontakt
              </h3>

              <div className="space-y-5 text-[15px]">
                <div>
                  <p className="mb-1 text-sm text-fg/64">Obsługa klienta</p>
                  <a href="mailto:kontakt@tylkodzialki.pl" className="text-brand-text transition hover:opacity-80">
                    kontakt@tylkodzialki.pl
                  </a>
                </div>

                <div>
                  <p className="mb-1 text-sm text-fg/64">Dla partnerów biznesowych</p>
                  <a href="mailto:biuro@tylkodzialki.pl" className="text-brand-text transition hover:opacity-80">
                    biuro@tylkodzialki.pl
                  </a>
                </div>
              </div>
            </div>

            {/* SOCIAL */}
            <div className="space-y-6">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-brand-text">
                Media społecznościowe
              </h3>

              <div className="flex flex-col gap-4 text-[15px] text-fg/70">
                <a href="https://www.instagram.com/tylkodzialki.pl/" target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-3 transition hover:text-fg">
                  Instagram
                </a>

                <a href="https://www.facebook.com/profile.php?id=61573292127976" target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-3 transition hover:text-fg">
                  Facebook
                </a>
              </div>
            </div>
          </div>

          {/* DOLNY RZĄD */}
          <div className="grid gap-12 pt-16 md:grid-cols-3">

            {/* OFERTY */}
            <div className="space-y-6">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-brand-text">
                Oferty
              </h3>

              <nav className="flex flex-col gap-4 text-[15px] text-fg/70">
                <Link href="/kup" className="transition hover:text-fg">
                  Szukaj działki
                </Link>
                <Link href="/dzialki" className="transition hover:text-fg">
                  Działki według lokalizacji
                </Link>
                <Link href="/dla-biur" className="transition hover:text-fg">
                  Dla biur
                </Link>
              </nav>
            </div>

            {/* KONTO */}
            <div className="space-y-6">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-brand-text">
                Konto
              </h3>

              <nav className="flex flex-col gap-4 text-[15px] text-fg/70">
                <Link href="/panel" className="transition hover:text-fg">
                  Moje konto
                </Link>
                <Link href="/sprzedaj" className="transition hover:text-fg">
                  Wystaw działkę
                </Link>
                <Link href="/blog" className="transition hover:text-fg">
                  Blog
                </Link>
              </nav>
            </div>

            {/* INFORMACJE */}
            <div className="space-y-6">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-brand-text">
                Informacje
              </h3>

              <nav className="flex flex-col gap-4 text-[15px] text-fg/70">
                <Link href="/regulamin" className="transition hover:text-fg">
                  Regulamin
                </Link>
                <Link href="/polityka-prywatnosci" className="transition hover:text-fg">
                  Polityka prywatności
                </Link>
                <Link href="/cookies" className="transition hover:text-fg">
                  Polityka cookies
                </Link>

                <button
                  type="button"
                  onClick={() => window.openCookieSettings?.()}
                  className="text-left text-[15px] text-fg/70 transition hover:text-fg"
                >
                  Ustawienia cookies
                </button>
              </nav>
            </div>
          </div>

          {/* DÓŁ */}
          <div className="mt-16 border-t border-fg/10 pt-6">
            <div className="flex flex-col gap-3 text-xs text-fg/68 sm:flex-row sm:items-center sm:justify-between">
              <p>© 2026 tylkodzialki.pl. Wszelkie prawa zastrzeżone.</p>
              <p>Ultima Reality Sp. z o.o.</p>
            </div>
            <div className="mt-3 text-xs text-fg/62">
              <p>NIP: 7252337429 · KRS: 0001068696 · Adres: ul. Piotrkowska 44/10, 90-265 Łódź</p>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}