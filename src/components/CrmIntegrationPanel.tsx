"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Integration = {
  id: string;
  name: string;
  provider: "GENERIC" | "ASARI" | "ESTI_CRM" | "IMOX" | "GALACTICA";
  isActive: boolean;
  apiKeyPrefix: string;
  apiKeyLast4: string;
  lastUsedAt: string | Date | null;
  lastSyncAt: string | Date | null;
  lastSuccessAt: string | Date | null;
  lastErrorAt: string | Date | null;
  lastErrorMessage: string | null;
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

  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultSuccess, setResultSuccess] = useState<string | null>(null);
  const [createdIntegration, setCreatedIntegration] =
    useState<Integration>(integration);
  const [copied, setCopied] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<CrmLog[]>([]);

  const currentIntegration = createdIntegration ?? integration;

  const maskedKey = useMemo(() => {
    if (!currentIntegration) return null;
    return `${currentIntegration.apiKeyPrefix}••••••••${currentIntegration.apiKeyLast4}`;
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

        const res = await fetch("/api/crm/logs", {
          method: "GET",
          cache: "no-store",
        });

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

  async function handleCreateIntegration() {
    try {
      setLoading(true);
      setResultError(null);
      setResultSuccess(null);
      setCreatedKey(null);
      setCopied(false);

      const res = await fetch("/api/crm/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Moje CRM",
          provider: "GENERIC",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResultError(data?.error || "Nie udało się utworzyć integracji CRM.");
        return;
      }

      setCreatedIntegration(data.integration ?? null);
      setCreatedKey(data.apiKey ?? null);
      setResultSuccess("Integracja CRM została utworzona.");
      router.refresh();
    } catch (error) {
      console.error(error);
      setResultError("Wystąpił błąd podczas tworzenia integracji CRM.");
    } finally {
      setLoading(false);
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

      const res = await fetch(`/api/crm/integrations/${currentIntegration.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setResultError(data?.error || "Nie udało się usunąć integracji CRM.");
        return;
      }

      setCreatedIntegration(null);
      setCreatedKey(null);
      setCopied(false);
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

  async function handleCopyKey() {
    if (!createdKey) return;

    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (error) {
      console.error(error);
      setCopied(false);
    }
  }

  const pushExample = `fetch("https://tylkodzialki.pl/api/crm/push", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer TWOJ_KLUCZ_API"
  },
  body: JSON.stringify({
    externalId: "crm-001",
    crmOfferType: "DZIALKA",
    tytul: "Działka budowlana",
    opis: "Opis oferty",
    cenaPln: 199000,
    powierzchniaM2: 1200,
    telefon: "600700800",
    email: "biuro@twojafirma.pl",
    sprzedajacyTyp: "BIURO",
    biuroNazwa: "Twoje Biuro",
    biuroOpiekun: "Jan Kowalski",
    locationLabel: "Bełchatów",
    locationFull: "Bełchatów, łódzkie",
    locationMode: "APPROX",
    lat: 51.3689,
    lng: 19.3564,
    mapsUrl: "https://maps.google.com/?q=51.3689,19.3564",
    przeznaczenia: ["BUDOWLANA"],
    prad: "PRZYLACZE_W_DRODZE",
    woda: "WODOCIAG_W_DRODZE",
    kanalizacja: "BRAK",
    gaz: "BRAK",
    swiatlowod: "MOZLIWOSC_PODLACZENIA",
    mpzp: true,
    wzWydane: false,
    projektDomu: false,
    numerOferty: "CRM/001",
    zdjecia: [
      {
        url: "https://example.com/photo-1.jpg",
        publicId: "crm/photo-1",
        kolejnosc: 0
      }
    ]
  })
});`;

  const deactivateExample = `fetch("https://tylkodzialki.pl/api/crm/deactivate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer TWOJ_KLUCZ_API"
  },
  body: JSON.stringify({
    externalId: "crm-001"
  })
});`;

  return (
    <div className="space-y-6">
      {createdKey ? (
        <div className="rounded-[28px] border border-[#7aa333]/30 bg-[linear-gradient(180deg,rgba(122,163,51,0.12),rgba(255,255,255,0.03))] p-6 md:p-7">
          <div className="inline-flex rounded-full border border-[#7aa333]/30 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
            Klucz API gotowy
          </div>

          <h2 className="mt-4 text-2xl font-semibold text-white">
            Zapisz ten klucz API
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/65">
            Ten klucz pokazujemy tylko raz w całości. Skopiuj go teraz i zapisz
            w bezpiecznym miejscu. Później w panelu zobaczysz już tylko jego
            skróconą wersję.
          </p>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-sm text-[#dce9bf]">
            {createdKey}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopyKey}
              className="inline-flex rounded-full bg-[#7aa333] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
            >
              {copied ? "Skopiowano" : "Kopiuj klucz"}
            </button>

            <button
              type="button"
              onClick={() => setCreatedKey(null)}
              className="inline-flex rounded-full border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.05]"
            >
              Zamknij
            </button>
          </div>
        </div>
      ) : null}

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
              Podłącz integrację CRM
            </h2>

            <p className="mt-3 leading-7 text-white/65">
              Po utworzeniu integracji otrzymasz własny klucz API. Dzięki temu
              biuro nieruchomości będzie mogło automatycznie przesyłać oferty
              działek do TylkoDziałki.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Integracja
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  Bezpłatna
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Publikacje
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {paymentsEnabled ? "Zużywają kredyty" : "Obecnie darmowe"}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Aktualizacje
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  Bezpłatne
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleCreateIntegration}
                disabled={loading}
                className="inline-flex rounded-full bg-[#7aa333] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Tworzenie..." : "Podłącz CRM"}
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
                  Integracja aktywna
                </div>

                <h2 className="mt-4 text-2xl font-semibold text-white">
                  Zarządzaj integracją CRM
                </h2>

                <p className="mt-3 leading-7 text-white/65">
                  Tutaj masz wszystko, czego potrzebuje biuro albo programista:
                  status integracji, skrócony klucz API, endpointy, przykłady
                  requestów i logi synchronizacji.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <div className="text-white/45">Status</div>
                <div
                  className={`mt-1 font-semibold ${
                    currentIntegration.isActive ? "text-[#9fd14b]" : "text-red-300"
                  }`}
                >
                  {currentIntegration.isActive ? "Aktywna" : "Nieaktywna"}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Nazwa integracji
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {currentIntegration.name}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Provider
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {currentIntegration.provider}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Klucz API
                </div>
                <div className="mt-2 break-all font-mono text-sm text-[#dce9bf]">
                  {maskedKey}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Utworzono
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {formatDate(currentIntegration.createdAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Ostatnie użycie
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {formatDate(currentIntegration.lastUsedAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Ostatnia synchronizacja
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {formatDate(currentIntegration.lastSyncAt)}
                </div>
              </div>
            </div>

            {currentIntegration.lastErrorMessage ? (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="text-sm font-semibold text-red-200">
                  Ostatni błąd integracji
                </div>
                <div className="mt-2 text-sm leading-6 text-red-100/90">
                  {currentIntegration.lastErrorMessage}
                </div>
                <div className="mt-2 text-xs text-red-200/70">
                  {formatDate(currentIntegration.lastErrorAt)}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-[#7aa333]/20 bg-[#7aa333]/10 p-4 text-sm leading-6 text-[#dce9bf]">
                Integracja jest aktywna i gotowa do pracy. Programista po
                stronie biura może korzystać z instrukcji poniżej.
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
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
              Instrukcja API
            </div>

            <h3 className="mt-4 text-2xl font-semibold text-white">
              Jak podłączyć CRM
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Auth
                </div>
                <div className="mt-2 font-mono text-sm text-[#dce9bf]">
                  Authorization: Bearer TWOJ_KLUCZ_API
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Zasada
                </div>
                <div className="mt-2 text-sm leading-6 text-white/80">
                  `push` tworzy lub aktualizuje ofertę, a `deactivate` kończy
                  ofertę po externalId.
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-white">
                  Endpoint publikacji / aktualizacji
                </div>
                <div className="mt-2 font-mono text-sm text-[#dce9bf]">
                  POST /api/crm/push
                </div>

                <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-[#d9d9d9]">
{pushExample}
                </pre>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-white">
                  Endpoint zakończenia oferty
                </div>
                <div className="mt-2 font-mono text-sm text-[#dce9bf]">
                  POST /api/crm/deactivate
                </div>

                <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-[#d9d9d9]">
{deactivateExample}
                </pre>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/75">
              <div className="font-semibold text-white">Ważne zasady:</div>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Integracja przyjmuje tylko oferty typu działka.</li>
                <li>
                  Nowa publikacja zużywa publikację tylko wtedy, gdy płatności są
                  aktywne.
                </li>
                <li>Aktualizacje oferty nie zużywają publikacji.</li>
                <li>Zakończenie oferty nie zwraca publikacji.</li>
                <li>
                  Reactivate wcześniej zakończonej oferty zużywa nową publikację,
                  jeśli płatności są aktywne.
                </li>
                <li>
                  Aby wyświetlić mapę Google, warto przesyłać `lat`, `lng` i
                  `mapsUrl`.
                </li>
              </ul>
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
                Brak logów. Gdy CRM zacznie wysyłać oferty, zobaczysz tutaj historię
                publikacji, aktualizacji i błędów.
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
                          <td className="px-4 py-3 text-white">
                            {log.action}
                          </td>
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