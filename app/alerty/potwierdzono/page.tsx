import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Powiadomienia potwierdzone',
  robots: { index: false, follow: false },
};

type Props = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function AlertConfirmedPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const notFound = sp.status === 'notfound';

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-bg px-6 text-fg">
      <div className="w-full max-w-md rounded-3xl border border-fg/10 bg-fg/[0.03] px-8 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand/35 bg-brand/12 text-2xl text-brand-bright">
          {notFound ? '?' : '✓'}
        </div>

        <h1 className="mt-5 text-[24px] font-semibold leading-tight text-fg">
          {notFound ? 'Nie znaleziono powiadomienia' : 'Powiadomienia włączone'}
        </h1>

        <p className="mt-3 text-sm leading-6 text-fg/70">
          {notFound
            ? 'Ten link wygasł lub powiadomienie zostało już potwierdzone. Nie musisz nic robić.'
            : 'Gotowe. Damy Ci znać e-mailem, gdy pojawi się nowa działka pasująca do Twoich kryteriów.'}
        </p>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/kup"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-fg/14 px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-fg/80 transition hover:border-fg/30 hover:text-fg"
          >
            Szukaj działek
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-brand/60 bg-brand px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink transition hover:bg-brand-strong"
          >
            Strona główna
          </Link>
        </div>
      </div>
    </main>
  );
}
