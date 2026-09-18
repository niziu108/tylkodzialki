// Liczniki ofert (track-*) zapisują się wszędzie, gdzie działa kod. Problem: lokalny `next dev`
// łączy się z ŻYWĄ bazą Neon (nie ma osobnej bazy dev), więc klikanie ofert przy testach
// podbijało statystyki, które biuro widzi w panelu. Tak samo GA mieszało nasze testy z ruchem
// kupujących.
//
// Dlatego liczymy tylko produkcję: produkcyjny build na naszej domenie. Świadomie po nagłówku
// Host, a nie po VERCEL_ENV: Vercel wystawia tę zmienną tylko przy włączonym w projekcie dostępie
// do System Environment Variables, a po jego wyłączeniu liczniki po cichu stanęłyby na zero.
// Sam NODE_ENV nie wystarczy, bo 'production' ma też podgląd Vercela i `next start` na localhost.

const PRODUCTION_HOSTS = ['tylkodzialki.pl', 'www.tylkodzialki.pl'];

/** true = nasza produkcyjna domena. Przyjmuje nagłówek Host (z portem) albo location.hostname. */
export function isProductionHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.trim().toLowerCase().replace(/:\d+$/, '');
  return PRODUCTION_HOSTS.includes(hostname);
}

/** Wygodna nakładka na Request z route handlera: produkcyjny build obsługujący naszą domenę. */
export function isProductionRequest(req: Request, nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv === 'production' && isProductionHost(req.headers.get('host'));
}
