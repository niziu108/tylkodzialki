"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { zalozKontoBiuraAction, type KontoBiuraState } from "./actions";

const inputClass =
  "field-line w-full bg-transparent px-0 pb-2 text-[16px] text-fg outline-none placeholder:text-fg/30";

// Konto dla biura, które podłączamy sami (np. kliknęło nasz portal w CRM). Bez maila:
// zaproszenie wysyła się osobno, dopiero gdy działki są już na portalu.
export default function NoweKontoBiura() {
  const router = useRouter();
  const [state, action, pending] = useActionState<KontoBiuraState, FormData>(
    zalozKontoBiuraAction,
    null,
  );

  useEffect(() => {
    if (state?.userId && !state.error) router.push(`/admin/crm/${state.userId}`);
  }, [state, router]);

  return (
    <section className="mb-6 rounded-3xl border border-brand/25 bg-brand/[0.05] p-4 md:p-5">
      <h2 className="text-sm font-semibold text-fg">Załóż konto biura</h2>
      <p className="mt-1 max-w-3xl text-xs text-fg/60">
        Bez rejestracji i bez maila powitalnego. Po założeniu przejdziesz do konfiguracji CRM.
        Zaproszenie z linkiem do hasła wyślesz stamtąd, gdy działki będą już na portalu.
      </p>

      <form action={action} className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1.2fr_1fr_auto] md:items-end">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.14em] text-fg/60">E-mail biura</span>
          <input name="email" type="email" required className={inputClass} placeholder="biuro@domena.pl" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.14em] text-fg/60">Nazwa biura</span>
          <input name="nazwaBiura" required className={inputClass} placeholder="Nieruchomości Kowalski" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.14em] text-fg/60">Telefon (opcjonalnie)</span>
          <input name="telefon" type="tel" className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-brand/40 bg-brand/15 px-5 text-sm font-semibold text-fg transition hover:bg-brand/25 disabled:opacity-60"
        >
          {pending ? "Zakładam..." : "Załóż konto"}
        </button>
      </form>

      {state?.error ? (
        <p className="mt-3 text-sm text-red-300">
          {state.error}{" "}
          {state.userId ? (
            <Link href={`/admin/crm/${state.userId}`} className="underline">
              Przejdź do tego konta
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
