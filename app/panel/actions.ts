'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';
import { authOptions } from '@/auth-options';
import { zaksiegujZakupWyroznien } from '@/lib/invoices';
import { prisma } from '@/lib/prisma';
import { deleteFromR2 } from '@/lib/r2';
import { stripe } from '@/lib/stripe';
import { ocenPowrotZeStripe } from '@/lib/zakupWyroznien';
import { DzialkaSourceType, DzialkaStatus } from '@prisma/client';

// Odmowę, którą ma zobaczyć użytkownik (brak publikacji, reguła 30 dni, oferta z CRM...),
// akcja ZWRACA, a `throw` zostaje na sytuacje nieoczekiwane. Treść błędu rzuconego z server
// action nie dociera na produkcji do przeglądarki: React Flight wysyła sam digest, a klient
// dostaje ogólny angielski komunikat. Na devie treść dochodzi, więc lokalnie tego nie widać.
export type PanelActionResult = { error: string } | undefined;

// Brak sesji albo konta: np. wylogowanie w innej karcie przy otwartym panelu.
const SESJA_WYGASLA = 'Sesja wygasła. Zaloguj się ponownie.';

// Ofertą z importu CRM rządzi program biura, a nie panel, więc zakończenie, aktywacja,
// przedłużenie i usunięcie są tu zablokowane (przyciski ukrywa też PanelDzialkiList).
// - Zakończenie: ASARI i EstiCRM czytają pełny eksport przy każdym przebiegu i przywracają ofertę,
//   a DOMY.PL (paczki różnicowe) trzyma ją ukrytą, dopóki nie przyjdzie w kolejnej paczce.
// - Usunięcie: kaskada zabiera link z CRM, historię cen, epizody i raport, a oferta wraca z feedu
//   jako nowy rekord pod nowym adresem (stary adres daje 404).
// - Przedłużenie przy płatnościach ustawia `expiresAt`, którego silniki nie czyszczą, więc oferta po
//   cichu znika z list. Bez płatności przestawia `publishedAt`, co rekoncyliator epizodów bierze za
//   zejście i powrót oferty. Aktywacja oferty zakończonej przez CRM wskrzesza sprzedaną działkę,
//   której wygaszanie po pełnym eksporcie i po `<oferta_usun>` już nie widzi (bierze tylko linki
//   z `isActiveInSource`).
// Wyróżnienie zostaje: to usługa portalu, której import nie nadpisuje.
const OFERTA_Z_CRM =
  'Tą ofertą zarządzasz w swoim CRM. Zakończ lub wznów ją tam, a portal zaktualizuje się sam.';

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  return user?.id ?? null;
}

async function getAppConfig() {
  let config = await prisma.appConfig.findFirst();

  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        paymentsEnabled: false,
        freeListingCredits: 0,
        freeListingCreditsDays: null,
      },
    });
  }

  return config;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function getOwnedDzialka(dzialkaId: string, ownerId: string) {
  return prisma.dzialka.findFirst({
    where: {
      id: dzialkaId,
      ownerId,
    },
    select: {
      id: true,
      expiresAt: true,
      status: true,
      isFeatured: true,
      featuredUntil: true,
      sourceType: true,
    },
  });
}

export async function zakonczOgloszenieAction(
  dzialkaId: string
): Promise<PanelActionResult> {
  const ownerId = await getCurrentUserId();

  if (!ownerId) {
    return { error: SESJA_WYGASLA };
  }

  const dzialka = await getOwnedDzialka(dzialkaId, ownerId);

  if (!dzialka) {
    return { error: 'Ogłoszenie nie istnieje lub nie należy do użytkownika.' };
  }

  if (dzialka.sourceType === DzialkaSourceType.CRM) {
    return { error: OFERTA_Z_CRM };
  }

  await prisma.dzialka.update({
    where: { id: dzialkaId },
    data: {
      status: DzialkaStatus.ZAKONCZONE,
      endedAt: new Date(),
    },
  });

  revalidatePath('/panel');
  revalidatePath('/kup');
}

export async function przedluzOgloszenieAction(
  dzialkaId: string
): Promise<PanelActionResult> {
  const ownerId = await getCurrentUserId();

  if (!ownerId) {
    return { error: SESJA_WYGASLA };
  }

  const dzialka = await getOwnedDzialka(dzialkaId, ownerId);

  if (!dzialka) {
    return { error: 'Ogłoszenie nie istnieje lub nie należy do użytkownika.' };
  }

  if (dzialka.sourceType === DzialkaSourceType.CRM) {
    return { error: OFERTA_Z_CRM };
  }

  const appConfig = await getAppConfig();
  const now = new Date();
  const currentExpiresAt = dzialka.expiresAt ? new Date(dzialka.expiresAt) : null;

  // Odmowa wychodzi z transakcji jako jej wynik. Przed odmową nic się nie zapisuje
  // (updateMany bez trafienia niczego nie zmienia), więc zatwierdzenie transakcji jest puste.
  const odmowa = await prisma.$transaction(async (tx): Promise<PanelActionResult> => {
    if (!appConfig.paymentsEnabled) {
      await tx.dzialka.update({
        where: { id: dzialkaId },
        data: {
          status: DzialkaStatus.AKTYWNE,
          endedAt: null,
          expiresAt: null,
          publishedAt:
            dzialka.status === DzialkaStatus.ZAKONCZONE ||
            !currentExpiresAt ||
            currentExpiresAt.getTime() <= now.getTime()
              ? now
              : undefined,
        },
      });

      return;
    }

    const isStillActive =
      dzialka.status !== DzialkaStatus.ZAKONCZONE &&
      !!currentExpiresAt &&
      currentExpiresAt.getTime() > now.getTime();

    let newExpiresAt: Date;

    if (isStillActive && currentExpiresAt) {
      const daysLeft = Math.ceil(
        (currentExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysLeft > 30) {
        return {
          error:
            'To ogłoszenie można przedłużyć dopiero wtedy, gdy do końca zostanie 30 dni lub mniej.',
        };
      }

      newExpiresAt = addDays(currentExpiresAt, 30);
    } else {
      newExpiresAt = addDays(now, 30);
    }

    const updatedUser = await tx.user.updateMany({
      where: {
        id: ownerId,
        listingCredits: {
          gt: 0,
        },
      },
      data: {
        listingCredits: {
          decrement: 1,
        },
      },
    });

    if (updatedUser.count === 0) {
      return {
        error: 'Brak dostępnych publikacji. Kup pakiet, aby przedłużyć lub aktywować ogłoszenie.',
      };
    }

    await tx.dzialka.update({
      where: { id: dzialkaId },
      data: {
        status: DzialkaStatus.AKTYWNE,
        endedAt: null,
        expiresAt: newExpiresAt,
        publishedAt:
          dzialka.status === DzialkaStatus.ZAKONCZONE ||
          !currentExpiresAt ||
          currentExpiresAt.getTime() <= now.getTime()
            ? now
            : undefined,
      },
    });
  });

  if (odmowa) {
    return odmowa;
  }

  revalidatePath('/panel');
  revalidatePath('/kup');
  revalidatePath('/panel/pakiety');
}

export async function usunOgloszenieAction(dzialkaId: string): Promise<PanelActionResult> {
  const ownerId = await getCurrentUserId();

  if (!ownerId) {
    return { error: SESJA_WYGASLA };
  }

  const dzialka = await prisma.dzialka.findFirst({
    where: {
      id: dzialkaId,
      ownerId,
    },
    select: {
      id: true,
      sourceType: true,
      zdjecia: {
        select: {
          publicId: true,
        },
      },
    },
  });

  if (!dzialka) {
    return { error: 'Ogłoszenie nie istnieje lub nie należy do użytkownika.' };
  }

  if (dzialka.sourceType === DzialkaSourceType.CRM) {
    return { error: OFERTA_Z_CRM };
  }

  const photoKeys = dzialka.zdjecia
    .map((z) => z.publicId)
    .filter((key): key is string => Boolean(key));

  await prisma.dzialka.delete({
    where: { id: dzialkaId },
  });

  await Promise.allSettled(photoKeys.map((key) => deleteFromR2(key)));

  revalidatePath('/panel');
  revalidatePath('/kup');
}

// Wyróżnienie oferty za jeden punkt: przycisk „Wyróżnij" i powrót ze Stripe po zakupie.
type Wyroznienie = 'wyrozniono' | 'juz-wyroznione' | 'brak-punktow' | 'brak-oferty';

const BRAK_PUNKTOW = 'BRAK_PUNKTOW';

async function wyroznZaPunkt(ownerId: string, dzialkaId: string): Promise<Wyroznienie> {
  const [user, dzialka] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        featuredCredits: true,
        featuredCreditsExpiresAt: true,
      },
    }),
    getOwnedDzialka(dzialkaId, ownerId),
  ]);

  if (!dzialka) {
    return 'brak-oferty';
  }

  const now = new Date();

  if (
    dzialka.isFeatured &&
    dzialka.featuredUntil &&
    new Date(dzialka.featuredUntil).getTime() > now.getTime()
  ) {
    return 'juz-wyroznione';
  }

  // Data ważności pakietu jest wiążąca, nie ozdobna. Panel od zawsze pokazywał
  // „ważne do ...", ale nic tego nie pilnowało — punkty z wygasłego pakietu dawały się
  // wydać bez końca. Przy pakietach przyznawanych partnerom z ręki (na kwartał)
  // to różnica między obietnicą a jej dotrzymaniem. Zakup zdejmuje tę datę
  // (zaksiegujZakupWyroznien), więc kupionych punktów ona nie blokuje.
  const pakietWygasl =
    !!user?.featuredCreditsExpiresAt &&
    new Date(user.featuredCreditsExpiresAt).getTime() <= now.getTime();

  if (!user || (user.featuredCredits ?? 0) <= 0 || pakietWygasl) {
    return 'brak-punktow';
  }

  // Najpierw oferta, i to warunkowo (tylko gdy nie jest wyróżniona), potem punkt. Dwa
  // równoległe wyróżnienia tej samej oferty (dwie karty, powrót ze Stripe i przycisk) zdejmą
  // wtedy jeden punkt: drugie czeka na zapis pierwszego i nie spełnia już warunku.
  try {
    return await prisma.$transaction(async (tx): Promise<Wyroznienie> => {
      const oferta = await tx.dzialka.updateMany({
        where: {
          id: dzialkaId,
          ownerId,
          OR: [
            { isFeatured: false },
            { featuredUntil: null },
            { featuredUntil: { lte: now } },
          ],
        },
        data: {
          isFeatured: true,
          featuredUntil: addDays(now, 7),
        },
      });

      if (oferta.count === 0) {
        return 'juz-wyroznione';
      }

      const punkt = await tx.user.updateMany({
        where: {
          id: ownerId,
          featuredCredits: {
            gt: 0,
          },
        },
        data: {
          featuredCredits: {
            decrement: 1,
          },
        },
      });

      // Ostatni punkt zszedł między sprawdzeniem a transakcją (np. wyróżnienie drugiej oferty
      // w tej samej chwili). Wyjątek cofa też wyróżnienie oferty.
      if (punkt.count === 0) {
        throw new Error(BRAK_PUNKTOW);
      }

      return 'wyrozniono';
    });
  } catch (e) {
    if (e instanceof Error && e.message === BRAK_PUNKTOW) {
      return 'brak-punktow';
    }

    throw e;
  }
}

export async function wyroznijOgloszenieAction(
  dzialkaId: string
): Promise<PanelActionResult> {
  const ownerId = await getCurrentUserId();

  if (!ownerId) {
    return { error: SESJA_WYGASLA };
  }

  const wynik = await wyroznZaPunkt(ownerId, dzialkaId);

  if (wynik === 'brak-oferty') {
    return { error: 'Ogłoszenie nie istnieje lub nie należy do użytkownika.' };
  }

  if (wynik === 'juz-wyroznione') {
    return { error: 'To ogłoszenie jest już aktualnie wyróżnione.' };
  }

  // Brak punktów albo wygasły pakiet, także gdy ostatni punkt zszedł w tej samej chwili
  // na inną ofertę: do zakupu wyróżnienia.
  if (wynik === 'brak-punktow') {
    redirect(`/panel/wyroznienia?dzialkaId=${dzialkaId}`);
  }

  revalidatePath('/panel');
  revalidatePath('/kup');
  revalidatePath(`/dzialka/${dzialkaId}`);
}

// Powrót ze Stripe po zakupie wyróżnienia (AutoFeaturedAfterPurchase). „w-toku" to płatność
// jeszcze niepotwierdzona albo chwilowa awaria: panel zapyta ponownie za chwilę.
export type ZakupWyroznieniaResult =
  | { stan: 'wyrozniono' | 'zaksiegowano' | 'w-toku' }
  | { error: string };

const PLATNOSC_NIEZNANA = 'Nie znaleźliśmy tej płatności na Twoim koncie.';

// Tyle po zaksięgowaniu zakupu powrót ze Stripe może sam wyróżnić ofertę.
const AUTO_WYROZNIENIE_MS = 24 * 60 * 60 * 1000;

// Panel wracał ze Stripe i od razu klikał „Wyróżnij". Punkty dopisywał tylko webhook, więc gdy
// przyszedł później niż przeglądarka, świeżo płacący klient lądował z powrotem na stronie
// zakupu (i mógł zapłacić drugi raz). Teraz powrót sam sprawdza płatność u Stripe i ją
// księguje, tą samą funkcją co webhook, a do zakupu stąd nie odsyłamy nigdy.
export async function dokonczZakupWyroznieniaAction(
  sessionId: string
): Promise<ZakupWyroznieniaResult> {
  const ownerId = await getCurrentUserId();

  if (!ownerId) {
    return { error: SESJA_WYGASLA };
  }

  if (!/^cs_\w{1,250}$/.test(sessionId)) {
    return { error: PLATNOSC_NIEZNANA };
  }

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    // Nieznana sesja (np. adres sklejony ręcznie) to odmowa. Sieć albo chwilowa awaria Stripe
    // to „jeszcze księgujemy", a punkty i tak dopisze webhook.
    if (e instanceof Stripe.errors.StripeInvalidRequestError) {
      return { error: PLATNOSC_NIEZNANA };
    }

    console.error('[ZAKUP WYROZNIENIA] Stripe:', e);
    return { stan: 'w-toku' };
  }

  const ocena = ocenPowrotZeStripe(session, ownerId);

  if (ocena.stan === 'odrzucona') {
    return {
      error:
        ocena.powod === 'obca'
          ? PLATNOSC_NIEZNANA
          : 'Ta płatność nie została dokończona.',
    };
  }

  if (ocena.stan === 'w-toku') {
    return { stan: 'w-toku' };
  }

  let zaksiegowanoAt: Date;

  try {
    ({ zaksiegowanoAt } = await zaksiegujZakupWyroznien(session, ocena.zakup));
  } catch (e) {
    console.error('[ZAKUP WYROZNIENIA] księgowanie:', e);
    return { stan: 'w-toku' };
  }

  revalidatePath('/panel');

  const { dzialkaId } = ocena.zakup;

  // Ofertę wybraną przed zakupem wyróżniamy tylko świeżo po płatności. Ten sam adres otwarty
  // po tygodniu (np. z historii przeglądarki) nie może po cichu wydać kolejnego punktu.
  if (!dzialkaId || Date.now() - zaksiegowanoAt.getTime() > AUTO_WYROZNIENIE_MS) {
    return { stan: 'zaksiegowano' };
  }

  const wynik = await wyroznZaPunkt(ownerId, dzialkaId);

  if (wynik === 'wyrozniono') {
    revalidatePath('/kup');
    revalidatePath(`/dzialka/${dzialkaId}`);
  }

  // Oferta mogła zniknąć albo punkt pójść w tej samej chwili na inną ofertę. Zakup i tak
  // jest na koncie, więc to nadal sukces, tylko bez wyróżnienia tej oferty.
  return wynik === 'wyrozniono' || wynik === 'juz-wyroznione'
    ? { stan: 'wyrozniono' }
    : { stan: 'zaksiegowano' };
}