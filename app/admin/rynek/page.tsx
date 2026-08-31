// /admin/rynek — dane rynkowe działek pod ręką: podaż, czas sprzedaży, ruchy cen.
//
// Strona jest do patrzenia i do robienia screenów na FB, dlatego tabele są szerokie, liczby duże,
// a każda sekcja mówi wprost, na ilu obserwacjach stoi. Tam, gdzie danych jeszcze za mało, zamiast
// mediany stoi „za mało danych". Świadomie: liczba wypuszczona za wcześnie wraca latami.
//
// Liczenie siedzi w src/lib/rynek.ts, historię epizodów zbiera src/lib/listing-spells.ts.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import {
  getRynekReport,
  MIN_OKNO_DNI,
  MIN_PROBA,
  type MedianaRow,
  type PodazRow,
} from "@/lib/rynek";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dane rynkowe",
  robots: { index: false, follow: false },
};

const num = new Intl.NumberFormat("pl-PL");
const num1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });

const pln = (v: number) => `${num.format(Math.round(v))} zł`;
const dni = (v: number) => `${num1.format(v)} dni`;
const dataPL = (d: Date) =>
  new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

const CARD = "rounded-3xl border border-fg/10 bg-fg/5";
const TH = "px-4 py-3 font-semibold";
const TD = "px-4 py-3";

export default async function AdminRynekPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }

  const report = await getRynekReport();
  const p = report.podsumowanie;

  return (
    <main className="min-h-screen bg-bg px-6 py-10 text-fg/85">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-sm font-semibold text-fg/60 no-underline transition hover:text-fg"
          >
            &larr; Wróć do admina
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
            Dane rynkowe
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-fg/70">
            Wszystko, co wiemy o rynku działek z własnej podaży. Podaż i ceny są kompletne od dziś.
            Czas sprzedaży i ruchy cen dopiero się zbierają, bo wymagają obserwacji tej samej oferty
            w czasie, i tego nie da się nadrobić wstecz.
          </p>
        </div>

        <section className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Kafel label="Ofert na portalu" value={num.format(p.aktywne)} />
          <Kafel label="Ofert w obserwacji" value={num.format(p.epizodyOtwarte)} />
          <Kafel label="Ofert już zeszło" value={num.format(p.epizodyZamkniete)} />
          <Kafel
            label="Zmierzonych czasów"
            value={num.format(p.obserwacje)}
            hint={`okno ${p.oknoDni} dni`}
            accent
          />
          <Kafel
            label="Historia cen"
            value={num.format(p.snapshotyDzialek)}
            hint={p.snapshotyOd ? `od ${dataPL(p.snapshotyOd)}` : "brak"}
          />
        </section>

        {/* 1. Podaż: dane kompletne, gotowe do publikacji */}
        <Sekcja
          tytul="Podaż i ceny wg województw"
          opis="Liczone na wszystkich aktywnych ofertach. Te dane są kompletne i nadają się na posta od ręki."
        >
          <TabelaPodaz rows={report.podaz} />
        </Sekcja>

        {/* 2. Czas sprzedaży: rdzeń moatu, na razie w budowie */}
        <Sekcja
          tytul="Czas sprzedaży działki"
          opis="Ile dni oferta wisi, zanim zejdzie z portalu. Liczymy wyłącznie oferty, które weszły i zeszły na naszych oczach, bez tych zastanych przy podłączaniu biura."
        >
          {report.czasSprzedazy.powod ? (
            <div className={`${CARD} p-6`}>
              <p className="text-sm text-fg/70">{report.czasSprzedazy.powod}</p>
              <p className="mt-3 text-xs text-fg/50">
                Zegar ruszył 18.08.2026, od naprawy sygnału zdejmowania ofert. Do wiarygodnej
                mediany potrzeba {MIN_PROBA} zamkniętych ofert i {MIN_OKNO_DNI} dni obserwacji.
                Zebrane dotąd: {report.czasSprzedazy.n} ofert, {p.oknoDni} dni.
              </p>
              {report.czasSprzedazy.n > 0 && (
                <p className="mt-3 text-xs text-fg/40">
                  Podgląd roboczy (nie na posta): mediana z tego, co już jest, to{" "}
                  {report.czasSprzedazy.surowa === null
                    ? "brak"
                    : dni(report.czasSprzedazy.surowa)}
                  .
                </p>
              )}
            </div>
          ) : (
            <div className={`${CARD} mb-4 p-6`}>
              <div className="text-4xl font-semibold text-fg">
                {dni(report.czasSprzedazy.ogolem!)}
              </div>
              <p className="mt-2 text-sm text-fg/60">
                Mediana czasu sprzedaży działki, {num.format(report.czasSprzedazy.n)} obserwacji.
              </p>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TabelaMediana
              tytul="Wg ceny oferty"
              kolumna="Przedział"
              rows={report.czasSprzedazy.wgCeny}
            />
            <TabelaMediana
              tytul="Wg powierzchni"
              kolumna="Przedział"
              rows={report.czasSprzedazy.wgWielkosci}
            />
          </div>

          {report.czasSprzedazy.wgWojewodztw.length > 0 && (
            <div className="mt-4">
              <TabelaMediana
                tytul="Wg województw"
                kolumna="Województwo"
                rows={report.czasSprzedazy.wgWojewodztw}
              />
            </div>
          )}
        </Sekcja>

        {/* 3. Ruchy cen ze snapshotów */}
        <Sekcja
          tytul="Ruchy cen"
          opis="Oferty, które od pierwszego pomiaru zmieniły cenę. Porównujemy pierwszy pomiar z ostatnim, bo interesuje nas kierunek, w którym poszedł sprzedający."
        >
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kafel label="Ofert pod obserwacją" value={num.format(report.obnizki.obserwowanych)} />
            <Kafel label="Zmieniło cenę" value={num.format(report.obnizki.zeZmiana)} accent />
            <Kafel
              label="Mediana zmiany"
              value={
                report.obnizki.medianaZmianyPct === null
                  ? "brak"
                  : `${num1.format(report.obnizki.medianaZmianyPct)}%`
              }
            />
          </div>

          {report.obnizki.najwieksze.length === 0 ? (
            <div className={`${CARD} p-6 text-sm text-fg/60`}>
              Żadna obserwowana oferta nie zmieniła jeszcze ceny. Pierwsze ruchy zobaczymy po
              kilku tygodniach zbierania.
            </div>
          ) : (
            <div className={CARD}>
              <div className="overflow-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-surface text-left text-xs uppercase tracking-wide text-fg/50">
                    <tr>
                      <th className={TH}>Oferta</th>
                      <th className={TH}>Było</th>
                      <th className={TH}>Jest</th>
                      <th className={TH}>Zmiana</th>
                      <th className={TH}>Powierzchnia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.obnizki.najwieksze.map((o) => (
                      <tr key={o.dzialkaId} className="border-t border-fg/10">
                        <td className={TD}>
                          <a
                            href={`/dzialka/${o.dzialkaId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-fg no-underline transition hover:text-brand"
                          >
                            {o.tytul}
                          </a>
                          <div className="mt-1 text-xs text-fg/50">
                            {o.locationLabel ?? "brak lokalizacji"}
                          </div>
                        </td>
                        <td className={`${TD} text-fg/60 line-through`}>{pln(o.cenaOd)}</td>
                        <td className={`${TD} font-semibold text-fg`}>{pln(o.cenaDo)}</td>
                        <td className={TD}>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              o.zmianaPct < 0 ? "bg-brand/15 text-fg" : "bg-fg/10 text-fg/80"
                            }`}
                          >
                            {o.zmianaPct > 0 ? "+" : ""}
                            {num1.format(o.zmianaPct)}%
                          </span>
                        </td>
                        <td className={`${TD} text-fg/70`}>{num.format(o.powierzchniaM2)} m²</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Sekcja>

        <p className="mt-10 text-xs text-fg/40">
          Historia zbiera się sama po każdym imporcie CRM. Ręcznie: <code>npm run spells</code>.
        </p>
      </div>
    </main>
  );
}

function Kafel({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        accent ? "border-brand/30 bg-brand/10" : "border-fg/10 bg-fg/5"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-fg/50">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-fg">{value}</div>
      {hint && <div className="mt-1 text-xs text-fg/50">{hint}</div>}
    </div>
  );
}

function Sekcja({
  tytul,
  opis,
  children,
}: {
  tytul: string;
  opis: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="text-xl font-semibold tracking-tight text-fg">{tytul}</h2>
      <p className="mt-1 mb-4 max-w-3xl text-sm text-fg/60">{opis}</p>
      {children}
    </section>
  );
}

function TabelaMediana({
  tytul,
  kolumna,
  rows,
}: {
  tytul: string;
  kolumna: string;
  rows: MedianaRow[];
}) {
  return (
    <div className={CARD}>
      <div className="border-b border-fg/10 px-4 py-3 text-sm font-semibold text-fg">{tytul}</div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-fg/50">
            <tr>
              <th className={TH}>{kolumna}</th>
              <th className={TH}>Ofert</th>
              <th className={TH}>Mediana</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.klucz} className="border-t border-fg/10">
                <td className={`${TD} text-fg/80`}>{r.etykieta}</td>
                <td className={`${TD} text-fg/70`}>{num.format(r.n)}</td>
                <td className={TD}>
                  {r.medianaDni === null ? (
                    <span className="text-xs text-fg/40">za mało danych</span>
                  ) : (
                    <span className="font-semibold text-fg">{dni(r.medianaDni)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelaPodaz({ rows }: { rows: PodazRow[] }) {
  const suma = rows.reduce((s, r) => s + r.aktywne, 0);

  return (
    <div className={CARD}>
      <div className="overflow-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-fg/50">
            <tr>
              <th className={TH}>Województwo</th>
              <th className={TH}>Ofert</th>
              <th className={TH}>Udział</th>
              <th className={TH}>Mediana zł/m²</th>
              <th className={TH}>Mediana ceny</th>
              <th className={TH}>Mediana powierzchni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.wojSlug} className="border-t border-fg/10">
                <td className={`${TD} font-semibold text-fg`}>{r.etykieta}</td>
                <td className={`${TD} text-fg/80`}>{num.format(r.aktywne)}</td>
                <td className={TD}>
                  <span className="inline-flex rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-fg">
                    {suma ? num1.format((r.aktywne / suma) * 100) : "0"}%
                  </span>
                </td>
                <td className={`${TD} font-semibold text-fg`}>
                  {r.medianaPpm2 === null ? "brak" : pln(r.medianaPpm2)}
                </td>
                <td className={`${TD} text-fg/70`}>
                  {r.medianaCena === null ? "brak" : pln(r.medianaCena)}
                </td>
                <td className={`${TD} text-fg/70`}>
                  {r.medianaPow === null ? "brak" : `${num.format(r.medianaPow)} m²`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
