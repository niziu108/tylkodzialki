"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { estimateReadingTime } from "@/lib/articleCategories";

// Stan zwracany do formularza (useActionState). Gdy zapis się uda, akcja
// przekierowuje i nic nie zwraca; przy problemie wracamy z komunikatem, żeby
// formularz pokazał czytelny błąd zamiast crashować do strony "server-side
// exception".
export type ArticleFormState = { error?: string } | undefined;

// Czas czytania: bierzemy wartość z formularza, a gdy pusta/niepoprawna —
// liczymy automatycznie z treści.
function resolveReadingTime(raw: string, content: string): number {
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : estimateReadingTime(content);
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
    },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }

  return currentUser;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createArticleAction(
  _prevState: ArticleFormState,
  formData: FormData
): Promise<ArticleFormState> {
  await requireAdmin();

  const title = String(formData.get("title") || "").trim();
  const slugInput = String(formData.get("slug") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const seoTitle = String(formData.get("seoTitle") || "").trim();
  const seoDescription = String(formData.get("seoDescription") || "").trim();
  const isPublished = String(formData.get("isPublished") || "") === "on";
  const readingTime = resolveReadingTime(
    String(formData.get("readingTime") || "").trim(),
    content
  );

  if (!title) {
    return { error: "Tytuł artykułu jest wymagany." };
  }

  if (!content) {
    return { error: "Treść artykułu jest wymagana." };
  }

  const slug = slugify(slugInput || title);

  if (!slug) {
    return { error: "Nie udało się wygenerować poprawnego slugu z tytułu." };
  }

  const existing = await prisma.article.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing) {
    return {
      error: `Artykuł o adresie „/blog/${slug}" już istnieje. Zmień slug na inny.`,
    };
  }

  await prisma.article.create({
    data: {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      imageUrl: imageUrl || null,
      category: category || null,
      readingTime,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      isPublished,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/artykuly");
  revalidatePath("/blog");

  redirect("/admin/artykuly");
}

export async function updateArticleAction(
  _prevState: ArticleFormState,
  formData: FormData
): Promise<ArticleFormState> {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const slugInput = String(formData.get("slug") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const seoTitle = String(formData.get("seoTitle") || "").trim();
  const seoDescription = String(formData.get("seoDescription") || "").trim();
  const isPublished = String(formData.get("isPublished") || "") === "on";
  const readingTime = resolveReadingTime(
    String(formData.get("readingTime") || "").trim(),
    content
  );

  if (!id) {
    return { error: "Brak ID artykułu." };
  }

  if (!title) {
    return { error: "Tytuł artykułu jest wymagany." };
  }

  if (!content) {
    return { error: "Treść artykułu jest wymagana." };
  }

  const slug = slugify(slugInput || title);

  if (!slug) {
    return { error: "Nie udało się wygenerować poprawnego slugu z tytułu." };
  }

  const existing = await prisma.article.findFirst({
    where: {
      slug,
      NOT: { id },
    },
    select: { id: true },
  });

  if (existing) {
    return {
      error: `Inny artykuł ma już adres „/blog/${slug}". Zmień slug na inny.`,
    };
  }

  const currentArticle = await prisma.article.findUnique({
    where: { id },
    select: { slug: true },
  });

  await prisma.article.update({
    where: { id },
    data: {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      imageUrl: imageUrl || null,
      category: category || null,
      readingTime,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      isPublished,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/artykuly");
  revalidatePath("/blog");

  if (currentArticle?.slug) {
    revalidatePath(`/blog/${currentArticle.slug}`);
  }

  revalidatePath(`/blog/${slug}`);

  redirect("/admin/artykuly");
}

export async function deleteArticleAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();

  if (!id) return;

  const article = await prisma.article.findUnique({
    where: { id },
    select: { slug: true },
  });

  await prisma.article.delete({
    where: { id },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/artykuly");
  revalidatePath("/blog");

  if (article?.slug) {
    revalidatePath(`/blog/${article.slug}`);
  }
}

export async function toggleArticlePublishAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();

  if (!id) return;

  const article = await prisma.article.findUnique({
    where: { id },
    select: {
      isPublished: true,
      slug: true,
    },
  });

  if (!article) return;

  await prisma.article.update({
    where: { id },
    data: {
      isPublished: !article.isPublished,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/artykuly");
  revalidatePath("/blog");

  if (article.slug) {
    revalidatePath(`/blog/${article.slug}`);
  }
}