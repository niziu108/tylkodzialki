// Raport „Sprawdź działkę" jako gotowy plik PDF: jedna strona A4, z mapą i obrysem działki.
//
// Dlaczego nie okno drukowania: wydruk z przeglądarki dawał kilka kartek (ukryta reszta strony
// nadal zajmowała miejsce w układzie), bez zdjęcia terenu i bez kontroli nad tym, co ląduje na
// papierze. Tu składamy dokładnie te dane, które użytkownik widzi na ekranie, w jednym pliku,
// który da się wysłać mailem albo zabrać do gminy.
//
// Bez nowych zależności: pdf-lib + fontkit i fonty Inter są już w projekcie, tło mapy bierzemy
// z darmowej ortofotomapy GUGiK (bez płatnego Static Maps, [[project-geocoding-cost-incident]]).

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from 'pdf-lib';
import { formatIntPL } from './format';
import type { MpzpInfo } from './mpzp';
import { decydujCene } from './raportCena';
import type { PointValuation } from './seoHub';
import type { LatLng, ParcelReport } from './uldk';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 42;
const CONTENT_W = A4.w - MARGIN * 2;

const BRAND = rgb(0.478, 0.639, 0.2); // #7aa333
const FG = rgb(0.1, 0.1, 0.09);
const MUTED = rgb(0.45, 0.45, 0.44);
const LINE = rgb(0.85, 0.85, 0.83);

const ORTO_WMS = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/HighResolution';
const MAP_H = 224; // wysokość kadru mapy w punktach PDF

type Fonts = { regular: PDFFont; bold: PDFFont };

// ── Pomocnicze ───────────────────────────────────────────────────────────────

function to3857(lat: number, lng: number): { x: number; y: number } {
  const R = 20037508.34;
  const x = (lng * R) / 180;
  const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * (R / 180);
  return { x, y };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function areaLabel(m2: number): string {
  const base = `${formatIntPL(m2)} m2`;
  if (m2 >= 5000) return `${base} · ${(m2 / 10000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} ha`;
  if (m2 >= 1000) return `${base} · ${(m2 / 100).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} ar`;
  return base;
}

// „m²" i podobne znaki spoza Latin-1 potrafią nie mieć glifu w osadzonym podzbiorze — a pdf-lib
// rzuca wtedy wyjątkiem w środku generowania. Trzymamy się bezpiecznego zapisu.
function safe(text: string): string {
  return text
    .replace(/²/g, '2')
    .replace(/[„”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/–/g, '-')
    .replace(/ /g, ' ');
}

class Cursor {
  y: number;
  constructor(
    private page: PDFPage,
    private fonts: Fonts,
    startY: number
  ) {
    this.y = startY;
  }

  space(v: number) {
    this.y -= v;
  }

  rule(color: RGB = LINE) {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT_W, y: this.y },
      thickness: 0.7,
      color,
    });
  }

  eyebrow(text: string) {
    this.page.drawText(safe(text.toUpperCase()), {
      x: MARGIN,
      y: this.y,
      size: 7.5,
      font: this.fonts.bold,
      color: BRAND,
    });
    this.y -= 15;
  }

  heading(text: string, size = 22) {
    this.page.drawText(safe(text), {
      x: MARGIN,
      y: this.y - size * 0.78,
      size,
      font: this.fonts.bold,
      color: FG,
    });
    this.y -= size * 1.05;
  }

  paragraph(text: string, opts: { size?: number; color?: RGB; bold?: boolean; maxLines?: number } = {}) {
    const size = opts.size ?? 9.5;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const lines = wrapText(safe(text), font, size, CONTENT_W);
    const shown = opts.maxLines ? lines.slice(0, opts.maxLines) : lines;
    for (const line of shown) {
      this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font, color: opts.color ?? MUTED });
      this.y -= size * 1.55;
    }
  }

  row(label: string, value: string) {
    const size = 9.5;
    this.page.drawText(safe(label.toUpperCase()), {
      x: MARGIN,
      y: this.y - size,
      size: 7.5,
      font: this.fonts.regular,
      color: MUTED,
    });
    const val = safe(value);
    const maxW = CONTENT_W - 150;
    const fitted = wrapText(val, this.fonts.bold, size, maxW)[0] ?? val;
    this.page.drawText(fitted, {
      x: MARGIN + 150,
      y: this.y - size,
      size,
      font: this.fonts.bold,
      color: FG,
    });
    this.y -= 20;
    this.rule();
  }
}

// ── Mapa: ortofotomapa GUGiK + obrys działki ─────────────────────────────────

type MapaKadr = { bytes: Uint8Array; jpeg: boolean; box: { minX: number; minY: number; maxX: number; maxY: number } };

export async function pobierzKadr(parcel: ParcelReport): Promise<MapaKadr | null> {
  const pts: LatLng[] = parcel.rings.flat();
  if (!pts.length) return null;

  const xy = pts.map((p) => to3857(p.lat, p.lng));
  const minX = Math.min(...xy.map((p) => p.x));
  const maxX = Math.max(...xy.map((p) => p.x));
  const minY = Math.min(...xy.map((p) => p.y));
  const maxY = Math.max(...xy.map((p) => p.y));

  // Kadr w proporcji obrazka w PDF, z zapasem dookoła działki, żeby było widać sąsiedztwo.
  const aspect = CONTENT_W / MAP_H;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const halfW = Math.max((maxX - minX) / 2, ((maxY - minY) / 2) * aspect) * 1.35;
  const halfH = halfW / aspect;
  const box = { minX: cx - halfW, minY: cy - halfH, maxX: cx + halfW, maxY: cy + halfH };

  const url = new URL(ORTO_WMS);
  const params: Record<string, string> = {
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'Raster',
    STYLES: '',
    CRS: 'EPSG:3857',
    BBOX: `${box.minX},${box.minY},${box.maxX},${box.maxY}`,
    WIDTH: String(Math.round(CONTENT_W * 2)),
    HEIGHT: String(Math.round(MAP_H * 2)),
    FORMAT: 'image/jpeg',
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    const ctype = res.headers.get('content-type') ?? '';
    if (!ctype.startsWith('image/')) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, jpeg: ctype.includes('jpeg') || ctype.includes('jpg'), box };
  } catch {
    return null;
  }
}

// Obrys działki jako ścieżka SVG w układzie obrazka (y rośnie w dół, tak jak w SVG).
export function obrysSvgPath(parcel: ParcelReport, box: MapaKadr['box']): string {
  const sx = CONTENT_W / (box.maxX - box.minX);
  const sy = MAP_H / (box.maxY - box.minY);
  const parts: string[] = [];
  for (const ring of parcel.rings) {
    if (ring.length < 3) continue;
    const pts = ring.map((p) => {
      const { x, y } = to3857(p.lat, p.lng);
      return `${((x - box.minX) * sx).toFixed(2)},${((box.maxY - y) * sy).toFixed(2)}`;
    });
    parts.push(`M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`);
  }
  return parts.join(' ');
}

// ── Fonty ────────────────────────────────────────────────────────────────────

// Na Vercelu katalog `public` jedzie razem z funkcją, ale gdyby odczyt z dysku zawiódł
// (inny tryb budowania), sięgamy po ten sam plik po HTTP z własnego origin.
async function wczytajFont(nazwa: string, origin: string | null): Promise<Uint8Array> {
  try {
    const buf = await readFile(path.join(process.cwd(), 'public', 'fonts', nazwa));
    return new Uint8Array(buf);
  } catch {
    if (!origin) throw new Error(`Brak fontu ${nazwa}`);
    const res = await fetch(new URL(`/fonts/${nazwa}`, origin).toString());
    if (!res.ok) throw new Error(`Brak fontu ${nazwa} (HTTP ${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

// ── Główna funkcja ───────────────────────────────────────────────────────────

export type RaportPdfInput = {
  parcel: ParcelReport;
  valuation: PointValuation;
  mpzp: MpzpInfo | null;
  origin: string | null;
};

export async function generujRaportPdf({ parcel, valuation, mpzp, origin }: RaportPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    wczytajFont('Inter-Regular.ttf', origin),
    wczytajFont('Inter-Bold.ttf', origin),
  ]);
  const fonts: Fonts = {
    regular: await doc.embedFont(regularBytes, { subset: true }),
    bold: await doc.embedFont(boldBytes, { subset: true }),
  };

  const page = doc.addPage([A4.w, A4.h]);
  const c = new Cursor(page, fonts, A4.h - MARGIN);

  // NAGŁÓWEK
  page.drawText(safe('TYLKODZIALKI.PL · RAPORT DZIALKI'), {
    x: MARGIN,
    y: c.y - 8,
    size: 8,
    font: fonts.bold,
    color: MUTED,
  });
  const dataTxt = new Date().toLocaleDateString('pl-PL');
  page.drawText(dataTxt, {
    x: MARGIN + CONTENT_W - fonts.regular.widthOfTextAtSize(dataTxt, 8),
    y: c.y - 8,
    size: 8,
    font: fonts.regular,
    color: MUTED,
  });
  c.space(16);
  c.rule();
  c.space(26);

  // TWOJA DZIAŁKA
  c.eyebrow('Twoja działka');
  c.heading(areaLabel(parcel.areaM2), 24);
  c.space(4);
  c.paragraph([parcel.commune, parcel.county, parcel.voivodeship].filter(Boolean).join(' · '), {
    size: 10,
    color: MUTED,
  });
  if (parcel.dims) {
    c.paragraph(
      `Numer działki ${parcel.parcelNumber} · w przybliżeniu ${formatIntPL(parcel.dims.widthM)} na ${formatIntPL(parcel.dims.depthM)} m`,
      { size: 9, color: MUTED }
    );
  } else {
    c.paragraph(`Numer działki ${parcel.parcelNumber}`, { size: 9, color: MUTED });
  }
  c.space(10);

  // MAPA
  const kadr = await pobierzKadr(parcel);
  if (kadr) {
    try {
      const img = kadr.jpeg ? await doc.embedJpg(kadr.bytes) : await doc.embedPng(kadr.bytes);
      const top = c.y;
      page.drawImage(img, { x: MARGIN, y: top - MAP_H, width: CONTENT_W, height: MAP_H });
      const d = obrysSvgPath(parcel, kadr.box);
      if (d) {
        page.drawSvgPath(d, {
          x: MARGIN,
          y: top,
          borderColor: BRAND,
          borderWidth: 1.6,
          color: BRAND,
          opacity: 0.22,
        });
      }
      page.drawRectangle({
        x: MARGIN,
        y: top - MAP_H,
        width: CONTENT_W,
        height: MAP_H,
        borderColor: LINE,
        borderWidth: 0.7,
      });
      c.space(MAP_H + 8);
      c.paragraph('Obrys działki z ewidencji gruntów (ULDK, GUGiK) na ortofotomapie.', {
        size: 7.5,
        color: MUTED,
      });
      c.space(6);
    } catch {
      // Mapa jest dodatkiem — gdy nie da się jej osadzić, raport i tak ma wyjść.
    }
  }

  // CENA
  c.rule();
  c.space(22);
  c.eyebrow('Orientacyjna cena okolicy');
  const { lead, value, mixed } = decydujCene(valuation, mpzp);
  if (value && lead) {
    const glowna = mixed
      ? `${formatIntPL(value.low)}-${formatIntPL(value.high)} zł/m2`
      : `${formatIntPL(value.median)} zł/m2`;
    c.heading(glowna, 20);
    c.space(2);
    c.paragraph(lead.label, { size: 8.5, color: BRAND, bold: true });
    c.space(2);
    const opis =
      lead.kind === 'similar' && valuation.similarSizeBand
        ? `Porównaliśmy do działek o powierzchni od ${formatIntPL(valuation.similarSizeBand.minM2)} do ${formatIntPL(valuation.similarSizeBand.maxM2)} m2, w promieniu ${valuation.radiusKm} km. Większość z nich mieści się między ${formatIntPL(value.low)} a ${formatIntPL(value.high)} zł/m2.`
        : mixed
          ? `Ceny w tej okolicy rozjeżdżają się za mocno, żeby podać jedną liczbę: w promieniu ${valuation.radiusKm} km jest zarówno teren zabudowany, jak i tańsze działki poza nim.`
          : `Zakres od ${formatIntPL(value.low)} do ${formatIntPL(value.high)} zł/m2, w promieniu ${valuation.radiusKm} km.`;
    c.paragraph(
      `${opis} Liczone z ${lead.stat.sampleCount} ${lead.stat.sampleCount === 1 ? 'oferty' : 'ofert'} w serwisie tylkodzialki.pl. To orientacja z ogłoszeń, nie operat rzeczoznawcy.`,
      { size: 9 }
    );

    if (valuation.factors.length) {
      c.space(6);
      c.paragraph('Co podnosi cenę działki (cały rynek, nie ta ulica):', { size: 8.5, bold: true, color: FG });
      for (const f of valuation.factors) {
        c.paragraph(
          `${f.label}: +${Math.round(f.delta * 100)}%  (${formatIntPL(f.withMedian)} zamiast ${formatIntPL(f.withoutMedian)} zł/m2)`,
          { size: 8.5 }
        );
      }
    }
  } else {
    c.paragraph(
      `W promieniu ${valuation.radiusKm} km jest zbyt mało porównywalnych działek, żeby uczciwie oszacować cenę. Nie zgadujemy.`,
      { size: 9 }
    );
  }
  c.space(14);

  // PLAN MIEJSCOWY
  c.rule();
  c.space(22);
  c.eyebrow('Plan miejscowy (MPZP)');
  if (mpzp) {
    const przeznaczenie = mpzp.functionName
      ? mpzp.functionSymbol
        ? `${mpzp.functionName} (${mpzp.functionSymbol})`
        : mpzp.functionName
      : mpzp.functionSymbol;
    c.paragraph(
      `Dla tej działki obowiązuje miejscowy plan zagospodarowania${mpzp.planName ? ` "${mpzp.planName}"` : ''}.`,
      { size: 9, color: FG }
    );
    c.space(4);
    if (przeznaczenie) c.row('Przeznaczenie', przeznaczenie);
    if (mpzp.maxHeight) c.row('Maks. wysokość zabudowy', `${mpzp.maxHeight} m`);
    if (mpzp.intensity) c.row('Intensywność zabudowy', mpzp.intensity);
    if (mpzp.resolution) c.row('Uchwała', mpzp.resolution);
  } else {
    c.paragraph(
      'W tym punkcie nie ma planu miejscowego w krajowej integracji. Zwykle znaczy to, że o zabudowie decydują warunki zabudowy (WZ). Potwierdź to w gminie.',
      { size: 9 }
    );
  }
  c.space(14);

  // EWIDENCJA
  c.rule();
  c.space(22);
  c.eyebrow('Dane z ewidencji');
  c.space(2);
  c.rule();
  c.space(2);
  c.row('Numer działki', parcel.parcelNumber);
  c.row('Obręb', parcel.region);
  c.row('Identyfikator', parcel.id);
  c.row('Gmina', parcel.commune);
  c.row('Powiat', parcel.county);
  c.row('Województwo', parcel.voivodeship);

  // STOPKA
  const stopkaY = MARGIN + 18;
  page.drawLine({
    start: { x: MARGIN, y: stopkaY + 14 },
    end: { x: MARGIN + CONTENT_W, y: stopkaY + 14 },
    thickness: 0.7,
    color: LINE,
  });
  page.drawText(safe('tylkodzialki.pl/sprawdz-dzialke'), {
    x: MARGIN,
    y: stopkaY,
    size: 8,
    font: fonts.bold,
    color: BRAND,
  });
  const zrodla = safe('Dane: ewidencja gruntów (ULDK, GUGiK), plany miejscowe (KIMPZP), ceny z ogłoszeń w serwisie.');
  page.drawText(zrodla, {
    x: MARGIN + CONTENT_W - fonts.regular.widthOfTextAtSize(zrodla, 7),
    y: stopkaY,
    size: 7,
    font: fonts.regular,
    color: MUTED,
  });

  return doc.save();
}
