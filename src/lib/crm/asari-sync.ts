type SyncSummary = {
  success: boolean;
  remoteFileName: string;
  importedOffers: number;
  createdCount: number;
  updatedCount: number;
  deactivatedCount: number;
  skippedCount: number;
  errorCount: number;
  message: string;
};

export async function syncAsariIntegrationNow(
  integrationId: string
): Promise<SyncSummary> {
  console.log("[ASARI DEBUG] Start synchronizacji ASARI:", integrationId);

  return {
    success: true,
    remoteFileName: "ASARI_TEST",
    importedOffers: 0,
    createdCount: 0,
    updatedCount: 0,
    deactivatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    message:
      "ASARI sync placeholder działa. Następny krok: pobieranie plików z FTP.",
  };
}