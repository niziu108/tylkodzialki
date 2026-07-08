// Nakładka granic działek ewidencyjnych (WMS GUGiK / KIEG) na Google Maps.
// Reużywana w „Sprawdź działkę" i w dodawaniu oferty ([[project-wms-dzialki-overlay]]).
//
// Kafle z geoportalu są rastrowe i przychodzą na NIEBIESKO — nie da się ich przemalować
// parametrem WMS. Dlatego zamiast ImageMapType.getTileUrl budujemy własny <img> w getTile
// i nakładamy CSS-owy hue-rotate, żeby obrys zszedł na naszą zieleń. Numery działek są ciemne
// (niska saturacja), więc filtr ich praktycznie nie rusza.

const EXTENT = 20037508.342789244;

export function createParcelOverlay(): google.maps.MapType {
  return {
    tileSize: new google.maps.Size(256, 256),
    maxZoom: 21,
    minZoom: 0,
    name: 'dzialki',
    alt: null,
    projection: null,
    radius: 6378137,
    getTile(coord: google.maps.Point, zoom: number, ownerDocument: Document): Element {
      const img = ownerDocument.createElement('img');
      // Działki ewidencyjne mają sens dopiero po przybliżeniu; niżej pusty kafel.
      if (zoom < 15) return img;

      const worldSize = 2 * EXTENT;
      const tile = worldSize / Math.pow(2, zoom);
      const minx = -EXTENT + coord.x * tile;
      const maxx = -EXTENT + (coord.x + 1) * tile;
      const maxy = EXTENT - coord.y * tile;
      const miny = EXTENT - (coord.y + 1) * tile;
      const params = new URLSearchParams({
        SERVICE: 'WMS',
        VERSION: '1.1.1',
        REQUEST: 'GetMap',
        LAYERS: 'dzialki,numery_dzialek',
        STYLES: '',
        SRS: 'EPSG:3857',
        BBOX: `${minx},${miny},${maxx},${maxy}`,
        WIDTH: '256',
        HEIGHT: '256',
        FORMAT: 'image/png',
        TRANSPARENT: 'TRUE',
      });
      img.src = `https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow?${params.toString()}`;
      img.width = 256;
      img.height = 256;
      img.style.opacity = '0.9';
      // Niebieskie linie geoportalu -> nasza zieleń (#7aa333).
      img.style.filter = 'hue-rotate(-135deg) saturate(1.15)';
      return img;
    },
    releaseTile() {},
  };
}
