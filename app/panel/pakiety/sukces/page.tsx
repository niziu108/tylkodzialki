'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function PakietySuccessPage() {
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Purchase', {
        value: 149, // możesz później zrobić dynamiczne
        currency: 'PLN',
      });
    }
  }, []);

  return (
    <main className="min-h-screen bg-bg px-6 py-16 text-fg/85">
      <div className="mx-auto max-w-2xl rounded-[28px] border border-fg/10 bg-fg/5 p-8 text-center">
        <h1 className="text-3xl font-semibold text-fg">
          Pakiet kupiony pomyślnie
        </h1>

        <p className="mt-4 text-fg/70">
          Płatność zakończyła się sukcesem. Jeśli masz już przygotowaną ofertę,
          możesz teraz opublikować ją od razu.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/panel"
            className="inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-3 font-semibold text-black transition hover:opacity-90"
          >
            Przejdź do panelu
          </Link>

          <Link
            href="/sprzedaj?autopublish=1"
            className="inline-flex items-center justify-center rounded-2xl border border-fg/10 px-6 py-3 font-semibold text-fg transition hover:bg-fg/5"
          >
            Opublikuj przygotowane ogłoszenie
          </Link>
        </div>
      </div>
    </main>
  );
}