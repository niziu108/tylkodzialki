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

// Silnik importu LocumNet Online (format XML "LOCUMNET-ONLINE").
// Mechanika jak esticrm-sync: biuro wrzuca ZIP-y (lno_*.zip) na nasze FTP drop-zone,
// każdy ZIP = XML z ofertami + zdjęcia w środku. Nagłówek <FullExport> mówi, czy to
// eksport pełny (True) czy przyrostowy (False); przyrostowy ma sekcję <removed>
// z idof ofert do zdjęcia. Dokumentacja: https://online.locumnet.pl/dokumentacja/doku.php

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

type LocumnetOffer = {
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
  przeznaczenia: Przeznaczenie[];
  photoFileNames: string[];
  biuroNazwa: string | null;
  biuroOpiekun: string | null;
  prad: PradStatus;
  woda: WodaStatus;
  kanalizacja: KanalizacjaStatus;
  gaz: GazStatus;
  mpzp: boolean;
  wzWydane: boolean;
  ksiegaWieczysta: string | null;
  wymiary: string | null;
  payload: Prisma.InputJsonValue;
};

// Zwraca true, gdy `candidate` jest co najmniej tak świeży jak `current` (po daom).
// Wersja z datą wygrywa z wersją bez daty; przy remisie wygrywa późniejszy plik —
// pliki XML iterujemy od najstarszego.
function isSameOrNewerOffer(candidate: LocumnetOffer, current: LocumnetOffer): boolean {
  const c = candidate.externalUpdatedAt?.getTime() ?? null;
  const p = current.externalUpdatedAt?.getTime() ?? null;
  if (c != null && p != null) return c >= p;
  if (c != null) return true;
  if (p != null) return false;
  return true;
}

type DownloadedLocumnetFeed = {
  remoteFileName: string;
  tempDir: string;
  offerXmlFiles: string[];
  localFileByBasename: Map<string, string>;
  imageRemotePathByBasename: Map<string, string>;
  downloadedPhotoByBasename: Map<string, string>;
  photoFtpClient: ftp.Client | null;
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
    if (typeof obj["#text"] === "number") return String(obj["#text"]).trim();
    if (typeof obj.text === "string") return obj.text.trim();
  }

  return "";
}

// Atrybut `code` z tagów w stylu <typnie code='202'>Grunty - działka budowlana</typnie>.
function attrCode(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const obj = value as Record<string, unknown>;
  return toTextValue(obj.code ?? obj["@_code"]);
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
    .replace(/[̀-ͯ]/g, "")
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

// Województwo przychodzi WERSALIKAMI (WIELKOPOLSKIE) — normalizujemy do "Wielkopolskie".
function titleCaseWojewodztwo(value: string): string {
  const text = value.trim().toLowerCase();
  if (!text) return "";
  return text.replace(/(^|[\s-])(\p{L})/gu, (match, sep: string, letter: string) => sep + letter.toUpperCase());
}

function mapPlotTypeToPrzeznaczenia(...values: Array<string | null | undefined>): Przeznaczenie[] {
  const text = normalizeText(values.filter(Boolean).join(" "));
  const result = new Set<Przeznaczenie>();

  if (hasAny(text, ["budowl", "mieszkani", "jednorodzin", "wielorodzin", "blizniac"])) result.add("BUDOWLANA");
  if (hasAny(text, ["roln", "grunt orny", "gospodarstwo", "ogrodnicz"])) result.add("ROLNA");
  if (hasAny(text, ["lesn", "las"])) result.add("LESNA");
  if (hasAny(text, ["rekre", "letnisk"])) result.add("REKREACYJNA");
  if (hasAny(text, ["siedlisk", "zagrod"])) result.add("SIEDLISKOWA");
  if (hasAny(text, ["inwest", "uslug", "komerc", "przemys", "produkcyj", "magazyn", "rzemiesln", "handlow"])) result.add("INWESTYCYJNA");

  if (result.size === 0) result.add("BUDOWLANA");
  return [...result];
}

// Kody typów gruntów LocumNet (typnie 202-232). Autorytatywne, gdy znane; nieznany kod
// spada na dopasowanie tekstowe etykiety + pola przeznaczenia (przezna).
const LOCUMNET_LAND_TYPE_TO_PRZEZNACZENIE: Record<string, Przeznaczenie> = {
  "202": "BUDOWLANA", // działka budowlana
  "212": "ROLNA", // działka rolna
  "214": "ROLNA", // działka ogrodnicza
  "216": "REKREACYJNA", // działka rekreacyjna
  "218": "LESNA", // działka leśna
  "224": "INWESTYCYJNA", // działka przemysłowa
  "226": "INWESTYCYJNA", // działka handlowa
  "228": "INWESTYCYJNA", // działka usługowa
  "230": "INWESTYCYJNA", // działka inwestycyjna
};

function mapLocumnetPrzeznaczenia(typnieCode: string, typnieLabel: string, przezna: string): Przeznaczenie[] {
  const fromCode = LOCUMNET_LAND_TYPE_TO_PRZEZNACZENIE[typnieCode];
  const fromText = mapPlotTypeToPrzeznaczenia(typnieLabel, przezna);

  if (!fromCode) return fromText;

  // Kod daje typ główny, tekst przeznaczenia może dodać drugi (np. budowlana + zagrodowa).
  const result = new Set<Przeznaczenie>([fromCode]);
  const explicit = mapPlotTypeToPrzeznaczenia(przezna);
  if (przezna.trim()) {
    for (const item of explicit) result.add(item);
  }
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

// Media w LocumNet: medele/medgaz/medwod/medkan przyjmują 0=nie, 1=tak, pusto=brak danych.
// Zgodnie z twardymi filtrami: tylko jednoznaczne "1"/"tak" liczy się jako medium.
function mapPrad(raw: unknown): PradStatus {
  const text = normalizeText(toTextValue(raw));
  if (hasAny(text, ["1", "tak"])) return "MOZLIWOSC_PRZYLACZENIA";
  return "BRAK_PRZYLACZA";
}

function mapWoda(raw: unknown): WodaStatus {
  const text = normalizeText(toTextValue(raw));
  if (hasAny(text, ["1", "tak"])) return "MOZLIWOSC_PODLACZENIA";
  return "BRAK_PRZYLACZA";
}

function mapGaz(raw: unknown): GazStatus {
  const text = normalizeText(toTextValue(raw));
  if (hasAny(text, ["1", "tak"])) return "MOZLIWOSC_PODLACZENIA";
  return "BRAK";
}

function mapKanalizacja(raw: unknown): KanalizacjaStatus {
  const text = normalizeText(toTextValue(raw));
  if (hasAny(text, ["1", "tak"])) return "MOZLIWOSC_PODLACZENIA";
  return "BRAK";
}

// Tak/Nie z tagów z atrybutem code (code='1' = Tak).
function boolFromCoded(node: unknown): boolean {
  const code = attrCode(node);
  if (code) return code === "1";
  return normalizeText(toTextValue(node)) === "tak";
}

// Grunty w LocumNet to kody 202-232 (typnie). Wszystko inne (mieszkania, domy,
// komercyjne) odrzucamy — jesteśmy portalem działek.
function isLandOffer(typnieCode: string, typnieLabel: string) {
  if (typnieCode) {
    const parsed = Number(typnieCode);
    return Number.isFinite(parsed) && parsed >= 202 && parsed <= 232;
  }
  return normalizeText(typnieLabel).includes("grunt") || normalizeText(typnieLabel).includes("dzial");
}

type ParsedXmlFile = {
  offers: LocumnetOffer[];
  deletedExternalIds: string[];
  isFullExport: boolean;
  rawCount: number;
};

function parseLocumnetOffer(
  rawOffer: Record<string, unknown>,
  agencyName: string | null,
  photoFileNamesByExternalId: Map<string, string[]>
): LocumnetOffer | null {
  const externalId = toTextValue(rawOffer.idof);

  if (!externalId) {
    console.log("[LOCUMNET DEBUG] Odrzucono ofertę: brak idof.");
    return null;
  }

  const typnieCode = attrCode(rawOffer.typnie);
  const typnieLabel = toTextValue(rawOffer.typnie);

  if (!isLandOffer(typnieCode, typnieLabel)) {
    console.log("[LOCUMNET DEBUG] Odrzucono:", externalId, "to nie jest działka.", typnieLabel || typnieCode);
    return null;
  }

  const typof = normalizeText(toTextValue(rawOffer.typof));
  if (typof && !typof.includes("sprzed")) {
    console.log("[LOCUMNET DEBUG] Odrzucono:", externalId, "transakcja nie jest sprzedażą.", typof);
    return null;
  }

  const price = toNumber(rawOffer.cmin);
  const area = toNumber(rawOffer.pocmin);

  if (!price || price <= 0) {
    console.log("[LOCUMNET DEBUG] Odrzucono:", externalId, "brak ceny.");
    return null;
  }

  if (!area || area < 1) {
    console.log("[LOCUMNET DEBUG] Odrzucono:", externalId, "brak powierzchni.");
    return null;
  }

  const city = toTextValue(rawOffer.lokmie) || null;
  const district = toTextValue(rawOffer.lokosi) || null; // osiedle/dzielnica
  const commune = toTextValue(rawOffer.lokgmi) || null;
  const county = toTextValue(rawOffer.lokpow) || null;
  const provinceRaw = toTextValue(rawOffer.lokwoj);
  const province = provinceRaw ? titleCaseWojewodztwo(provinceRaw) : null;
  const street = toTextValue(rawOffer.ulin) || toTextValue(rawOffer.lokuli) || null;

  if (!city && !commune && !county && !province) {
    console.log("[LOCUMNET DEBUG] Odrzucono:", externalId, "brak lokalizacji.");
    return null;
  }

  const rawLat = toNumber(rawOffer.geoszer);
  const rawLng = toNumber(rawOffer.geodlu);
  // Bramka jakości: na mapę trafiają tylko współrzędne w granicach Polski.
  // LocumNet daje geo prosto w feedzie — celowo NIE geokodujemy (koszty API).
  const plCoords = sanitizePlCoords(rawLat, rawLng);
  const lat = plCoords?.lat ?? null;
  const lng = plCoords?.lng ?? null;

  const przezna = toTextValue(rawOffer.przezna);

  // Opis zapisujemy SUROWO (jak w pozostałych silnikach) — czyszczenie i formatowanie
  // HTML robi formatOpis na renderze.
  const description = toTextValue(rawOffer.opis) || null;

  const locationLabel = [city, district].filter(Boolean).join(", ") || city || commune || county || province;
  // Dedup po znormalizowanej formie: gmina i powiat bywają tym samym ("Poznań M." / "Poznań m.").
  const locationFullSeen = new Set<string>([normalizeText(locationLabel)]);
  const locationFullParts: string[] = [];
  for (const item of [street, city, district, commune, county, province]) {
    if (!item) continue;
    const key = normalizeText(item).replace(/\bm\.?$/, "").trim();
    if (locationFullSeen.has(key) || locationFullSeen.has(normalizeText(item))) continue;
    locationFullSeen.add(key);
    locationFullParts.push(item);
  }
  const locationFull = locationFullParts.join(", ") || locationLabel;

  const title = sanitizeTitle(
    toTextValue(rawOffer.nazwa) || toTextValue(rawOffer.xmlslogan) || null,
    city || commune || county || province,
    typnieLabel ? typnieLabel.replace(/^grunty\s*-\s*/i, "") : null
  );

  const width = toNumber(rawOffer.szer);
  const length = toNumber(rawOffer.dlugo);

  const opiekun = toTextValue(rawOffer.u_nazwa) || toTextValue(rawOffer.kto) || null;
  const email =
    normalizeEmail(toTextValue(rawOffer.u_email)) ||
    normalizeEmail(toTextValue(rawOffer.oferent_email)) ||
    "kontakt@tylkodzialki.pl";
  const phone = normalizePhone(
    toTextValue(rawOffer.u_tel2) || toTextValue(rawOffer.u_tel) || toTextValue(rawOffer.oferent_tel)
  );

  const photoFileNames = photoFileNamesByExternalId.get(externalId) ?? [];

  const prad = mapPrad(rawOffer.medele);
  const woda = mapWoda(rawOffer.medwod);
  const gaz = mapGaz(rawOffer.medgaz);
  const kanalizacja = mapKanalizacja(rawOffer.medkan);

  const mpzp = boolFromCoded(rawOffer.planzags);
  const wzWydane = boolFromCoded(rawOffer.warun);

  // W polu <kw> biura wpisują czasem "tak"/"nie" zamiast numeru księgi — zapisujemy
  // tylko wartości wyglądające na numer KW (człony rozdzielone "/").
  const kwRaw = toTextValue(rawOffer.kw);
  const ksiegaWieczysta = kwRaw.includes("/") ? kwRaw : null;

  return {
    externalId,
    externalUpdatedAt: parseDate(rawOffer.daom) ?? parseDate(rawOffer.dazg),
    title,
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
    przeznaczenia: mapLocumnetPrzeznaczenia(typnieCode, typnieLabel, przezna),
    photoFileNames,
    biuroNazwa: toTextValue(rawOffer.oferent_nazwa) || agencyName,
    biuroOpiekun: opiekun,
    prad,
    woda,
    kanalizacja,
    gaz,
    mpzp,
    wzWydane,
    ksiegaWieczysta,
    wymiary: buildWymiary(width, length),
    payload: toInputJsonValue({
      externalId,
      typnieCode,
      typnieLabel,
      typof: toTextValue(rawOffer.typof),
      mlssta: toTextValue(rawOffer.mlssta),
      ofak: toTextValue(rawOffer.ofak),
      przezna,
      location: { street, city, district, commune, county, province, lat, lng },
      mappedMedia: { prad, woda, kanalizacja, gaz },
      mpzp,
      wzWydane,
      photoFileNames,
      daom: toTextValue(rawOffer.daom),
      dazg: toTextValue(rawOffer.dazg),
    }),
  };
}

// Eksport na potrzeby skryptów diagnostycznych (podgląd, co parser wyciąga z paczki).
export function parseOfferXmlFile(xml: string, agencyName: string | null): ParsedXmlFile {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = (doc.root ?? doc.ROOT ?? doc) as Record<string, unknown>;

  const info = (root.info ?? {}) as Record<string, unknown>;
  const fullExportText = normalizeText(toTextValue(info.FullExport ?? info.fullexport));
  const isFullExport = fullExportText === "true" || fullExportText === "1";

  // Sekcja <pictures>: mapowanie idof -> pliki jpg w kolejności z <inf> ("Fotografia nr N").
  const photoEntriesByExternalId = new Map<string, Array<{ fileName: string; order: number }>>();
  const picturesNode = (root.pictures ?? {}) as Record<string, unknown>;

  for (const pictureNode of arrify(picturesNode.picture)) {
    if (!pictureNode || typeof pictureNode !== "object") continue;
    const picture = pictureNode as Record<string, unknown>;

    const pictureIdof = toTextValue(picture.idof);
    const fileName = safeBasename(toTextValue(picture.jpeg));
    if (!pictureIdof || !fileName) continue;

    const orderMatch = toTextValue(picture.inf).match(/(\d+)/);
    const order = orderMatch ? Number(orderMatch[1]) : Number.MAX_SAFE_INTEGER;

    const list = photoEntriesByExternalId.get(pictureIdof) ?? [];
    list.push({ fileName, order });
    photoEntriesByExternalId.set(pictureIdof, list);
  }

  const photoFileNamesByExternalId = new Map<string, string[]>();
  for (const [externalId, entries] of photoEntriesByExternalId) {
    const sorted = [...entries].sort((a, b) => a.order - b.order).map((entry) => entry.fileName);
    photoFileNamesByExternalId.set(externalId, [...new Set(sorted)]);
  }

  const agencyNode = ((root.biura as Record<string, unknown> | undefined)?.biuro ?? null) as unknown;
  const feedAgencyName = toTextValue((arrify(agencyNode)[0] as Record<string, unknown> | undefined)?.nazwapelna) || agencyName;

  const deletedExternalIds: string[] = [];
  const offers: LocumnetOffer[] = [];
  let rawCount = 0;

  const offersNode = (root.oferty ?? {}) as Record<string, unknown>;

  for (const offerNode of arrify(offersNode.oferta)) {
    if (!offerNode || typeof offerNode !== "object") continue;
    rawCount += 1;

    const rawOffer = offerNode as Record<string, unknown>;
    const externalId = toTextValue(rawOffer.idof);

    // Dokumentacja LocumNet: "należy usuwać i nie przyjmować ofert, których parametr mlssta > 2"
    // (2=aktualna; 4=blokowana, 6=sprzedana, 8+=wycofane).
    const mlssta = toNumber(rawOffer.mlssta);
    if (externalId && mlssta != null && mlssta > 2) {
      deletedExternalIds.push(externalId);
      continue;
    }

    const parsed = parseLocumnetOffer(rawOffer, feedAgencyName, photoFileNamesByExternalId);
    if (parsed) offers.push(parsed);
  }

  // Sekcja <removed>: oferty zdjęte od poprzedniego eksportu. Placeholder "0" pomijamy.
  const removedNode = (root.removed ?? {}) as Record<string, unknown>;
  for (const removedIdofNode of arrify(removedNode.idof)) {
    const removedId = toTextValue(removedIdofNode);
    if (removedId && removedId !== "0") deletedExternalIds.push(removedId);
  }

  return { offers, deletedExternalIds, isFullExport, rawCount };
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
      console.warn("[LOCUMNET DEBUG] Nie udało się wejść do podkatalogu:", item.name, error);
      await client.cd(remoteDir).catch(() => {});
    }
  }

  return result;
}

async function extractZip(localZipPath: string, outputDir: string) {
  await fsp.mkdir(outputDir, { recursive: true });

  // Strumień źródłowy MUSI być zamknięty także gdy rozpakowanie rzuci (patrz esticrm-sync:
  // niezamknięty deskryptor w długo żyjącym workerze trzyma miejsce na dysku aż do ENOSPC).
  const source = fs.createReadStream(localZipPath);
  try {
    await source.pipe(unzipper.Extract({ path: outputDir })).promise();
  } finally {
    source.destroy();
  }
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

// Czy XML w ZIP-ie deklaruje pełny eksport (<FullExport>True</FullExport> w nagłówku <info>).
function sniffFullExport(xmlHead: string): boolean | null {
  const match = xmlHead.match(/<FullExport>\s*([a-zA-Z0-9]+)\s*<\/FullExport>/i);
  if (!match) return null;
  const value = match[1].toLowerCase();
  return value === "true" || value === "1";
}

function isOfferXmlBasename(basename: string) {
  return basename.endsWith(".xml");
}

async function downloadLocumnetFeedFromFtp(integration: IntegrationForSync): Promise<DownloadedLocumnetFeed> {
  if (!integration.ftpHost || !integration.ftpUsername || !integration.ftpPassword) {
    throw new Error("Integracja LocumNet nie ma uzupełnionych danych FTP.");
  }

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "td-locumnet-"));
  const localFileByBasename = new Map<string, string>();
  const imageRemotePathByBasename = new Map<string, string>();
  const downloadedPhotoByBasename = new Map<string, string>();
  const photoFtpClient: ftp.Client | null = null;
  let remoteFileName = "LOCUMNET_FILES";

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

    console.log("[LOCUMNET DEBUG] FTP katalog:", remoteDir);

    const list = await listCurrentAndOneLevel(client, remoteDir);
    const files = list.filter((item) => item.isFile);

    console.log("[LOCUMNET DEBUG] Pliki na FTP:", files.map((item) => ({ name: item.name, remotePath: item.remotePath, size: item.size, modifiedAt: item.modifiedAt })));

    const zipFiles = files
      .filter((item) => item.name.toLowerCase().endsWith(".zip"))
      .sort((a, b) => (b.modifiedAt?.getTime() ?? 0) - (a.modifiedAt?.getTime() ?? 0));

    const extractedRoot = path.join(tempDir, "extracted");

    // Do auto-czyszczenia: data najnowszego PEŁNEGO eksportu (FullExport=True). ZIP-y starsze
    // niż pełny nigdy już nie są czytane. 0 = brak potwierdzonego pełnego, zero kasowań.
    let newestFullZipModifiedMs = 0;

    // Wybór plików jak w esticrm-sync: od najnowszego ZIP-a wstecz, przyrostowe zbieramy
    // po drodze, zatrzymujemy się na pierwszym PEŁNYM eksporcie (FullExport=True) albo na
    // pliku bez rozpoznanego trybu (konserwatywnie, żeby nie wciągać starych paczek).
    // Biura wysyłające same przyrostowe: pętla przejdzie całą listę i weźmie wszystko.
    for (let idx = 0; idx < zipFiles.length; idx++) {
      const zip = zipFiles[idx];
      if (idx === 0) remoteFileName = zip.name;

      const zipLocalPath = path.join(tempDir, zip.remotePath);
      await downloadFile(client, zip.remotePath, zipLocalPath);

      const zipExtractDir = path.join(extractedRoot, String(idx));
      await extractZip(zipLocalPath, zipExtractDir);

      let zipFullExport: boolean | null = null;
      for (const file of await walkFiles(zipExtractDir)) {
        const base = safeBasename(file);
        // Najnowszy wygrywa: starszy plik nie nadpisuje nowszego o tej samej nazwie.
        if (!localFileByBasename.has(base)) localFileByBasename.set(base, file);

        if (zipFullExport === null && isOfferXmlBasename(base)) {
          const head = (await fsp.readFile(file, "utf8")).slice(0, 4096);
          zipFullExport = sniffFullExport(head);
        }
      }

      const isFullZip = zipFullExport === true;
      const isKnownIncremental = zipFullExport === false;

      console.log(
        "[LOCUMNET DEBUG] Plik ZIP:",
        zip.name,
        "| FullExport:",
        zipFullExport === null ? "(nieznany)" : String(zipFullExport),
        "|",
        isFullZip ? "PEŁNY, kończę wybór" : isKnownIncremental ? "przyrostowy, szukam pełnego" : "nieznany, kończę wybór"
      );

      if (isFullZip && zip.modifiedAt) {
        newestFullZipModifiedMs = zip.modifiedAt.getTime();
      }

      if (isFullZip || !isKnownIncremental) break;
    }

    // Luźne pliki obok ZIP-ów (gdyby biuro wgrało XML/zdjęcia bez paczki).
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

    const offerXmlFiles = [...localFileByBasename.entries()]
      .filter(([basename]) => isOfferXmlBasename(basename))
      .map(([, localPath]) => localPath)
      // Nazwy mają timestamp (export2026-07-23-14-27-01.xml), więc sort alfabetyczny =
      // chronologiczny od najstarszego. Dedup ofert liczy na tę kolejność.
      .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

    if (!zipFiles[0] && offerXmlFiles[0]) {
      remoteFileName = path.basename(offerXmlFiles[0]);
    }

    console.log("[LOCUMNET DEBUG] Pobrane pliki XML ofert:", offerXmlFiles.map((file) => path.basename(file)));
    console.log("[LOCUMNET DEBUG] Zdjęcia lokalne:", [...localFileByBasename.keys()].filter((name) => /\.(jpe?g|png|webp|avif)$/i.test(name)).length);

    // Auto-czyszczenie drop-zone (jak esticrm/asari): kasujemy WYŁĄCZNIE stare .zip starsze
    // niż najnowszy pełny eksport, z marginesem czasu i buforem najświeższych plików.
    if (newestFullZipModifiedMs > 0) {
      const retentionDays = Number(process.env.CRM_FEED_RETENTION_DAYS ?? "14");
      const keepMinFiles = Number(process.env.CRM_FEED_KEEP_MIN ?? "10");
      const ageCutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

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
          console.error("[LOCUMNET CLEANUP] Nie udało się usunąć starego ZIP:", z.remotePath, error);
        }
      }

      if (prunedCount > 0) {
        console.log(
          `[LOCUMNET CLEANUP] Usunięto ${prunedCount} ZIP-ów starszych niż najnowszy pełny eksport (${new Date(newestFullZipModifiedMs).toISOString()}) z ${remoteDir}.`
        );
      }
    }

    const feed: DownloadedLocumnetFeed = {
      remoteFileName,
      tempDir,
      offerXmlFiles,
      localFileByBasename,
      imageRemotePathByBasename,
      downloadedPhotoByBasename,
      photoFtpClient,
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

async function getLocumnetPhotoLocalPath(integration: IntegrationForSync, downloaded: DownloadedLocumnetFeed, originalName: string) {
  const basename = safeBasename(originalName);

  const local = downloaded.localFileByBasename.get(basename);
  if (local) return local;

  const alreadyDownloaded = downloaded.downloadedPhotoByBasename.get(basename);
  if (alreadyDownloaded) return alreadyDownloaded;

  const remotePath = downloaded.imageRemotePathByBasename.get(basename);
  if (!remotePath) {
    console.log("[LOCUMNET DEBUG] Brak pliku zdjęcia:", originalName);
    return null;
  }

  if (!integration.ftpHost || !integration.ftpUsername || !integration.ftpPassword) {
    throw new Error("Integracja LocumNet nie ma uzupełnionych danych FTP do pobrania zdjęć.");
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

async function uploadOfferPhotosToR2(integration: IntegrationForSync, downloaded: DownloadedLocumnetFeed, externalId: string, photoFileNames: string[]) {
  const uploaded: Array<{ url: string; publicId: string; kolejnosc: number }> = [];

  for (let index = 0; index < photoFileNames.length; index += 1) {
    const originalName = photoFileNames[index];
    const localPath = await getLocumnetPhotoLocalPath(integration, downloaded, originalName);
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
      console.error("[LOCUMNET DEBUG] Nie udało się usunąć zdjęcia z R2:", photo.publicId, error);
    }
  }
}

function buildDzialkaDataFromOffer(offer: LocumnetOffer) {
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
    mpzp: offer.mpzp,
    wzWydane: offer.wzWydane,
    ksiegaWieczysta: offer.ksiegaWieczysta,
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
  offer: LocumnetOffer,
  downloaded: DownloadedLocumnetFeed,
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
    if (!user) throw new Error("Nie znaleziono użytkownika integracji LocumNet.");

    if (paymentsEnabled && user.listingCredits <= 0) {
      await logSync(integration.id, {
        externalId: offer.externalId,
        action: "SKIP_NO_CREDITS",
        status: "ERROR",
        message: "Brak dostępnych publikacji do utworzenia oferty LocumNet.",
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
            note: `LocumNet publikacja oferty ${offer.externalId}`,
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
          message: "Oferta utworzona poprawnie z importu LocumNet.",
          payload: offer.payload,
        },
      });
    });

    return "CREATE";
  }

  const wasEnded = existingLink.dzialka.status === "ZAKONCZONE";

  if (wasEnded) {
    const user = await prisma.user.findUnique({ where: { id: integration.userId }, select: { id: true, listingCredits: true } });
    if (!user) throw new Error("Nie znaleziono użytkownika integracji LocumNet.");

    if (paymentsEnabled && user.listingCredits <= 0) {
      await logSync(integration.id, {
        dzialkaId: existingLink.dzialkaId,
        offerLinkId: existingLink.id,
        externalId: offer.externalId,
        action: "SKIP_NO_CREDITS",
        status: "ERROR",
        message: "Brak dostępnych publikacji do reaktywacji oferty LocumNet.",
        payload: offer.payload,
      });
      return "SKIP_NO_CREDITS";
    }
  }

  // Guard zdjęć (jak esticrm/asari): przychodząca wersja nie nowsza niż zapisana + zgodna
  // liczba zdjęć w bazie ⇒ pomijamy delete+re-upload do R2. Null-e i reaktywacja ⇒ pełny re-upload.
  const storedUpdatedAt = existingLink.externalUpdatedAt;
  const incomingUpdatedAt = offer.externalUpdatedAt;
  const photosUnchanged =
    !wasEnded &&
    storedUpdatedAt != null &&
    incomingUpdatedAt != null &&
    incomingUpdatedAt.getTime() <= storedUpdatedAt.getTime() &&
    (await prisma.zdjecie.count({ where: { dzialkaId: existingLink.dzialkaId } })) === offer.photoFileNames.length;

  if (!photosUnchanged) {
    await removeExistingR2Photos(existingLink.dzialkaId);
  }
  const uploadedPhotos = photosUnchanged
    ? []
    : await uploadOfferPhotosToR2(integration, downloaded, offer.externalId, offer.photoFileNames);

  await prisma.$transaction(async (tx) => {
    if (!photosUnchanged) {
      await tx.zdjecie.deleteMany({ where: { dzialkaId: existingLink.dzialkaId } });
    }

    const dzialka = await tx.dzialka.update({
      where: { id: existingLink.dzialkaId },
      data: {
        ...buildDzialkaDataFromOffer(offer),
        ...(wasEnded ? { publishedAt: now, expiresAt, endedAt: null, status: "AKTYWNE" as const } : {}),
        ...(photosUnchanged ? {} : { zdjecia: { create: uploadedPhotos } }),
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
          note: `LocumNet reaktywacja oferty ${offer.externalId}`,
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
        message: wasEnded ? "Oferta reaktywowana poprawnie z importu LocumNet." : "Oferta zaktualizowana poprawnie z importu LocumNet.",
        payload: offer.payload,
      },
    });
  });

  return wasEnded ? "REACTIVATE" : "UPDATE";
}

async function deactivateExternalId(integrationId: string, externalId: string, reason = "Oferta zakończona na podstawie sekcji removed / statusu mlssta z LocumNet.") {
  const now = new Date();

  const link = await prisma.crmOfferLink.findUnique({
    where: { integrationId_externalId: { integrationId, externalId } },
    include: { dzialka: true },
  });

  if (!link) {
    await logSync(integrationId, { externalId, action: "DELETE", status: "SUCCESS", message: "LocumNet zgłosił usunięcie oferty, ale nie znaleziono jej w bazie." });
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
          message: "Oferta zakończona, ponieważ nie wystąpiła w pełnym eksporcie LocumNet.",
        },
      });
    });

    count += 1;
  }

  return count;
}

export async function syncLocumnetIntegrationNow(integrationId: string): Promise<SyncSummary> {
  console.log("[LOCUMNET DEBUG] Start synchronizacji:", integrationId);

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

  if (!integration) throw new Error("Nie znaleziono integracji LocumNet.");
  if (!integration.isActive) throw new Error("Integracja LocumNet jest wyłączona.");
  if (integration.provider !== "LOCUMNET" && integration.feedFormat !== "LOCUMNET_XML") {
    throw new Error("Ta integracja nie jest LocumNet / LOCUMNET_XML.");
  }

  const now = new Date();
  let downloaded: DownloadedLocumnetFeed | null = null;

  try {
    downloaded = await downloadLocumnetFeedFromFtp(integration);

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
    let sawFullExport = false;

    if (downloaded.offerXmlFiles.length === 0) {
      console.log("[LOCUMNET DEBUG] Brak plików XML ofert.");
    }

    // Pełny + przyrostowe pliki zawierają tę samą ofertę wielokrotnie. Scalamy do
    // NAJNOWSZEJ wersji per externalId (po daom) i przetwarzamy raz.
    const latestOfferByExternalId = new Map<string, LocumnetOffer>();

    for (const offerXmlFile of downloaded.offerXmlFiles) {
      const xml = await fsp.readFile(offerXmlFile, "utf8");
      const result = parseOfferXmlFile(xml, integration.name);

      if (result.isFullExport) sawFullExport = true;
      rawOffersCount += result.rawCount;

      for (const externalId of result.deletedExternalIds) deletedExternalIds.add(externalId);

      for (const offer of result.offers) {
        const prev = latestOfferByExternalId.get(offer.externalId);
        if (!prev || isSameOrNewerOffer(offer, prev)) {
          latestOfferByExternalId.set(offer.externalId, offer);
        }
      }
    }

    // Oferta obecna w nowszym pliku unieważnia wcześniejsze zgłoszenie usunięcia — ale
    // usunięcie z sekcji removed/mlssta jest per plik, a my nie śledzimy z którego pliku
    // pochodzi. Konserwatywnie: usunięcie wygrywa (biuro i tak przyśle ofertę ponownie
    // w kolejnym eksporcie, jeśli wróciła).
    for (const externalId of deletedExternalIds) {
      latestOfferByExternalId.delete(externalId);
    }

    const dedupedOffers = [...latestOfferByExternalId.values()];
    console.log(`[LOCUMNET DEBUG] Oferty po deduplikacji (najnowsza wersja per externalId): ${dedupedOffers.length}`);

    for (const offer of dedupedOffers) {
      importedOffers += 1;
      seenExternalIds.add(offer.externalId);

      try {
        const action = await processOffer(integration, offer, downloaded, paymentsEnabled);

        if (action === "CREATE" || action === "REACTIVATE") createdCount += 1;
        else if (action === "UPDATE") updatedCount += 1;
        else if (action === "SKIP_NO_CREDITS") skippedCount += 1;
      } catch (error) {
        errorCount += 1;
        const message = error instanceof Error ? error.message : "Nieznany błąd podczas importu oferty LocumNet.";
        console.error("[LOCUMNET DEBUG] Błąd zapisu oferty:", offer.externalId, message, error);

        await logSync(integration.id, { externalId: offer.externalId, action: "ERROR", status: "ERROR", message, payload: offer.payload });
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
          message: error instanceof Error ? error.message : "Błąd podczas usuwania oferty LocumNet.",
        });
      }
    }

    // Deaktywacja brakujących tylko, gdy w zestawie był PEŁNY eksport — wtedy seenExternalIds
    // pokrywa komplet aktywnych ofert biura (pełny + nowsze przyrostowe zmiany).
    if (integration.fullImportMode && sawFullExport && seenExternalIds.size > 0) {
      deactivatedCount += await deactivateMissingOffers(integration.id, seenExternalIds);
    } else {
      console.log("[LOCUMNET DEBUG] Nie kończę brakujących ofert. Dezaktywacja tylko przy removed/mlssta albo pełnym eksporcie.", { sawFullExport, seen: seenExternalIds.size });
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
            ? `Synchronizacja LocumNet zakończona z błędami (${errorCount}).`
            : skippedCount > 0
              ? `Synchronizacja LocumNet zakończona. Pominięto ${skippedCount} ofert z powodu braku kredytów.`
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
          ? "Synchronizacja LocumNet zakończona z częściowymi błędami."
          : downloaded.offerXmlFiles.length === 0
            ? "LocumNet FTP działa, ale nie znaleziono plików ofert XML."
            : importedOffers === 0 && rawOffersCount > 0
              ? `LocumNet działa. Przetworzono ${rawOffersCount} ofert z XML, ale żadna nie była działką na sprzedaż.`
              : "Synchronizacja LocumNet zakończona poprawnie.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się zsynchronizować integracji LocumNet.";

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
