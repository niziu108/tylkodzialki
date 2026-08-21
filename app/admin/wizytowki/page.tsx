import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import { saveWizytowkaAction } from "./actions";

/* Wizytówki biur — panel admina. Świadomie NIE jest to katalog: wizytówkę włączamy
 * ręcznie wybranym partnerom z realną liczbą ofert i tylko my ją edytujemy.
 * Biuro chce zmianę w opisie albo logo — pisze do nas. */
export const dynamic = "force-dynamic";

/** Konta poniżej tego progu ofert nie są kandydatem na wizytówkę i nie zaśmiecają listy. */
const MIN_OFERT = 1;

export default async function AdminWizytowkiPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!currentUser || currentUser.role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({
    where: {
      OR: [{ defaultBiuroNazwa: { not: null } }, { biuroWizytowkaOn: true }],
    },
    select: {
      id: true,
      email: true,
      defaultBiuroNazwa: true,
      defaultBiuroLogoUrl: true,
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

  const rows = users
    .filter((u) => u.biuroWizytowkaOn || u._count.dzialki >= MIN_OFERT)
    .sort(
      (a, b) =>
        Number(b.biuroWizytowkaOn) - Number(a.biuroWizytowkaOn) ||
        b._count.dzialki - a._count.dzialki
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
          Karta partnerska dla biur z realną liczbą ofert, nie funkcja dla każdego konta.
          Wizytówka nie jest linkowana z nawigacji ani z sitemapy: wchodzi się na nią wyłącznie
          z ogłoszenia biura. Edytujemy ją tylko my, biuro zgłasza zmiany mailem.
        </p>

        <p className="mt-3 text-[13px] text-fg/55">
          Włączone: {wlaczone} z {rows.length} kont biur.
        </p>
      </div>

      <div className="space-y-5">
        {rows.map((u) => (
          <form
            key={u.id}
            action={saveWizytowkaAction}
            className="rounded-3xl border border-fg/12 bg-surface p-6"
          >
            <input type="hidden" name="userId" value={u.id} />

            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-fg/10 pb-5">
              <div className="min-w-0">
                <div className="text-[17px] font-semibold text-fg">
                  {u.defaultBiuroNazwa || u.email || u.id}
                </div>
                <div className="mt-1 text-[13px] text-fg/55">
                  {u.email} · {u._count.dzialki}{" "}
                  {u._count.dzialki === 1 ? "oferta" : "ofert"}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {u.biuroWizytowkaOn && u.biuroSlug ? (
                  <Link
                    href={`/biuro/${u.biuroSlug}`}
                    target="_blank"
                    className="text-[13px] font-medium text-brand-text underline decoration-brand/40 underline-offset-8 transition hover:decoration-brand"
                  >
                    Podejrzyj
                  </Link>
                ) : null}

                <label className="flex items-center gap-2 text-[13px] text-fg/85">
                  <input
                    type="checkbox"
                    name="wizytowkaOn"
                    value="1"
                    defaultChecked={u.biuroWizytowkaOn}
                    className="h-4 w-4 accent-brand"
                  />
                  Wizytówka włączona
                </label>
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[13px] text-fg/60">
                  Adres wizytówki (puste = z nazwy biura)
                </span>
                <input
                  type="text"
                  name="slug"
                  defaultValue={u.biuroSlug || ""}
                  placeholder="np. remax-polska"
                  className="h-11 w-full rounded-xl border border-fg/12 bg-surface-2 px-3 text-[14px] text-fg outline-none transition placeholder:text-fg/40 focus:border-brand/60"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] text-fg/60">Telefon</span>
                <input
                  type="text"
                  name="telefon"
                  defaultValue={u.biuroTelefon || ""}
                  className="h-11 w-full rounded-xl border border-fg/12 bg-surface-2 px-3 text-[14px] text-fg outline-none transition focus:border-brand/60"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] text-fg/60">E-mail</span>
                <input
                  type="text"
                  name="email"
                  defaultValue={u.biuroEmail || ""}
                  className="h-11 w-full rounded-xl border border-fg/12 bg-surface-2 px-3 text-[14px] text-fg outline-none transition focus:border-brand/60"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] text-fg/60">Strona www</span>
                <input
                  type="text"
                  name="www"
                  defaultValue={u.biuroWww || ""}
                  placeholder="remax-polska.pl"
                  className="h-11 w-full rounded-xl border border-fg/12 bg-surface-2 px-3 text-[14px] text-fg outline-none transition placeholder:text-fg/40 focus:border-brand/60"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] text-fg/60">Na rynku od (rok)</span>
                <input
                  type="text"
                  name="rokZalozenia"
                  defaultValue={u.biuroRokZalozenia ?? ""}
                  placeholder="1999"
                  className="h-11 w-full rounded-xl border border-fg/12 bg-surface-2 px-3 text-[14px] text-fg outline-none transition placeholder:text-fg/40 focus:border-brand/60"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] text-fg/60">Liczba oddziałów</span>
                <input
                  type="text"
                  name="liczbaOddzialow"
                  defaultValue={u.biuroLiczbaOddzialow ?? ""}
                  className="h-11 w-full rounded-xl border border-fg/12 bg-surface-2 px-3 text-[14px] text-fg outline-none transition focus:border-brand/60"
                />
              </label>
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

            <div className="mt-5 flex items-center justify-between gap-4">
              <span className="text-[12px] text-fg/50">
                Logo bierzemy z ustawień konta w panelu admina.
              </span>

              <button
                type="submit"
                className="h-11 shrink-0 rounded-xl border border-brand/30 bg-brand/10 px-6 text-[14px] font-medium text-fg transition hover:border-brand hover:bg-brand/15"
              >
                Zapisz
              </button>
            </div>
          </form>
        ))}

        {rows.length === 0 ? (
          <p className="text-[15px] text-fg/60">Brak kont biur z ofertami.</p>
        ) : null}
      </div>
    </main>
  );
}
