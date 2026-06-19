import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import HomeHorizontalSlider from "@/components/HomeHorizontalSlider";
import ArticleCardCover from "@/components/ArticleCardCover";
import ArticleMeta from "@/components/ArticleMeta";
import KupSearch from "./kup/KupSearch";
import HeroCounter from "@/components/HeroCounter";
import FeaturedRail from "@/components/FeaturedRail";
import type { OfferData } from "@/components/OfferCard";
import { SEO_REGIONS } from "@/lib/seo-locations";
import { getFeaturedListings } from "@/lib/dzialki";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "tylkodzialki.pl – szukaj, kupuj i sprzedawaj działki",
  description:
    "Portal ogłoszeń poświęcony wyłącznie działkom. Szukaj działek na sprzedaż, przeglądaj oferty i dodawaj własne ogłoszenia w całej Polsce.",
  alternates: {
    canonical: "/",
  },
};

const PAGE_BG = 'var(--bg)';

function PopularSearchesSection() {
  return (
    <section className="relative overflow-hidden border-t border-fg/10 bg-surface-2">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:46px_46px] opacity-35" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(122,163,51,0.13),transparent_30%),radial-gradient(circle_at_86%_80%,rgba(47,94,70,0.05),transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
        <div>
          <div className="text-[12px] uppercase tracking-[0.18em] text-brand-bright">
            Popularne lokalizacje
          </div>

          <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-fg md:text-4xl">
            Najpopularniejsze lokalizacje w województwach
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-fg/55 md:text-base">
            Wybierz województwo i przejdź do najczęściej wyszukiwanych miast.
            Każdy link prowadzi bezpośrednio do działek budowlanych w danej lokalizacji.
          </p>
        </div>

        <div className="mt-10 [touch-action:pan-x_pan-y]">
          <HomeHorizontalSlider>
            {SEO_REGIONS.map((region, index) => (
              <article
                key={region.name}
                className="group relative min-w-[86%] snap-start overflow-hidden rounded-[32px] border border-fg/12 bg-surface-2/78 p-6 shadow-[0_0_50px_rgba(0,0,0,0.06)] backdrop-blur transition hover:border-brand/35 md:min-w-[360px] xl:min-w-[390px]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(122,163,51,0.12),transparent_34%)] opacity-0 transition group-hover:opacity-100" />

                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-fg/35">
                        Województwo
                      </div>

                      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
                        {region.name}
                      </h3>
                    </div>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10 text-[13px] font-semibold text-brand-bright">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                  </div>

                  <div className="mt-7 grid gap-2">
                    {region.cities.map((city) => (
                      <Link
                        key={city.slug}
                        href={`/dzialki/${city.slug}/budowlane`}
                        className="block rounded-2xl border border-fg/8 bg-fg/[0.025] px-4 py-3 text-sm leading-5 text-fg/68 transition hover:border-brand/35 hover:bg-brand/10 hover:text-fg"
                      >
                        Działki budowlane {city.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </HomeHorizontalSlider>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const now = new Date();

  const activeWhere = {
    status: "AKTYWNE" as const,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };

  const [featuredListings, latestArticles, listingCount] = await Promise.all([
    getFeaturedListings(8),
    prisma.article.findMany({
      where: { isPublished: true },
      orderBy: [{ createdAt: "desc" }],
      take: 6,
    }),
    prisma.dzialka.count({ where: activeWhere }),
  ]);

  // Mapujemy tylko bezpieczne pola (bez editToken/telefon itp.), bo lecą do
  // komponentu klienckiego FeaturedRail. Karta jest wspólna z /kup, więc dorzucamy
  // media (chipy) oraz sprzedawcę/logo (stopka), żeby wyróżnione wyglądały tak samo.
  const featuredCards: OfferData[] = featuredListings.map((d) => ({
    id: d.id,
    tytul: d.tytul,
    cenaPln: d.cenaPln,
    powierzchniaM2: d.powierzchniaM2,
    transakcja: d.transakcja,
    locationLabel: d.locationLabel,
    przeznaczenia: d.przeznaczenia,
    zdjecia: (d.zdjecia ?? []).map((z) => ({ url: z.url, kolejnosc: z.kolejnosc })),
    isFeatured: d.isFeatured,
    featuredUntil: d.featuredUntil,
    prad: d.prad,
    woda: d.woda,
    kanalizacja: d.kanalizacja,
    gaz: d.gaz,
    sprzedajacyTyp: d.sprzedajacyTyp,
    biuroNazwa: d.biuroNazwa,
    biuroLogoUrl: d.biuroLogoUrl,
    owner: d.owner
      ? { defaultBiuroLogoUrl: d.owner.defaultBiuroLogoUrl, defaultBiuroNazwa: d.owner.defaultBiuroNazwa }
      : null,
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
    <main
      className="relative w-full overflow-hidden"
      style={{ background: PAGE_BG }}
    >
      <section className="relative min-h-[100svh] w-full">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/kup.webp)", filter: "brightness(1.15)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/52 to-black/72" />

        <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-4 pb-12 pt-8 text-center">
          <h1 className="font-hero text-[38px] uppercase tracking-[0.06em] text-white/90 [text-shadow:0_2px_12px_rgba(0,0,0,0.45)] md:text-[70px] md:leading-none">
            Znajdź swoją działkę
          </h1>

          <HeroCounter target={listingCount} />

          <div className="mt-6 w-full max-w-4xl">
            <KupSearch navigationMode={true} />
          </div>

          <div className="mt-6">
            <Link
              href="/sprzedaj"
              className="text-sm text-white/55 transition hover:text-white/80"
            >
              Sprzedajesz działkę?{" "}
              <span
                className="text-[#9fd14b]"
                style={{
                  textDecoration: "underline",
                  textUnderlineOffset: "4px",
                  textDecorationThickness: "1px",
                  textDecorationColor: "rgba(159,209,75,0.40)",
                }}
              >
                Dodaj ogłoszenie
              </span>{" "}
              →
            </Link>
          </div>
        </div>
      </section>

      {featuredCards.length > 0 ? (
        <section className="relative overflow-hidden">
          {/* zielona „siateczka" — żeby sekcja nie była monolitem */}
          <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] opacity-35" />
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_20%,rgba(122,163,51,0.16),transparent_34%),radial-gradient(circle_at_85%_70%,rgba(47,94,70,0.05),transparent_32%)]" />

          <div className="relative z-10 mx-auto max-w-7xl px-6 pt-14 pb-14 md:px-10 md:pt-16 md:pb-16">
            <h2 className="text-[22px] font-semibold text-fg md:text-[28px]">
              Wyróżnione oferty
            </h2>

            <div className="mt-6">
              <FeaturedRail items={featuredCards} />
            </div>

            <div className="mt-6 flex justify-center md:justify-start">
              <Link
                href="/kup"
                className="inline-flex text-sm text-fg/60 transition hover:text-fg"
              >
                Przeglądaj wszystkie oferty →
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-10">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-[0.16em] text-brand-bright">
                Blog tylkodzialki.pl
              </div>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
                Wiedza o działkach
              </h2>
            </div>
          </div>

          <div className="mt-10 touch-auto">
            <HomeHorizontalSlider>
              {articleCards.map((article: any) => {
                const href = article.isPlaceholder
                  ? "/blog"
                  : `/blog/${article.slug}`;

                return (
                  <Link
                    key={article.id}
                    href={href}
                    className="group min-w-[86%] snap-start md:min-w-[360px] xl:min-w-[380px]"
                  >
                    <article className="overflow-hidden rounded-[28px] border border-fg/10 bg-fg/[0.03] transition hover:border-fg/20 hover:bg-fg/[0.045]">
                      <ArticleCardCover
                        imageUrl={article.imageUrl}
                        title={article.title}
                      />

                      <div className="p-5">
                        <ArticleMeta
                          category={article.category}
                          createdAt={article.createdAt}
                          readingTime={article.readingTime}
                        />

                        <h3 className="mt-3 line-clamp-2 text-lg font-semibold text-fg">
                          {article.title}
                        </h3>

                        <p className="mt-2 line-clamp-3 text-sm text-fg/60">
                          {article.excerpt}
                        </p>

                        <div className="mt-4 text-sm font-semibold text-brand-bright">
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
              className="inline-flex text-sm text-fg/60 transition hover:text-fg"
            >
              Zobacz wszystkie artykuły →
            </Link>
          </div>
        </div>
      </section>

      <PopularSearchesSection />
    </main>
  );
}