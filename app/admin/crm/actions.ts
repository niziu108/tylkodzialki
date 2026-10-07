"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import { wyslijZaproszenieBiura, zalozKontoBiura } from "@/lib/biuroZaproszenie";

// Oczekiwane błędy zwracamy jako { error }, nie throw: na produkcji treść wyjątku z akcji
// nie dociera do przeglądarki (zostaje ogólny angielski komunikat z digest).

export type KontoBiuraState = {
  error?: string;
  userId?: string;
} | null;

export type ZaproszenieState = {
  error?: string;
  ok?: string;
} | null;

async function jestAdminem() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

export async function zalozKontoBiuraAction(
  _prev: KontoBiuraState,
  formData: FormData,
): Promise<KontoBiuraState> {
  if (!(await jestAdminem())) return { error: "Brak uprawnień." };

  const wynik = await zalozKontoBiura({
    email: String(formData.get("email") || ""),
    nazwaBiura: String(formData.get("nazwaBiura") || ""),
    telefon: String(formData.get("telefon") || ""),
  });

  if ("error" in wynik) {
    return { error: wynik.error, userId: "userId" in wynik ? wynik.userId : undefined };
  }

  revalidatePath("/admin");
  return { userId: wynik.userId };
}

export async function wyslijZaproszenieBiuraAction(
  _prev: ZaproszenieState,
  formData: FormData,
): Promise<ZaproszenieState> {
  if (!(await jestAdminem())) return { error: "Brak uprawnień." };

  const userId = String(formData.get("userId") || "");
  if (!userId) return { error: "Brak konta." };

  try {
    const wynik = await wyslijZaproszenieBiura(userId);
    if ("error" in wynik) return { error: wynik.error };

    revalidatePath(`/admin/crm/${userId}`);
    return {
      ok: `Wysłane. Działki w mailu: ${wynik.liczbaDzialek}, link ważny do ${wynik.wazneDo.toLocaleDateString("pl-PL")}.`,
    };
  } catch (e) {
    console.error("BIURO_ZAPROSZENIE_ERROR", e);
    return { error: "Nie udało się wysłać maila. Sprawdź logi SMTP." };
  }
}
