// Oś administracyjna oferty (gmina/powiat/województwo + TERYT gminy) z punktu na mapie, przez ULDK.
//
// Ta sama logika co `scripts/admin-backfill.ts`, ale dla JEDNEJ oferty: wołana w tle ze strony
// oferty i z cogodzinnego skanu RCN. Po co: od 2026-09-28 ceny pod ofertą porównujemy tylko
// w tej samej gminie, a świeża oferta nie miała kodu gminy, dopóki ktoś ręcznie nie puścił
// backfillu (część ofert czekała na to od lipca). Wtedy sekcja cen liczyła się bez granicy gminy
// i wieś dostawała ceny miasta.
//
// Nadpisujemy tylko puste `adminTeryt`: raz ustalona gmina się nie zmienia.

import { prisma } from '@/lib/prisma';
import { getAdminByXY } from '@/lib/uldk';

/** Zwraca TERYT gminy (6 cyfr) albo null, gdy ULDK nic nie zna w tym punkcie. */
export async function uzupelnijAdminOferty(id: string): Promise<string | null> {
  const d = await prisma.dzialka.findUnique({
    where: { id },
    select: { lat: true, lng: true, adminTeryt: true },
  });
  if (!d || d.adminTeryt) return d?.adminTeryt ?? null;
  if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return null;

  const admin = await getAdminByXY(d.lat, d.lng);
  if (!admin) return null;
  await prisma.dzialka.updateMany({
    where: { id, adminTeryt: null },
    data: {
      adminTeryt: admin.teryt,
      adminWoj: admin.voivodeship,
      adminPowiat: admin.county,
      adminGmina: admin.commune,
      adminAt: new Date(),
    },
  });
  return admin.teryt;
}
