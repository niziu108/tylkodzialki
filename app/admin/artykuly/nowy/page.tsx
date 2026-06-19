import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { redirect } from "next/navigation";
import { createArticleAction } from "../actions";
import ArticleForm from "../ArticleForm";

export default async function NewArticlePage() {
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
            Dodaj nowy artykuł
          </h1>
          <p className="mt-2 text-sm text-fg/70">
            Twórz eksperckie treści pod SEO i buduj ruch organiczny dla
            tylkodzialki.pl.
          </p>
        </div>

        <ArticleForm mode="create" action={createArticleAction} />
      </div>
    </main>
  );
}