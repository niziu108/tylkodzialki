"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ArticleCardCover from "@/components/ArticleCardCover";
import ArticleMeta from "@/components/ArticleMeta";
import { ARTICLE_CATEGORIES } from "@/lib/articleCategories";

type BlogArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  createdAt: Date | string;
  content: string;
  category: string | null;
  readingTime: number | null;
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
  const [category, setCategory] = useState<string | null>(null);

  const categoryTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) {
      if (a.category) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
    return ARTICLE_CATEGORIES.filter((c) => counts.has(c.slug)).map((c) => ({
      slug: c.slug,
      label: c.label,
      count: counts.get(c.slug) ?? 0,
    }));
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const q = normalizeText(query.trim());

    return articles.filter((article) => {
      if (category && article.category !== category) return false;
      if (!q) return true;
      const haystack = normalizeText(
        [article.title ?? "", article.excerpt ?? "", article.content ?? ""].join(" ")
      );
      return haystack.includes(q);
    });
  }, [articles, query, category]);

  const isFiltering = query.trim() !== "" || category !== null;

  return (
    <>
      <section className="relative overflow-hidden bg-bg">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/kup.webp)" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-bg" />

        <div className="relative mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-[30px] border border-fg/10 bg-surface p-6 backdrop-blur-sm md:p-8">
              <div className="flex flex-col items-center text-center">
                <div className="inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-bright">
                  Blog tylkodzialki.pl
                </div>

                <h1 className="mt-5 max-w-1xl text-2xl font-semibold tracking-tight text-fg md:text-5xl">
                  Wiedza o działkach,
                  <br className="hidden md:block" />
                  prosto i konkretnie
                </h1>
              </div>

              <div className="mx-auto mt-8 max-w-3xl md:mt-9">
                <div className="rounded-[24px] border border-fg/10 bg-surface p-2.5 backdrop-blur-sm md:p-3">
                  <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Wpisz czego szukasz... np. MPZP, warunki zabudowy, uzbrojenie działki"
                        className="w-full rounded-[18px] border border-fg/8 bg-fg/[0.03] py-4 pl-5 pr-14 text-[15px] text-fg outline-none transition placeholder:text-fg/62 focus:border-brand/45 focus:bg-fg/[0.05] focus:ring-2 focus:ring-brand/15 md:text-base"
                      />

                      <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-fg/30">
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
                        className="inline-flex items-center justify-center rounded-[18px] border border-fg/12 bg-fg/[0.05] px-5 py-4 text-sm font-semibold text-fg transition hover:border-fg/25 hover:bg-fg/[0.08] md:min-w-[130px]"
                      >
                        Wyczyść
                      </button>
                    ) : (
                      <div className="inline-flex items-center justify-center rounded-[18px] bg-brand px-6 py-4 text-sm font-semibold text-black md:min-w-[150px]">
                        Szukaj
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 text-sm text-fg/70">
                  {isFiltering
                    ? `Znaleziono artykułów: ${filteredArticles.length}`
                    : `Wszystkich artykułów: ${articles.length}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {categoryTabs.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 pt-9 md:px-8 md:pt-10">
          <div className="flex items-center gap-x-6 overflow-x-auto border-b border-fg/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={`relative whitespace-nowrap pb-3 text-sm font-medium transition ${
                category === null ? "text-fg" : "text-fg/55 hover:text-fg/85"
              }`}
            >
              Wszystkie <span className="text-fg/35">{articles.length}</span>
              {category === null ? (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
              ) : null}
            </button>

            {categoryTabs.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => setCategory(t.slug)}
                className={`relative whitespace-nowrap pb-3 text-sm font-medium transition ${
                  category === t.slug ? "text-fg" : "text-fg/55 hover:text-fg/85"
                }`}
              >
                {t.label} <span className="text-fg/35">{t.count}</span>
                {category === t.slug ? (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-6 pt-8 pb-12 md:px-8 md:pb-14">
        {filteredArticles.length === 0 ? (
          <div className="rounded-[28px] border border-fg/10 bg-fg/[0.03] px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-fg">
              Nie znaleziono artykułów
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-fg/72 md:text-base">
              Zmień słowo lub kategorię. Możesz też wyczyścić filtry i przejrzeć
              wszystkie wpisy.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory(null);
              }}
              className="mt-6 inline-flex items-center justify-center rounded-2xl border border-fg/15 bg-fg/[0.04] px-5 py-3 text-sm font-semibold text-fg transition hover:border-fg/30 hover:bg-fg/[0.07]"
            >
              Wyczyść filtry
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredArticles.map((article) => (
              <article
                key={article.id}
                className="group overflow-hidden rounded-[28px] border border-fg/10 bg-fg/[0.03] transition hover:border-fg/20 hover:bg-fg/[0.045]"
              >
                <Link href={`/blog/${article.slug}`} className="block">
                  <ArticleCardCover
                    imageUrl={article.imageUrl}
                    title={article.title}
                  />

                  <div className="p-5 md:p-6">
                    <ArticleMeta
                      category={article.category}
                      createdAt={article.createdAt}
                      readingTime={article.readingTime}
                    />

                    <h2 className="mt-3 line-clamp-2 text-xl font-semibold tracking-tight text-fg">
                      {article.title}
                    </h2>

                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-fg/68 md:text-[15px]">
                      {article.excerpt ||
                        "Przeczytaj artykuł i sprawdź najważniejsze informacje dotyczące działek, formalności i sprzedaży."}
                    </p>

                    <div className="mt-5 inline-flex items-center text-sm font-semibold text-brand-bright">
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