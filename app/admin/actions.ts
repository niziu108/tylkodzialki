"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";

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

async function getAppConfig() {
  let config = await prisma.appConfig.findFirst();

  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        paymentsEnabled: false,
        freeListingCredits: 0,
        freeListingCreditsDays: null,
      },
    });
  }

  return config;
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") || "");

  if (!userId) return;

  if (admin.id === userId) {
    throw new Error("Nie możesz usunąć własnego konta admina.");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  revalidatePath("/admin");
}

export async function toggleUserRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") || "");

  if (!userId) return;

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!targetUser) return;

  if (admin.id === userId) {
    throw new Error("Nie możesz zmienić własnej roli.");
  }

  const nextRole: Role = targetUser.role === "ADMIN" ? "USER" : "ADMIN";

  await prisma.user.update({
    where: { id: userId },
    data: { role: nextRole },
  });

  revalidatePath("/admin");
}

export async function togglePaymentsAction() {
  await requireAdmin();

  const config = await getAppConfig();

  await prisma.appConfig.update({
    where: { id: config.id },
    data: {
      paymentsEnabled: !config.paymentsEnabled,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/panel");
  revalidatePath("/sprzedaj");
}