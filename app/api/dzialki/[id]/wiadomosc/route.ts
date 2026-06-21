import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import { buildMailTemplate, mailLogoAttachment } from '@/lib/emailTemplate';

const SITE_URL = 'https://tylkodzialki.pl';
// Kopia każdego zapytania trafia na naszą skrzynkę — nawet gdy oferta nie ma maila
// sprzedającego, lead nie ginie (relay) i mamy materiał pod przyszły CRM.
const BIURO_TO = process.env.CONTACT_BIURO_TO || 'biuro@tylkodzialki.pl';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, message: 'Brak ID ogłoszenia.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // Honeypot: boty wypełniają ukryte pole; udajemy sukces, nic nie wysyłamy.
    if (clean(body?.website, 200)) {
      return NextResponse.json({ ok: true });
    }

    const name = clean(body?.name, 120);
    const email = clean(body?.email, 200).toLowerCase();
    const phone = clean(body?.phone, 40);
    const message = clean(body?.message, 4000);

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, message: 'Podaj prawidłowy adres e-mail.' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, message: 'Napisz treść wiadomości.' },
        { status: 400 }
      );
    }

    const dzialka = await prisma.dzialka.findUnique({
      where: { id },
      select: { id: true, tytul: true, numerOferty: true, email: true, status: true },
    });

    if (!dzialka) {
      return NextResponse.json(
        { ok: false, message: 'Nie znaleziono ogłoszenia.' },
        { status: 404 }
      );
    }

    if (dzialka.status !== 'AKTYWNE') {
      return NextResponse.json(
        { ok: false, message: 'To ogłoszenie jest już nieaktywne.' },
        { status: 410 }
      );
    }

    const sellerEmail = (dzialka.email ?? '').trim();
    // Mail sprzedającego, gdy jest; inaczej trafia tylko do nas (relay).
    const to = sellerEmail || BIURO_TO;
    const bcc = sellerEmail ? BIURO_TO : undefined;

    const offerUrl = `${SITE_URL}/dzialka/${dzialka.id}`;
    const offerLabel = dzialka.numerOferty
      ? `${dzialka.tytul} (nr ${dzialka.numerOferty})`
      : dzialka.tytul;

    const rows: [string, string][] = [
      ['Od', name],
      ['E-mail', email],
      ['Telefon', phone],
      ['Oferta', offerLabel],
    ].filter(([, v]) => v) as [string, string][];

    const rowsHtml = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 12px 6px 0;color:#6b7f34;font-weight:700;white-space:nowrap;vertical-align:top;">${esc(
            label
          )}</td><td style="padding:6px 0;color:#1f1f1f;">${esc(value)}</td></tr>`
      )
      .join('');

    const messageHtml = `<div style="margin-top:18px;padding:16px 18px;border-radius:14px;background:#f7f9f1;border:1px solid #e2ebcf;color:#2d2d2d;font-size:14px;line-height:1.7;white-space:pre-line;">${esc(
      message
    )}</div>`;

    const bodyHtml = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 0 0;font-size:14px;line-height:1.7;">${rowsHtml}</table>${messageHtml}`;

    const html = buildMailTemplate({
      preheader: `Nowe zapytanie o ofertę: ${offerLabel}`,
      title: 'Nowe zapytanie o Twoją działkę',
      intro:
        'Ktoś jest zainteresowany Twoim ogłoszeniem na tylkodzialki.pl. Aby odpowiedzieć, użyj opcji „Odpowiedz" — wiadomość trafi prosto do osoby zainteresowanej.',
      bodyHtml,
      buttonLabel: 'Zobacz ogłoszenie',
      buttonUrl: offerUrl,
    });

    const text = [
      ...rows.map(([label, value]) => `${label}: ${value}`),
      '',
      'Wiadomość:',
      message,
      '',
      `Ogłoszenie: ${offerUrl}`,
    ].join('\n');

    await sendMail({
      to,
      bcc,
      subject: `Zapytanie o ofertę: ${offerLabel}`,
      html,
      text,
      replyTo: email,
      attachments: [mailLogoAttachment()],
    });

    // Liczymy realnie wysłane zapytanie (ten sam licznik co klik „Napisz" na mobile).
    await prisma.dzialka
      .update({
        where: { id: dzialka.id },
        data: { messageClicksCount: { increment: 1 } },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('OFFER_MESSAGE_ERROR', e);
    return NextResponse.json(
      { ok: false, message: 'Coś poszło nie tak. Spróbuj ponownie.' },
      { status: 500 }
    );
  }
}
