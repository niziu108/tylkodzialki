"use client";

import { useState } from "react";

export default function CrmTestButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleCreateIntegration() {
    try {
      setLoading(true);
      setResult(null);

      const res = await fetch("/api/crm/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test CRM",
          provider: "GENERIC",
        }),
      });

      const data = await res.json();

      setResult(JSON.stringify({ status: res.status, data }, null, 2));
    } catch (error) {
      console.error(error);
      setResult("Błąd requesta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleCreateIntegration}
        disabled={loading}
        className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#7aa333]/45 bg-white/[0.03] px-7 py-3 text-center text-[13px] font-semibold uppercase tracking-[0.16em] text-white transition hover:border-[#7aa333] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Tworzenie..." : "Podłącz CRM (TEST)"}
      </button>

      {result ? (
        <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-[#d9d9d9]">
          {result}
        </pre>
      ) : null}
    </div>
  );
}