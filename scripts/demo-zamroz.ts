/**
 * ROBOCZY: zamraza dane REJESTROWE wybranej dzialki do pliku demo raportu (P38 B2).
 *
 * Zamrazamy tylko to, co pochodzi z zewnetrznych uslug GUGiK (ULDK, MPZP, plan ogolny):
 * te dane zmieniaja sie rzadko, a uslugi potrafia lezec i wtedy demo by znikalo.
 * Ceny, trend i oferty w okolicy licza sie na zywo z NASZEJ bazy przy renderze strony,
 * wiec demo nigdy nie pokazuje nieaktualnych kwot.
 *
 * Uruchom: npx tsx scripts/demo-zamroz.ts <lat> <lng>
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { getParcelByXY } from '../src/lib/uldk';
import { getMpzpAtPoint } from '../src/lib/mpzp';
import { getPogAtPoint } from '../src/lib/pog';

const PLIK = 'src/components/sprawdz/demoRaport.ts';

async function main() {
  const lat = Number(process.argv[2]);
  const lng = Number(process.argv[3]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.error('Uzycie: npx tsx scripts/demo-zamroz.ts <lat> <lng>');
    process.exit(1);
  }

  const parcel = await getParcelByXY(lat, lng);
  if (!parcel) {
    console.error('ULDK nie zwrocil dzialki dla tego punktu.');
    process.exit(1);
  }

  const [mpzp, pog] = await Promise.all([
    getMpzpAtPoint(parcel.center.lat, parcel.center.lng),
    getPogAtPoint(parcel.center.lat, parcel.center.lng),
  ]);

  const dzis = new Date().toISOString().slice(0, 10);
  const tresc = `// WYGENEROWANE przez scripts/demo-zamroz.ts — nie edytuj recznie.
//
// Przykladowy raport pokazywany pod narzedziem, dopoki user nie sprawdzi wlasnej dzialki (P38 B2).
// Zamrozone sa TYLKO dane rejestrowe z GUGiK (ewidencja, plan miejscowy, plan ogolny): zmieniaja
// sie rzadko, a zamrozenie sprawia, ze demo stoi nawet gdy usluga GUGiK lezy. Cena okolicy, trend
// i oferty licza sie na zywo z naszej bazy przy renderze strony (app/sprawdz-dzialke/page.tsx),
// wiec demo nie pokazuje nieaktualnych kwot.
//
// Odswiezenie: npx tsx scripts/demo-zamroz.ts ${parcel.center.lat.toFixed(6)} ${parcel.center.lng.toFixed(6)}

import type { ParcelReport } from '@/lib/uldk';
import type { MpzpInfo } from '@/lib/mpzp';
import type { PogInfo } from '@/lib/pog';

/** Kiedy pobrano dane rejestrowe (pokazywane w stopce demo). */
export const DEMO_ZEBRANO = '${dzis}';

export const DEMO_PARCEL: ParcelReport = ${JSON.stringify(parcel, null, 2)};

export const DEMO_MPZP: MpzpInfo | null = ${JSON.stringify(mpzp, null, 2)};

export const DEMO_POG: PogInfo | null = ${JSON.stringify(pog, null, 2)};
`;

  writeFileSync(PLIK, tresc, 'utf8');

  console.log(`Zapisano ${PLIK}`);
  console.log(`  dzialka:  ${parcel.id} (${parcel.parcelNumber}), ${parcel.areaM2} m2`);
  console.log(`  gdzie:    ${parcel.commune}, ${parcel.county}, ${parcel.voivodeship}`);
  console.log(`  wierzcholki obrysu: ${parcel.rings[0]?.length ?? 0}`);
  console.log(`  MPZP:     ${mpzp ? `${mpzp.functionName ?? mpzp.functionSymbol ?? '?'} | plan: ${mpzp.planName ?? '-'} | wys.: ${mpzp.maxHeight ?? '-'}` : 'brak'}`);
  console.log(`  POG:      ${pog ? `${pog.strefa.symbol} ${pog.strefa.nazwa ?? ''} | OUZ: ${pog.ouz ? 'TAK' : 'nie'}` : 'brak'}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
