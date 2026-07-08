import { Prisma, DzialkaStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import { buildMailTemplate, mailLogoAttachment } from '@/lib/emailTemplate';
import { buildSearchContext, getSearchMatchInfo } from '@/lib/dzialkiSearch';
import { buildKupPathFromCriteria, type AlertCriteria } from '@/lib/alertCriteria';

function baseUrl() {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
}

// Ile ofert wypisać w treści maila (reszta jako „i N więcej" + przycisk do wyszukiwarki).
const MAX_OFFERS_IN_EMAIL = 12;

type AlertWithUser = Prisma.OfferAlertGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
        name: true;
      };
    };
  };
}>;

type MatchOffer = Prisma.DzialkaGetPayload<{
  include: { zdjecia: true };
}>;

function criteriaFromAlert(a: AlertWithUser): AlertCriteria {
  return {
    query: a.query,
    priceMin: a.priceMin,
    priceMax: a.priceMax,
    areaMin: a.areaMin,
    areaMax: a.areaMax,
    przeznaczenia: a.przeznaczenia,
    transakcja: a.transakcja,
    lat: a.lat,
    lng: a.lng,
    radiusKm: a.radiusKm,
  };
}

const intFmt = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

function formatPLN(value: number) {
  return `${intFmt.format(value)} zł`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Polska liczba mnoga dla „działka".
function dzialkaWord(n: number) {
  if (n === 1) return 'działka';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'działki';
  return 'działek';
}

// Kategoria liczby mnogiej PL: 1 / 2-4 / pozostałe.
function pluralCat(n: number): 'one' | 'few' | 'many' {
  if (n === 1) return 'one';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'few';
  return 'many';
}

// „Nowa działka" / „N nowe działki" / „N nowych działek".
function newDzialkiPhrase(n: number) {
  const cat = pluralCat(n);
  if (cat === 'one') return 'Nowa działka';
  const adj = cat === 'few' ? 'nowe' : 'nowych';
  const noun = cat === 'few' ? 'działki' : 'działek';
  return `${n} ${adj} ${noun}`;
}

// „pasująca" / „pasujące" / „pasujących" — zgodnie z liczbą działek.
function matchingWord(n: number) {
  const cat = pluralCat(n);
  if (cat === 'one') return 'pasująca';
  return cat === 'few' ? 'pasujące' : 'pasujących';
}

function buildAlertEmail(params: {
  label: string;
  matches: MatchOffer[];
  userName: string | null;
  criteria: AlertCriteria;
  unsubscribeUrl: string;
}) {
  const { label, matches, userName, criteria, unsubscribeUrl } = params;
  const n = matches.length;

  const firstName = userName?.trim()?.split(' ')[0];
  const hello = firstName ? `${firstName},` : 'Dzień dobry,';

  const countText = newDzialkiPhrase(n);

  const subject =
    n === 1
      ? `Nowa działka: ${label}`
      : `${n} ${dzialkaWord(n)} ${matchingWord(n)} do alertu: ${label}`;

  const shown = matches.slice(0, MAX_OFFERS_IN_EMAIL);
  const more = n - shown.length;

  const intro = `${hello}

${countText} ${matchingWord(n)} do Twojego alertu „${label}":`;

  const note =
    more > 0
      ? `Pokazujemy pierwsze ${shown.length}. Pozostałe ${more} ${dzialkaWord(more)} zobaczysz w wyszukiwarce.`
      : 'Dostajesz tę wiadomość, bo masz włączony alert o nowych działkach w tylkodzialki.pl.';

  // 1 oferta → duży przycisk prosto na nią (najszybsza droga do kontaktu).
  // Więcej → lista, gdzie KAŻDA oferta ma swój drobny link „Zobacz ofertę", a na dole
  // jeden zielony przycisk do wyszukiwarki (żeby maila nie zawalić wieloma zielonymi klockami).
  if (n === 1) {
    const d = matches[0];
    const loc = d.locationLabel?.trim();
    const bits = [`${intFmt.format(d.powierzchniaM2)} m²`, formatPLN(d.cenaPln)];
    if (loc) bits.push(loc);

    const html = buildMailTemplate({
      preheader: `${countText} ${matchingWord(n)} do Twojego alertu.`,
      title: countText,
      intro,
      bullets: [bits.join(' · ')],
      buttonLabel: 'Zobacz ofertę',
      buttonUrl: `${baseUrl()}/dzialka/${d.id}`,
      note,
      unsubscribeUrl,
    });

    const text = `${countText} ${matchingWord(n)} do Twojego alertu „${label}".\n\n${baseUrl()}/dzialka/${d.id}`;
    return { subject, html, text };
  }

  const offersRows = shown
    .map((d) => {
      const loc = d.locationLabel?.trim();
      const head = `${intFmt.format(d.powierzchniaM2)} m² · ${formatPLN(d.cenaPln)}`;
      const url = `${baseUrl()}/dzialka/${d.id}`;
      const locHtml = loc
        ? `<div style="margin:2px 0 0 0;font-size:14px;line-height:1.5;color:#6a6a6a;">${escapeHtml(loc)}</div>`
        : '';
      return `<tr><td style="padding:14px 0;border-bottom:1px solid #f0f0ed;">
<div style="font-size:15px;line-height:1.5;color:#1a1a1a;font-weight:600;">${escapeHtml(head)}</div>
${locHtml}
<a href="${escapeHtml(url)}" style="display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:#6f7d4f;text-decoration:none;">Zobacz ofertę &rarr;</a>
</td></tr>`;
    })
    .join('');

  const bodyHtml = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;width:100%;">${offersRows}</table>`;

  const html = buildMailTemplate({
    preheader: `${countText} ${matchingWord(n)} do Twojego alertu.`,
    title: countText,
    intro,
    bodyHtml,
    buttonLabel: 'Zobacz wszystkie oferty',
    buttonUrl: `${baseUrl()}${buildKupPathFromCriteria(criteria)}`,
    note,
    unsubscribeUrl,
  });

  const offersText = shown
    .map((d) => `- ${intFmt.format(d.powierzchniaM2)} m² · ${formatPLN(d.cenaPln)} — ${baseUrl()}/dzialka/${d.id}`)
    .join('\n');
  const searchUrl = `${baseUrl()}${buildKupPathFromCriteria(criteria)}`;
  const text = `${countText} ${matchingWord(n)} do Twojego alertu „${label}".\n\n${offersText}\n\nWszystkie oferty: ${searchUrl}`;

  return { subject, html, text };
}

export async function runOfferAlerts() {
  const now = new Date();

  const alerts = await prisma.offerAlert.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let matchedTotal = 0;

  for (const alert of alerts) {
    processed++;
    const user = alert.user;
    // P26: adres z alertu (subskrypcja na sam e-mail) albo z konta (alerty zalogowanych).
    const targetEmail = alert.email ?? user?.email ?? null;

    // Brak maila → nie wysyłamy, ale przesuwamy okno, żeby nie skanować w kółko tego samego.
    if (!targetEmail) {
      skipped++;
      await prisma.offerAlert.update({ where: { id: alert.id }, data: { lastCheckedAt: now } }).catch(() => {});
      continue;
    }

    const criteria = criteriaFromAlert(alert);

    const andFilters: Prisma.DzialkaWhereInput[] = [
      { ownerId: { not: null } },
      { status: DzialkaStatus.AKTYWNE },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { createdAt: { gt: alert.lastCheckedAt, lte: now } },
    ];

    // Nigdy nie alarmuj subskrybenta o JEGO WŁASNEJ ofercie (dotyczy alertów z kontem).
    if (alert.userId) {
      andFilters.push({ ownerId: { not: alert.userId } });
    }

    if (criteria.priceMin !== null || criteria.priceMax !== null) {
      const cenaPln: Prisma.IntFilter = {};
      if (criteria.priceMin !== null) cenaPln.gte = criteria.priceMin;
      if (criteria.priceMax !== null) cenaPln.lte = criteria.priceMax;
      andFilters.push({ cenaPln });
    }

    if (criteria.areaMin !== null || criteria.areaMax !== null) {
      const powierzchniaM2: Prisma.IntFilter = {};
      if (criteria.areaMin !== null) powierzchniaM2.gte = criteria.areaMin;
      if (criteria.areaMax !== null) powierzchniaM2.lte = criteria.areaMax;
      andFilters.push({ powierzchniaM2 });
    }

    if (criteria.przeznaczenia.length) {
      andFilters.push({ przeznaczenia: { hasSome: criteria.przeznaczenia } });
    }

    // Typ oferty: 1 wybrany = zawęź; 0 lub 2 = bez zawężenia (spójnie z filtrem /kup).
    if (criteria.transakcja.length === 1) {
      andFilters.push({ transakcja: criteria.transakcja[0] });
    }

    const candidates = await prisma.dzialka.findMany({
      where: { AND: andFilters },
      orderBy: { createdAt: 'desc' },
      include: { zdjecia: { orderBy: { kolejnosc: 'asc' }, take: 1 } },
    });

    // Dopasowanie geo/tekst — DOKŁADNIE ta sama logika co wyszukiwarka (src/lib/dzialkiSearch).
    const hasRadius =
      criteria.lat !== null && criteria.lng !== null && criteria.radiusKm !== null && criteria.radiusKm > 0;
    const searchText = criteria.query ?? '';
    const needsMatchInfo = hasRadius || Boolean(searchText);
    const ctx = buildSearchContext(
      searchText,
      criteria.lat ?? NaN,
      criteria.lng ?? NaN,
      criteria.radiusKm ?? 0,
      hasRadius
    );

    const geoMatched = needsMatchInfo
      ? candidates.filter((d) => getSearchMatchInfo(d, ctx).anyMatch)
      : candidates;

    // Nie alarmuj o ofercie, której kontaktowy e-mail = e-mail subskrybenta (własne, też przez import).
    const targetEmailLc = targetEmail.toLowerCase();
    const matches = geoMatched.filter((d) => (d.email ?? '').toLowerCase() !== targetEmailLc);

    if (matches.length === 0) {
      await prisma.offerAlert.update({ where: { id: alert.id }, data: { lastCheckedAt: now } });
      continue;
    }

    // Dedup kluczowany OKNEM (lastCheckedAt) — idempotentny per przebieg, bez gubienia/limitowania ofert.
    // Po udanej wysyłce okno się przesuwa, więc następny przebieg ma inny klucz (nowy mail możliwy).
    const campaignKey = `${alert.id}:${alert.lastCheckedAt.toISOString()}`;
    const already = await prisma.emailSendLog.findUnique({
      where: { type_campaignKey_email: { type: 'ALERT', campaignKey, email: targetEmail } },
    });

    if (already) {
      skipped++;
      await prisma.offerAlert.update({ where: { id: alert.id }, data: { lastCheckedAt: now } });
      continue;
    }

    try {
      const { subject, html, text } = buildAlertEmail({
        label: alert.label,
        matches,
        userName: user?.name ?? null,
        criteria,
        unsubscribeUrl: `${baseUrl()}/api/alerts/unsubscribe?token=${alert.unsubscribeToken}`,
      });

      await sendMail({
        to: targetEmail,
        subject,
        html,
        text,
        attachments: [mailLogoAttachment()],
      });

      await prisma.emailSendLog.create({
        data: { type: 'ALERT', campaignKey, email: targetEmail, userId: alert.userId ?? null },
      });

      await prisma.offerAlert.update({
        where: { id: alert.id },
        data: { lastCheckedAt: now, lastNotifiedAt: now },
      });

      matchedTotal += matches.length;
      sent++;
    } catch (error) {
      // NIE przesuwamy okna przy błędzie → ponowna próba w następnym przebiegu.
      failed++;
      console.error('ALERT_SEND_ERROR', { alertId: alert.id, email: targetEmail, error });
    }
  }

  return { ok: true, processed, sent, skipped, failed, matchedTotal };
}

// P26: mail double opt-in dla alertu włączonego bez logowania (sam e-mail).
export async function sendAlertConfirmation(params: { email: string; label: string; confirmToken: string }) {
  const { email, label, confirmToken } = params;
  const confirmUrl = `${baseUrl()}/api/alerts/confirm?token=${confirmToken}`;

  const html = buildMailTemplate({
    preheader: 'Potwierdź, aby włączyć powiadomienia o nowych działkach.',
    title: 'Potwierdź powiadomienia',
    intro: `Dzień dobry,

Będziemy Cię informować o nowych działkach pasujących do „${label}". Potwierdź tylko, że to Twój adres, a od tej chwili damy Ci znać, gdy pojawi się nowa oferta.`,
    buttonLabel: 'Potwierdzam powiadomienia',
    buttonUrl: confirmUrl,
    showLinkFallback: true,
    note: 'Jeśli to nie Ty prosiłeś o powiadomienia, zignoruj tę wiadomość. Bez potwierdzenia nic nie wyślemy.',
  });

  const text = `Potwierdź powiadomienia o nowych działkach „${label}":\n${confirmUrl}`;

  await sendMail({
    to: email,
    subject: 'Potwierdź powiadomienia o nowych działkach',
    html,
    text,
    attachments: [mailLogoAttachment()],
  });
}
