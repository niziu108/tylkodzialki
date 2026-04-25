export async function runCrmImportJob(jobId: string) {
  const job = await prisma.crmImportJob.findUnique({
    where: { id: jobId },
    include: { integration: true },
  });

  if (!job) throw new Error("Nie znaleziono joba CRM.");

  await prisma.crmImportJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      message: "Import CRM uruchomiony.",
    },
  });

  try {
    const result = await syncCrmIntegrationNow(job.integrationId, {
      jobId,
    });

    await prisma.crmImportJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        message: "Import zakończony poprawnie.",
        remoteFileName: result.remoteFileName,
        importedOffers: result.importedOffers,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        deactivatedCount: result.deactivatedCount,
        skippedCount: result.skippedCount,
        errorCount: result.errorCount,
      },
    });
  } catch (error) {
    await prisma.crmImportJob.update({
      where: { id: jobId },
      data: {
        status: "ERROR",
        finishedAt: new Date(),
        message: "Import zakończony błędem.",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}