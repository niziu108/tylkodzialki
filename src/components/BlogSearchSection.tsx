"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type BlogArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  createdAt: Date | string;
  content: string;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function BlogSearchSection({
  articles,
}: {
  articles: BlogArticle[];
}) {
  const [query, setQuery] = useState("");

  const filteredArticles = useMemo(() => {
    const q = normalizeText(query.trim());

    if (!q) return articles;

    return articles.filter((article) => {
      const haystack = normalizeText(
        [article.title ?? "", article.excerpt ?? "", article.content ?? ""].join(
          " "
        )
      );

      return haystack.includes(q);
    });
  }, [articles, query]);

  return (
    <>
      <section className="relative overflow-hidden bg-[#131313]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/kup.webp)" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-[#131313]" />

        <div className="relative mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-[30px] border border-white/10 bg-black/20 p-6 backdrop-blur-sm md:p-8">
              <div className="flex flex-col items-center text-center">
                <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
                  Blog TylkoDziałki
                </div>

                <h1 className="mt-5 max-w-1xl text-2xl font-semibold tracking-tight text-white md:text-5xl">
                  Wiedza o działkach,
                  <br className="hidden md:block" />
                  prosto i konkretnie
                </h1>
              </div>

              <div className="mx-auto mt-8 max-w-3xl md:mt-9">
                <div className="rounded-[24px] border border-white/10 bg-black/25 p-2.5 backdrop-blur-sm md:p-3">
                  <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Wpisz czego szukasz... np. MPZP, warunki zabudowy, uzbrojenie działki"
                        className="w-full rounded-[18px] border border-white/8 bg-white/[0.03] py-4 pl-5 pr-14 text-[15px] text-white outline-none transition placeholder:text-white/35 focus:border-[#7aa333]/45 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#7aa333]/15 md:text-base"
                      />

                      <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-white/30">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                          />
                        </svg>
                      </div>
                    </div>

                    {query.trim() ? (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="inline-flex items-center justify-center rounded-[18px] border border-white/12 bg-white/[0.05] px-5 py-4 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.08] md:min-w-[130px]"
                      >
                        Wyczyść
                      </button>
                    ) : (
                      <div className="inline-flex items-center justify-center rounded-[18px] bg-[#7aa333] px-6 py-4 text-sm font-semibold text-black md:min-w-[150px]">
                        Szukaj
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 text-sm text-white/50">
                  {query.trim()
                    ? `Znaleziono artykułów: ${filteredArticles.length}`
                    : `Wszystkich artykułów: ${articles.length}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 md:px-8 md:py-12">
        {filteredArticles.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-white">
              Nie znaleziono artykułów
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/60 md:text-base">
              Spróbuj wpisać inne słowo, na przykład: MPZP, warunki zabudowy,
              uzbrojenie działki albo zakup działki.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredArticles.map((article) => (
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
                        className="h-auto w-full object-contain"
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
    </>
  );
}