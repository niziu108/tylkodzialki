'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';
import { deleteFromR2 } from '@/lib/r2';
import { DzialkaStatus } from '@prisma/client';

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) {
    throw new Error('Brak autoryzacji.');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user?.id) {
    throw new Error('Nie znaleziono użytkownika.');
  }

  return user.id;
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
    },
  });
}

export async function zakonczOgloszenieAction(dzialkaId: string) {
  const ownerId = await getCurrentUserId();

  const dzialka = await getOwnedDzialka(dzialkaId, ownerId);

  if (!dzialka) {
    throw new Error('Ogłoszenie nie istnieje lub nie należy do użytkownika.');
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

export async function przedluzOgloszenieAction(dzialkaId: string) {
  const ownerId = await getCurrentUserId();

  const dzialka = await getOwnedDzialka(dzialkaId, ownerId);

  if (!dzialka) {
    throw new Error('Ogłoszenie nie istnieje lub nie należy do użytkownika.');
  }

  const appConfig = await getAppConfig();
  const now = new Date();
  const currentExpiresAt = dzialka.expiresAt ? new Date(dzialka.expiresAt) : null;

  try {
    await prisma.$transaction(async (tx) => {
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
          throw new Error(
            'To ogłoszenie można przedłużyć dopiero wtedy, gdy do końca zostanie 30 dni lub mniej.'
          );
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
        throw new Error('NO_LISTING_CREDITS');
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
  } catch (e: any) {
    if (e?.message === 'NO_LISTING_CREDITS') {
      throw new Error(
        'Brak dostępnych publikacji. Kup pakiet, aby przedłużyć lub aktywować ogłoszenie.'
      );
    }

    throw e;
  }

  revalidatePath('/panel');
  revalidatePath('/kup');
  revalidatePath('/panel/pakiety');
}

export async function usunOgloszenieAction(dzialkaId: string) {
  const ownerId = await getCurrentUserId();

  const dzialka = await prisma.dzialka.findFirst({
    where: {
      id: dzialkaId,
      ownerId,
    },
    select: {
      id: true,
      zdjecia: {
        select: {
          publicId: true,
        },
      },
    },
  });

  if (!dzialka) {
    throw new Error('Ogłoszenie nie istnieje lub nie należy do użytkownika.');
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

export async function wyroznijOgloszenieAction(dzialkaId: string) {
  const ownerId = await getCurrentUserId();

  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      id: true,
      featuredCredits: true,
    },
  });

  if (!user) {
    throw new Error('Nie znaleziono użytkownika.');
  }

  const dzialka = await getOwnedDzialka(dzialkaId, ownerId);

  if (!dzialka) {
    throw new Error('Ogłoszenie nie istnieje lub nie należy do użytkownika.');
  }

  const now = new Date();

  if (
    dzialka.isFeatured &&
    dzialka.featuredUntil &&
    new Date(dzialka.featuredUntil).getTime() > now.getTime()
  ) {
    throw new Error('To ogłoszenie jest już aktualnie wyróżnione.');
  }

  if ((user.featuredCredits ?? 0) <= 0) {
    redirect(`/panel/wyroznienia?dzialkaId=${dzialkaId}`);
  }

  await prisma.$transaction(async (tx) => {
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
      throw new Error('NO_FEATURED_CREDITS');
    }

    await tx.dzialka.update({
      where: { id: dzialkaId },
      data: {
        isFeatured: true,
        featuredUntil: addDays(now, 7),
      },
    });
  });

  revalidatePath('/panel');
  revalidatePath('/kup');
  revalidatePath(`/dzialka/${dzialkaId}`);
}