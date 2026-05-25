import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';
import KupList from '../kup/KupList';

export default async function UlubionePage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect('/auth?callbackUrl=/ulubione');
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
        },
      },
    },
  });

  const items = favorites
    .map((f) => f.dzialka)
    .filter((d) => d.status === 'AKTYWNE');

  return (
    <main className="min-h-screen bg-[#131313] px-4 py-10 text-white sm:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#7aa333]">
            TylkoDziałki.pl
          </p>

          <h1 className="mt-3 font-display text-[34px] uppercase tracking-[0.08em] text-white md:text-[54px]">
            Ulubione działki
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
            Tutaj znajdziesz polubione oferty.
          </p>
        </div>

        {!items.length ? (
          <div className="rounded-3xl border border-white/12 bg-[#0f0f0f]/30 p-8 text-white/70">
            Nie masz jeszcze zapisanych ofert.
            <div className="mt-5">
              <Link
                href="/kup"
                className="inline-flex rounded-full border border-[#7aa333]/60 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#7aa333] transition hover:bg-[#7aa333] hover:text-[#131313]"
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