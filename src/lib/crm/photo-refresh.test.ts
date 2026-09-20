import { describe, expect, it } from "vitest";
import {
  appendPhotoNote,
  planPhotoRefresh,
  refreshOfferPhotos,
  settlePhotoUpload,
  type PhotoRefreshEffects,
  type PhotoRefreshInput,
  type PhotoSave,
  type UploadedPhoto,
} from "./photo-refresh";

const STORED = new Date("2026-09-01T10:00:00Z");
const NEWER = new Date("2026-09-10T10:00:00Z");

/** `names(3)` → ["1.jpg", "2.jpg", "3.jpg"]. */
const names = (count: number, prefix = "") => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}.jpg`);

/** Aktualizacja z nowszą datą; domyślnie wszystkie pliki z feedu są na FTP. */
function input(overrides: Partial<Omit<PhotoRefreshInput, "isAvailable">> & { available?: string[] } = {}): PhotoRefreshInput {
  const { available, ...rest } = overrides;
  const feedPhotoNames = rest.feedPhotoNames ?? names(3);
  const onFtp = new Set(available ?? feedPhotoNames);

  return {
    wasEnded: false,
    storedUpdatedAt: STORED,
    incomingUpdatedAt: NEWER,
    existingPhotoCount: 3,
    ...rest,
    feedPhotoNames,
    isAvailable: (photoName) => onFtp.has(photoName),
  };
}

/** Plan i wynik, gdy wgrywanie nie gubi plików: do R2 trafia dokładnie to, co było na FTP. */
function decide(photoInput: PhotoRefreshInput) {
  const plan = planPhotoRefresh(photoInput);
  const uploadedCount = plan.upload ? plan.feedPhotoCount - plan.missing.length : 0;
  return { plan, outcome: settlePhotoUpload(plan, uploadedCount) };
}

describe("strażnik re-uploadu działa jak dawne photosUnchanged", () => {
  it("oferta bez zmian nie sprawdza plików i niczego nie wgrywa", () => {
    const plan = planPhotoRefresh({
      ...input({ incomingUpdatedAt: STORED }),
      isAvailable: () => {
        throw new Error("strażnik nie powinien sprawdzać plików");
      },
    });

    expect(plan).toMatchObject({ unchanged: true, upload: false });
    expect(settlePhotoUpload(plan, 0)).toEqual({
      replace: false,
      syncedWithFeed: true,
      note: "Zdjęcia bez zmian.",
      warn: false,
    });
  });

  it("nowsza data, reaktywacja albo nieznana data sprawdzają zdjęcia od nowa", () => {
    expect(planPhotoRefresh(input()).upload).toBe(true);
    expect(planPhotoRefresh(input({ incomingUpdatedAt: STORED, wasEnded: true })).upload).toBe(true);
    expect(planPhotoRefresh(input({ incomingUpdatedAt: STORED, storedUpdatedAt: null })).upload).toBe(true);
    expect(planPhotoRefresh(input({ incomingUpdatedAt: null })).upload).toBe(true);
  });

  it("ta sama data, ale inna liczba zdjęć w bazie niż w feedzie: sprawdzamy zdjęcia", () => {
    expect(planPhotoRefresh(input({ incomingUpdatedAt: STORED, existingPhotoCount: 2 })).unchanged).toBe(false);
  });
});

describe("brakujące pliki zdjęć", () => {
  it("oferta ze zdjęciami nie dostaje uboższej galerii, zostaje stara", () => {
    const feed = names(10);
    const { plan, outcome } = decide(input({ feedPhotoNames: feed, available: feed.slice(0, 7), existingPhotoCount: 10 }));

    expect(plan.upload).toBe(false);
    expect(outcome).toEqual({
      replace: false,
      syncedWithFeed: false,
      note: "Zostaje obecna galeria (10). Brak plików: 3 z 10 (8.jpg, 9.jpg, 10.jpg).",
      warn: true,
    });
  });

  it("oferta bez zdjęć dostaje to, co jest", () => {
    const { plan, outcome } = decide(
      input({ feedPhotoNames: names(5), available: ["1.jpg", "3.jpg", "5.jpg"], existingPhotoCount: 0 })
    );

    expect(plan.upload).toBe(true);
    expect(outcome).toEqual({
      replace: true,
      syncedWithFeed: false,
      note: "Oferta dostaje niepełną galerię (3). Brak plików: 2 z 5 (2.jpg, 4.jpg).",
      warn: true,
    });
  });

  it("niepełny zestaw większy od obecnej galerii ją zastępuje", () => {
    const feed = names(10);
    const { outcome } = decide(input({ feedPhotoNames: feed, available: feed.slice(1), existingPhotoCount: 2 }));

    expect(outcome.replace).toBe(true);
    expect(outcome.note).toBe(
      "Galeria wymieniona na niepełną (9), bo obecna była mniejsza (2). Brak plików: 1 z 10 (1.jpg)."
    );
  });

  it("komplet z feedu zastępuje galerię, także mniejszą (biuro usunęło zdjęcia)", () => {
    expect(decide(input({ feedPhotoNames: names(6), existingPhotoCount: 10 })).outcome).toEqual({
      replace: true,
      syncedWithFeed: true,
      note: "Zdjęcia wymienione (6).",
      warn: false,
    });
  });

  it("paczka różnicowa bez plików przy zgodnej liczbie zdjęć: galeria zostaje, bez ostrzeżenia", () => {
    // Zwykła aktualizacja Galactiki: 5 nazw w feedzie, 5 zdjęć w galerii, zero plików w paczce.
    const { plan, outcome } = decide(input({ feedPhotoNames: names(5), available: [], existingPhotoCount: 5 }));

    expect(plan.upload).toBe(false);
    expect(outcome).toEqual({
      replace: false,
      syncedWithFeed: false,
      note: "Zdjęcia bez zmian (paczka bez plików, galeria 5).",
      warn: false,
    });
  });

  it("brak wszystkich plików przy innej liczbie zdjęć niż w galerii: ostrzeżenie zostaje", () => {
    const { outcome } = decide(input({ feedPhotoNames: names(5), available: [], existingPhotoCount: 4 }));

    expect(outcome).toMatchObject({ replace: false, warn: true });
    expect(outcome.note).toBe("Zostaje obecna galeria (4). Brak plików: 5 z 5 (1.jpg, 2.jpg, 3.jpg, …).");
  });

  it("brak wszystkich plików przy ofercie bez zdjęć: nic do wgrania", () => {
    const { plan, outcome } = decide(input({ feedPhotoNames: names(6), available: [], existingPhotoCount: 0 }));

    expect(plan.upload).toBe(false);
    expect(outcome.replace).toBe(false);
    expect(outcome.note).toBe("Oferta zostaje bez zdjęć. Brak plików: 6 z 6 (1.jpg, 2.jpg, 3.jpg, …).");
  });
});

describe("pusta lista zdjęć w feedzie", () => {
  it("nie kasuje galerii oferty", () => {
    const { plan, outcome } = decide(input({ feedPhotoNames: [], existingPhotoCount: 5 }));

    expect(plan.upload).toBe(false);
    expect(outcome).toEqual({
      replace: false,
      syncedWithFeed: false,
      note: "Feed nie podaje zdjęć, zostaje obecna galeria (5).",
      warn: true,
    });
  });

  it("oferta bez zdjęć w bazie i w feedzie przechodzi bez adnotacji", () => {
    expect(decide(input({ feedPhotoNames: [], existingPhotoCount: 0 })).outcome).toEqual({
      replace: false,
      syncedWithFeed: true,
      note: null,
      warn: false,
    });
  });
});

describe("kolejne przebiegi tej samej oferty", () => {
  /**
   * Oferta zmieniona raz (data NEWER), potem przebiegi co kilka godzin z tą samą wersją feedu.
   * `onFtpPerRun` to pliki leżące na FTP w kolejnych przebiegach. Datę zapisujemy tak jak silnik:
   * tylko przy `syncedWithFeed`.
   */
  function simulate(start: { existingPhotoCount: number; feed: string[] }, onFtpPerRun: string[][]) {
    let existingPhotoCount = start.existingPhotoCount;
    let storedUpdatedAt = STORED;
    const perRun: string[] = [];

    for (const onFtp of onFtpPerRun) {
      const { plan, outcome } = decide(
        input({ feedPhotoNames: start.feed, available: onFtp, existingPhotoCount, storedUpdatedAt })
      );
      if (outcome.replace) existingPhotoCount = plan.feedPhotoCount - plan.missing.length;
      if (outcome.syncedWithFeed) storedUpdatedAt = NEWER;
      perRun.push(outcome.replace ? "wymiana" : plan.upload ? "wgrane-na-prozno" : "bez-wgrywania");
    }

    return { perRun, existingPhotoCount };
  }

  /** Stary kod: data zapisywana zawsze, re-upload przy każdej niezgodności liczby zdjęć. */
  function simulateOldCode(start: { existingPhotoCount: number; feed: string[] }, onFtpPerRun: string[][]) {
    let existingPhotoCount = start.existingPhotoCount;
    let storedUpdatedAt = STORED;
    let uploads = 0;

    for (const onFtp of onFtpPerRun) {
      const photosUnchanged = NEWER <= storedUpdatedAt && existingPhotoCount === start.feed.length;
      if (!photosUnchanged) {
        uploads += 1;
        existingPhotoCount = start.feed.filter((name) => onFtp.includes(name)).length;
      }
      storedUpdatedAt = NEWER;
    }

    return { uploads, existingPhotoCount };
  }

  const repeat = <T,>(times: number, value: T): T[] => Array.from({ length: times }, () => value);

  it("oferta bez zdjęć, 2 z 5 plików brak na stałe: niepełna galeria raz, potem bez wgrywania", () => {
    const feed = names(5);
    const runs = repeat(6, feed.slice(0, 3));

    expect(simulate({ existingPhotoCount: 0, feed }, runs)).toEqual({
      perRun: ["wymiana", ...repeat(5, "bez-wgrywania")],
      existingPhotoCount: 3,
    });
    // Stary kod ściągał i wgrywał te same 3 zdjęcia w każdym przebiegu.
    expect(simulateOldCode({ existingPhotoCount: 0, feed }, runs).uploads).toBe(6);
  });

  it("biuro podmieniło zdjęcia, jednego pliku brak na stałe: stara galeria, zero wgrywania", () => {
    const feed = names(10, "nowe-");
    const runs = repeat(6, feed.slice(0, 9));

    expect(simulate({ existingPhotoCount: 10, feed }, runs)).toEqual({
      perRun: repeat(6, "bez-wgrywania"),
      existingPhotoCount: 10,
    });
    // Stary kod: uboższa galeria i wgrywanie w każdym przebiegu.
    expect(simulateOldCode({ existingPhotoCount: 10, feed }, runs)).toEqual({ uploads: 6, existingPhotoCount: 9 });
  });

  it("brakujący plik dociera w kolejnym przebiegu: galeria wymienia się na komplet", () => {
    const feed = names(10, "nowe-");
    const runs = [feed.slice(0, 9), feed, feed, feed];

    // Bez `syncedWithFeed` drugi przebieg uznałby ofertę za niezmienioną (10 zdjęć = 10 w feedzie).
    expect(simulate({ existingPhotoCount: 10, feed }, runs)).toEqual({
      perRun: ["bez-wgrywania", "wymiana", "bez-wgrywania", "bez-wgrywania"],
      existingPhotoCount: 10,
    });
  });
});

describe("plik zniknął między listowaniem a pobraniem", () => {
  const feed = names(10);

  it("wgrane mniej niż obecna galeria: galeria zostaje", () => {
    const plan = planPhotoRefresh(input({ feedPhotoNames: feed, existingPhotoCount: 10 }));
    expect(plan.upload).toBe(true);

    expect(settlePhotoUpload(plan, 9)).toEqual({
      replace: false,
      syncedWithFeed: false,
      note: "Zostaje obecna galeria (10). Brak plików: 1 z 10.",
      warn: true,
    });
    expect(settlePhotoUpload(plan, 0).replace).toBe(false);
  });

  it("wgrane więcej niż obecna galeria: podmieniamy", () => {
    const plan = planPhotoRefresh(input({ feedPhotoNames: feed, existingPhotoCount: 3 }));
    expect(settlePhotoUpload(plan, 9)).toMatchObject({ replace: true, syncedWithFeed: false });
  });
});

describe("kolejność zapisu", () => {
  /**
   * Model w pamięci: wiersze Zdjecie jednej oferty i obiekty w R2. Martwe zdjęcie = wiersz bez
   * obiektu (portal pokazuje pusty kafelek), wyciek = obiekt bez wiersza (koszt miejsca w R2).
   */
  function world(initialRows: string[]) {
    let rows = [...initialRows];
    const r2 = new Set(initialRows);
    const events: string[] = [];
    const warnings: string[] = [];
    let seq = 0;

    const upload = (count: number, failAt?: number) => async (): Promise<UploadedPhoto[]> => {
      const uploaded: UploadedPhoto[] = [];
      for (let i = 0; i < count; i += 1) {
        if (i === failAt) {
          // Tak sprząta uploadOfferPhotosToR2 w silnikach: wgrane w tym wywołaniu nie mają wiersza.
          for (const photo of uploaded) r2.delete(photo.publicId);
          events.push("upload:blad");
          throw new Error("FTP: timeout przy pobieraniu zdjęcia");
        }
        seq += 1;
        const key = `nowe-${seq}`;
        r2.add(key);
        uploaded.push({ url: `https://r2.example/${key}`, publicId: key, kolejnosc: i });
      }
      events.push(`upload:${uploaded.length}`);
      return uploaded;
    };

    /** Transakcja importu. `beforeSwap` odpala się w jej środku, np. równoległy przebieg. */
    const save =
      (options: { fail?: "przed-commitem" | "po-commicie"; beforeSwap?: () => Promise<unknown> } = {}) =>
      async (photos: PhotoSave): Promise<string[]> => {
        events.push("zapis");
        await options.beforeSwap?.();
        if (options.fail === "przed-commitem") throw new Error("transakcja przerwana");
        // swapOfferPhotos czyta galerię w transakcji, po zablokowaniu wiersza działki.
        const previous = rows;
        if (photos.replace) rows = photos.photos.map((photo) => photo.publicId);
        if (options.fail === "po-commicie") throw new Error("połączenie zerwane po commicie");
        return photos.replace ? previous : [];
      };

    const effects: PhotoRefreshEffects = {
      deleteObjects: async (keys) => {
        events.push(`kasowanie:${keys.join(",")}`);
        for (const key of keys) r2.delete(key);
      },
      discardUnsaved: async (photos) => {
        events.push("sprzatanie-po-bledzie");
        for (const photo of photos) if (!rows.includes(photo.publicId)) r2.delete(photo.publicId);
      },
      warn: (message) => {
        warnings.push(message);
      },
    };

    return {
      events,
      warnings,
      upload,
      save,
      effects,
      rows: () => rows,
      deadRows: () => rows.filter((key) => !r2.has(key)),
      leaked: () => [...r2].filter((key) => !rows.includes(key)),
      /** Stary kod: kasowanie obiektów R2, wgranie nowych, transakcja podmienia wiersze. */
      async oldOrder(uploadPhotos: () => Promise<UploadedPhoto[]>, savePhotos: (photos: PhotoSave) => Promise<string[]>) {
        for (const key of rows) r2.delete(key);
        const uploaded = await uploadPhotos();
        await savePhotos({ replace: true, syncedWithFeed: true, note: null, warn: false, photos: uploaded });
      },
    };
  }

  const OLD = ["stare-1", "stare-2", "stare-3"];
  const replacePlan = () => planPhotoRefresh(input({ existingPhotoCount: 3 }));

  it("stare obiekty R2 znikają dopiero po zapisie nowej galerii", async () => {
    const w = world(OLD);
    await refreshOfferPhotos({ plan: replacePlan(), label: "[TEST]", upload: w.upload(3), save: w.save(), effects: w.effects });

    expect(w.events).toEqual(["upload:3", "zapis", "kasowanie:stare-1,stare-2,stare-3"]);
    expect(w.rows()).toEqual(["nowe-1", "nowe-2", "nowe-3"]);
    expect(w.deadRows()).toEqual([]);
    expect(w.leaked()).toEqual([]);
  });

  it("wyjątek w trakcie wgrywania nie rusza galerii (stary kod zostawiał martwe zdjęcia)", async () => {
    const stary = world(OLD);
    await expect(stary.oldOrder(stary.upload(3, 2), stary.save())).rejects.toThrow("timeout");
    expect(stary.deadRows()).toEqual(OLD);

    const w = world(OLD);
    await expect(
      refreshOfferPhotos({ plan: replacePlan(), label: "[TEST]", upload: w.upload(3, 2), save: w.save(), effects: w.effects })
    ).rejects.toThrow("timeout");

    expect(w.events).toEqual(["upload:blad"]);
    expect(w.rows()).toEqual(OLD);
    expect(w.deadRows()).toEqual([]);
    expect(w.leaked()).toEqual([]);
  });

  it("padnięta transakcja: stara galeria żyje, nowe pliki sprzątnięte", async () => {
    const stary = world(OLD);
    await expect(stary.oldOrder(stary.upload(3), stary.save({ fail: "przed-commitem" }))).rejects.toThrow();
    expect(stary.deadRows()).toEqual(OLD);

    const w = world(OLD);
    await expect(
      refreshOfferPhotos({
        plan: replacePlan(),
        label: "[TEST]",
        upload: w.upload(3),
        save: w.save({ fail: "przed-commitem" }),
        effects: w.effects,
      })
    ).rejects.toThrow("transakcja przerwana");

    expect(w.rows()).toEqual(OLD);
    expect(w.deadRows()).toEqual([]);
    expect(w.leaked()).toEqual([]);
  });

  it("błąd zgłoszony po commicie: nie kasujemy zdjęć, do których prowadzą już wiersze", async () => {
    const w = world(OLD);
    await expect(
      refreshOfferPhotos({
        plan: replacePlan(),
        label: "[TEST]",
        upload: w.upload(3),
        save: w.save({ fail: "po-commicie" }),
        effects: w.effects,
      })
    ).rejects.toThrow("po commicie");

    expect(w.rows()).toEqual(["nowe-1", "nowe-2", "nowe-3"]);
    expect(w.deadRows()).toEqual([]);
    // Stare pliki zostają jako wyciek: lepsze to niż martwe zdjęcia.
    expect(w.leaked()).toEqual(OLD);
  });

  it("drugi przebieg zapisany w trakcie transakcji: nikt nie kasuje zdjęć, do których prowadzą wiersze", async () => {
    const w = world(OLD);
    const runA = () =>
      refreshOfferPhotos({ plan: replacePlan(), label: "[A]", upload: w.upload(3), save: w.save(), effects: w.effects });

    // Przebieg B wgrał swoje zdjęcia, a zanim podmienił galerię, przebieg A zrobił całość.
    await refreshOfferPhotos({
      plan: replacePlan(),
      label: "[B]",
      upload: w.upload(3),
      save: w.save({ beforeSwap: runA }),
      effects: w.effects,
    });

    expect(w.rows()).toEqual(["nowe-1", "nowe-2", "nowe-3"]);
    expect(w.deadRows()).toEqual([]);
    expect(w.leaked()).toEqual([]);
  });

  it("błąd kasowania starych obiektów nie przerywa importu oferty", async () => {
    const w = world(OLD);
    const outcome = await refreshOfferPhotos({
      plan: replacePlan(),
      label: "[ASARI] Oferta 1/2/OGS",
      upload: w.upload(3),
      save: w.save(),
      effects: {
        ...w.effects,
        deleteObjects: async () => {
          throw new Error("R2 503");
        },
      },
    });

    expect(outcome.replace).toBe(true);
    expect(w.deadRows()).toEqual([]);
    expect(w.warnings).toEqual([
      "[ASARI] Oferta 1/2/OGS: kasowanie zdjęć sprzed wymiany nie powiodło się, pliki zostają w R2 (R2 503).",
    ]);
  });

  it("brakujące pliki: bez wgrywania, galeria nietknięta, ostrzeżenie w logu", async () => {
    const w = world(OLD);
    const plan = planPhotoRefresh(input({ feedPhotoNames: names(4), available: names(2), existingPhotoCount: 3 }));
    const saved: PhotoSave[] = [];

    const outcome = await refreshOfferPhotos({
      plan,
      label: "[ESTICRM] Oferta X",
      upload: async () => {
        throw new Error("nie powinno wgrywać");
      },
      save: async (photos) => {
        saved.push(photos);
        return [];
      },
      effects: w.effects,
    });

    const note = "Zostaje obecna galeria (3). Brak plików: 2 z 4 (3.jpg, 4.jpg).";
    expect(outcome.replace).toBe(false);
    expect(saved).toEqual([{ replace: false, syncedWithFeed: false, note, warn: true, photos: [] }]);
    expect(w.warnings).toEqual([`[ESTICRM] Oferta X: ${note}`]);
    expect(w.rows()).toEqual(OLD);
  });

  it("wgrane na próżno kasujemy od razu, zanim ruszy transakcja", async () => {
    const w = world(OLD);
    // Plan przewidział komplet 3 zdjęć, ale jedno zniknęło z FTP przed pobraniem.
    await refreshOfferPhotos({ plan: replacePlan(), label: "[TEST]", upload: w.upload(2), save: w.save(), effects: w.effects });

    expect(w.events).toEqual(["upload:2", "kasowanie:nowe-1,nowe-2", "zapis"]);
    expect(w.rows()).toEqual(OLD);
    expect(w.leaked()).toEqual([]);
  });
});

describe("appendPhotoNote", () => {
  it("dokleja adnotację do komunikatu tylko wtedy, gdy jest", () => {
    expect(appendPhotoNote("Oferta zaktualizowana poprawnie z importu ASARI.", "Zdjęcia bez zmian.")).toBe(
      "Oferta zaktualizowana poprawnie z importu ASARI. Zdjęcia bez zmian."
    );
    expect(appendPhotoNote("Oferta zaktualizowana.", null)).toBe("Oferta zaktualizowana.");
  });
});
