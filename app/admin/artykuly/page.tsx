import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { redirect } from "next/navigation";
import {
  deleteArticleAction,
  toggleArticlePublishAction,
} from "./actions";

type AdminArticlesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

export default async function AdminArticlesPage({
  searchParams,
}: AdminArticlesPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      role: true,
    },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }

  const params = await searchParams;
  const q = params?.q?.trim() || "";
  const status = params?.status?.trim() || "all";

  const where = {
    ...(q
      ? {
          OR: [
            {
              title: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              slug: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(status === "published"
      ? { isPublished: true }
      : status === "draft"
        ? { isPublished: false }
        : {}),
  };

  const [articles, publishedCount, draftCount, totalCount] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.article.count({
      where: { isPublished: true },
    }),
    prisma.article.count({
      where: { isPublished: false },
    }),
    prisma.article.count(),
  ]);

  return (
    <main className="min-h-screen bg-[#131313] px-6 py-10 text-[#d9d9d9]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/admin"
              className="mb-3 inline-flex text-sm text-[#9f9f9f] transition hover:text-white"
            >
              ← Wróć do panelu admina
            </Link>

            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Artykuły / blog
            </h1>
            <p className="mt-2 text-sm text-[#bdbdbd]">
              Zarządzaj treściami SEO, publikacjami i szkicami.
            </p>
          </div>

          <Link
            href="/admin/artykuly/nowy"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#7aa333] px-5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            + Dodaj artykuł
          </Link>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[#9f9f9f]">Wszystkie artykuły</p>
            <p className="mt-2 text-3xl font-semibold text-white">{totalCount}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[#9f9f9f]">Opublikowane</p>
            <p className="mt-2 text-3xl font-semibold text-[#9fd14b]">
              {publishedCount}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[#9f9f9f]">Szkice</p>
            <p className="mt-2 text-3xl font-semibold text-white">{draftCount}</p>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <form className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Szukaj po tytule lub slugu..."
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 text-sm text-white outline-none transition placeholder:text-[#8f8f8f] focus:border-[#7aa333]/60"
            />

            <select
              name="status"
              defaultValue={status}
              className="h-12 min-w-[200px] rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 text-sm text-white outline-none transition focus:border-[#7aa333]/60"
            >
              <option value="all">Wszystkie statusy</option>
              <option value="published">Tylko opublikowane</option>
              <option value="draft">Tylko szkice</option>
            </select>

            <div className="flex gap-2">
              <button
                type="submit"
                className="h-12 rounded-2xl bg-[#7aa333] px-5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Filtruj
              </button>

              <Link
                href="/admin/artykuly"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-medium transition hover:bg-white/10"
              >
                Wyczyść
              </Link>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          {articles.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-medium text-white">
                Brak artykułów pasujących do filtrowania
              </p>
              <p className="mt-2 text-sm text-[#9f9f9f]">
                Zmień wyszukiwanie albo dodaj nowy wpis.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[#bdbdbd]">
                    <th className="px-4 py-4 font-medium">Tytuł</th>
                    <th className="px-4 py-4 font-medium">Slug</th>
                    <th className="px-4 py-4 font-medium">Status</th>
                    <th className="px-4 py-4 font-medium">Zdjęcie</th>
                    <th className="px-4 py-4 font-medium">Data utworzenia</th>
                    <th className="px-4 py-4 font-medium text-right">Akcje</th>
                  </tr>
                </thead>

                <tbody>
                  {articles.map((article) => (
                    <tr
                      key={article.id}
                      className="border-b border-white/5 align-top hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-4">
                        <div className="max-w-[360px]">
                          <div className="font-semibold text-white">
                            {article.title}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-[#8f8f8f]">
                            {article.excerpt || "Brak zajawki artykułu."}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-[#bdbdbd]">
                        /blog/{article.slug}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            article.isPublished
                              ? "bg-[#7aa333]/20 text-[#9fd14b]"
                              : "bg-white/10 text-[#d9d9d9]"
                          }`}
                        >
                          {article.isPublished ? "Opublikowany" : "Szkic"}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-[#bdbdbd]">
                        {article.imageUrl ? "Tak" : "Nie"}
                      </td>

                      <td className="px-4 py-4 text-[#bdbdbd]">
                        {new Date(article.createdAt).toLocaleDateString("pl-PL")}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/admin/artykuly/${article.id}/edytuj`}
                            className="inline-flex rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                          >
                            Edytuj
                          </Link>

                          <form action={toggleArticlePublishAction}>
                            <input type="hidden" name="id" value={article.id} />
                            <button
                              type="submit"
                              className="inline-flex rounded-xl border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-2 text-xs font-medium text-white transition hover:border-[#7aa333] hover:bg-[#7aa333]/20"
                            >
                              {article.isPublished
                                ? "Cofnij publikację"
                                : "Opublikuj"}
                            </button>
                          </form>

                          <Link
                            href={`/blog/${article.slug}`}
                            target="_blank"
                            className="inline-flex rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                          >
                            Podgląd
                          </Link>

                          <form action={deleteArticleAction}>
                            <input type="hidden" name="id" value={article.id} />
                            <button
                              type="submit"
                              className="inline-flex rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                            >
                              Usuń
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}