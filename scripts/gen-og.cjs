// Generator obrazu Open Graph 1200x630 (public/og.png) — kafel podglądu linku.
// Styl marki: jasne tlo #f6f7f3 + spotlight u gory (jak HeroGradientBg), logo
// (public/logomail.png), zielona linia i tagline. Tagline -> KRZYWE (Segoe UI
// Semilight, bo firmowy Jost jest okrojony i nie ma ł/ż). sharp -> PNG.
const opentype = require('opentype.js');
const sharp = require('sharp');
const fs = require('fs');

const tagFont = opentype.parse(fs.readFileSync('C:/Windows/Fonts/segoeuisl.ttf')); // Segoe UI Semilight

const W = 1200;
const H = 630;
const GREEN = '#7aa333';
const MUTED = '#5b6152';
const BG = '#f6f7f3';

// --- Tagline jako krzywe (z lekkim trackingiem) ---
function buildRun(text, font, size) {
  const tr = size * 0.01;
  let x = 0;
  const paths = [];
  for (const ch of text) {
    paths.push(font.getPath(ch, x, 0, size));
    x += font.getAdvanceWidth(ch, size) + tr;
  }
  let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  for (const p of paths) {
    const b = p.getBoundingBox();
    x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1);
    x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2);
  }
  return { paths, box: { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 } };
}

const tag = buildRun('Działki na sprzedaż w całej Polsce.', tagFont, 60);

// --- Logo (napis tylkodziałki) jako osadzony obraz ---
const logoBuf = fs.readFileSync('public/logomail.png');
const LOGO_NAT_W = 1024, LOGO_NAT_H = 253;
const LOGO_W = 620;
const LOGO_H = LOGO_W * (LOGO_NAT_H / LOGO_NAT_W);
const logoX = (W - LOGO_W) / 2;
const logoY = 250 - LOGO_H / 2; // srodek logo ~ y=250
const logoHref = `data:image/png;base64,${logoBuf.toString('base64')}`;

// Zielona linia pod logo
const ruleY = logoY + LOGO_H + 46;
const ruleW = 72;

// Tagline: wysrodkowany pod linia
const TAG_W = Math.min(tag.box.w, 780);
const tagScale = TAG_W / tag.box.w;
const tagX = (W - TAG_W) / 2;
const tagY = ruleY + 40;
const tagTransform = `translate(${(tagX - tagScale * tag.box.x1).toFixed(2)} ${(tagY - tagScale * tag.box.y1).toFixed(2)}) scale(${tagScale.toFixed(4)})`;
const tagPaths = tag.paths.map((p) => `<path d="${p.toPathData(2)}" fill="${MUTED}"/>`).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
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
  <image x="${logoX.toFixed(1)}" y="${logoY.toFixed(1)}" width="${LOGO_W}" height="${LOGO_H.toFixed(1)}" xlink:href="${logoHref}"/>
  <rect x="${(W - ruleW) / 2}" y="${ruleY.toFixed(1)}" width="${ruleW}" height="3" rx="1.5" fill="${GREEN}"/>
  <g transform="${tagTransform}">${tagPaths}</g>
</svg>`;

(async () => {
  await sharp(Buffer.from(svg)).png().toFile('public/og.png');
  console.log('OK -> public/og.png (1200x630)');
})();
