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

// --- Bezpieczeństwo (XSS musi być zamknięty) ---
const script = (formatOpis("<script>alert(1)</script>") ?? "").toLowerCase();
check("script nie jest aktywnym tagiem", !script.includes("<script"), script);

const img = (formatOpis("<img src=x onerror=alert(1)>") ?? "").toLowerCase();
check("img nie jest aktywnym tagiem", !img.includes("<img"), img);

const attr = (formatOpis("<b onclick=alert(1)>X</b>") ?? "").toLowerCase();
check("tag z atrybutem zdarzenia nie przywrócony", !attr.includes("<b onclick"), attr);

const svg = (formatOpis("&lt;svg onload=alert(1)&gt;") ?? "").toLowerCase();
check("svg onload nie jest aktywnym tagiem", !svg.includes("<svg"), svg);

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail > 0 ? 1 : 0);
