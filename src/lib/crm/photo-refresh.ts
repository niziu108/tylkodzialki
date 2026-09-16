/**
 * Kiedy import CRM wymienia galerię zdjęć oferty i w jakiej kolejności to zapisuje.
 *
 * Problem (kod z 16.09.2026, ten sam we wszystkich czterech silnikach): ścieżka aktualizacji
 * najpierw kasowała obiekty w R2, potem wgrywała nowe zdjęcia, a na końcu transakcja podmieniała
 * wiersze Zdjecie. Wyjątek po skasowaniu (FTP, R2, baza, restart workera) zostawiał wiersze
 * wskazujące na nieistniejące pliki. Drugi przebieg odpalony równolegle potrafił skasować świeże
 * zdjęcia pierwszego. Zdjęcie wskazane w feedzie, którego pliku nie było na FTP ani w ZIP-ie,
 * było pomijane po cichu, więc galeria mogła zostać wymieniona na uboższą albo pustą.
 *
 * Pomiar z 16.09.2026: 1 martwy wiersz na 94 772 zdjęcia; w ofertach z payloadem z ostatnich 7 dni
 * galeria zgadza się z feedem w 2 863 z 2 897. Zmiana jest więc zapobiegawcza, ale ścieżka wymiany
 * pracuje ciągle: 1 124 z 1 450 aktywnych ofert ASARI miało już galerię wymienioną po utworzeniu.
 *
 * Reguły decyzji:
 *  1. Oferta bez zmian (data modyfikacji nie nowsza, liczba zdjęć zgodna z feedem): nic nie robimy.
 *     To dawny strażnik `photosUnchanged`. ASARI ściąga każde zdjęcie osobnym GET-em z FTP.
 *  2. Galerię wymieniamy na komplet z feedu, także mniejszy od obecnej (biuro usunęło zdjęcia).
 *  3. Gdy części plików brakuje, wymieniamy tylko na galerię większą od obecnej. Oferta bez zdjęć
 *     dostaje to, co jest; oferta ze zdjęciami nie traci ich na rzecz uboższej wersji.
 *  4. Pusta lista zdjęć w feedzie nie kasuje galerii. Tak od początku działał silnik DOMY.PL,
 *     a pomiar z 16.09 nie znalazł ani jednej oferty z galerią, której feed nagle nie podaje zdjęć.
 *
 * Pętla: decyzja o brakujących plikach zapada PRZED wgraniem, na liście plików z FTP albo ZIP-a.
 * Oferta, której plików brakuje trwale, nie wgrywa więc zdjęć w każdym przebiegu. Wgranie na próżno
 * zdarza się tylko, gdy plik zniknie między listowaniem a pobraniem (obiekty od razu kasujemy).
 *
 * Data modyfikacji: `CrmOfferLink.externalUpdatedAt` czyta tylko strażnik z reguły 1, więc zapisujemy
 * ją wyłącznie wtedy, gdy galeria odpowiada wersji oferty z feedu (`syncedWithFeed`). Zostawiona
 * stara galeria z tą samą liczbą zdjęć co nowy feed inaczej wyglądałaby jak „bez zmian" i nowe
 * zdjęcia nie weszłyby nawet po dotarciu brakującego pliku.
 *
 * Kolejność zapisu (refreshOfferPhotos): wgranie nowych, transakcja podmienia wiersze, dopiero po
 * commicie kasowanie starych obiektów. Błąd kasowania to wyciek pliku w R2, nigdy martwe zdjęcie.
 * Efekty (R2, baza) wstrzykuje silnik, implementacja w offer-photos.ts.
 */

export type UploadedPhoto = { url: string; publicId: string; kolejnosc: number };

export type PhotoRefreshInput = {
  /** Oferta wraca z ZAKONCZONE. Reaktywacja zawsze sprawdza zdjęcia od nowa. */
  wasEnded: boolean;
  /** Data modyfikacji oferty zapisana przy poprzednim imporcie. */
  storedUpdatedAt: Date | null;
  /** Data modyfikacji oferty z bieżącego feedu. */
  incomingUpdatedAt: Date | null;
  /** Liczba wierszy Zdjecie oferty w bazie. */
  existingPhotoCount: number;
  /** Nazwy plików zdjęć z feedu, w kolejności z feedu. */
  feedPhotoNames: string[];
  /** Czy przebieg ma plik zdjęcia (lista FTP, wpis w ZIP-ie). Samo sprawdzenie, bez pobierania. */
  isAvailable: (photoName: string) => boolean;
};

export type PhotoRefreshPlan = {
  /** Strażnik re-uploadu: oferta się nie zmieniła. */
  unchanged: boolean;
  /** Czy wgrywać zdjęcia z feedu. O podmianie galerii przesądza dopiero settlePhotoUpload. */
  upload: boolean;
  feedPhotoCount: number;
  existingPhotoCount: number;
  /** Zdjęcia z feedu, których plików ten przebieg nie ma. */
  missing: string[];
};

export type PhotoUploadOutcome = {
  /** Czy transakcja ma podmienić galerię na wgrane zdjęcia. */
  replace: boolean;
  /**
   * Czy galeria po tym przebiegu odpowiada wersji oferty z feedu. Tylko wtedy transakcja zapisuje
   * datę modyfikacji z feedu, bo po niej strażnik pomija zdjęcia w kolejnych przebiegach.
   */
  syncedWithFeed: boolean;
  /** Adnotacja do komunikatu w CrmSyncLog. null = nic wartego odnotowania. */
  note: string | null;
  /** Czy adnotacja opisuje problem z feedem (idzie też na stdout workera). */
  warn: boolean;
};

/** Ile nazw brakujących plików pokazujemy w komunikacie. */
const MISSING_NAMES_IN_NOTE = 3;

function isOfferUnchanged(input: PhotoRefreshInput): boolean {
  return (
    !input.wasEnded &&
    input.storedUpdatedAt != null &&
    input.incomingUpdatedAt != null &&
    input.incomingUpdatedAt.getTime() <= input.storedUpdatedAt.getTime() &&
    input.existingPhotoCount === input.feedPhotoNames.length
  );
}

/**
 * Czy galerię wolno wymienić na `readyPhotoCount` zdjęć. Komplet z feedu zawsze, niepełny zestaw
 * tylko wtedy, gdy ma więcej zdjęć niż obecna galeria. Pusty zestaw nigdy.
 */
export function shouldReplaceGallery(params: {
  feedPhotoCount: number;
  readyPhotoCount: number;
  existingPhotoCount: number;
}): boolean {
  const { feedPhotoCount, readyPhotoCount, existingPhotoCount } = params;
  if (feedPhotoCount === 0 || readyPhotoCount === 0) return false;
  if (readyPhotoCount >= feedPhotoCount) return true;
  return readyPhotoCount > existingPhotoCount;
}

/** Decyzja przed wgraniem: czy w ogóle wgrywać zdjęcia z feedu. */
export function planPhotoRefresh(input: PhotoRefreshInput): PhotoRefreshPlan {
  const feedPhotoCount = input.feedPhotoNames.length;
  const existingPhotoCount = Math.max(0, input.existingPhotoCount);

  if (isOfferUnchanged(input)) {
    return { unchanged: true, upload: false, feedPhotoCount, existingPhotoCount, missing: [] };
  }

  const missing = input.feedPhotoNames.filter((photoName) => !input.isAvailable(photoName));
  const upload = shouldReplaceGallery({
    feedPhotoCount,
    readyPhotoCount: feedPhotoCount - missing.length,
    existingPhotoCount,
  });

  return { unchanged: false, upload, feedPhotoCount, existingPhotoCount, missing };
}

function describeMissing(plan: PhotoRefreshPlan, readyPhotoCount: number): string {
  const lacking = Math.max(0, plan.feedPhotoCount - readyPhotoCount);
  const names = plan.missing.slice(0, MISSING_NAMES_IN_NOTE);
  const more = plan.missing.length > names.length ? ", …" : "";
  const list = names.length > 0 ? ` (${names.join(", ")}${more})` : "";
  return `Brak plików: ${lacking} z ${plan.feedPhotoCount}${list}.`;
}

/**
 * Decyzja po wgraniu. Wgranych bywa mniej niż zaplanowanych, gdy plik zniknie między listowaniem
 * a pobraniem, więc regułę podmiany sprawdzamy jeszcze raz na tym, co faktycznie leży w R2.
 */
export function settlePhotoUpload(plan: PhotoRefreshPlan, uploadedCount: number): PhotoUploadOutcome {
  if (plan.unchanged) return { replace: false, syncedWithFeed: true, note: "Zdjęcia bez zmian.", warn: false };

  const { feedPhotoCount, existingPhotoCount } = plan;

  if (feedPhotoCount === 0) {
    return existingPhotoCount > 0
      ? {
          replace: false,
          syncedWithFeed: false,
          note: `Feed nie podaje zdjęć, zostaje obecna galeria (${existingPhotoCount}).`,
          warn: true,
        }
      : { replace: false, syncedWithFeed: true, note: null, warn: false };
  }

  // Bez wgrywania liczy się to, co było do wzięcia; po wgraniu to, co faktycznie leży w R2.
  const readyPhotoCount = plan.upload ? uploadedCount : feedPhotoCount - plan.missing.length;
  const replace =
    plan.upload && shouldReplaceGallery({ feedPhotoCount, readyPhotoCount, existingPhotoCount });

  if (replace && readyPhotoCount >= feedPhotoCount) {
    return { replace, syncedWithFeed: true, note: `Zdjęcia wymienione (${readyPhotoCount}).`, warn: false };
  }

  if (replace) {
    const verdict =
      existingPhotoCount > 0
        ? `Galeria wymieniona na niepełną (${readyPhotoCount}), bo obecna była mniejsza (${existingPhotoCount}).`
        : `Oferta dostaje niepełną galerię (${readyPhotoCount}).`;
    return { replace, syncedWithFeed: false, note: `${verdict} ${describeMissing(plan, readyPhotoCount)}`, warn: true };
  }

  const verdict =
    existingPhotoCount > 0 ? `Zostaje obecna galeria (${existingPhotoCount}).` : "Oferta zostaje bez zdjęć.";
  return { replace, syncedWithFeed: false, note: `${verdict} ${describeMissing(plan, readyPhotoCount)}`, warn: true };
}

/** Komunikat do CrmSyncLog z adnotacją o zdjęciach. */
export function appendPhotoNote(message: string, note: string | null): string {
  return note ? `${message} ${note}` : message;
}

export type PhotoRefreshEffects = {
  /** Kasuje obiekty z R2. */
  deleteObjects: (keys: string[]) => Promise<void>;
  /** Po nieudanej transakcji: kasuje wgrane obiekty, do których nie prowadzi żaden wiersz w bazie. */
  discardUnsaved: (photos: UploadedPhoto[]) => Promise<void>;
  warn: (message: string) => void;
};

/**
 * Co transakcja importu robi ze zdjęciami: przy `replace` podmienia galerię na `photos`
 * (swapOfferPhotos), datę modyfikacji z feedu zapisuje tylko przy `syncedWithFeed`, a `note`
 * dokleja do komunikatu w CrmSyncLog (appendPhotoNote).
 */
export type PhotoSave = PhotoUploadOutcome & { photos: UploadedPhoto[] };

/**
 * Aktualizacja oferty razem ze zdjęciami, w kolejności bez martwych zdjęć.
 *
 * `save` to transakcja importu. Zwraca klucze R2 zdjęć, które wypadły z galerii; te obiekty
 * kasujemy dopiero po commicie. Błąd sprzątania nie przerywa importu oferty, bo jej zapis już
 * się udał; zostaje wyciek pliku i ostrzeżenie.
 */
export async function refreshOfferPhotos(params: {
  plan: PhotoRefreshPlan;
  /** Prefiks ostrzeżeń, np. „[ASARI] Oferta 123/4567/OGS". */
  label: string;
  /** Wgrywa zdjęcia z feedu do R2. Gdy rzuca, sama sprząta to, co zdążyła wgrać. */
  upload: () => Promise<UploadedPhoto[]>;
  save: (photos: PhotoSave) => Promise<string[]>;
  effects: PhotoRefreshEffects;
}): Promise<PhotoUploadOutcome> {
  const { plan, label, upload, save, effects } = params;

  async function cleanup(what: string, run: () => Promise<void>) {
    try {
      await run();
    } catch (error) {
      effects.warn(`${label}: ${what} nie powiodło się, pliki zostają w R2 (${error instanceof Error ? error.message : String(error)}).`);
    }
  }

  const uploaded = plan.upload ? await upload() : [];
  const outcome = settlePhotoUpload(plan, uploaded.length);

  if (outcome.warn && outcome.note) effects.warn(`${label}: ${outcome.note}`);

  // Wgrane na próżno (plik zniknął w trakcie, galeria wyszłaby uboższa): nie prowadzi do nich żaden wiersz.
  if (!outcome.replace && uploaded.length > 0) {
    await cleanup("kasowanie niewykorzystanych zdjęć", () =>
      effects.deleteObjects(uploaded.map((photo) => photo.publicId))
    );
  }

  let replacedKeys: string[];
  try {
    replacedKeys = await save({ ...outcome, photos: outcome.replace ? uploaded : [] });
  } catch (error) {
    // Stara galeria nietknięta. Wgrane kasujemy tylko wtedy, gdy zapis na pewno do nich nie prowadzi.
    if (outcome.replace) await cleanup("sprzątanie po nieudanym zapisie", () => effects.discardUnsaved(uploaded));
    throw error;
  }

  if (replacedKeys.length > 0) {
    await cleanup("kasowanie zdjęć sprzed wymiany", () => effects.deleteObjects(replacedKeys));
  }

  return outcome;
}
