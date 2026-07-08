"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import HeroGradientBg from "@/components/HeroGradientBg";
import ArticleCardCover from "@/components/ArticleCardCover";
import ArticleMeta from "@/components/ArticleMeta";
import Pager from "@/components/Pager";
import { ARTICLE_CATEGORIES } from "@/lib/articleCategories";

// Tyle artykułów na stronę, żeby lista nie rosła w nieskończoność (1 kolumna
// mobile, do 3 kolumn na xl => 24 dzieli się równo po 8 rzędów).
const PAGE_SIZE = 24;

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

  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));

  // Zmiana filtra/tematu => wracamy na 1. stronę (inaczej można utknąć na
  // pustej stronie po zawężeniu wyników).
  useEffect(() => {
    setPage(1);
  }, [query, category]);

  // Gdyby liczba wyników spadła poniżej bieżącej strony (np. bezpiecznik).
  const safePage = Math.min(page, totalPages);

  const pageArticles = useMemo(
    () => filteredArticles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredArticles, safePage]
  );

  // Przewijamy DOPIERO po przerysowaniu nowej strony (useEffect poniżej).
  // Gdyby scroll odpalał się od razu w handlerze, płynna animacja celowałaby w
  // pozycję ze starego, wyższego układu; przy krótszej stronie dokument się
  // kurczy i przeglądarka docina scroll do maksimum => ląduje na stopce.
  const pendingScroll = useRef(false);

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(totalPages, p)));
    pendingScroll.current = true;
  };

  useEffect(() => {
    if (!pendingScroll.current) return;
    pendingScroll.current = false;
    document
      .getElementById("blog-wyniki")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [safePage]);

  return (
    <>
      <section className="relative overflow-hidden bg-bg">
        {/* Gradient spójny z resztą serwisu (główna, /kup, /sprawdź) zamiast zdjęcia
            => szybki LCP. */}
        <HeroGradientBg />

        <div className="relative z-10 mx-auto max-w-4xl px-6 py-16 text-center md:px-8 md:py-20">
          <h1 className="font-hero text-[34px] uppercase tracking-[0.06em] text-fg md:text-[58px] md:leading-none">
            Wiedza o działkach
          </h1>

          <div className="mt-5 inline-flex rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[12px] font-semibold text-brand-text">
            Blog tylkodzialki.pl
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-[28px] border border-fg/10 bg-surface p-5 text-left backdrop-blur-sm md:p-7">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_240px]">
                  <div>
                    <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
                      Temat
                    </label>
                    <div className="mt-3 rounded-xl border border-fg/25">
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Wpisz temat, np. MPZP, uzbrojenie, klasa gruntu"
                        className="w-full bg-transparent px-4 py-3 text-fg/90 outline-none placeholder:text-fg/62"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] uppercase tracking-[0.26em] text-fg">
                      Kategoria
                    </label>
                    <div className="mt-3 rounded-xl border border-fg/25">
                      <select
                        value={category ?? ""}
                        onChange={(e) => setCategory(e.target.value || null)}
                        className="w-full bg-transparent px-4 py-3 text-fg/90 outline-none"
                      >
                        <option value="" className="bg-bg">
                          Wszystkie kategorie ({articles.length})
                        </option>
                        {categoryTabs.map((t) => (
                          <option key={t.slug} value={t.slug} className="bg-bg">
                            {t.label} ({t.count})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[12px] uppercase tracking-[0.18em] text-fg">
                    {isFiltering
                      ? `Znaleziono: ${filteredArticles.length}`
                      : `Wszystkich artykułów: ${articles.length}`}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setCategory(null);
                      }}
                      className="rounded-xl border border-fg/20 px-4 py-3 text-[12px] uppercase tracking-[0.22em] text-fg/75 transition hover:border-fg/40"
                    >
                      Wyczyść
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("blog-wyniki")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                      className="rounded-xl bg-brand px-6 py-3 text-[12px] font-medium uppercase tracking-[0.22em] text-ink transition hover:bg-brand-strong"
                    >
                      Szukaj
                    </button>
                  </div>
                </div>
              </div>
        </div>
      </section>

      <section
        id="blog-wyniki"
        className="mx-auto max-w-7xl scroll-mt-24 px-6 py-10 md:px-8 md:py-12"
      >
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
          <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pageArticles.map((article) => (
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

          {totalPages > 1 && (
            <Pager
              className="mt-12 border-t border-fg/10 pt-8"
              page={safePage}
              totalPages={totalPages}
              onPrev={() => goToPage(safePage - 1)}
              onNext={() => goToPage(safePage + 1)}
              onGo={goToPage}
            />
          )}
          </>
        )}
      </section>
    </>
  );
}