"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

// Gate skopiowany ze wzorca z app/admin/actions.ts — panel nie ma dziś wspólnego helpera.
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
 * Oznacza perełkę jako użytą: znika z listy, a jej miejsce zajmuje kolejna w kolejce.
 * `upsert`, nie `create`, bo dwa kliknięcia pod rząd (albo dwie karty) nie mogą wywalić
 * strony na złamanym unique.
 */
export async function markPerelkaUsedAction(formData: FormData) {
  await requireAdmin();

  const dzialkaId = String(formData.get("dzialkaId") ?? "");
  if (!dzialkaId) return;

  await prisma.perelkaUzyta.upsert({
    where: { dzialkaId },
    create: { dzialkaId },
    update: {},
  });

  revalidatePath("/admin/perelki");
}

/** Cofa oznaczenie — perełka wraca do kolejki na swoje miejsce wg odchylenia. */
export async function unmarkPerelkaUsedAction(formData: FormData) {
  await requireAdmin();

  const dzialkaId = String(formData.get("dzialkaId") ?? "");
  if (!dzialkaId) return;

  await prisma.perelkaUzyta.deleteMany({ where: { dzialkaId } });

  revalidatePath("/admin/perelki");
}
