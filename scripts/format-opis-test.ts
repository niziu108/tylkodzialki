/**
 * Test formatOpis: formatowanie + bezpieczeństwo (XSS).
 * Uruchom: npx tsx scripts/format-opis-test.ts
 */
import { formatOpis } from "@/lib/formatOpis";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

// --- Formatowanie (ma działać) ---
const bold = formatOpis("<b>ważne</b>") ?? "";
check("pogrubienie <b> zachowane", bold.includes("<b>ważne</b>"), bold);

const ital = formatOpis("opis <i>kursywa</i> dalej") ?? "";
check("kursywa <i> zachowana", ital.includes("<i>kursywa</i>"), ital);

const underEsc = formatOpis("&lt;u&gt;tekst&lt;/u&gt;") ?? "";
check("podkreślenie z pojedynczego escape", underEsc.includes("<u>tekst</u>"), underEsc);

const doubleEsc = formatOpis("&amp;lt;b&amp;gt;X&amp;lt;/b&amp;gt;") ?? "";
check("podwójny escape IMO (&amp;lt;b&amp;gt;) -> <b>", doubleEsc.includes("<b>X</b>"), doubleEsc);

const para = formatOpis("Linia1\n\nLinia2") ?? "";
check("akapity z podwójnego entera", para.includes("<p>Linia1</p>") && para.includes("<p>Linia2</p>"), para);

// --- Wklejki z edytorów WYSIWYG / IMO (realny przypadek z produkcji) ---
const bisGarbage =
  '<b>O działkach:</b><div bis_skin_checked="1"><div bis_skin_checked="1">Biuro prezentuje działki.</div><div bis_skin_checked="1">- Działka nr 1 - 1118 m².</div></div>';
const bisOut = formatOpis(bisGarbage) ?? "";
check("śmieć bis_skin_checked nie trafia do tekstu", !bisOut.includes("bis_skin_checked"), bisOut);
check("brak surowego <div w wyniku", !bisOut.toLowerCase().includes("&lt;div"), bisOut);
check("pogrubienie z wklejki zachowane", bisOut.includes("<b>O działkach:</b>"), bisOut);
check("treść z <div> zachowana", bisOut.includes("Biuro prezentuje działki."), bisOut);

const divAttr = formatOpis('<div style="color:red">Tekst</div>') ?? "";
check("atrybut z <div> wycięty, tekst zostaje", divAttr.includes("Tekst") && !divAttr.includes("style"), divAttr);

const boldAttr = formatOpis('<b class="x">Pogrubione</b>') ?? "";
check("atrybut z <b> wycięty, pogrubienie zostaje", boldAttr.includes("<b>Pogrubione</b>"), boldAttr);

const divLines = formatOpis("<div>Linia A</div><div>Linia B</div>") ?? "";
check("sąsiednie <div> to jeden akapit z <br />", divLines.includes("Linia A<br />Linia B"), divLines);

const blankDiv = formatOpis("<div>Akapit 1</div><div><br></div><div>Akapit 2</div>") ?? "";
check("pusty <div><br></div> dzieli akapity", blankDiv.includes("<p>Akapit 1</p>") && blankDiv.includes("<p>Akapit 2</p>"), blankDiv);

const spanUnwrap = formatOpis('<span class="y">Bez span</span>') ?? "";
check("nieznany <span> rozwinięty (tekst zostaje, bez tagu)", spanUnwrap.includes("Bez span") && !spanUnwrap.toLowerCase().includes("span>"), spanUnwrap);

// --- Bezpieczeństwo (XSS musi być zamknięty) ---
const script = (formatOpis("<script>alert(1)</script>") ?? "").toLowerCase();
check("script nie jest aktywnym tagiem", !script.includes("<script"), script);

const img = (formatOpis("<img src=x onerror=alert(1)>") ?? "").toLowerCase();
check("img nie jest aktywnym tagiem", !img.includes("<img"), img);

const attr = (formatOpis("<b onclick=alert(1)>X</b>") ?? "").toLowerCase();
check("tag z atrybutem zdarzenia nie przywrócony", !attr.includes("<b onclick"), attr);

const svg = (formatOpis("&lt;svg onload=alert(1)&gt;") ?? "").toLowerCase();
check("svg onload nie jest aktywnym tagiem", !svg.includes("<svg"), svg);

const iframe = (formatOpis('<iframe src="javascript:alert(1)"></iframe>') ?? "").toLowerCase();
check("iframe usunięty w całości", !iframe.includes("<iframe") && !iframe.includes("javascript:"), iframe);

const jsLink = (formatOpis('<a href="javascript:alert(1)">klik</a>') ?? "").toLowerCase();
check("link javascript: nie staje się aktywnym <a>", !jsLink.includes("<a") && !jsLink.includes("javascript:"), jsLink);

const divEvt = (formatOpis('<div onclick="alert(1)">X</div>') ?? "").toLowerCase();
check("div z onclick bez atrybutu zdarzenia", !divEvt.includes("onclick"), divEvt);

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail > 0 ? 1 : 0);
