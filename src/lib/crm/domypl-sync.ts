import crypto from "crypto";
import path from "path";
import os from "os";
import fs from "fs";
import { promises as fsp } from "fs";
import * as ftp from "basic-ftp";
import unzipper from "unzipper";
import sax from "sax";
import {
  CrmFeedFormat,
  CrmProvider,
  CrmTransportType,
  GazStatus,
  KanalizacjaStatus,
  LocationMode,
  PradStatus,
  Prisma,
  Przeznaczenie,
  WodaStatus,
} from "@prisma/client";
import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, uploadBufferToR2 } from "@/lib/r2";

type IntegrationForSync = {
  id: string;
  userId: string;
  name: string;
  provider: CrmProvider;
  isActive: boolean;
  transportType: CrmTransportType;
  feedFormat: CrmFeedFormat;
  ftpHost: string | null;
  ftpPort: number | null;
  ftpUsername: string | null;
  ftpPassword: string | null;
  ftpRemotePath: string | null;
  ftpPassive: boolean;
  expectedFilePattern: string | null;
  fullImportMode: boolean;
};

type ParsedDomyOffer = {
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

type HeaderMeta = {
  headerDate: Date | null;
  agencyName: string | null;
  zawartoscPliku: string;
};

type DownloadedFeed = {
  remoteFileName: string;
  localFilePath: string;
  fileSize: number | null;
  fileModifiedAt: Date | null;
  cleanup: () => Promise<void>;
};

type MatchedRemoteFeed = {
  remoteFileName: string;
  size: number | null;
  modifiedAt: Date | null;
};

type FeedReader = {
  createXmlReadStream: () => Promise<NodeJS.ReadableStream>;
  getPhotoBuffer: (fileName: string) => Promise<Buffer | null>;
  close: () => Promise<void>;
};

type ZipEntryLike = {
  type: string;
  path: string;
  stream: () => NodeJS.ReadableStream;
  buffer: () => Promise<Buffer>;
};

type SaxAttrLike = string | { value: string };

type SaxTagLike = {
  name: string;
  attributes?: Record<string, SaxAttrLike>;
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

function wildcardToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`, "i");
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
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();

  if (Array.isArray(value)) {
    return value.map(toTextValue).filter(Boolean).join("\n").trim();
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    const lineValues = arrify(obj.linia)
      .map((line: unknown) => toTextValue(line))
      .filter(Boolean);

    if (lineValues.length > 0) return lineValues.join("\n").trim();
    if (typeof obj["#text"] === "string") return obj["#text"].trim();
    if (typeof obj.text === "string") return obj.text.trim();
  }

  return "";
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function normalizePhone(value: string) {
  return value.trim();
}

function buildMapsUrl(lat: number | null, lng: number | null) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function mapPlotTypeToPrzeznaczenia(plotTypeRaw: string | null): Przeznaczenie[] {
  const text = (plotTypeRaw ?? "").toLowerCase();
  const result = new Set<Przeznaczenie>();

  if (text.includes("budowl") || text.includes("jednorodzin") || text.includes("wielorodzin")) {
    result.add("BUDOWLANA");
  }

  if (text.includes("rol")) result.add("ROLNA");
  if (text.includes("les") || text.includes("leś")) result.add("LESNA");
  if (text.includes("rekre")) result.add("REKREACYJNA");
  if (text.includes("siedl")) result.add("SIEDLISKOWA");

  if (
    text.includes("inwest") ||
    text.includes("komerc") ||
    text.includes("uslug") ||
    text.includes("usług") ||
    text.includes("przemys") ||
    text.includes("przemysł")
  ) {
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

function getMimeTypeFromFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  return "image/jpeg";
}

function safeBasename(value: string) {
  return path.basename(value.replace(/\\/g, "/")).toLowerCase();
}

function safeUploadFileName(value: string) {
  const cleaned = value.split("?")[0] || "photo.jpg";
  return safeBasename(cleaned) || "photo.jpg";
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeText(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}

function isTruthyText(value?: string | null) {
  const v = normalizeText(value);
  return ["1", "t", "tak", "true", "yes", "jest"].includes(v);
}

function mapPradFromParams(params: Record<string, unknown>): PradStatus {
  const pradText = normalizeText(toTextValue(params.prad));
  const uzbrojenieText = normalizeText(toTextValue(params.uzbrojenie));

  if (isTruthyText(toTextValue(params.prad))) return "PRZYLACZE_NA_DZIALCE";
  if (hasAny(pradText, ["na działce", "na dzialce", "w działce", "w dzialce", "jest", "tak"])) return "PRZYLACZE_NA_DZIALCE";
  if (hasAny(pradText, ["w drodze", "w ulicy", "w granicy", "przy działce", "przy dzialce"])) return "PRZYLACZE_W_DRODZE";
  if (hasAny(pradText, ["warunki"])) return "WARUNKI_PRZYLACZENIA_WYDANE";
  if (hasAny(pradText, ["możliwość", "mozliwosc", "do podłączenia", "do podlaczenia"])) return "MOZLIWOSC_PRZYLACZENIA";
  if (hasAny(pradText, ["brak", "nie ma"])) return "BRAK_PRZYLACZA";
  if (hasAny(uzbrojenieText, ["prąd-na działce", "prad-na dzialce"])) return "PRZYLACZE_NA_DZIALCE";
  if (hasAny(uzbrojenieText, ["prąd-w ulicy", "prad-w ulicy", "prąd-w drodze", "prad-w drodze"])) return "PRZYLACZE_W_DRODZE";
  if (hasAny(uzbrojenieText, ["prąd", "prad"])) return "MOZLIWOSC_PRZYLACZENIA";

  return "BRAK_PRZYLACZA";
}

function mapWodaFromParams(params: Record<string, unknown>): WodaStatus {
  const wodaText = normalizeText(toTextValue(params.typpodlaczeniawody));
  const maWodeText = normalizeText(toTextValue(params.ma_wode));
  const uzbrojenieText = normalizeText(toTextValue(params.uzbrojenie));

  if (isTruthyText(maWodeText)) return "WODOCIAG_NA_DZIALCE";
  if (hasAny(wodaText, ["studnia", "studnia głębinowa", "studnia glebinowa"])) return "STUDNIA_GLEBINOWA";
  if (hasAny(wodaText, ["na działce", "na dzialce", "miejska", "tak - miejska", "jest", "tak"])) return "WODOCIAG_NA_DZIALCE";
  if (hasAny(wodaText, ["w drodze", "w ulicy", "w granicy", "przy działce", "przy dzialce"])) return "WODOCIAG_W_DRODZE";
  if (hasAny(wodaText, ["możliwość", "mozliwosc", "do podłączenia", "do podlaczenia"])) return "MOZLIWOSC_PODLACZENIA";
  if (hasAny(wodaText, ["brak", "nie ma"])) return "BRAK_PRZYLACZA";
  if (hasAny(uzbrojenieText, ["woda-na działce", "woda-na dzialce", "wodociąg-na działce", "wodociag-na dzialce"])) return "WODOCIAG_NA_DZIALCE";
  if (hasAny(uzbrojenieText, ["woda-w ulicy", "wodociąg-w ulicy", "wodociag-w ulicy", "woda-w drodze"])) return "WODOCIAG_W_DRODZE";
  if (hasAny(uzbrojenieText, ["woda", "wodociąg", "wodociag"])) return "MOZLIWOSC_PODLACZENIA";

  return "BRAK_PRZYLACZA";
}

function mapGazFromParams(params: Record<string, unknown>): GazStatus {
  const gazText = normalizeText(toTextValue(params.gaz));
  const maGazText = normalizeText(toTextValue(params.ma_gaz));
  const uzbrojenieText = normalizeText(toTextValue(params.uzbrojenie));

  if (isTruthyText(maGazText)) return "GAZ_NA_DZIALCE";
  if (hasAny(gazText, ["na działce", "na dzialce", "miejski", "tak - miejski", "jest", "tak"])) return "GAZ_NA_DZIALCE";
  if (hasAny(gazText, ["w drodze", "w ulicy", "w granicy", "przy działce", "przy dzialce"])) return "GAZ_W_DRODZE";
  if (hasAny(gazText, ["możliwość", "mozliwosc", "do podłączenia", "do podlaczenia"])) return "MOZLIWOSC_PODLACZENIA";
  if (hasAny(gazText, ["brak", "nie ma"])) return "BRAK";
  if (hasAny(uzbrojenieText, ["gaz-na działce", "gaz-na dzialce"])) return "GAZ_NA_DZIALCE";
  if (hasAny(uzbrojenieText, ["gaz-w ulicy", "gaz-w drodze"])) return "GAZ_W_DRODZE";
  if (hasAny(uzbrojenieText, ["gaz"])) return "MOZLIWOSC_PODLACZENIA";

  return "BRAK";
}

function mapKanalizacjaFromParams(params: Record<string, unknown>): KanalizacjaStatus {
  const kanalText = normalizeText(toTextValue(params.kanalizacja));
  const maKanalText = normalizeText(toTextValue(params.ma_kanalizacje));
  const uzbrojenieText = normalizeText(toTextValue(params.uzbrojenie));

  if (isTruthyText(maKanalText)) return "MIEJSKA_NA_DZIALCE";
  if (hasAny(kanalText, ["szambo"])) return "SZAMBO";
  if (hasAny(kanalText, ["oczyszczalnia", "przydomowa"])) return "PRZYDOMOWA_OCZYSZCZALNIA";
  if (hasAny(kanalText, ["na działce", "na dzialce", "miejska", "jest", "tak"])) return "MIEJSKA_NA_DZIALCE";
  if (hasAny(kanalText, ["w drodze", "w ulicy", "w granicy", "przy działce", "przy dzialce"])) return "MIEJSKA_W_DRODZE";
  if (hasAny(kanalText, ["możliwość", "mozliwosc", "do podłączenia", "do podlaczenia"])) return "MOZLIWOSC_PODLACZENIA";
  if (hasAny(kanalText, ["brak", "nie ma"])) return "BRAK";
  if (hasAny(uzbrojenieText, ["kanalizacja-na działce", "kanalizacja-na dzialce", "kanalizacja-tak"])) return "MIEJSKA_NA_DZIALCE";
  if (hasAny(uzbrojenieText, ["kanalizacja-w ulicy", "kanalizacja-w drodze"])) return "MIEJSKA_W_DRODZE";
  if (hasAny(uzbrojenieText, ["kanalizacja"])) return "MOZLIWOSC_PODLACZENIA";

  return "BRAK";
}

function buildWymiary(params: Record<string, unknown>): string | null {
  const width = toNumber(params.szerokoscdzialki);
  const length = toNumber(params.dlugoscdzialki);

  if (width && length) {
    const widthText = Number.isInteger(width) ? String(width) : String(width).replace(".", ",");
    const lengthText = Number.isInteger(length) ? String(length) : String(length).replace(".", ",");
    return `${widthText} x ${lengthText} m`;
  }

  if (width) return `${Number.isInteger(width) ? String(width) : String(width).replace(".", ",")} m szerokości`;
  if (length) return `${Number.isInteger(length) ? String(length) : String(length).replace(".", ",")} m długości`;

  return null;
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
      console.error("Nie udało się usunąć zdjęcia z R2:", photo.publicId, error);
    }
  }
}

async function uploadOfferPhotosToR2(
  integrationId: string,
  externalId: string,
  photoFileNames: string[],
  feedReader: FeedReader
) {
  const uploaded: Array<{ url: string; publicId: string; kolejnosc: number }> = [];

  for (let index = 0; index < photoFileNames.length; index += 1) {
    const originalName = photoFileNames[index];
    let fileBuffer = await feedReader.getPhotoBuffer(originalName);

    if (!fileBuffer && /^https?:\/\//i.test(originalName)) {
      try {
        const response = await fetch(originalName);
        if (response.ok) {
          fileBuffer = Buffer.from(await response.arrayBuffer());
        }
      } catch (error) {
        console.error("[CRM DEBUG] Nie udało się pobrać zdjęcia z URL:", originalName, error);
      }
    }

    if (!fileBuffer) {
      console.log("[CRM DEBUG] Pominięto zdjęcie, brak pliku/bufora:", originalName);
      continue;
    }

    const upload = await uploadBufferToR2({
      buffer: fileBuffer,
      originalFileName: `${integrationId}-${externalId}-${safeUploadFileName(originalName)}`,
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

async function downloadNewFeedsFromFtp(integration: IntegrationForSync): Promise<DownloadedFeed[]> {
  if (!integration.ftpHost || !integration.ftpUsername || !integration.ftpPassword) {
    throw new Error("Integracja FTP nie ma uzupełnionych danych logowania.");
  }

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "td-crm-"));

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

    const list = await client.list();

    console.log("[CRM DEBUG] FTP katalog:", remoteDir);
    console.log(
      "[CRM DEBUG] Pliki na FTP:",
      list.map((item) => ({
        name: item.name,
        isFile: item.isFile,
        size: item.size,
        modifiedAt: item.modifiedAt,
      }))
    );

    const pattern = integration.expectedFilePattern?.trim() || "oferty_*.zip";
    const regex = wildcardToRegExp(pattern);

    let matched = list.filter((item) => item.isFile && regex.test(item.name));

    if (matched.length === 0) {
      matched = list.filter((item) => {
        const name = item.name.toLowerCase();
        return item.isFile && (name.endsWith(".zip") || name.endsWith(".xml"));
      });
    }

    const remoteFeeds: MatchedRemoteFeed[] = matched
      .map((item) => ({
        remoteFileName: item.name,
        size: item.size ?? null,
        modifiedAt: item.modifiedAt ?? null,
      }))
      .sort((a, b) => {
        const aTime = a.modifiedAt?.getTime?.() ?? 0;
        const bTime = b.modifiedAt?.getTime?.() ?? 0;
        const aSize = a.size ?? 0;
        const bSize = b.size ?? 0;
        return aTime - bTime || aSize - bSize || a.remoteFileName.localeCompare(b.remoteFileName);
      });

    if (remoteFeeds.length === 0) {
      throw new Error(`Nie znaleziono żadnego pliku ZIP/XML w katalogu ${remoteDir}.`);
    }

    const filesToDownload = remoteFeeds.slice(-10);

    console.log(
      "[CRM DEBUG] Pliki wybrane do przetworzenia od najstarszego do najnowszego:",
      filesToDownload.map((file) => ({
        name: file.remoteFileName,
        size: file.size,
        modifiedAt: file.modifiedAt,
      }))
    );

    const downloadedFeeds: DownloadedFeed[] = [];

    for (const file of filesToDownload) {
      const localFilePath = path.join(tempDir, file.remoteFileName);

      await client.downloadTo(localFilePath, file.remoteFileName);

      downloadedFeeds.push({
        remoteFileName: file.remoteFileName,
        localFilePath,
        fileSize: file.size,
        fileModifiedAt: file.modifiedAt,
        cleanup: async () => {
          await fsp.rm(tempDir, { recursive: true, force: true });
        },
      });
    }

    return downloadedFeeds;
  } catch (error) {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally {
    client.close();
  }
}

async function openFeedReader(localFilePath: string, remoteFileName: string): Promise<FeedReader> {
  const lowerName = remoteFileName.toLowerCase();

  if (lowerName.endsWith(".xml")) {
    console.log("[CRM DEBUG] Otwieram XML bez ZIP:", remoteFileName);
    return {
      createXmlReadStream: async () => fs.createReadStream(localFilePath),
      getPhotoBuffer: async () => null,
      close: async () => {},
    };
  }

  if (!lowerName.endsWith(".zip")) {
    throw new Error("Obsługiwane są tylko pliki ZIP lub XML.");
  }

  const directory = await unzipper.Open.file(localFilePath);
  const files = directory.files as ZipEntryLike[];

  console.log(
    "[CRM DEBUG] Pliki w ZIP:",
    files.map((entry) => ({
      path: entry.path,
      type: entry.type,
    }))
  );

  const xmlEntry =
    files.find((entry) => entry.type === "File" && safeBasename(entry.path) === "oferty.xml") ||
    files.find((entry) => entry.type === "File" && entry.path.toLowerCase().endsWith(".xml"));

  if (!xmlEntry) {
    throw new Error("W paczce ZIP nie znaleziono pliku XML z ofertami.");
  }

  console.log("[CRM DEBUG] Wybrany XML z ZIP:", xmlEntry.path);

  const entryMap = new Map<string, ZipEntryLike>(
    files.filter((entry) => entry.type === "File").map((entry) => [safeBasename(entry.path), entry])
  );

  return {
    createXmlReadStream: async () => xmlEntry.stream(),
    getPhotoBuffer: async (fileName: string) => {
      const entry = entryMap.get(safeBasename(fileName));
      if (!entry) return null;
      return entry.buffer();
    },
    close: async () => {},
  };
}

function parseHeaderDate(value: unknown): Date | null {
  const text = toTextValue(value);
  if (!text) return null;

  const normalized = text.includes(" ") ? text.replace(" ", "T") : text;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseParams(offerNode: Record<string, unknown>) {
  const paramsList = arrify(offerNode.param);
  const params: Record<string, unknown> = {};

  for (const param of paramsList) {
    if (!param || typeof param !== "object") continue;

    const item = param as Record<string, unknown>;
    const name = String(item.nazwa ?? item["@_nazwa"] ?? "").trim();

    if (!name) continue;

    if (item.linia != null) {
      params[name] = item;
      continue;
    }

    if (item["#text"] != null) {
      params[name] = item["#text"];
      continue;
    }

    if (item.text != null) {
      params[name] = item.text;
      continue;
    }

    params[name] = item;
  }

  return params;
}

function parseLocation(offerNode: Record<string, unknown>, params: Record<string, unknown>) {
  const locationNode =
    typeof offerNode.location === "object" && offerNode.location
      ? (offerNode.location as Record<string, unknown>)
      : null;

  const areas = arrify(locationNode?.area).reduce<Record<string, string>>((acc, area) => {
    if (!area || typeof area !== "object") return acc;

    const item = area as Record<string, unknown>;
    const level = String(item.level ?? item["@_level"] ?? "").trim();
    const value = toTextValue(item);

    if (level && value) acc[level] = value;
    return acc;
  }, {});

  const wojewodztwo = toTextValue(params.wojewodztwo) || areas["2"] || null;
  const powiat = toTextValue(params.powiat) || areas["3"] || null;
  const gmina = toTextValue(params.gmina) || areas["4"] || null;
  const miasto = toTextValue(params.miasto) || areas["5"] || areas["4"] || null;
  const dzielnica = toTextValue(params.dzielnica) || areas["6"] || null;
  const ulica = toTextValue(params.ulica) || null;

  const labelParts = [miasto, dzielnica].filter(Boolean);
  const locationLabel = labelParts.length > 0 ? labelParts.join(", ") : miasto;

  const fullParts = [ulica, miasto, dzielnica, gmina, powiat, wojewodztwo].filter(Boolean);
  const locationFull = fullParts.length > 0 ? fullParts.join(", ") : null;

  return {
    wojewodztwo,
    powiat,
    gmina,
    miasto,
    dzielnica,
    ulica,
    locationLabel,
    locationFull,
  };
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function startTagToXml(node: SaxTagLike) {
  const attrs = Object.entries(node.attributes ?? {})
    .map(([key, attr]) => {
      const attrValue = typeof attr === "object" && attr && "value" in attr ? String(attr.value) : String(attr);
      return ` ${key}="${escapeXml(attrValue)}"`;
    })
    .join("");

  return `<${node.name}${attrs}>`;
}

function parseHeaderMeta(headerXml: string): HeaderMeta {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const doc = parser.parse(headerXml) as Record<string, unknown>;
  const header = (doc.header ?? {}) as Record<string, unknown>;

  return {
    headerDate: parseHeaderDate(header.data),
    agencyName: toTextValue(header.agencja) || null,
    zawartoscPliku: toTextValue(header.zawartosc_pliku).toLowerCase(),
  };
}

function parseOfferFragment(offerXml: string, headerMeta: HeaderMeta): ParsedDomyOffer | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      trimValues: false,
      parseTagValue: false,
      parseAttributeValue: false,
    });

    const doc = parser.parse(offerXml) as Record<string, unknown>;
    const ofertaNode = (doc.oferta ?? {}) as Record<string, unknown>;
    const externalId = toTextValue(ofertaNode.id);

    if (!externalId) {
      console.log("[CRM DEBUG] Odrzucono ofertę: brak externalId");
      return null;
    }

    const params = parseParams(ofertaNode);
    const plotTypeRaw = toTextValue(params.typdzialki) || null;

    const externalIdUpper = externalId.toUpperCase();

const isLandOffer =
  externalIdUpper.startsWith("GS") ||
  externalIdUpper.includes("-GS-") ||
  externalIdUpper.startsWith("GW") ||
  externalIdUpper.includes("-GW-") ||
  Boolean(plotTypeRaw);

    if (!isLandOffer) {
      console.log("[CRM DEBUG] Odrzucono:", externalId, "to nie jest działka", { plotTypeRaw });
      return null;
    }

    const location = parseLocation(ofertaNode, params);

    const price = toNumber(
      typeof ofertaNode.cena === "object" && ofertaNode.cena
        ? (ofertaNode.cena as Record<string, unknown>)["#text"] ?? ofertaNode.cena
        : ofertaNode.cena
    );

    const area =
      toNumber(params.powierzchnia) ??
      toNumber(params.powierzchniadzialki) ??
      toNumber(params.available_area);

    const email = normalizeEmail(toTextValue(params.agent_email)) || "kontakt@tylkodzialki.pl";

    const phone = normalizePhone(
      toTextValue(params.agent_tel_kom) ||
        toTextValue(params.agent_tel_biuro) ||
        "000000000"
    );

    if (!price || price <= 0) {
      console.log("[CRM DEBUG] Odrzucono:", externalId, "brak ceny", {
        rawCena: ofertaNode.cena,
        price,
      });
      return null;
    }

    if (!area || area < 1) {
      console.log("[CRM DEBUG] Odrzucono:", externalId, "brak powierzchni", {
        powierzchnia: params.powierzchnia,
        powierzchniadzialki: params.powierzchniadzialki,
        available_area: params.available_area,
        area,
      });
      return null;
    }

    if (!location.wojewodztwo || !location.miasto) {
      console.log("[CRM DEBUG] Odrzucono:", externalId, "brak lokalizacji", location);
      return null;
    }

    const title = sanitizeTitle(
      toTextValue(params.advertisement_text) || null,
      location.miasto,
      plotTypeRaw
    );

    const description = toTextValue(params.opis) || null;

    const lat = toNumber(params.n_geo_y) ?? toNumber(params.wsp_x);
    const lng = toNumber(params.n_geo_x) ?? toNumber(params.wsp_y);
    const mapsUrl = buildMapsUrl(lat, lng);

    const biuroOpiekun = toTextValue(params.agent_nazwisko) || null;

    const photoFileNames = Object.keys(params)
      .filter((key) => /^zdjecie\d+$/i.test(key.trim()))
      .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")))
      .map((key) => toTextValue(params[key]))
      .filter(Boolean);

    const prad = mapPradFromParams(params);
    const woda = mapWodaFromParams(params);
    const kanalizacja = mapKanalizacjaFromParams(params);
    const gaz = mapGazFromParams(params);
    const wymiary = buildWymiary(params);

    console.log("[CRM DEBUG] Zaakceptowano ofertę:", externalId, {
      title,
      price,
      area,
      locationLabel: location.locationLabel,
      photos: photoFileNames.length,
    });

    return {
      externalId,
      externalUpdatedAt: parseHeaderDate(params.dataaktualizacji) ?? headerMeta.headerDate,
      title,
      description,
      pricePln: Math.round(price),
      areaM2: Math.round(area),
      email,
      phone,
      locationLabel: location.locationLabel,
      locationFull: location.locationFull,
      lat,
      lng,
      mapsUrl,
      plotTypeRaw,
      przeznaczenia: mapPlotTypeToPrzeznaczenia(plotTypeRaw),
      photoFileNames,
      biuroNazwa: headerMeta.agencyName,
      biuroOpiekun,
      prad,
      woda,
      kanalizacja,
      gaz,
      wymiary,
      payload: toInputJsonValue({
        externalId,
        plotTypeRaw,
        params,
        agencyName: headerMeta.agencyName,
        mappedMedia: {
          prad,
          woda,
          kanalizacja,
          gaz,
          wymiary,
        },
      }),
    };
  } catch (error) {
    console.error("[CRM DEBUG] Błąd parsowania oferty DOMY.PL:", error);
    return null;
  }
}

async function streamParseDomyPlOffers(
  xmlStream: NodeJS.ReadableStream,
  onOffer: (offer: ParsedDomyOffer) => Promise<void>
): Promise<{ importedOffers: number; headerMeta: HeaderMeta }> {
  const saxStream = sax.createStream(true, {
    lowercase: true,
    trim: false,
    normalize: false,
  });

  let headerMeta: HeaderMeta = {
    headerDate: null,
    agencyName: null,
    zawartoscPliku: "",
  };

  let collectingHeader = false;
  let headerDepth = 0;
  let headerXml = "";

  let collectingOffer = false;
  let offerDepth = 0;
  let offerXml = "";

  let rawOffersFound = 0;
  let importedOffers = 0;
  let chain = Promise.resolve<void>(undefined);
  let streamEnded = false;

  const waitForChain = () => chain;

  saxStream.on("opentag", (node: SaxTagLike) => {
    if (node.name === "header" && !collectingHeader && !collectingOffer) {
      collectingHeader = true;
      headerDepth = 1;
      headerXml = startTagToXml(node);
      return;
    }

    if (collectingHeader) {
      headerDepth += 1;
      headerXml += startTagToXml(node);
      return;
    }

    if (node.name === "oferta" && !collectingOffer) {
      rawOffersFound += 1;

      if (rawOffersFound <= 10 || rawOffersFound % 50 === 0) {
        console.log("[CRM DEBUG] Znaleziono tag <oferta>, numer:", rawOffersFound);
      }

      collectingOffer = true;
      offerDepth = 1;
      offerXml = startTagToXml(node);
      return;
    }

    if (collectingOffer) {
      offerDepth += 1;
      offerXml += startTagToXml(node);
    }
  });

  saxStream.on("text", (text: string) => {
    if (collectingHeader) {
      headerXml += escapeXmlText(text);
      return;
    }

    if (collectingOffer) {
      offerXml += escapeXmlText(text);
    }
  });

  saxStream.on("cdata", (text: string) => {
    if (collectingHeader) {
      headerXml += `<![CDATA[${text}]]>`;
      return;
    }

    if (collectingOffer) {
      offerXml += `<![CDATA[${text}]]>`;
    }
  });

  saxStream.on("closetag", (tagName: string) => {
    if (collectingHeader) {
      headerXml += `</${tagName}>`;
      headerDepth -= 1;

      if (headerDepth === 0) {
        collectingHeader = false;
        headerMeta = parseHeaderMeta(headerXml);
        console.log("[CRM DEBUG] Header:", headerMeta);
        headerXml = "";
      }

      return;
    }

    if (collectingOffer) {
      offerXml += `</${tagName}>`;
      offerDepth -= 1;

      if (offerDepth === 0) {
        collectingOffer = false;

        const completedOfferXml = offerXml;
        offerXml = "";

        if (typeof (xmlStream as { pause?: () => void }).pause === "function") {
          (xmlStream as { pause: () => void }).pause();
        }

        chain = chain
          .then(async () => {
            const parsed = parseOfferFragment(completedOfferXml, headerMeta);
            if (!parsed) return;

            importedOffers += 1;
            await onOffer(parsed);
          })
          .then(() => {
            if (!streamEnded && typeof (xmlStream as { resume?: () => void }).resume === "function") {
              (xmlStream as { resume: () => void }).resume();
            }
          });
      }
    }
  });

  const finishedPromise = new Promise<{ importedOffers: number; headerMeta: HeaderMeta }>((resolve, reject) => {
    saxStream.on("error", (error: unknown) => reject(error));
    xmlStream.on("error", (error: unknown) => reject(error));

    saxStream.on("end", () => {
      streamEnded = true;

      waitForChain()
        .then(() => {
          console.log(
            "[CRM DEBUG] Koniec parsowania. Znalezione <oferta>:",
            rawOffersFound,
            "Zaimportowane:",
            importedOffers
          );
          resolve({
  importedOffers,
  headerMeta,
});
        })
        .catch(reject);
    });
  });

  xmlStream.pipe(saxStream);
  return finishedPromise;
}

function buildDzialkaDataFromOffer(offer: ParsedDomyOffer) {
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
  offer: ParsedDomyOffer,
  feedReader: FeedReader,
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

    if (!user) throw new Error("Nie znaleziono użytkownika integracji.");

    if (paymentsEnabled && user.listingCredits <= 0) {
      await prisma.crmIntegration.update({
        where: { id: integration.id },
        data: {
          lastErrorAt: now,
          lastErrorMessage: "Brak dostępnych publikacji do utworzenia oferty.",
        },
      });

      await logSync(integration.id, {
        externalId: offer.externalId,
        action: "SKIP_NO_CREDITS",
        status: "ERROR",
        message: "Brak dostępnych publikacji do utworzenia oferty.",
        payload: offer.payload,
      });

      return "SKIP_NO_CREDITS";
    }

    const uploadedPhotos = await uploadOfferPhotosToR2(
      integration.id,
      offer.externalId,
      offer.photoFileNames,
      feedReader
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
            note: `CRM publikacja oferty ${offer.externalId}`,
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
          message: "Oferta utworzona poprawnie z importu FTP/XML.",
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

    if (!user) throw new Error("Nie znaleziono użytkownika integracji.");

    if (paymentsEnabled && user.listingCredits <= 0) {
      await prisma.crmIntegration.update({
        where: { id: integration.id },
        data: {
          lastErrorAt: now,
          lastErrorMessage: "Brak dostępnych publikacji do reaktywacji oferty.",
        },
      });

      await logSync(integration.id, {
        dzialkaId: existingLink.dzialkaId,
        offerLinkId: existingLink.id,
        externalId: offer.externalId,
        action: "SKIP_NO_CREDITS",
        status: "ERROR",
        message: "Brak dostępnych publikacji do reaktywacji oferty.",
        payload: offer.payload,
      });

      return "SKIP_NO_CREDITS";
    }
  }

  const uploadedPhotos =
    offer.photoFileNames.length > 0
      ? await uploadOfferPhotosToR2(
          integration.id,
          offer.externalId,
          offer.photoFileNames,
          feedReader
        )
      : [];

  const shouldReplacePhotos = uploadedPhotos.length > 0;

  if (shouldReplacePhotos) {
    await removeExistingR2Photos(existingLink.dzialkaId);
  }

  await prisma.$transaction(async (tx) => {
    if (shouldReplacePhotos) {
      await tx.zdjecie.deleteMany({
        where: { dzialkaId: existingLink.dzialkaId },
      });
    }

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
        ...(shouldReplacePhotos
          ? {
              zdjecia: {
                create: uploadedPhotos,
              },
            }
          : {}),
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
          note: `CRM reaktywacja oferty ${offer.externalId}`,
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
          ? "Oferta reaktywowana poprawnie z importu FTP/XML."
          : "Oferta zaktualizowana poprawnie z importu FTP/XML.",
        payload: offer.payload,
      },
    });
  });

  return wasEnded ? "REACTIVATE" : "UPDATE";
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
          message: "Oferta zakończona, ponieważ nie wystąpiła w pełnym eksporcie.",
        },
      });
    });

    count += 1;
  }

  return count;
}

export async function syncCrmIntegrationNow(integrationId: string): Promise<SyncSummary> {
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
      expectedFilePattern: true,
      fullImportMode: true,
    },
  });

  if (!integration) throw new Error("Nie znaleziono integracji CRM.");
  if (!integration.isActive) throw new Error("Integracja jest wyłączona.");

  if (integration.transportType !== "FTP" || integration.feedFormat !== "DOMY_PL") {
    throw new Error("Ta integracja nie jest skonfigurowana jako FTP / DOMY.PL.");
  }

  const now = new Date();
  let downloadedFeeds: DownloadedFeed[] = [];
  let currentFeedReader: FeedReader | null = null;

  let importedOffers = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let deactivatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const processedFileNames: string[] = [];

  try {
    downloadedFeeds = await downloadNewFeedsFromFtp(integration);

    const appConfig = await prisma.appConfig.findFirst();
    const paymentsEnabled = appConfig?.paymentsEnabled ?? false;

    for (const downloaded of downloadedFeeds) {
      let fileImportedOffers = 0;
      let fileCreatedCount = 0;
      let fileUpdatedCount = 0;
      let fileDeactivatedCount = 0;
      let fileSkippedCount = 0;
      let fileErrorCount = 0;

      const seenExternalIds = new Set<string>();

      try {
        currentFeedReader = await openFeedReader(downloaded.localFilePath, downloaded.remoteFileName);
        const xmlStream = await currentFeedReader.createXmlReadStream();

        const parseResult = await streamParseDomyPlOffers(xmlStream, async (offer) => {
          importedOffers += 1;
          fileImportedOffers += 1;
          seenExternalIds.add(offer.externalId);

          try {
            const action = await processOffer(
              integration,
              offer,
              currentFeedReader as FeedReader,
              paymentsEnabled
            );

            if (action === "CREATE") {
              createdCount += 1;
              fileCreatedCount += 1;
            } else if (action === "UPDATE" || action === "REACTIVATE") {
              updatedCount += 1;
              fileUpdatedCount += 1;
            } else if (action === "SKIP_NO_CREDITS") {
              skippedCount += 1;
              fileSkippedCount += 1;
            }
          } catch (error) {
            errorCount += 1;
            fileErrorCount += 1;

            const message =
              error instanceof Error
                ? error.message
                : "Nieznany błąd podczas importu oferty.";

            await logSync(integration.id, {
              externalId: offer.externalId,
              action: "ERROR",
              status: "ERROR",
              message,
              payload: offer.payload,
            });
          }
        });

        const zawartoscPliku = normalizeText(parseResult.headerMeta.zawartoscPliku);

        const isFullExport =
          zawartoscPliku.includes("pelny") ||
          zawartoscPliku.includes("pełny") ||
          zawartoscPliku.includes("calosc") ||
          zawartoscPliku.includes("całość");

        if (integration.fullImportMode && isFullExport && seenExternalIds.size > 0) {
          const deactivated = await deactivateMissingOffers(integration.id, seenExternalIds);
          deactivatedCount += deactivated;
          fileDeactivatedCount += deactivated;
        }

        await prisma.crmProcessedFile.upsert({
          where: {
            integrationId_remoteFileName: {
              integrationId: integration.id,
              remoteFileName: downloaded.remoteFileName,
            },
          },
          create: {
            integrationId: integration.id,
            remoteFileName: downloaded.remoteFileName,
            fileSize: downloaded.fileSize,
            fileModifiedAt: downloaded.fileModifiedAt,
            status: fileErrorCount > 0 ? "ERROR" : "SUCCESS",
            importedOffers: fileImportedOffers,
            createdCount: fileCreatedCount,
            updatedCount: fileUpdatedCount,
            deactivatedCount: fileDeactivatedCount,
            skippedCount: fileSkippedCount,
            errorCount: fileErrorCount,
            message:
              fileErrorCount > 0
                ? `Plik przetworzony z błędami (${fileErrorCount}).`
                : "Plik przetworzony poprawnie.",
            processedAt: new Date(),
          },
          update: {
            fileSize: downloaded.fileSize,
            fileModifiedAt: downloaded.fileModifiedAt,
            status: fileErrorCount > 0 ? "ERROR" : "SUCCESS",
            importedOffers: fileImportedOffers,
            createdCount: fileCreatedCount,
            updatedCount: fileUpdatedCount,
            deactivatedCount: fileDeactivatedCount,
            skippedCount: fileSkippedCount,
            errorCount: fileErrorCount,
            message:
              fileErrorCount > 0
                ? `Plik przetworzony z błędami (${fileErrorCount}).`
                : "Plik przetworzony poprawnie.",
            processedAt: new Date(),
          },
        });

        processedFileNames.push(downloaded.remoteFileName);
      } catch (error) {
        errorCount += 1;
        fileErrorCount += 1;

        const message =
          error instanceof Error
            ? error.message
            : "Nie udało się przetworzyć pliku CRM.";

        await prisma.crmProcessedFile.upsert({
          where: {
            integrationId_remoteFileName: {
              integrationId: integration.id,
              remoteFileName: downloaded.remoteFileName,
            },
          },
          create: {
            integrationId: integration.id,
            remoteFileName: downloaded.remoteFileName,
            fileSize: downloaded.fileSize,
            fileModifiedAt: downloaded.fileModifiedAt,
            status: "ERROR",
            importedOffers: fileImportedOffers,
            createdCount: fileCreatedCount,
            updatedCount: fileUpdatedCount,
            deactivatedCount: fileDeactivatedCount,
            skippedCount: fileSkippedCount,
            errorCount: fileErrorCount,
            message,
            processedAt: new Date(),
          },
          update: {
            fileSize: downloaded.fileSize,
            fileModifiedAt: downloaded.fileModifiedAt,
            status: "ERROR",
            importedOffers: fileImportedOffers,
            createdCount: fileCreatedCount,
            updatedCount: fileUpdatedCount,
            deactivatedCount: fileDeactivatedCount,
            skippedCount: fileSkippedCount,
            errorCount: fileErrorCount,
            message,
            processedAt: new Date(),
          },
        });

        await logSync(integration.id, {
          action: "ERROR",
          status: "ERROR",
          message: `Błąd pliku ${downloaded.remoteFileName}: ${message}`,
        });
      } finally {
        if (currentFeedReader) {
          await currentFeedReader.close().catch(() => {});
          currentFeedReader = null;
        }
      }
    }

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: {
        lastUsedAt: now,
        lastSyncAt: now,
        lastSuccessAt: now,
        lastErrorAt: errorCount > 0 || importedOffers === 0 ? now : null,
        lastErrorMessage:
          errorCount > 0
            ? `Synchronizacja zakończona z błędami (${errorCount}).`
            : skippedCount > 0
              ? `Synchronizacja zakończona. Pominięto ${skippedCount} ofert z powodu braku kredytów.`
              : importedOffers === 0
                ? "Synchronizacja zakończona, ale parser nie zaimportował żadnej oferty. Sprawdź logi [CRM DEBUG] w Vercel."
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
      remoteFileName:
        processedFileNames.join(", ") ||
        downloadedFeeds.map((file) => file.remoteFileName).join(", ") ||
        "BRAK_PLIKOW",
      importedOffers,
      createdCount,
      updatedCount,
      deactivatedCount,
      skippedCount,
      errorCount,
      message:
        errorCount > 0
          ? "Synchronizacja zakończona z częściowymi błędami."
          : importedOffers === 0
            ? "Synchronizacja zakończona, ale nie znaleziono poprawnych ofert działek. Sprawdź logi [CRM DEBUG] w Vercel."
            : `Synchronizacja zakończona poprawnie. Przetworzono pliki: ${processedFileNames.length}.`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nie udało się zsynchronizować integracji.";

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
    await Promise.all(
      downloadedFeeds.map((feed) => feed.cleanup().catch(() => {}))
    );
  }
}