import path from "path";
import { sendMail } from "@/lib/mailer";
import { buildMailTemplate } from "@/lib/emailTemplate";

function baseUrl() {
  // 👇 NA PRODUKCJI ustawiasz NEXTAUTH_URL i samo się zmieni
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function sendWelcomeEmail(params: {
  email: string;
  name?: string | null;
}) {
  const email = params.email.toLowerCase().trim();
  const firstName = params.name?.trim()?.split(" ")[0];

  const intro = firstName
    ? `${firstName}, dziękujemy za rejestrację.

Twoje konto jest już gotowe. Możesz teraz dodać swoje ogłoszenie, zarządzać ofertami i korzystać z panelu użytkownika.`
    : `Dziękujemy za rejestrację.

Twoje konto jest już gotowe. Możesz teraz dodać swoje ogłoszenie, zarządzać ofertami i korzystać z panelu użytkownika.`;

  const buttonUrl = `${baseUrl()}/panel`;

  const html = buildMailTemplate({
    preheader: "Witamy w TylkoDziałki.",
    title: "Witamy w TylkoDziałki",
    intro,
    buttonLabel: "Przejdź do panelu",
    buttonUrl,
    note: "Dziękujemy za dołączenie do TylkoDziałki. Życzymy skutecznej sprzedaży.",
  });

  await sendMail({
    to: email,
    subject: "TylkoDziałki — witamy",
    html,
    text: `Witamy w TylkoDziałki. ${buttonUrl}`,
    attachments: [
      {
        filename: "logomail.png",
        path: path.join(process.cwd(), "public", "logomail.png"),
        cid: "logomail",
      },
    ],
  });
}