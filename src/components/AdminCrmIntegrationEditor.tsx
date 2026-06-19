"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Integration = {
  id: string;
  name: string;
  provider: "GENERIC" | "ASARI" | "ESTI_CRM" | "IMOX" | "GALACTICA";
  isActive: boolean;
  transportType: "API" | "FTP";
  feedFormat: "DOMY_PL" | "EBIURO_V2" | "ESTICRM_XML";
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
      "Czy na pewno chcesz usunąć integrację CRM? Spowoduje to usunięcie integracji oraz wyłączenie wszystkich ofert powiązanych z tym eksportem CRM (znikną z wyszukiwarki). Oferty innych biur nie zostaną ruszone."
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
        <div className="rounded-2xl border border-brand/20 bg-brand/10 px-4 py-3 text-sm leading-6 text-brand-text">
          {resultSuccess}
        </div>
      ) : null}

      {resultError ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
          {resultError}
        </div>
      ) : null}

      {!currentIntegration ? (
        <div className="rounded-[28px] border border-fg/10 bg-fg/[0.03] p-8 md:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-bright">
              Brak integracji
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-fg">
              Konfiguracja CRM dla użytkownika
            </h2>

            <p className="mt-3 leading-7 text-fg/65">
              Użytkownik: <span className="text-fg">{userLabel}</span>
            </p>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleCreateIntegration}
                disabled={loading}
                className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Tworzenie..." : "Utwórz integrację FTP"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-[28px] border border-fg/10 bg-fg/[0.03] p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-bright">
                  CRM użytkownika
                </div>

                <h2 className="mt-4 text-2xl font-semibold text-fg">
                  Konfiguracja integracji CRM
                </h2>

                <p className="mt-3 leading-7 text-fg/65">
                  Użytkownik: <span className="text-fg">{userLabel}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-fg/10 bg-surface px-4 py-3 text-sm">
                <div className="text-fg/45">Status</div>
                <div
                  className={`mt-1 font-semibold ${
                    currentIntegration.isActive
                      ? "text-brand-bright"
                      : "text-red-300"
                  }`}
                >
                  {currentIntegration.isActive ? "Aktywna" : "Wyłączona"}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-fg/10 bg-surface p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-fg/45">
                  Ostatnia synchronizacja
                </div>
                <div className="mt-2 text-base font-semibold text-fg">
                  {formatDate(currentIntegration.lastSyncAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-fg/10 bg-surface p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-fg/45">
                  Ostatni sukces
                </div>
                <div className="mt-2 text-base font-semibold text-fg">
                  {formatDate(currentIntegration.lastSuccessAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-fg/10 bg-surface p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-fg/45">
                  Ostatnio zaimportowano
                </div>
                <div className="mt-2 text-2xl font-semibold text-fg">
                  {currentIntegration.lastImportedOffers}
                </div>
              </div>

              <div className="rounded-2xl border border-fg/10 bg-surface p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-fg/45">
                  Błędy
                </div>
                <div className="mt-2 text-2xl font-semibold text-fg">
                  {currentIntegration.lastErrorCount}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-fg/10 bg-surface p-5">
                <div className="text-sm font-semibold text-fg">
                  Ustawienia ogólne
                </div>

                <div className="mt-4 space-y-4">
                  <label className="block">
                    <div className="mb-2 text-sm text-fg/70">Nazwa integracji</div>
                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-fg/10 bg-fg/[0.04] px-4 py-3 text-fg outline-none transition focus:border-brand/50"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm text-fg/70">Provider</div>
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
                      className="w-full rounded-2xl border border-fg/10 bg-surface px-4 py-3 text-fg outline-none transition focus:border-brand/50"
                    >
                      <option value="GALACTICA">GALACTICA</option>
                      <option value="GENERIC">GENERIC</option>
                      <option value="ASARI">ASARI</option>
                      <option value="ESTI_CRM">ESTI_CRM</option>
                      <option value="IMOX">IMOX</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-fg/10 bg-fg/[0.03] px-4 py-3">
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
                    <span className="text-sm text-fg">Integracja aktywna</span>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-fg/10 bg-fg/[0.03] px-4 py-3">
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
                    <span className="text-sm text-fg">
                      Pełny import (oferty, których nie ma w eksporcie, są kończone)
                    </span>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-fg/10 bg-surface p-5">
                <div className="text-sm font-semibold text-fg">
                  Połączenie FTP
                </div>

                <div className="mt-4 space-y-4">
                  <label className="block">
                    <div className="mb-2 text-sm text-fg/70">Host FTP</div>
                    <input
                      value={form.ftpHost}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, ftpHost: e.target.value }))
                      }
                      placeholder="ftp.twojadomena.pl"
                      className="w-full rounded-2xl border border-fg/10 bg-fg/[0.04] px-4 py-3 text-fg outline-none transition focus:border-brand/50"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm text-fg/70">Port FTP</div>
                      <input
                        value={form.ftpPort}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, ftpPort: e.target.value }))
                        }
                        placeholder="21"
                        className="w-full rounded-2xl border border-fg/10 bg-fg/[0.04] px-4 py-3 text-fg outline-none transition focus:border-brand/50"
                      />
                    </label>

                    <label className="flex items-end gap-3 rounded-2xl border border-fg/10 bg-fg/[0.03] px-4 py-3">
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
                      <span className="text-sm text-fg">Tryb pasywny FTP</span>
                    </label>
                  </div>

                  <label className="block">
                    <div className="mb-2 text-sm text-fg/70">Login FTP</div>
                    <input
                      value={form.ftpUsername}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          ftpUsername: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-fg/10 bg-fg/[0.04] px-4 py-3 text-fg outline-none transition focus:border-brand/50"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm text-fg/70">Hasło FTP</div>
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
                      className="w-full rounded-2xl border border-fg/10 bg-fg/[0.04] px-4 py-3 text-fg outline-none transition focus:border-brand/50"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm text-fg/70">Katalog FTP</div>
                    <input
                      value={form.ftpRemotePath}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          ftpRemotePath: e.target.value,
                        }))
                      }
                      placeholder="/"
                      className="w-full rounded-2xl border border-fg/10 bg-fg/[0.04] px-4 py-3 text-fg outline-none transition focus:border-brand/50"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm text-fg/70">Wzorzec pliku</div>
                    <input
                      value={form.expectedFilePattern}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          expectedFilePattern: e.target.value,
                        }))
                      }
                      placeholder="oferty_*.zip"
                      className="w-full rounded-2xl border border-fg/10 bg-fg/[0.04] px-4 py-3 text-fg outline-none transition focus:border-brand/50"
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
                className="inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Zapisywanie..." : "Zapisz konfigurację"}
              </button>

              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing || !canSync}
                className="inline-flex rounded-full border border-brand/35 bg-fg/[0.03] px-5 py-3 text-sm font-semibold text-fg transition hover:border-brand/60 hover:bg-fg/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
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

          <div className="rounded-[28px] border border-fg/10 bg-fg/[0.03] p-8 md:p-10">
            <div className="inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-bright">
              Logi synchronizacji
            </div>

            <h3 className="mt-4 text-2xl font-semibold text-fg">
              Ostatnie zdarzenia CRM
            </h3>

            {logsLoading ? (
              <div className="mt-5 text-sm text-fg/60">Ładowanie logów...</div>
            ) : logsError ? (
              <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {logsError}
              </div>
            ) : logs.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-fg/10 bg-surface p-4 text-sm text-fg/65">
                Brak logów.
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-2xl border border-fg/10">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-fg/10 bg-surface text-left text-fg/50">
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
                          className="border-b border-fg/5 bg-fg/[0.02] hover:bg-fg/[0.04]"
                        >
                          <td className="px-4 py-3 text-fg/70">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-fg">{log.action}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                log.status === "SUCCESS"
                                  ? "bg-brand/20 text-brand-bright"
                                  : "bg-red-500/15 text-red-300"
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-brand-text">
                            {log.externalId || "—"}
                          </td>
                          <td className="px-4 py-3 text-fg/75">
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