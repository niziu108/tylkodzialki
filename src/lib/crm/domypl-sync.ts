import crypto from "crypto";
import path from "path";
import { PassThrough } from "stream";
import AdmZip from "adm-zip";
import * as ftp from "basic-ftp";
import {
  CrmFeedFormat,
  CrmProvider,
  CrmTransportType,
  GazStatus,
  LocationMode,
  PradStatus,
  Przeznaczenie,
  Prisma,
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
  prad: PradStatus;
  gaz: GazStatus;
  photoFileNames: string[];
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

function isTruthy(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["1", "t", "tak", "true", "yes"].includes(text);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
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

    const lineValues = arrify(obj.linia)
      .map((line) => toTextValue(line))
      .filter(Boolean);

    if (lineValues.length > 0) {
      return lineValues.join("\n").trim();
    }

    if (typeof obj["#text"] === "string") {
      return obj["#text"].trim();
    }

    if (typeof obj["text"] === "string") {
      return obj["text"].trim();
    }
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

  if (
    text.includes("budowl") ||
    text.includes("jednorodzin") ||
    text.includes("wielorodzin")
  ) {
    result.add("BUDOWLANA");
  }

  if (text.includes("rol")) {
    result.add("ROLNA");
  }

  if (text.includes("les")) {
    result.add("LESNA");
  }

  if (text.includes("rekre")) {
    result.add("REKREACYJNA");
  }

  if (text.includes("siedl")) {
    result.add("SIEDLISKOWA");
  }

  if (
    text.includes("inwest") ||
    text.includes("komerc") ||
    text.includes("uslug") ||
    text.includes("przemys")
  ) {
    result.add("INWESTYCYJNA");
  }

  if (result.size === 0) {
    result.add("BUDOWLANA");
  }

  return [...result];
}

function mapPrad(params: Record<string, unknown>): PradStatus {
  const pradRaw = params.prad;
  const uzbrojenieRaw = toTextValue(params.uzbrojenie).toLowerCase();

  if (isTruthy(pradRaw)) {
    return "PRZYLACZE_NA_DZIALCE";
  }

  if (uzbrojenieRaw.includes("prąd") || uzbrojenieRaw.includes("prad")) {
    return "MOZLIWOSC_PRZYLACZENIA";
  }

  return "BRAK_PRZYLACZA";
}

function mapGaz(params: Record<string, unknown>): GazStatus {
  const maGazRaw = params.ma_gaz;
  const gazRaw = toTextValue(params.gaz).toLowerCase();

  if (isTruthy(maGazRaw)) {
    return "GAZ_NA_DZIALCE";
  }

  if (gazRaw.includes("dro")) {
    return "GAZ_W_DRODZE";
  }

  if (
    gazRaw.includes("tak") ||
    gazRaw.includes("jest") ||
    gazRaw.includes("miejski")
  ) {
    return "GAZ_NA_DZIALCE";
  }

  if (gazRaw.includes("możliw") || gazRaw.includes("mozliw")) {
    return "MOZLIWOSC_PODLACZENIA";
  }

  return "BRAK";
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
  return path.basename(value).toLowerCase();
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
  filesByName: Map<string, Buffer>
) {
  const uploaded: Array<{ url: string; publicId: string; kolejnosc: number }> = [];

  for (let index = 0; index < photoFileNames.length; index += 1) {
    const originalName = photoFileNames[index];
    const fileBuffer = filesByName.get(safeBasename(originalName));

    if (!fileBuffer) {
      continue;
    }

    const upload = await uploadBufferToR2({
      buffer: fileBuffer,
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

async function downloadFtpFileToBuffer(client: ftp.Client, remoteFilePath: string) {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  stream.on("data", (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  await client.downloadTo(stream, remoteFilePath);
  stream.end();

  return Buffer.concat(chunks);
}

async function downloadLatestFeedFromFtp(integration: IntegrationForSync) {
  if (!integration.ftpHost || !integration.ftpUsername || !integration.ftpPassword) {
    throw new Error("Integracja FTP nie ma uzupełnionych danych logowania.");
  }

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

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
    const pattern = integration.expectedFilePattern?.trim() || "oferty_*.zip";
    const regex = wildcardToRegExp(pattern);

    const matched = list
      .filter((item) => item.isFile && regex.test(item.name))
      .sort((a, b) => {
        const aTime = a.modifiedAt?.getTime?.() ?? 0;
        const bTime = b.modifiedAt?.getTime?.() ?? 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      });

    if (matched.length === 0) {
      throw new Error(
        `Nie znaleziono pliku pasującego do wzorca ${pattern} w katalogu ${remoteDir}.`
      );
    }

    const remoteFileName = matched[0].name;
    const remoteFilePath = remoteFileName;

    const buffer = await downloadFtpFileToBuffer(client, remoteFilePath);

    return {
      remoteFileName,
      buffer,
    };
  } finally {
    client.close();
  }
}

function extractFeed(buffer: Buffer, remoteFileName: string) {
  const lowerName = remoteFileName.toLowerCase();

  if (lowerName.endsWith(".xml")) {
    return {
      xml: buffer.toString("utf-8"),
      filesByName: new Map<string, Buffer>(),
    };
  }

  if (!lowerName.endsWith(".zip")) {
    throw new Error("Obsługiwane są tylko pliki ZIP lub XML.");
  }

  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const xmlEntry =
    entries.find((entry) => !entry.isDirectory && safeBasename(entry.entryName) === "oferty.xml") ||
    entries.find((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".xml"));

  if (!xmlEntry) {
    throw new Error("W paczce ZIP nie znaleziono pliku XML z ofertami.");
  }

  const filesByName = new Map<string, Buffer>();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const base = safeBasename(entry.entryName);
    filesByName.set(base, entry.getData());
  }

  return {
    xml: xmlEntry.getData().toString("utf-8"),
    filesByName,
  };
}

function parseHeaderDate(value: unknown): Date | null {
  const text = toTextValue(value);
  if (!text) return null;
  const date = new Date(text.replace(" ", "T"));
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

  const wojewodztwo =
    toTextValue(params.wojewodztwo) || areas["2"] || null;

  const miasto =
    toTextValue(params.miasto) || areas["4"] || null;

  const dzielnica =
    toTextValue(params.dzielnica) || areas["5"] || null;

  const okolica =
    toTextValue(params.okolica) || areas["6"] || null;

  const parts = [miasto, dzielnica, okolica].filter(Boolean);
  const locationLabel = parts.length > 0 ? parts.join(", ") : miasto;

  const fullParts = [miasto, dzielnica, okolica, wojewodztwo].filter(Boolean);
  const locationFull = fullParts.length > 0 ? fullParts.join(", ") : null;

  return {
    wojewodztwo,
    miasto,
    dzielnica,
    okolica,
    locationLabel,
    locationFull,
  };
}

function parseDomyPlOffers(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const plik = doc.plik as Record<string, unknown> | undefined;

  if (!plik) {
    throw new Error("Nieprawidłowa struktura XML: brak znacznika <plik>.");
  }

  const header = (plik.header ?? {}) as Record<string, unknown>;
  const zawartoscPliku = toTextValue(header.zawartosc_pliku).toLowerCase();

  if (zawartoscPliku && zawartoscPliku !== "calosc") {
    throw new Error(
      `Obsługujemy obecnie tylko eksport pełny (calosc). Otrzymano: ${zawartoscPliku}.`
    );
  }

  const headerDate = parseHeaderDate(header.data);
  const listaOfert = plik.lista_ofert as Record<string, unknown> | undefined;

  if (!listaOfert) {
    throw new Error("Nie znaleziono znacznika <lista_ofert>.");
  }

  const dzialy = arrify(listaOfert.dzial);
  const result: ParsedDomyOffer[] = [];

  for (const dzial of dzialy) {
    if (!dzial || typeof dzial !== "object") continue;

    const dzialNode = dzial as Record<string, unknown>;
    const tab = String(dzialNode.tab ?? "").trim().toLowerCase();
    const typ = String(dzialNode.typ ?? "").trim().toLowerCase();

    if (tab !== "dzialki") continue;
    if (typ && typ !== "sprzedaz") continue;

    const oferty = arrify(dzialNode.oferta);

    for (const oferta of oferty) {
      if (!oferta || typeof oferta !== "object") continue;
      const ofertaNode = oferta as Record<string, unknown>;

      const externalId = toTextValue(ofertaNode.id);
      if (!externalId) continue;

      const params = parseParams(ofertaNode);
      const location = parseLocation(ofertaNode, params);

      const price = toNumber(
        typeof ofertaNode.cena === "object" && ofertaNode.cena
          ? (ofertaNode.cena as Record<string, unknown>)["#text"] ?? ofertaNode.cena
          : ofertaNode.cena
      );

      const area = toNumber(params.powierzchnia);
      const email = normalizeEmail(toTextValue(params.agent_email));
      const phone = normalizePhone(
        toTextValue(params.agent_tel_kom) || toTextValue(params.agent_tel_biuro)
      );

      if (!price || price <= 0) continue;
      if (!area || area < 1) continue;
      if (!email) continue;
      if (!phone) continue;
      if (!location.wojewodztwo || !location.miasto) continue;

      const plotTypeRaw = toTextValue(params.typdzialki) || null;
      const title = sanitizeTitle(
        toTextValue(params.advertisement_text) || null,
        location.miasto,
        plotTypeRaw
      );

      const description = toTextValue(params.opis) || null;
      const lat = toNumber(params.n_geo_y);
      const lng = toNumber(params.n_geo_x);
      const mapsUrl = buildMapsUrl(lat, lng);

      const photoFileNames = Array.from({ length: 15 }, (_, index) =>
        toTextValue(params[`zdjecie${index + 1}`])
      ).filter(Boolean);

      result.push({
        externalId,
        externalUpdatedAt:
          parseHeaderDate(params.dataaktualizacji) ??
          parseHeaderDate(header.data) ??
          headerDate,
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
        prad: mapPrad(params),
        gaz: mapGaz(params),
        photoFileNames,
        payload: toInputJsonValue({
          externalId,
          plotTypeRaw,
          params,
      }),
    }
  }

  return result;
}

function buildDzialkaDataFromOffer(offer: ParsedDomyOffer) {
  return {
    tytul: offer.title,
    cenaPln: offer.pricePln,
    powierzchniaM2: offer.areaM2,
    email: offer.email,
    telefon: offer.phone,
    sprzedajacyTyp: "BIURO" as const,
    locationLabel: offer.locationLabel,
    locationFull: offer.locationFull,
    locationMode: "APPROX" as LocationMode,
    lat: offer.lat,
    lng: offer.lng,
    mapsUrl: offer.mapsUrl,
    przeznaczenia: offer.przeznaczenia,
    prad: offer.prad,
    gaz: offer.gaz,
    numerOferty: offer.externalId,
    opis: offer.description,
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
    action:
      | "CREATE"
      | "UPDATE"
      | "DEACTIVATE"
      | "REACTIVATE"
      | "SKIP_NO_CREDITS"
      | "DELETE"
      | "ERROR";
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
  filesByName: Map<string, Buffer>,
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

    if (!user) {
      throw new Error("Nie znaleziono użytkownika integracji.");
    }

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
      filesByName
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

    if (!user) {
      throw new Error("Nie znaleziono użytkownika integracji.");
    }

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

  await removeExistingR2Photos(existingLink.dzialkaId);

  const uploadedPhotos = await uploadOfferPhotosToR2(
    integration.id,
    offer.externalId,
    offer.photoFileNames,
    filesByName
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
        select: { listingCredits: true },
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

async function deactivateMissingOffers(
  integrationId: string,
  seenExternalIds: Set<string>
) {
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

  if (!integration) {
    throw new Error("Nie znaleziono integracji CRM.");
  }

  if (!integration.isActive) {
    throw new Error("Integracja jest wyłączona.");
  }

  if (integration.transportType !== "FTP" || integration.feedFormat !== "DOMY_PL") {
    throw new Error("Ta integracja nie jest skonfigurowana jako FTP / DOMY.PL.");
  }

  const now = new Date();

  try {
    const { remoteFileName, buffer } = await downloadLatestFeedFromFtp(integration);
    const extracted = extractFeed(buffer, remoteFileName);
    const offers = parseDomyPlOffers(extracted.xml);
    const appConfig = await prisma.appConfig.findFirst();
    const paymentsEnabled = appConfig?.paymentsEnabled ?? false;

    let createdCount = 0;
    let updatedCount = 0;
    let deactivatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const seenExternalIds = new Set<string>();

    for (const offer of offers) {
      seenExternalIds.add(offer.externalId);

      try {
        const action = await processOffer(
          integration,
          offer,
          extracted.filesByName,
          paymentsEnabled
        );

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
    }

    if (integration.fullImportMode) {
      deactivatedCount = await deactivateMissingOffers(integration.id, seenExternalIds);
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
            ? `Synchronizacja zakończona z błędami (${errorCount}).`
            : skippedCount > 0
            ? `Synchronizacja zakończona. Pominięto ${skippedCount} ofert z powodu braku kredytów.`
            : null,
        lastImportedOffers: offers.length,
        lastCreatedCount: createdCount,
        lastUpdatedCount: updatedCount,
        lastDeactivatedCount: deactivatedCount,
        lastSkippedCount: skippedCount,
        lastErrorCount: errorCount,
      },
    });

    return {
      success: true,
      remoteFileName,
      importedOffers: offers.length,
      createdCount,
      updatedCount,
      deactivatedCount,
      skippedCount,
      errorCount,
      message:
        errorCount > 0
          ? "Synchronizacja zakończona z częściowymi błędami."
          : "Synchronizacja zakończona poprawnie.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się zsynchronizować integracji.";

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
  }
}