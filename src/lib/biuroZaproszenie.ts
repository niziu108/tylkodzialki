import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { buildMailTemplate, mailLogoAttachment } from "@/lib/emailTemplate";

// Konto biura zakładane przez admina, bez rejestracji po stronie biura.
//
// Po co: biuro klika nasz portal w swoim CRM, a my podłączamy je bez formularza i bez maila
// „dziękujemy za założenie konta", którego nigdy nie zakładało. Kolejność jest celowa:
// 1. admin zakłada konto (żadnego maila),
// 2. admin podpina integrację CRM, oferty wchodzą na portal,
// 3. dopiero gdy działki są widoczne, admin wysyła zaproszenie z liczbą działek i linkiem do hasła.
// Zaproszenie to zwykły PasswordResetToken z dłuższą ważnością, więc ustawianie hasła idzie
// tą samą, sprawdzoną ścieżką co reset (/logowanie/reset).

const WAZNOSC_ZAPROSZENIA_DNI = 14;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function baseUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function zalozKontoBiura(input: {
  email: string;
  nazwaBiura: string;
  telefon?: string;
}) {
  const email = input.email.toLowerCase().trim();
  const nazwaBiura = input.nazwaBiura.trim();
  const telefon = input.telefon?.trim() || null;

  if (!EMAIL_RE.test(email)) {
    return { error: "Podaj poprawny adres e-mail biura." } as const;
  }
  if (!nazwaBiura) {
    return { error: "Podaj nazwę biura." } as const;
  }

  const istniejace = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (istniejace) {
    // Nie nadpisujemy cudzego konta: biuro mogło już się zarejestrować samo.
    return { error: "Konto z tym adresem już istnieje.", userId: istniejace.id } as const;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: nazwaBiura,
      defaultSprzedajacyTyp: "BIURO",
      defaultBiuroNazwa: nazwaBiura,
      ...(telefon ? { defaultTelefon: telefon } : {}),
    },
    select: { id: true },
  });

  return { userId: user.id } as const;
}

export async function wyslijZaproszenieBiura(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordHash: true },
  });

  if (!user?.email) {
    return { error: "Konto nie ma adresu e-mail." } as const;
  }
  if (user.passwordHash) {
    // Konto z hasłem ma już dostęp. Zaproszenie z linkiem do hasła byłoby po cichu resetem.
    return { error: "To konto ma już hasło, biuro może się zalogować." } as const;
  }

  const liczbaDzialek = await prisma.dzialka.count({
    where: { ownerId: userId, status: "AKTYWNE" },
  });
  if (liczbaDzialek === 0) {
    // Cały sens maila to „Twoje działki już są". Bez działek to zwykłe powitanie, nie zaproszenie.
    return { error: "Biuro nie ma jeszcze żadnej aktywnej działki. Najpierw import z CRM." } as const;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + WAZNOSC_ZAPROSZENIA_DNI * 24 * 60 * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({ where: { email: user.email } });
  await prisma.passwordResetToken.create({
    data: { email: user.email, token, expiresAt },
  });

  const url = `${baseUrl()}/logowanie/reset?token=${token}&powitanie=1`;
  const dzialkiTekst = odmienDzialki(liczbaDzialek);

  const html = buildMailTemplate({
    preheader: `Opublikowaliśmy już ${dzialkiTekst} z Twojego CRM.`,
    title: "Twoje działki są już na tylkodzialki.pl",
    intro: `Dzień dobry,

Podłączyliśmy eksport z Twojego systemu CRM i opublikowaliśmy już ${dzialkiTekst} z Twojej oferty. Nie musisz niczego przepisywać ani instalować.

Ustaw hasło, żeby wejść do panelu biura.`,
    bullets: [
      "Oferty aktualizują się same co 2 godziny: ceny, zdjęcia, sprzedane znikają",
      "Telefony i SMS-y od kupujących trafiają wprost do opiekuna oferty",
      "W panelu widzisz wyświetlenia i kliknięcia w telefon przy każdej działce",
    ],
    buttonLabel: "Ustaw hasło i wejdź do panelu",
    buttonUrl: url,
    showLinkFallback: true,
    note: `Link jest ważny ${WAZNOSC_ZAPROSZENIA_DNI} dni. Później ustawisz hasło przez „Nie pamiętasz hasła?" na stronie logowania. Publikacja jest bezpłatna. Pytania: kontakt@tylkodzialki.pl.`,
  });

  await sendMail({
    to: user.email,
    subject: `Twoje działki są już na tylkodzialki.pl (${liczbaDzialek})`,
    html,
    text: `Opublikowaliśmy na tylkodzialki.pl ${dzialkiTekst} z Twojego CRM. Ustaw hasło: ${url}`,
    attachments: [mailLogoAttachment()],
  });

  return { ok: true, liczbaDzialek, wazneDo: expiresAt } as const;
}

// Biernik („opublikowaliśmy 1 działkę / 3 działki / 5 działek").
function odmienDzialki(n: number) {
  if (n === 1) return "1 działkę";
  const r10 = n % 10;
  const r100 = n % 100;
  if (r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14)) return `${n} działki`;
  return `${n} działek`;
}
