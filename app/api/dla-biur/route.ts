import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { buildMailTemplate, mailLogoAttachment } from '@/lib/emailTemplate';

const TO = process.env.CONTACT_BIURO_TO || 'biuro@tylkodzialki.pl';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const GOAL_LABELS: Record<string, string> = {
  crm: 'Integracja z CRM',
  import: 'Masowy import ofert',
  wspolpraca: 'Współpraca / partnerstwo',
  inne: 'Pytanie ogólne',
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Honeypot: boty wypełniają ukryte pole; udajemy sukces, nic nie wysyłamy.
    if (clean(body?.website, 200)) {
      return NextResponse.json({ ok: true });
    }

    const email = clean(body?.email, 200).toLowerCase();
    const name = clean(body?.name, 120);
    const agency = clean(body?.agency, 160);
    const phone = clean(body?.phone, 40);
    const goalKey = clean(body?.goal, 40);
    const message = clean(body?.message, 4000);

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, message: 'Podaj prawidłowy adres e-mail.' },
        { status: 400 }
      );
    }

    const goalLabel = GOAL_LABELS[goalKey] || '';

    if (!goalLabel && !message) {
      return NextResponse.json(
        { ok: false, message: 'Napisz, w czym możemy pomóc.' },
        { status: 400 }
      );
    }

    const rows: [string, string][] = [
      ['Biuro', agency],
      ['Osoba', name],
      ['E-mail', email],
      ['Telefon', phone],
      ['Cel', goalLabel],
    ].filter(([, v]) => v) as [string, string][];

    const rowsHtml = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 12px 6px 0;color:#6b7f34;font-weight:700;white-space:nowrap;vertical-align:top;">${esc(
            label
          )}</td><td style="padding:6px 0;color:#1f1f1f;">${esc(value)}</td></tr>`
      )
      .join('');

    const messageHtml = message
      ? `<div style="margin-top:18px;padding:16px 18px;border-radius:14px;background:#f7f9f1;border:1px solid #e2ebcf;color:#2d2d2d;font-size:14px;line-height:1.7;white-space:pre-line;">${esc(
          message
        )}</div>`
      : '';

    const bodyHtml = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 0 0;font-size:14px;line-height:1.7;">${rowsHtml}</table>${messageHtml}`;

    const html = buildMailTemplate({
      preheader: `Nowe zapytanie z formularza „Dla biur"${agency ? `: ${agency}` : ''}`,
      title: 'Nowe zapytanie od biura',
      intro: 'Ktoś wypełnił formularz „Dla biur" na tylkodzialki.pl. Szczegóły poniżej.',
      bodyHtml,
    });

    const textLines = [
      ...rows.map(([label, value]) => `${label}: ${value}`),
      message ? `\nWiadomość:\n${message}` : '',
    ].filter(Boolean);

    await sendMail({
      to: TO,
      subject: `Dla biur: zapytanie${agency ? ` od ${agency}` : ''} (${email})`,
      html,
      text: textLines.join('\n'),
      replyTo: email,
      attachments: [mailLogoAttachment()],
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DLA_BIUR_CONTACT_ERROR', e);
    return NextResponse.json(
      { ok: false, message: 'Coś poszło nie tak. Spróbuj ponownie.' },
      { status: 500 }
    );
  }
}
