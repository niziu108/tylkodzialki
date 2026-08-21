import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import { saveWizytowkaAction } from "./actions";

/* Wizytówki biur — panel admina. Lista obejmuje WSZYSTKIE konta, bez filtrowania po
 * nazwie biura czy liczbie ofert: świeżo założone konto partnera (jeszcze bez importu)
 * to dokładnie ten przypadek, w którym wizytówkę chcemy przygotować najwcześniej.
 * Kto ją dostanie, decydujemy tu ręcznie — to karta partnerska, nie katalog biur. */
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

const INPUT =
  "h-11 w-full rounded-xl border border-fg/12 bg-surface-2 px-3 text-[14px] text-fg outline-none transition placeholder:text-fg/40 focus:border-brand/60";

export default async function AdminWizytowkiPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!currentUser || currentUser.role !== "ADMIN") redirect("/");

  const sp = (await searchParams) ?? {};
  const q = one(sp.q).trim();

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { defaultBiuroNazwa: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true,
      email: true,
      name: true,
      defaultBiuroNazwa: true,
      biuroWizytowkaOn: true,
      biuroSlug: true,
      biuroOpis: true,
      biuroTelefon: true,
      biuroEmail: true,
      biuroWww: true,
      biuroRokZalozenia: true,
      biuroLiczbaOddzialow: true,
      _count: { select: { dzialki: true } },
    },
  });

  // Włączone na górze, potem najwięksi dostawcy podaży — czyli kolejność, w której
  // realnie podejmujesz decyzję „komu następnemu".
  const rows = users.sort(
    (a, b) =>
      Number(b.biuroWizytowkaOn) - Number(a.biuroWizytowkaOn) ||
      b._count.dzialki - a._count.dzialki ||
      (a.defaultBiuroNazwa || a.email || "").localeCompare(
        b.defaultBiuroNazwa || b.email || "",
        "pl"
      )
  );

  const wlaczone = rows.filter((r) => r.biuroWizytowkaOn).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14 md:px-10">
      <div className="mb-10">
        <Link
          href="/admin"
          className="text-[13px] text-fg/60 underline decoration-fg/20 underline-offset-8 transition hover:text-fg"
        >
          Wróć do panelu
        </Link>

        <h1 className="mt-6 text-[26px] font-semibold tracking-tight text-fg md:text-[32px]">
          Wizytówki biur
        </h1>

        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-fg/68">
          Karta partnerska. Wizytówka nie jest linkowana z nawigacji ani z sitemapy: wchodzi
          się na nią wyłącznie z ogłoszenia biura. Edytujemy ją tylko my, biuro zgłasza zmiany
          mailem. Rozwiń konto, uzupełnij dane i zaznacz pole „Wizytówka włączona”.
        </p>

        <p className="mt-3 text-[13px] text-fg/55">
          Włączone: {wlaczone} z {rows.length}
          {q ? " znalezionych kont" : " kont"}.
        </p>

        <form method="get" className="mt-6 flex gap-3">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Szukaj po nazwie biura, e-mailu lub nazwie konta"
            className={INPUT}
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-xl border border-fg/12 bg-surface-2 px-5 text-[14px] font-medium text-fg transition hover:border-fg/30"
          >
            Szukaj
          </button>
          {q ? (
            <Link
              href="/admin/wizytowki"
              className="inline-flex h-11 shrink-0 items-center rounded-xl px-3 text-[13px] text-fg/60 transition hover:text-fg"
            >
              Wyczyść
            </Link>
          ) : null}
        </form>
      </div>

      <div className="space-y-3">
        {rows.map((u) => {
          const nazwa = u.defaultBiuroNazwa || u.name || u.email || u.id;

          return (
            <details
              key={u.id}
              className="group rounded-3xl border border-fg/12 bg-surface"
              open={u.biuroWizytowkaOn && !!q}
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-6 py-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[16px] font-semibold text-fg">{nazwa}</span>

                    {u.biuroWizytowkaOn ? (
                      <span className="inline-flex rounded-full bg-brand/20 px-3 py-1 text-[11px] font-semibold text-brand-bright">
                        Wizytówka włączona
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 text-[13px] text-fg/55">
                    {u.email} · {u._count.dzialki}{" "}
                    {u._count.dzialki === 1 ? "oferta" : "ofert"}
                  </div>
                </div>

                <span className="text-[13px] text-fg/45 transition group-open:hidden">
                  Rozwiń
                </span>
                <span className="hidden text-[13px] text-fg/45 group-open:inline">Zwiń</span>
              </summary>

              <form action={saveWizytowkaAction} className="border-t border-fg/10 px-6 py-6">
                <input type="hidden" name="userId" value={u.id} />
                {q ? <input type="hidden" name="q" value={q} /> : null}

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[13px] text-fg/60">
                      Nazwa biura (widoczna na wizytówce)
                    </span>
                    <input
                      type="text"
                      name="nazwa"
                      defaultValue={u.defaultBiuroNazwa || ""}
                      placeholder="np. RE/MAX Polska"
                      className={INPUT}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[13px] text-fg/60">
                      Adres wizytówki (puste = z nazwy biura)
                    </span>
                    <input
                      type="text"
                      name="slug"
                      defaultValue={u.biuroSlug || ""}
                      placeholder="np. remax-polska"
                      className={INPUT}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[13px] text-fg/60">Telefon</span>
                    <input
                      type="text"
                      name="telefon"
                      defaultValue={u.biuroTelefon || ""}
                      className={INPUT}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[13px] text-fg/60">E-mail</span>
                    <input
                      type="text"
                      name="email"
                      defaultValue={u.biuroEmail || ""}
                      className={INPUT}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[13px] text-fg/60">Strona www</span>
                    <input
                      type="text"
                      name="www"
                      defaultValue={u.biuroWww || ""}
                      placeholder="remax-polska.pl"
                      className={INPUT}
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-5">
                    <label className="block">
                      <span className="mb-2 block text-[13px] text-fg/60">Na rynku od</span>
                      <input
                        type="text"
                        name="rokZalozenia"
                        defaultValue={u.biuroRokZalozenia ?? ""}
                        placeholder="1999"
                        className={INPUT}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[13px] text-fg/60">Oddziały</span>
                      <input
                        type="text"
                        name="liczbaOddzialow"
                        defaultValue={u.biuroLiczbaOddzialow ?? ""}
                        className={INPUT}
                      />
                    </label>
                  </div>
                </div>

                <label className="mt-5 block">
                  <span className="mb-2 block text-[13px] text-fg/60">
                    Opis biura (pusty wiersz rozdziela akapity)
                  </span>
                  <textarea
                    name="opis"
                    rows={5}
                    defaultValue={u.biuroOpis || ""}
                    className="w-full rounded-xl border border-fg/12 bg-surface-2 px-3 py-3 text-[14px] leading-6 text-fg outline-none transition focus:border-brand/60"
                  />
                </label>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-fg/10 pt-5">
                  <label className="flex items-center gap-2 text-[14px] text-fg/85">
                    <input
                      type="checkbox"
                      name="wizytowkaOn"
                      value="1"
                      defaultChecked={u.biuroWizytowkaOn}
                      className="h-4 w-4 accent-brand"
                    />
                    Wizytówka włączona
                  </label>

                  <div className="flex items-center gap-5">
                    {u.biuroWizytowkaOn && u.biuroSlug ? (
                      <Link
                        href={`/biuro/${u.biuroSlug}`}
                        target="_blank"
                        className="text-[13px] font-medium text-brand-text underline decoration-brand/40 underline-offset-8 transition hover:decoration-brand"
                      >
                        Podejrzyj
                      </Link>
                    ) : null}

                    <button
                      type="submit"
                      className="h-11 shrink-0 rounded-xl border border-brand/30 bg-brand/10 px-6 text-[14px] font-medium text-fg transition hover:border-brand hover:bg-brand/15"
                    >
                      Zapisz
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-[12px] text-fg/50">
                  Logo bierzemy z ustawień konta w panelu admina.
                </p>
              </form>
            </details>
          );
        })}

        {rows.length === 0 ? (
          <p className="text-[15px] text-fg/60">Nie znaleziono kont dla „{q}”.</p>
        ) : null}
      </div>
    </main>
  );
}
