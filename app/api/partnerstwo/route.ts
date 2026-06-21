import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { buildMailTemplate, mailLogoAttachment } from '@/lib/emailTemplate';

// Zgłoszenia partnerskie trafiają na ten sam adres co biznes ("Dla partnerów
// biznesowych" w stopce). Osobny env pozwoli w przyszłosci przekierowac je gdzie indziej.
const TO =
  process.env.CONTACT_PARTNER_TO || process.env.CONTACT_BIURO_TO || 'biuro@tylkodzialki.pl';

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

const BRANZA_LABELS: Record<string, string> = {
  deweloper: 'Deweloper',
  domy: 'Domy modułowe / prefabrykowane',
  geodezja: 'Geodezja',
  architektura: 'Architektura i projekty',
  fotowoltaika: 'Fotowoltaika',
  budowlana: 'Firma budowlana',
  finansowanie: 'Kredyty i finansowanie',
  ogrodzenia: 'Ogrodzenia',
  przylacza: 'Przyłącza i media',
  inne: 'Inne',
};

const ZASIEG_LABELS: Record<string, string> = {
  polska: 'Cała Polska',
  wojewodztwo: 'Wybrane województwo',
  powiat: 'Powiat / region',
};

const BUDZET_LABELS: Record<string, string> = {
  doustalenia: 'Do ustalenia',
  s1: 'do 1 000 zł miesięcznie',
  s2: 'powyżej 1 000 zł miesięcznie',
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
    const company = clean(body?.company, 160);
    const phone = clean(body?.phone, 40);
    const branzaKey = clean(body?.branza, 40);
    const zasiegKey = clean(body?.zasieg, 40);
    const budzetKey = clean(body?.budzet, 40);
    const message = clean(body?.message, 4000);

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, message: 'Podaj prawidłowy adres e-mail.' },
        { status: 400 }
      );
    }

    const branzaLabel = BRANZA_LABELS[branzaKey] || '';
    const zasiegLabel = ZASIEG_LABELS[zasiegKey] || '';
    const budzetLabel = BUDZET_LABELS[budzetKey] || '';

    if (!branzaLabel && !message) {
      return NextResponse.json(
        { ok: false, message: 'Wybierz branżę albo napisz, czego potrzebujesz.' },
        { status: 400 }
      );
    }

    const rows: [string, string][] = [
      ['Firma', company],
      ['Osoba', name],
      ['E-mail', email],
      ['Telefon', phone],
      ['Branża', branzaLabel],
      ['Zasięg', zasiegLabel],
      ['Budżet', budzetLabel],
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
      preheader: `Nowe zgłoszenie partnerskie${company ? `: ${company}` : ''}`,
      title: 'Nowe zgłoszenie partnerskie',
      intro: 'Ktoś wypełnił formularz „Partnerstwo" na tylkodzialki.pl. Szczegóły poniżej.',
      bodyHtml,
    });

    const textLines = [
      ...rows.map(([label, value]) => `${label}: ${value}`),
      message ? `\nWiadomość:\n${message}` : '',
    ].filter(Boolean);

    await sendMail({
      to: TO,
      subject: `Partnerstwo: zgłoszenie${company ? ` od ${company}` : ''} (${email})`,
      html,
      text: textLines.join('\n'),
      replyTo: email,
      attachments: [mailLogoAttachment()],
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PARTNERSTWO_CONTACT_ERROR', e);
    return NextResponse.json(
      { ok: false, message: 'Coś poszło nie tak. Spróbuj ponownie.' },
      { status: 500 }
    );
  }
}
