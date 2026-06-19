import Link from 'next/link';
import type { Przeznaczenie } from '@prisma/client';
import HomeHorizontalSlider from '@/components/HomeHorizontalSlider';
import type { SimilarDzialka } from '@/lib/dzialki';
import { CardBody } from '@/components/CardBody';
import { formatIntPL } from '@/lib/format';
import { parcelMediaLabel } from '@/lib/media';

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

function formatDistance(km: number | null): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return 'blisko';
  return `${formatIntPL(Math.round(km))} km`;
}

function SimilarCard({ d }: { d: SimilarDzialka }) {
  const cover = d.zdjecia?.[0]?.url ?? null;
  const loc = d.locationLabel?.trim() || 'Lokalizacja niepodana';
  const area = d.powierzchniaM2 ?? 0;
  const przezn = d.przeznaczenia?.length
    ? d.przeznaczenia.map(labelPrzeznaczenie).join(', ')
    : '—';
  const distance = formatDistance(d.distanceKm);

  return (
    <Link
      href={`/dzialka/${d.id}`}
      className="group min-w-[86%] snap-start overflow-hidden rounded-3xl border border-white/14 bg-[#0f0f0f]/40 transition duration-200 hover:border-white/30 md:min-w-[360px] xl:min-w-[380px]"
    >
      <div className="relative aspect-video overflow-hidden bg-white/5">
        {cover ? (
          <>
            <img
              src={cover}
              alt={d.tytul}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-[#161616]">
            <span className="text-[12px] tracking-[0.12em] text-white/30">Zdjęcie wkrótce</span>
          </div>
        )}

        {distance ? (
          <div className="absolute left-4 top-4 z-10">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-medium tracking-[0.04em] text-white/85 backdrop-blur-sm">
              {distance}
            </span>
          </div>
        ) : null}
      </div>

      <CardBody
        cena={d.cenaPln}
        isRent={false}
        tytul={d.tytul}
        loc={loc}
        area={area}
        przezn={przezn}
        media={parcelMediaLabel(d)}
        sellerType={d.sprzedajacyTyp}
        biuroNazwa={d.biuroNazwa}
        biuroLogoUrl={d.biuroLogoUrl}
      />
    </Link>
  );
}

/**
 * „Podobne oferty" na dole strony oferty. Serwerowy komponent — karty (linki do
 * innych ofert) są w HTML renderowanym po stronie serwera, więc Googlebot widzi
 * wewnętrzne linkowanie między ofertami. Cel: więcej odsłon, dłuższy czas na
 * stronie i więcej kontaktów. Pusty zbiór → nic nie renderujemy.
 */
export default function SimilarOffers({ items }: { items: SimilarDzialka[] }) {
  if (!items.length) return null;

  const inArea = items.some((d) => d.distanceKm != null);
  const heading = inArea
    ? 'Podobne działki na sprzedaż w okolicy'
    : 'Podobne działki na sprzedaż';

  return (
    <section aria-labelledby="podobne-oferty" className="border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-10">
        <div className="text-[12px] uppercase tracking-[0.16em] text-[#9fd14b]">Zobacz też</div>

        <h2
          id="podobne-oferty"
          className="mt-2 text-[22px] font-semibold text-white md:text-[28px]"
        >
          {heading}
        </h2>

        <div className="mt-6 [touch-action:pan-x_pan-y]">
          <HomeHorizontalSlider>
            {items.map((d) => (
              <SimilarCard key={d.id} d={d} />
            ))}
          </HomeHorizontalSlider>
        </div>

        <div className="mt-6 flex justify-center md:justify-start">
          <Link
            href="/kup"
            className="inline-flex text-sm text-white/60 transition hover:text-white"
          >
            Przeglądaj wszystkie działki →
          </Link>
        </div>
      </div>
    </section>
  );
}
