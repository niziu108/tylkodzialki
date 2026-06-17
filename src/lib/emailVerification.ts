import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import { buildMailTemplate, mailLogoAttachment } from '@/lib/emailTemplate';

function baseUrl() {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function sendVerificationEmail(email: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  const url = `${baseUrl()}/api/auth/verify?token=${token}`;

  const html = buildMailTemplate({
    preheader: 'Potwierdź swój adres e-mail w tylkodzialki.pl.',
    title: 'Potwierdź swój adres e-mail',
    intro:
      'Dziękujemy za rejestrację w tylkodzialki.pl. Kliknij przycisk poniżej, aby potwierdzić swój adres e-mail i w pełni aktywować konto.',
    buttonLabel: 'Potwierdź e-mail',
    buttonUrl: url,
    showLinkFallback: true,
    note: 'Link wygaśnie po 24 godzinach. Jeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość.',
  });

  await sendMail({
    to: email,
    subject: 'Potwierdź swój adres e-mail',
    html,
    text: `Potwierdź swój adres e-mail: ${url}`,
    attachments: [mailLogoAttachment()],
  });
}
