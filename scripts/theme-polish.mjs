// Polish jasnego motywu:
//  1) Panele bg-black/20 i /25 (admin, CRM, panel klienta, blog, sekcje) -> biale
//     karty (bg-surface). Na bieli czarna nakladka wygladala szaro.
//  2) Cienie projektowane pod czern (rgba(0,0,0,0.3..0.6)) zmiekczone na jasny.
//     Dotyczy tylko box-shadow w shadow-[...], NIE text-shadow (np. na hero).
//  3) Dekoracyjne ciemne smugi (radial teal) prawie wygaszone na bieli.
import { promises as fs } from 'fs';
import path from 'path';

const ROOTS = ['app', 'src'];

const repl = [
  [/bg-black\/20\b/g, 'bg-surface'],
  [/bg-black\/25\b/g, 'bg-surface'],

  [/shadow-\[0_0_28px_rgba\(0,0,0,0\.35\)\]/g, 'shadow-[0_0_22px_rgba(0,0,0,0.08)]'],
  [/shadow-\[0_10px_30px_rgba\(0,0,0,0\.5\)\]/g, 'shadow-[0_10px_30px_rgba(0,0,0,0.10)]'],
  [/shadow-\[0_24px_80px_rgba\(0,0,0,0\.55\)\]/g, 'shadow-[0_24px_80px_rgba(0,0,0,0.12)]'],
  [/shadow-\[0_24px_80px_rgba\(0,0,0,0\.5\)\]/g, 'shadow-[0_24px_80px_rgba(0,0,0,0.12)]'],
  [/shadow-\[0_12px_40px_rgba\(0,0,0,0\.6\)\]/g, 'shadow-[0_12px_40px_rgba(0,0,0,0.12)]'],
  [/shadow-\[0_12px_40px_rgba\(0,0,0,0\.35\)\]/g, 'shadow-[0_12px_40px_rgba(0,0,0,0.10)]'],
  [/shadow-\[0_0_70px_rgba\(0,0,0,0\.20\)\]/g, 'shadow-[0_0_50px_rgba(0,0,0,0.06)]'],
  [/shadow-\[0_20px_60px_rgba\(0,0,0,0\.45\)\]/g, 'shadow-[0_20px_60px_rgba(0,0,0,0.10)]'],
  [/shadow-\[0_8px_24px_rgba\(0,0,0,0\.5\)\]/g, 'shadow-[0_8px_24px_rgba(0,0,0,0.10)]'],
  [/shadow-\[0_18px_60px_rgba\(0,0,0,0\.6\)\]/g, 'shadow-[0_18px_60px_rgba(0,0,0,0.12)]'],

  [/rgba\(47,94,70,0\.18\)/g, 'rgba(47,94,70,0.05)'],
  [/rgba\(47,94,70,0\.22\)/g, 'rgba(47,94,70,0.05)'],
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
  }
}
console.log(`Pliki zmienione: ${changed}, zamian: ${total}`);
