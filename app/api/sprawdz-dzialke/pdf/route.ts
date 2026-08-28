// Raport „Sprawdź działkę" jako plik PDF do pobrania.
//
// Dane odtwarzamy na serwerze z tych samych źródeł co raport na ekranie (ULDK + wycena z naszych
// ofert + KIMPZP), zamiast przyjmować gotowy JSON od klienta: plik ma pokazywać to, co naprawdę
// jest w rejestrach, a nie to, co ktoś podeśle w żądaniu.

import { NextRequest, NextResponse } from 'next/server';
import { getParcelById, getParcelByXY, UldkError, type ParcelReport } from '@/lib/uldk';
import { getPointValuation } from '@/lib/seoHub';
import { getMpzpAtPoint } from '@/lib/mpzp';
import { generujRaportPdf } from '@/lib/raportPdf';

export const runtime = 'nodejs';
// ULDK + ortofotomapa + skład PDF: z zapasem ponad domyślne 10 s funkcji.
export const maxDuration = 30;

type Body = { lat?: unknown; lng?: unknown; parcelId?: unknown };

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function nazwaPliku(parcel: ParcelReport): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `raport-dzialka-${slug(parcel.parcelNumber)}-${slug(parcel.commune)}.pdf`;
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
      return NextResponse.json({ error: 'Podaj punkt na mapie albo numer działki.' }, { status: 400 });
    }

    if (!parcel) {
      return NextResponse.json({ error: 'Nie znaleziono działki w tym miejscu.' }, { status: 404 });
    }

    const [valuation, mpzp] = await Promise.all([
      getPointValuation(parcel.center.lat, parcel.center.lng, parcel.areaM2),
      getMpzpAtPoint(parcel.center.lat, parcel.center.lng),
    ]);

    const pdf = await generujRaportPdf({ parcel, valuation, mpzp, origin: req.nextUrl.origin });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nazwaPliku(parcel)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof UldkError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      {
        error: 'Nie udało się przygotować pliku PDF. Spróbuj ponownie za chwilę.',
        ...(process.env.NODE_ENV === 'production'
          ? {}
          : { detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }),
      },
      { status: 502 }
    );
  }
}
