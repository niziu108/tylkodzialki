import { prisma } from "@/lib/prisma";
import { syncCrmIntegrationNow } from "@/lib/crm/domypl-sync";
import { syncAsariIntegrationNow } from "@/lib/crm/asari-sync";
import { syncEstiCrmIntegrationNow } from "@/lib/crm/esticrm-sync";

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
    const isAsari = job.integration.provider === "ASARI";
    const isEstiCrm =
      job.integration.provider === "ESTI_CRM" ||
      job.integration.feedFormat === "ESTICRM_XML";

    const result = isEstiCrm
      ? await syncEstiCrmIntegrationNow(job.integrationId)
      : isAsari
        ? await syncAsariIntegrationNow(job.integrationId)
        : await syncCrmIntegrationNow(job.integrationId);

    await prisma.crmImportJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        message: isEstiCrm
          ? "Import EstiCRM zakończony poprawnie."
          : isAsari
            ? "Import ASARI zakończony poprawnie."
            : "Import CRM zakończony poprawnie.",
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
    const provider = job.integration.provider;
    const isEstiCrm =
      provider === "ESTI_CRM" || job.integration.feedFormat === "ESTICRM_XML";

    await prisma.crmImportJob.update({
      where: { id: jobId },
      data: {
        status: "ERROR",
        finishedAt: new Date(),
        message: isEstiCrm
          ? "Import EstiCRM zakończony błędem."
          : provider === "ASARI"
            ? "Import ASARI zakończony błędem."
            : "Import CRM zakończony błędem.",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}