'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';
import { deleteFromR2 } from '@/lib/r2';
import { DzialkaSourceType, DzialkaStatus } from '@prisma/client';

// Odmowę, którą ma zobaczyć użytkownik (brak publikacji, reguła 30 dni, oferta z CRM...),
// akcja ZWRACA, a `throw` zostaje na sytuacje nieoczekiwane. Treść błędu rzuconego z server
// action nie dociera na produkcji do przeglądarki: React Flight wysyła sam digest, a klient
// dostaje ogólny angielski komunikat. Na devie treść dochodzi, więc lokalnie tego nie widać.
export type PanelActionResult = { error: string } | undefined;

// Brak sesji albo konta: np. wylogowanie w innej karcie przy otwartym panelu.
const SESJA_WYGASLA = 'Sesja wygasła. Zaloguj się ponownie.';

// Ofertą z importu CRM rządzi program biura, a nie panel, więc zakończenie, aktywacja,
// przedłużenie i usunięcie są tu zablokowane (przyciski ukrywa też PanelDzialkiList).
// - Zakończenie: ASARI i EstiCRM czytają pełny eksport przy każdym przebiegu i przywracają ofertę,
//   a DOMY.PL (paczki różnicowe) trzyma ją ukrytą, dopóki nie przyjdzie w kolejnej paczce.
// - Usunięcie: kaskada zabiera link z CRM, historię cen, epizody i raport, a oferta wraca z feedu
//   jako nowy rekord pod nowym adresem (stary adres daje 404).
// - Przedłużenie przy płatnościach ustawia `expiresAt`, którego silniki nie czyszczą, więc oferta po
//   cichu znika z list. Bez płatności przestawia `publishedAt`, co rekoncyliator epizodów bierze za
//   zejście i powrót oferty. Aktywacja oferty zakończonej przez CRM wskrzesza sprzedaną działkę,
//   której wygaszanie po pełnym eksporcie i po `<oferta_usun>` już nie widzi (bierze tylko linki
//   z `isActiveInSource`).
// Wyróżnienie zostaje: to usługa portalu, której import nie nadpisuje.
const OFERTA_Z_CRM =
  'Tą ofertą zarządzasz w swoim CRM. Zakończ lub wznów ją tam, a portal zaktualizuje się sam.';

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  return user?.id ?? null;
}

async function getAppConfig() {
  let config = await prisma.appConfig.findFirst();

  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        paymentsEnabled: false,
        freeListingCredits: 0,
        freeListingCreditsDays: null,
      },
    });
  }

  return config;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function getOwnedDzialka(dzialkaId: string, ownerId: string) {
  return prisma.dzialka.findFirst({
    where: {
      id: dzialkaId,
      ownerId,
    },
    select: {
      id: true,
      expiresAt: true,
      status: true,
      isFeatured: true,
      featuredUntil: true,
      sourceType: true,
    },
  });
}

export async function zakonczOgloszenieAction(
  dzialkaId: string
): Promise<PanelActionResult> {
  const ownerId = await getCurrentUserId();

  if (!ownerId) {
    return { error: SESJA_WYGASLA };
  }

  const dzialka = await getOwnedDzialka(dzialkaId, ownerId);

  if (!dzialka) {
    return { error: 'Ogłoszenie nie istnieje lub nie należy do użytkownika.' };
  }

  if (dzialka.sourceType === DzialkaSourceType.CRM) {
    return { error: OFERTA_Z_CRM };
  }

  await prisma.dzialka.update({
    where: { id: dzialkaId },
    data: {
      status: DzialkaStatus.ZAKONCZONE,
      endedAt: new Date(),
    },
  });

  revalidatePath('/panel');
  revalidatePath('/kup');
}

export async function przedluzOgloszenieAction(
  dzialkaId: string
): Promise<PanelActionResult> {
  const ownerId = await getCurrentUserId();

  if (!ownerId) {
    return { error: SESJA_WYGASLA };
  }

  const dzialka = await getOwnedDzialka(dzialkaId, ownerId);

  if (!dzialka) {
    return { error: 'Ogłoszenie nie istnieje lub nie należy do użytkownika.' };
  }

  if (dzialka.sourceType === DzialkaSourceType.CRM) {
    return { error: OFERTA_Z_CRM };
  }

  const appConfig = await getAppConfig();
  const now = new Date();
  const currentExpiresAt = dzialka.expiresAt ? new Date(dzialka.expiresAt) : null;

  // Odmowa wychodzi z transakcji jako jej wynik. Przed odmową nic się nie zapisuje
  // (updateMany bez trafienia niczego nie zmienia), więc zatwierdzenie transakcji jest puste.
  const odmowa = await prisma.$transaction(async (tx): Promise<PanelActionResult> => {
    if (!appConfig.paymentsEnabled) {
      await tx.dzialka.update({
        where: { id: dzialkaId },
        data: {
          status: DzialkaStatus.AKTYWNE,
          endedAt: null,
          expiresAt: null,
          publishedAt:
            dzialka.status === DzialkaStatus.ZAKONCZONE ||
            !currentExpiresAt ||
            currentExpiresAt.getTime() <= now.getTime()
              ? now
              : undefined,
        },
      });

      return;
    }

    const isStillActive =
      dzialka.status !== DzialkaStatus.ZAKONCZONE &&
      !!currentExpiresAt &&
      currentExpiresAt.getTime() > now.getTime();

    let newExpiresAt: Date;

    if (isStillActive && currentExpiresAt) {
      const daysLeft = Math.ceil(
        (currentExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysLeft > 30) {
        return {
          error:
            'To ogłoszenie można przedłużyć dopiero wtedy, gdy do końca zostanie 30 dni lub mniej.',
        };
      }

      newExpiresAt = addDays(currentExpiresAt, 30);
    } else {
      newExpiresAt = addDays(now, 30);
    }

    const updatedUser = await tx.user.updateMany({
      where: {
        id: ownerId,
        listingCredits: {
          gt: 0,
        },
      },
      data: {
        listingCredits: {
          decrement: 1,
        },
      },
    });

    if (updatedUser.count === 0) {
      return {
        error: 'Brak dostępnych publikacji. Kup pakiet, aby przedłużyć lub aktywować ogłoszenie.',
      };
    }

    await tx.dzialka.update({
      where: { id: dzialkaId },
      data: {
        status: DzialkaStatus.AKTYWNE,
        endedAt: null,
        expiresAt: newExpiresAt,
        publishedAt:
          dzialka.status === DzialkaStatus.ZAKONCZONE ||
          !currentExpiresAt ||
          currentExpiresAt.getTime() <= now.getTime()
            ? now
            : undefined,
      },
    });
  });

  if (odmowa) {
    return odmowa;
  }

  revalidatePath('/panel');
  revalidatePath('/kup');
  revalidatePath('/panel/pakiety');
}

export async function usunOgloszenieAction(dzialkaId: string): Promise<PanelActionResult> {
  const ownerId = await getCurrentUserId();

  if (!ownerId) {
    return { error: SESJA_WYGASLA };
  }

  const dzialka = await prisma.dzialka.findFirst({
    where: {
      id: dzialkaId,
      ownerId,
    },
    select: {
      id: true,
      sourceType: true,
      zdjecia: {
        select: {
          publicId: true,
        },
      },
    },
  });

  if (!dzialka) {
    return { error: 'Ogłoszenie nie istnieje lub nie należy do użytkownika.' };
  }

  if (dzialka.sourceType === DzialkaSourceType.CRM) {
    return { error: OFERTA_Z_CRM };
  }

  const photoKeys = dzialka.zdjecia
    .map((z) => z.publicId)
    .filter((key): key is string => Boolean(key));

  await prisma.dzialka.delete({
    where: { id: dzialkaId },
  });

  await Promise.allSettled(photoKeys.map((key) => deleteFromR2(key)));

  revalidatePath('/panel');
  revalidatePath('/kup');
}

export async function wyroznijOgloszenieAction(
  dzialkaId: string
): Promise<PanelActionResult> {
  const ownerId = await getCurrentUserId();

  if (!ownerId) {
    return { error: SESJA_WYGASLA };
  }

  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      id: true,
      featuredCredits: true,
      featuredCreditsExpiresAt: true,
    },
  });

  if (!user) {
    return { error: SESJA_WYGASLA };
  }

  const dzialka = await getOwnedDzialka(dzialkaId, ownerId);

  if (!dzialka) {
    return { error: 'Ogłoszenie nie istnieje lub nie należy do użytkownika.' };
  }

  const now = new Date();

  if (
    dzialka.isFeatured &&
    dzialka.featuredUntil &&
    new Date(dzialka.featuredUntil).getTime() > now.getTime()
  ) {
    return { error: 'To ogłoszenie jest już aktualnie wyróżnione.' };
  }

  // Data ważności pakietu jest wiążąca, nie ozdobna. Panel od zawsze pokazywał
  // „ważne do ...", ale nic tego nie pilnowało — punkty z wygasłego pakietu dawały się
  // wydać bez końca. Przy pakietach przyznawanych partnerom z ręki (na kwartał)
  // to różnica między obietnicą a jej dotrzymaniem.
  const pakietWygasl =
    !!user.featuredCreditsExpiresAt &&
    new Date(user.featuredCreditsExpiresAt).getTime() <= now.getTime();

  if ((user.featuredCredits ?? 0) <= 0 || pakietWygasl) {
    redirect(`/panel/wyroznienia?dzialkaId=${dzialkaId}`);
  }

  const wyrozniono = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.updateMany({
      where: {
        id: ownerId,
        featuredCredits: {
          gt: 0,
        },
      },
      data: {
        featuredCredits: {
          decrement: 1,
        },
      },
    });

    if (updatedUser.count === 0) {
      return false;
    }

    await tx.dzialka.update({
      where: { id: dzialkaId },
      data: {
        isFeatured: true,
        featuredUntil: addDays(now, 7),
      },
    });

    return true;
  });

  // Ostatni punkt zszedł między sprawdzeniem a transakcją (np. wyróżnienie drugiej oferty
  // w tej samej chwili). Tak samo jak przy braku punktów: do zakupu wyróżnienia.
  if (!wyrozniono) {
    redirect(`/panel/wyroznienia?dzialkaId=${dzialkaId}`);
  }

  revalidatePath('/panel');
  revalidatePath('/kup');
  revalidatePath(`/dzialka/${dzialkaId}`);
}