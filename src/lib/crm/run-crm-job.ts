import { prisma } from "@/lib/prisma";
import { syncCrmIntegrationNow } from "@/lib/crm/domypl-sync";

export async function runCrmImportJob(jobId: string) {
  const job = await prisma.crmImportJob.findUnique({
    where: { id: jobId },
    include: { integration: true },
  });

  if (!job) {
    throw new Error("Nie znaleziono zadania importu CRM.");
  }

  await prisma.crmImportJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      message: "Import CRM uruchomiony.",
      errorMessage: null,
    },
  });

  try {
    const result = await syncCrmIntegrationNow(job.integrationId);

    await prisma.crmImportJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        message: "Import CRM zakończony poprawnie.",
        remoteFileName: result.remoteFileName ?? null,
        importedOffers: result.importedOffers ?? 0,
        createdCount: result.createdCount ?? 0,
        updatedCount: result.updatedCount ?? 0,
        deactivatedCount: result.deactivatedCount ?? 0,
        skippedCount: result.skippedCount ?? 0,
        errorCount: result.errorCount ?? 0,
      },
    });

    return result;
  } catch (error) {
    await prisma.crmImportJob.update({
      where: { id: jobId },
      data: {
        status: "ERROR",
        finishedAt: new Date(),
        message: "Import CRM zakończony błędem.",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}