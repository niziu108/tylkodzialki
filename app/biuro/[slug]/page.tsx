import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Przeznaczenie } from '@prisma/client';
import { CardBody } from '@/components/CardBody';
import { OfficeLogo } from '@/components/OfficeLogo';
import { getWizytowkaBySlug, type WizytowkaOferta } from '@/lib/biuroWizytowka';
import { formatIntPL } from '@/lib/format';
import { parcelMediaLabel } from '@/lib/media';
import { plural } from '@/lib/plural';

/* Wizytówka partnera. Wejście wyłącznie z jego oferty — strona nie jest w nawigacji,
 * nie ma jej w sitemapie i celowo stoi na `noindex`: to karta partnerska, nie hub SEO.
 * Odświeżamy co 5 minut, bo liczby biorą się z eksportu, a ten i tak chodzi cyklicznie. */
export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const biuro = await getWizytowkaBySlug(slug);
  if (!biuro) return { title: 'Nie znaleziono biura', robots: { index: false, follow: false } };

  return {
    title: `${biuro.nazwa} — działki i grunty`,
    description: `Oferty działek biura ${biuro.nazwa} na tylkodzialki.pl.`,
    // Wizytówka nie konkuruje w wyszukiwarce o frazy „biuro nieruchomości".
    // Linki do ofert zostają dofollow, żeby przekazywały wartość dalej.
    robots: { index: false, follow: true },
  };
}

function labelPrzeznaczenie(p: Przeznaczenie) {
  const map: Record<string, string> = {
    INWESTYCYJNA: 'Inwestycyjna',
    BUDOWLANA: 'Budowlana',
    ROLNA: 'Rolna',
    LESNA: 'Leśna',
    REKREACYJNA: 'Rekreacyjna',
    SIEDLISKOWA: 'Siedliskowa',
    USLUGOWA: 'Usługowa',
  };
  return map[p] ?? String(p);
}

function normalizeWww(raw: string) {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function OfertaCard({ o }: { o: WizytowkaOferta }) {
  const cover = o.zdjecia?.[0]?.url ?? null;

  return (
    <Link
      href={`/dzialka/${o.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-fg/14 bg-surface-2/40 transition duration-200 hover:border-fg/30"
    >
      <div className="relative aspect-video overflow-hidden bg-fg/5">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={o.tytul}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface">
            <span className="text-[12px] tracking-[0.12em] text-fg/30">Zdjęcie wkrótce</span>
          </div>
        )}
      </div>

      <CardBody
        cena={o.cenaPln}
        isRent={o.transakcja === 'WYNAJEM'}
        tytul={o.tytul}
        loc={o.locationLabel?.trim() || 'Lokalizacja niepodana'}
        area={o.powierzchniaM2 ?? 0}
        przezn={
          o.przeznaczenia?.length ? o.przeznaczenia.map(labelPrzeznaczenie).join(', ') : '—'
        }
        media={parcelMediaLabel(o)}
        fill
      />
    </Link>
  );
}

/** Wiersz specyfikacji — ta sama kreska, co na /dla-biur. */
function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-fg/10 py-3">
      <span className="text-[13px] text-fg/60">{label}</span>
      <span className="text-[15px] font-medium text-fg/90">{children}</span>
    </div>
  );
}

export default async function BiuroPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const stronaRaw = Number(one(sp.strona) || '1');
  const strona = Number.isFinite(stronaRaw) && stronaRaw > 0 ? Math.floor(stronaRaw) : 1;

  const biuro = await getWizytowkaBySlug(slug, strona);
  if (!biuro) notFound();

  const { zasieg } = biuro;
  const wojCount = zasieg.wojewodztwa.length;
  const powCount = zasieg.powiaty.length;

  return (
    <main className="relative w-full" style={{ background: 'var(--bg)' }}>
      {/* NAGŁÓWEK — logo, nazwa i jedna linia, która mówi wszystko o skali portfela */}
      <section className="border-b border-fg/10">
        <div className="mx-auto w-full max-w-6xl px-6 py-14 md:px-10 md:py-20">
          {biuro.logoUrl ? (
            <div className="mb-7">
              <OfficeLogo src={biuro.logoUrl} alt={biuro.nazwa} variant="detail" eager bg={biuro.logoBg} />
            </div>
          ) : null}

          <h1 className="text-[28px] font-semibold leading-[1.12] tracking-tight text-fg md:text-[42px]">
            {biuro.nazwa}
          </h1>

          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-fg/68 md:text-base">
            {biuro.liczbaOfert > 0 ? (
              <>
                {formatIntPL(biuro.liczbaOfert)}{' '}
                {plural(biuro.liczbaOfert, 'działka', 'działki', 'działek')} w ofercie
                {wojCount > 0 ? (
                  <>
                    , w {formatIntPL(wojCount)}{' '}
                    {plural(wojCount, 'województwie', 'województwach', 'województwach')}
                    {powCount > 0 ? (
                      <>
                        {' '}
                        i {formatIntPL(powCount)}{' '}
                        {plural(powCount, 'powiecie', 'powiatach', 'powiatach')}
                      </>
                    ) : null}
                  </>
                ) : null}
                .
              </>
            ) : (
              'Aktualnie brak aktywnych ofert.'
            )}
          </p>
        </div>
      </section>

      {/* O BIURZE + KONTAKT */}
      {biuro.opis || biuro.telefon || biuro.email || biuro.www || biuro.rokZalozenia || biuro.liczbaOddzialow ? (
        <section className="border-b border-fg/10">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-14 md:px-10 md:py-16 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
            <div>
              <h2 className="text-[19px] font-semibold tracking-tight text-fg md:text-[22px]">
                O biurze
              </h2>
              {biuro.opis ? (
                <div className="mt-5 space-y-4 text-[15px] leading-7 text-fg/72">
                  {biuro.opis
                    .split(/\n{2,}/)
                    .map((p) => p.trim())
                    .filter(Boolean)
                    .map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                </div>
              ) : (
                <p className="mt-5 text-[15px] leading-7 text-fg/60">
                  Biuro nie przekazało jeszcze opisu.
                </p>
              )}
            </div>

            <div>
              <h2 className="text-[19px] font-semibold tracking-tight text-fg md:text-[22px]">
                Kontakt
              </h2>

              <div className="mt-5">
                {biuro.telefon ? (
                  <SpecRow label="Telefon">
                    <a
                      href={`tel:${biuro.telefon.replace(/\s+/g, '')}`}
                      className="underline decoration-fg/20 underline-offset-8 transition hover:decoration-fg/50"
                    >
                      {biuro.telefon}
                    </a>
                  </SpecRow>
                ) : null}

                {biuro.email ? (
                  <SpecRow label="E-mail">
                    <a
                      href={`mailto:${biuro.email}`}
                      className="break-all underline decoration-fg/20 underline-offset-8 transition hover:decoration-fg/50"
                    >
                      {biuro.email}
                    </a>
                  </SpecRow>
                ) : null}

                {biuro.www ? (
                  <SpecRow label="Strona">
                    <a
                      href={normalizeWww(biuro.www)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="break-all underline decoration-fg/20 underline-offset-8 transition hover:decoration-fg/50"
                    >
                      {biuro.www.replace(/^https?:\/\//i, '')}
                    </a>
                  </SpecRow>
                ) : null}

                {biuro.rokZalozenia ? (
                  <SpecRow label="Na rynku od">{biuro.rokZalozenia}</SpecRow>
                ) : null}

                {biuro.liczbaOddzialow ? (
                  <SpecRow label="Oddziały">
                    {formatIntPL(biuro.liczbaOddzialow)}
                  </SpecRow>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ZASIĘG — liczony z eksportu biura, nie z tego, co o sobie napisali */}
      {zasieg.wojewodztwa.length ? (
        <section className="border-b border-fg/10">
          <div className="mx-auto w-full max-w-6xl px-6 py-14 md:px-10 md:py-16">
            <h2 className="text-[19px] font-semibold tracking-tight text-fg md:text-[22px]">
              Gdzie ma działki
            </h2>

            <div className="mt-6 grid gap-x-16 gap-y-0 sm:grid-cols-2">
              {zasieg.wojewodztwa.map((w) => (
                <div
                  key={w.slug}
                  className="flex items-baseline justify-between gap-6 border-b border-fg/10 py-3"
                >
                  <Link
                    href={`/dzialki/wojewodztwo/${w.slug}`}
                    className="text-[15px] text-fg/85 underline decoration-fg/15 underline-offset-8 transition hover:decoration-fg/45"
                  >
                    {w.name}
                  </Link>
                  <span className="text-[14px] font-medium text-fg/60">{formatIntPL(w.count)}</span>
                </div>
              ))}
            </div>

            {zasieg.powiaty.length > 1 ? (
              <p className="mt-6 text-[13px] leading-6 text-fg/55">
                Najwięcej ofert w:{' '}
                {zasieg.powiaty
                  .slice(0, 6)
                  .map((p) => p.label)
                  .join(', ')}
                .
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* OFERTY */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-6 py-14 md:px-10 md:py-16">
          <h2 className="text-[19px] font-semibold tracking-tight text-fg md:text-[22px]">
            {biuro.stronLacznie > 1
              ? `Działki w ofercie (strona ${biuro.strona} z ${biuro.stronLacznie})`
              : 'Działki w ofercie'}
          </h2>

          {biuro.oferty.length ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {biuro.oferty.map((o) => (
                <OfertaCard key={o.id} o={o} />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-[15px] leading-7 text-fg/60">
              Na tej stronie nie ma już ofert.
            </p>
          )}

          {biuro.stronLacznie > 1 ? (
            <nav className="mt-12 flex items-center justify-between gap-4 border-t border-fg/10 pt-6">
              {biuro.strona > 1 ? (
                <Link
                  href={
                    biuro.strona - 1 === 1
                      ? `/biuro/${biuro.slug}`
                      : `/biuro/${biuro.slug}?strona=${biuro.strona - 1}`
                  }
                  className="text-[14px] font-medium text-fg/85 underline decoration-fg/20 underline-offset-8 transition hover:decoration-fg/50"
                >
                  Poprzednia
                </Link>
              ) : (
                <span />
              )}

              <span className="text-[13px] text-fg/55">
                {biuro.strona} / {biuro.stronLacznie}
              </span>

              {biuro.strona < biuro.stronLacznie ? (
                <Link
                  href={`/biuro/${biuro.slug}?strona=${biuro.strona + 1}`}
                  className="text-[14px] font-medium text-fg/85 underline decoration-fg/20 underline-offset-8 transition hover:decoration-fg/50"
                >
                  Następna
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      </section>
    </main>
  );
}
