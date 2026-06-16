import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Wypisano z alertu',
  robots: { index: false, follow: false },
};

type Props = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function AlertUnsubscribedPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const notFound = sp.status === 'notfound';

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#131313] px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] px-8 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#7aa333]/35 bg-[#7aa333]/12 text-[#9fd14b] text-2xl">
          {notFound ? '?' : '✓'}
        </div>

        <h1 className="mt-5 text-[24px] font-semibold leading-tight text-white">
          {notFound ? 'Nie znaleziono alertu' : 'Wypisano z alertu'}
        </h1>

        <p className="mt-3 text-sm leading-6 text-white/65">
          {notFound
            ? 'Ten link wygasł lub alert został już usunięty. Nie musisz nic robić.'
            : 'Nie będziemy już wysyłać maili z tego alertu. Możesz w każdej chwili włączyć nowy w wyszukiwarce.'}
        </p>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/kup"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/14 px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:border-white/30 hover:text-white"
          >
            Szukaj działek
          </Link>
          <Link
            href="/panel?tab=alerty"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#7aa333]/60 bg-[#7aa333] px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#131313] transition hover:bg-[#8dbb3a]"
          >
            Moje alerty
          </Link>
        </div>
      </div>
    </main>
  );
}
