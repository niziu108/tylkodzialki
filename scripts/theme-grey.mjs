// Podbicie kontrastu tekstu drugorzednego (szarosci) na jasnym motywie.
// Na bieli text-fg/35..60 bylo za blade (uwaga Pauli: za malo widoczne).
// Pojedyncze przejscie z mapowaniem (bez kaskady): kazdy text-fg/NN mapowany
// raz wg tabeli ponizej. Nie rusza text-white/*, border-fg/*, bg-fg/*.
import { promises as fs } from 'fs';
import path from 'path';

const ROOTS = ['app', 'src'];
const map = { '35': '55', '40': '58', '45': '62', '50': '66', '55': '70', '60': '72' };

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
let total = 0;
for (const f of files) {
  const orig = await fs.readFile(f, 'utf8');
  let c = 0;
  const out = orig.replace(/text-fg\/(\d+)/g, (m, n) => {
    if (map[n]) { c++; return `text-fg/${map[n]}`; }
    return m;
  });
  if (out !== orig) {
    await fs.writeFile(f, out, 'utf8');
    changed++;
    total += c;
  }
}
console.log(`Pliki zmienione: ${changed}, podbic szarosci: ${total}`);
