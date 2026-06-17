import Link from 'next/link';

export type HubLinkItem = {
  href: string;
  label: string;
  // liczba ofert (opcjonalnie) — sygnał treści dla użytkownika i podpowiedź dostępności
  count?: number;
  // krótki podpis pod etykietą (np. opis typu działki)
  sub?: string;
};

// Serwerowa siatka linków huba SEO. Linki są w HTML serwera, więc Googlebot widzi
// strukturę hub-and-spoke (equity płynie między poziomami). Ciemny motyw spójny z resztą.
export default function HubLinkGrid({
  items,
  columns = 3,
}: {
  items: HubLinkItem[];
  columns?: 2 | 3;
}) {
  if (!items.length) return null;

  const gridCols =
    columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`grid grid-cols-1 gap-3 ${gridCols}`}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3.5 transition hover:border-[#7aa333]/40 hover:bg-[#7aa333]/10"
        >
          <span className="min-w-0">
            <span className="block truncate text-[15px] text-white/85 transition group-hover:text-white">
              {item.label}
            </span>
            {item.sub ? (
              <span className="mt-0.5 block text-[12px] leading-5 text-white/40">
                {item.sub}
              </span>
            ) : null}
          </span>

          {typeof item.count === 'number' ? (
            <span className="shrink-0 rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-2.5 py-1 text-[12px] font-medium text-[#9fd14b]">
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
