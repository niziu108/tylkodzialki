// Dzienny obraz ruchu prosto z bazy: "czy rosniemy". Tylko odczyt, zero zapisow.
//
// BiuroDailyStat trzyma liczniki KUMULACYJNE (stan narastajaco na dany dzien), wiec sama suma
// nic nie mowi. Aktywnosc danego dnia = roznica wzgledem dnia poprzedniego, i to liczymy nizej.
//
// Uwaga przy czytaniu historii: do 24.08.2026 liczniki podbijaly tez roboty (Googlebot renderuje
// JS), wiec starsze dni sa mocno zawyzone. Od filtra botow ([[isBotRequest]]) liczby sa realne,
// czyli z pozoru "spadaja". To nie awaria, to koniec liczenia robotow jak ludzi.
//
// Uruchomienie: npm run stats

import { prisma } from '../src/lib/prisma';

async function main() {
  const aktywne = await prisma.dzialka.count({ where: { status: 'AKTYWNE' } });
  const wszystkie = await prisma.dzialka.count();
  const konta = await prisma.dzialka.groupBy({
    by: ['ownerId'],
    where: { status: 'AKTYWNE', ownerId: { not: null } },
  });

  console.log('PODAZ');
  console.log(`  aktywne oferty: ${aktywne}   (wszystkie w bazie z historia: ${wszystkie})`);
  console.log(`  konta z ofertami: ${konta.length}`);

  const nowe: Array<{ tydz: string; n: number }> = await prisma.$queryRawUnsafe(`
    SELECT to_char(date_trunc('week', "createdAt"), 'IYYY-"W"IW') AS tydz, count(*)::int AS n
    FROM "Dzialka" WHERE "createdAt" > now() - interval '10 weeks'
    GROUP BY 1 ORDER BY 1`);
  console.log('\nNOWE OFERTY W TYGODNIU');
  for (const r of nowe) {
    console.log(`  ${r.tydz}  ${String(r.n).padStart(5)}  ${'#'.repeat(Math.min(50, Math.round(r.n / 30)))}`);
  }

  const dni: Array<{
    date: string;
    dv: number | null;
    dd: number | null;
    dt: number | null;
    dm: number | null;
  }> = await prisma.$queryRawUnsafe(`
    WITH d AS (
      SELECT date,
             sum("viewsCount")::int v, sum("detailViewsCount")::int o,
             sum("phoneClicksCount")::int t, sum("messageClicksCount")::int m
      FROM "BiuroDailyStat" GROUP BY date
    )
    SELECT date::text,
           v - lag(v) OVER (ORDER BY date) dv,
           o - lag(o) OVER (ORDER BY date) dd,
           t - lag(t) OVER (ORDER BY date) dt,
           m - lag(m) OVER (ORDER BY date) dm
    FROM d ORDER BY date DESC LIMIT 30`);

  console.log('\nRUCH NA OFERTACH, ostatnie 30 dni (od najnowszego)');
  console.log('  data         odslony   wejscia   telefon   wiadom.');
  for (const r of dni) {
    const c = (n: number | null) => String(n ?? '-').padStart(7);
    console.log(`  ${r.date}  ${c(r.dv)}  ${c(r.dd)}  ${c(r.dt)}  ${c(r.dm)}`);
  }

  const okno = dni.slice(0, 7);
  const suma = (k: 'dt' | 'dm') => okno.reduce((s, r) => s + (r[k] ?? 0), 0);
  console.log(`\n  KONTAKTY z 7 dni: ${suma('dt')} telefonow + ${suma('dm')} wiadomosci`);
  console.log('  (kontakt = ktos kliknal "pokaz numer" albo napisal wiadomosc)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
