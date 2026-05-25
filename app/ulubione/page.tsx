import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

function formatPLN(value: number) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatIntPL(value: number) {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(value);
}

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
            Tutaj znajdziesz oferty zapisane serduszkiem.
          </p>
        </div>

        {!items.length ? (
          <div className="rounded-3xl border border-white/12 bg-[#0f0f0f]/30 p-8 text-white/70">
            Nie masz jeszcze zapisanych ofert.
            <div className="mt-5">
              <Link
                href="/kup"
                className="inline-flex rounded-full border border-[#7aa333]/70 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#7aa333] transition hover:bg-[#7aa333] hover:text-[#131313]"
              >
                Szukaj działki
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {items.map((d) => {
              const photo = d.zdjecia?.[0]?.url;
              const area = d.powierzchniaM2 ?? 0;
              const zlZaM2 = area ? Math.round(d.cenaPln / area) : 0;

              return (
                <Link
                  key={d.id}
                  href={`/dzialka/${d.id}`}
                  className="group overflow-hidden rounded-3xl border border-white/14 bg-[#0f0f0f]/30 transition hover:border-[#7aa333]/60"
                >
                  <div className="aspect-[16/10] bg-white/5 md:aspect-video">
                    {photo ? (
                      <img
                        src={photo}
                        alt={d.tytul}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/45">
                        Brak zdjęć
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="text-[20px] font-semibold text-white">
                      {formatPLN(d.cenaPln)}
                      {zlZaM2 ? (
                        <span className="ml-2 text-[12px] font-normal text-white/50">
                          ({formatIntPL(zlZaM2)} zł/m²)
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-4 line-clamp-2 text-[16px] font-medium leading-[1.35] text-white/90">
                      {d.tytul}
                    </h2>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                          Powierzchnia
                        </div>
                        <div className="mt-1 text-white/85">{formatIntPL(area)} m²</div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                          Lokalizacja
                        </div>
                        <div className="mt-1 text-white/85">
                          {d.locationLabel || 'Niepodana'}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}