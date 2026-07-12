import crypto from "crypto";
import path from "path";
import os from "os";
import fs from "fs";
import { promises as fsp } from "fs";
import * as ftp from "basic-ftp";
import unzipper from "unzipper";
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
import { sanitizePlCoords } from "@/lib/geo";

type IntegrationForSync = {
  id: string;
  userId: string;
  name: string;
  provider: string;
  isActive: boolean;
  transportType?: string;
  feedFormat?: string;
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

type EstiDefinitions = {
  byDictionary: Map<string, Map<string, string>>;
};

type EstiOffer = {
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

type DownloadedEstiFeed = {
  remoteFileName: string;
  tempDir: string;
  offerXmlFiles: string[];
  localFileByBasename: Map<string, string>;
  imageRemotePathByBasename: Map<string, string>;
  downloadedPhotoByBasename: Map<string, string>;
  photoFtpClient: ftp.Client | null;
  definitions: EstiDefinitions;
  exportMode: string | null;
  cleanup: () => Promise<void>;
};

function arrify<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function safeBasename(value: string) {
  return path.basename(value.replace(/\\/g, "/")).toLowerCase();
}

function toTextValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();

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

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = toTextValue(value).replace(/\s+/g, "").replace(",", ".");
  if (!text) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: unknown): Date | null {
  const text = toTextValue(value);
  if (!text) return null;

  const normalized = text.includes(" ") ? text.replace(" ", "T") : text;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function normalizePhone(value: string) {
  return value.trim() || "000000000";
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hasAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
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

function makeEditToken() {
  return crypto.randomBytes(24).toString("hex");
}

function emptyDefinitions(): EstiDefinitions {
  return { byDictionary: new Map<string, Map<string, string>>() };
}

function parseDefinitionsXml(xml: string): EstiDefinitions {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = (doc.definitions ?? doc.DEFINITIONS ?? doc) as Record<string, unknown>;
  const definitions = emptyDefinitions();

  for (const [dictionaryName, dictionaryNode] of Object.entries(root)) {
    if (!dictionaryNode || typeof dictionaryNode !== "object") continue;

    const values = new Map<string, string>();
    const node = dictionaryNode as Record<string, unknown>;

    for (const [tagName, rawItems] of Object.entries(node)) {
      const items = tagName === dictionaryName ? arrify(rawItems) : arrify(rawItems);

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;
        const key = toTextValue(obj.key ?? obj["@_key"]);
        const value = toTextValue(obj["#text"] ?? obj.text ?? item);
        if (key && value) values.set(key, value);
      }
    }

    if (values.size > 0) definitions.byDictionary.set(dictionaryName, values);
  }

  console.log("[ESTICRM DEBUG] Wczytano słowniki:", [...definitions.byDictionary.entries()].map(([name, values]) => `${name}:${values.size}`));
  return definitions;
}

function dictionaryValue(definitions: EstiDefinitions, dictionaryName: string | null, key: unknown) {
  const keyText = toTextValue(key);
  if (!dictionaryName || !keyText) return "";
  return definitions.byDictionary.get(dictionaryName)?.get(keyText) ?? "";
}

function nodeDictionaryName(node: unknown) {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  return toTextValue(obj.dictionary ?? obj["@_dictionary"]) || null;
}

function nodeTextOrDictionary(node: unknown, definitions: EstiDefinitions) {
  const text = toTextValue(node);
  const dictionaryName = nodeDictionaryName(node);
  const dictValue = dictionaryValue(definitions, dictionaryName, text);
  return dictValue || text;
}

function mapPlotTypeToPrzeznaczenia(...values: Array<string | null | undefined>): Przeznaczenie[] {
  const text = normalizeText(values.filter(Boolean).join(" "));
  const result = new Set<Przeznaczenie>();

  if (hasAny(text, ["budowl", "mieszkani", "jednorodzin", "wielorodzin", "blizniac"])) result.add("BUDOWLANA");
  if (hasAny(text, ["roln", "grunt orny", "gospodarstwo"])) result.add("ROLNA");
  if (hasAny(text, ["lesn", "las"])) result.add("LESNA");
  if (hasAny(text, ["rekre", "letnisk"])) result.add("REKREACYJNA");
  if (hasAny(text, ["siedlisk"])) result.add("SIEDLISKOWA");
  if (hasAny(text, ["inwest", "uslug", "komerc", "przemys", "produkcyj", "magazyn", "rzemiesln"])) result.add("INWESTYCYJNA");

  if (result.size === 0) result.add("BUDOWLANA");
  return [...result];
}

function sanitizeTitle(raw: string | null, city: string | null, plotType: string | null) {
  const value = (raw ?? "").trim();
  if (value.length >= 5) return value.slice(0, 160);

  const cityPart = city ? ` – ${city}` : "";
  const typePart = plotType ? plotType : "działka";
  return `Działka ${typePart}${cityPart}`.slice(0, 160);
}

function buildWymiary(width: number | null, length: number | null): string | null {
  if (width && length) return `${width} x ${length} m`;
  if (width) return `${width} m szerokości`;
  if (length) return `${length} m długości`;
  return null;
}

function mapPrad(raw: unknown): PradStatus {
  const text = normalizeText(nodeText(raw));
  if (hasAny(text, ["1", "tak", "prad", "prąd", "energia", "elektry"])) return "MOZLIWOSC_PRZYLACZENIA";
  return "BRAK_PRZYLACZA";
}

function mapWoda(raw: unknown): WodaStatus {
  const text = normalizeText(nodeText(raw));
  if (hasAny(text, ["1", "tak", "woda", "wodociag", "wodociąg"])) return "MOZLIWOSC_PODLACZENIA";
  return "BRAK_PRZYLACZA";
}

function mapGaz(raw: unknown): GazStatus {
  const text = normalizeText(nodeText(raw));
  if (hasAny(text, ["1", "tak", "gaz"])) return "MOZLIWOSC_PODLACZENIA";
  return "BRAK";
}

function mapKanalizacja(sewerageRaw: unknown, cesspoolRaw: unknown): KanalizacjaStatus {
  const sewerage = normalizeText(nodeText(sewerageRaw));
  const cesspool = normalizeText(nodeText(cesspoolRaw));
  if (hasAny(sewerage, ["1", "tak", "kanalizacja"])) return "MOZLIWOSC_PODLACZENIA";
  if (hasAny(cesspool, ["1", "tak", "szambo"])) return "SZAMBO";
  return "BRAK";
}

function nodeText(value: unknown) {
  return toTextValue(value);
}

function parsePictures(picturesNode: unknown): string[] {
  const node = picturesNode as Record<string, unknown> | undefined;

  return arrify(node?.picture)
    .map((picture) => safeBasename(toTextValue(picture)))
    .filter(Boolean);
}

function isDeleteAction(rawOffer: Record<string, unknown>) {
  const action = normalizeText(toTextValue(rawOffer.action));
  return ["delete", "deleted", "remove", "removed", "deactivate", "deactivated", "usun", "usuń"].some((value) => action.includes(value));
}

function isLandOffer(rawOffer: Record<string, unknown>, definitions: EstiDefinitions) {
  const mainTypeText = toTextValue(rawOffer.mainTypeId);
  const mainTypeLabel = nodeTextOrDictionary(rawOffer.mainTypeId, definitions);
  const typeName = toTextValue(rawOffer.typeName);
  const groundType = nodeTextOrDictionary(rawOffer.groundType, definitions);

  // mainTypeId to autorytatywny typ główny oferty w EstiCRM (słownik "types"):
  // 1=Dom, 2=Mieszkanie, 3=Działka, 4=Inny komercyjny, 5=Obiekt, 65=Domy, 66=Komercyjne.
  // Kiedy jest podany, decyduje on i tylko on. Działka = "3" (albo etykieta mówiąca "działka").
  //
  // KLUCZOWE: domy/mieszkania też mają wypełnione groundType, bo to przeznaczenie GRUNTU pod
  // budynkiem (Budowlana/Rolna/Usługowo-mieszkaniowa). Dlatego groundType NIE może być sygnałem
  // „to działka”, gdy mainTypeId jednoznacznie mówi, że to dom. Wcześniej regex po groundType
  // przepuszczał domy stojące na działce budowlanej/rolnej i wciągał je na stronę.
  if (mainTypeText) {
    return mainTypeText === "3" || normalizeText(mainTypeLabel).includes("dzial");
  }

  // Fallback tylko dla feedów BEZ mainTypeId — dopiero wtedy zgadujemy typ z etykiet/groundType.
  return (
    normalizeText(mainTypeLabel).includes("dzial") ||
    normalizeText(typeName).includes("dzial") ||
    Boolean(groundType && normalizeText(groundType).match(/budowl|roln|lesn|rekre|inwest|siedlisk|mieszkani|uslug|przemys/))
  );
}

function parseEstiOffer(
  rawOffer: Record<string, unknown>,
  agencyName: string | null,
  definitions: EstiDefinitions
): EstiOffer | null {
  const externalId = toTextValue(rawOffer.id);

  if (!externalId) {
    console.log("[ESTICRM DEBUG] Odrzucono ofertę: brak id.");
    return null;
  }

  if (isDeleteAction(rawOffer)) return null;

  if (!isLandOffer(rawOffer, definitions)) {
    console.log("[ESTICRM DEBUG] Odrzucono:", externalId, "to nie jest działka.");
    return null;
  }

  const transaction = toTextValue(rawOffer.transaction);
  const transactionLabel = nodeTextOrDictionary(rawOffer.transaction, definitions);

  if (transaction && transaction !== "131" && !normalizeText(transactionLabel).includes("sprzed")) {
    console.log("[ESTICRM DEBUG] Odrzucono:", externalId, "transakcja nie jest sprzedażą.", transactionLabel || transaction);
    return null;
  }

  const price = toNumber(rawOffer.price);
  const area = toNumber(rawOffer.areaPlot) ?? toNumber(rawOffer.areaTotal) ?? toNumber(rawOffer.areaUsable);

  if (!price || price <= 0) {
    console.log("[ESTICRM DEBUG] Odrzucono:", externalId, "brak ceny.");
    return null;
  }

  if (!area || area < 1) {
    console.log("[ESTICRM DEBUG] Odrzucono:", externalId, "brak powierzchni działki/powierzchni całkowitej.");
    return null;
  }

  const city =
    toTextValue(rawOffer.locationExportCityName) ||
    toTextValue(rawOffer.locationCityName) ||
    toTextValue(rawOffer.locationCityForeign) ||
    null;
  const precinct = toTextValue(rawOffer.locationExportPrecinctName) || toTextValue(rawOffer.locationPrecinctName) || null;
  const commune = toTextValue(rawOffer.locationExportCommuneName) || toTextValue(rawOffer.locationCommuneName) || null;
  const district = toTextValue(rawOffer.locationExportDistrictName) || toTextValue(rawOffer.locationDistrictName) || null;
  const province = toTextValue(rawOffer.locationExportProvinceName) || toTextValue(rawOffer.locationProvinceName) || null;
  const place = toTextValue(rawOffer.locationExportPlaceName) || toTextValue(rawOffer.locationPlaceName) || null;
  const street = toTextValue(rawOffer.locationExportStreetName) || toTextValue(rawOffer.locationStreetName) || null;
  const streetType = toTextValue(rawOffer.locationExportStreetType) || toTextValue(rawOffer.locationStreetType) || null;

  if (!city && !commune && !district && !province && !place) {
    console.log("[ESTICRM DEBUG] Odrzucono:", externalId, "brak lokalizacji.");
    return null;
  }

  const rawLat = toNumber(rawOffer.locationLatitude);
  const rawLng = toNumber(rawOffer.locationLongitude);
  // Bramka jakości: na mapę trafiają tylko współrzędne w granicach Polski.
  const plCoords = sanitizePlCoords(rawLat, rawLng);
  const lat = plCoords?.lat ?? null;
  const lng = plCoords?.lng ?? null;

  const plotTypeRaw =
    nodeTextOrDictionary(rawOffer.groundType, definitions) ||
    nodeTextOrDictionary(rawOffer.mainTypeId, definitions) ||
    toTextValue(rawOffer.typeName) ||
    null;

  const groundRoad = nodeTextOrDictionary(rawOffer.groundRoad, definitions) || null;
  const groundFencing = nodeTextOrDictionary(rawOffer.groundFencing, definitions) || null;
  const groundOwnership = nodeTextOrDictionary(rawOffer.groundOwnership, definitions) || null;
  const tagList = toTextValue(rawOffer.tagList) || null;

  const descriptionRaw =
    toTextValue(rawOffer.descriptionWebsite) ||
    toTextValue(rawOffer.description) ||
    toTextValue(rawOffer.descriptionAdditional) ||
    null;

  const extraDescriptionParts = [
    groundRoad ? `Droga dojazdowa: ${groundRoad}` : null,
    groundFencing ? `Ogrodzenie: ${groundFencing}` : null,
    groundOwnership ? `Prawo do gruntu: ${groundOwnership}` : null,
    tagList ? `Cechy: ${tagList}` : null,
  ].filter(Boolean);

  // Opis zapisujemy SUROWO (jak w ASARI/domy.pl) — bezpieczne czyszczenie i formatowanie
  // robi formatOpis na renderze. Wcześniejsze stripHtml spłaszczało akapity do jednej linii
  // i gubiło pogrubienia/kursywę, przez co oferty EstiCRM wyglądały jak ściana tekstu.
  const description = [descriptionRaw, ...extraDescriptionParts]
    .filter(Boolean)
    .join("\n\n") || null;

  const locationLabel = [city || place, precinct].filter(Boolean).join(", ") || city || commune || district || province || place;
  const streetFull = [streetType, street].filter(Boolean).join(" ").trim() || null;
  const locationFull = [streetFull, city || place, precinct, commune, district, province]
    .filter((item) => item && normalizeText(item) !== normalizeText(locationLabel))
    .join(", ") || locationLabel;

  const opiekun = [toTextValue(rawOffer.contactFirstname), toTextValue(rawOffer.contactLastname)].filter(Boolean).join(" ") || null;

  const width = toNumber(rawOffer.groundPlotwidth);
  const length = toNumber(rawOffer.groundPlotheight);

  const title = sanitizeTitle(
    toTextValue(rawOffer.portalTitle) || toTextValue(rawOffer.portalWwwTitle) || null,
    city || commune || district || province || "działka",
    plotTypeRaw
  );

  const photoFileNames = parsePictures(rawOffer.pictures);

  const prad = mapPrad(rawOffer.mediaCurrent);
  const woda = mapWoda(rawOffer.mediaWater);
  const gaz = mapGaz(rawOffer.mediaGas);
  const kanalizacja = mapKanalizacja(rawOffer.mediaSewerage, rawOffer.mediaCesspool);

  return {
    externalId,
    externalUpdatedAt: parseDate(rawOffer.updateDate) ?? parseDate(rawOffer.exportDate) ?? parseDate(rawOffer.activateDate),
    title,
    description,
    pricePln: Math.round(price),
    areaM2: Math.round(area),
    email: normalizeEmail(toTextValue(rawOffer.contactEmail)) || "kontakt@tylkodzialki.pl",
    phone: normalizePhone(toTextValue(rawOffer.contactPhone)),
    locationLabel,
    locationFull,
    lat,
    lng,
    mapsUrl: buildMapsUrl(lat, lng),
    plotTypeRaw,
    przeznaczenia: mapPlotTypeToPrzeznaczenia(plotTypeRaw, tagList, groundRoad),
    photoFileNames,
    biuroNazwa: toTextValue(rawOffer.companyName) || agencyName,
    biuroOpiekun: opiekun,
    prad,
    woda,
    kanalizacja,
    gaz,
    wymiary: buildWymiary(width, length),
    payload: toInputJsonValue({
      externalId,
      action: toTextValue(rawOffer.action),
      mainTypeId: toTextValue(rawOffer.mainTypeId),
      mainTypeLabel: nodeTextOrDictionary(rawOffer.mainTypeId, definitions),
      transaction,
      transactionLabel,
      number: toTextValue(rawOffer.number),
      numberExport: toTextValue(rawOffer.numberExport),
      plotTypeRaw,
      groundRoad,
      groundFencing,
      groundOwnership,
      location: { city, precinct, commune, district, province, place, street: streetFull, lat, lng },
      mappedMedia: { prad, woda, kanalizacja, gaz },
      photoFileNames,
      rawOffer,
    }),
  };
}

function parseOfferXmlFile(xml: string, agencyName: string | null, definitions: EstiDefinitions) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = (doc.offers ?? doc.OFFERS ?? doc) as Record<string, unknown>;
  const exportMode = toTextValue(root.export ?? root["@_export"]) || null;

  const deletedExternalIds: string[] = [];
  const offers: EstiOffer[] = [];
  let rawCount = 0;

  for (const offerNode of arrify(root.offer)) {
    if (!offerNode || typeof offerNode !== "object") continue;
    rawCount += 1;

    const rawOffer = offerNode as Record<string, unknown>;
    const externalId = toTextValue(rawOffer.id);

    if (externalId && isDeleteAction(rawOffer)) {
      deletedExternalIds.push(externalId);
      continue;
    }

    const parsed = parseEstiOffer(rawOffer, agencyName, definitions);
    if (parsed) offers.push(parsed);
  }

  return { offers, deletedExternalIds, exportMode, rawCount };
}

async function downloadFile(client: ftp.Client, remotePath: string, localPath: string) {
  await fsp.mkdir(path.dirname(localPath), { recursive: true });
  await client.downloadTo(localPath, remotePath);
}

async function listCurrentAndOneLevel(client: ftp.Client, remoteDir: string) {
  const current = await client.list();

  const result: Array<{ name: string; remotePath: string; isFile: boolean; isDirectory: boolean; size: number; modifiedAt?: Date }> = current.map((item) => ({
    name: item.name,
    remotePath: item.name,
    isFile: item.isFile,
    isDirectory: item.isDirectory,
    size: item.size,
    modifiedAt: item.modifiedAt,
  }));

  for (const item of current) {
    if (!item.isDirectory) continue;

    try {
      await client.cd(item.name);
      const nested = await client.list();

      for (const nestedItem of nested) {
        result.push({
          name: nestedItem.name,
          remotePath: `${item.name}/${nestedItem.name}`,
          isFile: nestedItem.isFile,
          isDirectory: nestedItem.isDirectory,
          size: nestedItem.size,
          modifiedAt: nestedItem.modifiedAt,
        });
      }

      await client.cd("..");
    } catch (error) {
      console.warn("[ESTICRM DEBUG] Nie udało się wejść do podkatalogu:", item.name, error);
      await client.cd(remoteDir).catch(() => {});
    }
  }

  return result;
}

async function extractZip(localZipPath: string, outputDir: string) {
  await fsp.mkdir(outputDir, { recursive: true });
  await fs.createReadStream(localZipPath).pipe(unzipper.Extract({ path: outputDir })).promise();
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(fullPath)));
    else files.push(fullPath);
  }

  return files;
}

async function downloadEstiFeedFromFtp(integration: IntegrationForSync): Promise<DownloadedEstiFeed> {
  if (!integration.ftpHost || !integration.ftpUsername || !integration.ftpPassword) {
    throw new Error("Integracja EstiCRM nie ma uzupełnionych danych FTP.");
  }

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "td-esticrm-"));
  const localFileByBasename = new Map<string, string>();
  const imageRemotePathByBasename = new Map<string, string>();
  const downloadedPhotoByBasename = new Map<string, string>();
  let photoFtpClient: ftp.Client | null = null;
  let definitions = emptyDefinitions();
  let remoteFileName = "ESTICRM_FILES";

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

    console.log("[ESTICRM DEBUG] FTP katalog:", remoteDir);

    const list = await listCurrentAndOneLevel(client, remoteDir);
    const files = list.filter((item) => item.isFile);

    console.log("[ESTICRM DEBUG] Pliki na FTP:", files.map((item) => ({ name: item.name, remotePath: item.remotePath, size: item.size, modifiedAt: item.modifiedAt })));

    const zipFiles = files
      .filter((item) => item.name.toLowerCase().endsWith(".zip"))
      .sort((a, b) => (b.modifiedAt?.getTime() ?? 0) - (a.modifiedAt?.getTime() ?? 0));

    const extractedRoot = path.join(tempDir, "extracted");

    // Do auto-czyszczenia: zapamiętujemy datę najnowszego PEŁNEGO eksportu. Silnik i tak czyta
    // tylko najnowszy pełny + przyrostowe nowsze od niego, więc ZIP-y starsze niż pełny nigdy
    // już nie są potrzebne. 0 = nie znaleziono potwierdzonego pełnego (wtedy nic nie kasujemy).
    let newestFullZipModifiedMs = 0;

    // Wybór plików (naprawa P-F): bierzemy najnowszy PEŁNY eksport (export="full")
    // oraz wszystkie przyrostowe NOWSZE od niego. Idziemy od najnowszego pliku i
    // zatrzymujemy się na pierwszym pełnym eksporcie. Wcześniej brany był tylko
    // najnowszy ZIP, więc świeży przyrostowy zasłaniał pełny eksport (biuro dawało
    // o 14:00 całość, o 16:00 zmiany i całość nigdy nie była czytana).
    //
    // Bezpieczeństwo: dla biur publikujących tylko pełne eksporty najnowszy plik jest
    // pełny, więc pętla kończy się na pierwszym (idx 0), zachowanie identyczne jak dotąd.
    // Tryb nieznany (brak atrybutu export) też zatrzymuje pętlę konserwatywnie, żeby
    // nie wciągać starych plików.
    for (let idx = 0; idx < zipFiles.length; idx++) {
      const zip = zipFiles[idx];
      if (idx === 0) remoteFileName = zip.name;

      const zipLocalPath = path.join(tempDir, zip.remotePath);
      await downloadFile(client, zip.remotePath, zipLocalPath);

      const zipExtractDir = path.join(extractedRoot, String(idx));
      await extractZip(zipLocalPath, zipExtractDir);

      let zipExportMode: string | null = null;
      for (const file of await walkFiles(zipExtractDir)) {
        const base = safeBasename(file);
        // Najnowszy wygrywa: starszy plik nie nadpisuje nowszego o tej samej nazwie.
        if (!localFileByBasename.has(base)) localFileByBasename.set(base, file);

        if (
          zipExportMode === null &&
          base.toLowerCase().endsWith(".xml") &&
          base.toLowerCase() !== "definitions.xml"
        ) {
          const head = (await fsp.readFile(file, "utf8")).slice(0, 4096);
          const match = head.match(/<offers[^>]*\bexport\s*=\s*["']?\s*([a-zA-Z]+)/);
          zipExportMode = match ? match[1].toLowerCase() : "";
        }
      }

      const isFullZip = !!zipExportMode && /full|complete|calosc/.test(zipExportMode);
      const isKnownIncremental = !!zipExportMode && !isFullZip;

      console.log(
        "[ESTICRM DEBUG] Plik ZIP:",
        zip.name,
        "| export:",
        zipExportMode || "(nieznany)",
        "|",
        isFullZip
          ? "PEŁNY, kończę wybór"
          : isKnownIncremental
            ? "przyrostowy, szukam pełnego"
            : "nieznany, kończę wybór"
      );

      // Pierwszy napotkany pełny (idziemy od najnowszego) = najnowszy pełny eksport.
      if (isFullZip && zip.modifiedAt) {
        newestFullZipModifiedMs = zip.modifiedAt.getTime();
      }

      // Stop na pełnym eksporcie albo na nierozpoznanym trybie. Przyrostowe (nowsze
      // od pełnego) zbieramy po drodze i lecimy dalej, aż trafimy na pełny.
      if (isFullZip || !isKnownIncremental) break;
    }

    const directXmlFiles = files.filter((item) => item.name.toLowerCase().endsWith(".xml"));
    const directImageFiles = files.filter((item) => /\.(jpe?g|png|webp|avif)$/i.test(item.name));

    for (const file of directXmlFiles) {
      const localPath = path.join(tempDir, "direct", file.remotePath);
      await downloadFile(client, file.remotePath, localPath);
      localFileByBasename.set(safeBasename(file.name), localPath);
    }

    for (const file of directImageFiles) {
      imageRemotePathByBasename.set(safeBasename(file.name), file.remotePath);
    }

    const allLocalFiles = [...localFileByBasename.values()];

    for (const file of allLocalFiles) {
      if (/\.(jpe?g|png|webp|avif)$/i.test(file)) {
        localFileByBasename.set(safeBasename(file), file);
      }
    }

    const definitionLocalPath = [...localFileByBasename.entries()].find(([basename]) => basename === "definitions.xml")?.[1];

    if (definitionLocalPath) {
      const definitionsXml = await fsp.readFile(definitionLocalPath, "utf8");
      definitions = parseDefinitionsXml(definitionsXml);
    } else {
      console.log("[ESTICRM DEBUG] Brak definitions.xml. Parser użyje surowych wartości pól.");
    }

    const offerXmlFiles = [...localFileByBasename.entries()]
      .filter(([basename]) => basename.endsWith(".xml") && basename !== "definitions.xml")
      .map(([, localPath]) => localPath)
      .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

    if (!zipFiles[0] && offerXmlFiles[0]) {
      remoteFileName = path.basename(offerXmlFiles[0]);
    }

    console.log("[ESTICRM DEBUG] Pobrane pliki XML ofert:", offerXmlFiles.map((file) => path.basename(file)));
    console.log("[ESTICRM DEBUG] Zdjęcia lokalne:", [...localFileByBasename.keys()].filter((name) => /\.(jpe?g|png|webp|avif)$/i.test(name)).length);
    console.log("[ESTICRM DEBUG] Zdjęcia na FTP do pobrania na żądanie:", imageRemotePathByBasename.size);

    // Auto-czyszczenie drop-zone EstiCRM. Silnik czyta najnowszy pełny eksport + przyrostowe
    // nowsze od niego; wszystko STARSZE od najnowszego pełnego nigdy już nie jest czytane, więc
    // to bezpieczny balast (bywają pliki po 440 MB). Kasujemy WYŁĄCZNIE stare .zip starsze niż
    // najnowszy pełny (z marginesem czasu i buforem najświeższych). NIGDY nie ruszamy luźnych
    // zdjęć, definitions.xml ani plików XML. Jeśli nie potwierdzono pełnego eksportu — zero kasowań.
    if (newestFullZipModifiedMs > 0) {
      const retentionDays = Number(process.env.CRM_FEED_RETENTION_DAYS ?? "14");
      const keepMinFiles = Number(process.env.CRM_FEED_KEEP_MIN ?? "10");
      const ageCutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

      // zipFiles jest posortowane malejąco po czasie (najnowsze na początku).
      const protectedNewest = new Set(
        zipFiles.slice(0, Math.max(0, keepMinFiles)).map((z) => z.remotePath)
      );

      const prunableZips = zipFiles.filter((z) => {
        if (!z.modifiedAt) return false;
        if (protectedNewest.has(z.remotePath)) return false;
        if (z.modifiedAt.getTime() >= newestFullZipModifiedMs) return false; // pełny lub coś po nim
        if (z.modifiedAt.getTime() >= ageCutoffMs) return false; // margines czasowy
        return true;
      });

      let prunedCount = 0;
      for (const z of prunableZips) {
        try {
          await client.remove(z.remotePath);
          prunedCount += 1;
        } catch (error) {
          console.error("[ESTICRM CLEANUP] Nie udało się usunąć starego ZIP:", z.remotePath, error);
        }
      }

      if (prunedCount > 0) {
        console.log(
          `[ESTICRM CLEANUP] Usunięto ${prunedCount} ZIP-ów starszych niż najnowszy pełny eksport (${new Date(newestFullZipModifiedMs).toISOString()}) z ${remoteDir}.`
        );
      }
    }

    const feed: DownloadedEstiFeed = {
      remoteFileName,
      tempDir,
      offerXmlFiles,
      localFileByBasename,
      imageRemotePathByBasename,
      downloadedPhotoByBasename,
      photoFtpClient,
      definitions,
      exportMode: null,
      cleanup: async () => {
        feed.photoFtpClient?.close();
        await fsp.rm(tempDir, { recursive: true, force: true });
      },
    };

    return feed;
  } catch (error) {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally {
    client.close();
  }
}

async function getEstiPhotoLocalPath(integration: IntegrationForSync, downloaded: DownloadedEstiFeed, originalName: string) {
  const basename = safeBasename(originalName);

  const local = downloaded.localFileByBasename.get(basename);
  if (local) return local;

  const alreadyDownloaded = downloaded.downloadedPhotoByBasename.get(basename);
  if (alreadyDownloaded) return alreadyDownloaded;

  const remotePath = downloaded.imageRemotePathByBasename.get(basename);
  if (!remotePath) {
    console.log("[ESTICRM DEBUG] Brak pliku zdjęcia:", originalName);
    return null;
  }

  if (!integration.ftpHost || !integration.ftpUsername || !integration.ftpPassword) {
    throw new Error("Integracja EstiCRM nie ma uzupełnionych danych FTP do pobrania zdjęć.");
  }

  if (!downloaded.photoFtpClient) {
    const client = new ftp.Client(30000);
    client.ftp.verbose = false;

    await client.access({
      host: integration.ftpHost,
      port: integration.ftpPort ?? 21,
      user: integration.ftpUsername,
      password: integration.ftpPassword,
      secure: false,
    });

    const remoteDir = integration.ftpRemotePath?.trim() || "/";
    await client.cd(remoteDir);
    downloaded.photoFtpClient = client;
  }

  const localPath = path.join(downloaded.tempDir, "photos", remotePath);
  await downloadFile(downloaded.photoFtpClient, remotePath, localPath);

  downloaded.downloadedPhotoByBasename.set(basename, localPath);
  downloaded.localFileByBasename.set(basename, localPath);

  return localPath;
}

async function uploadOfferPhotosToR2(integration: IntegrationForSync, downloaded: DownloadedEstiFeed, externalId: string, photoFileNames: string[]) {
  const uploaded: Array<{ url: string; publicId: string; kolejnosc: number }> = [];

  for (let index = 0; index < photoFileNames.length; index += 1) {
    const originalName = photoFileNames[index];
    const localPath = await getEstiPhotoLocalPath(integration, downloaded, originalName);
    if (!localPath) continue;

    const buffer = await fsp.readFile(localPath);
    const upload = await uploadBufferToR2({
      buffer,
      originalFileName: `${integration.id}-${externalId}-${originalName}`,
      mimeType: getMimeTypeFromFileName(originalName),
    });

    uploaded.push({ url: upload.url, publicId: upload.key, kolejnosc: index });
  }

  return uploaded;
}

async function removeExistingR2Photos(dzialkaId: string) {
  const currentPhotos = await prisma.zdjecie.findMany({ where: { dzialkaId }, select: { publicId: true } });

  for (const photo of currentPhotos) {
    if (!photo.publicId) continue;
    try {
      await deleteFromR2(photo.publicId);
    } catch (error) {
      console.error("[ESTICRM DEBUG] Nie udało się usunąć zdjęcia z R2:", photo.publicId, error);
    }
  }
}

function buildDzialkaDataFromOffer(offer: EstiOffer) {
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
  offer: EstiOffer,
  downloaded: DownloadedEstiFeed,
  paymentsEnabled: boolean
): Promise<"CREATE" | "UPDATE" | "REACTIVATE" | "SKIP_NO_CREDITS"> {
  const now = new Date();
  const expiresAt = null;

  const existingLink = await prisma.crmOfferLink.findUnique({
    where: { integrationId_externalId: { integrationId: integration.id, externalId: offer.externalId } },
    include: { dzialka: true },
  });

  if (!existingLink) {
    const user = await prisma.user.findUnique({ where: { id: integration.userId }, select: { id: true, listingCredits: true } });
    if (!user) throw new Error("Nie znaleziono użytkownika integracji EstiCRM.");

    if (paymentsEnabled && user.listingCredits <= 0) {
      await logSync(integration.id, {
        externalId: offer.externalId,
        action: "SKIP_NO_CREDITS",
        status: "ERROR",
        message: "Brak dostępnych publikacji do utworzenia oferty EstiCRM.",
        payload: offer.payload,
      });
      return "SKIP_NO_CREDITS";
    }

    const uploadedPhotos = await uploadOfferPhotosToR2(integration, downloaded, offer.externalId, offer.photoFileNames);

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
          zdjecia: { create: uploadedPhotos },
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
          data: { listingCredits: { decrement: 1 } },
          select: { listingCredits: true },
        });

        await tx.listingCreditTransaction.create({
          data: {
            userId: integration.userId,
            delta: -1,
            balanceAfter: updatedUser.listingCredits,
            sourceType: "CRM_PUBLICATION",
            note: `EstiCRM publikacja oferty ${offer.externalId}`,
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
          message: "Oferta utworzona poprawnie z importu EstiCRM.",
          payload: offer.payload,
        },
      });
    });

    return "CREATE";
  }

  const wasEnded = existingLink.dzialka.status === "ZAKONCZONE";

  if (wasEnded) {
    const user = await prisma.user.findUnique({ where: { id: integration.userId }, select: { id: true, listingCredits: true } });
    if (!user) throw new Error("Nie znaleziono użytkownika integracji EstiCRM.");

    if (paymentsEnabled && user.listingCredits <= 0) {
      await logSync(integration.id, {
        dzialkaId: existingLink.dzialkaId,
        offerLinkId: existingLink.id,
        externalId: offer.externalId,
        action: "SKIP_NO_CREDITS",
        status: "ERROR",
        message: "Brak dostępnych publikacji do reaktywacji oferty EstiCRM.",
        payload: offer.payload,
      });
      return "SKIP_NO_CREDITS";
    }
  }

  await removeExistingR2Photos(existingLink.dzialkaId);
  const uploadedPhotos = await uploadOfferPhotosToR2(integration, downloaded, offer.externalId, offer.photoFileNames);

  await prisma.$transaction(async (tx) => {
    await tx.zdjecie.deleteMany({ where: { dzialkaId: existingLink.dzialkaId } });

    const dzialka = await tx.dzialka.update({
      where: { id: existingLink.dzialkaId },
      data: {
        ...buildDzialkaDataFromOffer(offer),
        ...(wasEnded ? { publishedAt: now, expiresAt, endedAt: null, status: "AKTYWNE" as const } : {}),
        zdjecia: { create: uploadedPhotos },
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
        data: { listingCredits: { decrement: 1 } },
        select: { listingCredits: true },
      });

      await tx.listingCreditTransaction.create({
        data: {
          userId: integration.userId,
          delta: -1,
          balanceAfter: updatedUser.listingCredits,
          sourceType: "CRM_PUBLICATION",
          note: `EstiCRM reaktywacja oferty ${offer.externalId}`,
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
        message: wasEnded ? "Oferta reaktywowana poprawnie z importu EstiCRM." : "Oferta zaktualizowana poprawnie z importu EstiCRM.",
        payload: offer.payload,
      },
    });
  });

  return wasEnded ? "REACTIVATE" : "UPDATE";
}

async function deactivateExternalId(integrationId: string, externalId: string, reason = "Oferta zakończona na podstawie akcji DELETE z EstiCRM.") {
  const now = new Date();

  const link = await prisma.crmOfferLink.findUnique({
    where: { integrationId_externalId: { integrationId, externalId } },
    include: { dzialka: true },
  });

  if (!link) {
    await logSync(integrationId, { externalId, action: "DELETE", status: "SUCCESS", message: "EstiCRM zgłosiło usunięcie oferty, ale nie znaleziono jej w bazie." });
    return false;
  }

  await prisma.$transaction(async (tx) => {
    if (link.dzialka.status !== "ZAKONCZONE") {
      await tx.dzialka.update({ where: { id: link.dzialkaId }, data: { status: "ZAKONCZONE", endedAt: now, crmLastSyncedAt: now } });
    }

    await tx.crmOfferLink.update({
      where: { id: link.id },
      data: { lastImportedAt: now, lastSeenAt: now, lastDeactivatedAt: now, isActiveInSource: false },
    });

    await tx.crmSyncLog.create({
      data: { integrationId, dzialkaId: link.dzialkaId, offerLinkId: link.id, externalId, action: "DELETE", status: "SUCCESS", message: reason },
    });
  });

  return true;
}

async function deactivateMissingOffers(integrationId: string, seenExternalIds: Set<string>) {
  const now = new Date();

  const linksToDeactivate = await prisma.crmOfferLink.findMany({
    where: { integrationId, isActiveInSource: true, externalId: { notIn: [...seenExternalIds] } },
    include: { dzialka: true },
  });

  let count = 0;

  for (const link of linksToDeactivate) {
    await prisma.$transaction(async (tx) => {
      if (link.dzialka.status !== "ZAKONCZONE") {
        await tx.dzialka.update({ where: { id: link.dzialkaId }, data: { status: "ZAKONCZONE", endedAt: now, crmLastSyncedAt: now } });
      }

      await tx.crmOfferLink.update({
        where: { id: link.id },
        data: { lastImportedAt: now, lastSeenAt: now, lastDeactivatedAt: now, isActiveInSource: false },
      });

      await tx.crmSyncLog.create({
        data: {
          integrationId,
          dzialkaId: link.dzialkaId,
          offerLinkId: link.id,
          externalId: link.externalId,
          action: "DEACTIVATE",
          status: "SUCCESS",
          message: "Oferta zakończona, ponieważ nie wystąpiła w pełnym eksporcie EstiCRM.",
        },
      });
    });

    count += 1;
  }

  return count;
}

export async function syncEstiCrmIntegrationNow(integrationId: string): Promise<SyncSummary> {
  console.log("[ESTICRM DEBUG] Start synchronizacji:", integrationId);

  const integration = await prisma.crmIntegration.findUnique({
    where: { id: integrationId },
    select: {
      id: true,
      userId: true,
      name: true,
      provider: true,
      isActive: true,
      transportType: true,
      feedFormat: true,
      ftpHost: true,
      ftpPort: true,
      ftpUsername: true,
      ftpPassword: true,
      ftpRemotePath: true,
      ftpPassive: true,
      fullImportMode: true,
    },
  });

  if (!integration) throw new Error("Nie znaleziono integracji EstiCRM.");
  if (!integration.isActive) throw new Error("Integracja EstiCRM jest wyłączona.");
  if (integration.provider !== "ESTI_CRM" && integration.feedFormat !== "ESTICRM_XML") {
    throw new Error("Ta integracja nie jest EstiCRM / ESTICRM_XML.");
  }

  const now = new Date();
  let downloaded: DownloadedEstiFeed | null = null;

  try {
    downloaded = await downloadEstiFeedFromFtp(integration);

    const appConfig = await prisma.appConfig.findFirst();
    const paymentsEnabled = appConfig?.paymentsEnabled ?? false;

    let importedOffers = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let deactivatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let rawOffersCount = 0;

    const seenExternalIds = new Set<string>();
    const deletedExternalIds = new Set<string>();
    let exportMode: string | null = null;

    if (downloaded.offerXmlFiles.length === 0) {
      console.log("[ESTICRM DEBUG] Brak plików XML ofert.");
    }

    for (const offerXmlFile of downloaded.offerXmlFiles) {
      const xml = await fsp.readFile(offerXmlFile, "utf8");
      const result = parseOfferXmlFile(xml, integration.name, downloaded.definitions);

      if (result.exportMode) exportMode = result.exportMode;
      rawOffersCount += result.rawCount;

      for (const externalId of result.deletedExternalIds) deletedExternalIds.add(externalId);

      for (const offer of result.offers) {
        importedOffers += 1;
        seenExternalIds.add(offer.externalId);

        try {
          const action = await processOffer(integration, offer, downloaded, paymentsEnabled);

          if (action === "CREATE" || action === "REACTIVATE") createdCount += 1;
          else if (action === "UPDATE") updatedCount += 1;
          else if (action === "SKIP_NO_CREDITS") skippedCount += 1;
        } catch (error) {
          errorCount += 1;
          const message = error instanceof Error ? error.message : "Nieznany błąd podczas importu oferty EstiCRM.";
          console.error("[ESTICRM DEBUG] Błąd zapisu oferty:", offer.externalId, message, error);

          await logSync(integration.id, { externalId: offer.externalId, action: "ERROR", status: "ERROR", message, payload: offer.payload });
        }
      }
    }

    downloaded.exportMode = exportMode;

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
          message: error instanceof Error ? error.message : "Błąd podczas usuwania oferty EstiCRM.",
        });
      }
    }

    const isFullExport = normalizeText(exportMode).includes("full") || normalizeText(exportMode).includes("complete") || normalizeText(exportMode).includes("calosc");

    if (integration.fullImportMode && isFullExport && seenExternalIds.size > 0) {
      deactivatedCount += await deactivateMissingOffers(integration.id, seenExternalIds);
    } else {
      console.log("[ESTICRM DEBUG] Nie kończę brakujących ofert. Dezaktywacja tylko przy DELETE albo pełnym eksporcie.", { exportMode, seen: seenExternalIds.size });
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
            ? `Synchronizacja EstiCRM zakończona z błędami (${errorCount}).`
            : skippedCount > 0
              ? `Synchronizacja EstiCRM zakończona. Pominięto ${skippedCount} ofert z powodu braku kredytów.`
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
          ? "Synchronizacja EstiCRM zakończona z częściowymi błędami."
          : downloaded.offerXmlFiles.length === 0
            ? "EstiCRM FTP działa, ale nie znaleziono plików ofert XML."
            : importedOffers === 0 && rawOffersCount > 0
              ? `EstiCRM działa. Przetworzono ${rawOffersCount} ofert z XML, ale żadna nie była działką na sprzedaż.`
              : "Synchronizacja EstiCRM zakończona poprawnie.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się zsynchronizować integracji EstiCRM.";

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: { lastUsedAt: now, lastSyncAt: now, lastErrorAt: now, lastErrorMessage: message },
    });

    await logSync(integration.id, { action: "ERROR", status: "ERROR", message });

    throw error;
  } finally {
    if (downloaded) await downloaded.cleanup().catch(() => {});
  }
}