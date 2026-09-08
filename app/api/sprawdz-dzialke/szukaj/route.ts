// Wyszukiwanie działki po obrębie i numerze — wejście do „Sprawdź działkę" dla działek BEZ adresu
// (a takich jest większość: pole za wsią nie ma ulicy ani numeru domu).
//
// Endpoint oddaje wyłącznie listę kandydatów z jednostkami administracyjnymi, bez geometrii i bez
// wyceny. Pełny raport liczy dopiero POST /api/sprawdz-dzialke po identyfikatorze wybranej działki
// — dzięki temu zapytanie o popularną nazwę obrębu („Dąbrowa 12" to 61 działek w Polsce) nie
// uruchamia sześćdziesięciu wycen i sześćdziesięciu odpytań MPZP.

import { NextRequest, NextResponse } from 'next/server';
import { findParcels, UldkError, type ParcelCandidate } from '@/lib/uldk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type SzukajResponse = { items: ParcelCandidate[] };

const MAX_OBREB = 60;
const MAX_NUMER = 20;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const obreb = (params.get('obreb') ?? '').trim().slice(0, MAX_OBREB);
  const numer = (params.get('numer') ?? '').trim().slice(0, MAX_NUMER);

  if (!obreb) {
    return NextResponse.json(
      { error: 'Podaj obręb (nazwę albo numer) i numer działki.' },
      { status: 400 }
    );
  }

  try {
    const items = await findParcels(obreb, numer);
    const payload: SzukajResponse = { items };
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof UldkError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: 'Rejestr działek (GUGiK) nie odpowiada. Spróbuj ponownie za chwilę.' },
      { status: 502 }
    );
  }
}
