"use client";

import { useActionState } from "react";
import { wyslijZaproszenieBiuraAction, type ZaproszenieState } from "../actions";

export default function ZaproszenieBiura({
  userId,
  email,
  maHaslo,
  liczbaDzialek,
  zaproszenieWazneDo,
}: {
  userId: string;
  email: string | null;
  maHaslo: boolean;
  liczbaDzialek: number;
  zaproszenieWazneDo: string | null;
}) {
  const [state, action, pending] = useActionState<ZaproszenieState, FormData>(
    wyslijZaproszenieBiuraAction,
    null,
  );

  // Konto z hasłem = biuro zarejestrowało się samo albo już przyjęło zaproszenie. Nic do zrobienia.
  if (maHaslo) return null;

  const mozna = liczbaDzialek > 0;

  return (
    <section className="mb-6 rounded-3xl border border-sky-400/25 bg-sky-400/[0.05] p-4 md:p-5">
      <h2 className="text-sm font-semibold text-fg">Zaproszenie dla biura</h2>
      <p className="mt-1 max-w-3xl text-xs text-fg/60">
        Konto założone przez admina, biuro nie ma jeszcze hasła. Mail „Twoje działki są już na
        tylkodzialki.pl&rdquo; z liczbą działek i linkiem do ustawienia hasła (ważny 14 dni) pójdzie na{" "}
        <span className="text-fg">{email}</span>.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="text-sm">
          Aktywne działki: <span className="font-semibold text-fg">{liczbaDzialek}</span>
        </div>
        {zaproszenieWazneDo ? (
          <div className="text-xs text-fg/60">
            Link do hasła wysłany, ważny do {zaproszenieWazneDo}
          </div>
        ) : null}

        <form
          action={action}
          onSubmit={(e) => {
            if (!window.confirm(`Wysłać zaproszenie na ${email}?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            disabled={pending || !mozna}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-brand/40 bg-brand/15 px-5 text-sm font-semibold text-fg transition hover:bg-brand/25 disabled:opacity-50"
          >
            {pending ? "Wysyłam..." : zaproszenieWazneDo ? "Wyślij ponownie" : "Wyślij zaproszenie"}
          </button>
        </form>
      </div>

      {!mozna ? (
        <p className="mt-3 text-xs text-fg/60">
          Przycisk ruszy po pierwszym imporcie z CRM. Mail ma sens dopiero, gdy biuro zobaczy w nim
          swoje działki.
        </p>
      ) : null}
      {state?.error ? <p className="mt-3 text-sm text-red-300">{state.error}</p> : null}
      {state?.ok ? <p className="mt-3 text-sm text-brand-bright">{state.ok}</p> : null}
    </section>
  );
}
