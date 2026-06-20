// Formatowanie opisu oferty do bezpiecznego HTML renderowanego przez dangerouslySetInnerHTML.
//
// Zasada bezpieczeństwa: escapujemy CAŁY tekst, a potem przywracamy WYŁĄCZNIE dozwolone tagi
// formatujące BEZ atrybutów. Dzięki temu proste formatowanie od biur (pogrubienie, kursywa,
// podkreślenie) działa, a wszystko inne (script, img, iframe, atrybuty zdarzeń jak onerror)
// zostaje zwykłym, nieszkodliwym tekstem — to zamyka XSS.
//
// Obsługujemy też podwójny escape spotykany w eksportach IMO (np. „&amp;lt;u&amp;gt;").

const ALLOWED_TAGS = ["b", "strong", "i", "em", "u"] as const;

export function formatOpis(raw?: string | null): string | null {
  let text = (raw ?? "").trim();
  if (!text) return null;

  // 1. Dekodujemy encje, w tym podwójny escape (&amp; najpierw → obsługuje „&amp;lt;" → „&lt;" → „<").
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

  // 2. Escapujemy całość do bezpiecznego tekstu (żadne tagi nie są jeszcze aktywne).
  let safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 3. Przywracamy tylko dozwolone tagi bez atrybutów (otwierające i zamykające).
  for (const t of ALLOWED_TAGS) {
    safe = safe
      .replace(new RegExp(`&lt;${t}&gt;`, "gi"), `<${t}>`)
      .replace(new RegExp(`&lt;/${t}&gt;`, "gi"), `</${t}>`);
  }
  // <br> w różnych wariantach → twardy <br />.
  safe = safe.replace(/&lt;br\s*\/?&gt;/gi, "<br />");

  // 4. Akapity: podwójny enter → osobny <p>, pojedynczy → <br />.
  const out = safe
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
    .join("");

  return out || null;
}
