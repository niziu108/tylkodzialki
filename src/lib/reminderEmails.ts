import path from "path";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { buildMailTemplate } from "@/lib/emailTemplate";

function baseUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

function getCampaignKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const half = date.getDate() <= 15 ? "A" : "B";
  return `${year}-${month}-${half}`;
}

function buildReminderContent(params: {
  name?: string | null;
  listingsCount: number;
  campaignKey: string;
}) {
  const firstName = params.name?.trim()?.split(" ")[0];
  const hello = firstName ? `${firstName},` : "Dzień dobry,";

  if (params.listingsCount > 0) {
    return {
      subject: "TylkoDziałki — sprawdź swoje ogłoszenia",
      title: "Sprawdź swoje ogłoszenia",
      intro: `${hello}

Przypominamy o Twoim koncie w TylkoDziałki.

Masz obecnie ${params.listingsCount} ogłoszenie(a/ń) w systemie. Warto zajrzeć do panelu, sprawdzić swoje oferty i upewnić się, że wszystko jest aktualne.`,
      buttonLabel: "Przejdź do panelu",
      buttonUrl: `${baseUrl()}/panel`,
      note: "To lekka wiadomość przypominająca o Twoim koncie i ogłoszeniach w TylkoDziałki.",
    };
  }

  return {
    subject: "TylkoDziałki — pamiętaj o swoim koncie",
    title: "Pamiętaj o swoim koncie",
    intro: `${hello}

Przypominamy o TylkoDziałki.

Jeśli planujesz sprzedaż działki, możesz w każdej chwili wrócić do serwisu, dodać ogłoszenie i zacząć działać.`,
    buttonLabel: "Przejdź na stronę",
    buttonUrl: `${baseUrl()}/`,
    note: "Ta wiadomość ma charakter przypominający i jest wysyłana maksymalnie dwa razy w miesiącu.",
  };
}

export async function sendMonthlyReminders() {
  const campaignKey = getCampaignKey(new Date());

  const users = await prisma.user.findMany({
    where: {
      email: {
        not: null,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      _count: {
        select: {
          dzialki: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email) {
      skipped++;
      continue;
    }

    const alreadySent = await prisma.emailSendLog.findUnique({
      where: {
        type_campaignKey_email: {
          type: "REMINDER",
          campaignKey,
          email: user.email,
        },
      },
    });

    if (alreadySent) {
      skipped++;
      continue;
    }

    const content = buildReminderContent({
      name: user.name,
      listingsCount: user._count.dzialki,
      campaignKey,
    });

    try {
      const html = buildMailTemplate({
        preheader: content.title,
        title: content.title,
        intro: content.intro,
        buttonLabel: content.buttonLabel,
        buttonUrl: content.buttonUrl,
        note: content.note,
      });

      await sendMail({
        to: user.email,
        subject: content.subject,
        html,
        text: `${content.title}\n\n${content.buttonUrl}`,
        attachments: [
          {
            filename: "logomail.png",
            path: path.join(process.cwd(), "public", "logomail.png"),
            cid: "logomail",
          },
        ],
      });

      await prisma.emailSendLog.create({
        data: {
          type: "REMINDER",
          campaignKey,
          email: user.email,
          userId: user.id,
        },
      });

      sent++;
    } catch (error) {
      failed++;
      console.error("REMINDER_SEND_ERROR", {
        email: user.email,
        campaignKey,
        error,
      });
    }
  }

  return {
    ok: true,
    campaignKey,
    total: users.length,
    sent,
    skipped,
    failed,
  };
}