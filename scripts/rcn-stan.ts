/**
 * Postęp zbierania cen transakcyjnych z RCN i to, ile z nich realnie widzi użytkownik.
 * READ-ONLY, nic nie zapisuje.
 *
 * Uruchom: npm run rcn:stan
 *
 * Po co: backfill chodzi partiami (cron na VPS), a sekcja „Ile realnie płacono w okolicy"
 * w raporcie pojawia się dopiero przy progu aktów. Ten skrypt odpowiada na dwa pytania naraz:
 * ile jeszcze zostało do przeskanowania i czy przybywa danych, które faktycznie coś pokazują.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { klasaTransakcji, RCN_MIESIECY } from '../src/lib/rcnStats';

const prisma = new PrismaClient({ log: ['error'] });

function procent(a: number, b: number): string {
  return b ? `${Math.round((a / b) * 100)}%` : '-';
}

async function main() {
  const teraz = new Date();
  const od = new Date(teraz);
  od.setMonth(od.getMonth() - RCN_MIESIECY);

  const aktywneWhere = {
    ownerId: { not: null },
    status: 'AKTYWNE' as const,
    lat: { not: null },
    lng: { not: null },
  };

  const [aktywne, zeskanowane, transakcje] = await Promise.all([
    prisma.dzialka.count({ where: aktywneWhere }),
    prisma.dzialka.count({ where: { ...aktywneWhere, rcnScanAt: { not: null } } }),
    prisma.rcnTransakcja.findMany({
      select: {
        teryt: true,
        dataTransakcji: true,
        rodzajTransakcji: true,
        udzial: true,
        rodzajNieruchomosci: true,
        przeznaczenieMpzp: true,
        sposobUzytkowania: true,
      },
    }),
  ]);

  const uzyteczne = transakcje.filter(
    (t) =>
      t.rodzajTransakcji === 'wolnyRynek' &&
      t.udzial === '1/1' &&
      t.rodzajNieruchomosci === 'nieruchomoscGruntowaNiezabudowana'
  );
  const wOknie = uzyteczne.filter((t) => t.dataTransakcji >= od);
  const budowlane = wOknie.filter((t) => klasaTransakcji(t) === 'budowlana');
  const rolne = wOknie.filter((t) => klasaTransakcji(t) === 'rolna');

  const powiaty = new Set(budowlane.map((t) => t.teryt));

  console.log('SKANOWANIE');
  console.log(
    `  oferty: ${zeskanowane} z ${aktywne} przeskanowanych (${procent(zeskanowane, aktywne)}), zostało ${aktywne - zeskanowane}`
  );
  console.log('\nZEBRANE TRANSAKCJE');
  console.log(`  wszystkie w bazie:                 ${transakcje.length}`);
  console.log(`  działki niezabudowane, wolny rynek, udział 1/1: ${uzyteczne.length}`);
  console.log(`  z tego w oknie ${RCN_MIESIECY} miesięcy:            ${wOknie.length}`);
  console.log(`    budowlane: ${budowlane.length} (w ${powiaty.size} powiatach) | rolne: ${rolne.length}`);
  console.log(
    '\nSekcja „Ile realnie płacono" pokazuje się od 10 aktów w promieniu do 35 km,'
  );
  console.log('więc rośnie razem z liczbą budowlanych powyżej.');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
