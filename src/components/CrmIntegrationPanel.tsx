"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Integration = {
  id: string;
  name: string;
  provider: "GENERIC" | "ASARI" | "ESTI_CRM" | "IMOX" | "GALACTICA";
  isActive: boolean;
  transportType: "API" | "FTP";
  feedFormat: "DOMY_PL";
  lastUsedAt: string | Date | null;
  lastSyncAt: string | Date | null;
  lastSuccessAt: string | Date | null;
  lastErrorAt: string | Date | null;
  lastErrorMessage: string | null;
  lastImportedOffers: number;
  lastCreatedCount: number;
  lastUpdatedCount: number;
  lastDeactivatedCount: number;
  lastSkippedCount: number;
  lastErrorCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
} | null;

type CrmLog = {
  id: string;
  externalId: string | null;
  action:
    | "CREATE"
    | "UPDATE"
    | "DEACTIVATE"
    | "REACTIVATE"
    | "SKIP_NO_CREDITS"
    | "DELETE"
    | "ERROR";
  status: "SUCCESS" | "ERROR";
  message: string | null;
  createdAt: string;
};

type Props = {
  integration: Integration;
  paymentsEnabled: boolean;
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("pl-PL");
  } catch {
    return "—";
  }
}

export default function CrmIntegrationPanel({
  integration,
  paymentsEnabled,
}: Props) {
  const router = useRouter();

  const [syncing, setSyncing] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultSuccess, setResultSuccess] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<CrmLog[]>([]);

  useEffect(() => {
    async function loadLogs() {
      if (!integration?.id) {
        setLogs([]);
        return;
      }

      try {
        setLogsLoading(true);
        setLogsError(null);

        const res = await fetch(
          `/api/crm/logs?integrationId=${encodeURIComponent(integration.id)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          setLogsError(data?.error || "Nie udało się pobrać logów CRM.");
          return;
        }

        setLogs(Array.isArray(data?.logs) ? data.logs : []);
      } catch (error) {
        console.error(error);
        setLogsError("Nie udało się pobrać logów CRM.");
      } finally {
        setLogsLoading(false);
      }
    }

    loadLogs();
  }, [integration?.id]);

  async function handleSyncNow() {
    if (!integration?.id) return;

    try {
      setSyncing(true);
      setResultError(null);
      setResultSuccess(null);

      const res = await fetch(`/api/crm/integrations/${integration.id}/sync-now`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setResultError(data?.error || "Nie udało się uruchomić synchronizacji.");
        return;
      }

      const summary = data?.summary;
      setResultSuccess(
        summary
          ? `Synchronizacja zakończona. Import: ${summary.importedOffers}, utworzone: ${summary.createdCount}, zaktualizowane: ${summary.updatedCount}, zakończone: ${summary.deactivatedCount}, pominięte: ${summary.skippedCount}, błędy: ${summary.errorCount}.`
          : "Synchronizacja została uruchomiona."
      );

      router.refresh();

      const refreshRes = await fetch(
        `/api/crm/logs?integrationId=${encodeURIComponent(integration.id)}`,
        { cache: "no-store" }
      );
      const refreshData = await refreshRes.json();

      if (refreshRes.ok) {
        setLogs(Array.isArray(refreshData?.logs) ? refreshData.logs : []);
      }
    } catch (error) {
      console.error(error);
      setResultError("Wystąpił błąd podczas synchronizacji.");
    } finally {
      setSyncing(false);
    }
  }

  if (!integration) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 md:p-10">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Integracja CRM
          </div>

          <h2 className="mt-4 text-2xl font-semibold text-white">
            Integracja nie została jeszcze skonfigurowana
          </h2>

          <p className="mt-3 leading-7 text-white/65">
            Konfigurację FTP i importu przygotowuje administrator. Gdy integracja
            zostanie podłączona, zobaczysz tutaj jej status i możliwość ręcznej
            synchronizacji.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {resultSuccess ? (
        <div className="rounded-2xl border border-[#7aa333]/20 bg-[#7aa333]/10 px-4 py-3 text-sm leading-6 text-[#dce9bf]">
          {resultSuccess}
        </div>
      ) : null}

      {resultError ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
          {resultError}
        </div>
      ) : null}

      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
              Integracja CRM
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-white">
              Status integracji
            </h2>

            <p className="mt-3 leading-7 text-white/65">
              Konfiguracja połączenia jest zarządzana po stronie administratora.
              Tutaj możesz sprawdzić status integracji i uruchomić ręczną
              synchronizację.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <div className="text-white/45">Status</div>
            <div
              className={`mt-1 font-semibold ${
                integration.isActive ? "text-[#9fd14b]" : "text-red-300"
              }`}
            >
              {integration.isActive ? "Aktywna" : "Nieaktywna"}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              Provider
            </div>
            <div className="mt-2 text-base font-semibold text-white">
              {integration.provider}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              Ostatnia synchronizacja
            </div>
            <div className="mt-2 text-base font-semibold text-white">
              {formatDate(integration.lastSyncAt)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              Ostatni sukces
            </div>
            <div className="mt-2 text-base font-semibold text-white">
              {formatDate(integration.lastSuccessAt)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              Ostatnie użycie
            </div>
            <div className="mt-2 text-base font-semibold text-white">
              {formatDate(integration.lastUsedAt)}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              Ostatnio zaimportowano
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {integration.lastImportedOffers}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              Utworzone / zaktualizowane
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {integration.lastCreatedCount} / {integration.lastUpdatedCount}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              Zakończone / pominięte / błędy
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {integration.lastDeactivatedCount} / {integration.lastSkippedCount} /{" "}
              {integration.lastErrorCount}
            </div>
          </div>
        </div>

        {integration.lastErrorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <div className="text-sm font-semibold text-red-200">
              Ostatni błąd integracji
            </div>
            <div className="mt-2 text-sm leading-6 text-red-100/90">
              {integration.lastErrorMessage}
            </div>
            <div className="mt-2 text-xs text-red-200/70">
              {formatDate(integration.lastErrorAt)}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-[#7aa333]/20 bg-[#7aa333]/10 p-4 text-sm leading-6 text-[#dce9bf]">
            Integracja została skonfigurowana. Możesz uruchomić synchronizację
            ręcznie.
          </div>
        )}

        {integration.lastErrorMessage?.includes("Brak dostępnych publikacji") ? (
          <div className="mt-6 rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-4">
            <div className="text-sm font-semibold text-yellow-200">
              Brak dostępnych publikacji
            </div>

            <div className="mt-2 text-sm text-yellow-100/80">
              Część ofert z CRM nie została opublikowana, ponieważ konto nie
              miało wolnych publikacji. Po zakupie pakietu kliknij „Synchronizuj
              teraz”.
            </div>

            {paymentsEnabled ? (
              <div className="mt-4">
                <a
                  href="/panel/pakiety"
                  className="inline-flex rounded-full bg-[#7aa333] px-5 py-3 text-sm font-semibold text-black hover:opacity-90"
                >
                  Kup ogłoszenia
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing || !integration.isActive}
            className="inline-flex rounded-full bg-[#7aa333] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "Synchronizacja..." : "Synchronizuj teraz"}
          </button>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
          Logi synchronizacji
        </div>

        <h3 className="mt-4 text-2xl font-semibold text-white">
          Ostatnie zdarzenia CRM
        </h3>

        {logsLoading ? (
          <div className="mt-5 text-sm text-white/60">Ładowanie logów...</div>
        ) : logsError ? (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {logsError}
          </div>
        ) : logs.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
            Brak logów. Gdy uruchomisz synchronizację, zobaczysz tutaj historię
            importów.
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-black/20 text-left text-white/50">
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Akcja</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">externalId</th>
                    <th className="px-4 py-3 font-medium">Komunikat</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                    >
                      <td className="px-4 py-3 text-white/70">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-white">{log.action}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            log.status === "SUCCESS"
                              ? "bg-[#7aa333]/20 text-[#9fd14b]"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#dce9bf]">
                        {log.externalId || "—"}
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {log.message || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}