// Naprawa kolorow w inline-style (style={{...}}) i stalych BG/FG/GREEN, ktorych
// codemod klas nie ruszyl. Zamieniamy zaszyte ciemne hexy na zmienne motywu, zeby
// tlo stron (/, /sprzedaj, /dla-biur, /logowanie*, oferta, formularze) bylo jasne.
// POMIJAMY opengraph-image.tsx (obraz do udostepniania, zostaje ciemny; CSS var i
// tak by tam nie zadzialal w renderze OG).
import { promises as fs } from 'fs';
import path from 'path';

const ROOTS = ['app', 'src'];
const SKIP = /opengraph-image/;

const repl = [
  [/const PAGE_BG = ['"]#131313['"];/g, "const PAGE_BG = 'var(--bg)';"],
  [/const BG = ['"]#131313['"];/g, "const BG = 'var(--bg)';"],
  [/const FG = ['"]#F3EFF5['"];/g, "const FG = 'var(--fg)';"],
  [/const GREEN = ['"]#7aa333['"];/g, "const GREEN = 'var(--brand)';"],
  [/background: "#131313", color: "#F3EFF5"/g, 'background: "var(--bg)", color: "var(--fg)"'],
  [/backgroundColor: '#131313'/g, "backgroundColor: 'var(--surface)'"],
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
    } else if (e.isFile() && p.endsWith('.tsx') && !SKIP.test(p)) {
      acc.push(p);
    }
  }
  return acc;
}

const files = [];
for (const r of ROOTS) await walk(r, files);

let changed = 0;
let total = 0;
for (const f of files) {
  const orig = await fs.readFile(f, 'utf8');
  let out = orig;
  let c = 0;
  for (const [re, to] of repl) out = out.replace(re, () => { c++; return to; });
  if (out !== orig) {
    await fs.writeFile(f, out, 'utf8');
    changed++;
    total += c;
    console.log(`  ${f}`);
  }
}
console.log(`Pliki zmienione: ${changed}, zamian: ${total}`);
