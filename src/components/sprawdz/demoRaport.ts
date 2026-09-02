// WYGENEROWANE przez scripts/demo-zamroz.ts — nie edytuj recznie.
//
// Przykladowy raport pokazywany pod narzedziem, dopoki user nie sprawdzi wlasnej dzialki (P38 B2).
// Zamrozone sa TYLKO dane rejestrowe z GUGiK (ewidencja, plan miejscowy, plan ogolny): zmieniaja
// sie rzadko, a zamrozenie sprawia, ze demo stoi nawet gdy usluga GUGiK lezy. Cena okolicy, trend
// i oferty licza sie na zywo z naszej bazy przy renderze strony (app/sprawdz-dzialke/page.tsx),
// wiec demo nie pokazuje nieaktualnych kwot.
//
// Odswiezenie: npx tsx scripts/demo-zamroz.ts 51.679286 19.486612

import type { ParcelReport } from '@/lib/uldk';
import type { MpzpInfo } from '@/lib/mpzp';
import type { PogInfo } from '@/lib/pog';

/** Kiedy pobrano dane rejestrowe (pokazywane w stopce demo). */
export const DEMO_ZEBRANO = '2026-09-02';

export const DEMO_PARCEL: ParcelReport = {
  "id": "100610_4.0012.1035/7",
  "parcelNumber": "1035/7",
  "voivodeship": "łódzkie",
  "county": "powiat łódzki wschodni",
  "commune": "Rzgów",
  "region": "Rzgów",
  "areaM2": 1498,
  "dims": {
    "widthM": 59,
    "depthM": 47
  },
  "rings": [
    [
      {
        "lat": 51.6794456754805,
        "lng": 19.4868712999263
      },
      {
        "lat": 51.6793210839948,
        "lng": 19.486382949233
      },
      {
        "lat": 51.679268156259,
        "lng": 19.4861751905337
      },
      {
        "lat": 51.6790272009126,
        "lng": 19.4863392480119
      },
      {
        "lat": 51.6792095321649,
        "lng": 19.4870321573895
      },
      {
        "lat": 51.6794456754805,
        "lng": 19.4868712999263
      }
    ]
  ],
  "center": {
    "lat": 51.67928622071539,
    "lng": 19.486612024170114
  }
};

export const DEMO_MPZP: MpzpInfo | null = {
  "planName": "DLA CZĘŚCI MIASTA RZGOWA, REJON ULIC: KOPERNIKA – GÓRNA – BEMA - ŁÓDZKA",
  "functionName": "Tereny zabudowy mieszkaniowej jednorodzinnej",
  "functionSymbol": "4MN",
  "maxHeight": null,
  "intensity": null,
  "effectiveFrom": "2014-01-15",
  "resolution": "XLII/384/2014",
  "status": "obowiązujący"
};

export const DEMO_POG: PogInfo | null = null;
