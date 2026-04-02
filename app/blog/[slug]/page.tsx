import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

type BlogArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function renderSimpleMarkdown(content: string) {
  const lines = content.split("\n");

  return lines.map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={index} className="h-4" />;
    }

    if (trimmed.startsWith("### ")) {
      return (
        <h3
          key={index}
          className="mt-10 text-[24px] font-semibold tracking-tight text-white"
        >
          {trimmed.replace(/^### /, "")}
        </h3>
      );
    }

    if (trimmed.startsWith("## ")) {
      return (
        <h2
          key={index}
          className="mt-14 text-[30px] font-semibold tracking-tight text-white md:text-[36px]"
        >
          {trimmed.replace(/^## /, "")}
        </h2>
      );
    }

    if (trimmed.startsWith("# ")) {
      return (
        <h1
          key={index}
          className="mt-14 text-[34px] font-semibold tracking-tight text-white md:text-[42px]"
        >
          {trimmed.replace(/^# /, "")}
        </h1>
      );
    }

    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <p
          key={index}
          className="pl-2 text-[18px] leading-9 text-white/82"
        >
          {trimmed}
        </p>
      );
    }

    if (trimmed.startsWith("- ")) {
      return (
        <p
          key={index}
          className="pl-2 text-[18px] leading-9 text-white/82"
        >
          • {trimmed.replace(/^- /, "")}
        </p>
      );
    }

    return (
      <p
        key={index}
        className="text-[18px] leading-9 text-white/82"
      >
        {trimmed}
      </p>
    );
  });
}

export async function generateMetadata({ params }: BlogArticlePageProps) {
  const { slug } = await params;

  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      title: true,
      excerpt: true,
      isPublished: true,
    },
  });

  if (!article || !article.isPublished) {
    return {
      title: "Artykuł | TylkoDziałki",
    };
  }

  return {
    title: `${article.title} | TylkoDziałki`,
    description:
      article.excerpt ||
      "Artykuł poradnikowy o działkach, sprzedaży, zakupie i formalnościach.",
  };
}

export default async function BlogArticlePage({
  params,
}: BlogArticlePageProps) {
  const { slug } = await params;

  const article = await prisma.article.findUnique({
    where: { slug },
  });

  if (!article || !article.isPublished) {
    notFound();
  }

  const relatedArticles = await prisma.article.findMany({
    where: {
      isPublished: true,
      NOT: {
        id: article.id,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 3,
  });

  return (
    <main className="min-h-screen bg-[#131313] text-[#F3EFF5]">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-14 md:px-8 md:py-16">
          <Link
            href="/blog"
            className="inline-flex text-sm text-white/50 transition hover:text-white"
          >
            ← Wróć do bloga
          </Link>

          <div className="mt-6 text-[12px] uppercase tracking-[0.14em] text-[#9fd14b]">
            {new Date(article.createdAt).toLocaleDateString("pl-PL")}
          </div>

          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
            {article.title}
          </h1>

          {article.excerpt ? (
            <p className="mt-6 max-w-3xl text-[20px] leading-9 text-white/62">
              {article.excerpt}
            </p>
          ) : null}
        </div>
      </section>

      {article.imageUrl ? (
        <section className="mx-auto max-w-6xl px-6 pt-10 md:px-8 md:pt-12">
          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-black/20">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-auto object-contain"
            />
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-5xl px-6 py-12 md:px-8 md:py-16">
        <article className="max-w-4xl">
          <div className="space-y-5">
            {renderSimpleMarkdown(article.content)}
          </div>
        </article>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12 md:px-8 md:pb-16">
        <div className="rounded-[30px] border border-[#7aa333]/20 bg-white/[0.03] p-8 md:p-10">
          <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
            Sprzedajesz działkę?
          </div>

          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Dodaj ogłoszenie w TylkoDziałki
          </h2>

          <p className="mt-4 max-w-3xl text-base leading-8 text-white/65">
            Dotrzyj do osób, które naprawdę szukają działek. Bez zbędnego chaosu,
            w serwisie skupionym wyłącznie na gruntach.
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
              Zobacz oferty
            </Link>
          </div>
        </div>
      </section>

      {relatedArticles.length > 0 ? (
        <section className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-12 md:px-8 md:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Zobacz też
            </h2>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {relatedArticles.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.045]"
                >
                  <Link href={`/blog/${item.slug}`} className="block">
                    <div className="bg-black/20">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-auto object-contain"
                        />
                      ) : (
                        <div className="flex aspect-[16/10] items-center justify-center text-sm text-white/35">
                          TylkoDziałki
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="text-[12px] uppercase tracking-[0.14em] text-white/40">
                        {new Date(item.createdAt).toLocaleDateString("pl-PL")}
                      </div>

                      <h3 className="mt-3 line-clamp-2 text-lg font-semibold tracking-tight text-white">
                        {item.title}
                      </h3>

                      <p className="mt-3 line-clamp-3 text-sm leading-7 text-white/62">
                        {item.excerpt ||
                          "Przeczytaj artykuł i poznaj ważne informacje o działkach."}
                      </p>

                      <div className="mt-4 text-sm font-semibold text-[#9fd14b]">
                        Czytaj →
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}