// P24: orkiestracja raportu „Sprawdź działkę".
//
// Wejście (POST JSON): { lat, lng } (pinezka/adres) albo { parcelId } (numer ewidencyjny).
// Łączy: ULDK (granice/metraż/administracja) + wycenę z naszych ofert w okolicy. Wszystko
// prawdziwe albo pominięte — zero zmyślania ([[feedback-filtry-twarde]]).

import { NextRequest, NextResponse } from 'next/server';
import { getParcelById, getParcelByXY, UldkError, type ParcelReport } from '@/lib/uldk';
import { getNearbyOffers, getPointValuation, type PointValuation } from '@/lib/seoHub';
import { getMpzpAtPoint, type MpzpInfo } from '@/lib/mpzp';
import { getPogAtPoint, type PogInfo } from '@/lib/pog';
import { getAreaPriceTrend, type AreaPriceTrend } from '@/lib/dzialkaPriceHistory';
import { getRcnOkolica, type RcnOkolica } from '@/lib/rcnStats';
import { looksRolny } from '@/lib/raportCena';

type NearbyOffer = Awaited<ReturnType<typeof getNearbyOffers>>[number];

export const runtime = 'nodejs';

// Odpowiedzi GUGiK w tej trasie zawsze na żywo. lib/uldk, lib/mpzp i lib/pog proszą Next o cache na
// tydzień, a Next zapisuje każdą odpowiedź 200, także „brak wyniku", które krajowa integracja planów
// wysyła po ~60 s, gdy serwer gminy wisi. Nieświeży wpis odświeża potem w tle już bez limitu czasu,
// więc raport pokazywałby z cache „brak planu" tam, gdzie gmina po prostu nie odpowiedziała.
export const fetchCache = 'force-no-store';

type Body = { lat?: unknown; lng?: unknown; parcelId?: unknown };

export type SprawdzResponse = {
  parcel: ParcelReport;
  valuation: PointValuation;
  mpzp: MpzpInfo | null; // przeznaczenie z KIMPZP w środku działki; null gdy brak planu
  // true = serwer planów gminy nie odpowiedział albo odpowiedział nieczytelnie (limit czasu, błąd,
  // wyjątek serwera gminy, sam rysunek planu): mpzp jest wtedy null,
  // ale to znaczy „nie wiemy", a nie „brak planu"
  mpzpNiedostepny: boolean;
  pog: PogInfo | null; // plan ogólny gminy: strefa planistyczna + obszar uzupełnienia zabudowy
  trend: AreaPriceTrend | null;
  rcn: RcnOkolica | null; // ceny z aktow notarialnych (RCN, GUGiK) w okolicy; null = za mala probka
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
    // Plan miejscowy z `rzucajBledy`: gdy serwer gminy wisi, krajowa integracja po ~60 s odpowiada
    // „brak wyniku", tym samym tekstem co przy prawdziwym braku planu (ten przychodzi w ułamku
    // sekundy). Limit 20 s i osobna flaga pozwalają raportowi powiedzieć „gmina nie odpowiedziała".
    // TERYT z identyfikatora działki: gminy na hostingu GISON lib pyta najpierw wprost.
    const [valuation, mpzpWynik, pog] = await Promise.all([
      getPointValuation(parcel.center.lat, parcel.center.lng, parcel.areaM2),
      getMpzpAtPoint(parcel.center.lat, parcel.center.lng, {
        rzucajBledy: true,
        teryt: parcel.id.slice(0, 6),
      }).then(
        (mpzp) => {
          // Plan jest, ale jego szczegóły z serwera gminy nie przyszły: do logu, żeby widzieć skalę.
          if (mpzp?.detailsUnavailable) console.warn('SPRAWDZ_DZIALKE_MPZP_BEZ_SZCZEGOLOW', parcel.id);
          return { mpzp, niedostepny: false };
        },
        (err: unknown) => {
          const powod = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
          console.warn('SPRAWDZ_DZIALKE_MPZP_NIEDOSTEPNY', parcel.id, powod);
          return { mpzp: null, niedostepny: true };
        }
      ),
      getPogAtPoint(parcel.center.lat, parcel.center.lng),
    ]);
    const { mpzp } = mpzpWynik;

    // Oferty z tego samego koła, na którym liczyliśmy cenę — spójnie z tym, co raport pokazuje.
    // Ceny transakcyjne z RCN idą własną drabinką promieni (aktów jest znacznie mniej niż ofert),
    // a pulę dobieramy tak samo jak przy cenie ofertowej: plan rolny => transakcje gruntów rolnych.
    const [nearby, trend, rcn] = await Promise.all([
      getNearbyOffers(parcel.center.lat, parcel.center.lng, valuation.radiusKm),
      getAreaPriceTrend(parcel.center.lat, parcel.center.lng, valuation.radiusKm),
      getRcnOkolica(parcel.center.lat, parcel.center.lng, looksRolny(mpzp) ? 'rolna' : 'budowlana'),
    ]);

    const payload: SprawdzResponse = {
      parcel,
      valuation,
      mpzp,
      mpzpNiedostepny: mpzpWynik.niedostepny,
      pog,
      trend,
      rcn,
      nearby,
    };
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
