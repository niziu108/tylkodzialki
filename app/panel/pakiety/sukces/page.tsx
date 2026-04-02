import Link from 'next/link';

export default function PakietySuccessPage() {
  return (
    <main className="min-h-screen bg-[#131313] px-6 py-16 text-[#d9d9d9]">
      <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-3xl font-semibold text-white">
          Pakiet kupiony pomyślnie
        </h1>

        <p className="mt-4 text-white/70">
          Płatność zakończyła się sukcesem. Jeśli masz już przygotowaną ofertę,
          możesz teraz opublikować ją od razu.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/panel"
            className="inline-flex items-center justify-center rounded-2xl bg-[#7aa333] px-6 py-3 font-semibold text-black transition hover:opacity-90"
          >
            Przejdź do panelu
          </Link>

          <Link
            href="/sprzedaj?autopublish=1"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/5"
          >
            Opublikuj przygotowane ogłoszenie
          </Link>
        </div>
      </div>
    </main>
  );
}