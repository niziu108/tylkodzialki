import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BiuroOfertyList from '@/components/BiuroOfertyList';
import BiuroTabs, { type BiuroTab } from '@/components/BiuroTabs';
import { OfficeLogo } from '@/components/OfficeLogo';
import type { OfferData } from '@/components/OfferCard';
import { getWizytowkaBySlug, WIZYTOWKA_MIN_INDEX } from '@/lib/biuroWizytowka';
import { formatIntPL } from '@/lib/format';
import { plural } from '@/lib/plural';

/* Wizytówka partnera. Wejście wyłącznie z jego oferty — strona nie jest w nawigacji,
 * nie ma jej w sitemapie i celowo stoi na `noindex`: to karta partnerska, nie hub SEO.
 * Odświeżamy co 5 minut, bo liczby biorą się z eksportu, a ten i tak chodzi cyklicznie. */
export const revalidate = 300;

// Bez generateStaticParams Next renderuje trasę dynamicznie przy każdym wejściu,
// więc powyższy revalidate nie działał (produkcja zwracała x-vercel-cache: MISS
// na każdym żądaniu, także dla Googlebota). Pusta tablica = zero prerenderu
// w buildzie, ale strona generuje się przy pierwszym wejściu i potem leci
// z cache przez czas z revalidate.
export function generateStaticParams() {
  return [];
}

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

/** Numer strony z adresu. Wspólny dla metadanych i renderu, żeby `robots` liczył się z tego
 *  samego numeru, który potem widać na stronie. */
function parseStrona(raw: string) {
  const n = Number(raw || '1');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const strona = parseStrona(one((await searchParams)?.strona));
  const biuro = await getWizytowkaBySlug(slug, strona);
  if (!biuro) return { title: 'Nie znaleziono biura', robots: { index: false, follow: false } };

  const opisBiura = (biuro.opis ?? '').replace(/\s+/g, ' ').trim();

  return {
    title: `${biuro.nazwa}, działki na sprzedaż`,
    description: opisBiura
      ? skrocOpis(opisBiura, 155)
      : `Działki i grunty w ofercie biura ${biuro.nazwa}. Aktualne ceny, powierzchnie i kontakt.`,
    // Canonical zawsze na stronę 1: kolejne strony to ten sam portfel w innym wycinku.
    alternates: { canonical: `/biuro/${biuro.slug}` },
    // Indeksujemy dopiero portfel z realną podażą i tylko stronę 1. Małe wizytówki i paginacja
    // byłyby dla Google cienką kopią naszych stron kategorii. Linki do ofert zawsze dofollow.
    robots:
      biuro.liczbaOfert >= WIZYTOWKA_MIN_INDEX && biuro.strona === 1
        ? undefined
        : { index: false, follow: true },
  };
}

/** Opis biura na `description`: tniemy na granicy słowa, żeby snippet w Google nie urywał
 *  się w połowie wyrazu. */
function skrocOpis(text: string, limit: number) {
  if (text.length <= limit) return text;
  const ciecie = text.slice(0, limit);
  const spacja = ciecie.lastIndexOf(' ');
  return `${(spacja > limit * 0.6 ? ciecie.slice(0, spacja) : ciecie).replace(/[\s,.;:-]+$/, '')}...`;
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
  const strona = parseStrona(one(sp.strona));

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
    biuro.www ||
    biuro.rokZalozenia ||
    biuro.liczbaOddzialow
  );

  /* Etykieta linku bez „https://" i bez końcowego ukośnika: na wizytówce ma stać nazwa
   * domeny, nie surowy adres. Sam href zostaje pełny, bo to on musi działać. */
  const wwwLabel = biuro.www
    ? biuro.www.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    : null;

  // Zakres portfela jedną linią: od jakiej ceny zaczynają się działki i jakie
  // powierzchnie ma biuro. Portale ogólne tego nie pokażą, bo grunt tonie im
  // w mieszkaniach — a kupującemu od razu mówi, czy to oferta dla niego.
  const { zakres } = biuro;
  const zakresCzesci: string[] = [];

  if (zakres.cenaMin) {
    zakresCzesci.push(`działki od ${formatIntPL(zakres.cenaMin)} zł`);
  }

  if (zakres.powierzchniaMin && zakres.powierzchniaMax) {
    zakresCzesci.push(
      zakres.powierzchniaMin === zakres.powierzchniaMax
        ? `powierzchnia ${formatIntPL(zakres.powierzchniaMin)} m²`
        : `powierzchnie od ${formatIntPL(zakres.powierzchniaMin)} do ${formatIntPL(zakres.powierzchniaMax)} m²`
    );
  }

  const zakresLabel = zakresCzesci.length
    ? `${zakresCzesci.join(', ').replace(/^./, (c) => c.toUpperCase())}.`
    : null;

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

          {biuro.www && wwwLabel ? (
            <DataRow label="Strona">
              <a
                href={biuro.www}
                target="_blank"
                rel="noopener"
                className="break-all underline decoration-fg/20 underline-offset-8 transition hover:decoration-fg/50"
              >
                {wwwLabel}
              </a>
            </DataRow>
          ) : null}

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
      {/* NAGŁÓWEK — na komputerze dwie kolumny: po lewej kim jest biuro, po prawej
          zakładki z danymi. Dzięki temu góra jest niska i lista ofert, czyli to,
          po co kupujący tu wchodzi, łapie się wysoko na ekranie. */}
      <section className="border-b border-fg/10">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-10 md:py-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
            <div className="min-w-0">
              <div className="flex flex-col items-center gap-5 text-center md:flex-row md:items-center md:gap-7 md:text-left">
                {biuro.logoUrl ? (
                  <OfficeLogo
                    src={biuro.logoUrl}
                    alt={biuro.nazwa}
                    variant="hero"
                    eager
                    bg={biuro.logoBg}
                  />
                ) : null}

                <div className="min-w-0">
                  <h1 className="text-balance text-[26px] font-semibold leading-[1.12] tracking-tight text-fg md:text-[34px]">
                    {biuro.nazwa}
                  </h1>

                  {/* Status tuż pod nazwą, czyli pierwsza rzecz czytana po logo i nazwie.
                      Zwykłym krojem i kolorem: na wizytówce nie ma z czym konkurować,
                      bo cała strona należy do tego biura. */}
                  {biuro.partner ? (
                    <p className="mt-2 text-[15px] text-fg/70">Nasz partner strategiczny</p>
                  ) : null}
                </div>
              </div>

              <p className="mt-6 text-balance text-center text-[15px] leading-7 text-fg/68 md:text-left">
                {biuro.liczbaOfert > 0 ? (
                  <>
                    {formatIntPL(biuro.liczbaOfert)}
                    {' '}
                    {plural(biuro.liczbaOfert, 'działka', 'działki', 'działek')} w ofercie
                    {wojCount > 0 ? (
                      <>
                        , w {formatIntPL(wojCount)}
                        {' '}
                        {plural(wojCount, 'województwie', 'województwach', 'województwach')}
                        {powCount > 0 ? (
                          <>
                            {' '}
                            i {formatIntPL(powCount)}
                            {' '}
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

              {zakresLabel ? (
                <p className="mt-2 text-balance text-center text-[14px] leading-6 text-fg/55 md:text-left">
                  {zakresLabel}
                </p>
              ) : null}
            </div>

            {tabs.length ? (
              <div className="min-w-0">
                <BiuroTabs tabs={tabs} />
              </div>
            ) : null}
          </div>
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
