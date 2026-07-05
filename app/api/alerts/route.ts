import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';
import { sendAlertConfirmation } from '@/lib/alertEmails';
import {
  normalizeCriteria,
  criteriaIsEmpty,
  criteriaFingerprint,
  buildAlertLabel,
  type AlertCriteria,
} from '@/lib/alertCriteria';

// Odtworzenie kryteriów z rekordu w bazie (do liczenia odcisku przy deduplikacji).
function criteriaFromRow(a: {
  query: string | null;
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  przeznaczenia: AlertCriteria['przeznaczenia'];
  transakcja: AlertCriteria['transakcja'];
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
}): AlertCriteria {
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

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  // Prosty, wystarczający walidator (dokładność i tak weryfikuje double opt-in).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) return null;
  return email;
}

// Pola kryteriów wspólne dla create (żeby nie powtarzać).
function criteriaData(c: AlertCriteria) {
  return {
    query: c.query,
    priceMin: c.priceMin,
    priceMax: c.priceMax,
    areaMin: c.areaMin,
    areaMax: c.areaMax,
    przeznaczenia: c.przeznaczenia,
    transakcja: c.transakcja,
    lat: c.lat,
    lng: c.lng,
    radiusKm: c.radiusKm,
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const body = await req.json().catch(() => null);
  const criteria = normalizeCriteria(body ?? {});

  if (criteriaIsEmpty(criteria)) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Ustaw przynajmniej jedno kryterium (lokalizacja, cena, powierzchnia lub przeznaczenie).',
      },
      { status: 400 }
    );
  }

  const fingerprint = criteriaFingerprint(criteria);
  const label = buildAlertLabel(criteria);

  // ── ZALOGOWANY: alert od razu aktywny na e-mail z konta, bez pytania o adres. ──
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: 'Nie znaleziono użytkownika.' }, { status: 401 });
    }

    const existing = await prisma.offerAlert.findMany({ where: { userId: user.id, isActive: true } });
    const duplicate = existing.find((a) => criteriaFingerprint(criteriaFromRow(a)) === fingerprint);
    if (duplicate) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        alert: { id: duplicate.id, label: duplicate.label },
      });
    }

    const created = await prisma.offerAlert.create({
      data: {
        userId: user.id,
        email: user.email,
        confirmedAt: new Date(),
        label,
        ...criteriaData(criteria),
        unsubscribeToken: crypto.randomUUID(),
        // lastCheckedAt = teraz: alert dotyczy ofert, które pojawią się OD TERAZ.
        lastCheckedAt: new Date(),
      },
      select: { id: true, label: true },
    });

    return NextResponse.json({ ok: true, alert: created });
  }

  // ── NIEZALOGOWANY: subskrypcja na sam e-mail z potwierdzeniem (double opt-in). ──
  const email = normalizeEmail(body?.email);
  if (!email) {
    return NextResponse.json(
      { ok: false, message: 'Podaj poprawny adres e-mail.' },
      { status: 400 }
    );
  }

  // Dedup po adresie: jeśli ten e-mail ma już taki alert, nie tworzymy drugiego.
  const existing = await prisma.offerAlert.findMany({ where: { email, userId: null } });
  const duplicate = existing.find((a) => criteriaFingerprint(criteriaFromRow(a)) === fingerprint);
  if (duplicate) {
    // Potwierdzony → już działa; niepotwierdzony → czeka na kliknięcie w mailu.
    return NextResponse.json({
      ok: true,
      alreadyExists: Boolean(duplicate.confirmedAt),
      pending: !duplicate.confirmedAt,
    });
  }

  const confirmToken = crypto.randomUUID();

  await prisma.offerAlert.create({
    data: {
      email,
      label,
      ...criteriaData(criteria),
      isActive: false, // nieaktywny do potwierdzenia w mailu
      confirmToken,
      unsubscribeToken: crypto.randomUUID(),
      lastCheckedAt: new Date(),
    },
  });

  try {
    await sendAlertConfirmation({ email, label, confirmToken });
  } catch (error) {
    console.error('ALERT_CONFIRM_SEND_ERROR', { email, error });
    return NextResponse.json(
      { ok: false, message: 'Nie udało się wysłać maila potwierdzającego. Spróbuj ponownie.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, pending: true });
}
