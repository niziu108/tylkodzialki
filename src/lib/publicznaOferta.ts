// Oferta w wersji dla przeglądarki. Publiczne API (/api/dzialki, /api/dzialki/[id]) i propsy
// strony oferty oddawały cały rekord z bazy: e-mail sprzedającego (także osób prywatnych),
// e-mail konta biura, editToken i wewnętrzne liczniki. Tego nie potrzebuje żaden ekran
// publiczny, a e-mail osoby prywatnej to dana osobowa, której nie wolno wystawiać każdemu.
// Kontakt idzie przez telefon albo formularz /api/dzialki/[id]/wiadomosc, który czyta
// adres po stronie serwera.

const POLA_PRYWATNE = [
  'editToken',
  'email',
  'viewsCount',
  'detailViewsCount',
  'phoneClicksCount',
  'messageClicksCount',
] as const;

type PolePrywatne = (typeof POLA_PRYWATNE)[number];

export function publicznaOferta<T extends object>(d: T): Omit<T, PolePrywatne> {
  const out: Record<string, unknown> = { ...(d as Record<string, unknown>) };
  for (const k of POLA_PRYWATNE) delete out[k];
  // Konto właściciela: zostają tylko dane wizytówki (logo, nazwa), bez adresu e-mail.
  const owner = out.owner;
  if (owner && typeof owner === 'object') {
    const { email: _email, ...reszta } = owner as Record<string, unknown>;
    void _email;
    out.owner = reszta;
  }
  return out as Omit<T, PolePrywatne>;
}
