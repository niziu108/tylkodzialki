import dotenv from 'dotenv';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Env przed Prisma, jak w pozostałych skryptach.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

/**
 * Zbiera transakcje z Rejestru Cen Nieruchomości (RCN, GUGiK) dla okolic naszych ofert
 * i zapisuje je do `RcnTransakcja`.
 *
 * Po co: mamy tylko ceny OFERTOWE, czyli życzenia sprzedających. RCN podaje kwoty faktycznie
 * zapłacone. Zestawienie obu liczb to rzecz, której nie ma ani Otodom (ma oferty bez transakcji),
 * ani serwisy z danymi (mają transakcje bez ofert).
 *
 * Dlaczego okolice ofert, a nie cała Polska: usługa oddaje dane tylko przy skali poniżej 1:5001,
 * czyli kaflami po ok. 440 m. Skan kraju to setki tysięcy zapytań. Okolice 7,2 tys. ofert
 * dają pokrycie dokładnie tam, gdzie mamy co z nimi zestawić.
 *
 * Bezpieczeństwo: powtarzalny. Oferta dostaje `rcnScanAt` i w kolejnym przebiegu jest pomijana
 * (chyba że `--odswiez`). Transakcje wchodzą przez upsert po kluczu naturalnym, więc nakładające
 * się kafle sąsiednich ofert nie tworzą duplikatów. Bez `--apply` nic nie zapisuje.
 *
 * Uruchomienie:
 *   npm run rcn:backfill                                  -> raport z kilku ofert, bez zapisu
 *   npm run rcn:backfill -- --apply --woj lodzkie         -> jedno województwo
 *   npm run rcn:backfill -- --apply                       -> cała baza (długo, patrz --limit)
 *   npm run rcn:backfill -- --apply --limit 200
 *   npm run rcn:backfill -- --apply --odswiez --dni 90    -> ponów oferty skanowane dawniej niż 90 dni
 *
 * Produkcja (VPS, cron co godzinę pod flock, od 2026-09-28):
 *   npm run rcn:backfill -- --apply --odswiez --dni 90 --max-minut 55
 * Jedno zadanie robi wszystko: najpierw nowe oferty, potem skanowane najdawniej. Oferta skanowana
 * przed SKAN_METODA_OD (stara metoda gubiła ~45% aktów) jest nieaktualna bez względu na --dni,
 * więc po wdrożeniu nowej metody pełny ponowny skan robi się sam w kilka dni, a potem każda
 * okolica wraca co 90 dni (rejestr dopisuje akty z opóźnieniem 1-3 miesięcy). Blokada pliku
 * pilnuje, żeby dwa przebiegi nigdy nie szły naraz, a --max-minut kończy przebieg przed kolejnym.
 */

const APPLY = process.argv.includes('--apply');
const ODSWIEZ = process.argv.includes('--odswiez');

function argWartosc(nazwa: string): string | null {
  const i = process.argv.indexOf(nazwa);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

const WOJ = argWartosc('--woj');
const LIMIT = Number(argWartosc('--limit') ?? (APPLY ? '0' : '5')) || 0;
const DNI = Number(argWartosc('--dni') ?? '90');
const MAX_MINUT = Number(argWartosc('--max-minut') ?? '0') || 0;

// Od kiedy skanujemy metodą „zachłannego pokrycia" (rcnClient). Wcześniejsze skany gubiły
// sąsiednie działki, więc traktujemy je jak nieaktualne. Przy kolejnej zmianie metody: podbić datę.
const SKAN_METODA_OD = new Date('2026-09-30T00:00:00Z');

const BLOKADA = path.join(os.tmpdir(), 'tylkodzialki-rcn-backfill.lock');
// Blokada starsza niż doba to ślad po przerwanym procesie (restart serwera), nie działający przebieg.
const BLOKADA_WAZNA_H = 26;

// Tempo: to darmowa usługa publiczna GUGiK. ~3 zapytania/s to spokojne obciążenie.
const PRZERWA_PIKSEL_MS = 300;
const PRZERWA_OFERTA_MS = 400;
const MAX_BLEDOW_POD_RZAD = 20;

const spij = (ms: number) => new Promise((r) => setTimeout(r, ms));

function procesZyje(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function zalozBlokade(): boolean {
  try {
    const st = fs.statSync(BLOKADA);
    const pid = Number(fs.readFileSync(BLOKADA, 'utf8'));
    // Blokada zostaje tylko, gdy jej właściciel naprawdę jeszcze działa. Po restarcie serwera
    // albo zabitym procesie plik jest martwy i nie może wstrzymać pobierania.
    if (pid > 0 && procesZyje(pid) && Date.now() - st.mtimeMs < BLOKADA_WAZNA_H * 3600 * 1000) return false;
    fs.rmSync(BLOKADA, { force: true });
  } catch {
    // brak pliku = wolne
  }
  try {
    fs.writeFileSync(BLOKADA, String(process.pid), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (APPLY && !zalozBlokade()) {
    console.log(`Inny przebieg RCN trwa (blokada ${BLOKADA}). Kończę bez zmian.`);
    return;
  }
  const { prisma } = await import('../src/lib/prisma');
  const { transakcjeKafla } = await import('../src/lib/rcnClient');
  const { uzupelnijAdminOferty } = await import('../src/lib/adminOferty');

  const progOdswiezenia = new Date(Date.now() - DNI * 24 * 3600 * 1000);

  // `--woj lodzkie` ma dzialac tak samo jak `--woj lodzkie` z polskimi znakami, bo w terminalu
  // nikt ich nie wpisuje. Dopasowanie po znormalizowanej nazwie, nie po dokladnym stringu.
  const { normalizeText } = await import('../src/lib/dzialkiSearch');
  const wojSzukane = WOJ ? normalizeText(WOJ) : null;
  const wszystkieWoj = await prisma.dzialka.findMany({
    where: { status: 'AKTYWNE', adminWoj: { not: null } },
    select: { adminWoj: true },
    distinct: ['adminWoj'],
  });
  const wojDokladne = wojSzukane
    ? wszystkieWoj.map((w) => w.adminWoj!).find((w) => normalizeText(w) === wojSzukane)
    : null;
  if (WOJ && !wojDokladne) {
    console.error(`Nie znam wojewodztwa „${WOJ}". Dostepne: ${wszystkieWoj.map((w) => w.adminWoj).sort().join(', ')}`);
    process.exit(1);
  }

  const oferty = await prisma.dzialka.findMany({
    where: {
      status: 'AKTYWNE',
      lat: { not: null },
      lng: { not: null },
      ...(wojDokladne ? { adminWoj: wojDokladne } : {}),
      ...(ODSWIEZ
        ? {
            OR: [
              { rcnScanAt: null },
              { rcnScanAt: { lt: progOdswiezenia } },
              { rcnScanAt: { lt: SKAN_METODA_OD } },
            ],
          }
        : { rcnScanAt: null }),
    },
    select: { id: true, lat: true, lng: true, adminWoj: true, adminGmina: true, adminTeryt: true, locationLabel: true },
    // Nowe oferty pierwsze (ktoś właśnie na nie patrzy), potem okolice sprawdzane najdawniej.
    orderBy: [{ rcnScanAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });

  console.log(`Ofert do przeskanowania${wojDokladne ? ` (${wojDokladne})` : ''}: ${oferty.length}`);
  console.log(APPLY ? 'TRYB: zapis do bazy' : 'TRYB: raport (bez zapisu). Dodaj --apply, żeby zapisać.');
  console.log('');

  let zapisane = 0;
  let znalezione = 0;
  let ofertyBezTransakcji = 0;
  let podRzad = 0;
  let zapytan = 0;
  let urwane = 0;
  const t0 = Date.now();

  for (let n = 0; n < oferty.length; n++) {
    const d = oferty[n];
    try {
      if (MAX_MINUT > 0 && Date.now() - t0 > MAX_MINUT * 60000) {
        console.log(`
Limit czasu ${MAX_MINUT} min: reszta w następnym przebiegu.`);
        break;
      }
      const kafel = await transakcjeKafla(d.lat!, d.lng!, PRZERWA_PIKSEL_MS);
      const trans = kafel.transakcje;
      zapytan += kafel.zapytan;
      if (kafel.urwane) urwane++;
      podRzad = 0;
      znalezione += trans.length;
      if (trans.length === 0) ofertyBezTransakcji++;

      if (APPLY) {
        // Przy okazji gmina oferty: ceny pod ofertą liczą się tylko w jej gminie (CenyOkolicy),
        // więc oferta bez kodu gminy nie ma sekcji cen. Tu łapiemy wszystkie w ciągu godziny.
        if (!d.adminTeryt) await uzupelnijAdminOferty(d.id).catch(() => null);
        for (const t of trans) {
          const { lokalnyIdIip, idDzialki, ...reszta } = t;
          await prisma.rcnTransakcja.upsert({
            where: { lokalnyIdIip_idDzialki: { lokalnyIdIip, idDzialki } },
            create: { lokalnyIdIip, idDzialki, ...reszta },
            // Rejestr bywa korygowany przez starostwa, więc odświeżamy treść rekordu.
            update: { ...reszta, pobranoAt: new Date() },
          });
          zapisane++;
        }
        await prisma.dzialka.update({ where: { id: d.id }, data: { rcnScanAt: new Date() } });
      }

      if (!APPLY && trans.length > 0) {
        console.log(`  ${d.locationLabel ?? ''} (${d.adminGmina ?? '?'}): ${trans.length} transakcji`);
        for (const t of trans.slice(0, 3)) {
          console.log(
            `      ${t.dataTransakcji.toISOString().slice(0, 10)}  ` +
            `${t.cenaBruttoPln.toLocaleString('pl')} zł  ${t.powierzchniaM2} m²  ` +
            `= ${Math.round(t.cenaZaM2)} zł/m²  [${t.rodzajNieruchomosci}, ${t.rodzajTransakcji}, udział ${t.udzial}]`,
          );
        }
      }
    } catch (e) {
      podRzad++;
      if (podRzad >= MAX_BLEDOW_POD_RZAD) {
        console.error(`\nPrzerwane: ${MAX_BLEDOW_POD_RZAD} błędów pod rząd. Ostatni:`, e);
        break;
      }
    }

    if ((n + 1) % 25 === 0 || n === oferty.length - 1) {
      const minut = (Date.now() - t0) / 60000;
      const tempo = (n + 1) / Math.max(minut, 0.01);
      const zostalo = (oferty.length - n - 1) / Math.max(tempo, 0.01);
      console.log(
        `  ${n + 1}/${oferty.length}  znalezione=${znalezione} zapisane=${zapisane} ` +
        `puste=${ofertyBezTransakcji}  (${tempo.toFixed(1)} ofert/min, zostało ~${zostalo.toFixed(0)} min)`,
      );
    }
    await spij(PRZERWA_OFERTA_MS);
  }

  console.log('');
  console.log(`Znalezionych transakcji: ${znalezione}`);
  console.log(`Zapisanych (z duplikatami z sąsiednich kafli): ${zapisane}`);
  console.log(`Ofert bez żadnej transakcji w okolicy: ${ofertyBezTransakcji}`);
  console.log(`Zapytań GetFeatureInfo: ${zapytan}`);
  // Urwany kafel = trafiliśmy w bezpiecznik MAX_ZAPYTAN_KAFLA. Pojedyncze w śródmieściach są
  // w porządku; dużo = sprawdzić rcnClient, zanim zaczniemy gubić akty po cichu.
  console.log(`Kafli urwanych na bezpieczniku: ${urwane}`);
  if (APPLY) {
    const wBazie = await prisma.rcnTransakcja.count();
    console.log(`Unikalnych transakcji w bazie: ${wBazie}`);
  } else {
    console.log('\nNic nie zapisano (brak --apply).');
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    // Zdejmujemy tylko własną blokadę (plik z naszym PID-em).
    try {
      if (fs.readFileSync(BLOKADA, 'utf8') === String(process.pid)) fs.rmSync(BLOKADA, { force: true });
    } catch {
      // brak blokady = nic do zdjęcia
    }
  });
