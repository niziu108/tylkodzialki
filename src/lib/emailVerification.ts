import crypto from 'crypto';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import { buildMailTemplate } from '@/lib/emailTemplate';

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
    preheader: 'Potwierdź swój adres email w TylkoDziałki.',
    title: 'Potwierdź swój email',
    intro:
      'Dziękujemy za rejestrację w TylkoDziałki. Kliknij poniższy przycisk, aby potwierdzić swój adres email i bezpiecznie korzystać z konta.',
    buttonLabel: 'Potwierdź email',
    buttonUrl: url,
    note: 'Link weryfikacyjny wygaśnie za 24 godziny. Jeśli to nie Ty zakładałeś konto, możesz zignorować tę wiadomość.',
  });

  await sendMail({
    to: email,
    subject: 'TylkoDziałki — potwierdź swój email',
    html,
    text: `Potwierdź swój email: ${url}`,
    attachments: [
      {
        filename: 'logomail.png',
        path: path.join(process.cwd(), 'public', 'logomail.png'),
        cid: 'logomail',
      },
    ],
  });
}