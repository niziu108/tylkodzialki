import crypto from "crypto";
import path from "path";
import os from "os";
import { promises as fsp } from "fs";
import * as ftp from "basic-ftp";
import { XMLParser } from "fast-xml-parser";
import {
  GazStatus,
  KanalizacjaStatus,
  LocationMode,
  PradStatus,
  Prisma,
  Przeznaczenie,
  WodaStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, uploadBufferToR2 } from "@/lib/r2";

type IntegrationForSync = {
  id: string;
  userId: string;
  name: string;
  provider: string;
  isActive: boolean;
  ftpHost: string | null;
  ftpPort: number | null;
  ftpUsername: string | null;
  ftpPassword: string | null;
  ftpRemotePath: string | null;
  ftpPassive: boolean;
  fullImportMode: boolean;
};

type SyncSummary = {
  success: boolean;
  remoteFileName: string;
  importedOffers: number;
  createdCount: number;
  updatedCount: number;
  deactivatedCount: number;
  skippedCount: number;
  errorCount: number;
  message: string;
};

type AsariOffer = {
  externalId: string;
  externalUpdatedAt: Date | null;
  title: string;
  description: string | null;
  pricePln: number;
  areaM2: number;
  email: string;
  phone: string;
  locationLabel: string | null;
  locationFull: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  plotTypeRaw: string | null;
  przeznaczenia: Przeznaczenie[];
  photoFileNames: string[];
  biuroNazwa: string | null;
  biuroOpiekun: string | null;
  prad: PradStatus;
  woda: WodaStatus;
  kanalizacja: KanalizacjaStatus;
  gaz: GazStatus;
  wymiary: string | null;
  payload: Prisma.InputJsonValue;
};

type DownloadedAsariFeed = {
  remoteFileName: string;
  tempDir: string;
  offerXmlFiles: string[];
  localFileByBasename: Map<string, string>;
  cfg: {
    fileName: string | null;
    emptyOffers: boolean;
    listedOfferFiles: string[];
    definitionsFileName: string | null;
  };
  cleanup: () => Promise<void>;
};

function makeEditToken() {
  return crypto.randomBytes(24).toString("hex");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function arrify<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}



function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTextValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map(toTextValue).filter(Boolean).join("\n").trim();
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"].trim();
    if (typeof obj.text === "string") return obj.text.trim();
  }

  return "";
}

function normalizeText(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function normalizePhone(value: string) {
  return value.trim();
}

function parseDate(value: unknown): Date | null {
  const text = toTextValue(value);
  if (!text) return null;

  const normalized = text.includes(" ") ? text.replace(" ", "T") : text;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function buildMapsUrl(lat: number | null, lng: number | null) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function getMimeTypeFromFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  return "image/jpeg";
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hasAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}

function mapPlotTypeToPrzeznaczenia(plotTypeRaw: string | null, planRaw?: string | null): Przeznaczenie[] {
  const text = normalizeText(`${plotTypeRaw ?? ""} ${planRaw ?? ""}`);
  const result = new Set<Przeznaczenie>();

  if (hasAny(text, ["budowl", "jednorodzin", "mieszkaniow", "mieszkaniowy"])) {
    result.add("BUDOWLANA");
  }

  if (hasAny(text, ["roln", "grunty orne"])) result.add("ROLNA");
  if (hasAny(text, ["les", "leś"])) result.add("LESNA");
  if (hasAny(text, ["rekre"])) result.add("REKREACYJNA");
  if (hasAny(text, ["siedl"])) result.add("SIEDLISKOWA");

  if (hasAny(text, ["inwest", "komerc", "usług", "uslug", "przemys", "produkcyj", "magazyn"])) {
    result.add("INWESTYCYJNA");
  }

  if (result.size === 0) result.add("BUDOWLANA");
  return [...result];
}

function sanitizeTitle(raw: string | null, miasto: string | null, plotType: string | null) {
  const value = (raw ?? "").trim();
  if (value.length >= 5) return value.slice(0, 160);

  const cityPart = miasto?.trim() ? ` – ${miasto.trim()}` : "";
  const typePart = plotType?.trim() ? plotType.trim() : "działka";
  return `Działka ${typePart}${cityPart}`.slice(0, 160);
}

function buildWymiary(width: number | null, length: number | null): string | null {
  if (width && length) return `${width} x ${length} m`;
  if (width) return `${width} m szerokości`;
  if (length) return `${length} m długości`;
  return null;
}

function mapPrad(textRaw: string): PradStatus {
  const text = normalizeText(textRaw);
  if (hasAny(text, ["prąd", "prad", "energia", "elektry"])) return "MOZLIWOSC_PRZYLACZENIA";
  return "BRAK_PRZYLACZA";
}

function mapWoda(textRaw: string): WodaStatus {
  const text = normalizeText(textRaw);
  if (hasAny(text, ["woda", "wodociąg", "wodociag"])) return "MOZLIWOSC_PODLACZENIA";
  return "BRAK_PRZYLACZA";
}

function mapGaz(textRaw: string): GazStatus {
  const text = normalizeText(textRaw);
  if (hasAny(text, ["gaz"])) return "MOZLIWOSC_PODLACZENIA";
  return "BRAK";
}

function mapKanalizacja(textRaw: string): KanalizacjaStatus {
  const text = normalizeText(textRaw);
  if (hasAny(text, ["kanalizacja"])) return "MOZLIWOSC_PODLACZENIA";
  if (hasAny(text, ["szambo"])) return "SZAMBO";
  return "BRAK";
}

function parseParams(paramsNode: unknown): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const node = paramsNode as Record<string, unknown> | undefined;

  for (const item of arrify(node?.p)) {
    if (!item || typeof item !== "object") continue;

    const p = item as Record<string, unknown>;
    const id = String(p.id ?? p["@_id"] ?? "").trim();

    if (!id) continue;

    params[id] = p["#text"] ?? p.text ?? p;
  }

  return params;
}

function parsePictures(picturesNode: unknown): string[] {
  const node = picturesNode as Record<string, unknown> | undefined;

  return arrify(node?.picture)
    .map((picture) => {
      if (!picture || typeof picture !== "object") return null;
      const p = picture as Record<string, unknown>;

      return {
        unique: toTextValue(p.unique),
        status: toNumber(p.status) ?? 0,
        weight: toNumber(p.weight) ?? 9999,
      };
    })
    .filter((item): item is { unique: string; status: number; weight: number } => Boolean(item?.unique))
    .sort((a, b) => {
      if (a.status === 1 && b.status !== 1) return -1;
      if (b.status === 1 && a.status !== 1) return 1;
      return a.weight - b.weight;
    })
    .map((item) => item.unique);
}

function isLikelyLandOffer(params: Record<string, unknown>) {
  const plotType = toTextValue(params["18"]);
  const lotArea = toTextValue(params["61"]);
  const plan = toTextValue(params["44"]);
  return Boolean(plotType || lotArea || plan);
}

function parseAsariOffer(rawOffer: Record<string, unknown>, agencyName: string | null): AsariOffer | null {
  const externalId = toTextValue(rawOffer.signature);

  if (!externalId) {
    console.log("[ASARI DEBUG] Odrzucono ofertę: brak signature.");
    return null;
  }

  const params = parseParams(rawOffer.parameters);

  if (!isLikelyLandOffer(params)) {
    console.log("[ASARI DEBUG] Odrzucono:", externalId, "to nie wygląda na działkę.");
    return null;
  }

  const price = toNumber(params["10"]);
  const area = toNumber(params["61"]) ?? toNumber(params["128"]);

  const wojewodztwo = toTextValue(params["45"]) || toTextValue(params["190"]) || null;
  const powiat = toTextValue(params["46"]) || toTextValue(params["191"]) || null;
  const gmina = toTextValue(params["47"]) || toTextValue(params["192"]) || null;
  const miasto = toTextValue(params["48"]) || toTextValue(params["193"]) || null;
  const dzielnica = toTextValue(params["49"]) || toTextValue(params["194"]) || null;
  const ulica = toTextValue(params["195"]) || toTextValue(params["300"]) || null;

  if (!price || price <= 0) {
    console.log("[ASARI DEBUG] Odrzucono:", externalId, "brak ceny.", { cena: params["10"] });
    return null;
  }

  if (!area || area < 1) {
    console.log("[ASARI DEBUG] Odrzucono:", externalId, "brak powierzchni.", { lotArea: params["61"] });
    return null;
  }

  if (!wojewodztwo || !miasto) {
    console.log("[ASARI DEBUG] Odrzucono:", externalId, "brak lokalizacji.", {
      wojewodztwo,
      miasto,
    });
    return null;
  }

  const plotTypeRaw = toTextValue(params["18"]) || null;
  const planRaw = toTextValue(params["44"]) || null;
  const titleRaw = toTextValue(params["491"]);
  const description = toTextValue(rawOffer.description) || toTextValue(params["64"]) || null;

  const labelParts = [miasto, dzielnica].filter(Boolean);
  const locationLabel = labelParts.length > 0 ? labelParts.join(", ") : miasto;

  const fullParts = [ulica, miasto, dzielnica, gmina, powiat, wojewodztwo].filter(Boolean);
  const locationFull = fullParts.length > 0 ? fullParts.join(", ") : null;

  const lat = toNumber(params["201"]) ?? toNumber(params["205"]);
  const lng = toNumber(params["202"]) ?? toNumber(params["206"]);

  const mediaText = [
    toTextValue(params["39"]),
    toTextValue(params["155"]),
    toTextValue(params["156"]),
    toTextValue(params["157"]),
  ].join(" ");

  const width = toNumber(params["57"]);
  const length = toNumber(params["56"]);

  const email = normalizeEmail(toTextValue(params["171"]) || toTextValue(params["475"])) || "kontakt@tylkodzialki.pl";
  const phone = normalizePhone(toTextValue(params["170"]) || toTextValue(params["473"]) || "000000000");

  const biuroOpiekun = toTextValue(params["305"]) || toTextValue(params["471"]) || null;

  const photoFileNames = parsePictures(rawOffer.pictures);

  const prad = mapPrad(mediaText);
  const woda = mapWoda(mediaText);
  const kanalizacja = mapKanalizacja(mediaText);
  const gaz = mapGaz(mediaText);

  return {
    externalId,
    externalUpdatedAt: parseDate(params["3"]) ?? parseDate(params["406"]) ?? null,
    title: sanitizeTitle(titleRaw, miasto, plotTypeRaw),
    description,
    pricePln: Math.round(price),
    areaM2: Math.round(area),
    email,
    phone,
    locationLabel,
    locationFull,
    lat,
    lng,
    mapsUrl: buildMapsUrl(lat, lng),
    plotTypeRaw,
    przeznaczenia: mapPlotTypeToPrzeznaczenia(plotTypeRaw, planRaw),
    photoFileNames,
    biuroNazwa: agencyName,
    biuroOpiekun,
    prad,
    woda,
    kanalizacja,
    gaz,
    wymiary: buildWymiary(width, length),
    payload: toInputJsonValue({
      externalId,
      params,
      plotTypeRaw,
      planRaw,
      agencyName,
      mappedMedia: {
        prad,
        woda,
        kanalizacja,
        gaz,
      },
      photoFileNames,
    }),
  };
}

function parseDeleteSignatures(doc: Record<string, unknown>): string[] {
  const packageNode = (doc.PACKAGE ?? doc.package ?? doc) as Record<string, unknown>;
  const deleteNode = (packageNode.DELETE ?? packageNode.delete) as Record<string, unknown> | undefined;
  const offersNode = deleteNode?.offers as Record<string, unknown> | undefined;

  return arrify(offersNode?.signature)
    .map((value) => toTextValue(value))
    .filter(Boolean);
}

function parseCfgXml(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const packageNode = (doc.PACKAGE ?? doc.package ?? doc) as Record<string, unknown>;

  const filesNode = packageNode.FILES as Record<string, unknown> | undefined;

  return {
    emptyOffers: toTextValue(packageNode.empty_offers) === "1",
    definitionsFileName: toTextValue(packageNode.definictions) || toTextValue(packageNode.definitions) || null,
    listedOfferFiles: arrify(filesNode?.file).map((file) => toTextValue(file)).filter(Boolean),
  };
}

async function downloadFile(client: ftp.Client, remotePath: string, localPath: string) {
  await fsp.mkdir(path.dirname(localPath), { recursive: true });
  await client.downloadTo(localPath, remotePath);
}

async function listCurrentAndOneLevel(client: ftp.Client, remoteDir: string) {
  const current = await client.list();

  const result: Array<{
    name: string;
    remotePath: string;
    isFile: boolean;
    isDirectory: boolean;
    size: number;
    modifiedAt?: Date;
  }> = current.map((item) => ({
    name: item.name,
    remotePath: item.name,
    isFile: item.isFile,
    isDirectory: item.isDirectory,
    size: item.size,
    modifiedAt: item.modifiedAt,
  }));

  for (const item of current) {
    if (!item.isDirectory) continue;

    const dirName = item.name;
    try {
      await client.cd(dirName);
      const nested = await client.list();

      for (const nestedItem of nested) {
        result.push({
          name: nestedItem.name,
          remotePath: `${dirName}/${nestedItem.name}`,
          isFile: nestedItem.isFile,
          isDirectory: nestedItem.isDirectory,
          size: nestedItem.size,
          modifiedAt: nestedItem.modifiedAt,
        });
      }

      await client.cd("..");
    } catch (error) {
      console.warn("[ASARI DEBUG] Nie udało się wejść do podkatalogu:", dirName, error);
      await client.cd(remoteDir).catch(() => {});
    }
  }

  return result;
}

async function downloadAsariFeedFromFtp(integration: IntegrationForSync): Promise<DownloadedAsariFeed> {
  if (!integration.ftpHost || !integration.ftpUsername || !integration.ftpPassword) {
    throw new Error("Integracja ASARI nie ma uzupełnionych danych FTP.");
  }

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "td-asari-"));
  const localFileByBasename = new Map<string, string>();

  try {
    await client.access({
      host: integration.ftpHost,
      port: integration.ftpPort ?? 21,
      user: integration.ftpUsername,
      password: integration.ftpPassword,
      secure: false,
    });

    const remoteDir = integration.ftpRemotePath?.trim() || "/";
    await client.cd(remoteDir);

    console.log("[ASARI DEBUG] FTP katalog:", remoteDir);

    const list = await listCurrentAndOneLevel(client, remoteDir);

    console.log(
      "[ASARI DEBUG] Pliki na FTP:",
      list.map((item) => ({
        name: item.name,
        remotePath: item.remotePath,
        isFile: item.isFile,
        isDirectory: item.isDirectory,
        size: item.size,
        modifiedAt: item.modifiedAt,
      }))
    );

    const files = list.filter((item) => item.isFile);
    const xmlFiles = files.filter((item) => item.name.toLowerCase().endsWith(".xml"));
    const imageFiles = files.filter((item) => /\.(jpe?g|png|webp|avif)$/i.test(item.name));

    const cfgFiles = xmlFiles
      .filter((item) => /_cfg\.xml$/i.test(item.name))
      .sort((a, b) => (b.modifiedAt?.getTime() ?? 0) - (a.modifiedAt?.getTime() ?? 0));

    let cfg = {
      fileName: null as string | null,
      emptyOffers: false,
      listedOfferFiles: [] as string[],
      definitionsFileName: null as string | null,
    };

    if (cfgFiles[0]) {
      const cfgLocalPath = path.join(tempDir, cfgFiles[0].remotePath);
      await downloadFile(client, cfgFiles[0].remotePath, cfgLocalPath);
      localFileByBasename.set(safeBasename(cfgFiles[0].name), cfgLocalPath);

      const cfgXml = await fsp.readFile(cfgLocalPath, "utf8");
      const parsedCfg = parseCfgXml(cfgXml);

      cfg = {
        fileName: cfgFiles[0].name,
        ...parsedCfg,
      };

      console.log("[ASARI DEBUG] Wybrany CFG:", cfg);
    } else {
      console.log("[ASARI DEBUG] Nie znaleziono pliku *_CFG.xml. Używam fallbacku po *_001.xml.");
    }

    const offerXmlCandidates =
      cfg.listedOfferFiles.length > 0
        ? xmlFiles.filter((item) => cfg.listedOfferFiles.map(safeBasename).includes(safeBasename(item.name)))
        : xmlFiles.filter(
            (item) =>
              /_\d{3}\.xml$/i.test(item.name) &&
              !/_cfg\.xml$/i.test(item.name) &&
              !/^definictions\.xml$/i.test(item.name) &&
              !/^definitions\.xml$/i.test(item.name)
          );

    const offerXmlFiles: string[] = [];

    for (const file of offerXmlCandidates) {
      const localPath = path.join(tempDir, file.remotePath);
      await downloadFile(client, file.remotePath, localPath);
      localFileByBasename.set(safeBasename(file.name), localPath);
      offerXmlFiles.push(localPath);
    }

    for (const file of imageFiles) {
      const localPath = path.join(tempDir, file.remotePath);
      await downloadFile(client, file.remotePath, localPath);
      localFileByBasename.set(safeBasename(file.name), localPath);
    }

    console.log("[ASARI DEBUG] Pobrane pliki ofert XML:", offerXmlFiles.map((file) => path.basename(file)));
    console.log("[ASARI DEBUG] Pobrane zdjęcia:", imageFiles.length);

    return {
      remoteFileName: cfg.fileName ?? "ASARI_MULTIPLE_FILES",
      tempDir,
      offerXmlFiles,
      localFileByBasename,
      cfg,
      cleanup: async () => {
        await fsp.rm(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally {
    client.close();
  }
}

function parseOfferXmlFile(xml: string, agencyName: string | null) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const packageNode = (doc.PACKAGE ?? doc.package ?? doc) as Record<string, unknown>;

  const offers = arrify(packageNode.offer)
    .map((offerNode) => {
      if (!offerNode || typeof offerNode !== "object") return null;
      return parseAsariOffer(offerNode as Record<string, unknown>, agencyName);
    })
    .filter((offer): offer is AsariOffer => Boolean(offer));

  const deletedExternalIds = parseDeleteSignatures(doc);

  return {
    offers,
    deletedExternalIds,
  };
}

async function removeExistingR2Photos(dzialkaId: string) {
  const currentPhotos = await prisma.zdjecie.findMany({
    where: { dzialkaId },
    select: { publicId: true },
  });

  for (const photo of currentPhotos) {
    if (!photo.publicId) continue;

    try {
      await deleteFromR2(photo.publicId);
    } catch (error) {
      console.error("[ASARI DEBUG] Nie udało się usunąć zdjęcia z R2:", photo.publicId, error);
    }
  }
}

async function uploadOfferPhotosToR2(
  integrationId: string,
  externalId: string,
  photoFileNames: string[],
  localFileByBasename: Map<string, string>
) {
  const uploaded: Array<{ url: string; publicId: string; kolejnosc: number }> = [];

  for (let index = 0; index < photoFileNames.length; index += 1) {
    const originalName = photoFileNames[index];
    const localPath = localFileByBasename.get(safeBasename(originalName));

    if (!localPath) {
      console.log("[ASARI DEBUG] Brak pliku zdjęcia:", originalName);
      continue;
    }

    const buffer = await fsp.readFile(localPath);

    const upload = await uploadBufferToR2({
      buffer,
      originalFileName: `${integrationId}-${externalId}-${originalName}`,
      mimeType: getMimeTypeFromFileName(originalName),
    });

    uploaded.push({
      url: upload.url,
      publicId: upload.key,
      kolejnosc: index,
    });
  }

  return uploaded;
}

function buildDzialkaDataFromOffer(offer: AsariOffer) {
  return {
    tytul: offer.title,
    cenaPln: offer.pricePln,
    powierzchniaM2: offer.areaM2,
    email: offer.email,
    telefon: offer.phone,
    sprzedajacyTyp: "BIURO" as const,
    biuroNazwa: offer.biuroNazwa,
    biuroOpiekun: offer.biuroOpiekun,
    locationLabel: offer.locationLabel,
    locationFull: offer.locationFull,
    locationMode: "APPROX" as LocationMode,
    lat: offer.lat,
    lng: offer.lng,
    mapsUrl: offer.mapsUrl,
    przeznaczenia: offer.przeznaczenia,
    numerOferty: offer.externalId,
    opis: offer.description,
    prad: offer.prad,
    woda: offer.woda,
    kanalizacja: offer.kanalizacja,
    gaz: offer.gaz,
    wymiary: offer.wymiary,
    sourceType: "CRM" as const,
    crmImportedAt: new Date(),
    crmLastSyncedAt: new Date(),
  };
}

async function logSync(
  integrationId: string,
  input: {
    dzialkaId?: string | null;
    offerLinkId?: string | null;
    externalId?: string | null;
    action: "CREATE" | "UPDATE" | "DEACTIVATE" | "REACTIVATE" | "SKIP_NO_CREDITS" | "DELETE" | "ERROR";
    status: "SUCCESS" | "ERROR";
    message?: string | null;
    payload?: Prisma.InputJsonValue;
  }
) {
  await prisma.crmSyncLog.create({
    data: {
      integrationId,
      dzialkaId: input.dzialkaId ?? null,
      offerLinkId: input.offerLinkId ?? null,
      externalId: input.externalId ?? null,
      action: input.action,
      status: input.status,
      message: input.message ?? null,
      payload: input.payload,
    },
  });
}

async function processOffer(
  integration: IntegrationForSync,
  offer: AsariOffer,
  downloaded: DownloadedAsariFeed,
  paymentsEnabled: boolean
): Promise<"CREATE" | "UPDATE" | "REACTIVATE" | "SKIP_NO_CREDITS"> {
  const now = new Date();
  const expiresAt = addDays(now, 30);

  const existingLink = await prisma.crmOfferLink.findUnique({
    where: {
      integrationId_externalId: {
        integrationId: integration.id,
        externalId: offer.externalId,
      },
    },
    include: {
      dzialka: true,
    },
  });

  if (!existingLink) {
    const user = await prisma.user.findUnique({
      where: { id: integration.userId },
      select: { id: true, listingCredits: true },
    });

    if (!user) throw new Error("Nie znaleziono użytkownika integracji ASARI.");

    if (paymentsEnabled && user.listingCredits <= 0) {
      await logSync(integration.id, {
        externalId: offer.externalId,
        action: "SKIP_NO_CREDITS",
        status: "ERROR",
        message: "Brak dostępnych publikacji do utworzenia oferty ASARI.",
        payload: offer.payload,
      });

      return "SKIP_NO_CREDITS";
    }

    const uploadedPhotos = await uploadOfferPhotosToR2(
      integration.id,
      offer.externalId,
      offer.photoFileNames,
      downloaded.localFileByBasename
    );

    await prisma.$transaction(async (tx) => {
      const dzialka = await tx.dzialka.create({
        data: {
          ...buildDzialkaDataFromOffer(offer),
          ownerId: integration.userId,
          editToken: makeEditToken(),
          publishedAt: now,
          expiresAt,
          endedAt: null,
          status: "AKTYWNE",
          zdjecia: {
            create: uploadedPhotos,
          },
        },
      });

      const link = await tx.crmOfferLink.create({
        data: {
          integrationId: integration.id,
          dzialkaId: dzialka.id,
          externalId: offer.externalId,
          externalUpdatedAt: offer.externalUpdatedAt,
          lastImportedAt: now,
          lastSeenAt: now,
          lastPublishedAt: now,
          isActiveInSource: true,
        },
      });

      if (paymentsEnabled) {
        const updatedUser = await tx.user.update({
          where: { id: integration.userId },
          data: {
            listingCredits: {
              decrement: 1,
            },
          },
          select: {
            listingCredits: true,
          },
        });

        await tx.listingCreditTransaction.create({
          data: {
            userId: integration.userId,
            delta: -1,
            balanceAfter: updatedUser.listingCredits,
            sourceType: "CRM_PUBLICATION",
            note: `ASARI publikacja oferty ${offer.externalId}`,
          },
        });
      }

      await tx.crmSyncLog.create({
        data: {
          integrationId: integration.id,
          dzialkaId: dzialka.id,
          offerLinkId: link.id,
          externalId: offer.externalId,
          action: "CREATE",
          status: "SUCCESS",
          message: "Oferta utworzona poprawnie z importu ASARI.",
          payload: offer.payload,
        },
      });
    });

    return "CREATE";
  }

  const wasEnded = existingLink.dzialka.status === "ZAKONCZONE";

  if (wasEnded) {
    const user = await prisma.user.findUnique({
      where: { id: integration.userId },
      select: { id: true, listingCredits: true },
    });

    if (!user) throw new Error("Nie znaleziono użytkownika integracji ASARI.");

    if (paymentsEnabled && user.listingCredits <= 0) {
      await logSync(integration.id, {
        dzialkaId: existingLink.dzialkaId,
        offerLinkId: existingLink.id,
        externalId: offer.externalId,
        action: "SKIP_NO_CREDITS",
        status: "ERROR",
        message: "Brak dostępnych publikacji do reaktywacji oferty ASARI.",
        payload: offer.payload,
      });

      return "SKIP_NO_CREDITS";
    }
  }

  await removeExistingR2Photos(existingLink.dzialkaId);

  const uploadedPhotos = await uploadOfferPhotosToR2(
    integration.id,
    offer.externalId,
    offer.photoFileNames,
    downloaded.localFileByBasename
  );

  await prisma.$transaction(async (tx) => {
    await tx.zdjecie.deleteMany({
      where: { dzialkaId: existingLink.dzialkaId },
    });

    const dzialka = await tx.dzialka.update({
      where: { id: existingLink.dzialkaId },
      data: {
        ...buildDzialkaDataFromOffer(offer),
        ...(wasEnded
          ? {
              publishedAt: now,
              expiresAt,
              endedAt: null,
              status: "AKTYWNE" as const,
            }
          : {}),
        zdjecia: {
          create: uploadedPhotos,
        },
      },
    });

    await tx.crmOfferLink.update({
      where: { id: existingLink.id },
      data: {
        externalUpdatedAt: offer.externalUpdatedAt,
        lastImportedAt: now,
        lastSeenAt: now,
        lastPublishedAt: wasEnded ? now : existingLink.lastPublishedAt,
        isActiveInSource: true,
      },
    });

    if (wasEnded && paymentsEnabled) {
      const updatedUser = await tx.user.update({
        where: { id: integration.userId },
        data: {
          listingCredits: {
            decrement: 1,
          },
        },
        select: {
          listingCredits: true,
        },
      });

      await tx.listingCreditTransaction.create({
        data: {
          userId: integration.userId,
          delta: -1,
          balanceAfter: updatedUser.listingCredits,
          sourceType: "CRM_PUBLICATION",
          note: `ASARI reaktywacja oferty ${offer.externalId}`,
        },
      });
    }

    await tx.crmSyncLog.create({
      data: {
        integrationId: integration.id,
        dzialkaId: dzialka.id,
        offerLinkId: existingLink.id,
        externalId: offer.externalId,
        action: wasEnded ? "REACTIVATE" : "UPDATE",
        status: "SUCCESS",
        message: wasEnded
          ? "Oferta reaktywowana poprawnie z importu ASARI."
          : "Oferta zaktualizowana poprawnie z importu ASARI.",
        payload: offer.payload,
      },
    });
  });

  return wasEnded ? "REACTIVATE" : "UPDATE";
}

async function deactivateExternalId(integrationId: string, externalId: string) {
  const now = new Date();

  const link = await prisma.crmOfferLink.findUnique({
    where: {
      integrationId_externalId: {
        integrationId,
        externalId,
      },
    },
    include: {
      dzialka: true,
    },
  });

  if (!link) {
    await logSync(integrationId, {
      externalId,
      action: "DELETE",
      status: "SUCCESS",
      message: "ASARI zgłosiło usunięcie oferty, ale nie znaleziono jej w bazie.",
    });

    return false;
  }

  await prisma.$transaction(async (tx) => {
    if (link.dzialka.status !== "ZAKONCZONE") {
      await tx.dzialka.update({
        where: { id: link.dzialkaId },
        data: {
          status: "ZAKONCZONE",
          endedAt: now,
          crmLastSyncedAt: now,
        },
      });
    }

    await tx.crmOfferLink.update({
      where: { id: link.id },
      data: {
        lastImportedAt: now,
        lastSeenAt: now,
        lastDeactivatedAt: now,
        isActiveInSource: false,
      },
    });

    await tx.crmSyncLog.create({
      data: {
        integrationId,
        dzialkaId: link.dzialkaId,
        offerLinkId: link.id,
        externalId,
        action: "DELETE",
        status: "SUCCESS",
        message: "Oferta zakończona na podstawie sekcji DELETE z ASARI.",
      },
    });
  });

  return true;
}

async function deactivateMissingOffers(integrationId: string, seenExternalIds: Set<string>) {
  const now = new Date();

  const linksToDeactivate = await prisma.crmOfferLink.findMany({
    where: {
      integrationId,
      isActiveInSource: true,
      externalId: {
        notIn: [...seenExternalIds],
      },
    },
    include: {
      dzialka: true,
    },
  });

  let count = 0;

  for (const link of linksToDeactivate) {
    await prisma.$transaction(async (tx) => {
      if (link.dzialka.status !== "ZAKONCZONE") {
        await tx.dzialka.update({
          where: { id: link.dzialkaId },
          data: {
            status: "ZAKONCZONE",
            endedAt: now,
            crmLastSyncedAt: now,
          },
        });
      }

      await tx.crmOfferLink.update({
        where: { id: link.id },
        data: {
          lastImportedAt: now,
          lastSeenAt: now,
          lastDeactivatedAt: now,
          isActiveInSource: false,
        },
      });

      await tx.crmSyncLog.create({
        data: {
          integrationId,
          dzialkaId: link.dzialkaId,
          offerLinkId: link.id,
          externalId: link.externalId,
          action: "DEACTIVATE",
          status: "SUCCESS",
          message: "Oferta zakończona, ponieważ ASARI wysłało pełne czyszczenie eksportu.",
        },
      });
    });

    count += 1;
  }

  return count;
}

export async function syncAsariIntegrationNow(integrationId: string): Promise<SyncSummary> {
  console.log("[ASARI DEBUG] Start synchronizacji:", integrationId);

  const integration = await prisma.crmIntegration.findUnique({
    where: { id: integrationId },
    select: {
      id: true,
      userId: true,
      name: true,
      provider: true,
      isActive: true,
      ftpHost: true,
      ftpPort: true,
      ftpUsername: true,
      ftpPassword: true,
      ftpRemotePath: true,
      ftpPassive: true,
      fullImportMode: true,
    },
  });

  if (!integration) throw new Error("Nie znaleziono integracji ASARI.");
  if (!integration.isActive) throw new Error("Integracja ASARI jest wyłączona.");
  if (integration.provider !== "ASARI") throw new Error("Ta integracja nie jest ASARI.");

  const now = new Date();
  let downloaded: DownloadedAsariFeed | null = null;

  try {
    downloaded = await downloadAsariFeedFromFtp(integration);

    const appConfig = await prisma.appConfig.findFirst();
    const paymentsEnabled = appConfig?.paymentsEnabled ?? false;

    let importedOffers = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let deactivatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const seenExternalIds = new Set<string>();
    const deletedExternalIds = new Set<string>();

    if (downloaded.offerXmlFiles.length === 0) {
      console.log("[ASARI DEBUG] Brak plików ofert XML. To jest OK, jeśli ASARI jeszcze nie wysłało eksportu.");
    }

    for (const offerXmlFile of downloaded.offerXmlFiles) {
      const xml = await fsp.readFile(offerXmlFile, "utf8");
      const result = parseOfferXmlFile(xml, integration.name);

      for (const externalId of result.deletedExternalIds) {
        deletedExternalIds.add(externalId);
      }

      for (const offer of result.offers) {
        importedOffers += 1;
        seenExternalIds.add(offer.externalId);

        try {
          const action = await processOffer(integration, offer, downloaded, paymentsEnabled);

          if (action === "CREATE" || action === "REACTIVATE") {
            createdCount += 1;
          } else if (action === "UPDATE") {
            updatedCount += 1;
          } else if (action === "SKIP_NO_CREDITS") {
            skippedCount += 1;
          }
        } catch (error) {
          errorCount += 1;

          const message =
            error instanceof Error ? error.message : "Nieznany błąd podczas importu oferty ASARI.";

          console.error("[ASARI DEBUG] Błąd zapisu oferty:", offer.externalId, message, error);

          await logSync(integration.id, {
            externalId: offer.externalId,
            action: "ERROR",
            status: "ERROR",
            message,
            payload: offer.payload,
          });
        }
      }
    }

    for (const externalId of deletedExternalIds) {
      try {
        const deactivated = await deactivateExternalId(integration.id, externalId);
        if (deactivated) deactivatedCount += 1;
      } catch (error) {
        errorCount += 1;
        await logSync(integration.id, {
          externalId,
          action: "ERROR",
          status: "ERROR",
          message: error instanceof Error ? error.message : "Błąd podczas usuwania oferty ASARI.",
        });
      }
    }

    if (integration.fullImportMode && downloaded.cfg.emptyOffers && seenExternalIds.size > 0) {
      deactivatedCount += await deactivateMissingOffers(integration.id, seenExternalIds);
    } else {
      console.log("[ASARI DEBUG] Nie kończę brakujących ofert po samym braku w pliku. Używam DELETE albo empty_offers=1.");
    }

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: {
        lastUsedAt: now,
        lastSyncAt: now,
        lastSuccessAt: now,
        lastErrorAt: errorCount > 0 ? now : null,
        lastErrorMessage:
          errorCount > 0
            ? `Synchronizacja ASARI zakończona z błędami (${errorCount}).`
            : skippedCount > 0
              ? `Synchronizacja ASARI zakończona. Pominięto ${skippedCount} ofert z powodu braku kredytów.`
              : null,
        lastImportedOffers: importedOffers,
        lastCreatedCount: createdCount,
        lastUpdatedCount: updatedCount,
        lastDeactivatedCount: deactivatedCount,
        lastSkippedCount: skippedCount,
        lastErrorCount: errorCount,
      },
    });

    return {
      success: true,
      remoteFileName: downloaded.remoteFileName,
      importedOffers,
      createdCount,
      updatedCount,
      deactivatedCount,
      skippedCount,
      errorCount,
      message:
        errorCount > 0
          ? "Synchronizacja ASARI zakończona z częściowymi błędami."
          : downloaded.offerXmlFiles.length === 0
            ? "ASARI FTP działa, ale nie znaleziono jeszcze plików ofert XML."
            : "Synchronizacja ASARI zakończona poprawnie.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się zsynchronizować integracji ASARI.";

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: {
        lastUsedAt: now,
        lastSyncAt: now,
        lastErrorAt: now,
        lastErrorMessage: message,
      },
    });

    await logSync(integration.id, {
      action: "ERROR",
      status: "ERROR",
      message,
    });

    throw error;
  } finally {
    if (downloaded) await downloaded.cleanup().catch(() => {});
  }
}