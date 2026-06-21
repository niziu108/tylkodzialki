import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BlogSearchSection from "@/components/BlogSearchSection";

// Odświeżanie treści: po edycji w bazie/adminie lista przebuduje się w tle.
export const revalidate = 600;

export const metadata = {
  title: "Blog o działkach",
  description:
    "Poradniki, wskazówki i artykuły o działkach: MPZP, wycena działki, zakup, sprzedaż i formalności.",
  alternates: {
    canonical: "/blog",
  },
};

export default async function BlogPage() {
  const articles = await prisma.article.findMany({
    where: {
      isPublished: true,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      imageUrl: true,
      createdAt: true,
      content: true,
      category: true,
      readingTime: true,
    },
  });

  return (
    <main className="min-h-screen bg-bg text-fg">
      <BlogSearchSection articles={articles} />

      <section className="border-t border-fg/10">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-16">
          <div className="rounded-[32px] border border-brand/20 bg-fg/[0.03] p-8 md:p-10">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-bright">
                Masz działkę na sprzedaż?
              </div>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
                Dodaj ogłoszenie w tylkodzialki.pl
              </h2>

              <p className="mt-4 text-base leading-8 text-fg/70">
                Pokaż swoją ofertę w serwisie skupionym wyłącznie na działkach.
                Bez chaosu, bez mieszkań i bez przypadkowego ruchu.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sprzedaj"
                  className="inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-4 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Dodaj działkę
                </Link>

                <Link
                  href="/kup"
                  className="inline-flex items-center justify-center rounded-2xl border border-fg/15 bg-fg/[0.03] px-6 py-4 text-sm font-semibold text-fg transition hover:border-fg/30 hover:bg-fg/[0.05]"
                >
                  Przeglądaj oferty
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}