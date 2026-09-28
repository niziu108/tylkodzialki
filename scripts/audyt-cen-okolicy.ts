import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

/**
 * Audyt sekcji „Ceny działek" pod WSZYSTKIMI aktywnymi ofertami sprzedaży. Liczy dokładnie tym
 * samym kodem co strona oferty (getPointValuation + getRcnOkolica + cenyOkolicy), więc to, co tu
 * wyjdzie, jest tym, co widzi kupujący. Tylko odczyt.
 *
 * Po co: pojedyncza oferta, która „wypada drogo", nie mówi, czy liczymy źle wszędzie. Ten raport
 * mówi: pod iloma ofertami jest sekcja, jak często oferta wypada poza paskiem i o ile, oraz daje
 * listę najbardziej odstających do obejrzenia ręcznie. Puszczać po każdej zmianie reguł cen
 * i raz na jakiś czas kontrolnie (2026-09-28).
 *
 *   npx tsx scripts/audyt-cen-okolicy.ts               -> całość (ok. 10 min, sporo zapytań do bazy)
 *   npx tsx scripts/audyt-cen-okolicy.ts --limit 500
 */

const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 0;
const ROWNOLEGLE = 6;
// Oferta tyle razy droższa/tańsza od mediany ogłoszeń = do obejrzenia.
const ODSTAJE = 2;

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { getPointValuation } = await import('../src/lib/seoHub');
  const { getRcnOkolica } = await import('../src/lib/rcnStats');
  const { cenyOkolicy } = await import('../src/components/sprawdz/CenyOkolicy');
  const { klasaZPrzeznaczen } = await import('../src/lib/raportCena');

  const oferty = await prisma.dzialka.findMany({
    where: { status: 'AKTYWNE', transakcja: { not: 'WYNAJEM' }, lat: { not: null }, lng: { not: null } },
    select: {
      id: true, lat: true, lng: true, cenaPln: true, powierzchniaM2: true, przeznaczenia: true,
      adminTeryt: true, locationLabel: true, tytul: true,
    },
    orderBy: { createdAt: 'desc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  type Wynik = {
    id: string; miejsce: string; tytul: string; zlM2: number | null; bezGminy: boolean;
    ogl: { low: number; median: number; high: number; n: number; km: number } | null;
    akty: { low: number; median: number; high: number; n: number } | null;
  };
  const wyniki: Wynik[] = [];
  let i = 0;

  async function robotnik() {
    while (i < oferty.length) {
      const o = oferty[i++];
      const pula = klasaZPrzeznaczen(o.przeznaczenia);
      const rolny = pula === 'rolna';
      const zlM2 = o.cenaPln > 0 && o.powierzchniaM2 > 0 ? o.cenaPln / o.powierzchniaM2 : null;
      const w: Wynik = {
        id: o.id, miejsce: o.locationLabel ?? '', tytul: o.tytul ?? '', zlM2, bezGminy: !o.adminTeryt, ogl: null, akty: null,
      };
      if (o.adminTeryt && pula) {
        const [v, r] = await Promise.all([
          getPointValuation(o.lat!, o.lng!, o.powierzchniaM2, o.id, o.adminTeryt).catch(() => null),
          getRcnOkolica(o.lat!, o.lng!, rolny ? 'rolna' : 'budowlana', {
            powierzchniaM2: o.powierzchniaM2,
            gminaTeryt: o.adminTeryt,
          }).catch(() => null),
        ]);
        const c = cenyOkolicy(v, r, null, rolny, zlM2);
        if (c?.cena?.value && c.cena.lead)
          w.ogl = { ...c.cena.value, n: c.cena.lead.stat.sampleCount, km: v!.radiusKm };
        if (c?.rcn) w.akty = { low: c.rcn.low, median: c.rcn.medianaZlM2, high: c.rcn.high, n: c.rcn.liczba };
      }
      wyniki.push(w);
      if (wyniki.length % 500 === 0) console.log(`  ${wyniki.length}/${oferty.length}`);
    }
  }
  await Promise.all(Array.from({ length: ROWNOLEGLE }, robotnik));

  const zCena = wyniki.filter((w) => w.zlM2);
  const pct = (n: number, z: number) => `${n} (${Math.round((n / Math.max(z, 1)) * 100)}%)`;
  const zOgl = zCena.filter((w) => w.ogl);
  const naPasku = zOgl.filter((w) => w.zlM2! >= w.ogl!.low && w.zlM2! <= w.ogl!.high).length;
  const ponad = zOgl.filter((w) => w.zlM2! > w.ogl!.high).length;
  const pod = zOgl.filter((w) => w.zlM2! < w.ogl!.low).length;
  const odstaje = zOgl
    .map((w) => ({ w, x: w.zlM2! / w.ogl!.median }))
    .filter(({ x }) => x >= ODSTAJE || x <= 1 / ODSTAJE)
    .sort((a, b) => Math.abs(Math.log(b.x)) - Math.abs(Math.log(a.x)));
  const obaZrodla = zCena.filter((w) => w.ogl && w.akty);
  const rozjazdZrodel = obaZrodla.filter((w) => {
    const x = w.ogl!.median / w.akty!.median;
    return x >= 2.5 || x <= 0.4;
  });

  console.log('\n=== Sekcja cen pod ofertami ===');
  console.log(`Ofert sprzedaży z ceną: ${zCena.length}`);
  console.log(`Bez kodu gminy (sekcji brak): ${pct(zCena.filter((w) => w.bezGminy).length, zCena.length)}`);
  console.log(`Z ceną z ogłoszeń: ${pct(zOgl.length, zCena.length)}`);
  console.log(`Z aktami: ${pct(zCena.filter((w) => w.akty).length, zCena.length)}`);
  console.log(`Bez sekcji: ${pct(zCena.filter((w) => !w.ogl && !w.akty).length, zCena.length)}`);
  console.log('\n=== Gdzie wypada oferta względem paska ogłoszeń ===');
  console.log(`Na pasku: ${pct(naPasku, zOgl.length)}  nad: ${pct(ponad, zOgl.length)}  pod: ${pct(pod, zOgl.length)}`);
  console.log(`Odstaje ${ODSTAJE}x od mediany: ${pct(odstaje.length, zOgl.length)}`);
  console.log(`Ogłoszenia i akty rozjechane 2,5x: ${pct(rozjazdZrodel.length, obaZrodla.length)} (z ${obaZrodla.length} z obiema)`);

  console.log(`\n=== Najbardziej odstające (do obejrzenia) ===`);
  for (const { w, x } of odstaje.slice(0, 25)) {
    console.log(
      `${x.toFixed(1).padStart(5)}x  ${Math.round(w.zlM2!)} zł/m² vs ${w.ogl!.low}-${w.ogl!.high} (med ${w.ogl!.median}, n=${w.ogl!.n}, ${w.ogl!.km} km)  ` +
        `${w.miejsce} | ${w.tytul.slice(0, 60)} | /dzialka/${w.id}`
    );
  }
  console.log(`\n=== Ogłoszenia vs akty rozjechane ===`);
  for (const w of rozjazdZrodel.slice(0, 15)) {
    console.log(`ogl ${w.ogl!.median} vs akty ${w.akty!.median}  ${w.miejsce} | /dzialka/${w.id}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
