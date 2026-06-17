import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/app-config";

export type AutoSyncEnqueueResult = {
  /** Czy auto-sync jest włączony flagą AppConfig.crmAutoSyncEnabled. */
  enabled: boolean;
  /** Liczba rozważanych aktywnych integracji. */
  totalActive: number;
  /** Id integracji, dla których utworzono nowy job. */
  enqueued: string[];
  /** Id integracji pominiętych, bo mają już job PENDING/RUNNING (R2). */
  skipped: string[];
  /** Id utworzonych jobów (do logów). */
  jobIds: string[];
};

/**
 * Kolejkuje automatyczną synchronizację aktywnych integracji CRM (Sprint 2, strategia C).
 *
 * Bezpieczeństwo (świadome decyzje):
 * - tworzy DOKŁADNIE taki sam PENDING CrmImportJob jak ręczny przycisk admina,
 *   więc NIE dotyka silników importu ani bezpiecznika masowej dezaktywacji (R1);
 * - powiela guard duplikatów (R2): pomija integracje, które mają już PENDING/RUNNING;
 * - faktycznym importem zajmuje się istniejący worker, sekwencyjnie (R3);
 * - całość sterowana flagą AppConfig.crmAutoSyncEnabled (domyślnie OFF => no-op),
 *   więc wyłączenie nie wymaga deployu.
 *
 * Guard jest best-effort (sprawdź-potem-utwórz), tak samo jak w route admina.
 * Nawet ewentualny zdublowany job jest nieszkodliwy: import jest idempotentny
 * (unikat CrmOfferLink(integrationId, externalId)) => UPDATE, nie duplikat oferty.
 *
 * @param onlyIntegrationId opcjonalnie ogranicz do jednej integracji (rollout fazami / test).
 */
export async function enqueueAutoSyncJobs(
  onlyIntegrationId?: string
): Promise<AutoSyncEnqueueResult> {
  const config = await getAppConfig();

  const result: AutoSyncEnqueueResult = {
    enabled: config.crmAutoSyncEnabled,
    totalActive: 0,
    enqueued: [],
    skipped: [],
    jobIds: [],
  };

  if (!config.crmAutoSyncEnabled) {
    return result;
  }

  const integrations = await prisma.crmIntegration.findMany({
    where: {
      isActive: true,
      ...(onlyIntegrationId ? { id: onlyIntegrationId } : {}),
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  result.totalActive = integrations.length;

  if (integrations.length === 0) {
    return result;
  }

  // R2: jednym zapytaniem ustalamy, które integracje mają już job w toku.
  const inFlight = await prisma.crmImportJob.findMany({
    where: {
      integrationId: { in: integrations.map((i) => i.id) },
      status: { in: ["PENDING", "RUNNING"] },
    },
    select: { integrationId: true },
  });
  const inFlightIds = new Set(inFlight.map((j) => j.integrationId));

  for (const integration of integrations) {
    if (inFlightIds.has(integration.id)) {
      result.skipped.push(integration.id);
      continue;
    }

    const job = await prisma.crmImportJob.create({
      data: {
        integrationId: integration.id,
        status: "PENDING",
        message: "Auto-sync CRM (harmonogram).",
      },
    });

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: { lastUsedAt: new Date() },
    });

    result.enqueued.push(integration.id);
    result.jobIds.push(job.id);
  }

  return result;
}
