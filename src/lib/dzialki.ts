import { cache } from 'react';
import { prisma } from '@/lib/prisma';

/**
 * Pobiera pełną ofertę działki bezpośrednio z bazy (Prisma) wraz ze zdjęciami
 * i danymi biura. Współdzielone przez SSR strony oferty i endpoint API,
 * dzięki czemu mamy jedno źródło prawdy i koniec podwójnego pobierania danych.
 *
 * `cache()` deduplikuje wywołania w obrębie jednego żądania
 * (np. generateMetadata + render strony pobiorą dane tylko raz).
 */
export const getDzialkaById = cache(async (id: string) => {
  if (!id || typeof id !== 'string') return null;

  const item = await prisma.dzialka.findUnique({
    where: { id },
    include: {
      zdjecia: { orderBy: { kolejnosc: 'asc' } },
      owner: {
        select: {
          defaultBiuroLogoUrl: true,
          defaultBiuroNazwa: true,
          defaultBiuroOpiekun: true,
        },
      },
    },
  });

  if (!item) return null;

  return {
    ...item,
    biuroLogoUrl: item.biuroLogoUrl || item.owner?.defaultBiuroLogoUrl || null,
    biuroNazwa: item.biuroNazwa || item.owner?.defaultBiuroNazwa || null,
    biuroOpiekun: item.biuroOpiekun || item.owner?.defaultBiuroOpiekun || null,
  };
});

export type DzialkaFull = NonNullable<Awaited<ReturnType<typeof getDzialkaById>>>;
