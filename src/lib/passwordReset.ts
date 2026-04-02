import crypto from "crypto";
import path from "path";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { buildMailTemplate } from "@/lib/emailTemplate";

function baseUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { email: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 60 min

  await prisma.passwordResetToken.deleteMany({
    where: { email: normalizedEmail },
  });

  await prisma.passwordResetToken.create({
    data: {
      email: normalizedEmail,
      token,
      expiresAt,
    },
  });

  const url = `${baseUrl()}/auth/reset?token=${token}`;

  const html = buildMailTemplate({
    preheader: "Ustaw nowe hasło do konta TylkoDziałki.",
    title: "Reset hasła",
    intro: `Otrzymaliśmy prośbę o ustawienie nowego hasła do konta powiązanego z adresem ${normalizedEmail}. Kliknij poniższy przycisk, aby przejść do bezpiecznej zmiany hasła.`,
    buttonLabel: "Ustaw nowe hasło",
    buttonUrl: url,
    note: "Link do resetu hasła wygaśnie za 60 minut. Jeśli to nie Ty wysłałeś tę prośbę, po prostu zignoruj tę wiadomość.",
  });

  await sendMail({
    to: normalizedEmail,
    subject: "TylkoDziałki — reset hasła",
    html,
    text: `Reset hasła: ${url}`,
    attachments: [
      {
        filename: "logomail.png",
        path: path.join(process.cwd(), "public", "logomail.png"),
        cid: "logomail",
      },
    ],
  });
}

export async function resetPassword(token: string, newPassword: string) {
  const cleanToken = String(token || "").trim();
  const cleanPassword = String(newPassword || "");

  if (!cleanToken) {
    return { ok: false as const, code: "INVALID_TOKEN" as const };
  }

  if (cleanPassword.length < 6) {
    return { ok: false as const, code: "PASSWORD_TOO_SHORT" as const };
  }

  const row = await prisma.passwordResetToken.findUnique({
    where: { token: cleanToken },
  });

  if (!row) {
    return { ok: false as const, code: "INVALID_TOKEN" as const };
  }

  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.passwordResetToken.delete({ where: { token: cleanToken } }).catch(() => {});
    return { ok: false as const, code: "EXPIRED_TOKEN" as const };
  }

  const user = await prisma.user.findUnique({
    where: { email: row.email },
    select: { id: true, email: true },
  });

  if (!user?.email) {
    await prisma.passwordResetToken.deleteMany({ where: { email: row.email } }).catch(() => {});
    return { ok: false as const, code: "USER_NOT_FOUND" as const };
  }

  const passwordHash = await bcrypt.hash(cleanPassword, 12);

  await prisma.user.update({
    where: { email: user.email },
    data: { passwordHash },
  });

  await prisma.passwordResetToken.deleteMany({
    where: { email: user.email },
  });

  return { ok: true as const };
}