import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';
import KupList from '../kup/KupList';

// Polska odmiana rzeczownika przy liczniku: 1 / 2-4 / 5+ (wyjątek 12-14).
function odmianaOfert(n: number) {
  const d = n % 10;
  const s = n % 100;
  if (n === 1) return 'zapisana oferta';
  if (d >= 2 && d <= 4 && !(s >= 12 && s <= 14)) return 'zapisane oferty';
  return 'zapisanych ofert';
}

export default async function UlubionePage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect('/logowanie?callbackUrl=/ulubione');
  }

  const favorites = await prisma.favoriteDzialka.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      dzialka: {
        include: {
          zdjecia: {
            orderBy: { kolejnosc: 'asc' },
          },
          owner: { select: { defaultBiuroLogoUrl: true, defaultBiuroNazwa: true } },
        },
      },
    },
  });

  const items = favorites
    .map((f) => f.dzialka)
    .filter((d) => d.status === 'AKTYWNE');

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg sm:px-8">
      <section className="mx-auto max-w-6xl">
        <h1 className="sr-only">Ulubione działki</h1>

        {items.length ? (
          <div className="mb-10 border-b border-fg/10 pb-8">
            <div className="text-[64px] font-semibold leading-none text-brand-bright md:text-[88px]">
              {items.length}
            </div>
            <div className="mt-4 inline-block border-b border-brand/55 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-bright/80 md:text-[12px]">
              {odmianaOfert(items.length)}
            </div>
          </div>
        ) : null}

        {!items.length ? (
          <div className="rounded-3xl border border-fg/12 bg-surface-2/30 p-8 text-fg/70">
            Nie masz jeszcze zapisanych ofert.
            <div className="mt-5">
              <Link
                href="/kup"
                className="inline-flex rounded-full border border-brand/60 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-brand-text transition hover:bg-brand hover:text-ink"
              >
                Przeglądaj działki
              </Link>
            </div>
          </div>
        ) : (
          <KupList items={items} loading={false} error={null} />
        )}
      </section>
    </main>
  );
}