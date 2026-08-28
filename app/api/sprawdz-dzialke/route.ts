// P24: orkiestracja raportu „Sprawdź działkę".
//
// Wejście (POST JSON): { lat, lng } (pinezka/adres) albo { parcelId } (numer ewidencyjny).
// Łączy: ULDK (granice/metraż/administracja) + wycenę z naszych ofert w okolicy. Wszystko
// prawdziwe albo pominięte — zero zmyślania ([[feedback-filtry-twarde]]).

import { NextRequest, NextResponse } from 'next/server';
import { getParcelById, getParcelByXY, UldkError, type ParcelReport } from '@/lib/uldk';
import { getNearbyOffers, getPointValuation, type PointValuation } from '@/lib/seoHub';
import { getMpzpAtPoint, type MpzpInfo } from '@/lib/mpzp';

type NearbyOffer = Awaited<ReturnType<typeof getNearbyOffers>>[number];

export const runtime = 'nodejs';

type Body = { lat?: unknown; lng?: unknown; parcelId?: unknown };

export type SprawdzResponse = {
  parcel: ParcelReport;
  valuation: PointValuation;
  mpzp: MpzpInfo | null; // przeznaczenie z KIMPZP w środku działki; null gdy brak planu
  nearby: NearbyOffer[]; // działki na sprzedaż najbliżej sprawdzanego punktu
};

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane żądania.' }, { status: 400 });
  }

  try {
    let parcel: ParcelReport | null = null;

    if (typeof body.parcelId === 'string' && body.parcelId.trim()) {
      parcel = await getParcelById(body.parcelId);
    } else if (isNum(body.lat) && isNum(body.lng)) {
      parcel = await getParcelByXY(body.lat, body.lng);
    } else {
      return NextResponse.json(
        { error: 'Podaj punkt na mapie, adres albo numer działki.' },
        { status: 400 }
      );
    }

    if (!parcel) {
      return NextResponse.json(
        { error: 'Nie znaleziono działki w tym miejscu. Przesuń pinezkę dokładnie na działkę.' },
        { status: 404 }
      );
    }

    // Wycenę i MPZP liczymy od środka znalezionej działki (spójnie z jej realną lokalizacją).
    // Powierzchnia z ewidencji idzie do wyceny, żeby porównywać do działek podobnej wielkości.
    const [valuation, mpzp] = await Promise.all([
      getPointValuation(parcel.center.lat, parcel.center.lng, parcel.areaM2),
      getMpzpAtPoint(parcel.center.lat, parcel.center.lng),
    ]);

    // Oferty z tego samego koła, na którym liczyliśmy cenę — spójnie z tym, co raport pokazuje.
    const nearby = await getNearbyOffers(parcel.center.lat, parcel.center.lng, valuation.radiusKm);

    const payload: SprawdzResponse = { parcel, valuation, mpzp, nearby };
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof UldkError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      {
        error: 'Nie udało się pobrać danych działki. Spróbuj ponownie za chwilę.',
        ...(process.env.NODE_ENV === 'production'
          ? {}
          : { detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }),
      },
      { status: 502 }
    );
  }
}
