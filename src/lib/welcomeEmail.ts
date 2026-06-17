import { sendMail } from "@/lib/mailer";
import { buildMailTemplate, mailLogoAttachment } from "@/lib/emailTemplate";

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

  const title = firstName ? `Witaj, ${firstName}` : "Witaj w tylkodzialki.pl";

  const intro = `Cieszymy się, że jesteś z nami. Twoje konto jest już gotowe.

tylkodzialki.pl to portal poświęcony wyłącznie działkom. Czy szukasz działki, czy chcesz wystawić własną, wszystko masz w jednym miejscu.`;

  const buttonUrl = `${baseUrl()}/panel`;

  const html = buildMailTemplate({
    preheader: "Twoje konto jest już gotowe.",
    title,
    intro,
    bullets: [
      "Przeglądaj działki z całej Polski i zapisuj ulubione",
      "Wystaw własną działkę, kiedy tylko zechcesz",
      "Ustaw alerty i jako pierwszy poznaj nowe oferty",
    ],
    buttonLabel: "Przejdź do panelu",
    buttonUrl,
    note: "Masz pytania? Napisz na kontakt@tylkodzialki.pl, chętnie pomożemy.",
  });

  await sendMail({
    to: email,
    subject: "Witamy w tylkodzialki.pl",
    html,
    text: `Witaj w tylkodzialki.pl. Twoje konto jest już gotowe: ${buttonUrl}`,
    attachments: [mailLogoAttachment()],
  });
}
