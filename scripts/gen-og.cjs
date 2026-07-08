// Generator obrazu Open Graph 1200x630 (public/og.png) — kafel podglądu linku.
// Styl marki: jasne tlo #f6f7f3 + spotlight u gory (jak HeroGradientBg), wordmark
// „tylkodzialki.pl" (zielone d) i tagline. Tekst -> KRZYWE (Jost), wiec render jest
// wierny niezaleznie od fontow. sharp -> PNG.
const opentype = require('opentype.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const light = opentype.parse(fs.readFileSync('scripts/_brandfonts/jost-200.woff')); // hairline (wordmark)
const heavy = opentype.parse(fs.readFileSync('scripts/_brandfonts/jost-900.woff')); // d (grube)
// Jost jest okrojony do znakow wordmarku (brak ł/ż itd.) — tagline z pełnym krojem PL.
const tagFont = opentype.parse(fs.readFileSync('C:/Windows/Fonts/segoeuisl.ttf')); // Segoe UI Semilight

const W = 1200;
const H = 630;
const GREEN = '#7aa333';
const INK = '#15150f';
const MUTED = '#5b6152';
const BG = '#f6f7f3';

// --- Budowa napisu jako krzywych, z lekkim trackingiem jak w logomail ---
function buildRun(spec, size) {
  // spec: tablica { ch, font, arr } — zwraca { paths, greenPaths, box }
  const tr = size * 0.015;
  let x = 0;
  const paths = [];
  const greens = [];
  for (const s of spec) {
    const p = s.font.getPath(s.ch, x, 0, size);
    (s.green ? greens : paths).push(p);
    x += s.font.getAdvanceWidth(s.ch, size) + tr;
  }
  const all = [...paths, ...greens];
  let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  for (const p of all) {
    const b = p.getBoundingBox();
    x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1);
    x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2);
  }
  return { paths, greens, box: { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 } };
}

// Wordmark „tylkodzialki.pl"
const wmSpec = [];
for (const ch of 'tylko') wmSpec.push({ ch, font: light });
wmSpec.push({ ch: 'd', font: heavy, green: true });
for (const ch of 'zialki.pl') wmSpec.push({ ch, font: light });
const wm = buildRun(wmSpec, 240);

// Tagline
const tagSpec = [];
for (const ch of 'Działki na sprzedaż w całej Polsce') tagSpec.push({ ch, font: tagFont });
const tag = buildRun(tagSpec, 60);

// --- Rozmieszczenie ---
// Wordmark: docelowa szerokosc, wysrodkowany w poziomie, lekko nad srodkiem.
const WM_W = 660;
const wmScale = WM_W / wm.box.w;
const wmH = wm.box.h * wmScale;
const wmX = (W - WM_W) / 2;
const wmY = 250 - wmH / 2; // srodek wordmarku ~ y=250
const wmTransform = `translate(${(wmX - wmScale * wm.box.x1).toFixed(2)} ${(wmY - wmScale * wm.box.y1).toFixed(2)}) scale(${wmScale.toFixed(4)})`;

// Zielona linia pod wordmarkiem
const ruleY = wmY + wmH + 46;
const ruleW = 72;

// Tagline: wysrodkowany pod linia
const TAG_W = Math.min(tag.box.w, 760);
const tagScale = TAG_W / tag.box.w;
const tagX = (W - TAG_W) / 2;
const tagY = ruleY + 40;
const tagTransform = `translate(${(tagX - tagScale * tag.box.x1).toFixed(2)} ${(tagY - tagScale * tag.box.y1).toFixed(2)}) scale(${tagScale.toFixed(4)})`;

const wmPaths = wm.paths.map((p) => `<path d="${p.toPathData(2)}" fill="${INK}"/>`).join('');
const wmGreen = wm.greens.map((p) => `<path d="${p.toPathData(2)}" fill="${GREEN}"/>`).join('');
const tagPaths = tag.paths.map((p) => `<path d="${p.toPathData(2)}" fill="${MUTED}"/>`).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="spot" cx="50%" cy="0%" r="78%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.20"/>
      <stop offset="42%" stop-color="${GREEN}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#spot)"/>
  <rect x="0" y="${H - 180}" width="${W}" height="180" fill="url(#floor)"/>
  <g transform="${wmTransform}">${wmPaths}${wmGreen}</g>
  <rect x="${(W - ruleW) / 2}" y="${ruleY.toFixed(1)}" width="${ruleW}" height="3" rx="1.5" fill="${GREEN}"/>
  <g transform="${tagTransform}">${tagPaths}</g>
</svg>`;

(async () => {
  fs.writeFileSync('public/og.png.svg.tmp', svg); // pomocniczo do podgladu, kasowane nizej
  await sharp(Buffer.from(svg)).png().toFile('public/og.png');
  fs.unlinkSync('public/og.png.svg.tmp');
  console.log('OK -> public/og.png (1200x630)');
})();
