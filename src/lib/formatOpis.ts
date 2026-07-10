// Formatowanie opisu oferty do bezpiecznego HTML renderowanego przez dangerouslySetInnerHTML.
//
// Zasada bezpieczeństwa (allow-lista): tekst między tagami zawsze escapujemy, a z samych
// tagów emitujemy WYŁĄCZNIE garść dozwolonych znaczników formatujących BEZ atrybutów.
// Wszystko inne (script, img, iframe, on*=, style, href javascript:) albo znika, albo zostaje
// nieszkodliwym tekstem — to zamyka XSS, bo nigdy nie wypuszczamy atrybutu ani nieznanego tagu.
//
// Po co cały tokenizer zamiast prostego allow-listu: opisy z biur/IMO bywają wklejone z edytorów
// WYSIWYG i niosą śmieci — `<div bis_skin_checked="1">` (wstrzyknięte przez wtyczki przeglądarki),
// `<p style=...>`, `<span>`, tagi Worda `<o:p>`. Traktujemy bloki (`div`, `p`, `li`...) jako łamanie
// linii, atrybuty wycinamy, a pogrubienie/kursywę/podkreślenie zachowujemy. Obsługujemy też podwójny
// escape z eksportów IMO (np. „&amp;lt;u&amp;gt;").
//
// Funkcja jest izomorficzna (czyste operacje na stringach, bez DOM) — działa tak samo w SSR i w przeglądarce.

// Tagi inline, które zachowujemy (zawsze bez atrybutów).
const INLINE_ALLOWED = new Set(["b", "strong", "i", "em", "u"]);

// Tagi listy — zachowujemy jako prawdziwe znaczniki (bez atrybutów), żeby wypunktowanie
// i numeracja z CRM/edytora renderowały się jako lista, a nie płaskie linijki.
const LIST_TAGS = new Set(["ul", "ol", "li"]);

// Tagi blokowe — zamieniamy je na łamanie linii ("\n"). Pusta linia (np. <div><br></div>
// albo <p></p>) zamienia się dalej w przerwę między akapitami.
const BLOCK_TAGS = new Set([
  "div", "p", "br", "tr", "table", "thead", "tbody",
  "blockquote", "section", "article", "header", "footer", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
]);

// Nazwane encje HTML, którymi eksporty CRM kodują polskie „ó/Ó", symbole (m², °) i typografię.
// Świadomie szeroka lista (Latin-1 + typografia) — biura wklejają opisy z edytorów WYSIWYG.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  sup2: "²", sup3: "³", deg: "°", plusmn: "±", times: "×", divide: "÷",
  micro: "µ", middot: "·", para: "¶", sect: "§", acute: "´",
  laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", sbquo: "‚",
  ldquo: "“", rdquo: "”", bdquo: "„",
  bull: "•", dagger: "†", Dagger: "‡", euro: "€", pound: "£", cent: "¢",
  yen: "¥", copy: "©", reg: "®", trade: "™",
  frac12: "½", frac14: "¼", frac34: "¾",
  aacute: "á", Aacute: "Á", agrave: "à", Agrave: "À", acirc: "â", Acirc: "Â",
  atilde: "ã", Atilde: "Ã", auml: "ä", Auml: "Ä", aring: "å", Aring: "Å", aelig: "æ", AElig: "Æ",
  ccedil: "ç", Ccedil: "Ç",
  eacute: "é", Eacute: "É", egrave: "è", Egrave: "È", ecirc: "ê", Ecirc: "Ê", euml: "ë", Euml: "Ë",
  iacute: "í", Iacute: "Í", igrave: "ì", Igrave: "Ì", icirc: "î", Icirc: "Î", iuml: "ï", Iuml: "Ï",
  ntilde: "ñ", Ntilde: "Ñ",
  oacute: "ó", Oacute: "Ó", ograve: "ò", Ograve: "Ò", ocirc: "ô", Ocirc: "Ô",
  otilde: "õ", Otilde: "Õ", ouml: "ö", Ouml: "Ö", oslash: "ø", Oslash: "Ø",
  uacute: "ú", Uacute: "Ú", ugrave: "ù", Ugrave: "Ù", ucirc: "û", Ucirc: "Û", uuml: "ü", Uuml: "Ü",
  yacute: "ý", yuml: "ÿ", szlig: "ß",
};

function safeFromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return "";
  if (cp >= 0xd800 && cp <= 0xdfff) return "";
  // Znaki sterujące C0 (poza tab/LF/CR) odrzucamy — nie mają czego reprezentować w opisie.
  if (cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) return "";
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

function decodeEntitiesOnce(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name: string) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : m
    );
}

// Dekoduje encje nazwane i liczbowe. Pętla rozplątuje podwójny/wielokrotny escape
// z eksportów IMO (np. „&amp;oacute;" → „&oacute;" → „ó", „&amp;lt;u&amp;gt;" → „<u>").
export function decodeHtmlEntities(input?: string | null): string {
  let cur = input ?? "";
  for (let i = 0; i < 3; i += 1) {
    const next = decodeEntitiesOnce(cur);
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatOpis(raw?: string | null): string | null {
  let text = (raw ?? "").trim();
  if (!text) return null;

  // 1. Dekodujemy encje (nazwane, liczbowe, w tym podwójny escape), żeby pracować na realnych tagach.
  text = decodeHtmlEntities(text);

  // 2. Usuwamy w całości elementy, których treść nie może trafić na stronę (z zawartością),
  //    oraz komentarze (w tym warunkowe komentarze Worda/Outlooka).
  text = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|head|title|noscript|template|svg|math|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi,
      ""
    )
    // domykające „sieroty" tych samych tagów (gdy brak pary) — sam znacznik precz.
    .replace(
      /<\/?(script|style|head|title|noscript|template|svg|math|iframe|object|embed)\b[^>]*>/gi,
      ""
    );

  // 3. Tokenizacja: idziemy po tagach, tekst pomiędzy escapujemy, a z tagów emitujemy tylko
  //    bezpieczne, gołe znaczniki. Nieznane tagi „rozwijamy" (znika znacznik, treść zostaje).
  const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9:_-]*)\b[^>]*>/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = TAG.exec(text)) !== null) {
    out += escapeText(text.slice(last, m.index));
    last = m.index + m[0].length;

    const closing = m[1] === "/";
    const name = m[2].toLowerCase();

    if (INLINE_ALLOWED.has(name)) {
      out += closing ? `</${name}>` : `<${name}>`;
    } else if (LIST_TAGS.has(name)) {
      // Prawdziwe znaczniki listy, zawsze gołe (bez atrybutów).
      out += closing ? `</${name}>` : `<${name}>`;
    } else if (BLOCK_TAGS.has(name)) {
      // Otwarcie bloku zostawiamy „przezroczyste", zamknięcie łamie linię — dzięki temu
      // sąsiednie <div>y dają pojedyncze złamanie (a nie podwójne = nowy akapit).
      if (closing || name === "br") out += "\n";
    }
    // pozostałe (span, a, font, o:p, ...) — pomijamy znacznik, tekst zostaje
  }
  out += escapeText(text.slice(last));

  // 4. Sprzątanie po wklejkach z edytorów: puste znaczniki inline (np. <b></b> z <div><b><br></b></div>)
  //    usuwamy — wtedy zamierzona pusta linia staje się prawdziwą przerwą między akapitami.
  let prev: string;
  do {
    prev = out;
    out = out.replace(/<(b|strong|i|em|u)>\s*<\/\1>/gi, "");
  } while (out !== prev);

  // 5. Rozdzielamy bloki listy od zwykłego tekstu. Listę renderujemy jako prawdziwe
  //    <ul>/<ol> (nie zawijamy jej w <p> ani nie wstrzykujemy <br />), a pozostały tekst
  //    dzielimy na akapity: podwójny enter → osobny <p>, pojedynczy → <br />.
  const LIST_BLOCK = /<(ul|ol)>[\s\S]*?<\/\1>/gi;

  let html = "";
  let listLast = 0;
  let lm: RegExpExecArray | null;

  while ((lm = LIST_BLOCK.exec(out)) !== null) {
    html += renderTextChunk(out.slice(listLast, lm.index));
    html += normalizeList(lm[0]);
    listLast = lm.index + lm[0].length;
  }
  html += renderTextChunk(out.slice(listLast));

  return html || null;
}

// Tekst poza listami dzielimy na akapity (podwójny enter) i łamania linii (pojedynczy).
function renderTextChunk(chunk: string): string {
  return chunk
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

// Porządkujemy blok listy: znosimy odstępy/łamania między znacznikami (żeby nie robić z nich
// <br />), wyrzucamy puste <li></li> oraz listy, które po sprzątaniu nie mają żadnej pozycji.
function normalizeList(listHtml: string): string {
  const cleaned = listHtml
    .replace(/\s*<li>\s*/gi, "<li>")
    .replace(/\s*<\/li>\s*/gi, "</li>")
    .replace(/\s*<(ul|ol)>\s*/gi, "<$1>")
    .replace(/\s*<\/(ul|ol)>\s*/gi, "</$1>")
    .replace(/<li>\s*<\/li>/gi, "");

  return /<li>/i.test(cleaned) ? cleaned : "";
}
