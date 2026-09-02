/**
 * ROBOCZY: pobiera ortofoto GUGiK w kadrze dzialki, zeby OCENIC WZROKOWO czy dzialka jest pusta.
 * Warstwa „budynki" w KIEG nie daje sie o to zapytac (GetFeatureInfo zwraca dane dzialki
 * niezaleznie od QUERY_LAYERS), a demo raportu ma pokazywac dzialke PUSTA — takiej szuka kupujacy.
 *
 * Uruchom: npx tsx scripts/demo-ortofoto.ts <katalog> <lat,lng> [<lat,lng> ...]
 */
import { writeFileSync } from 'node:fs';
import { getParcelByXY } from '../src/lib/uldk';

const ORTHO_WMS = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function to3857(lat: number, lng: number): { x: number; y: number } {
  const x = (lng * 20037508.34) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return { x, y };
}

async function main() {
  const katalog = process.argv[2];
  const punkty = process.argv.slice(3);
  if (!katalog || !punkty.length) {
    console.error('Uzycie: npx tsx scripts/demo-ortofoto.ts <katalog> <lat,lng> [...]');
    process.exit(1);
  }

  for (const para of punkty) {
    const [lat, lng] = para.split(',').map(Number);
    const parcel = await getParcelByXY(lat, lng);
    if (!parcel) {
      console.log(`${para}: ULDK nie zwrocil dzialki`);
      continue;
    }

    // Kadr = prostokat opisany na dzialce + 25% marginesu, wyrownany do kwadratu.
    const pts = parcel.rings.flat().map((p) => to3857(p.lat, p.lng));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const d = (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2) * 1.25;

    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetMap',
      LAYERS: 'Raster',
      STYLES: '',
      CRS: 'EPSG:3857',
      BBOX: `${cx - d},${cy - d},${cx + d},${cy + d}`,
      WIDTH: '900',
      HEIGHT: '900',
      FORMAT: 'image/jpeg',
    });

    const res = await fetch(`${ORTHO_WMS}?${params}`, { headers: { 'User-Agent': UA } });
    const buf = Buffer.from(await res.arrayBuffer());
    const nazwa = `${parcel.commune}_${parcel.parcelNumber}`.replace(/[^\w]+/g, '-');
    const sciezka = `${katalog}/${nazwa}.jpg`;
    writeFileSync(sciezka, buf);
    console.log(`${sciezka} | ${parcel.commune} dz. ${parcel.parcelNumber} | ${parcel.areaM2} m2 | ${Math.round(d * 2)} m kadru | ${para}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
