'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatIntPL } from '@/lib/format';
import type { ParcelReport } from '@/lib/uldk';
import type { PointValuation } from '@/lib/seoHub';
import type { MpzpInfo } from '@/lib/mpzp';
import RaportMap from './RaportMap';

// P24: raport „Sprawdź działkę" — układ redakcyjny (wszystko od lewej, cienkie linie zamiast
// kafelków), zielone nagłówki. Mapa schowana za przyciskiem „Zobacz na mapie", żeby nie dominowała.
// Zero zmyślania: co niepewne, odsyłamy do źródła ([[feedback-filtry-twarde]]).

export type RaportData = {
  parcel: ParcelReport;
  valuation: PointValuation;
  mpzp: MpzpInfo | null;
};

const NEXT_STEPS: { href: string; label: string }[] = [
  { href: '/blog/jak-sprawdzic-mpzp-dzialki-przed-zakupem', label: 'Jak czytać plan miejscowy (MPZP)' },
  { href: '/blog/jak-sprawdzic-klase-gruntu-dzialki-przed-zakupem', label: 'Jak sprawdzić klasę gruntu' },
  { href: '/blog/jak-sprawdzic-uzbrojenie-dzialki-przed-zakupem', label: 'Jak sprawdzić uzbrojenie' },
  { href: '/blog/jak-sprawdzic-droge-dojazdowa-do-dzialki-przed-zakupem', label: 'Jak sprawdzić drogę dojazdową' },
  { href: '/blog/jak-sprawdzic-ksiege-wieczysta-dzialki-przed-zakupem', label: 'Jak sprawdzić księgę wieczystą' },
  { href: '/blog/jak-sprawdzic-dzialke-przed-zakupem', label: 'Pełna checklista przed zakupem' },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] uppercase tracking-[0.2em] text-brand-text">{children}</div>;
}

function areaLabel(m2: number): string {
  const base = `${formatIntPL(m2)} m²`;
  if (m2 >= 5000) return `${base} · ${(m2 / 10000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} ha`;
  if (m2 >= 1000) return `${base} · ${(m2 / 100).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} ar`;
  return base;
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[10rem_1fr] items-baseline gap-x-6 border-b border-fg/10 py-3 md:grid-cols-[14rem_1fr]">
      <span className="text-[13px] uppercase tracking-[0.1em] text-fg/45">{label}</span>
      <span className="text-[15px] font-medium text-fg">{value}</span>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Obrys działki jako wektorowy SVG (rzut równopoludnikowy skalowany cos(lat) — dokładny
// w skali jednej działki). Bez kafli mapy => brak problemów z CORS/canvas, ładne w druku.
function buildParcelSvg(rings: { lat: number; lng: number }[][]): string {
  const outer = rings[0];
  if (!outer || outer.length < 3) return '';
  const lat0 = outer.reduce((s, p) => s + p.lat, 0) / outer.length;
  const k = Math.cos((lat0 * Math.PI) / 180) || 1;
  const proj = rings.map((r) => r.map((p) => ({ x: p.lng * k, y: -p.lat })));
  const flat = proj.flat();
  const xs = flat.map((p) => p.x);
  const ys = flat.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const pad = 0.1 * Math.max(w, h);
  const vb = `${minX - pad} ${minY - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const d = proj.map((r) => `M ${r.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`).join(' ');
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block"><path d="${d}" fill="rgba(122,163,51,0.16)" stroke="#7aa333" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}

// „Pobierz PDF": otwiera dopracowany, brandowany widok raportu i wywołuje druk (Zapisz jako PDF).
// Bez biblioteki => zero wagi w bundlu (ważne po sprincie szybkości).
function downloadReportPdf(data: RaportData) {
  const { parcel, valuation, mpzp } = data;
  const v = valuation.pricePerM2;

  const admin = [parcel.commune, parcel.county, parcel.voivodeship].filter(Boolean).join(' · ');
  const svg = buildParcelSvg(parcel.rings);

  const rows: { label: string; value: string | null }[] = [
    { label: 'Numer działki', value: parcel.parcelNumber },
    { label: 'Obręb', value: parcel.region },
    { label: 'Identyfikator', value: parcel.id },
    { label: 'Gmina', value: parcel.commune },
    { label: 'Powiat', value: parcel.county },
    { label: 'Województwo', value: parcel.voivodeship },
  ];
  if (parcel.dims) {
    rows.splice(1, 0, {
      label: 'Wymiary (orientacyjnie)',
      value: `${formatIntPL(Math.round(parcel.dims.widthM))} × ${formatIntPL(Math.round(parcel.dims.depthM))} m`,
    });
  }

  const rowsHtml = rows
    .filter((r) => r.value)
    .map(
      (r) =>
        `<tr><td class="k">${escapeHtml(r.label)}</td><td class="val">${escapeHtml(r.value as string)}</td></tr>`
    )
    .join('');

  const mpzpFn = mpzp
    ? mpzp.functionName
      ? mpzp.functionSymbol
        ? `${mpzp.functionName} (${mpzp.functionSymbol})`
        : mpzp.functionName
      : mpzp.functionSymbol
    : null;

  const mpzpHtml = mpzp
    ? `<table class="rows">
        ${mpzp.planName ? `<tr><td class="k">Plan</td><td class="val">${escapeHtml(mpzp.planName)}</td></tr>` : ''}
        ${mpzpFn ? `<tr><td class="k">Przeznaczenie</td><td class="val">${escapeHtml(mpzpFn)}</td></tr>` : ''}
        ${mpzp.maxHeight ? `<tr><td class="k">Maks. wysokość zabudowy</td><td class="val">${escapeHtml(String(mpzp.maxHeight))} m</td></tr>` : ''}
        ${mpzp.intensity ? `<tr><td class="k">Intensywność zabudowy</td><td class="val">${escapeHtml(mpzp.intensity)}</td></tr>` : ''}
      </table>`
    : `<p class="muted">W tym punkcie nie ma planu miejscowego w krajowej integracji. Zwykle znaczy to, że o zabudowie decydują warunki zabudowy (WZ). Dopytaj w gminie.</p>`;

  const priceHtml = v
    ? `<div class="big">${escapeHtml(formatIntPL(v.median))} <span class="unit">zł/m²</span></div>
       <p class="muted">${
         v.low === v.high
           ? `${escapeHtml(formatIntPL(v.low))} zł/m²`
           : `Zakres od ${escapeHtml(formatIntPL(v.low))} do ${escapeHtml(formatIntPL(v.high))} zł/m²`
       } · z ${valuation.sampleCount} ${valuation.sampleCount === 1 ? 'oferty' : 'ofert'} w promieniu ${valuation.radiusKm} km. Orientacja z ogłoszeń, nie operat rzeczoznawcy.</p>`
    : `<p class="muted">W promieniu ${valuation.radiusKm} km jest zbyt mało porównywalnych działek, żeby uczciwie oszacować cenę.</p>`;

  const today = new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>Raport działki ${escapeHtml(parcel.parcelNumber)} — tylkodzialki.pl</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1b1e17; }
  .page { max-width: 760px; margin: 0 auto; padding: 40px 44px; }
  .top { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #7aa333; padding-bottom: 16px; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
  .brand span { color: #7aa333; }
  .kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; color: #7aa333; }
  h1 { font-size: 30px; margin: 6px 0 2px; letter-spacing: -0.02em; }
  .sub { color: #5b6152; font-size: 14px; margin: 0; }
  .grid { display: flex; gap: 28px; margin-top: 24px; align-items: stretch; }
  .map { flex: 0 0 210px; border: 1px solid #e2e5db; border-radius: 14px; padding: 12px; height: 210px; background: #fafbf7; }
  .side { flex: 1; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.16em; color: #7aa333; margin: 26px 0 8px; }
  .big { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; }
  .unit { font-size: 16px; font-weight: 500; color: #6a7060; }
  .muted { color: #5b6152; font-size: 13px; line-height: 1.6; margin: 6px 0 0; }
  table.rows { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.rows td { padding: 8px 0; border-bottom: 1px solid #ececec; vertical-align: baseline; font-size: 14px; }
  td.k { color: #8a8f80; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; width: 42%; }
  td.val { font-weight: 600; }
  .foot { margin-top: 34px; border-top: 1px solid #ececec; padding-top: 14px; color: #8a8f80; font-size: 11px; line-height: 1.6; }
  @media print { .page { padding: 18px 22px; } @page { margin: 12mm; } }
</style></head>
<body><div class="page">
  <div class="top">
    <div class="brand">tylko<span>działki</span>.pl</div>
    <div class="kicker">Raport działki</div>
  </div>

  <div style="margin-top:22px">
    <div class="kicker">Twoja działka</div>
    <h1>${escapeHtml(areaLabel(parcel.areaM2))}</h1>
    <p class="sub">${escapeHtml(admin)}</p>
  </div>

  <div class="grid">
    <div class="map">${svg || '<p class="muted">Obrys niedostępny.</p>'}</div>
    <div class="side">
      <h2>Orientacyjna cena okolicy</h2>
      ${priceHtml}
    </div>
  </div>

  <h2>Plan miejscowy (MPZP)</h2>
  ${mpzpHtml}

  <h2>Dane z ewidencji</h2>
  <table class="rows">${rowsHtml}</table>

  <div class="foot">
    Wygenerowano ${escapeHtml(today)} w tylkodzialki.pl/sprawdz-dzialke. Granice, powierzchnia i numer z ewidencji gruntów (ULDK, GUGiK); plan z Krajowej Integracji MPZP. Raport to punkt startu, przed zakupem potwierdź kluczowe dane w gminie, ewidencji i księdze wieczystej.
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Zezwól na wyskakujące okna, żeby pobrać PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export default function Raport({ data }: { data: RaportData }) {
  const { parcel, valuation, mpzp } = data;
  const v = valuation.pricePerM2;
  const [mapShown, setMapShown] = useState(false);

  function handlePdf() {
    downloadReportPdf(data);
  }

  return (
    <div className="w-full text-left">
      {/* NAGŁÓWEK + przyciski (mapa, PDF) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Twoja działka</Eyebrow>
          <h3 className="mt-2 text-[26px] font-semibold tracking-tight text-fg md:text-[38px]">
            {areaLabel(parcel.areaM2)}
          </h3>
          <p className="mt-2 text-[15px] text-fg/65">
            {[parcel.commune, parcel.county, parcel.voivodeship].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMapShown((s) => !s)}
            className="inline-flex items-center gap-2 rounded-xl border border-fg/20 px-4 py-2.5 text-sm font-medium text-fg/80 transition hover:border-brand/50 hover:text-fg"
          >
            {mapShown ? 'Ukryj mapę' : 'Zobacz na mapie'}
            <span aria-hidden>→</span>
          </button>

          <button
            type="button"
            onClick={handlePdf}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-bright"
          >
            <span aria-hidden>↓</span>
            Pobierz PDF
          </button>
        </div>
      </div>

      {/* MAPA — rozwijana */}
      <div
        className={`overflow-hidden transition-all duration-300 ${mapShown ? 'mt-6 max-h-[520px]' : 'max-h-0'}`}
      >
        <div className="overflow-hidden rounded-2xl border border-fg/12">
          <div className="h-[380px] w-full md:h-[460px]">
            <RaportMap rings={parcel.rings} center={parcel.center} />
          </div>
        </div>
      </div>

      {/* CENA */}
      <div className="mt-8 border-t border-fg/12 pt-8">
        <Eyebrow>Orientacyjna cena okolicy</Eyebrow>
        {v ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[34px] font-semibold tracking-tight text-fg md:text-[46px]">
                {formatIntPL(v.median)}
              </span>
              <span className="text-lg font-medium text-fg/55">zł/m²</span>
            </div>
            <p className="mt-2 text-sm text-fg/65">
              {v.low === v.high
                ? `${formatIntPL(v.low)} zł/m²`
                : `Zakres od ${formatIntPL(v.low)} do ${formatIntPL(v.high)} zł/m²`}{' '}
              · z {valuation.sampleCount} {valuation.sampleCount === 1 ? 'oferty' : 'ofert'} w
              promieniu {valuation.radiusKm} km. To orientacja z ogłoszeń, nie operat rzeczoznawcy.
            </p>
          </>
        ) : (
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-fg/65">
            W promieniu {valuation.radiusKm} km mamy zbyt mało porównywalnych działek, żeby uczciwie
            oszacować cenę. Nie zgadujemy.
          </p>
        )}
      </div>

      {/* PLAN MIEJSCOWY (MPZP) */}
      <div className="mt-8 border-t border-fg/12 pt-8">
        <Eyebrow>Plan miejscowy (MPZP)</Eyebrow>
        {mpzp ? (
          <>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-fg/80">
              Dla tej działki obowiązuje miejscowy plan zagospodarowania
              {mpzp.planName ? (
                <>
                  {' '}
                  „<span className="text-fg">{mpzp.planName}</span>”
                </>
              ) : null}
              . Najważniejsze, co z niego wynika:
            </p>
            <div className="mt-5 border-t border-fg/10">
              <Row
                label="Przeznaczenie"
                value={
                  mpzp.functionName
                    ? mpzp.functionSymbol
                      ? `${mpzp.functionName} (${mpzp.functionSymbol})`
                      : mpzp.functionName
                    : mpzp.functionSymbol
                }
              />
              <Row label="Maks. wysokość zabudowy" value={mpzp.maxHeight ? `${mpzp.maxHeight} m` : null} />
              <Row label="Intensywność zabudowy" value={mpzp.intensity} />
            </div>
          </>
        ) : (
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-fg/70">
            W tym punkcie nie ma planu miejscowego w krajowej integracji. Zwykle znaczy to, że o
            zabudowie decydują warunki zabudowy (WZ).{' '}
            <Link
              href="/blog/warunki-zabudowy-wz-co-to-jest"
              className="text-brand-text underline decoration-1 underline-offset-2 hover:text-brand-bright"
            >
              Sprawdź, czym są warunki zabudowy
            </Link>{' '}
            i dopytaj w gminie.
          </p>
        )}
      </div>

      {/* DANE Z EWIDENCJI */}
      <div className="mt-8 border-t border-fg/12 pt-8">
        <Eyebrow>Dane z ewidencji</Eyebrow>
        <div className="mt-5 border-t border-fg/10">
          <Row label="Numer działki" value={parcel.parcelNumber} />
          <Row label="Obręb" value={parcel.region} />
          <Row label="Identyfikator" value={parcel.id} />
          <Row label="Gmina" value={parcel.commune} />
          <Row label="Powiat" value={parcel.county} />
          <Row label="Województwo" value={parcel.voivodeship} />
        </div>
        <p className="mt-3 text-xs leading-6 text-fg/45">
          Granice, powierzchnia i numer z ewidencji gruntów (ULDK, GUGiK) dla wskazanego punktu.
        </p>
      </div>

      {/* CO SPRAWDZIĆ DALEJ */}
      <div className="mt-10 border-t border-fg/12 pt-8">
        <h3 className="text-xl font-semibold tracking-tight text-brand-text md:text-2xl">
          Co sprawdzić dalej
        </h3>
        <div className="mt-5 border-t border-fg/10">
          {NEXT_STEPS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center justify-between gap-4 border-b border-fg/10 py-3.5 text-[15px] text-fg/85 transition hover:text-fg"
            >
              {s.label}
              <span aria-hidden className="text-fg/35 transition group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
