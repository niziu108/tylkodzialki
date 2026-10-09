// WYGENEROWANE przez scripts/demo-zamroz.ts — nie edytuj recznie.
//
// Przykladowy raport pokazywany pod narzedziem, dopoki user nie sprawdzi wlasnej dzialki (P38 B2).
// Zamrozone sa TYLKO dane rejestrowe z GUGiK (ewidencja, plan miejscowy, plan ogolny): zmieniaja
// sie rzadko, a zamrozenie sprawia, ze demo stoi nawet gdy usluga GUGiK lezy. Cena okolicy, trend
// i oferty licza sie na zywo z naszej bazy przy renderze strony (app/sprawdz-dzialke/page.tsx),
// wiec demo nie pokazuje nieaktualnych kwot.
//
// Odswiezenie: npx tsx scripts/demo-zamroz.ts 51.601904 19.472102

import type { ParcelReport } from '@/lib/uldk';
import type { MpzpInfo } from '@/lib/mpzp';
import type { PogInfo } from '@/lib/pog';

/** Kiedy pobrano dane rejestrowe (pokazywane w stopce demo). */
export const DEMO_ZEBRANO = '2026-10-09';

export const DEMO_PARCEL: ParcelReport = {
  "id": "100611_5.0001.3/24",
  "parcelNumber": "3/24",
  "voivodeship": "łódzkie",
  "county": "powiat łódzki wschodni",
  "commune": "Tuszyn",
  "region": "Bądzyń",
  "areaM2": 996,
  "dims": {
    "widthM": 36,
    "depthM": 29
  },
  "rings": [
    [
      {
        "lat": 51.6020095059382,
        "lng": 19.472300390787
      },
      {
        "lat": 51.6020021938951,
        "lng": 19.4717939559161
      },
      {
        "lat": 51.601747826624,
        "lng": 19.4718033623756
      },
      {
        "lat": 51.6017534313647,
        "lng": 19.4723098517202
      },
      {
        "lat": 51.6020095059382,
        "lng": 19.472300390787
      }
    ]
  ],
  "center": {
    "lat": 51.60190449275204,
    "lng": 19.47210159031718
  }
};

export const DEMO_MPZP: MpzpInfo | null = {
  "planName": "GMINY TUSZYN",
  "functionName": "Zabudowa mieszkaniowa jednorodzinna; Zabudowa letniskowa",
  "functionSymbol": "1MN,ML",
  "maxHeight": null,
  "intensity": null,
  "effectiveFrom": "2004-06-18",
  "resolution": "XVIII/116/04",
  "status": "obowiązujący",
  "resolutionUrl": null
};

export const DEMO_POG: PogInfo | null = null;
