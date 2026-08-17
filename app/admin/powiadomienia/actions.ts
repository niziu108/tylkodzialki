"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

// Gate jak w app/admin/perelki/actions.ts — panel nie ma dziś wspólnego helpera.
async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) redirect("/");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!currentUser || currentUser.role !== "ADMIN") redirect("/");

  return currentUser;
}

/**
 * Kasuje alert na stałe (spam, literówka w mailu, prośba z maila zwrotnego).
 * `deleteMany`, nie `delete`, żeby dwa kliknięcia pod rząd nie wywaliły strony na braku rekordu.
 */
export async function deleteOfferAlertAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.offerAlert.deleteMany({ where: { id } });

  revalidatePath("/admin/powiadomienia");
}
