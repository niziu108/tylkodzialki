/* Dokąd wrócić po zalogowaniu (?callbackUrl= na /logowanie). Wartość z paska adresu trafia do
 * window.location.replace, więc bez tej bramki „javascript:…" wykonałby się na naszej domenie,
 * a link do obcej strony wyprowadzałby tam zalogowanego użytkownika (otwarte przekierowanie).
 *
 * Przepuszcza tylko adresy tego serwisu i zwraca samą ścieżkę. Pełny adres naszej domeny też
 * jest w porządku: tak odsyła next-auth po błędzie logowania przez Google. */
const DOMYSLNIE = '/panel';

export function powrotPoLogowaniu(raw: string | null | undefined, origin: string): string {
  const url = raw?.trim();
  if (!url) return DOMYSLNIE;

  let cel: URL;
  try {
    cel = new URL(url, origin);
  } catch {
    return DOMYSLNIE;
  }

  const sciezka = cel.pathname + cel.search + cel.hash;
  // „/.//obca.pl" przechodzi kontrolę originu, ale daje ścieżkę „//obca.pl",
  // którą przeglądarka czyta jak adres innej domeny.
  if (cel.origin !== origin || sciezka.startsWith('//')) return DOMYSLNIE;

  return sciezka === '/' ? DOMYSLNIE : sciezka;
}
