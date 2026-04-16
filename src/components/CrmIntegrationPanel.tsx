"use client";

import { useMemo, useState } from "react";
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

  const currentIntegration = createdIntegration ?? integration;

  const maskedKey = useMemo(() => {
    if (!currentIntegration) return null;
    return `${currentIntegration.apiKeyPrefix}••••••••${currentIntegration.apiKeyLast4}`;
  }, [currentIntegration]);

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
              biuro nieruchomości będzie mogło automatycznie przesyłać oferty do
              TylkoDziałki bez ręcznego dodawania każdej działki osobno.
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
                Twoja integracja jest już gotowa. Możesz przekazać klucz API do
                podłączenia CRM i w przyszłości śledzić tutaj status synchronizacji,
                błędy oraz logi importów.
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
              Integracja została przygotowana poprawnie. W kolejnych krokach
              dodamy regenerację klucza, logi synchronizacji oraz instrukcję
              podłączenia CRM.
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
      )}
    </div>
  );
}