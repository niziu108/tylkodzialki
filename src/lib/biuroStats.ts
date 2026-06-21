import { prisma } from "@/lib/prisma";

// P16 (fundament raportu leadów per biuro).
//
// Liczniki na Dzialka (viewsCount/detailViewsCount/phoneClicksCount/messageClicksCount)
// są KUMULACYJNE i bez znacznika czasu, więc "dzień po dniu" oraz okna czasowe NIE dają
// się z nich policzyć wprost. Dlatego raz dziennie robimy snapshot sum PER BIURO (właściciel
// ofert) do tabeli BiuroDailyStat. Aktywność w oknie = (snapshot najnowszy) − (snapshot z
// początku okna). Snapshot jest kumulacyjny (a nie dzienną deltą), więc jest samonaprawialny:
// pominięty dzień nie gubi danych, różnica po prostu obejmie szerszy zakres.

const WARSAW_TZ = "Europe/Warsaw";

/** Data (bez czasu) w strefie Polski, jako Date o północy UTC — pasuje do kolumny @db.Date. */
export function warsawDateOnly(input: Date = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(input); // "YYYY-MM-DD"
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Zapisuje dzienny snapshot kumulacyjnych liczników per biuro (sumy ze wszystkich ofert
 * właściciela). Idempotentny: ponowne uruchomienie tego samego dnia odświeża wiersz, nie
 * tworzy duplikatu. Wołany z crona POST /api/cron/stats-snapshot.
 */
export async function takeDailyStatsSnapshot(now: Date = new Date()) {
  const date = warsawDateOnly(now);

  const grouped = await prisma.dzialka.groupBy({
    by: ["ownerId"],
    where: { ownerId: { not: null } },
    _sum: {
      viewsCount: true,
      detailViewsCount: true,
      phoneClicksCount: true,
      messageClicksCount: true,
    },
  });

  let owners = 0;
  for (const g of grouped) {
    if (!g.ownerId) continue;
    const data = {
      viewsCount: g._sum.viewsCount ?? 0,
      detailViewsCount: g._sum.detailViewsCount ?? 0,
      phoneClicksCount: g._sum.phoneClicksCount ?? 0,
      messageClicksCount: g._sum.messageClicksCount ?? 0,
    };
    await prisma.biuroDailyStat.upsert({
      where: { userId_date: { userId: g.ownerId, date } },
      create: { userId: g.ownerId, date, ...data },
      update: data,
    });
    owners += 1;
  }

  return { ok: true as const, date: date.toISOString().slice(0, 10), owners };
}

export type LeadCounters = {
  views: number;
  detailViews: number;
  phoneClicks: number;
  messageClicks: number;
  /** Lead = sygnał intencji zakupu: telefon + wiadomość. */
  leads: number;
};

export type BiuroLeadsRow = {
  ownerId: string;
  label: string;
  email: string | null;
  isBiuro: boolean;
  offers: number;
  allTime: LeadCounters;
  /** Aktywność w wybranym oknie; null gdy okno = całość lub brak danych snapshotów. */
  window: LeadCounters | null;
};

export type BiuroLeadsReport = {
  rows: BiuroLeadsRow[];
  totalsAllTime: LeadCounters;
  totalsWindow: LeadCounters | null;
  windowDays: number | null;
  /** Ile różnych dni mamy w snapshotach w oknie (do komunikatu "zbieramy dane"). */
  snapshotDaysInWindow: number;
};

function emptyCounters(): LeadCounters {
  return { views: 0, detailViews: 0, phoneClicks: 0, messageClicks: 0, leads: 0 };
}

function addInto(target: LeadCounters, src: LeadCounters) {
  target.views += src.views;
  target.detailViews += src.detailViews;
  target.phoneClicks += src.phoneClicks;
  target.messageClicks += src.messageClicks;
  target.leads += src.leads;
}

/**
 * Raport leadów per biuro dla panelu admina (P16a).
 * - allTime: liczone na żywo z kumulacyjnych liczników Dzialka (działa od pierwszego dnia).
 * - window: różnica snapshotów (najnowszy − najstarszy w oknie); wypełnia się z czasem.
 */
export async function getBiuroLeadsReport(
  windowDays: number | null = null,
  now: Date = new Date()
): Promise<BiuroLeadsReport> {
  // 1. Sumy "od zawsze" + liczba ofert per właściciel — wprost z Dzialka.
  const grouped = await prisma.dzialka.groupBy({
    by: ["ownerId"],
    where: { ownerId: { not: null } },
    _sum: {
      viewsCount: true,
      detailViewsCount: true,
      phoneClicksCount: true,
      messageClicksCount: true,
    },
    _count: { _all: true },
  });

  const ownerIds = grouped
    .map((g) => g.ownerId)
    .filter((id): id is string => !!id);

  // 2. Dane biur (etykieta, e-mail, czy to biuro).
  const users = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: {
          id: true,
          name: true,
          email: true,
          defaultBiuroNazwa: true,
          defaultBiuroLogoUrl: true,
        },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  // 3. Okno czasu ze snapshotów (jeśli wybrane).
  const windowDeltas = new Map<string, LeadCounters>();
  let snapshotDaysInWindow = 0;

  if (windowDays && windowDays > 0) {
    const windowStart = addDays(warsawDateOnly(now), -windowDays);
    const snapshots = await prisma.biuroDailyStat.findMany({
      where: { date: { gte: windowStart } },
      orderBy: { date: "asc" },
      select: {
        userId: true,
        date: true,
        viewsCount: true,
        detailViewsCount: true,
        phoneClicksCount: true,
        messageClicksCount: true,
      },
    });

    const distinctDates = new Set(snapshots.map((s) => s.date.toISOString().slice(0, 10)));
    snapshotDaysInWindow = distinctDates.size;

    // Potrzebujemy ≥2 dni, żeby policzyć różnicę.
    if (snapshotDaysInWindow >= 2) {
      type Edge = { first: (typeof snapshots)[number]; last: (typeof snapshots)[number] };
      const byOwner = new Map<string, Edge>();
      for (const s of snapshots) {
        const edge = byOwner.get(s.userId);
        if (!edge) {
          byOwner.set(s.userId, { first: s, last: s });
        } else {
          edge.last = s; // posortowane rosnąco po dacie
        }
      }
      for (const [ownerId, edge] of byOwner) {
        const phone = Math.max(0, edge.last.phoneClicksCount - edge.first.phoneClicksCount);
        const message = Math.max(0, edge.last.messageClicksCount - edge.first.messageClicksCount);
        windowDeltas.set(ownerId, {
          views: Math.max(0, edge.last.viewsCount - edge.first.viewsCount),
          detailViews: Math.max(0, edge.last.detailViewsCount - edge.first.detailViewsCount),
          phoneClicks: phone,
          messageClicks: message,
          leads: phone + message,
        });
      }
    }
  }

  const hasWindowData = windowDays != null && snapshotDaysInWindow >= 2;

  const rows: BiuroLeadsRow[] = grouped
    .filter((g): g is typeof g & { ownerId: string } => !!g.ownerId)
    .map((g) => {
      const u = userById.get(g.ownerId);
      const phone = g._sum.phoneClicksCount ?? 0;
      const message = g._sum.messageClicksCount ?? 0;
      const allTime: LeadCounters = {
        views: g._sum.viewsCount ?? 0,
        detailViews: g._sum.detailViewsCount ?? 0,
        phoneClicks: phone,
        messageClicks: message,
        leads: phone + message,
      };
      return {
        ownerId: g.ownerId,
        label:
          u?.defaultBiuroNazwa?.trim() ||
          u?.name?.trim() ||
          u?.email ||
          "Bez nazwy",
        email: u?.email ?? null,
        isBiuro: !!u?.defaultBiuroLogoUrl,
        offers: g._count._all,
        allTime,
        window: hasWindowData ? windowDeltas.get(g.ownerId) ?? emptyCounters() : null,
      };
    });

  // Ranking po leadach (okno jeśli dostępne, inaczej całość).
  rows.sort((a, b) => {
    const aLeads = a.window?.leads ?? a.allTime.leads;
    const bLeads = b.window?.leads ?? b.allTime.leads;
    if (bLeads !== aLeads) return bLeads - aLeads;
    if (b.allTime.leads !== a.allTime.leads) return b.allTime.leads - a.allTime.leads;
    return b.offers - a.offers;
  });

  const totalsAllTime = emptyCounters();
  const totalsWindow = hasWindowData ? emptyCounters() : null;
  for (const r of rows) {
    addInto(totalsAllTime, r.allTime);
    if (totalsWindow && r.window) addInto(totalsWindow, r.window);
  }

  return {
    rows,
    totalsAllTime,
    totalsWindow,
    windowDays: windowDays ?? null,
    snapshotDaysInWindow,
  };
}

// ---------------------------------------------------------------------------
// P16b — seria "dzień po dniu" dla pojedynczego właściciela (panel biura).
// Wykres rysujemy z RÓŻNIC kolejnych snapshotów (snapshot jest kumulacyjny):
// przyrost dnia = snapshot(dzień) − snapshot(dzień poprzedni). Duże liczby
// bierzemy z żywych liczników Dzialka, żeby panel miał dane od pierwszego dnia,
// zanim uzbiera się ≥2 snapshoty potrzebne do choćby jednego słupka.
// ---------------------------------------------------------------------------

const snapshotSelect = {
  date: true,
  viewsCount: true,
  detailViewsCount: true,
  phoneClicksCount: true,
  messageClicksCount: true,
} as const;

/** Przyrost jednego dnia (różnica względem poprzedniego snapshotu). */
export type DailyPoint = {
  date: string; // "YYYY-MM-DD"
  views: number;
  detailViews: number;
  phoneClicks: number;
  messageClicks: number;
  leads: number;
};

export type BiuroDailySeries = {
  /** Przyrosty dzień po dniu, chronologicznie (puste, gdy <2 dni snapshotów). */
  points: DailyPoint[];
  /** Sumy "od zawsze" dla TEGO właściciela — z żywych liczników (działa od 1. dnia). */
  allTime: LeadCounters;
  /** Suma przyrostów w oknie (= najnowszy − najstarszy snapshot). */
  windowTotals: LeadCounters;
  /** Liczba ofert właściciela (kontekst). */
  offers: number;
  /** Ile różnych dni snapshotów mamy w oknie (do komunikatu "zbieramy dane"). */
  snapshotDaysInWindow: number;
  /** Rozmiar żądanego okna w dniach. */
  windowDays: number;
};

/**
 * Seria dzienna dla zalogowanego właściciela (scope: ownerId === userId, więc
 * biuro widzi WYŁĄCZNIE swoje dane). Liczy przyrosty z różnic snapshotów oraz
 * sumy "od zawsze" wprost z liczników Dzialka.
 */
export async function getBiuroDailySeries(
  userId: string,
  windowDays = 30,
  now: Date = new Date()
): Promise<BiuroDailySeries> {
  // 1) Sumy "od zawsze" + liczba ofert — wprost z żywych liczników (dzień 1. ma dane).
  const agg = await prisma.dzialka.aggregate({
    where: { ownerId: userId },
    _sum: {
      viewsCount: true,
      detailViewsCount: true,
      phoneClicksCount: true,
      messageClicksCount: true,
    },
    _count: { _all: true },
  });
  const allTimePhone = agg._sum.phoneClicksCount ?? 0;
  const allTimeMessage = agg._sum.messageClicksCount ?? 0;
  const allTime: LeadCounters = {
    views: agg._sum.viewsCount ?? 0,
    detailViews: agg._sum.detailViewsCount ?? 0,
    phoneClicks: allTimePhone,
    messageClicks: allTimeMessage,
    leads: allTimePhone + allTimeMessage,
  };

  // 2) Snapshoty z okna + jeden snapshot SPRZED okna jako baseline, żeby pierwszy
  //    dzień okna też dostał przyrost (różnicę względem dnia poprzedniego).
  const windowStart = addDays(warsawDateOnly(now), -windowDays);
  const [baseline, windowSnaps] = await Promise.all([
    prisma.biuroDailyStat.findFirst({
      where: { userId, date: { lt: windowStart } },
      orderBy: { date: "desc" },
      select: snapshotSelect,
    }),
    prisma.biuroDailyStat.findMany({
      where: { userId, date: { gte: windowStart } },
      orderBy: { date: "asc" },
      select: snapshotSelect,
    }),
  ]);

  const snapshotDaysInWindow = windowSnaps.length;
  const ordered = baseline ? [baseline, ...windowSnaps] : windowSnaps;

  const points: DailyPoint[] = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const phone = Math.max(0, cur.phoneClicksCount - prev.phoneClicksCount);
    const message = Math.max(0, cur.messageClicksCount - prev.messageClicksCount);
    points.push({
      date: cur.date.toISOString().slice(0, 10),
      views: Math.max(0, cur.viewsCount - prev.viewsCount),
      detailViews: Math.max(0, cur.detailViewsCount - prev.detailViewsCount),
      phoneClicks: phone,
      messageClicks: message,
      leads: phone + message,
    });
  }

  const windowTotals = emptyCounters();
  for (const p of points) addInto(windowTotals, p);

  return {
    points,
    allTime,
    windowTotals,
    offers: agg._count._all,
    snapshotDaysInWindow,
    windowDays,
  };
}
