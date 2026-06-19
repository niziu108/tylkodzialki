import { getCategoryLabel } from "@/lib/articleCategories";

type ArticleMetaProps = {
  category?: string | null;
  createdAt: Date | string;
  readingTime?: number | null;
  className?: string;
};

// Spójna linia meta: chip kategorii + data + czas czytania.
// Używana na kartach (lista, „Zobacz też", home) i w nagłówku artykułu.
export default function ArticleMeta({
  category,
  createdAt,
  readingTime,
  className = "",
}: ArticleMetaProps) {
  const label = getCategoryLabel(category);
  const date = new Date(createdAt).toLocaleDateString("pl-PL");

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      {label ? (
        <span className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-2.5 py-1 text-[11px] font-semibold text-[#9fd14b]">
          {label}
        </span>
      ) : null}

      <span className="text-[12px] uppercase tracking-[0.12em] text-white/45">
        {date}
      </span>

      {readingTime ? (
        <span className="text-[12px] uppercase tracking-[0.12em] text-white/45">
          · {readingTime} min czytania
        </span>
      ) : null}
    </div>
  );
}
