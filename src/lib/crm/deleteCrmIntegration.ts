import { prisma } from "@/lib/prisma";

export type DeleteCrmIntegrationResult = {
  /** Ile ofert faktycznie wyłączono (były AKTYWNE i należały do tej integracji). */
  deactivatedOffers: number;
};

/**
 * Usuwa integrację CRM i WYŁĄCZA wszystkie powiązane z nią oferty.
 *
 * Wyłączenie = soft delete (status ZAKONCZONE + endedAt), dokładnie tak, jak robi
 * synchronizacja, gdy oferta znika z eksportu (patrz `deactivateMissingOffers`
 * w domypl-sync.ts / asari-sync.ts / esticrm-sync.ts). Żadnej nowej semantyki.
 *
 * BEZPIECZEŃSTWO (krytyczne): ruszamy WYŁĄCZNIE oferty powiązane z TĄ integracją
 * przez `CrmOfferLink.integrationId`. Oferty innych biur/integracji nie mają takiego
 * linku, więc są nietykalne. Najpierw wyłączamy oferty, dopiero potem usuwamy
 * integrację (po usunięciu linki znikają kaskadą), całość w jednej transakcji —
 * albo wyłączymy oferty I usuniemy integrację, albo nic.
 *
 * Soft delete, nie fizyczne usunięcie, bo:
 *  - to natywny stan „zakończenia" oferty w tym projekcie (ZAKONCZONE znika z
 *    wyszukiwarki, /favorites, „podobnych", alertów i hubów SEO — wszędzie filtr AKTYWNE),
 *  - jest odwracalny (filozofia „bezpieczne poprawki > kasowanie danych"),
 *  - nie kasuje kaskadą zdjęć, ulubionych ani statystyk wiszących na Dzialka,
 *  - jeśli ta sama działka byłaby też pod inną, aktywną integracją, jej najbliższy
 *    import sam ją reaktywuje (sync wznawia oferty, które wróciły do eksportu).
 *
 * Usunięcie integracji kasuje kaskadowo (FK onDelete: Cascade) CrmOfferLink,
 * CrmSyncLog, CrmImportJob i CrmProcessedFile — jak dotychczas.
 */
export async function deleteCrmIntegrationAndDeactivateOffers(
  integrationId: string
): Promise<DeleteCrmIntegrationResult> {
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      // 1. Oferty powiązane WYŁĄCZNIE z tą integracją (po integrationId w linku).
      const links = await tx.crmOfferLink.findMany({
        where: { integrationId },
        select: { dzialkaId: true },
      });
      const dzialkaIds = [...new Set(links.map((l) => l.dzialkaId))];

      // 2. Wyłączamy (soft delete) tylko te, które są jeszcze AKTYWNE — dokładnie
      //    jak deactivateMissingOffers w synchronizacji. Nie tworzymy logów per oferta:
      //    integracja (a z nią wszystkie CrmSyncLog) i tak za chwilę znika kaskadą.
      let deactivatedOffers = 0;
      if (dzialkaIds.length > 0) {
        const res = await tx.dzialka.updateMany({
          where: { id: { in: dzialkaIds }, status: "AKTYWNE" },
          data: { status: "ZAKONCZONE", endedAt: now, crmLastSyncedAt: now },
        });
        deactivatedOffers = res.count;
      }

      // 3. Usuwamy integrację — kaskada kasuje linki, logi, joby, pliki (jak dotąd).
      await tx.crmIntegration.delete({ where: { id: integrationId } });

      return { deactivatedOffers };
    },
    // Hojny limit: duże biuro może mieć setki ofert + tysiące logów do skasowania kaskadą.
    { timeout: 30000 }
  );
}
