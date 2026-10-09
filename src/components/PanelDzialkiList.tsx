'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import type {
  Przeznaczenie,
  TransakcjaTyp,
  PradStatus,
  WodaStatus,
  KanalizacjaStatus,
  GazStatus,
  DzialkaSourceType,
} from '@prisma/client';
import { IconCamera } from './CardIcons';
import { pelnaLokalizacja } from '@/lib/lokalizacjaOferty';
import {
  przedluzOgloszenieAction,
  zakonczOgloszenieAction,
  usunOgloszenieAction,
  wyroznijOgloszenieAction,
} from '../../app/panel/actions';
import type { PanelActionResult } from '../../app/panel/actions';

type Photo = { url: string; publicId?: string; kolejnosc?: number };
type DzialkaStatus = 'AKTYWNE' | 'ZAKONCZONE';
type FilterStatus = 'all' | 'active' | 'ended' | 'featured';
type SortOption =
  | 'newest'
  | 'oldest'
  | 'price_high'
  | 'price_low'
  | 'area_high'
  | 'area_low'
  | 'expiring';

export type Dzialka = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  transakcja?: TransakcjaTyp | null;
  locationLabel?: string | null;
  adminGmina?: string | null;
  przeznaczenia?: Przeznaczenie[];
  prad?: PradStatus | null;
  woda?: WodaStatus | null;
  kanalizacja?: KanalizacjaStatus | null;
  gaz?: GazStatus | null;
  zdjecia?: Photo[];
  status?: DzialkaStatus;
  publishedAt?: string | Date | null;
  expiresAt?: string | Date | null;
  endedAt?: string | Date | null;
  isFeatured?: boolean | null;
  featuredUntil?: string | Date | null;
  sourceType?: DzialkaSourceType | null;
  viewsCount?: number | null;
  detailViewsCount?: number | null;
  favoritesCount?: number | null;
  phoneClicksCount?: number | null;
  messageClicksCount?: number | null;
};

function formatIntPL(value: number) {
  return new Intl.NumberFormat('pl-PL', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDatePL(value?: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pl-PL');
}

function getDaysLeft(expiresAt?: string | Date | null) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getEffectiveStatus(
  status?: DzialkaStatus,
  expiresAt?: string | Date | null
): DzialkaStatus {
  if (status === 'ZAKONCZONE') return 'ZAKONCZONE';
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'ZAKONCZONE';
  return 'AKTYWNE';
}

function isFeaturedNow(d: Dzialka) {
  return !!d.isFeatured && !!d.featuredUntil && new Date(d.featuredUntil).getTime() > Date.now();
}

function labelPrzeznaczenie(p: Przeznaczenie) {
  const map: Record<string, string> = {
    INWESTYCYJNA: 'Inwestycyjna',
    BUDOWLANA: 'Budowlana',
    ROLNA: 'Rolna',
    LESNA: 'Leśna',
    REKREACYJNA: 'Rekreacyjna',
    SIEDLISKOWA: 'Siedliskowa',
    USLUGOWA: 'Usługowa',
  };

  return map[p] ?? String(p);
}


function SelectChevron() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-fg/70">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

const PAGE_SIZE = 20;

function buildPageList(page: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (page >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', page - 1, page, page + 1, '…', total];
}

function PanelPager({
  page,
  totalPages,
  onGo,
}: {
  page: number;
  totalPages: number;
  onGo: (p: number) => void;
}) {
  const pages = buildPageList(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
      <button
        type="button"
        onClick={() => onGo(page - 1)}
        disabled={page <= 1}
        aria-label="Poprzednia strona"
        className={`flex h-10 w-10 items-center justify-center rounded-full text-[26px] leading-none transition ${
          page <= 1 ? 'text-fg/25' : 'text-fg/80 hover:bg-fg/10 hover:text-fg'
        }`}
      >
        ‹
      </button>

      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`dots-${i}`} className="px-1 text-[13px] text-fg/62">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onGo(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`min-w-[34px] rounded-lg px-2 py-1.5 text-center text-[13px] tabular-nums transition ${
              p === page ? 'font-semibold text-brand-text' : 'text-fg/72 hover:text-fg'
            }`}
            style={{
              transitionProperty: 'color',
              textDecoration: p === page ? 'underline' : 'none',
              textUnderlineOffset: '8px',
              textDecorationThickness: '2px',
              textDecorationColor: p === page ? 'var(--brand)' : 'transparent',
            }}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onGo(page + 1)}
        disabled={page >= totalPages}
        aria-label="Następna strona"
        className={`flex h-10 w-10 items-center justify-center rounded-full text-[26px] leading-none transition ${
          page >= totalPages ? 'text-fg/25' : 'text-fg/80 hover:bg-fg/10 hover:text-fg'
        }`}
      >
        ›
      </button>
    </div>
  );
}

export default function PanelDzialkiList({ items }: { items: Dzialka[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const listTopRef = useRef<HTMLDivElement>(null);
  const pendingTopScrollRef = useRef(false);

  useEffect(() => {
    setPage(1);
  }, [query, status, sort]);

  const filteredItems = useMemo(() => {
    if (!items?.length) return [];

    let list = [...items];
    const q = query.trim().toLowerCase();

    if (q) {
      list = list.filter((d) => {
        const title = d.tytul?.toLowerCase() ?? '';
        const location = d.locationLabel?.toLowerCase() ?? '';
        const types =
          d.przeznaczenia?.map((p) => labelPrzeznaczenie(p).toLowerCase()).join(' ') ?? '';

        return title.includes(q) || location.includes(q) || types.includes(q);
      });
    }

    if (status === 'active') {
      list = list.filter((d) => getEffectiveStatus(d.status, d.expiresAt) === 'AKTYWNE');
    }

    if (status === 'ended') {
      list = list.filter((d) => getEffectiveStatus(d.status, d.expiresAt) === 'ZAKONCZONE');
    }

    if (status === 'featured') {
      list = list.filter((d) => isFeaturedNow(d));
    }

    list.sort((a, b) => {
      const aFeatured = isFeaturedNow(a);
      const bFeatured = isFeaturedNow(b);

      if (sort === 'newest') {
        if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
        return (
          new Date(b.publishedAt ?? b.endedAt ?? 0).getTime() -
          new Date(a.publishedAt ?? a.endedAt ?? 0).getTime()
        );
      }

      if (sort === 'oldest') {
        return (
          new Date(a.publishedAt ?? a.endedAt ?? 0).getTime() -
          new Date(b.publishedAt ?? b.endedAt ?? 0).getTime()
        );
      }

      if (sort === 'price_high') return b.cenaPln - a.cenaPln;
      if (sort === 'price_low') return a.cenaPln - b.cenaPln;
      if (sort === 'area_high') return b.powierzchniaM2 - a.powierzchniaM2;
      if (sort === 'area_low') return a.powierzchniaM2 - b.powierzchniaM2;

      if (sort === 'expiring') {
        const aExpiry =
          getEffectiveStatus(a.status, a.expiresAt) === 'AKTYWNE' && a.expiresAt
            ? new Date(a.expiresAt).getTime()
            : Number.MAX_SAFE_INTEGER;

        const bExpiry =
          getEffectiveStatus(b.status, b.expiresAt) === 'AKTYWNE' && b.expiresAt
            ? new Date(b.expiresAt).getTime()
            : Number.MAX_SAFE_INTEGER;

        return aExpiry - bExpiry;
      }

      return 0;
    });

    return list;
  }, [items, query, status, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const goToPage = (p: number) => {
    const next = Math.max(1, Math.min(totalPages, p));
    if (next === currentPage) return;
    // Scroll na górę listy dopiero PO przerenderowaniu nowej strony (useEffect
    // niżej). Gdyby zrobić to tu, React jeszcze nie podmienił kart — scroll
    // liczył się wg starego, dłuższego układu i lądował na dole/w stopce.
    pendingTopScrollRef.current = true;
    setPage(next);
  };

  useEffect(() => {
    if (!pendingTopScrollRef.current) return;
    pendingTopScrollRef.current = false;
    // Instant, nie smooth — od razu widać wyszukiwarkę i pierwszą ofertę nowej
    // strony (spójnie z listą /kup); smooth potrafił się rwać na podmianie kart.
    listTopRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
  }, [currentPage]);

  if (!items?.length) {
    return (
      <div className="rounded-3xl border border-fg/12 bg-surface-2/20 p-6 text-fg/70">
        Nie masz jeszcze żadnych ogłoszeń.
      </div>
    );
  }

  return (
    <div ref={listTopRef} className="space-y-4 scroll-mt-24">
      {/* Jeden pasek: szukaj, status jako pigułki (zielona = wybrana, jak filtry /kup), sortowanie. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-[300px]">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj po tytule lub miejscowości"
            aria-label="Szukaj ogłoszenia"
            className="h-11 w-full rounded-xl border border-fg/12 bg-surface pl-10 pr-3 text-[16px] text-fg outline-none transition placeholder:text-fg/55 focus:border-brand/60 md:text-[14px]"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Wszystkie', items.length],
              ['active', 'Aktywne', items.filter((d) => getEffectiveStatus(d.status, d.expiresAt) === 'AKTYWNE').length],
              ['ended', 'Zakończone', items.filter((d) => getEffectiveStatus(d.status, d.expiresAt) === 'ZAKONCZONE').length],
              ['featured', 'Wyróżnione', items.filter((d) => isFeaturedNow(d)).length],
            ] as const
          ).map(([val, label, n]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatus(val)}
              aria-pressed={status === val}
              className={`rounded-full border px-3.5 py-2 text-[13px] transition ${
                status === val
                  ? 'border-brand bg-brand/20 text-brand-text'
                  : 'border-fg/15 text-fg/72 hover:border-fg/35 hover:text-fg'
              }`}
            >
              {label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>

        <div className="relative lg:ml-auto lg:w-[230px]">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            aria-label="Sortowanie"
            className="h-11 w-full appearance-none rounded-xl border border-fg/12 bg-surface px-3.5 pr-10 text-[16px] text-fg outline-none transition focus:border-brand/60 md:text-[14px]"
          >
            <option value="newest">Najnowsze</option>
            <option value="oldest">Najstarsze</option>
            <option value="price_high">Cena: od najwyższej</option>
            <option value="price_low">Cena: od najniższej</option>
            <option value="area_high">Powierzchnia: od największej</option>
            <option value="area_low">Powierzchnia: od najmniejszej</option>
            <option value="expiring">Wygasają najszybciej</option>
          </select>
          <SelectChevron />
        </div>
      </div>

      {!filteredItems.length ? (
        <div className="rounded-3xl border border-fg/12 bg-surface-2/20 p-6 text-fg/70">
          Nie znaleziono ogłoszeń dla wybranych filtrów.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3">
            {pageItems.map((d) => (
              <PanelDzialkaCard key={d.id} d={d} />
            ))}
          </div>

          {totalPages > 1 ? (
            <PanelPager page={currentPage} totalPages={totalPages} onGo={goToPage} />
          ) : null}
        </>
      )}
    </div>
  );
}

function PanelDzialkaCard({ d }: { d: Dzialka }) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const cover =
    (d.zdjecia ?? []).slice().sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0))[0]?.url ?? null;
  const photoCount = d.zdjecia?.length ?? 0;
  const loc = pelnaLokalizacja({ label: d.locationLabel?.trim() || '', gmina: d.adminGmina }) || 'Lokalizacja niepodana';
  const area = d.powierzchniaM2 ?? 0;
  const isRent = d.transakcja === 'WYNAJEM';
  const przezn = d.przeznaczenia?.length ? d.przeznaczenia.map(labelPrzeznaczenie).join(', ') : null;
  const zlM2 = !isRent && area > 0 && d.cenaPln > 0 ? Math.round(d.cenaPln / area) : 0;

  const effectiveStatus = getEffectiveStatus(d.status, d.expiresAt);
  const daysLeft = getDaysLeft(d.expiresAt);
  const isFeaturedActive = isFeaturedNow(d);
  const isIndefinite = effectiveStatus === 'AKTYWNE' && !d.expiresAt;
  // Ofertą z importu CRM rządzi program biura, więc bez Edytuj, Przedłuż/Aktywuj, Zakończ i Usuń.
  // Powody i blokada tych akcji po stronie serwera: app/panel/actions.ts, a dla edycji
  // app/api/panel/dzialki/[id]/route.ts.
  const isCrm = d.sourceType === 'CRM';

  const viewsCount = d.viewsCount ?? 0;
  const detailViewsCount = d.detailViewsCount ?? 0;
  const favoritesCount = d.favoritesCount ?? 0;
  const leadsCount = (d.phoneClicksCount ?? 0) + (d.messageClicksCount ?? 0);

  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!d.id || !cardRef.current) return;

    const key = `TD_PANEL_VIEWED_${d.id}`;
    let shouldTrack = true;

    try {
      if (sessionStorage.getItem(key)) {
        shouldTrack = false;
      }
    } catch {
      shouldTrack = true;
    }

    if (!shouldTrack) return;

    const el = cardRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (entry.intersectionRatio < 0.35) return;

        try {
          sessionStorage.setItem(key, '1');
        } catch {}

        fetch(`/api/dzialki/${d.id}/track-view`, {
          method: 'POST',
          cache: 'no-store',
        }).catch(() => {});

        observer.disconnect();
      },
      {
        threshold: [0.35],
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [d.id]);

  // Menu „Więcej" zamyka klik poza nim i Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function runAction(action: () => Promise<PanelActionResult>, errorText: string) {
    setMenuOpen(false);
    startTransition(async () => {
      setActionError(null);

      try {
        const result = await action();

        if (result?.error) {
          setActionError(result.error);
        }
      } catch (e) {
        // Brak punktów na wyróżnienie: akcja robi redirect() do zakupu. Obietnica kończy się
        // wtedy błędem NEXT_REDIRECT, a przejście na stronę zakupu wykonuje już router.
        if (e instanceof Error && e.message === 'NEXT_REDIRECT') {
          return;
        }

        // Treść nieoczekiwanego wyjątku na produkcji nie dociera (sam digest), a na devie
        // byłaby techniczna, więc użytkownik dostaje ogólny tekst tej akcji.
        setActionError(errorText);
      }
    });
  }

  const ended = effectiveStatus === 'ZAKONCZONE';

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl border bg-surface transition ${
        ended
          ? 'border-fg/10'
          : isFeaturedActive
          ? 'border-brand/55 shadow-[0_0_0_1px_rgba(122,163,51,0.25)]'
          : 'border-fg/12 hover:border-fg/25'
      }`}
    >
      {/* Wiersz oferty jak w panelach dużych portali: miniatura, najważniejsze dane, wyniki
          i dwie główne akcje. Pełna karta zajmowała cały ekran na ofertę, a przy kilkudziesięciu
          ogłoszeniach panel był długim przewijaniem. Klik w zdjęcie lub tytuł otwiera ofertę. */}
      <div className="flex gap-4 p-3 sm:gap-5 sm:p-4">
        <Link
          href={`/dzialka/${d.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block h-[92px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-fg/5 sm:h-[120px] sm:w-[180px]"
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={d.tytul}
              loading="lazy"
              decoding="async"
              className={`h-full w-full object-cover ${ended ? 'grayscale-[60%] opacity-70' : ''}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[12px] text-fg/62">Brak zdjęć</div>
          )}
          {photoCount > 1 ? (
            <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
              <IconCamera className="h-3 w-3" />
              {photoCount}
            </span>
          ) : null}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[18px] font-semibold leading-none text-fg sm:text-[20px]">
                  {d.cenaPln > 0 ? `${formatIntPL(d.cenaPln)} zł` : 'Zapytaj o cenę'}
                  {isRent ? <span className="text-[13px] font-normal text-fg/70">/mc</span> : null}
                </span>
                {zlM2 ? <span className="text-[13px] text-fg/65">{formatIntPL(zlM2)} zł/m²</span> : null}
              </div>
              <Link
                href={`/dzialka/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 line-clamp-1 text-[15px] font-medium text-fg/90 hover:underline sm:text-[16px]"
              >
                {d.tytul}
              </Link>
              <div className="mt-1 truncate text-[13px] text-fg/65">
                {loc}
                {area ? ` · ${formatIntPL(area)} m²` : ''}
                {przezn ? ` · ${przezn}` : ''}
              </div>
            </div>

            <StatusPill ended={ended} featured={isFeaturedActive} wygaslo={d.status !== 'ZAKONCZONE'} />
          </div>

          {/* Wyniki zawsze na widoku: biuro ocenia portal po tym, czy oferta ma wejścia i telefony. */}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] tabular-nums text-fg/70">
            <Liczba value={viewsCount} label="wyświetleń" />
            <Liczba value={detailViewsCount} label="wejść" />
            <Liczba value={leadsCount} label="kontaktów" mocno />
            <Liczba value={favoritesCount} label="zapisów" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-fg/8 px-3 py-2.5 sm:px-4">
        <span className="mr-auto text-[12px] text-fg/62">
          {isCrm ? (
            <span className="inline-flex items-center gap-1.5">
              <IconSync className="h-3.5 w-3.5 text-brand" />
              Z Twojego CRM, aktualizuje się samo
            </span>
          ) : ended ? (
            d.status === 'ZAKONCZONE' ? 'Ogłoszenie zakończone' : 'Ogłoszenie wygasło'
          ) : isIndefinite ? (
            'Widoczne bezterminowo'
          ) : (
            `Widoczne do ${formatDatePL(d.expiresAt)}${
              typeof daysLeft === 'number' && daysLeft >= 0 ? ` (${daysLeft} dni)` : ''
            }`
          )}
          {isFeaturedActive ? (
            <span className="text-brand-text"> · wyróżnione do {formatDatePL(d.featuredUntil)}</span>
          ) : null}
        </span>

        {!isCrm ? (
          <ActionBtnAsLink
            href={`/panel/ogloszenia/${d.id}/edytuj`}
            label="Edytuj"
            title="Zmień zdjęcia, cenę, opis i dane ogłoszenia"
            disabled={isPending}
          />
        ) : (
          <ActionBtnAsLink
            href={`/dzialka/${d.id}`}
            label="Zobacz"
            title="Otwórz ogłoszenie tak, jak widzą je kupujący"
            target="_blank"
            rel="noopener noreferrer"
          />
        )}

        {!isFeaturedActive && !ended ? (
          <ActionBtn
            label={isPending ? 'Trwa...' : 'Wyróżnij'}
            title="Pokazuj ogłoszenie wyżej na liście i z zieloną ramką (7 dni)"
            disabled={isPending}
            accent
            onClick={() =>
              runAction(
                () => wyroznijOgloszenieAction(d.id),
                'Nie udało się wyróżnić ogłoszenia.'
              )
            }
          />
        ) : null}

        {/* Rzadziej używane akcje w jednym menu, zamiast sześciu przycisków w rzędzie. */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Więcej akcji"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full border border-fg/14 bg-fg/[0.03] px-3.5 text-[12px] font-semibold text-fg/80 transition hover:border-fg/28 hover:text-fg"
          >
            Więcej
            <Chevron className={`h-3.5 w-3.5 transition ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1.5 min-w-[210px] overflow-hidden rounded-xl border border-fg/12 bg-surface py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.14)]"
            >
              {!isCrm ? (
                <MenuLink href={`/dzialka/${d.id}`} label="Zobacz ogłoszenie" newTab />
              ) : null}
              {!isCrm ? (
                <MenuItem
                  label={effectiveStatus === 'AKTYWNE' ? 'Przedłuż ważność' : 'Aktywuj ponownie'}
                  disabled={isPending}
                  onClick={() =>
                    runAction(
                      () => przedluzOgloszenieAction(d.id),
                      effectiveStatus === 'AKTYWNE'
                        ? 'Nie udało się przedłużyć ogłoszenia.'
                        : 'Nie udało się aktywować ogłoszenia.'
                    )
                  }
                />
              ) : null}
              {!isCrm && effectiveStatus === 'AKTYWNE' ? (
                <MenuItem
                  label="Zakończ"
                  disabled={isPending}
                  onClick={() => {
                    if (!window.confirm('Na pewno zakończyć to ogłoszenie?')) return;
                    runAction(() => zakonczOgloszenieAction(d.id), 'Nie udało się zakończyć ogłoszenia.');
                  }}
                />
              ) : null}
              {!isCrm ? (
                <MenuItem
                  label="Usuń na zawsze"
                  danger
                  disabled={isPending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Czy na pewno chcesz trwale usunąć to ogłoszenie? Tej operacji nie można cofnąć. Ogłoszenie i jego zdjęcia zostaną usunięte na zawsze.'
                      )
                    )
                      return;
                    runAction(() => usunOgloszenieAction(d.id), 'Nie udało się usunąć ogłoszenia.');
                  }}
                />
              ) : null}
              {isCrm ? (
                <p className="px-4 py-2.5 text-[12px] leading-5 text-fg/62">
                  Ofertą zarządzasz w swoim CRM. Tam ją edytujesz, zakończysz lub wznowisz, a portal
                  zaktualizuje się sam.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <div className="mx-3 mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-600 sm:mx-4">
          {actionError}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ ended, featured, wygaslo }: { ended: boolean; featured: boolean; wygaslo: boolean }) {
  const [label, cls] = ended
    ? [wygaslo ? 'Wygasło' : 'Zakończone', 'border-fg/15 bg-fg/[0.04] text-fg/62']
    : featured
    ? ['Wyróżnione', 'border-brand/40 bg-brand/15 text-brand-text']
    : ['Aktywne', 'border-brand/25 bg-brand/[0.07] text-brand-text'];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ended ? 'bg-fg/35' : 'bg-brand'}`} />
      {label}
    </span>
  );
}

function Liczba({ value, label, mocno = false }: { value: number; label: string; mocno?: boolean }) {
  return (
    <span>
      <span className={`font-semibold ${mocno && value > 0 ? 'text-brand-text' : 'text-fg'}`}>{formatIntPL(value)}</span>{' '}
      {label}
    </span>
  );
}

function MenuLink({ href, label, newTab, noPrefetch }: { href: string; label: string; newTab?: boolean; noPrefetch?: boolean }) {
  return (
    <Link
      href={href}
      role="menuitem"
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      prefetch={noPrefetch ? false : undefined}
      className="block px-4 py-2.5 text-[14px] text-fg/85 transition hover:bg-fg/[0.04] hover:text-fg"
    >
      {label}
    </Link>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left text-[14px] transition disabled:opacity-40 ${
        danger ? 'text-red-600 hover:bg-red-500/[0.06]' : 'text-fg/85 hover:bg-fg/[0.04] hover:text-fg'
      }`}
    >
      {label}
    </button>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Import z CRM: strzałki synchronizacji (styl ikon kart, stroke 1.6). */
function IconSync({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function ActionBtnAsLink({
  href,
  label,
  title,
  disabled,
  target,
  rel,
}: {
  href: string;
  label: string;
  title?: string;
  disabled?: boolean;
  target?: string;
  rel?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      target={target}
      rel={rel}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      className={`inline-flex min-h-[40px] items-center justify-center rounded-full border px-4 text-[12px] font-semibold transition ${
        disabled
          ? 'border-fg/10 bg-fg/[0.02] text-fg/62'
          : 'border-fg/14 bg-fg/[0.03] text-fg/80 hover:border-fg/28 hover:bg-fg/[0.05] hover:text-fg'
      }`}
    >
      {label}
    </Link>
  );
}

function ActionBtn({
  label,
  title,
  onClick,
  danger,
  accent,
  disabled,
}: {
  label: string;
  title?: string;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      className={`inline-flex min-h-[40px] items-center justify-center rounded-full border px-4 text-[12px] font-semibold transition disabled:opacity-40 ${
        danger
          ? 'border-red-400/20 bg-red-500/10 text-red-200 hover:border-red-400/35 hover:bg-red-500/15'
          : accent
          ? 'border-brand/30 bg-brand/12 text-brand-text hover:border-brand/50 hover:bg-brand/18'
          : 'border-fg/14 bg-fg/[0.03] text-fg/80 hover:border-fg/28 hover:bg-fg/[0.05] hover:text-fg'
      }`}
    >
      {label}
    </button>
  );
}
