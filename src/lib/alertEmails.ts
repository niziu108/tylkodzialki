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
    lat: a.lat,
    lng: a.lng,
    radiusKm: a.radiusKm,
  };
}

const intFmt = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

function formatPLN(value: number) {
  return `${intFmt.format(value)} zł`;
}

// Polska liczba mnoga dla „działka".
function dzialkaWord(n: number) {
  if (n === 1) return 'działka';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'działki';
  return 'działek';
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

  const word = dzialkaWord(n);
  const countText = n === 1 ? `Nowa ${word}` : `${n} nowe ${word}`;

  const subject =
    n === 1
      ? `Nowa działka: ${label}`
      : `${n} ${dzialkaWord(n)} pasujące do alertu: ${label}`;

  const shown = matches.slice(0, MAX_OFFERS_IN_EMAIL);
  const bullets = shown.map((d) => {
    const loc = d.locationLabel?.trim();
    const bits = [`${intFmt.format(d.powierzchniaM2)} m²`, formatPLN(d.cenaPln)];
    if (loc) bits.push(loc);
    return bits.join(' · ');
  });

  const more = n - shown.length;

  const intro = `${hello}

${countText} pasujące do Twojego alertu „${label}":`;

  const note =
    more > 0
      ? `Pokazujemy pierwsze ${shown.length}. Pozostałe ${more} ${dzialkaWord(more)} zobaczysz w wyszukiwarce.`
      : 'Dostajesz tę wiadomość, bo masz włączony alert o nowych działkach w tylkodzialki.pl.';

  // 1 oferta → prosto na nią (najszybsza droga do kontaktu); więcej → wyszukiwarka z kryteriami.
  const buttonUrl =
    n === 1
      ? `${baseUrl()}/dzialka/${matches[0].id}`
      : `${baseUrl()}${buildKupPathFromCriteria(criteria)}`;
  const buttonLabel = n === 1 ? 'Zobacz ofertę' : 'Zobacz oferty';

  const html = buildMailTemplate({
    preheader: `${countText} pasujące do Twojego alertu.`,
    title: countText,
    intro,
    bullets,
    buttonLabel,
    buttonUrl,
    note,
    unsubscribeUrl,
  });

  const text = `${countText} pasujące do Twojego alertu „${label}".\n\n${buttonUrl}`;

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

    // Brak maila → nie wysyłamy, ale przesuwamy okno, żeby nie skanować w kółko tego samego.
    if (!user?.email) {
      skipped++;
      await prisma.offerAlert.update({ where: { id: alert.id }, data: { lastCheckedAt: now } }).catch(() => {});
      continue;
    }

    const criteria = criteriaFromAlert(alert);

    const andFilters: Prisma.DzialkaWhereInput[] = [
      { ownerId: { not: null } },
      { ownerId: { not: user.id } }, // nigdy nie alarmuj o WŁASNEJ ofercie
      { status: DzialkaStatus.AKTYWNE },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { createdAt: { gt: alert.lastCheckedAt, lte: now } },
    ];

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
    const userEmailLc = user.email.toLowerCase();
    const matches = geoMatched.filter((d) => (d.email ?? '').toLowerCase() !== userEmailLc);

    if (matches.length === 0) {
      await prisma.offerAlert.update({ where: { id: alert.id }, data: { lastCheckedAt: now } });
      continue;
    }

    // Dedup kluczowany OKNEM (lastCheckedAt) — idempotentny per przebieg, bez gubienia/limitowania ofert.
    // Po udanej wysyłce okno się przesuwa, więc następny przebieg ma inny klucz (nowy mail możliwy).
    const campaignKey = `${alert.id}:${alert.lastCheckedAt.toISOString()}`;
    const already = await prisma.emailSendLog.findUnique({
      where: { type_campaignKey_email: { type: 'ALERT', campaignKey, email: user.email } },
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
        userName: user.name,
        criteria,
        unsubscribeUrl: `${baseUrl()}/api/alerts/unsubscribe?token=${alert.unsubscribeToken}`,
      });

      await sendMail({
        to: user.email,
        subject,
        html,
        text,
        attachments: [mailLogoAttachment()],
      });

      await prisma.emailSendLog.create({
        data: { type: 'ALERT', campaignKey, email: user.email, userId: user.id },
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
      console.error('ALERT_SEND_ERROR', { alertId: alert.id, email: user.email, error });
    }
  }

  return { ok: true, processed, sent, skipped, failed, matchedTotal };
}
