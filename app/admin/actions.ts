"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { sendMail } from "@/lib/mailer";
import { deleteUserCompletely } from "@/lib/delete-user-completely";
import { deleteFromR2, uploadBufferToR2 } from "@/lib/r2";

const APP_URL = "https://tylkodzialki.pl";
const LOGIN_URL = `${APP_URL}/auth`;

type MailAudience = "ALL" | "LISTER" | "EXPIRED";

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

async function getAppConfig() {
  let config = await prisma.appConfig.findFirst();

  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        paymentsEnabled: false,
        freeListingCredits: 0,
        freeListingCreditsDays: null,
        listingSinglePriceGrossPln: 1900,
        listingPack10PriceGrossPln: 14900,
        listingPack40PriceGrossPln: 39900,
        featuredSinglePriceGrossPln: 1900,
        featuredPack3PriceGrossPln: 3900,
      },
    });
  }

  return config;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bodyToHtml(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 16px;">${escapeHtml(line)}</p>`)
    .join("");
}

function buildMailHtml(subject: string, body: string) {
  return `
    <div style="margin:0;padding:24px;background:#f5f5f5;">
      <div style="max-width:700px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e8e8e8;">
        <div style="padding:28px 28px 18px;background:#131313;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#9fd14b;">
            TylkoDziałki
          </div>
          <h1 style="margin:14px 0 0;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;">
            ${escapeHtml(subject)}
          </h1>
        </div>

        <div style="padding:28px;color:#111111;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;">
          ${bodyToHtml(body)}
          <div style="margin-top:28px;">
            <a href="${LOGIN_URL}" style="display:inline-block;background:#7aa333;color:#111111;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;">
              Zaloguj się do konta
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#666666;">
            Jeśli nie planujesz teraz żadnych działań, możesz po prostu zignorować tę wiadomość.
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildMailText(body: string) {
  return `${body}

Zaloguj się do konta:
${LOGIN_URL}`;
}

async function getRecipients(audience: MailAudience) {
  if (audience === "ALL") {
    return prisma.user.findMany({
      where: { email: { not: null } },
      select: { id: true, email: true, name: true },
      orderBy: { createdAt: "desc" },
    });
  }

  if (audience === "LISTER") {
    return prisma.user.findMany({
      where: { email: { not: null }, dzialki: { some: {} } },
      select: { id: true, email: true, name: true },
      orderBy: { createdAt: "desc" },
    });
  }

  const now = new Date();

  return prisma.user.findMany({
    where: {
      email: { not: null },
      dzialki: {
        some: {
          OR: [{ status: "ZAKONCZONE" }, { expiresAt: { lt: now } }],
        },
      },
    },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "desc" },
  });
}

function toGross(value: FormDataEntryValue | null) {
  const str = String(value || "").replace(",", ".").trim();
  const num = Number(str);

  if (!Number.isFinite(num) || num <= 0) {
    throw new Error("Nieprawidłowa cena.");
  }

  return Math.round(num * 100);
}

function getLogoExtension(file: File) {
  const type = file.type;

  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/svg+xml") return "svg";

  return null;
}

function extractR2KeyFromUrl(url: string | null | undefined) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const publicHost = new URL(process.env.R2_PUBLIC_URL || "https://img.tylkodzialki.pl")
      .hostname;

    if (parsed.hostname !== publicHost) return null;

    return parsed.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

async function deleteOldLogoIfR2(url: string | null | undefined) {
  const key = extractR2KeyFromUrl(url);
  if (!key) return;

  try {
    await deleteFromR2(key);
  } catch (error) {
    console.error("DELETE_OLD_LOGO_R2_ERROR", key, error);
  }
}

export async function savePricingAction(formData: FormData) {
  await requireAdmin();

  const listingSinglePriceGrossPln = toGross(formData.get("listingSinglePrice"));
  const listingPack10PriceGrossPln = toGross(formData.get("listingPack10Price"));
  const listingPack40PriceGrossPln = toGross(formData.get("listingPack40Price"));
  const featuredSinglePriceGrossPln = toGross(formData.get("featuredSinglePrice"));
  const featuredPack3PriceGrossPln = toGross(formData.get("featuredPack3Price"));

  const config = await getAppConfig();

  await prisma.appConfig.update({
    where: { id: config.id },
    data: {
      listingSinglePriceGrossPln,
      listingPack10PriceGrossPln,
      listingPack40PriceGrossPln,
      featuredSinglePriceGrossPln,
      featuredPack3PriceGrossPln,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/panel");
  revalidatePath("/panel/pakiety");
  revalidatePath("/panel/wyroznienia");
}

export async function saveUserAgencyLogoAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") || "").trim();
  const logoUrl = String(formData.get("logoUrl") || "").trim();
  const removeLogo = String(formData.get("removeLogo") || "") === "1";
  const logoFile = formData.get("logoFile");

  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, defaultBiuroLogoUrl: true },
  });

  if (!user) return;

  if (removeLogo) {
    await deleteOldLogoIfR2(user.defaultBiuroLogoUrl);

    await prisma.user.update({
      where: { id: userId },
      data: { defaultBiuroLogoUrl: null },
    });

    revalidatePath("/admin");
    revalidatePath("/kup");
    return;
  }

  if (logoFile instanceof File && logoFile.size > 0) {
    const ext = getLogoExtension(logoFile);

    if (!ext) {
      throw new Error("Nieobsługiwany format logo. Użyj PNG, JPG, WEBP albo SVG.");
    }

    if (logoFile.size > 2 * 1024 * 1024) {
      throw new Error("Logo jest za duże. Maksymalny rozmiar to 2 MB.");
    }

    const buffer = Buffer.from(await logoFile.arrayBuffer());

    const upload = await uploadBufferToR2({
      buffer,
      originalFileName: logoFile.name || `logo-biura.${ext}`,
      mimeType: logoFile.type,
      folder: "loga-biur",
    });

    await deleteOldLogoIfR2(user.defaultBiuroLogoUrl);

    await prisma.user.update({
      where: { id: userId },
      data: { defaultBiuroLogoUrl: upload.url },
    });

    revalidatePath("/admin");
    revalidatePath("/kup");
    return;
  }

  if (logoUrl !== user.defaultBiuroLogoUrl) {
    await deleteOldLogoIfR2(user.defaultBiuroLogoUrl);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { defaultBiuroLogoUrl: logoUrl || null },
  });

  revalidatePath("/admin");
  revalidatePath("/kup");
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") || "");

  if (!userId) return;

  if (admin.id === userId) {
    throw new Error("Nie możesz usunąć własnego konta admina.");
  }

  await deleteUserCompletely(userId);

  revalidatePath("/admin");
  revalidatePath("/kup");
  revalidatePath("/panel");
}

export async function toggleUserRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") || "");

  if (!userId) return;

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
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
  const nextPaymentsEnabled = !config.paymentsEnabled;
  const now = new Date();
  const transitionExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.appConfig.update({
      where: { id: config.id },
      data: { paymentsEnabled: nextPaymentsEnabled },
    });

    if (nextPaymentsEnabled) {
      await tx.dzialka.updateMany({
        where: {
          ownerId: { not: null },
          status: "AKTYWNE",
          endedAt: null,
          expiresAt: null,
        },
        data: { expiresAt: transitionExpiresAt },
      });
    } else {
      await tx.dzialka.updateMany({
        where: {
          ownerId: { not: null },
          status: "AKTYWNE",
          endedAt: null,
        },
        data: { expiresAt: null },
      });
    }
  });

  revalidatePath("/admin");
  revalidatePath("/panel");
  revalidatePath("/sprzedaj");
  revalidatePath("/kup");
}

export async function sendAdminMailTestAction(formData: FormData) {
  const admin = await requireAdmin();

  const adminUser = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { id: true, email: true, name: true },
  });

  if (!adminUser?.email) redirect("/admin?mailError=Brak-maila-admina");

  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();

  if (!subject || !body) redirect("/admin?mailError=Uzupelnij-temat-i-tresc");

  await sendMail({
    to: adminUser.email,
    subject: `[TEST] ${subject}`,
    html: buildMailHtml(subject, body),
    text: buildMailText(body),
  });

  revalidatePath("/admin");
  redirect("/admin?mailSent=test");
}

export async function sendAdminMailAction(formData: FormData) {
  await requireAdmin();

  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const audience = String(formData.get("audience") || "LISTER") as MailAudience;

  if (!subject || !body) redirect("/admin?mailError=Uzupelnij-temat-i-tresc");

  if (!["ALL", "LISTER", "EXPIRED"].includes(audience)) {
    redirect("/admin?mailError=Nieprawidlowa-grupa");
  }

  const recipients = await getRecipients(audience);

  if (!recipients.length) redirect("/admin?mailError=Brak-odbiorcow");

  const uniqueRecipients = Array.from(
    new Map(
      recipients
        .filter((user) => !!user.email)
        .map((user) => [user.email as string, user])
    ).values()
  );

  let sent = 0;
  let failed = 0;

  const campaignKey = `manual-${Date.now()}`;

  for (const user of uniqueRecipients) {
    if (!user.email) continue;

    try {
      await sendMail({
        to: user.email,
        subject,
        html: buildMailHtml(subject, body),
        text: buildMailText(body),
      });

      sent += 1;

      try {
        await prisma.emailSendLog.create({
          data: {
            type: "REMINDER",
            campaignKey,
            email: user.email,
            userId: user.id,
          },
        });
      } catch (logError) {
        console.error("EMAIL_SEND_LOG_ERROR", user.email, logError);
      }
    } catch (error) {
      failed += 1;
      console.error("ADMIN_BULK_EMAIL_ERROR", user.email, error);
    }
  }

  revalidatePath("/admin");
  redirect(`/admin?mailSent=all&sent=${sent}&failed=${failed}`);
}