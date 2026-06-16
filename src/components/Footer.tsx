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
                <Image src="/logo1.png" alt="TylkoDziałki" width={180} height={46} className="object-contain" />
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
                  <a href="mailto:kontakt@tylkodzialki.pl" className="text-[#7aa333] transition hover:opacity-80">
                    kontakt@tylkodzialki.pl
                  </a>
                </div>

                <div>
                  <p className="mb-1 text-sm text-white/40">Dla partnerów biznesowych</p>
                  <a href="mailto:biuro@tylkodzialki.pl" className="text-[#7aa333] transition hover:opacity-80">
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
                <a href="https://www.instagram.com/tylkodzialki.pl/" target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-3 transition hover:text-white">
                  Instagram
                </a>

                <a href="https://www.facebook.com/profile.php?id=61573292127976" target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-3 transition hover:text-white">
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
                <Link href="/dla-biur" className="transition hover:text-white">
                  Dla biur
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
            <div className="mt-3 text-xs text-white/35">
              <p>NIP: 725337429 · KRS: 0001068696 · Adres: ul. Piotrkowska 44/10, 90-265 Łódź</p>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}