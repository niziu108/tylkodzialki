import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArticleContent from "@/components/ArticleContent";
import ArticleCardCover from "@/components/ArticleCardCover";
import ArticleMeta from "@/components/ArticleMeta";
import ArticleToc from "@/components/ArticleToc";
import { extractHeadings } from "@/lib/articleToc";

const SITE_URL = "https://tylkodzialki.pl";

type BlogArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: BlogArticlePageProps) {
  const { slug } = await params;

  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      title: true,
      excerpt: true,
      isPublished: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
      seoTitle: true,
      seoDescription: true,
    },
  });

  if (!article || !article.isPublished) {
    return {
      title: "Artykuł",
    };
  }

  const metaTitle = article.seoTitle || article.title;
  const description =
    article.seoDescription ||
    article.excerpt ||
    "Artykuł poradnikowy o działkach, sprzedaży, zakupie i formalnościach.";

  const canonical = `/blog/${slug}`;

  // og:image i twitter:image dostarcza konwencja opengraph-image.tsx
  // (generowana okładka) — nie ustawiamy ich ręcznie, żeby nie dublować.
  return {
    title: metaTitle,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: `${SITE_URL}${canonical}`,
      publishedTime: new Date(article.createdAt).toISOString(),
      modifiedTime: new Date(article.updatedAt).toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
    },
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

  const canonicalUrl = `${SITE_URL}/blog/${article.slug}`;
  const coverUrl = `${canonicalUrl}/opengraph-image`;
  const heroSrc = article.imageUrl || coverUrl;
  const articleImages = [article.imageUrl || coverUrl];
  const headings = extractHeadings(article.content, article.title);

  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description:
      article.excerpt ||
      "Artykuł poradnikowy o działkach, sprzedaży, zakupie i formalnościach.",
    image: articleImages,
    datePublished: new Date(article.createdAt).toISOString(),
    dateModified: new Date(article.updatedAt).toISOString(),
    author: {
      "@type": "Organization",
      name: "tylkodzialki.pl",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "tylkodzialki.pl",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    url: canonicalUrl,
  };

  // BreadcrumbList (Strona główna / Blog / tytuł) emituje już komponent
  // <Breadcrumbs/> niżej — nie dublujemy go tutaj.

  return (
    <main className="min-h-screen bg-[#131313] text-[#F3EFF5]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }}
      />

      <section className="border-b border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-14 md:px-8 md:py-16">
          <Link
            href="/blog"
            className="inline-flex text-sm text-white/50 transition hover:text-white"
          >
            ← Wróć do bloga
          </Link>

          <div className="mt-4">
            <Breadcrumbs
              items={[
                { label: 'Strona główna', href: '/' },
                { label: 'Blog', href: '/blog' },
                { label: article.title },
              ]}
            />
          </div>

          <ArticleMeta
            category={article.category}
            createdAt={article.createdAt}
            readingTime={article.readingTime}
            className="mt-6"
          />

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

      <section className="mx-auto max-w-6xl px-6 pt-10 md:px-8 md:pt-12">
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-black/20">
          <img
            src={heroSrc}
            alt={article.title}
            className="mx-auto max-h-[70vh] w-full object-contain"
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12 md:px-8 md:py-16">
        <article className="max-w-[700px]">
          <ArticleToc headings={headings} />
          <ArticleContent content={article.content} />
        </article>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12 md:px-8 md:pb-16">
        <div className="rounded-[30px] border border-[#7aa333]/20 bg-white/[0.03] p-8 md:p-10">
          <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
            Sprzedajesz działkę?
          </div>

          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Dodaj ogłoszenie w tylkodzialki.pl
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
                  className="group overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.045]"
                >
                  <Link href={`/blog/${item.slug}`} className="block">
                    <ArticleCardCover imageUrl={item.imageUrl} title={item.title} />

                    <div className="p-5">
                      <ArticleMeta
                        category={item.category}
                        createdAt={item.createdAt}
                        readingTime={item.readingTime}
                      />

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