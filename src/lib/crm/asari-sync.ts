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


type AsariDefinitions = {
  byId: Map<string, string>;
  byNormalizedName: Map<string, string[]>;
};

function normalizeFieldName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function emptyDefinitions(): AsariDefinitions {
  return {
    byId: new Map<string, string>(),
    byNormalizedName: new Map<string, string[]>(),
  };
}

function parseDefinitionsXml(xml: string): AsariDefinitions {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const definitions = emptyDefinitions();
  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = (doc.definitions ?? doc.DEFINITIONS ?? doc) as Record<string, unknown>;
  const parametersNode = root.parameters as Record<string, unknown> | undefined;

  for (const item of arrify(parametersNode?.p)) {
    if (!item || typeof item !== "object") continue;

    const p = item as Record<string, unknown>;
    const id = String(p.id ?? p["@_id"] ?? "").trim();
    const name = toTextValue(p.name);

    if (!id || !name) continue;

    definitions.byId.set(id, name);

    const normalizedName = normalizeFieldName(name);
    const list = definitions.byNormalizedName.get(normalizedName) ?? [];
    list.push(id);
    definitions.byNormalizedName.set(normalizedName, list);
  }

  console.log("[ASARI DEBUG] Wczytano definicje pól:", definitions.byId.size);
  return definitions;
}

function getParamByIds(params: Record<string, unknown>, ids: string[]) {
  for (const id of ids) {
    const value = params[id];
    const text = toTextValue(value);
    if (text) return value;
  }

  return null;
}

function getParamByName(
  params: Record<string, unknown>,
  definitions: AsariDefinitions,
  nameIncludes: string[],
  fallbackIds: string[] = []
) {
  const normalizedNeedles = nameIncludes.map(normalizeFieldName).filter(Boolean);

  for (const [id, rawName] of definitions.byId.entries()) {
    const normalizedName = normalizeFieldName(rawName);

    if (normalizedNeedles.every((needle) => normalizedName.includes(needle))) {
      const value = params[id];
      if (toTextValue(value)) return value;
    }
  }

  return getParamByIds(params, fallbackIds);
}

function getNumberByName(
  params: Record<string, unknown>,
  definitions: AsariDefinitions,
  nameIncludes: string[],
  fallbackIds: string[] = []
) {
  const byName = getParamByName(params, definitions, nameIncludes, []);
  const numberByName = toNumber(byName);
  if (numberByName != null) return numberByName;

  for (const id of fallbackIds) {
    const parsed = toNumber(params[id]);
    if (parsed != null) return parsed;
  }

  return null;
}

function getTextByName(
  params: Record<string, unknown>,
  definitions: AsariDefinitions,
  nameIncludes: string[],
  fallbackIds: string[] = []
) {
  const byName = toTextValue(getParamByName(params, definitions, nameIncludes, []));
  if (byName) return byName;

  return toTextValue(getParamByIds(params, fallbackIds));
}


type DownloadedAsariFeed = {
  remoteFileName: string;
  tempDir: string;
  offerXmlFiles: string[];
  localFileByBasename: Map<string, string>;
  definitions: AsariDefinitions;
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

function safeBasename(value: string) {
  return path.basename(value.replace(/\\/g, "/")).toLowerCase();
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

function isLikelyLandOffer(params: Record<string, unknown>, definitions: AsariDefinitions) {
  const categoryText = [
    getTextByName(params, definitions, ["typ", "nieruchomosci"], ["17", "18"]),
    getTextByName(params, definitions, ["rodzaj"], ["18"]),
    getTextByName(params, definitions, ["przeznaczenie"], ["44"]),
    getTextByName(params, definitions, ["powierzchnia", "dzialki"], ["61", "128"]),
  ]
    .join(" ")
    .toLowerCase();

  return Boolean(
    categoryText.includes("dzial") ||
      categoryText.includes("grunt") ||
      categoryText.includes("land") ||
      toTextValue(params["61"]) ||
      toTextValue(params["128"])
  );
}

function parseAsariOffer(
  rawOffer: Record<string, unknown>,
  agencyName: string | null,
  definitions: AsariDefinitions
): AsariOffer | null {
  const externalId = toTextValue(rawOffer.signature);

  if (!externalId) {
    console.log("[ASARI DEBUG] Odrzucono ofertę: brak signature.");
    return null;
  }

  const params = parseParams(rawOffer.parameters);

  if (!isLikelyLandOffer(params, definitions)) {
    console.log("[ASARI DEBUG] Odrzucono:", externalId, "to nie wygląda na działkę.");
    return null;
  }

  const price =
    getNumberByName(params, definitions, ["cena", "pln"], ["10"]) ??
    getNumberByName(params, definitions, ["cena"], ["10"]);

  const area =
    getNumberByName(params, definitions, ["powierzchnia", "dzialki"], ["61", "128"]) ??
    getNumberByName(params, definitions, ["powierzchnia"], ["61", "128"]);

  const wojewodztwo = getTextByName(params, definitions, ["wojewodztwo"], ["45", "190"]) || null;
  const powiat = getTextByName(params, definitions, ["powiat"], ["46", "191"]) || null;
  const gmina = getTextByName(params, definitions, ["gmina"], ["47", "192"]) || null;
  const miasto =
    getTextByName(params, definitions, ["miejscowosc"], ["48", "193"]) ||
    getTextByName(params, definitions, ["miasto"], ["48", "193"]) ||
    null;
  const dzielnica = getTextByName(params, definitions, ["dzielnica"], ["49", "194"]) || null;
  const ulica = getTextByName(params, definitions, ["ulica"], ["195", "300"]) || null;

  if (!price || price <= 0) {
    console.log("[ASARI DEBUG] Odrzucono:", externalId, "brak ceny.", { cena: params["10"] });
    return null;
  }

  if (!area || area < 1) {
    console.log("[ASARI DEBUG] Odrzucono:", externalId, "brak powierzchni.", { powierzchnia: params["61"] ?? params["128"] });
    return null;
  }

  if (!miasto && !gmina && !powiat && !wojewodztwo) {
    console.log("[ASARI DEBUG] Odrzucono:", externalId, "brak lokalizacji.", {
      wojewodztwo,
      powiat,
      gmina,
      miasto,
    });
    return null;
  }

  const plotTypeRaw =
    getTextByName(params, definitions, ["przeznaczenie"], ["18", "44"]) ||
    getTextByName(params, definitions, ["rodzaj"], ["18"]) ||
    null;

  const planRaw =
    getTextByName(params, definitions, ["plan"], ["44"]) ||
    getTextByName(params, definitions, ["mpzp"], ["44"]) ||
    null;

  const titleRaw =
    getTextByName(params, definitions, ["tytul"], ["491"]) ||
    getTextByName(params, definitions, ["nazwa"], ["491"]);

  const description =
    toTextValue(rawOffer.description) ||
    getTextByName(params, definitions, ["opis"], ["64"]) ||
    null;

  const labelParts = [miasto, dzielnica].filter(Boolean);
  const locationLabel = labelParts.length > 0 ? labelParts.join(", ") : miasto || gmina || powiat || wojewodztwo;

  const fullParts = [ulica, miasto, dzielnica, gmina, powiat, wojewodztwo].filter(Boolean);
  const locationFull = fullParts.length > 0 ? fullParts.join(", ") : locationLabel;

  const lat =
    getNumberByName(params, definitions, ["szerokosc"], ["201", "205"]) ??
    getNumberByName(params, definitions, ["latitude"], ["201", "205"]);

  const lng =
    getNumberByName(params, definitions, ["dlugosc"], ["202", "206"]) ??
    getNumberByName(params, definitions, ["longitude"], ["202", "206"]);

  const mediaText = [
    getTextByName(params, definitions, ["media"], ["39"]),
    getTextByName(params, definitions, ["prad"], ["155"]),
    getTextByName(params, definitions, ["woda"], ["156"]),
    getTextByName(params, definitions, ["gaz"], ["157"]),
    getTextByName(params, definitions, ["kanalizacja"], []),
    description,
  ].join(" ");

  const width = getNumberByName(params, definitions, ["szerokosc", "dzialki"], ["57"]);
  const length = getNumberByName(params, definitions, ["dlugosc", "dzialki"], ["56"]);

  const email =
    normalizeEmail(
      getTextByName(params, definitions, ["email"], ["171", "475"]) ||
        getTextByName(params, definitions, ["mail"], ["171", "475"])
    ) || "kontakt@tylkodzialki.pl";

  const phone =
    normalizePhone(
      getTextByName(params, definitions, ["telefon"], ["170", "473"]) ||
        getTextByName(params, definitions, ["komorka"], ["170", "473"]) ||
        "000000000"
    );

  const biuroOpiekun =
    getTextByName(params, definitions, ["opiekun"], ["305", "471"]) ||
    getTextByName(params, definitions, ["agent"], ["305", "471"]) ||
    null;

  const photoFileNames = parsePictures(rawOffer.pictures);

  const prad = mapPrad(mediaText);
  const woda = mapWoda(mediaText);
  const kanalizacja = mapKanalizacja(mediaText);
  const gaz = mapGaz(mediaText);

  return {
    externalId,
    externalUpdatedAt:
      parseDate(getParamByName(params, definitions, ["data", "modyfikacji"], [])) ??
      parseDate(getParamByName(params, definitions, ["data", "aktualizacji"], [])) ??
      parseDate(params["3"]) ??
      parseDate(params["406"]) ??
      null,
    title: sanitizeTitle(titleRaw, miasto || gmina || powiat || "działka", plotTypeRaw),
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
      definitions: Object.fromEntries(definitions.byId.entries()),
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
  let definitions = emptyDefinitions();

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
      if (cfg.definitionsFileName) {
        const definitionRemoteName = cfg.definitionsFileName;
        const definitionFile = xmlFiles.find((item) => safeBasename(item.name) === safeBasename(definitionRemoteName));

        if (definitionFile) {
          const definitionLocalPath = path.join(tempDir, definitionFile.remotePath);
          await downloadFile(client, definitionFile.remotePath, definitionLocalPath);
          localFileByBasename.set(safeBasename(definitionFile.name), definitionLocalPath);

          const definitionsXml = await fsp.readFile(definitionLocalPath, "utf8");
          definitions = parseDefinitionsXml(definitionsXml);
        } else {
          console.log("[ASARI DEBUG] CFG wskazuje definicje, ale nie znaleziono pliku:", definitionRemoteName);
        }
      }

    } else {
      console.log("[ASARI DEBUG] Nie znaleziono pliku *_CFG.xml. Używam fallbacku po *_001.xml.");
    }

    if (definitions.byId.size === 0) {
      const fallbackDefinitionFile = xmlFiles.find((item) =>
        ["definictions.xml", "definitions.xml"].includes(safeBasename(item.name))
      );

      if (fallbackDefinitionFile) {
        const definitionLocalPath = path.join(tempDir, fallbackDefinitionFile.remotePath);
        await downloadFile(client, fallbackDefinitionFile.remotePath, definitionLocalPath);
        localFileByBasename.set(safeBasename(fallbackDefinitionFile.name), definitionLocalPath);

        const definitionsXml = await fsp.readFile(definitionLocalPath, "utf8");
        definitions = parseDefinitionsXml(definitionsXml);
      }
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
      definitions,
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

function parseOfferXmlFile(xml: string, agencyName: string | null, definitions: AsariDefinitions) {
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
      return parseAsariOffer(offerNode as Record<string, unknown>, agencyName, definitions);
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
      const result = parseOfferXmlFile(xml, integration.name, downloaded.definitions);

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