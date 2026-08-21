import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

/* Wizytówki biur — lista kont. Sama lista adresów, bez formularzy: edycja siedzi
 * na osobnej stronie /admin/wizytowki/[userId], żeby ten ekran dało się przejrzeć
 * wzrokiem. Lista obejmuje WSZYSTKIE konta, bo świeżo założone konto partnera
 * (jeszcze przed pierwszym importem) to ten przypadek, w którym wizytówkę chcemy
 * przygotować najwcześniej. Kto ją dostanie, decydujemy ręcznie. */
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

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
      defaultBiuroNazwa: true,
      biuroWizytowkaOn: true,
      biuroSlug: true,
      _count: { select: { dzialki: true } },
    },
  });

  // Włączone na górze, potem najwięksi dostawcy podaży — kolejność, w której realnie
  // podejmuje się decyzję „komu następnemu".
  const rows = users.sort(
    (a, b) =>
      Number(b.biuroWizytowkaOn) - Number(a.biuroWizytowkaOn) ||
      b._count.dzialki - a._count.dzialki ||
      (a.email || "").localeCompare(b.email || "", "pl")
  );

  const wlaczone = rows.filter((r) => r.biuroWizytowkaOn).length;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14 md:px-10">
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
          mailem.
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
            placeholder="Szukaj po e-mailu lub nazwie biura"
            className="h-11 w-full rounded-xl border border-fg/12 bg-surface-2 px-3 text-[14px] text-fg outline-none transition placeholder:text-fg/40 focus:border-brand/60"
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

      <div className="border-t border-fg/10">
        {rows.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-fg/10 py-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[15px] text-fg/90">{u.email || u.id}</span>

                {u.biuroWizytowkaOn ? (
                  <span className="inline-flex rounded-full bg-brand/20 px-3 py-1 text-[11px] font-semibold text-brand-bright">
                    Wizytówka
                  </span>
                ) : null}
              </div>

              <div className="mt-1 text-[13px] text-fg/50">
                {u.defaultBiuroNazwa ? `${u.defaultBiuroNazwa} · ` : ""}
                {u._count.dzialki} {u._count.dzialki === 1 ? "oferta" : "ofert"}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-5">
              {u.biuroWizytowkaOn && u.biuroSlug ? (
                <Link
                  href={`/biuro/${u.biuroSlug}`}
                  target="_blank"
                  className="text-[13px] text-fg/60 underline decoration-fg/20 underline-offset-8 transition hover:text-fg"
                >
                  Podejrzyj
                </Link>
              ) : null}

              <Link
                href={`/admin/wizytowki/${u.id}`}
                className="inline-flex h-10 items-center rounded-xl border border-brand/30 bg-brand/10 px-4 text-[13px] font-medium text-fg transition hover:border-brand hover:bg-brand/15"
              >
                {u.biuroWizytowkaOn ? "Edytuj wizytówkę" : "Utwórz wizytówkę"}
              </Link>
            </div>
          </div>
        ))}

        {rows.length === 0 ? (
          <p className="py-6 text-[15px] text-fg/60">Nie znaleziono kont dla „{q}”.</p>
        ) : null}
      </div>
    </main>
  );
}
