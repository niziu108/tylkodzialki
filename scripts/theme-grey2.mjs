// Drugie, delikatne podbicie szarosci (uwaga: „troszeczke ciemniejszy, nie tak
// szary"). Pojedyncze przejscie z mapowaniem (bez kaskady). Tylko text-fg/NN.
import { promises as fs } from 'fs';
import path from 'path';

const ROOTS = ['app', 'src'];
const map = { '50': '58', '55': '62', '58': '64', '60': '66', '62': '68', '65': '70', '66': '70' };

async function walk(dir, acc) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
      await walk(p, acc);
    } else if (e.isFile() && p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

const files = [];
for (const r of ROOTS) await walk(r, files);

let changed = 0, total = 0;
for (const f of files) {
  const orig = await fs.readFile(f, 'utf8');
  let c = 0;
  const out = orig.replace(/text-fg\/(\d+)/g, (m, n) => { if (map[n]) { c++; return `text-fg/${map[n]}`; } return m; });
  if (out !== orig) { await fs.writeFile(f, out, 'utf8'); changed++; total += c; }
}
console.log(`Pliki: ${changed}, nudge szarosci: ${total}`);
