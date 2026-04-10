import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BlogSearchSection from "@/components/BlogSearchSection";

export const metadata = {
  title: "Blog o działkach | TylkoDziałki",
  description:
    "Poradniki, wskazówki i artykuły o działkach: MPZP, wycena działki, zakup, sprzedaż i formalności.",
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
    },
  });

  return (
    <main className="min-h-screen bg-[#131313] text-[#F3EFF5]">
      <BlogSearchSection articles={articles} />

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-16">
          <div className="rounded-[32px] border border-[#7aa333]/20 bg-white/[0.03] p-8 md:p-10">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
                Masz działkę na sprzedaż?
              </div>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Dodaj ogłoszenie w TylkoDziałki
              </h2>

              <p className="mt-4 text-base leading-8 text-white/65">
                Pokaż swoją ofertę w serwisie skupionym wyłącznie na działkach.
                Bez chaosu, bez mieszkań i bez przypadkowego ruchu.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sprzedaj"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#7aa333] px-6 py-4 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Dodaj działkę
                </Link>

                <Link
                  href="/kup"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.05]"
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