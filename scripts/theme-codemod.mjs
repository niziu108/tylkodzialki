// Codemod motywu: zamiana zaszytych kolorow w klasach Tailwind na tokeny
// semantyczne (faza 2 migracji na jasny motyw). Dziala TYLKO na .tsx i tylko na
// klasach z arbitralnym kolorem (`-[#hex]`) oraz bielach (`*-white`). NIE rusza:
//  - czarnych nakladek na zdjeciach (bg-black, from-black, ...),
//  - solidnego `bg-white` (bez ukosnika) -> recznie,
//  - bladych zieleni (#dce9bf itp.) i jasnych szarosci tla (#e8eaed) -> recznie,
//  - surowych hexow w JS (np. kolory pinow Google Maps: '#7aa333') -> tylko klasy.
import { promises as fs } from 'fs';
import path from 'path';

const ROOTS = ['app', 'src'];

// Kolejnosc MA znaczenie: najpierw przypadki tekstowe (legible green / ink),
// potem ogolne zamiany hexow na tla.
const repl = [
  // zielen marki: tekst (czytelny wariant) PRZED wypelnieniem
  [/text-\[#7aa333\]/g, 'text-brand-text'],
  [/\[#9fd14b\]/g, 'brand-bright'],
  [/\[#8dbb3a\]/g, 'brand-strong'],
  [/\[#7aa333\]/g, 'brand'],

  // ciemny tekst (na zielonych przyciskach / jasnych tlach) -> ink, PRZED tlami
  [/text-\[#131313\]/g, 'text-ink'],
  [/text-\[#0d0d0d\]/g, 'text-ink'],
  [/text-\[#101010\]/g, 'text-ink'],
  [/text-\[#111\]/g, 'text-ink'],

  // szarosci tekstu -> fg z opacity (konsolidacja chaosu szarosci)
  [/text-\[#f3f3f3\]/g, 'text-fg'],
  [/text-\[#F3EFF5\]/g, 'text-fg'],
  [/text-\[#d9d9d9\]/g, 'text-fg/85'],
  [/text-\[#D8D2DB\]/g, 'text-fg/80'],
  [/text-\[#bdbdbd\]/g, 'text-fg/70'],
  [/text-\[#9f9f9f\]/g, 'text-fg/55'],
  [/text-\[#8f8f8f\]/g, 'text-fg/50'],

  // biele -> fg (tekst, tinty, linie)
  [/text-white\b/g, 'text-fg'],
  [/bg-white\//g, 'bg-fg/'],
  [/border-white\//g, 'border-fg/'],
  [/divide-white\//g, 'divide-fg/'],
  [/ring-white\//g, 'ring-fg/'],

  // tlo glowne
  [/\[#131313\]/g, 'bg'],

  // powierzchnie raised (jasniejsze od tla)
  [/\[#1b1b1b\]/g, 'surface'],
  [/\[#1a1a1a\]/g, 'surface'],
  [/\[#181818\]/g, 'surface'],
  [/\[#171717\]/g, 'surface'],
  [/\[#161616\]/g, 'surface'],
  [/\[#151515\]/g, 'surface'],

  // powierzchnie recessed (ciemniejsze od tla: dropdowny, popupy)
  [/\[#0f0f0f\]/g, 'surface-2'],
  [/\[#0d0d0d\]/g, 'surface-2'],
  [/\[#0b0b0b\]/g, 'surface-2'],
  [/\[#111111\]/g, 'surface-2'],
  [/\[#101010\]/g, 'surface-2'],
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

let totalChanged = 0;
let totalRepl = 0;
const report = [];

for (const f of files) {
  const orig = await fs.readFile(f, 'utf8');
  let out = orig;
  let count = 0;
  for (const [re, to] of repl) {
    out = out.replace(re, () => {
      count++;
      return to;
    });
  }
  if (out !== orig) {
    await fs.writeFile(f, out, 'utf8');
    totalChanged++;
    totalRepl += count;
    report.push([count, f]);
  }
}

report.sort((a, b) => b[0] - a[0]);
for (const [c, f] of report) console.log(`${String(c).padStart(4)}  ${f}`);
console.log(`\nPliki zmienione: ${totalChanged}, zamian lacznie: ${totalRepl}`);
