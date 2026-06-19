// Spis treści: wyciągamy nagłówki z markdownu artykułu i robimy z nich kotwice.
// `#` i `##` traktujemy jako sekcje (oba renderują się jako <h2>); `###` pomijamy.
// Slug kotwicy musi być spójny z `id` nadawanym nagłówkom w ArticleContent,
// dlatego oba używają tej samej funkcji slugifyHeading.

export type TocHeading = {
  text: string;
  id: string;
};

const PL_MAP: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ż: "z",
  ź: "z",
};

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[*_`~]/g, "")
    .replace(/[ąćęłńóśżź]/g, (c) => PL_MAP[c] ?? c)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractHeadings(
  content: string,
  skipText?: string
): TocHeading[] {
  const skipSlug = skipText ? slugifyHeading(skipText) : null;
  const out: TocHeading[] = [];
  const seen = new Set<string>();

  for (const line of content.split("\n")) {
    const match = /^(#{1,2})\s+(.+)$/.exec(line.trim());
    if (!match) continue;

    const raw = match[2].trim();
    const text = raw.replace(/[*_`~]/g, "").trim();
    if (!text) continue;

    const id = slugifyHeading(raw);
    if (!id || seen.has(id)) continue;
    if (skipSlug && id === skipSlug) continue; // pomiń nagłówek równy tytułowi

    seen.add(id);
    out.push({ text, id });
  }

  return out;
}
