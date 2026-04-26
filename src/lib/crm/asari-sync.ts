import * as ftp from "basic-ftp";
import { prisma } from "@/lib/prisma";

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
  console.log("[ASARI DEBUG] Start synchronizacji:", integrationId);

  const integration = await prisma.crmIntegration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw new Error("Nie znaleziono integracji ASARI.");
  }

  if (
    !integration.ftpHost ||
    !integration.ftpUsername ||
    !integration.ftpPassword
  ) {
    throw new Error("Brak danych FTP dla ASARI.");
  }

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  try {
    await client.access({
      host: integration.ftpHost,
      port: integration.ftpPort ?? 21,
      user: integration.ftpUsername,
      password: integration.ftpPassword,
      secure: false,
    });

    const remoteDir = integration.ftpRemotePath?.trim() || "/";
    await client.cd(remoteDir);

    console.log("[ASARI DEBUG] FTP katalog:", remoteDir);

    const list = await client.list();

    console.log(
      "[ASARI DEBUG] Pliki na FTP:",
      list.map((item) => ({
        name: item.name,
        size: item.size,
        isFile: item.isFile,
        modifiedAt: item.modifiedAt,
      }))
    );

    return {
      success: true,
      remoteFileName: "ASARI_MULTIPLE_FILES",
      importedOffers: 0,
      createdCount: 0,
      updatedCount: 0,
      deactivatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      message: `ASARI FTP OK. Znaleziono ${list.length} plików.`,
    };
  } catch (error) {
    console.error("[ASARI ERROR]", error);

    throw error;
  } finally {
    client.close();
  }
}