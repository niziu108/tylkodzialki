import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
  });

  return (
    <main className="min-h-screen bg-[#131313] text-[#F3EFF5]">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-8 md:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
              Blog TylkoDziałki
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Wiedza o działkach,
              <br />
              prosto i konkretnie
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-white/65 md:text-lg">
              Artykuły o sprzedaży działek, zakupie, MPZP, wycenie, formalnościach
              i wszystkim, co warto sprawdzić przed decyzją.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-8 md:py-16">
        {articles.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-white">
              Blog jest właśnie przygotowywany
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/60 md:text-base">
              Wkrótce pojawią się tutaj pierwsze poradniki o działkach,
              formalnościach i wycenie nieruchomości gruntowych.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <article
                key={article.id}
                className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.045]"
              >
                <Link href={`/blog/${article.slug}`} className="block">
                  <div className="bg-black/20">
                    {article.imageUrl ? (
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full h-auto object-contain"
                      />
                    ) : (
                      <div className="flex aspect-[16/10] items-center justify-center text-sm text-white/35">
                        TylkoDziałki
                      </div>
                    )}
                  </div>

                  <div className="p-5 md:p-6">
                    <div className="text-[12px] uppercase tracking-[0.14em] text-white/40">
                      {new Date(article.createdAt).toLocaleDateString("pl-PL")}
                    </div>

                    <h2 className="mt-3 line-clamp-2 text-xl font-semibold tracking-tight text-white">
                      {article.title}
                    </h2>

                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-white/62 md:text-[15px]">
                      {article.excerpt ||
                        "Przeczytaj artykuł i sprawdź najważniejsze informacje dotyczące działek, formalności i sprzedaży."}
                    </p>

                    <div className="mt-5 inline-flex items-center text-sm font-semibold text-[#9fd14b]">
                      Czytaj artykuł →
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

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