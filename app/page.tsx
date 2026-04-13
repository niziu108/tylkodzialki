import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HomeHorizontalSlider from "@/components/HomeHorizontalSlider";
import type { Przeznaczenie } from "@prisma/client";

export const dynamic = "force-dynamic";

const ACCENT = "#2F5E46";
const GREEN = "#7aa333";
const PAGE_BG = "#131313";

function formatPLN(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatIntPL(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0,
  }).format(value);
}

function labelPrzeznaczenie(p: Przeznaczenie) {
  return String(p)
    .replace("USLUGOWA", "Usługowa")
    .replace("LESNA", "Leśna")
    .replace("INWESTYCYJNA", "Inwestycyjna")
    .replace("ROLNA", "Rolna")
    .replace("BUDOWLANA", "Budowlana");
}

type HomePhoto = {
  id?: string;
  url: string;
  publicId?: string;
  kolejnosc?: number;
};

type HomeListing = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  locationLabel?: string | null;
  przeznaczenia?: Przeznaczenie[];
  zdjecia?: HomePhoto[];
  isPlaceholder?: boolean;
};

function HomeListingCarousel({
  photos,
  coverFallback,
  title,
}: {
  photos: { url: string }[];
  coverFallback: string | null;
  title: string;
}) {
  const list = photos.length
    ? photos.map((p) => p.url)
    : coverFallback
      ? [coverFallback]
      : [];

  const has = list.length > 0;

  return (
    <div className="relative aspect-video bg-white/5">
      {has ? (
        <>
          <img
            src={list[0]}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-white/50">
          Brak zdjęć
        </div>
      )}
    </div>
  );
}

function MetricBlock({
  label,
  value,
  subValue,
}: {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex flex-col items-center text-center">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      <div className="mt-2 min-w-0">{value}</div>
      {subValue ? <div className="min-w-0">{subValue}</div> : null}
    </div>
  );
}

function HomeListingCard({ d }: { d: HomeListing }) {
  const photos = (d.zdjecia ?? [])
    .slice()
    .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));

  const coverFallback = photos[0]?.url ?? null;
  const loc = d.locationLabel?.trim() || "Lokalizacja niepodana";
  const area = d.powierzchniaM2 ?? 0;
  const zlZaM2 = area ? Math.round(d.cenaPln / area) : 0;
  const przezn = d.przeznaczenia?.length
    ? d.przeznaczenia.map(labelPrzeznaczenie).join(", ")
    : "—";

  const href = d.isPlaceholder ? "/kup" : `/dzialka/${d.id}`;

  return (
    <Link
      href={href}
      className="group min-w-[86%] snap-start overflow-hidden rounded-3xl border border-white/14 bg-[#0f0f0f]/20 transition hover:border-white/30 md:min-w-[360px] xl:min-w-[380px]"
    >
      <HomeListingCarousel
        photos={photos}
        coverFallback={coverFallback}
        title={d.tytul}
      />

      <div className="p-5 md:p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <MetricBlock
            label="Cena"
            value={
              <div
                className="text-[22px] font-semibold leading-none md:text-[24px]"
                style={{ color: GREEN }}
              >
                {d.isPlaceholder ? "Wkrótce" : formatPLN(d.cenaPln)}
              </div>
            }
            subValue={
              !d.isPlaceholder && zlZaM2 ? (
                <div className="mt-1 text-[12px] text-white/45">
                  {formatIntPL(zlZaM2)} zł/m²
                </div>
              ) : null
            }
          />

          <div className="h-14 w-px bg-white/10" />

          <MetricBlock
            label="Powierzchnia"
            value={
              <div className="text-[20px] font-medium leading-none text-white/95 md:text-[22px]">
                {d.isPlaceholder ? "—" : `${formatIntPL(area)} m²`}
              </div>
            }
          />
        </div>

        <div className="mt-6">
          <div className="mx-auto max-w-[92%] text-center text-[16px] font-medium leading-[1.35] text-white/92 md:text-[17px]">
            {d.tytul}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <MetricBlock
            label="Lokalizacja"
            value={
              <div className="break-words text-[14px] leading-[1.4] text-white/90">
                {d.isPlaceholder ? "TylkoDziałki" : loc}
              </div>
            }
          />

          <div className="h-14 w-px bg-white/10" />

          <MetricBlock
            label="Przeznaczenie"
            value={
              <div className="break-words text-[14px] leading-[1.4] text-white/90">
                {d.isPlaceholder ? "—" : przezn}
              </div>
            }
          />
        </div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const now = new Date();

  const [latestListings, latestArticles] = await Promise.all([
    prisma.dzialka.findMany({
      where: {
        status: "AKTYWNE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        zdjecia: {
          orderBy: { kolejnosc: "asc" },
          take: 1,
        },
      },
      orderBy: [{ publishedAt: "desc" }],
      take: 6,
    }),
    prisma.article.findMany({
      where: { isPublished: true },
      orderBy: [{ createdAt: "desc" }],
      take: 6,
    }),
  ]);

  const latestCards: HomeListing[] =
    latestListings.length > 0
      ? (latestListings as HomeListing[])
      : Array.from({ length: 6 }, (_, i) => ({
          id: `placeholder-latest-${i}`,
          tytul: "Nowa oferta wkrótce",
          cenaPln: 0,
          powierzchniaM2: 0,
          locationLabel: "TylkoDziałki",
          przeznaczenia: [],
          zdjecia: [],
          isPlaceholder: true,
        }));

  const articleCards =
    latestArticles.length > 0
      ? [
          ...latestArticles,
          ...Array.from(
            { length: Math.max(0, 6 - latestArticles.length) },
            (_, i) => ({
              id: `placeholder-article-${i}`,
              slug: "#",
              title: "Nowy artykuł już wkrótce",
              excerpt:
                "Przygotowujemy kolejne poradniki o działkach, MPZP, wycenie i formalnościach.",
              imageUrl: null,
              createdAt: new Date(),
              isPlaceholder: true,
            })
          ),
        ]
      : Array.from({ length: 6 }, (_, i) => ({
          id: `placeholder-article-${i}`,
          slug: "#",
          title: "Nowy artykuł już wkrótce",
          excerpt:
            "Przygotowujemy kolejne poradniki o działkach, MPZP, wycenie i formalnościach.",
          imageUrl: null,
          createdAt: new Date(),
          isPlaceholder: true,
        }));

  return (
    <main className="w-full" style={{ background: PAGE_BG }}>
      <section className="h-[100svh] w-full" style={{ background: PAGE_BG }}>
        <div className="flex h-full flex-col md:flex-row">
          <Link
            href="/kup"
            className="group relative flex flex-1 items-center justify-center overflow-hidden"
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url(/kup.webp)" }}
            />
            <div className="absolute inset-0 bg-black/45" />

            <div className="relative z-10 flex flex-col items-center px-6 text-center">
              <h1 className="font-bungee text-[30px] tracking-wide text-[#F3EFF5] md:text-[52px]">
                SZUKAM DZIAŁKI
              </h1>

              <div
                className="mt-8 inline-flex items-center rounded-2xl border px-8 py-3 text-sm text-[#F3EFF5] transition-all duration-300 group-hover:bg-[#2F5E46]/25 md:text-base"
                style={{ borderColor: ACCENT }}
              >
                PRZEJDŹ DO WYSZUKIWANIA
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-px bg-[#2F5E46]/40 md:hidden" />
          </Link>

          <div className="hidden w-px bg-[#2F5E46]/45 md:block" />

          <Link
            href="/sprzedaj"
            className="group relative flex flex-1 items-center justify-center overflow-hidden"
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url(/sprzedaj.webp)" }}
            />
            <div className="absolute inset-0 bg-black/40" />

            <div className="relative z-10 flex flex-col items-center px-6 text-center">
              <h2 className="font-bungee text-[30px] tracking-wide text-[#F3EFF5] md:text-[52px]">
                SPRZEDAJĘ DZIAŁKĘ
              </h2>

              <div
                className="mt-8 inline-flex items-center rounded-2xl border px-8 py-3 text-sm text-[#F3EFF5] transition-all duration-300 group-hover:bg-[#2F5E46]/25 md:text-base"
                style={{ borderColor: ACCENT }}
              >
                DODAJ OGŁOSZENIE
              </div>
            </div>
          </Link>
        </div>
      </section>

      <section style={{ background: PAGE_BG }}>
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-10">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-[0.16em] text-[#9fd14b]">
                Oferty
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Najnowsze oferty
              </h2>
            </div>
          </div>

          <div className="mt-10">
            <HomeHorizontalSlider>
              {latestCards.map((item) => (
                <HomeListingCard key={item.id} d={item} />
              ))}
            </HomeHorizontalSlider>
          </div>

          <div className="mt-6 flex justify-center md:justify-start">
            <Link
              href="/kup"
              className="inline-flex text-sm text-white/60 transition hover:text-white"
            >
              Przeglądaj wszystkie oferty →
            </Link>
          </div>
        </div>
      </section>

      <section style={{ background: PAGE_BG }}>
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-stretch md:gap-14">
            <div className="flex flex-col">
              <div className="text-[12px] uppercase tracking-[0.16em] text-[#9fd14b]">
                O nas
              </div>

              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Portal stworzony wyłącznie pod działki
              </h2>

              <p className="mt-6 max-w-3xl text-base leading-8 text-white/72 md:text-lg">
                TylkoDziałki to miejsce stworzone dla osób, które chcą szybko i
                wygodnie kupić lub sprzedać działkę. Tworzymy portal, który ma być
                czytelny, nowoczesny i naprawdę pomocny dla osób szukających
                konkretnych ofert.
              </p>

              <div className="mt-8 md:hidden">
                <div className="relative w-full overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03]">
                  <img
                    src="/rodzina.webp"
                    alt="Rodzina marząca o swoim miejscu"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-5">
                <div className="rounded-[28px] border border-[#7aa333]/25 bg-gradient-to-br from-[#7aa333]/12 to-[#7aa333]/[0.02] p-7 transition hover:border-[#7aa333]/45">
                  <div className="text-2xl font-semibold text-[#9fd14b]">01</div>
                  <h3 className="mt-4 text-xl font-semibold text-white">
                    Tylko działki
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/68">
                    Portal skupiony wyłącznie na działkach, bez przypadkowych ofert z
                    innych kategorii.
                  </p>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-7 transition hover:border-white/20 hover:bg-white/[0.045]">
                  <div className="text-2xl font-semibold text-[#9fd14b]">02</div>
                  <h3 className="mt-4 text-xl font-semibold text-white">
                    Proste dodawanie
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/68">
                    Intuicyjne wystawianie ofert i wygodne zarządzanie ogłoszeniami.
                  </p>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-7 transition hover:border-white/20 hover:bg-white/[0.045]">
                  <div className="text-2xl font-semibold text-[#9fd14b]">03</div>
                  <h3 className="mt-4 text-xl font-semibold text-white">Rozwój</h3>
                  <p className="mt-3 text-sm leading-7 text-white/68">
                    Stale rozwijamy portal i docieramy do nowych osób szukających
                    działek.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative hidden md:block">
              <div className="relative h-full min-h-[820px] w-full overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                <img
                  src="/rodzina.webp"
                  alt="Rodzina marząca o swoim miejscu"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                <div className="absolute inset-0 ring-1 ring-inset ring-[#7aa333]/15" />
              </div>

              <div className="pointer-events-none absolute -bottom-5 -left-4 h-24 w-24 rounded-full bg-[#7aa333]/12 blur-2xl" />
              <div className="pointer-events-none absolute -right-4 -top-5 h-28 w-28 rounded-full bg-[#2F5E46]/18 blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: PAGE_BG }}>
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-10">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-[0.16em] text-[#9fd14b]">
                Blog TylkoDziałki
              </div>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Wiedza o działkach
              </h2>
            </div>
          </div>

          <div className="mt-10">
            <HomeHorizontalSlider>
              {articleCards.map((article: any) => {
                const href = article.isPlaceholder ? "/blog" : `/blog/${article.slug}`;

                return (
                  <Link
                    key={article.id}
                    href={href}
                    className="group min-w-[86%] snap-start md:min-w-[360px] xl:min-w-[380px]"
                  >
                    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.045]">
                      <div className="aspect-[16/10] bg-black/20">
                        {article.imageUrl ? (
                          <img
                            src={article.imageUrl}
                            alt={article.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-white/35">
                            TylkoDziałki
                          </div>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="text-[12px] text-white/40">
                          {new Date(article.createdAt).toLocaleDateString("pl-PL")}
                        </div>

                        <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-white">
                          {article.title}
                        </h3>

                        <p className="mt-2 line-clamp-3 text-sm text-white/60">
                          {article.excerpt}
                        </p>

                        <div className="mt-4 text-sm font-semibold text-[#9fd14b]">
                          Czytaj →
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </HomeHorizontalSlider>
          </div>

          <div className="mt-6 flex justify-center md:justify-start">
            <Link
              href="/blog"
              className="inline-flex text-sm text-white/60 transition hover:text-white"
            >
              Zobacz wszystkie artykuły →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}