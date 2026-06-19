import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { notFound, redirect } from "next/navigation";
import { updateArticleAction } from "../../actions";
import ArticleForm from "../../ArticleForm";

type EditArticlePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditArticlePage({
  params,
}: EditArticlePageProps) {
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

  const { id } = await params;

  const article = await prisma.article.findUnique({
    where: { id },
  });

  if (!article) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-bg px-6 py-10 text-fg/85">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/admin/artykuly"
            className="mb-3 inline-flex text-sm text-fg/55 transition hover:text-fg"
          >
            ← Wróć do artykułów
          </Link>

          <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
            Edytuj artykuł
          </h1>
          <p className="mt-2 text-sm text-fg/70">
            Zmieniaj treść, SEO i status publikacji wpisu.
          </p>
        </div>

        <ArticleForm
          mode="edit"
          action={updateArticleAction}
          initialData={{
            id: article.id,
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt,
            content: article.content,
            imageUrl: article.imageUrl,
            category: article.category,
            readingTime: article.readingTime,
            seoTitle: article.seoTitle,
            seoDescription: article.seoDescription,
            isPublished: article.isPublished,
            createdAt: new Date(article.createdAt).toLocaleDateString("pl-PL"),
            updatedAt: new Date(article.updatedAt).toLocaleDateString("pl-PL"),
          }}
        />
      </div>
    </main>
  );
}