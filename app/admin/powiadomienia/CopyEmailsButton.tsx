"use client";

import { useState } from "react";

/**
 * Kopiuje unikalne adresy z aktualnie widocznej listy (po filtrach), rozdzielone przecinkiem.
 * Sens: filtrujesz „Bełchatów + aktywne", kopiujesz i masz gotową grupę do rozmowy z biurem
 * albo do maila. Bez tego trzeba by przepisywać adresy z ekranu.
 */
export default function CopyEmailsButton({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);

  const unique = Array.from(new Set(emails.filter((e) => e.includes("@"))));

  async function copy() {
    try {
      await navigator.clipboard.writeText(unique.join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={unique.length === 0}
      className="inline-flex h-10 items-center justify-center rounded-full border border-fg/12 bg-fg/[0.03] px-5 text-sm font-semibold text-fg/75 transition hover:border-fg/25 hover:text-fg disabled:opacity-40"
    >
      {copied ? "Skopiowano" : `Kopiuj adresy (${unique.length})`}
    </button>
  );
}
