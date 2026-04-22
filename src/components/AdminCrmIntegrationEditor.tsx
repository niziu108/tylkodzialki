"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Integration = {
  id: string;
  name: string;
  provider: "GENERIC" | "ASARI" | "ESTI_CRM" | "IMOX" | "GALACTICA";
  isActive: boolean;
  transportType: "API" | "FTP";
  feedFormat: "DOMY_PL";
  ftpHost: string | null;
  ftpPort: number | null;
  ftpUsername: string | null;
  ftpRemotePath: string | null;
  ftpPassive: boolean;
  expectedFilePattern: string | null;
  fullImportMode: boolean;
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
  userId: string;
  userLabel: string;
  integration: Integration;
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("pl-PL");
  } catch {
    return "—";
  }
}

export default function AdminCrmIntegrationEditor({
  userId,
  userLabel,
  integration,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultSuccess, setResultSuccess] = useState<string | null>(null);
  const [currentIntegration, setCurrentIntegration] = useState<Integration>(integration);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<CrmLog[]>([]);

  const [form, setForm] = useState({
    name: integration?.name ?? "Galactica / DOMY.PL / FTP",
    provider: (integration?.provider ?? "GALACTICA") as
      | "GENERIC"
      | "ASARI"
      | "ESTI_CRM"
      | "IMOX"
      | "GALACTICA",
    isActive: integration?.isActive ?? true,
    ftpHost: integration?.ftpHost ?? "",
    ftpPort: String(integration?.ftpPort ?? 21),
    ftpUsername: integration?.ftpUsername ?? "",
    ftpPassword: "",
    ftpRemotePath: integration?.ftpRemotePath ?? "/",
    ftpPassive: integration?.ftpPassive ?? true,
    expectedFilePattern: integration?.expectedFilePattern ?? "oferty_*.zip",
    fullImportMode: integration?.fullImportMode ?? true,
  });

  useEffect(() => {
    setForm({
      name: currentIntegration?.name ?? "Galactica / DOMY.PL / FTP",
      provider: (currentIntegration?.provider ?? "GALACTICA") as
        | "GENERIC"
        | "ASARI"
        | "ESTI_CRM"
        | "IMOX"
        | "GALACTICA",
      isActive: currentIntegration?.isActive ?? true,
      ftpHost: currentIntegration?.ftpHost ?? "",
      ftpPort: String(currentIntegration?.ftpPort ?? 21),
      ftpUsername: currentIntegration?.ftpUsername ?? "",
      ftpPassword: "",
      ftpRemotePath: currentIntegration?.ftpRemotePath ?? "/",
      ftpPassive: currentIntegration?.ftpPassive ?? true,
      expectedFilePattern:
        currentIntegration?.expectedFilePattern ?? "oferty_*.zip",
      fullImportMode: currentIntegration?.fullImportMode ?? true,
    });
  }, [currentIntegration]);

  useEffect(() => {
    async function loadLogs() {
      if (!currentIntegration?.id) {
        setLogs([]);
        return;
      }

      try {
        setLogsLoading(true);
        setLogsError(null);

        const res = await fetch(
          `/api/admin/crm/logs?integrationId=${encodeURIComponent(currentIntegration.id)}`,
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
  }, [currentIntegration?.id]);

  const canSync = useMemo(() => {
    return !!(
      currentIntegration?.id &&
      form.ftpHost.trim() &&
      form.ftpUsername.trim() &&
      form.ftpRemotePath.trim()
    );
  }, [currentIntegration?.id, form.ftpHost, form.ftpUsername, form.ftpRemotePath]);

  async function handleCreateIntegration() {
    try {
      setLoading(true);
      setResultError(null);
      setResultSuccess(null);

      const res = await fetch(`/api/admin/crm/users/${userId}/integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Galactica / DOMY.PL / FTP",
          provider: "GALACTICA",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResultError(data?.error || "Nie udało się utworzyć integracji CRM.");
        return;
      }

      setCurrentIntegration(data.integration ?? null);
      setResultSuccess("Integracja FTP / XML DOMY.PL została utworzona.");
      router.refresh();
    } catch (error) {
      console.error(error);
      setResultError("Wystąpił błąd podczas tworzenia integracji CRM.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveIntegration() {
    if (!currentIntegration?.id) return;

    try {
      setSaving(true);
      setResultError(null);
      setResultSuccess(null);

      const res = await fetch(`/api/admin/crm/integrations/${currentIntegration.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          provider: form.provider,
          isActive: form.isActive,
          ftpHost: form.ftpHost,
          ftpPort: Number(form.ftpPort) || 21,
          ftpUsername: form.ftpUsername,
          ftpPassword: form.ftpPassword,
          ftpRemotePath: form.ftpRemotePath,
          ftpPassive: form.ftpPassive,
          expectedFilePattern: form.expectedFilePattern,
          fullImportMode: form.fullImportMode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResultError(data?.error || "Nie udało się zapisać integracji.");
        return;
      }

      setCurrentIntegration(data.integration ?? null);
      setForm((prev) => ({
        ...prev,
        ftpPassword: "",
      }));
      setResultSuccess("Konfiguracja integracji została zapisana.");
      router.refresh();
    } catch (error) {
      console.error(error);
      setResultError("Wystąpił błąd podczas zapisywania integracji.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncNow() {
    if (!currentIntegration?.id) return;

    try {
      setSyncing(true);
      setResultError(null);
      setResultSuccess(null);

      const res = await fetch(
        `/api/admin/crm/integrations/${currentIntegration.id}/sync-now`,
        {
          method: "POST",
        }
      );

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
        `/api/admin/crm/logs?integrationId=${encodeURIComponent(currentIntegration.id)}`,
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

  async function handleDeleteIntegration() {
    if (!currentIntegration?.id) return;

    const confirmed = window.confirm(
      "Czy na pewno chcesz usunąć integrację CRM? Oferty pozostaną w serwisie, ale integracja, logi i powiązania CRM zostaną usunięte."
    );

    if (!confirmed) return;

    try {
      setDeleteLoading(true);
      setResultError(null);
      setResultSuccess(null);

      const res = await fetch(`/api/admin/crm/integrations/${currentIntegration.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setResultError(data?.error || "Nie udało się usunąć integracji CRM.");
        return;
      }

      setCurrentIntegration(null);
      setLogs([]);
      setResultSuccess("Integracja CRM została usunięta.");
      router.refresh();
    } catch (error) {
      console.error(error);
      setResultError("Wystąpił błąd podczas usuwania integracji CRM.");
    } finally {
      setDeleteLoading(false);
    }
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

      {!currentIntegration ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 md:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
              Brak integracji
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-white">
              Konfiguracja CRM dla użytkownika
            </h2>

            <p className="mt-3 leading-7 text-white/65">
              Użytkownik: <span className="text-white">{userLabel}</span>
            </p>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleCreateIntegration}
                disabled={loading}
                className="inline-flex rounded-full bg-[#7aa333] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Tworzenie..." : "Utwórz integrację FTP"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
                  CRM użytkownika
                </div>

                <h2 className="mt-4 text-2xl font-semibold text-white">
                  Konfiguracja integracji CRM
                </h2>

                <p className="mt-3 leading-7 text-white/65">
                  Użytkownik: <span className="text-white">{userLabel}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <div className="text-white/45">Status</div>
                <div
                  className={`mt-1 font-semibold ${
                    currentIntegration.isActive
                      ? "text-[#9fd14b]"
                      : "text-red-300"
                  }`}
                >
                  {currentIntegration.isActive ? "Aktywna" : "Wyłączona"}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Ostatnia synchronizacja
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {formatDate(currentIntegration.lastSyncAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Ostatni sukces
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {formatDate(currentIntegration.lastSuccessAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Ostatnio zaimportowano
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {currentIntegration.lastImportedOffers}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Błędy
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {currentIntegration.lastErrorCount}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-sm font-semibold text-white">
                  Ustawienia ogólne
                </div>

                <div className="mt-4 space-y-4">
                  <label className="block">
                    <div className="mb-2 text-sm text-white/70">Nazwa integracji</div>
                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-[#7aa333]/50"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm text-white/70">Provider</div>
                    <select
                      value={form.provider}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          provider: e.target.value as
                            | "GENERIC"
                            | "ASARI"
                            | "ESTI_CRM"
                            | "IMOX"
                            | "GALACTICA",
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-white outline-none transition focus:border-[#7aa333]/50"
                    >
                      <option value="GALACTICA">GALACTICA</option>
                      <option value="GENERIC">GENERIC</option>
                      <option value="ASARI">ASARI</option>
                      <option value="ESTI_CRM">ESTI_CRM</option>
                      <option value="IMOX">IMOX</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          isActive: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm text-white">Integracja aktywna</span>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <input
                      type="checkbox"
                      checked={form.fullImportMode}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          fullImportMode: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm text-white">
                      Pełny import (oferty, których nie ma w eksporcie, są kończone)
                    </span>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-sm font-semibold text-white">
                  Połączenie FTP
                </div>

                <div className="mt-4 space-y-4">
                  <label className="block">
                    <div className="mb-2 text-sm text-white/70">Host FTP</div>
                    <input
                      value={form.ftpHost}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, ftpHost: e.target.value }))
                      }
                      placeholder="ftp.twojadomena.pl"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-[#7aa333]/50"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm text-white/70">Port FTP</div>
                      <input
                        value={form.ftpPort}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, ftpPort: e.target.value }))
                        }
                        placeholder="21"
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-[#7aa333]/50"
                      />
                    </label>

                    <label className="flex items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <input
                        type="checkbox"
                        checked={form.ftpPassive}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            ftpPassive: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm text-white">Tryb pasywny FTP</span>
                    </label>
                  </div>

                  <label className="block">
                    <div className="mb-2 text-sm text-white/70">Login FTP</div>
                    <input
                      value={form.ftpUsername}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          ftpUsername: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-[#7aa333]/50"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm text-white/70">Hasło FTP</div>
                    <input
                      type="password"
                      value={form.ftpPassword}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          ftpPassword: e.target.value,
                        }))
                      }
                      placeholder="Wpisz nowe hasło tylko jeśli chcesz je zmienić."
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-[#7aa333]/50"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm text-white/70">Katalog FTP</div>
                    <input
                      value={form.ftpRemotePath}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          ftpRemotePath: e.target.value,
                        }))
                      }
                      placeholder="/"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-[#7aa333]/50"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm text-white/70">Wzorzec pliku</div>
                    <input
                      value={form.expectedFilePattern}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          expectedFilePattern: e.target.value,
                        }))
                      }
                      placeholder="oferty_*.zip"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-[#7aa333]/50"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveIntegration}
                disabled={saving}
                className="inline-flex rounded-full bg-[#7aa333] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Zapisywanie..." : "Zapisz konfigurację"}
              </button>

              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing || !canSync}
                className="inline-flex rounded-full border border-[#7aa333]/35 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:border-[#7aa333]/60 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {syncing ? "Synchronizacja..." : "Synchronizuj teraz"}
              </button>

              <button
                type="button"
                onClick={handleDeleteIntegration}
                disabled={deleteLoading}
                className="inline-flex rounded-full border border-red-500/35 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteLoading ? "Usuwanie..." : "Usuń integrację"}
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
                Brak logów.
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
        </>
      )}
    </div>
  );
}