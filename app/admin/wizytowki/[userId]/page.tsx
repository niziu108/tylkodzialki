import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import LogoPreview from "../../LogoPreview";
import { saveUserAgencyLogoAction } from "../../actions";
import { saveWizytowkaAction } from "../actions";

/* Edytor jednej wizytówki. Cała edycja siedzi tutaj, a nie na liście: lista ma się dać
 * przejrzeć wzrokiem, a to jest ekran, na którym się siedzi i uzupełnia dane od partnera. */
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ userId: string }>;
};

const INPUT =
  "h-11 w-full rounded-xl border border-fg/12 bg-surface-2 px-3 text-[14px] text-fg outline-none transition placeholder:text-fg/40 focus:border-brand/60";

const LABEL = "mb-2 block text-[13px] text-fg/60";

export default async function AdminWizytowkaEdytorPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!currentUser || currentUser.role !== "ADMIN") redirect("/");

  const { userId } = await params;

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      defaultBiuroNazwa: true,
      defaultBiuroLogoUrl: true,
      defaultBiuroLogoBg: true,
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

  if (!u) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14 md:px-10">
      <Link
        href="/admin/wizytowki"
        className="text-[13px] text-fg/60 underline decoration-fg/20 underline-offset-8 transition hover:text-fg"
      >
        Wróć do listy wizytówek
      </Link>

      <h1 className="mt-6 text-[24px] font-semibold tracking-tight text-fg md:text-[30px]">
        {u.defaultBiuroNazwa || u.email || u.id}
      </h1>

      <p className="mt-3 text-[14px] text-fg/60">
        {u.email} · {u._count.dzialki} {u._count.dzialki === 1 ? "oferta" : "ofert"}
        {u.name ? ` · konto założył(a): ${u.name}` : ""}
      </p>

      {/* Logo ma własny formularz, bo wgranie pliku to osobny zapis (ta sama akcja,
          co w panelu admina — jedno źródło prawdy dla logotypu konta). */}
      <form
        action={saveUserAgencyLogoAction}
        className="mt-8 rounded-3xl border border-fg/12 bg-surface p-6"
      >
        <input type="hidden" name="userId" value={u.id} />

        <div className={LABEL}>Logo biura</div>

        <input
          type="url"
          name="logoUrl"
          defaultValue={u.defaultBiuroLogoUrl || ""}
          placeholder="Adres URL logo albo wgraj plik poniżej"
          className={INPUT}
        />

        <input
          type="file"
          name="logoFile"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="mt-3 block w-full text-[13px] text-fg/70 file:mr-3 file:h-10 file:rounded-xl file:border-0 file:bg-fg/10 file:px-4 file:text-[13px] file:font-semibold file:text-fg hover:file:bg-fg/15"
        />

        {u.defaultBiuroLogoUrl ? (
          <div className="mt-4">
            <LogoPreview src={u.defaultBiuroLogoUrl} defaultGreen={u.defaultBiuroLogoBg} />
          </div>
        ) : (
          <p className="mt-4 text-[13px] leading-6 text-fg/55">
            To konto nie ma jeszcze logo. Wgraj plik (PNG, JPG, WEBP lub SVG, do 2 MB) albo
            wklej adres URL.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-[13px] text-red-300">
            <input type="checkbox" name="removeLogo" value="1" className="h-4 w-4 accent-brand" />
            Usuń logo
          </label>

          <button
            type="submit"
            className="h-10 shrink-0 rounded-xl border border-fg/15 bg-surface-2 px-5 text-[13px] font-medium text-fg transition hover:border-fg/35"
          >
            Zapisz logo
          </button>
        </div>
      </form>

      <form action={saveWizytowkaAction} className="mt-10">
        <input type="hidden" name="userId" value={u.id} />

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Nazwa biura (widoczna na wizytówce)</span>
            <input
              type="text"
              name="nazwa"
              defaultValue={u.defaultBiuroNazwa || ""}
              placeholder="np. RE/MAX Polska"
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className={LABEL}>Adres wizytówki (puste = z nazwy biura)</span>
            <input
              type="text"
              name="slug"
              defaultValue={u.biuroSlug || ""}
              placeholder="np. remax-polska"
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className={LABEL}>Telefon</span>
            <input
              type="text"
              name="telefon"
              defaultValue={u.biuroTelefon || ""}
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className={LABEL}>E-mail</span>
            <input
              type="text"
              name="email"
              defaultValue={u.biuroEmail || ""}
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className={LABEL}>Strona www</span>
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
              <span className={LABEL}>Na rynku od</span>
              <input
                type="text"
                name="rokZalozenia"
                defaultValue={u.biuroRokZalozenia ?? ""}
                placeholder="1999"
                className={INPUT}
              />
            </label>

            <label className="block">
              <span className={LABEL}>Oddziały</span>
              <input
                type="text"
                name="liczbaOddzialow"
                defaultValue={u.biuroLiczbaOddzialow ?? ""}
                className={INPUT}
              />
            </label>
          </div>
        </div>

        <label className="mt-6 block">
          <span className={LABEL}>Opis biura (pusty wiersz rozdziela akapity)</span>
          <textarea
            name="opis"
            rows={7}
            defaultValue={u.biuroOpis || ""}
            placeholder="Trzy do pięciu zdań, w formie przekazanej przez biuro."
            className="w-full rounded-xl border border-fg/12 bg-surface-2 px-3 py-3 text-[14px] leading-6 text-fg outline-none transition placeholder:text-fg/40 focus:border-brand/60"
          />
        </label>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-fg/10 pt-6">
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

        <p className="mt-4 text-[12px] leading-6 text-fg/50">
          Dopóki pole „Wizytówka włączona” jest odznaczone, strona nie istnieje: dane możesz
          spokojnie uzupełniać wcześniej i włączyć ją dopiero po akceptacji biura.
        </p>
      </form>
    </main>
  );
}
