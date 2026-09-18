/**
 * Zapis zdjęć ofert CRM wspólny dla czterech silników. Kiedy wymieniać galerię i w jakiej
 * kolejności: photo-refresh.ts. Tu są efekty, których testy jednostkowe nie dotykają (baza, R2).
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";
import type { PhotoRefreshEffects, UploadedPhoto } from "@/lib/crm/photo-refresh";

/**
 * Podmienia galerię w transakcji importu i zwraca klucze R2 zdjęć, które z niej wypadły. Te obiekty
 * wolno skasować dopiero po commicie (refreshOfferPhotos robi to sam).
 *
 * Wołać PO `tx.dzialka.update` tej działki. Blokada wiersza działki szereguje dwa równoległe
 * przebiegi: drugi czeka na commit pierwszego, czyta już jego galerię i kasuje ją dopiero po własnym
 * zapisie. Bez blokady oba odczytałyby starą galerię, a na ofercie zostałyby zdjęcia z obu przebiegów.
 */
export async function swapOfferPhotos(
  tx: Prisma.TransactionClient,
  dzialkaId: string,
  photos: UploadedPhoto[]
): Promise<string[]> {
  const previous = await tx.zdjecie.findMany({ where: { dzialkaId }, select: { publicId: true } });

  await tx.zdjecie.deleteMany({ where: { dzialkaId } });

  if (photos.length > 0) {
    await tx.zdjecie.createMany({ data: photos.map((photo) => ({ ...photo, dzialkaId })) });
  }

  return previous.map((photo) => photo.publicId).filter(Boolean);
}

/** Kasuje obiekty z R2. Błąd pojedynczego pliku to wyciek, nie przerywa reszty. */
export async function deleteR2Photos(keys: string[], logPrefix: string): Promise<void> {
  for (const key of keys) {
    if (!key) continue;

    try {
      await deleteFromR2(key);
    } catch (error) {
      console.error(`${logPrefix} Nie udało się usunąć zdjęcia z R2, zostaje jako wyciek:`, key, error);
    }
  }
}

/**
 * Sprzątanie wgranych zdjęć po transakcji, która rzuciła wyjątek. Błąd bywa zgłoszony już po
 * commicie (zerwane połączenie), więc kasujemy tylko obiekty, do których nie prowadzi żaden wiersz.
 * Gdy baza nie odpowiada, zostawiamy je: wyciek jest tańszy niż martwe zdjęcie.
 */
export async function discardUnsavedPhotos(photos: UploadedPhoto[], logPrefix: string): Promise<void> {
  const keys = photos.map((photo) => photo.publicId).filter(Boolean);
  if (keys.length === 0) return;

  let saved: Set<string>;
  try {
    const rows = await prisma.zdjecie.findMany({ where: { publicId: { in: keys } }, select: { publicId: true } });
    saved = new Set(rows.map((row) => row.publicId));
  } catch (error) {
    console.error(`${logPrefix} Nie sprawdzę, czy zdjęcia trafiły do bazy; ${keys.length} plików zostaje w R2.`, error);
    return;
  }

  await deleteR2Photos(keys.filter((key) => !saved.has(key)), logPrefix);
}

/** Efekty dla refreshOfferPhotos z prefiksem logów silnika, np. "[ASARI]". */
export function r2PhotoEffects(logPrefix: string): PhotoRefreshEffects {
  return {
    deleteObjects: (keys) => deleteR2Photos(keys, logPrefix),
    discardUnsaved: (photos) => discardUnsavedPhotos(photos, logPrefix),
    warn: (message) => console.warn(message),
  };
}
