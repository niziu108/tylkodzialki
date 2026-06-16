import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';
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
    lat: a.lat,
    lng: a.lng,
    radiusKm: a.radiusKm,
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { ok: false, message: 'Zaloguj się, aby włączyć alert.' },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, message: 'Nie znaleziono użytkownika.' },
      { status: 401 }
    );
  }

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

  // Deduplikacja: jeśli użytkownik ma już aktywny alert o tych samych kryteriach, zwracamy go.
  const fingerprint = criteriaFingerprint(criteria);
  const existing = await prisma.offerAlert.findMany({
    where: { userId: user.id, isActive: true },
  });

  const duplicate = existing.find((a) => criteriaFingerprint(criteriaFromRow(a)) === fingerprint);
  if (duplicate) {
    return NextResponse.json({
      ok: true,
      alreadyExists: true,
      alert: { id: duplicate.id, label: duplicate.label },
    });
  }

  const label = buildAlertLabel(criteria);

  const created = await prisma.offerAlert.create({
    data: {
      userId: user.id,
      label,
      query: criteria.query,
      priceMin: criteria.priceMin,
      priceMax: criteria.priceMax,
      areaMin: criteria.areaMin,
      areaMax: criteria.areaMax,
      przeznaczenia: criteria.przeznaczenia,
      lat: criteria.lat,
      lng: criteria.lng,
      radiusKm: criteria.radiusKm,
      unsubscribeToken: crypto.randomUUID(),
      // lastCheckedAt = teraz: nie zalewamy maila całym istniejącym katalogiem,
      // alert dotyczy ofert, które pojawią się OD TERAZ.
      lastCheckedAt: new Date(),
    },
    select: { id: true, label: true },
  });

  return NextResponse.json({ ok: true, alert: created });
}
