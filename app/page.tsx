import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HomeHorizontalSlider from "@/components/HomeHorizontalSlider";
import type { Przeznaczenie } from "@prisma/client";

const ACCENT = "#2F5E46";
const GREEN = "#7aa333";
const PAGE_BG = "#131313";

const ICONS = {
  area: "/powierzchnia.webp",
  price: "/cena.webp",
  type: "/przeznaczenie.webp",
  loc: "/lokalizacja.webp",
};

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
    .replace("USLUGOWA", "USŁUGOWA")
    .replace("LESNA", "LEŚNA")
    .replace("INWESTYCYJNA", "INWESTYCYJNA")
    .replace("ROLNA", "ROLNA")
    .replace("BUDOWLANA", "BUDOWLANA");
}

function isFeaturedActive(d: {
  isFeatured?: boolean | null;
  featuredUntil?: string | Date | null;
}) {
  return (
    !!d.isFeatured &&
    !!d.featuredUntil &&
    new Date(d.featuredUntil).getTime() > Date.now()
  );
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
  isFeatured?: boolean | null;
  featuredUntil?: string | Date | null;
  isPlaceholder?: boolean;
};

function HomeInfoLine({
  icon,
  value,
}: {
  icon: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <img src={icon} alt="" className="h-5 w-5 opacity-80" loading="lazy" />
      <div className="text-[14px] leading-snug text-white/90">{value}</div>
    </div>
  );
}

function HomeListingCarousel({
  photos,
  coverFallback,
  title,
  featured,
}: {
  photos: { url: string }[];
  coverFallback: string | null;
  title: string;
  featured: boolean;
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
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

          {featured ? (
            <div className="absolute left-4 top-4 z-10">
              <span className="inline-flex items-center rounded-full border border-[#7aa333]/35 bg-[#7aa333]/85 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-black shadow-lg">
                WYRÓŻNIONE
              </span>
            </div>
          ) : null}

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="text-center text-[18px] font-medium leading-tight text-white drop-shadow">
              {title}
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-white/50">
          Brak zdjęć
        </div>
      )}
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

  const featured = isFeaturedActive(d);
  const href = d.isPlaceholder ? "/kup" : `/dzialka/${d.id}`;

  return (
    <Link
      href={href}
      className={`group min-w-[86%] snap-start overflow-hidden rounded-3xl border transition md:min-w-[360px] xl:min-w-[380px] ${
        featured
          ? "border-[#7aa333]/45 bg-[#0f0f0f]/20 shadow-[0_0_0_1px_rgba(122,163,51,0.10)] hover:border-[#7aa333]/70"
          : "border-white/14 bg-[#0f0f0f]/20 hover:border-white/30"
      }`}
    >
      <HomeListingCarousel
        photos={photos}
        coverFallback={coverFallback}
        title={d.tytul}
        featured={featured}
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <img src={ICONS.price} alt="" className="h-5 w-5 opacity-80" />
          <div className="text-[18px] font-semibold" style={{ color: GREEN }}>
            {d.isPlaceholder ? "Wkrótce pojawią się oferty" : formatPLN(d.cenaPln)}
            {!d.isPlaceholder && zlZaM2 ? (
              <span className="ml-2 text-[12px] font-normal text-white/50">
                ({formatIntPL(zlZaM2)} zł/m²)
              </span>
            ) : null}
          </div>
        </div>

        <HomeInfoLine
          icon={ICONS.area}
          value={d.isPlaceholder ? "—" : `${formatIntPL(area)} m²`}
        />
        <HomeInfoLine icon={ICONS.type} value={d.isPlaceholder ? "—" : przezn} />
        <HomeInfoLine
          icon={ICONS.loc}
          value={d.isPlaceholder ? "TylkoDziałki" : loc}
        />
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const now = new Date();

  const [featuredListings, latestListings, latestArticles] = await Promise.all([
    prisma.dzialka.findMany({
      where: {
        status: "AKTYWNE",
        isFeatured: true,
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

  const featuredCards: HomeListing[] =
    featuredListings.length > 0
      ? (featuredListings as HomeListing[])
      : Array.from({ length: 6 }, (_, i) => ({
          id: `placeholder-featured-${i}`,
          tytul: "Wyróżniona oferta wkrótce",
          cenaPln: 0,
          powierzchniaM2: 0,
          locationLabel: "TylkoDziałki",
          przeznaczenia: [],
          zdjecia: [],
          isFeatured: true,
          featuredUntil: new Date(Date.now() + 86400000),
          isPlaceholder: true,
        }));

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
          isFeatured: false,
          featuredUntil: null,
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

      <section className="border-t border-white/10" style={{ background: PAGE_BG }}>
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-10">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-[0.16em] text-[#9fd14b]">
                Wyróżnione oferty
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Najlepsze działki
              </h2>
            </div>
          </div>

          <div className="mt-10">
            <HomeHorizontalSlider>
              {featuredCards.map((item) => (
                <HomeListingCard key={item.id} d={item} />
              ))}
            </HomeHorizontalSlider>
          </div>

          <div className="mt-6 flex justify-center md:justify-start">
            <Link
              href="/kup"
              className="inline-flex text-sm text-white/60 transition hover:text-white"
            >
              Zobacz wszystkie wyróżnione →
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10" style={{ background: PAGE_BG }}>
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
          <div className="max-w-4xl">
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
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <div className="rounded-[28px] border border-[#7aa333]/25 bg-gradient-to-br from-[#7aa333]/12 to-[#7aa333]/[0.02] p-7 transition hover:border-[#7aa333]/45">
              <div className="text-2xl font-semibold text-[#9fd14b]">01</div>
              <h3 className="mt-4 text-xl font-semibold text-white">Skupienie</h3>
              <p className="mt-3 text-sm leading-7 text-white/68">
                100% ofert i funkcji skupionych wokół działek.
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
                Stale rozwijamy portal i docieramy do nowych osób szukających działek.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10" style={{ background: PAGE_BG }}>
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-10">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-[0.16em] text-[#9fd14b]">
                Najnowsze oferty
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Świeżo dodane działki
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

      <section className="border-t border-white/10" style={{ background: PAGE_BG }}>
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