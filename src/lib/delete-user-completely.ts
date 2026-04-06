import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";

export async function deleteUserCompletely(userId: string) {
  const listings = await prisma.dzialka.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      zdjecia: {
        select: {
          id: true,
          publicId: true,
        },
      },
    },
  });

  for (const listing of listings) {
    for (const photo of listing.zdjecia) {
      if (!photo.publicId) continue;

      try {
        await deleteFromR2(photo.publicId);
      } catch (error) {
        console.error("R2_DELETE_ERROR", {
          userId,
          listingId: listing.id,
          photoId: photo.id,
          publicId: photo.publicId,
          error,
        });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.zdjecie.deleteMany({
      where: {
        dzialka: {
          ownerId: userId,
        },
      },
    });

    await tx.dzialka.deleteMany({
      where: {
        ownerId: userId,
      },
    });

    await tx.emailSendLog.deleteMany({
      where: {
        userId,
      },
    });

    await tx.listingCreditTransaction.deleteMany({
      where: {
        userId,
      },
    });

    await tx.invoice.deleteMany({
      where: {
        userId,
      },
    });

    await tx.listingOrder.deleteMany({
      where: {
        userId,
      },
    });

    await tx.session.deleteMany({
      where: {
        userId,
      },
    });

    await tx.account.deleteMany({
      where: {
        userId,
      },
    });

    await tx.user.delete({
      where: {
        id: userId,
      },
    });
  });
}