import nodemailer from 'nodemailer';

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Brak zmiennej ENV: ${name}`);
  return v;
}

const host = must('SMTP_HOST');

export const mailer = nodemailer.createTransport({
  host,
  port: Number(must('SMTP_PORT')),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: must('SMTP_USER'),
    pass: must('SMTP_PASS'),
  },
  tls: {
    rejectUnauthorized: false,
    servername: host,
  },
});

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: {
    filename: string;
    path?: string;
    cid?: string;
  }[];
}) {
  const from = must('MAIL_FROM');

  await mailer.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
  });
}