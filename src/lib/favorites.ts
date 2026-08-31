// Zapisane oferty użytkownika: jedno zapytanie dla obu miejsc, w których je
// pokazujemy (strona /ulubione spod serca w nawigacji i zakładka w panelu
// klienta). Wcześniej każde miejsce miało własną kopię tego samego findMany.

import { prisma } from '@/lib/prisma';

export async function getFavoriteOffers(userId: string) {
  const favorites = await prisma.favoriteDzialka.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      dzialka: {
        include: {
          zdjecia: { orderBy: { kolejnosc: 'asc' } },
          owner: { select: { defaultBiuroLogoUrl: true, defaultBiuroNazwa: true } },
        },
      },
    },
  });

  // Zakończone oferty znikają z listy, ale zostają w ulubionych — gdyby wróciły
  // na portal (właściciel je aktywuje), pojawią się tu z powrotem.
  return favorites.map((f) => f.dzialka).filter((d) => d.status === 'AKTYWNE');
}

export type FavoriteOffer = Awaited<ReturnType<typeof getFavoriteOffers>>[number];
