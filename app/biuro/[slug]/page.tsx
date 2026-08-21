import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BiuroOfertyList from '@/components/BiuroOfertyList';
import BiuroTabs, { type BiuroTab } from '@/components/BiuroTabs';
import { OfficeLogo } from '@/components/OfficeLogo';
import type { OfferData } from '@/components/OfferCard';
import { getWizytowkaBySlug } from '@/lib/biuroWizytowka';
import { formatIntPL } from '@/lib/format';
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

/** Wiersz danych — kreska pod spodem, jak wiersze specyfikacji na /dla-biur. */
function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 border-b border-fg/10 py-3 text-left">
      <span className="shrink-0 text-[13px] text-fg/60">{label}</span>
      <span className="min-w-0 text-right text-[15px] font-medium text-fg/90">{children}</span>
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

  // Opis wklejamy od biura, więc trafiają się i puste linie, i jeden ciąg z pojedynczymi
  // enterami. Dzielimy po każdym złamaniu wiersza — inaczej całość zlewała się w blok.
  const akapity = (biuro.opis ?? '')
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const maKontakt = !!(
    biuro.telefon ||
    biuro.email ||
    biuro.adres ||
    biuro.rokZalozenia ||
    biuro.liczbaOddzialow
  );

  const tabs: BiuroTab[] = [];

  if (maKontakt) {
    tabs.push({
      key: 'kontakt',
      label: 'Kontakt',
      content: (
        <div className="mx-auto max-w-md">
          {biuro.telefon ? (
            <DataRow label="Telefon">
              <a
                href={`tel:${biuro.telefon.replace(/\s+/g, '')}`}
                className="underline decoration-fg/20 underline-offset-8 transition hover:decoration-fg/50"
              >
                {biuro.telefon}
              </a>
            </DataRow>
          ) : null}

          {biuro.email ? (
            <DataRow label="E-mail">
              <a
                href={`mailto:${biuro.email}`}
                className="break-all underline decoration-fg/20 underline-offset-8 transition hover:decoration-fg/50"
              >
                {biuro.email}
              </a>
            </DataRow>
          ) : null}

          {biuro.adres ? <DataRow label="Adres">{biuro.adres}</DataRow> : null}

          {biuro.rokZalozenia ? (
            <DataRow label="Na rynku od">{biuro.rokZalozenia}</DataRow>
          ) : null}

          {biuro.liczbaOddzialow ? (
            <DataRow label="Oddziały">{formatIntPL(biuro.liczbaOddzialow)}</DataRow>
          ) : null}
        </div>
      ),
    });
  }

  if (akapity.length) {
    tabs.push({
      key: 'o-biurze',
      label: 'O biurze',
      content: (
        <div className="mx-auto max-w-2xl space-y-4 text-[15px] leading-7 text-fg/72">
          {akapity.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ),
    });
  }

  if (zasieg.wojewodztwa.length) {
    tabs.push({
      key: 'zasieg',
      label: 'Gdzie ma działki',
      content: (
        <div className="mx-auto max-w-md">
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
      ),
    });
  }

  return (
    <main className="relative w-full" style={{ background: 'var(--bg)' }}>
      {/* NAGŁÓWEK — logo obok nazwy, wyśrodkowane; pod spodem skala portfela,
          a niżej zakładki z resztą danych (jak przełączanie w panelu klienta). */}
      <section className="border-b border-fg/10">
        <div className="mx-auto w-full max-w-4xl px-6 py-14 md:px-10 md:py-16">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 text-center">
            {biuro.logoUrl ? (
              <OfficeLogo
                src={biuro.logoUrl}
                alt={biuro.nazwa}
                variant="detail"
                eager
                bg={biuro.logoBg}
              />
            ) : null}

            <h1 className="text-[26px] font-semibold leading-[1.12] tracking-tight text-fg md:text-[36px]">
              {biuro.nazwa}
            </h1>
          </div>

          <p className="mt-5 text-center text-[15px] leading-7 text-fg/68">
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

          {tabs.length ? (
            <div className="mt-10">
              <BiuroTabs tabs={tabs} />
            </div>
          ) : null}
        </div>
      </section>

      {/* OFERTY — te same karty i ten sam pager, co na /kup */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10 md:py-14">
          <h2 className="mb-8 text-[19px] font-semibold tracking-tight text-fg md:text-[22px]">
            Działki w ofercie
            {biuro.stronLacznie > 1 ? (
              <span className="ml-3 text-[14px] font-normal text-fg/55">
                strona {biuro.strona} z {biuro.stronLacznie}
              </span>
            ) : null}
          </h2>

          <BiuroOfertyList
            items={biuro.oferty as unknown as OfferData[]}
            slug={biuro.slug}
            page={biuro.strona}
            totalPages={biuro.stronLacznie}
          />
        </div>
      </section>
    </main>
  );
}
