// /admin/perelki — kolejka kandydatów na post „perełka" na FB/Insta.
//
// Strona świadomie NIC nie wysyła i nie publikuje: pokazuje dziesięć najmocniejszych okazji,
// Ty otwierasz ofertę i piszesz posta, a klik „Użyta" zdejmuje ją z listy i wpuszcza kolejną.
// Dziesięć, a nie wszystko: to kolejka do roboty, nie raport do analizy.
// Progi i mediany siedzą w src/lib/perelki.ts.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import { getSeoRegion } from "@/lib/seo-locations";
import { MEDIA_LABEL, type MediaFlags } from "@/lib/media";
import {
  getPerelkiReport,
  getUzytePerelki,
  PERELKA_AREA_MAX_M2,
  PERELKA_AREA_MIN_M2,
  PERELKA_MAX_RATIO,
  PERELKA_MIN_SAMPLE,
  PERELKA_RADIUS_KM,
  PERELKA_TOP_N,
  type PerelkaRow,
} from "@/lib/perelki";
import { markPerelkaUsedAction, unmarkPerelkaUsedAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perełki",
  robots: { index: false, follow: false },
};

const plnFmt = new Intl.NumberFormat("pl-PL");

function formatPln(v: number): string {
  return `${plnFmt.format(v)} zł`;
}

function formatDatePL(d: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function mediaLabel(m: MediaFlags): string {
  const parts = (Object.keys(MEDIA_LABEL) as (keyof MediaFlags)[])
    .filter((k) => m[k])
    .map((k) => MEDIA_LABEL[k]);
  return parts.length ? parts.join(", ") : "brak";
}

function wojLabel(slug: string): string {
  return getSeoRegion(slug)?.name ?? slug;
}

type PerelkiPageProps = {
  searchParams?: Promise<{ woj?: string; uzbrojone?: string; uzyte?: string }>;
};

export default async function AdminPerelkiPage({ searchParams }: PerelkiPageProps) {
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

  const params = await searchParams;
  const wojFilter = params?.woj ?? null;
  const onlyUzbrojone = params?.uzbrojone === "1";
  const showUzyte = params?.uzyte === "1";

  const [report, uzyte] = await Promise.all([getPerelkiReport(), getUzytePerelki()]);

  // Województwa liczone z pełnej kolejki (przed filtrami), żeby chipy nie znikały po kliknięciu.
  // Oferty bez rozpoznanego województwa (parseAdmin nie ustalił) nie mają chipa, ale są widoczne
  // w „Wszystkie" — geo liczymy z lat/lng, więc odchylenie jest policzone rzetelnie.
  const wojCounts = new Map<string, number>();
  for (const r of report.perelki) {
    if (!r.wojSlug) continue;
    wojCounts.set(r.wojSlug, (wojCounts.get(r.wojSlug) ?? 0) + 1);
  }
  const wojChips = [...wojCounts.entries()].sort((a, b) => b[1] - a[1]);

  const matching = report.perelki.filter((r) => {
    if (wojFilter && r.wojSlug !== wojFilter) return false;
    if (onlyUzbrojone && !r.uzbrojona) return false;
    return true;
  });

  // Dziesiątka liczona PO filtrach: przy wybranym województwie chcesz dziesięć najlepszych
  // z tego województwa (bo pod nie dobierasz grupę na FB), a nie resztki krajowego topu.
  const visible = matching.slice(0, PERELKA_TOP_N);

  const buildHref = (next: { woj?: string | null; uzbrojone?: boolean; uzyte?: boolean }) => {
    const q = new URLSearchParams();
    const woj = next.woj === undefined ? wojFilter : next.woj;
    const uzb = next.uzbrojone === undefined ? onlyUzbrojone : next.uzbrojone;
    const uz = next.uzyte === undefined ? showUzyte : next.uzyte;
    if (woj) q.set("woj", woj);
    if (uzb) q.set("uzbrojone", "1");
    if (uz) q.set("uzyte", "1");
    const s = q.toString();
    return s ? `/admin/perelki?${s}` : "/admin/perelki";
  };

  const chipBase =
    "inline-flex h-9 items-center rounded-full border px-4 text-xs font-semibold transition";
  const chipOn = "border-brand bg-brand/15 text-fg";
  const chipOff = "border-fg/10 bg-fg/5 text-fg/70 hover:bg-fg/10";

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
          <h1 className="text-3xl font-semibold tracking-tight text-fg">Perełki</h1>
          <p className="mt-2 max-w-3xl text-sm text-fg/70">
            Dziesięć najmocniejszych okazji na dziś. Otwórz ofertę, sprawdź ją i napisz posta, a
            potem kliknij „Użyta" — zniknie z listy i wejdzie następna. To kandydaci, nie pewniaki:
            niska cena bywa od braku dojazdu, kształtu działki albo błędu w ogłoszeniu.
          </p>
          <p className="mt-3 max-w-3xl text-xs text-fg/50">
            Kryterium: działka na sprzedaż, czysto budowlana, {PERELKA_AREA_MIN_M2}–
            {plnFmt.format(PERELKA_AREA_MAX_M2)} m², co najmniej{" "}
            {Math.round((1 - PERELKA_MAX_RATIO) * 100)}% poniżej mediany zł/m² wśród podobnych
            ofert w promieniu {PERELKA_RADIUS_KM} km (min. {PERELKA_MIN_SAMPLE} sąsiadów).
            Porównujemy do sąsiedztwa, nie do powiatu, bo powiat miesza działki podmiejskie
            z wiejskimi i wtedy „taniej od mediany" znaczy tylko „dalej od miasta". Podstawa:{" "}
            {plnFmt.format(report.scannedCount)} porównywalnych ofert.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={buildHref({ woj: null })}
            className={`${chipBase} ${wojFilter ? chipOff : chipOn}`}
          >
            Cała Polska ({report.perelki.length})
          </Link>
          {wojChips.map(([slug, count]) => (
            <Link
              key={slug}
              href={buildHref({ woj: slug })}
              className={`${chipBase} ${wojFilter === slug ? chipOn : chipOff}`}
            >
              {wojLabel(slug)} ({count})
            </Link>
          ))}
          <span className="mx-1 w-px self-stretch bg-fg/10" aria-hidden />
          <Link
            href={buildHref({ uzbrojone: !onlyUzbrojone })}
            className={`${chipBase} ${onlyUzbrojone ? chipOn : chipOff}`}
          >
            Tylko uzbrojone
          </Link>
        </div>

        {visible.length === 0 ? (
          <p className="rounded-3xl border border-fg/10 bg-fg/5 p-8 text-center text-sm text-fg/60">
            Brak perełek przy tych filtrach. To normalne i lepsze niż post z byle działką.
          </p>
        ) : (
          <>
            <PerelkiTable rows={visible} />
            {matching.length > visible.length && (
              <p className="mt-3 text-xs text-fg/50">
                W kolejce czeka jeszcze {matching.length - visible.length}. Wejdą tu same, kiedy
                oznaczysz te wyżej jako użyte.
              </p>
            )}
          </>
        )}

        <section className="mt-12">
          <Link
            href={buildHref({ uzyte: !showUzyte })}
            className="text-sm font-semibold text-fg/60 no-underline transition hover:text-fg"
          >
            {showUzyte ? "Ukryj użyte" : `Pokaż użyte (${uzyte.length})`}
          </Link>

          {showUzyte && uzyte.length > 0 && (
            <div className="mt-4 rounded-3xl border border-fg/10 bg-fg/5 p-4">
              <ul className="divide-y divide-fg/10">
                {uzyte.map((u) => (
                  <li
                    key={u.dzialkaId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <a
                        href={`/dzialka/${u.dzialkaId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-fg no-underline transition hover:text-brand"
                      >
                        {u.tytul}
                      </a>
                      <div className="mt-1 text-xs text-fg/50">
                        {[u.locationLabel, `użyta ${formatDatePL(u.usedAt)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <form action={unmarkPerelkaUsedAction}>
                      <input type="hidden" name="dzialkaId" value={u.dzialkaId} />
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center rounded-full border border-fg/10 bg-fg/5 px-4 text-xs font-semibold text-fg/70 transition hover:bg-fg/10"
                      >
                        Cofnij
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showUzyte && uzyte.length === 0 && (
            <p className="mt-4 text-sm text-fg/50">Nic jeszcze nie poszło na posta.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function PerelkiTable({ rows }: { rows: PerelkaRow[] }) {
  return (
    <div className="rounded-3xl border border-fg/10 bg-fg/5">
      <div className="overflow-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-fg/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Oferta</th>
              <th className="px-4 py-3 font-semibold">Taniej</th>
              <th className="px-4 py-3 font-semibold">zł/m²</th>
              <th className="px-4 py-3 font-semibold">Mediana w okolicy</th>
              <th className="px-4 py-3 font-semibold">Cena</th>
              <th className="px-4 py-3 font-semibold">Powierzchnia</th>
              <th className="px-4 py-3 font-semibold">Media</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Zdjęcia</th>
              <th className="px-4 py-3 font-semibold">Dodana</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-fg/10 align-top">
                <td className="px-4 py-3">
                  <a
                    href={`/dzialka/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-fg no-underline transition hover:text-brand"
                  >
                    {r.tytul}
                  </a>
                  <div className="mt-1 text-xs text-fg/60">
                    {[r.locationLabel, r.powiatLabel, r.wojSlug ? wojLabel(r.wojSlug) : null]
                      .filter(Boolean)
                      .join(" · ") || "brak lokalizacji"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-fg">
                    {r.discountPct}%
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-fg">{formatPln(r.pricePerM2)}</td>
                <td className="px-4 py-3 text-fg/70">
                  {formatPln(r.localMedian)}
                  <div className="mt-1 text-xs text-fg/50">z {r.localSample} ofert</div>
                </td>
                <td className="px-4 py-3 text-fg/80">{formatPln(r.cenaPln)}</td>
                <td className="px-4 py-3 text-fg/70">{plnFmt.format(r.powierzchniaM2)} m²</td>
                <td className="px-4 py-3 text-fg/70">{mediaLabel(r.media)}</td>
                <td className="px-4 py-3 text-fg/70">
                  {r.mpzp ? "MPZP" : r.wzWydane ? "WZ" : "brak"}
                </td>
                <td className="px-4 py-3 text-fg/70">{r.photoCount}</td>
                <td className="px-4 py-3 text-xs text-fg/60">{formatDatePL(r.publishedAt)}</td>
                <td className="px-4 py-3">
                  <form action={markPerelkaUsedAction}>
                    <input type="hidden" name="dzialkaId" value={r.id} />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center whitespace-nowrap rounded-full border border-brand/30 bg-brand/10 px-4 text-xs font-semibold text-fg transition hover:border-brand hover:bg-brand/15"
                    >
                      Użyta
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
