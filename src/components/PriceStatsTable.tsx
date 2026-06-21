import Link from 'next/link';
import { getSeoRegion } from '@/lib/seo-locations';
import { formatIntPL } from '@/lib/format';
import type { VoivodeshipPrice } from '@/lib/priceStats';

// P17 — serwerowa tabela średnich cen zł/m² po województwach.
// Wiersze-specyfikacje (linie zamiast pigułek/kafli, styl /dla-biur → [[feedback-ui-podkreslenia]]).
// Każdy wiersz to link do huba województwa (equity + ruch z magnesu danych prosto na listę ofert).
// Liczba wiodąca = MEDIANA zł/m² (na zielono); średnia/próba pomocniczo.

function regionName(slug: string, fallback: string) {
  return getSeoRegion(slug)?.name ?? fallback;
}

export default function PriceStatsTable({
  regions,
  showAvg = false,
}: {
  regions: VoivodeshipPrice[];
  showAvg?: boolean;
}) {
  if (!regions.length) return null;

  // ranking liczymy tylko wśród regionów z wiarygodną próbą (reszta bez numeru).
  // Mapa slug→pozycja zamiast mutacji w trakcie renderu (React Compiler / immutability).
  const rankBySlug = new Map<string, number>();
  regions.filter((r) => r.hasData).forEach((r, i) => rankBySlug.set(r.slug, i + 1));

  return (
    <ol className="sm:columns-2 sm:gap-x-10">
      {regions.map((r) => {
        const rank = rankBySlug.get(r.slug);
        const name = regionName(r.slug, r.label);

        return (
          <li key={r.slug} className="break-inside-avoid">
            <Link
              href={`/dzialki/wojewodztwo/${r.slug}`}
              className="group flex items-baseline justify-between gap-4 border-b border-fg/10 py-3.5 transition hover:border-brand/40"
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="w-5 shrink-0 text-[12px] tabular-nums text-fg/40">
                  {rank ?? ''}
                </span>
                <span className="truncate text-[15px] text-fg/85 transition group-hover:text-fg">
                  {name}
                </span>
              </span>

              {r.hasData ? (
                <span className="flex shrink-0 items-baseline gap-3">
                  {showAvg ? (
                    <span className="hidden text-[12px] tabular-nums text-fg/45 sm:inline">
                      śr. {formatIntPL(r.avg)}
                    </span>
                  ) : null}
                  <span className="flex items-baseline gap-1">
                    <span className="text-[16px] font-semibold tabular-nums text-brand-bright">
                      {formatIntPL(r.median)}
                    </span>
                    <span className="text-[12px] text-fg/50">zł/m²</span>
                  </span>
                </span>
              ) : (
                <span className="shrink-0 text-[12px] text-fg/40">za mało ofert</span>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
