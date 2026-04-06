'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import type { Przeznaczenie } from '@prisma/client';
import {
  przedluzOgloszenieAction,
  zakonczOgloszenieAction,
  usunOgloszenieAction,
  wyroznijOgloszenieAction,
} from '../../app/panel/actions';

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
  locationLabel?: string | null;
  przeznaczenia?: Przeznaczenie[];
  zdjecia?: Photo[];
  status?: DzialkaStatus;
  publishedAt?: string | Date | null;
  expiresAt?: string | Date | null;
  endedAt?: string | Date | null;
  isFeatured?: boolean | null;
  featuredUntil?: string | Date | null;
  viewsCount?: number | null;
  detailViewsCount?: number | null;
};

function formatPLN(value: number) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(value);
}

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
  return String(p)
    .replace('USLUGOWA', 'USŁUGOWA')
    .replace('LESNA', 'LEŚNA')
    .replace('INWESTYCYJNA', 'INWESTYCYJNA')
    .replace('ROLNA', 'ROLNA')
    .replace('BUDOWLANA', 'BUDOWLANA');
}

const ICONS = {
  area: '/powierzchnia.webp',
  price: '/cena.webp',
  type: '/przeznaczenie.webp',
  loc: '/lokalizacja.webp',
};

const GREEN = '#7aa333';

function SelectChevron() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/55">
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

export default function PanelDzialkiList({ items }: { items: Dzialka[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [sort, setSort] = useState<SortOption>('newest');

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

      if (sort === 'price_high') {
        return b.cenaPln - a.cenaPln;
      }

      if (sort === 'price_low') {
        return a.cenaPln - b.cenaPln;
      }

      if (sort === 'area_high') {
        return b.powierzchniaM2 - a.powierzchniaM2;
      }

      if (sort === 'area_low') {
        return a.powierzchniaM2 - b.powierzchniaM2;
      }

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

  if (!items?.length) {
    return (
      <div className="rounded-3xl border border-white/12 bg-[#0f0f0f]/20 p-6 text-white/70">
        Nie masz jeszcze żadnych ogłoszeń.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="w-full xl:max-w-md">
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Szukaj ogłoszenia
            </label>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Np. tytuł ogłoszenia, lokalizacja..."
              className="h-[54px] w-full rounded-2xl border border-white/12 bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#7aa333]/60 focus:bg-black/30"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
            <div className="min-w-[190px]">
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Status
              </label>

              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FilterStatus)}
                  className="h-[54px] w-full appearance-none rounded-2xl border border-white/12 bg-[#161616] px-4 pr-10 text-sm font-medium text-white outline-none transition focus:border-[#7aa333]/60"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="all" className="bg-[#161616] text-white">
                    Wszystkie
                  </option>
                  <option value="active" className="bg-[#161616] text-white">
                    Aktywne
                  </option>
                  <option value="ended" className="bg-[#161616] text-white">
                    Zakończone
                  </option>
                  <option value="featured" className="bg-[#161616] text-white">
                    Wyróżnione
                  </option>
                </select>
                <SelectChevron />
              </div>
            </div>

            <div className="min-w-[250px]">
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Sortowanie
              </label>

              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="h-[54px] w-full appearance-none rounded-2xl border border-white/12 bg-[#161616] px-4 pr-10 text-sm font-medium text-white outline-none transition focus:border-[#7aa333]/60"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="newest" className="bg-[#161616] text-white">
                    Najnowsze
                  </option>
                  <option value="oldest" className="bg-[#161616] text-white">
                    Najstarsze
                  </option>
                  <option value="price_high" className="bg-[#161616] text-white">
                    Cena: od najwyższej
                  </option>
                  <option value="price_low" className="bg-[#161616] text-white">
                    Cena: od najniższej
                  </option>
                  <option value="area_high" className="bg-[#161616] text-white">
                    Powierzchnia: od największej
                  </option>
                  <option value="area_low" className="bg-[#161616] text-white">
                    Powierzchnia: od najmniejszej
                  </option>
                  <option value="expiring" className="bg-[#161616] text-white">
                    Wygasają najszybciej
                  </option>
                </select>
                <SelectChevron />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/8 pt-4 text-sm text-white/55">
          <span>
            Znaleziono: <span className="font-semibold text-white">{filteredItems.length}</span>
          </span>

          {query.trim() ? (
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-white/70">
              Szukasz: {query}
            </span>
          ) : null}

          {status !== 'all' ? (
            <span className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[12px] text-[#9fd14b]">
              Filtr aktywny
            </span>
          ) : null}
        </div>
      </div>

      {!filteredItems.length ? (
        <div className="rounded-3xl border border-white/12 bg-[#0f0f0f]/20 p-6 text-white/70">
          Nie znaleziono ogłoszeń dla wybranych filtrów.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {filteredItems.map((d) => (
            <PanelDzialkaCard key={d.id} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function PanelDzialkaCard({ d }: { d: Dzialka }) {
  const [isPending, startTransition] = useTransition();

  const photos = (d.zdjecia ?? [])
    .slice()
    .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));

  const coverFallback = photos[0]?.url ?? null;
  const loc = d.locationLabel?.trim() || 'Lokalizacja niepodana';
  const area = d.powierzchniaM2 ?? 0;
  const zlZaM2 = area ? Math.round(d.cenaPln / area) : 0;
  const przezn = d.przeznaczenia?.length ? d.przeznaczenia.map(labelPrzeznaczenie).join(', ') : '—';

  const effectiveStatus = getEffectiveStatus(d.status, d.expiresAt);
  const daysLeft = getDaysLeft(d.expiresAt);
  const isFeaturedActive = isFeaturedNow(d);
  const isIndefinite = effectiveStatus === 'AKTYWNE' && !d.expiresAt;

  const viewsCount = d.viewsCount ?? 0;
  const detailViewsCount = d.detailViewsCount ?? 0;

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

  async function runAction(action: () => Promise<void>, errorText: string) {
    startTransition(async () => {
      try {
        await action();
      } catch (e: any) {
        const msg = String(e?.message || '');

        if (msg.includes('NEXT_REDIRECT')) {
          return;
        }

        alert(msg || errorText);
      }
    });
  }

  return (
    <div
      ref={cardRef}
      className={`overflow-hidden rounded-3xl border transition ${
        effectiveStatus === 'ZAKONCZONE'
          ? 'border-white/10 bg-[#0f0f0f]/15 opacity-75'
          : isFeaturedActive
          ? 'border-[#7aa333]/45 bg-[#0f0f0f]/20 shadow-[0_0_0_1px_rgba(122,163,51,0.10)] hover:border-[#7aa333]/70'
          : 'border-white/14 bg-[#0f0f0f]/20 hover:border-white/30'
      }`}
    >
      <Link
        href={`/dzialka/${d.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
      >
        <Carousel
          photos={photos}
          coverFallback={coverFallback}
          title={d.tytul}
          viewsCount={viewsCount}
          detailViewsCount={detailViewsCount}
        />

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.08em] ${
                effectiveStatus === 'AKTYWNE'
                  ? 'border border-green-400/20 bg-green-500/15 text-green-300'
                  : 'border border-red-400/20 bg-red-500/15 text-red-300'
              }`}
            >
              {effectiveStatus === 'AKTYWNE' ? 'AKTYWNE' : 'ZAKOŃCZONE'}
            </span>

            {isFeaturedActive ? (
              <span className="inline-flex items-center rounded-full border border-[#7aa333]/30 bg-[#7aa333]/12 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#9fd14b]">
                WYRÓŻNIONE
              </span>
            ) : null}

            {effectiveStatus === 'AKTYWNE' ? (
              isIndefinite ? (
                <div className="text-[12px] text-white/55">
                  Bezterminowo
                  <span className="ml-2 text-white/40">(do czasu włączenia płatności)</span>
                </div>
              ) : (
                <div className="text-[12px] text-white/55">
                  Widoczne do: {formatDatePL(d.expiresAt)}
                  {typeof daysLeft === 'number' && daysLeft >= 0 ? (
                    <span className="ml-2 text-white/40">({daysLeft} dni)</span>
                  ) : null}
                </div>
              )
            ) : (
              <div className="text-[12px] text-white/45">
                {d.status === 'ZAKONCZONE'
                  ? 'Ogłoszenie zostało zakończone'
                  : 'Ogłoszenie wygasło'}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <img src={ICONS.price} alt="" className="h-5 w-5 opacity-80" />
            <div className="text-[18px] font-semibold" style={{ color: GREEN }}>
              {formatPLN(d.cenaPln)}
              {zlZaM2 ? (
                <span className="ml-2 text-[12px] font-normal text-white/50">
                  ({formatIntPL(zlZaM2)} zł/m²)
                </span>
              ) : null}
            </div>
          </div>

          <InfoLine icon={ICONS.area} value={`${formatIntPL(area)} m²`} />
          <InfoLine icon={ICONS.type} value={przezn} />
          <InfoLine icon={ICONS.loc} value={loc} />
        </div>
      </Link>

      <div className="px-6 pb-6 pt-0">
        <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-4 text-[13px] font-semibold">
          <Link
            href={`/panel/ogloszenia/${d.id}/edytuj`}
            className="text-white/75 transition underline decoration-[rgba(243,239,245,0.35)] decoration-[1px] underline-offset-[8px] hover:text-white"
            onClick={(e) => {
              if (isPending) e.preventDefault();
            }}
          >
            Edytuj ogłoszenie
          </Link>

          <Link
            href={`/dzialka/${d.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/75 transition underline decoration-[rgba(243,239,245,0.35)] decoration-[1px] underline-offset-[8px] hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            Zobacz ogłoszenie
          </Link>

          <ActionBtn
            label={
              isPending
                ? 'Trwa...'
                : effectiveStatus === 'AKTYWNE'
                ? 'Przedłuż ogłoszenie'
                : 'Aktywuj ogłoszenie'
            }
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

          {effectiveStatus === 'AKTYWNE' ? (
            <ActionBtn
              label={isPending ? 'Trwa...' : 'Zakończ ogłoszenie'}
              disabled={isPending}
              onClick={() => {
                const ok = window.confirm('Na pewno zakończyć to ogłoszenie?');
                if (!ok) return;

                runAction(
                  () => zakonczOgloszenieAction(d.id),
                  'Nie udało się zakończyć ogłoszenia.'
                );
              }}
            />
          ) : null}

          {isFeaturedActive ? (
            <span className="text-[#9fd14b]">
              Wyróżnione do: {formatDatePL(d.featuredUntil)}
            </span>
          ) : (
            <ActionBtn
              label={isPending ? 'Trwa...' : 'Wyróżnij ogłoszenie'}
              disabled={isPending}
              accent
              onClick={() =>
                runAction(
                  () => wyroznijOgloszenieAction(d.id),
                  'Nie udało się wyróżnić ogłoszenia.'
                )
              }
            />
          )}

          <ActionBtn
            label={isPending ? 'Trwa...' : 'Usuń ogłoszenie'}
            danger
            disabled={isPending}
            onClick={() => {
              const ok = window.confirm('Na pewno usunąć to ogłoszenie?');
              if (!ok) return;

              runAction(
                () => usunOgloszenieAction(d.id),
                'Nie udało się usunąć ogłoszenia.'
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  danger,
  accent,
  disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      className={`transition disabled:opacity-40 ${
        danger
          ? 'text-red-300 hover:text-red-200'
          : accent
          ? 'text-[#9fd14b] hover:text-[#b6e35e]'
          : 'text-white/75 hover:text-white'
      }`}
      style={{
        textDecoration: 'underline',
        textUnderlineOffset: '8px',
        textDecorationThickness: '1px',
        textDecorationColor: danger
          ? 'rgba(248,113,113,0.55)'
          : accent
          ? 'rgba(122,163,51,0.55)'
          : 'rgba(243,239,245,0.35)',
      }}
    >
      {label}
    </button>
  );
}

function InfoLine({ icon, value }: { icon: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <img src={icon} alt="" className="h-5 w-5 opacity-80" loading="lazy" />
      <div className="text-[14px] leading-snug text-white/90">{value}</div>
    </div>
  );
}

function StatsBadge({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-md">
      <span className="text-white/65">{label}</span>
      <span className="font-semibold text-white">{formatIntPL(value)}</span>
    </div>
  );
}

function Carousel({
  photos,
  coverFallback,
  title,
  viewsCount,
  detailViewsCount,
}: {
  photos: { url: string }[];
  coverFallback: string | null;
  title: string;
  viewsCount: number;
  detailViewsCount: number;
}) {
  const list = photos.length ? photos.map((p) => p.url) : coverFallback ? [coverFallback] : [];
  const has = list.length > 0;
  const [i, setI] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    setI(0);
  }, [photos, coverFallback]);

  const goPrev = () => {
    if (list.length < 2) return;
    setI((v) => (v - 1 + list.length) % list.length);
  };

  const goNext = () => {
    if (list.length < 2) return;
    setI((v) => (v + 1) % list.length);
  };

  const prev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    goPrev();
  };

  const next = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    goNext();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (list.length < 2) return;
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
    touchEndX.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (list.length < 2) return;
    touchEndX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (list.length < 2) return;

    const start = touchStartX.current;
    const end = touchEndX.current ?? e.changedTouches[0]?.clientX ?? null;

    if (start == null || end == null) return;

    const diff = start - end;
    const threshold = 40;

    if (Math.abs(diff) < threshold) return;

    e.preventDefault();
    e.stopPropagation();

    if (diff > 0) {
      goNext();
    } else {
      goPrev();
    }
  };

  return (
    <div
      className="relative aspect-video bg-white/5"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {has ? (
        <>
          <img src={list[i]} alt={title} className="h-full w-full object-cover" loading="lazy" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

          <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
            <StatsBadge label="Wyświetlenia" value={viewsCount} />
            <StatsBadge label="Wejścia" value={detailViewsCount} />
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="text-center text-[18px] font-medium leading-tight text-white drop-shadow">
              {title}
            </div>
          </div>

          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-black/40 text-white opacity-100 backdrop-blur-sm transition md:opacity-0 md:group-hover:opacity-100"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={next}
                className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-black/40 text-white opacity-100 backdrop-blur-sm transition md:opacity-0 md:group-hover:opacity-100"
              >
                ›
              </button>

              <div className="absolute right-4 top-4 flex gap-2">
                {list.slice(0, 6).map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-2 w-2 rounded-full ${idx === i ? 'bg-black' : 'bg-black/40'}`}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-white/50">
          Brak zdjęć
        </div>
      )}
    </div>
  );
}