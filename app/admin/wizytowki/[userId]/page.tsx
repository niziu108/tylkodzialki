import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import LogoPreview from "../../LogoPreview";
import { saveUserAgencyLogoAction } from "../../actions";
import { saveWizytowkaAction, przyznajWyroznieniaAction } from "../actions";

/* Edytor jednej wizytówki. Cała edycja siedzi tutaj, a nie na liście: lista ma się dać
 * przejrzeć wzrokiem, a to jest ekran, na którym się siedzi i uzupełnia dane od partnera. */
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDatePL(d: Date) {
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const INPUT =
  "h-11 w-full rounded-xl border border-fg/12 bg-surface-2 px-3 text-[14px] text-fg outline-none transition placeholder:text-fg/40 focus:border-brand/60";

const LABEL = "mb-2 block text-[13px] text-fg/60";

export default async function AdminWizytowkaEdytorPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!currentUser || currentUser.role !== "ADMIN") redirect("/");

  const { userId } = await params;
  const sp = (await searchParams) ?? {};
  const statusWyroznien = Array.isArray(sp.wyroznienia) ? sp.wyroznienia[0] : sp.wyroznienia;

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
      biuroPartnerStrategiczny: true,
      biuroSlug: true,
      biuroOpis: true,
      biuroTelefon: true,
      biuroEmail: true,
      biuroAdres: true,
      biuroWww: true,
      biuroRokZalozenia: true,
      featuredCredits: true,
      featuredCreditsExpiresAt: true,
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
            <span className={LABEL}>Adres</span>
            <input
              type="text"
              name="adres"
              defaultValue={u.biuroAdres || ""}
              placeholder="ul. Przykładowa 1, Warszawa"
              className={INPUT}
            />
          </label>

          {/* Link wychodzący wypuszcza kupującego z portalu, więc nie jest standardem
              wizytówki: zostawiamy pole puste wszędzie poza partnerami, z którymi tak
              się umówiliśmy. Puste = na wizytówce nie ma wiersza „Strona". */}
          <label className="block">
            <span className={LABEL}>Strona www (opcjonalnie, link wychodzący)</span>
            <input
              type="text"
              name="www"
              defaultValue={u.biuroWww || ""}
              placeholder="polnoc.pl"
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

        {/* Status partnera to osobna decyzja od wizytówki: znak wychodzi poza wizytówkę,
            na wszystkie oferty biura, więc dostaje własną ramkę i własne ostrzeżenie. */}
        <div className="mt-8 rounded-2xl border border-brand/25 bg-brand/[0.06] p-5">
          <label className="flex items-start gap-3 text-[14px] text-fg/90">
            <input
              type="checkbox"
              name="partnerStrategiczny"
              value="1"
              defaultChecked={u.biuroPartnerStrategiczny}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>
              Partner strategiczny
              <span className="mt-1.5 block text-[12px] leading-6 text-fg/55">
                Znak pojawi się na wizytówce, przy każdej z {u._count.dzialki}{" "}
                {u._count.dzialki === 1 ? "oferty" : "ofert"} tego konta na liście wyników
                oraz na stronie każdego ogłoszenia. Nadawaj wyłącznie sieciom z realną
                podażą: rozdany szeroko przestaje cokolwiek znaczyć.
              </span>
            </span>
          </label>
        </div>

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

      {/* Wyróżnienia przyznane z ręki. Osobny formularz, bo to nie są dane wizytówki,
          tylko saldo konta: zapis ma działać niezależnie od tego, czy wizytówka w ogóle
          jest włączona. */}
      <form
        action={przyznajWyroznieniaAction}
        className="mt-10 rounded-3xl border border-fg/12 bg-surface p-6"
      >
        <input type="hidden" name="userId" value={u.id} />

        <h2 className="text-[16px] font-semibold tracking-tight text-fg">
          Wyróżnienia na koncie
        </h2>

        <p className="mt-2 text-[13px] leading-6 text-fg/60">
          Saldo:{" "}
          <span className="font-semibold text-fg">{u.featuredCredits}</span>
          {u.featuredCreditsExpiresAt ? (
            <>
              {" · ważne do "}
              <span className="font-semibold text-fg">
                {formatDatePL(u.featuredCreditsExpiresAt)}
              </span>
              {u.featuredCreditsExpiresAt.getTime() <= Date.now() ? (
                <span className="text-red-300"> (pakiet wygasł)</span>
              ) : null}
            </>
          ) : (
            " · bez daty ważności"
          )}
          . Jedno wyróżnienie to jedno ogłoszenie na 7 dni, biuro wydaje je samo w panelu.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Dodaj wyróżnień (ujemna liczba odbiera)</span>
            <input
              type="number"
              name="liczba"
              step="1"
              min="-500"
              max="500"
              placeholder="15"
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className={LABEL}>Ważność w dniach (puste = bez zmiany)</span>
            <input
              type="number"
              name="waznoscDni"
              step="1"
              min="1"
              max="3650"
              placeholder="90"
              className={INPUT}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[12px] leading-6 text-fg/50">
            {statusWyroznien === "ok"
              ? "Zapisano saldo wyróżnień."
              : statusWyroznien === "blad"
                ? "Nie zapisano: podaj liczbę różną od zera, najwyżej 500 na raz."
                : "Po dacie ważności punkty przestają się dać wydać."}
          </p>

          <button
            type="submit"
            className="h-11 shrink-0 rounded-xl border border-brand/30 bg-brand/10 px-6 text-[14px] font-medium text-fg transition hover:border-brand hover:bg-brand/15"
          >
            Zapisz wyróżnienia
          </button>
        </div>
      </form>
    </main>
  );
}
