// Jedno źródło prawdy dla kategorii artykułów. Używane przez panel admina,
// chipy na kartach/nagłówku artykułu i (docelowo) generator okładki OG.
// W bazie trzymamy `slug`; do wyświetlenia bierzemy `label` przez getCategoryLabel.

export type ArticleCategory = {
  slug: string;
  label: string;
};

export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  { slug: "formalnosci-i-prawo", label: "Formalności i prawo" },
  { slug: "kupno-dzialki", label: "Kupno działki" },
  { slug: "sprzedaz-dzialki", label: "Sprzedaż działki" },
  { slug: "budowa", label: "Budowa" },
  { slug: "dzialka-rolna", label: "Działka rolna" },
  { slug: "inwestowanie", label: "Inwestowanie" },
];

export function getCategoryLabel(slug?: string | null): string | null {
  if (!slug) return null;
  return ARTICLE_CATEGORIES.find((c) => c.slug === slug)?.label ?? null;
}

// Szacowany czas czytania w minutach (~200 słów/min, minimum 1).
export function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
