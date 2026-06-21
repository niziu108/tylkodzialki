import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';
import KupList from '../kup/KupList';

// Polska odmiana: 1 oferta / 2-4 oferty / 5+ ofert (z wyjątkiem 12-14).
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
        <div className="mb-10 border-b border-fg/10 pb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-text">
            Twoje konto
          </p>
          <div className="mt-2 h-px w-12 bg-brand/55" />

          <h1 className="mt-4 font-display text-[34px] uppercase tracking-[0.08em] text-fg md:text-[54px]">
            Ulubione działki
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-fg/72">
            {items.length
              ? `Masz tu ${items.length} ${odmianaOfert(items.length)}. Wracaj, gdy chcesz je porównać albo umówić oględziny.`
              : 'Zapisuj działki, do których chcesz wrócić — będą czekać tu w jednym miejscu.'}
          </p>
        </div>

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