import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import HomeHorizontalSlider from "@/components/HomeHorizontalSlider";
import KupSearch from "./kup/KupSearch";
import HeroCounter from "@/components/HeroCounter";
import type { Przeznaczenie } from "@prisma/client";
import { SEO_REGIONS } from "@/lib/seo-locations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TylkoDziałki.pl – szukaj, kupuj i sprzedawaj działki",
  description:
    "Portal ogłoszeń poświęcony wyłącznie działkom. Szukaj działek na sprzedaż, przeglądaj oferty i dodawaj własne ogłoszenia w całej Polsce.",
  alternates: {
    canonical: "/",
  },
};

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
    .replace("BUDOWLANA", "Budowlana")
    .replace("REKREACYJNA", "Rekreacyjna")
    .replace("SIEDLISKOWA", "Siedliskowa");
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
  value: ReactNode;
  subValue?: ReactNode;
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
      className="group min-w-[86%] snap-start overflow-hidden rounded-3xl border border-white/14 bg-[#0f0f0f]/40 transition hover:border-white/30 md:min-w-[360px] xl:min-w-[380px]"
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

function PopularSearchesSection() {
  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-[#0b0b0b]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:46px_46px] opacity-35" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(122,163,51,0.13),transparent_30%),radial-gradient(circle_at_86%_80%,rgba(47,94,70,0.18),transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
        <div>
          <div className="text-[12px] uppercase tracking-[0.18em] text-[#9fd14b]">
            Popularne lokalizacje
          </div>

          <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-white md:text-4xl">
            Najpopularniejsze lokalizacje w województwach
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55 md:text-base">
            Wybierz województwo i przejdź do najczęściej wyszukiwanych miast.
            Każdy link prowadzi bezpośrednio do działek budowlanych w danej lokalizacji.
          </p>
        </div>

        <div className="mt-10 [touch-action:pan-x_pan-y]">
          <HomeHorizontalSlider>
            {SEO_REGIONS.map((region, index) => (
              <article
                key={region.name}
                className="group relative min-w-[86%] snap-start overflow-hidden rounded-[32px] border border-white/12 bg-[#101010]/78 p-6 shadow-[0_0_70px_rgba(0,0,0,0.20)] backdrop-blur transition hover:border-[#7aa333]/35 md:min-w-[360px] xl:min-w-[390px]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(122,163,51,0.12),transparent_34%)] opacity-0 transition group-hover:opacity-100" />

                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">
                        Województwo
                      </div>

                      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                        {region.name}
                      </h3>
                    </div>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#7aa333]/25 bg-[#7aa333]/10 text-[13px] font-semibold text-[#9fd14b]">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                  </div>

                  <div className="mt-7 grid gap-2">
                    {region.cities.map((city) => (
                      <Link
                        key={city.slug}
                        href={`/dzialki/${city.slug}/budowlane`}
                        className="block rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-sm leading-5 text-white/68 transition hover:border-[#7aa333]/35 hover:bg-[#7aa333]/10 hover:text-white"
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

  const [latestListings, featuredListings, latestArticles, listingCount] =
    await Promise.all([
      prisma.dzialka.findMany({
        where: activeWhere,
        include: {
          zdjecia: {
            orderBy: { kolejnosc: "asc" },
            take: 1,
          },
        },
        orderBy: [{ publishedAt: "desc" }],
        take: 6,
      }),
      // Wyróżnione: najpierw faktycznie wyróżnione (isFeatured), a gdy ich brak
      // (nikt jeszcze nie wykupił), dobiera najstarsze aktywne — sekcja nigdy
      // nie świeci pustką, nie powiela też najnowszych.
      prisma.dzialka.findMany({
        where: activeWhere,
        include: {
          zdjecia: {
            orderBy: { kolejnosc: "asc" },
            take: 1,
          },
        },
        orderBy: [{ isFeatured: "desc" }, { publishedAt: "asc" }],
        take: 8,
      }),
      prisma.article.findMany({
        where: { isPublished: true },
        orderBy: [{ createdAt: "desc" }],
        take: 6,
      }),
      prisma.dzialka.count({ where: activeWhere }),
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

  const featuredCards = featuredListings as HomeListing[];

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
          <h1 className="font-hero text-[38px] uppercase tracking-[0.06em] text-[#D8D2DB] [text-shadow:0_2px_12px_rgba(0,0,0,0.45)] md:text-[70px] md:leading-none">
            Znajdź swoją działkę
          </h1>

          <HeroCounter target={listingCount} />

          <div className="mt-6 w-full max-w-4xl">
            <KupSearch navigationMode={true} />
          </div>

          <div className="mt-6">
            <Link
              href="/sprzedaj"
              className="text-sm text-white/42 transition hover:text-white/72"
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

      <section>
        <div className="mx-auto max-w-7xl px-6 pt-10 pb-10 md:px-10">
          <h2 className="text-[22px] font-semibold text-white md:text-[28px]">
            Najnowsze oferty
          </h2>

          <div className="mt-6 [touch-action:pan-x_pan-y]">
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

      {featuredCards.length > 0 ? (
        <section>
          <div className="mx-auto max-w-7xl px-6 pt-4 pb-12 md:px-10">
            <h2 className="text-[22px] font-semibold text-white md:text-[28px]">
              Wyróżnione oferty
            </h2>

            <div className="mt-6 [touch-action:pan-x_pan-y]">
              <HomeHorizontalSlider>
                {featuredCards.map((item) => (
                  <HomeListingCard key={item.id} d={item} />
                ))}
              </HomeHorizontalSlider>
            </div>
          </div>
        </section>
      ) : null}

      <section>
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
                          {new Date(article.createdAt).toLocaleDateString(
                            "pl-PL"
                          )}
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

      <PopularSearchesSection />
    </main>
  );
}