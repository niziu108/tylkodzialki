"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

export async function createArticleAction(formData: FormData) {
  await requireAdmin();

  const title = String(formData.get("title") || "").trim();
  const slugInput = String(formData.get("slug") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const isPublished = String(formData.get("isPublished") || "") === "on";

  if (!title) {
    throw new Error("Tytuł artykułu jest wymagany.");
  }

  if (!content) {
    throw new Error("Treść artykułu jest wymagana.");
  }

  const slug = slugify(slugInput || title);

  if (!slug) {
    throw new Error("Nie udało się wygenerować poprawnego slugu.");
  }

  const existing = await prisma.article.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Artykuł z takim slugiem już istnieje.");
  }

  await prisma.article.create({
    data: {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      imageUrl: imageUrl || null,
      isPublished,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/artykuly");
  revalidatePath("/blog");

  redirect("/admin/artykuly");
}

export async function updateArticleAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const slugInput = String(formData.get("slug") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const isPublished = String(formData.get("isPublished") || "") === "on";

  if (!id) {
    throw new Error("Brak ID artykułu.");
  }

  if (!title) {
    throw new Error("Tytuł artykułu jest wymagany.");
  }

  if (!content) {
    throw new Error("Treść artykułu jest wymagana.");
  }

  const slug = slugify(slugInput || title);

  if (!slug) {
    throw new Error("Nie udało się wygenerować poprawnego slugu.");
  }

  const existing = await prisma.article.findFirst({
    where: {
      slug,
      NOT: { id },
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Inny artykuł ma już taki slug.");
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