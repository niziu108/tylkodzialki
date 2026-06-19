// Poprawki po codemodzie (faza 2b):
//  1) Tekst/obramowanie NA CIEMNYCH nakladkach zdjec (bg-black/40 i mocniejsze,
//     albo solidny bg-black) musi zostac BIALY niezaleznie od motywu (plakietki,
//     strzalki galerii, licznik zdjec). Codemod zamienil je na text-fg, co na
//     jasnym motywie byloby ciemne-na-ciemnym. Cofamy te przypadki na *-white.
//     UWAGA: bg-black/20..30 (panele/inputy) zostawiamy - to czytelna szarosc na bieli.
//  2) Blade zielenie (tekst na bg-brand/10) -> brand-text (czytelne na bieli).
// Zachowuje oryginalne zakonczenia linii (CRLF/LF), zeby nie robic szumu w diffie.
import { promises as fs } from 'fs';
import path from 'path';

const ROOTS = ['app', 'src'];

// bg-black/40..99 lub solidny bg-black (bez /opacity)
const HIGH = /bg-black\/(4\d|5\d|6\d|7\d|8\d|9\d)\b|bg-black(?![\/\d])/;

const paleGlobal = [
  [/\[#dff2b2\]/g, 'brand-text'],
  [/\[#c8d7a6\]/g, 'brand-text'],
  [/\[#d6dec4\]/g, 'brand-text'],
  [/\[#dce9bf\]/g, 'brand-text'],
  [/\[#b6e35e\]/g, 'brand-text'],
  [/\[#f3ffd7\]/g, 'brand-bright'],
];

async function walk(dir, acc) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
      await walk(p, acc);
    } else if (e.isFile() && p.endsWith('.tsx')) {
      acc.push(p);
    }
  }
  return acc;
}

const files = [];
for (const r of ROOTS) await walk(r, files);

let changed = 0;
let reverts = 0;
let pales = 0;

for (const f of files) {
  const orig = await fs.readFile(f, 'utf8');
  const nl = orig.includes('\r\n') ? '\r\n' : '\n';

  let out = orig
    .split(/\r?\n/)
    .map((line) => {
      if (HIGH.test(line)) {
        line = line
          .replace(/text-fg(\/\d+)?/g, (m, o) => { reverts++; return 'text-white' + (o || ''); })
          .replace(/border-fg(\/\d+)?/g, (m, o) => { reverts++; return 'border-white' + (o || ''); });
      }
      return line;
    })
    .join(nl);

  for (const [re, to] of paleGlobal) {
    out = out.replace(re, () => { pales++; return to; });
  }

  if (out !== orig) {
    await fs.writeFile(f, out, 'utf8');
    changed++;
  }
}

console.log(`Pliki zmienione: ${changed}, cofniete na white: ${reverts}, blade zielenie: ${pales}`);
