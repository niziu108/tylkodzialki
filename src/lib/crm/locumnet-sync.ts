import crypto from "crypto";
import path from "path";
import os from "os";
import fs from "fs";
import { promises as fsp } from "fs";
import * as ftp from "basic-ftp";
import unzipper from "unzipper";
import { XMLParser } from "fast-xml-parser";
import {
  DojazdStatus,
  GazStatus,
  KanalizacjaStatus,
  LocationMode,
  PradStatus,
  Prisma,
  Przeznaczenie,
  WodaStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { payloadForLog } from "@/lib/crm/log-policy";
import { mapDojazd } from "@/lib/dojazd";
import { uploadBufferToR2 } from "@/lib/r2";
import { appendPhotoNote, planPhotoRefresh, refreshOfferPhotos, type UploadedPhoto } from "@/lib/crm/photo-refresh";
import { deleteR2Photos, discardUnsavedPhotos, r2PhotoEffects, swapOfferPhotos } from "@/lib/crm/offer-photos";
import { repairAreaFromHectares } from "@/lib/crm/area-sanity";
import { sanitizePlCoords } from "@/lib/geo";
import { deactivateOffersMissingFromFullExport } from "@/lib/crm/deactivate-missing";
import {
  isStaleOfferVersion,
  resolveFeedSignals,
  type DeleteSignal,
  type OfferSignal,
} from "@/lib/crm/feed-signals";
import { xmlIntegrityProblem } from "@/lib/crm/xml-integrity";
import { isEmptyDirectoryAlarm } from "@/lib/crm/integration-health";

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
  dojazd: DojazdStatus;
  mpzp: boolean;
  wzWydane: boolean;
  ksiegaWieczysta: string | null;
  wymiary: string | null;
  payload: Prisma.InputJsonValue;
};

/**
 * Oferta odrzucona przez parser (jak w asari-sync). NOT_LAND: nie działka albo nie sprzedaż.
 * INVALID: działka, której chwilowo brakuje ceny, powierzchni albo lokalizacji. Przy pełnym
 * eksporcie nadal JEST w eksporcie biura, więc nie może zniknąć jako „nieobecna": zostaje
 * z ostatnią poprawną wersją.
 */
type LocumnetRejectedOffer = { rejected: "NOT_LAND" | "INVALID"; externalId: string };

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

/** Plik ofert razem z datą źródłowej paczki: bez niej nie da się rozstrzygnąć removed/mlssta vs oferta. */
type LocumnetOfferXmlFile = {
  localPath: string;
  /** Data modyfikacji ZIP-a (albo luźnego XML-a) na FTP w ms. 0 = serwer jej nie podał. */
  modifiedAtMs: number;
};

type DownloadedLocumnetFeed = {
  remoteFileName: string;
  tempDir: string;
  offerXmlFiles: LocumnetOfferXmlFile[];
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
  /** Działki obecne w pliku, ale odrzucone za niekompletne dane (patrz LocumnetRejectedOffer). */
  invalidLandExternalIds: string[];
  isFullExport: boolean;
  rawCount: number;
};

function parseLocumnetOffer(
  rawOffer: Record<string, unknown>,
  agencyName: string | null,
  photoFileNamesByExternalId: Map<string, string[]>
): LocumnetOffer | LocumnetRejectedOffer | null {
  const externalId = toTextValue(rawOffer.idof);

  if (!externalId) {
    console.log("[LOCUMNET DEBUG] Odrzucono ofertę: brak idof.");
    return null;
  }

  const typnieCode = attrCode(rawOffer.typnie);
  const typnieLabel = toTextValue(rawOffer.typnie);

  if (!isLandOffer(typnieCode, typnieLabel)) {
    console.log("[LOCUMNET DEBUG] Odrzucono:", externalId, "to nie jest działka.", typnieLabel || typnieCode);
    return { rejected: "NOT_LAND", externalId };
  }

  const typof = normalizeText(toTextValue(rawOffer.typof));
  if (typof && !typof.includes("sprzed")) {
    console.log("[LOCUMNET DEBUG] Odrzucono:", externalId, "transakcja nie jest sprzedażą.", typof);
    return { rejected: "NOT_LAND", externalId };
  }

  const price = toNumber(rawOffer.cmin);
  const area = toNumber(rawOffer.pocmin);

  if (!price || price <= 0) {
    console.log("[LOCUMNET DEBUG] Odrzucono:", externalId, "brak ceny.");
    return { rejected: "INVALID", externalId };
  }

  if (!area || area < 1) {
    console.log("[LOCUMNET DEBUG] Odrzucono:", externalId, "brak powierzchni.");
    return { rejected: "INVALID", externalId };
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
    return { rejected: "INVALID", externalId };
  }

  const rawLat = toNumber(rawOffer.geoszer);
  const rawLng = toNumber(rawOffer.geodlu);
  // Bramka jakości: współrzędne muszą leżeć w Polsce i zgadzać się z województwem
  // z feedu (kontrola krzyżowa łapie miejscowości-imienniczki z drugiego końca kraju).
  // LocumNet daje geo prosto w feedzie — celowo NIE geokodujemy (koszty API), więc
  // odrzucona oferta po prostu nie dostaje pinu i zostaje na liście.
  const plCoords = sanitizePlCoords(rawLat, rawLng, province);
  if ((rawLat != null || rawLng != null) && !plCoords) {
    console.log("[LOCUMNET GEO] Odrzucono współrzędne (poza PL lub niezgodne z województwem):", province, rawLat, rawLng);
  }
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

  // LocumNet skraca nazwy pól (medele, medwod, medgaz, medkan), więc drogi szukamy pod kilkoma
  // wariantami. Nieznane pole = BRAK_INFORMACJI, czyli oferta po prostu nie wejdzie do filtra.
  const dojazd = mapDojazd(
    toTextValue(rawOffer.droga) ||
      toTextValue(rawOffer.dojazd) ||
      toTextValue(rawOffer.dojazdow) ||
      toTextValue(rawOffer.naw)
  );

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
    // Bramka na hektary w polu metrów: patrz area-sanity.ts
    areaM2: repairAreaFromHectares(Math.round(area), `${title} ${description}`),
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
    dojazd,
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
  const invalidLandExternalIds: string[] = [];
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
    if (!parsed) continue;

    if ("rejected" in parsed) {
      if (parsed.rejected === "INVALID") invalidLandExternalIds.push(parsed.externalId);
      continue;
    }

    offers.push(parsed);
  }

  // Sekcja <removed>: oferty zdjęte od poprzedniego eksportu. Placeholder "0" pomijamy.
  const removedNode = (root.removed ?? {}) as Record<string, unknown>;
  for (const removedIdofNode of arrify(removedNode.idof)) {
    const removedId = toTextValue(removedIdofNode);
    if (removedId && removedId !== "0") deletedExternalIds.push(removedId);
  }

  return { offers, deletedExternalIds, invalidLandExternalIds, isFullExport, rawCount };
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
  /** Data paczki, z której pochodzi dany plik XML (ms). Ustala chronologię removed/mlssta vs oferta. */
  const xmlModifiedMsByBasename = new Map<string, number>();
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

    // Luźne pliki obok ZIP-ów (gdyby biuro wgrało XML/zdjęcia bez paczki).
    const directXmlFiles = files.filter((item) => item.name.toLowerCase().endsWith(".xml"));
    const directImageFiles = files.filter((item) => /\.(jpe?g|png|webp|avif)$/i.test(item.name));

    // Pusty katalog to alarm tylko u integracji, która ma już oferty (isEmptyDirectoryAlarm). Nowe
    // biuro dostaje katalog przed pierwszym eksportem i do tego czasu czeka bez błędu.
    const offerFilesInDirectory = zipFiles.length + directXmlFiles.length;

    if (offerFilesInDirectory === 0) {
      const offerLink = await prisma.crmOfferLink.findFirst({
        where: { integrationId: integration.id },
        select: { id: true },
      });

      if (isEmptyDirectoryAlarm({ offerFilesInDirectory, hasOfferLink: offerLink !== null })) {
        throw new Error(
          `Nie znaleziono żadnego pliku ZIP/XML w katalogu ${remoteDir}, a integracja ma już oferty w bazie. Bez paczek z CRM te oferty nie są aktualizowane.`
        );
      }
    }

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
        if (!localFileByBasename.has(base)) {
          localFileByBasename.set(base, file);
          // Plik XML dziedziczy datę swojej paczki: to ona ustawia chronologię sygnałów.
          if (isOfferXmlBasename(base)) xmlModifiedMsByBasename.set(base, zip.modifiedAt?.getTime() ?? 0);
        }

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

    for (const file of directXmlFiles) {
      const localPath = path.join(tempDir, "direct", file.remotePath);
      await downloadFile(client, file.remotePath, localPath);
      localFileByBasename.set(safeBasename(file.name), localPath);
      xmlModifiedMsByBasename.set(safeBasename(file.name), file.modifiedAt?.getTime() ?? 0);
    }

    for (const file of directImageFiles) {
      imageRemotePathByBasename.set(safeBasename(file.name), file.remotePath);
    }

    // Rosnąco po dacie paczki, jak w esticrm-sync: przy sprzecznych sygnałach (oferta w jednej paczce,
    // removed/mlssta w drugiej) decyduje nowsza, patrz resolveFeedSignals. Nazwy mają timestamp
    // (export2026-07-23-14-27-01.xml), więc przy remisie dat kolejność po nazwie dalej jest chronologiczna.
    const offerXmlFiles: LocumnetOfferXmlFile[] = [...localFileByBasename.entries()]
      .filter(([basename]) => isOfferXmlBasename(basename))
      .map(([basename, localPath]) => ({
        localPath,
        modifiedAtMs: xmlModifiedMsByBasename.get(basename) ?? 0,
      }))
      .sort(
        (a, b) =>
          a.modifiedAtMs - b.modifiedAtMs ||
          path.basename(a.localPath).localeCompare(path.basename(b.localPath))
      );

    if (!zipFiles[0] && offerXmlFiles[0]) {
      remoteFileName = path.basename(offerXmlFiles[0].localPath);
    }

    console.log("[LOCUMNET DEBUG] Pobrane pliki XML ofert (od najstarszej paczki):", offerXmlFiles.map((file) => path.basename(file.localPath)));
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

/** Czy plik zdjęcia jest w paczce albo na FTP. Bez pobierania, patrz photo-refresh.ts. */
function hasLocumnetPhoto(downloaded: DownloadedLocumnetFeed, originalName: string) {
  const basename = safeBasename(originalName);
  return (
    downloaded.localFileByBasename.has(basename) ||
    downloaded.downloadedPhotoByBasename.has(basename) ||
    downloaded.imageRemotePathByBasename.has(basename)
  );
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
  const uploaded: UploadedPhoto[] = [];

  try {
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
  } catch (error) {
    // Wgrane w tym wywołaniu nie mają jeszcze wiersza w bazie, więc nic na portalu ich nie pokazuje.
    await deleteR2Photos(uploaded.map((photo) => photo.publicId), "[LOCUMNET]");
    throw error;
  }

  return uploaded;
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
    dojazd: offer.dojazd,
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
      // Payload tylko tam, gdzie ratuje śledztwo — reguła i powód w log-policy.ts.
      payload: payloadForLog(input.action, input.status, input.payload),
    },
  });
}

async function processOffer(
  integration: IntegrationForSync,
  offer: LocumnetOffer,
  downloaded: DownloadedLocumnetFeed,
  paymentsEnabled: boolean
): Promise<"CREATE" | "UPDATE" | "REACTIVATE" | "SKIP_NO_CREDITS" | "SKIP_STALE"> {
  const now = new Date();
  const expiresAt = null;

  const existingLink = await prisma.crmOfferLink.findUnique({
    where: { integrationId_externalId: { integrationId: integration.id, externalId: offer.externalId } },
    include: { dzialka: true },
  });

  // Wersja starsza niż zapisana (np. nowsza paczka pominięta jako uszkodzona) nie nadpisuje danych
  // i nie reaktywuje oferty. Szczegóły w isStaleOfferVersion (feed-signals.ts).
  if (existingLink && isStaleOfferVersion(offer.externalUpdatedAt, existingLink.externalUpdatedAt)) {
    return "SKIP_STALE";
  }

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

    try {
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
    } catch (error) {
      // Oferta nie powstała, więc do wgranych zdjęć nie prowadzi żaden wiersz. Bez sprzątania każdy
      // kolejny nieudany przebieg dokładałby do R2 komplet tych samych plików.
      await discardUnsavedPhotos(uploadedPhotos, "[LOCUMNET]");
      throw error;
    }

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

  // Zdjęcia: czy wymieniać galerię, rozstrzyga photo-refresh.ts (strażnik re-uploadu, brakujące
  // pliki). refreshOfferPhotos pilnuje kolejności: wgranie nowych, ta transakcja, dopiero po commicie
  // kasowanie starych obiektów R2.
  const photoPlan = planPhotoRefresh({
    wasEnded,
    storedUpdatedAt: existingLink.externalUpdatedAt,
    incomingUpdatedAt: offer.externalUpdatedAt,
    existingPhotoCount: await prisma.zdjecie.count({ where: { dzialkaId: existingLink.dzialkaId } }),
    feedPhotoNames: offer.photoFileNames,
    isAvailable: (photoName) => hasLocumnetPhoto(downloaded, photoName),
  });

  await refreshOfferPhotos({
    plan: photoPlan,
    label: `[LOCUMNET] Oferta ${offer.externalId}`,
    upload: () => uploadOfferPhotosToR2(integration, downloaded, offer.externalId, offer.photoFileNames),
    effects: r2PhotoEffects("[LOCUMNET]"),
    save: (photos) =>
      prisma.$transaction(async (tx) => {
        // Wiersz działki pierwszy: jego blokada szereguje równoległe przebiegi (swapOfferPhotos).
        const dzialka = await tx.dzialka.update({
          where: { id: existingLink.dzialkaId },
          data: {
            ...buildDzialkaDataFromOffer(offer),
            ...(wasEnded ? { publishedAt: now, expiresAt, endedAt: null, status: "AKTYWNE" as const } : {}),
          },
        });

        const replacedPhotoKeys = photos.replace ? await swapOfferPhotos(tx, dzialka.id, photos.photos) : [];

        await tx.crmOfferLink.update({
          where: { id: existingLink.id },
          data: {
            // Data wersji tylko przy galerii zgodnej z feedem, inaczej strażnik zamroziłby starą galerię.
            externalUpdatedAt: photos.syncedWithFeed ? offer.externalUpdatedAt : existingLink.externalUpdatedAt,
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
            message: appendPhotoNote(
              wasEnded ? "Oferta reaktywowana poprawnie z importu LocumNet." : "Oferta zaktualizowana poprawnie z importu LocumNet.",
              photos.note
            ),
            payload: offer.payload,
          },
        });

        return replacedPhotoKeys;
      }),
  });

  return wasEnded ? "REACTIVATE" : "UPDATE";
}

async function deactivateExternalId(integrationId: string, externalId: string, reason = "Oferta zakończona na podstawie sekcji removed / statusu mlssta z LocumNet."): Promise<"WYGASZONA" | "JUZ_WYGASZONA" | "NIEZNANA"> {
  const now = new Date();

  const link = await prisma.crmOfferLink.findUnique({
    where: { integrationId_externalId: { integrationId, externalId } },
    include: { dzialka: true },
  });

  if (!link) {
    // Sygnał o nieruchomości, której nie importujemy (mieszkania/domy) — patrz asari-sync.
    return "NIEZNANA";
  }

  // Sygnał usunięcia wraca w każdym przebiegu, dopóki wisi w feedzie. Oferta już wygaszona =
  // nie ma czego zmieniać (na produkcji 100% tych DELETE-ów było pustymi zapisami).
  if (!link.isActiveInSource && link.dzialka.status === "ZAKONCZONE") {
    return "JUZ_WYGASZONA";
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

  return "WYGASZONA";
}

// Wspólne wygaszanie z hamulcem udziału — szczegóły w deactivate-missing.ts.
async function deactivateMissingOffers(integrationId: string, seenExternalIds: Set<string>) {
  const result = await deactivateOffersMissingFromFullExport({
    integrationId,
    seenExternalIds,
    message: "Oferta zakończona, ponieważ nie wystąpiła w pełnym eksporcie LocumNet.",
    sourceLabel: "LOCUMNET",
  });

  return result.deactivated;
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
    /** Oferty pominięte, bo przyszły w wersji starszej niż zapisana (isStaleOfferVersion). */
    let staleCount = 0;

    const seenExternalIds = new Set<string>();
    const deletedExternalIds = new Set<string>();
    /** Sygnały DELETE dotyczące nieruchomości, których nie importujemy (mieszkania, domy, lokale). */
    let nieznaneDeleteCount = 0;
    let sawFullExport = false;

    if (downloaded.offerXmlFiles.length === 0) {
      console.log("[LOCUMNET DEBUG] Brak plików XML ofert.");
    }

    // Biuro LocumNet przysyła paczki z kompletem ofert, ale z FullExport=False (lno_200 z 23.07.2026),
    // więc pętla wyboru bierze wszystkie ZIP-y leżące na FTP i ta sama oferta pojawia się w wielu
    // plikach. Scalamy do NAJNOWSZEJ wersji per externalId (po daom) i przetwarzamy raz.
    //
    // Usunięcia (sekcja removed i mlssta > 2) zbieramy razem z datą paczki i rozstrzygamy
    // chronologicznie, jak w asari/esticrm: usunięcie ze starej paczki nie może ubić działki,
    // którą biuro wystawiło ponownie w nowszej. Wcześniej wygrywało każde usunięcie z dowolnego pliku.
    const offerSignals: OfferSignal<LocumnetOffer>[] = [];
    const deleteSignals: DeleteSignal[] = [];
    /** Pliki pominięte jako uszkodzone. Przy choćby jednym nie wygaszamy brakujących ofert. */
    const brokenOfferFiles: string[] = [];
    const invalidLandExternalIds = new Set<string>();

    for (const offerXmlFile of downloaded.offerXmlFiles) {
      const fileName = path.basename(offerXmlFile.localPath);
      const xml = await fsp.readFile(offerXmlFile.localPath, "utf8");

      // Plik urwany albo ucięty przez CRM parser przyjąłby po cichu jako krótszy (xml-integrity.ts).
      // Pomijamy go w całości: oferty i usunięcia z niego wejdą, gdy będzie kompletny.
      const integrityProblem = xmlIntegrityProblem(xml);
      if (integrityProblem) {
        brokenOfferFiles.push(`${fileName} (${integrityProblem})`);
        console.warn(`[LOCUMNET] Pomijam uszkodzony plik ofert ${fileName}: ${integrityProblem}`);
        continue;
      }

      const result = parseOfferXmlFile(xml, integration.name);

      if (result.isFullExport) sawFullExport = true;
      rawOffersCount += result.rawCount;

      for (const externalId of result.invalidLandExternalIds) invalidLandExternalIds.add(externalId);

      for (const externalId of result.deletedExternalIds) {
        deleteSignals.push({ externalId, fileAt: offerXmlFile.modifiedAtMs });
      }

      for (const offer of result.offers) {
        offerSignals.push({ externalId: offer.externalId, offer, fileAt: offerXmlFile.modifiedAtMs });
      }
    }

    if (brokenOfferFiles.length > 0) {
      errorCount += brokenOfferFiles.length;
      await logSync(integration.id, {
        action: "ERROR",
        status: "ERROR",
        message:
          `Pominięto uszkodzone pliki ofert LocumNet: ${brokenOfferFiles.join("; ")}. ` +
          "Oferty i usunięcia z nich wejdą, gdy plik będzie kompletny. W tym przebiegu nie wygaszam ofert nieobecnych w pełnym eksporcie.",
      });
    }

    const resolved = resolveFeedSignals(offerSignals, deleteSignals, isSameOrNewerOffer);
    const dedupedOffers = resolved.offers;

    for (const externalId of resolved.deletedExternalIds) deletedExternalIds.add(externalId);

    console.log(`[LOCUMNET DEBUG] Oferty po deduplikacji (najnowsza wersja per externalId): ${dedupedOffers.length}`);

    if (resolved.ignoredDeletes.length > 0) {
      console.log(
        `[LOCUMNET DEBUG] Pominięto ${resolved.ignoredDeletes.length} nieaktualnych usunięć (działka wróciła w nowszej paczce):`,
        resolved.ignoredDeletes.slice(0, 20)
      );
    }

    for (const offer of dedupedOffers) {
      importedOffers += 1;
      seenExternalIds.add(offer.externalId);

      try {
        const action = await processOffer(integration, offer, downloaded, paymentsEnabled);

        if (action === "CREATE" || action === "REACTIVATE") createdCount += 1;
        else if (action === "UPDATE") updatedCount += 1;
        else if (action === "SKIP_NO_CREDITS") skippedCount += 1;
        else if (action === "SKIP_STALE") staleCount += 1;
      } catch (error) {
        errorCount += 1;
        const message = error instanceof Error ? error.message : "Nieznany błąd podczas importu oferty LocumNet.";
        console.error("[LOCUMNET DEBUG] Błąd zapisu oferty:", offer.externalId, message, error);

        await logSync(integration.id, { externalId: offer.externalId, action: "ERROR", status: "ERROR", message, payload: offer.payload });
      }
    }

    for (const externalId of deletedExternalIds) {
      try {
        const wynik = await deactivateExternalId(integration.id, externalId);
        if (wynik === "WYGASZONA") deactivatedCount += 1;
        else if (wynik === "NIEZNANA") nieznaneDeleteCount += 1;
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

    if (nieznaneDeleteCount > 0) {
      console.log(
        `[LOCUMNET DEBUG] Sygnałów DELETE spoza naszej podaży (mieszkania/domy/lokale, nie mamy ich w bazie): ${nieznaneDeleteCount}`
      );
    }

    if (staleCount > 0) {
      console.log(`[LOCUMNET DEBUG] Pominięto ${staleCount} ofert w wersji starszej niż zapisana w bazie.`);
    }

    // Deaktywacja brakujących tylko, gdy w zestawie był PEŁNY eksport — wtedy seenExternalIds
    // pokrywa komplet aktywnych ofert biura (pełny + nowsze przyrostowe zmiany). Działka odrzucona
    // za niekompletne dane jest w eksporcie, więc liczy się jako obecna. Uszkodzony plik = niepełna
    // lista obecnych, więc wtedy nic nie gasimy (kolejny przebieg spróbuje znowu).
    if (integration.fullImportMode && sawFullExport && seenExternalIds.size > 0 && brokenOfferFiles.length === 0) {
      deactivatedCount += await deactivateMissingOffers(
        integration.id,
        new Set([...seenExternalIds, ...invalidLandExternalIds])
      );
    } else {
      console.log("[LOCUMNET DEBUG] Nie kończę brakujących ofert. Dezaktywacja tylko przy removed/mlssta albo kompletnym pełnym eksporcie.", { sawFullExport, seen: seenExternalIds.size, broken: brokenOfferFiles.length });
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
