import type Stripe from 'stripe';

/* Zakup wyróżnień przez Stripe Checkout (app/api/stripe/checkout-featured). Metadane sesji
 * ustawia nasz serwer przy tworzeniu płatności, więc to one mówią, czyj jest zakup, ile punktów
 * dopisać i którą ofertę wyróżnić. Parametrom adresu powrotu nie ufamy: może je wpisać każdy.
 *
 * Bez bazy i bez sieci (testy w zakupWyroznien.test.ts). Księgowanie w bazie robi
 * zaksiegujZakupWyroznien w src/lib/invoices.ts. */

export type ZakupWyroznien = {
  userId: string;
  liczba: number;
  dzialkaId: string | null;
};

export function zakupWyroznienZSesji(
  session: Pick<Stripe.Checkout.Session, 'metadata'>
): ZakupWyroznien | null {
  const metadata = session.metadata ?? {};
  const liczba = Number(metadata.featuredCredits || 0);

  if (
    metadata.type !== 'featured' ||
    !metadata.userId ||
    !Number.isInteger(liczba) ||
    liczba <= 0
  ) {
    return null;
  }

  return {
    userId: metadata.userId,
    liczba,
    dzialkaId: (metadata.dzialkaId || '').trim() || null,
  };
}

export type OcenaPowrotu =
  | { stan: 'oplacona'; zakup: ZakupWyroznien }
  | { stan: 'w-toku' }
  | { stan: 'odrzucona'; powod: 'obca' | 'nieoplacona' };

/* Powrót klienta ze Stripe do panelu. Punkty wolno dopisać dopiero, gdy sesja pobrana
 * ze Stripe to zakup wyróżnień tego samego konta i płatność jest potwierdzona. Otwarta sesja
 * (checkout założony, ale niezapłacony) dawałaby inaczej punkty za darmo. */
export function ocenPowrotZeStripe(
  session: Pick<Stripe.Checkout.Session, 'metadata' | 'status' | 'payment_status'>,
  userId: string
): OcenaPowrotu {
  const zakup = zakupWyroznienZSesji(session);

  if (!zakup || zakup.userId !== userId) {
    return { stan: 'odrzucona', powod: 'obca' };
  }

  if (session.status === 'complete' && session.payment_status === 'paid') {
    return { stan: 'oplacona', zakup };
  }

  // Checkout zamknięty, ale pieniądze jeszcze w drodze (metody z opóźnionym potwierdzeniem).
  // Panel poczeka, a punkty dopisze webhook.
  if (session.status === 'complete') {
    return { stan: 'w-toku' };
  }

  // Otwarta (klient nie zapłacił) albo wygasła.
  return { stan: 'odrzucona', powod: 'nieoplacona' };
}
