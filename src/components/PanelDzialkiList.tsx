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
} from '@prisma/client';
import { CardBody } from './CardBody';
import { IconCamera } from './CardIcons';
import { parcelMediaLabel } from '@/lib/media';
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
  transakcja?: TransakcjaTyp | null;
  locationLabel?: string | null;
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

const GREEN = 'var(--brand)';

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

  if (!items?.length) {
    return (
      <div className="rounded-3xl border border-fg/12 bg-surface-2/20 p-6 text-fg/70">
        Nie masz jeszcze żadnych ogłoszeń.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-fg/10 bg-fg/[0.03] p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="w-full xl:max-w-md">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg/68">
              Szukaj ogłoszenia
            </label>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Np. tytuł ogłoszenia, lokalizacja..."
              className="h-[54px] w-full rounded-2xl border border-fg/12 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/62 focus:border-brand/60 focus:bg-black/30"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
            <div className="min-w-[190px]">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg/68">
                Status
              </label>

              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FilterStatus)}
                  className="h-[54px] w-full appearance-none rounded-2xl border border-fg/12 bg-surface px-4 pr-10 text-sm font-medium text-fg outline-none transition focus:border-brand/60"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="all" className="bg-surface text-fg">
                    Wszystkie
                  </option>
                  <option value="active" className="bg-surface text-fg">
                    Aktywne
                  </option>
                  <option value="ended" className="bg-surface text-fg">
                    Zakończone
                  </option>
                  <option value="featured" className="bg-surface text-fg">
                    Wyróżnione
                  </option>
                </select>
                <SelectChevron />
              </div>
            </div>

            <div className="min-w-[250px]">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg/68">
                Sortowanie
              </label>

              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="h-[54px] w-full appearance-none rounded-2xl border border-fg/12 bg-surface px-4 pr-10 text-sm font-medium text-fg outline-none transition focus:border-brand/60"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="newest" className="bg-surface text-fg">
                    Najnowsze
                  </option>
                  <option value="oldest" className="bg-surface text-fg">
                    Najstarsze
                  </option>
                  <option value="price_high" className="bg-surface text-fg">
                    Cena: od najwyższej
                  </option>
                  <option value="price_low" className="bg-surface text-fg">
                    Cena: od najniższej
                  </option>
                  <option value="area_high" className="bg-surface text-fg">
                    Powierzchnia: od największej
                  </option>
                  <option value="area_low" className="bg-surface text-fg">
                    Powierzchnia: od najmniejszej
                  </option>
                  <option value="expiring" className="bg-surface text-fg">
                    Wygasają najszybciej
                  </option>
                </select>
                <SelectChevron />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-fg/8 pt-4 text-sm text-fg/70">
          <span>
            Znaleziono: <span className="font-semibold text-fg">{filteredItems.length}</span>
          </span>

          {query.trim() ? (
            <span className="inline-flex rounded-full border border-fg/10 bg-fg/[0.04] px-3 py-1 text-[12px] text-fg/70">
              Szukasz: {query}
            </span>
          ) : null}

          {status !== 'all' ? (
            <span className="inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[12px] text-brand-bright">
              Filtr aktywny
            </span>
          ) : null}
        </div>
      </div>

      {!filteredItems.length ? (
        <div className="rounded-3xl border border-fg/12 bg-surface-2/20 p-6 text-fg/70">
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
  const [actionError, setActionError] = useState<string | null>(null);

  const photos = (d.zdjecia ?? [])
    .slice()
    .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));

  const coverFallback = photos[0]?.url ?? null;
  const loc = d.locationLabel?.trim() || 'Lokalizacja niepodana';
  const area = d.powierzchniaM2 ?? 0;
  const isRent = d.transakcja === 'WYNAJEM';
  const przezn = d.przeznaczenia?.length ? d.przeznaczenia.map(labelPrzeznaczenie).join(', ') : '—';
  const media = parcelMediaLabel(d);

  const effectiveStatus = getEffectiveStatus(d.status, d.expiresAt);
  const daysLeft = getDaysLeft(d.expiresAt);
  const isFeaturedActive = isFeaturedNow(d);
  const isIndefinite = effectiveStatus === 'AKTYWNE' && !d.expiresAt;

  const viewsCount = d.viewsCount ?? 0;
  const detailViewsCount = d.detailViewsCount ?? 0;
  const favoritesCount = d.favoritesCount ?? 0;
  const phoneClicksCount = d.phoneClicksCount ?? 0;
  const messageClicksCount = d.messageClicksCount ?? 0;

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
      setActionError(null);

      try {
        await action();
      } catch (e: any) {
        const msg = String(e?.message || '');

        if (msg.includes('NEXT_REDIRECT')) {
          return;
        }

        setActionError(msg || errorText);
      }
    });
  }

  return (
    <div
      ref={cardRef}
      className={`group flex flex-col overflow-hidden rounded-3xl border transition ${
        effectiveStatus === 'ZAKONCZONE'
          ? 'border-fg/10 bg-surface-2/15 opacity-85'
          : isFeaturedActive
          ? 'border-brand/45 bg-surface-2/20 shadow-[0_0_0_1px_rgba(122,163,51,0.10)] hover:border-brand/70'
          : 'border-fg/14 bg-surface-2/20 hover:border-fg/30'
      }`}
    >
      {/* Klikalna oferta: te same elementy co karta na /kup. Karuzela i
          wspolne CardBody (cena, tytul, lokalizacja, fakty). */}
      <Link
        href={`/dzialka/${d.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Carousel
          photos={photos}
          coverFallback={coverFallback}
          title={d.tytul}
          featured={isFeaturedActive}
          rent={isRent}
        />

        <CardBody
          cena={d.cenaPln}
          isRent={isRent}
          tytul={d.tytul}
          loc={loc}
          area={area}
          przezn={przezn}
          media={media}
        />
      </Link>

      {/* Narzedzia wlasciciela: wyniki, status i akcje. Poza <Link>, zeby
          klik w statystyki lub przyciski nie otwieral oferty. */}
      <div className="mt-auto border-t border-fg/8 px-5 pb-5 pt-5 md:px-6 md:pb-6">
        <PanelStats
          viewsCount={viewsCount}
          detailViewsCount={detailViewsCount}
          favoritesCount={favoritesCount}
          phoneClicksCount={phoneClicksCount}
          messageClicksCount={messageClicksCount}
        />

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px]">
          <StatusPill effectiveStatus={effectiveStatus} />

          {effectiveStatus === 'AKTYWNE' ? (
            isIndefinite ? (
              <span className="text-fg/68">Widoczne bezterminowo</span>
            ) : (
              <span className="text-fg/68">
                Widoczne do: {formatDatePL(d.expiresAt)}
                {typeof daysLeft === 'number' && daysLeft >= 0
                  ? ` (${daysLeft} dni)`
                  : ''}
              </span>
            )
          ) : (
            <span className="text-red-300/70">
              {d.status === 'ZAKONCZONE'
                ? 'Ogłoszenie zakończone'
                : 'Ogłoszenie wygasło'}
            </span>
          )}
        </div>

        {actionError ? (
          <div className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {actionError}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <ActionBtnAsLink
            href={`/panel/ogloszenia/${d.id}/edytuj`}
            label="Edytuj"
            title="Zmień zdjęcia, cenę, opis i dane ogłoszenia"
            disabled={isPending}
          />

          <ActionBtnAsLink
            href={`/dzialka/${d.id}`}
            label="Zobacz"
            title="Otwórz ogłoszenie tak, jak widzą je kupujący"
            target="_blank"
            rel="noopener noreferrer"
          />

          <ActionBtn
            label={
              isPending
                ? 'Trwa...'
                : effectiveStatus === 'AKTYWNE'
                ? 'Przedłuż'
                : 'Aktywuj'
            }
            title={
              effectiveStatus === 'AKTYWNE'
                ? 'Odśwież ważność, żeby ogłoszenie pozostało widoczne na portalu'
                : 'Przywróć zakończone ogłoszenie na portal'
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
              label={isPending ? 'Trwa...' : 'Zakończ'}
              title="Zdejmij ogłoszenie z portalu (możesz je później aktywować)"
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
            <span
              className="inline-flex min-h-[40px] items-center rounded-full border border-brand/30 bg-brand/12 px-4 text-[12px] font-semibold text-brand-bright"
              title="Ogłoszenie jest aktualnie wyróżnione"
            >
              Wyróżnione do: {formatDatePL(d.featuredUntil)}
            </span>
          ) : (
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
          )}

          <ActionBtn
            label={isPending ? 'Trwa...' : 'Usuń'}
            title="Trwale usuń ogłoszenie i jego zdjęcia (bez możliwości cofnięcia)"
            danger
            disabled={isPending}
            onClick={() => {
              const ok = window.confirm(
                'Czy na pewno chcesz trwale usunąć to ogłoszenie? Tej operacji nie można cofnąć. Ogłoszenie i jego zdjęcia zostaną usunięte na zawsze.'
              );
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

function PanelStats({
  viewsCount,
  detailViewsCount,
  favoritesCount,
  phoneClicksCount,
  messageClicksCount,
}: {
  viewsCount: number;
  detailViewsCount: number;
  favoritesCount: number;
  phoneClicksCount: number;
  messageClicksCount: number;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg/64">
          Wyniki ogłoszenia
        </span>
        <span className="h-px flex-1 bg-fg/10" />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <StatRow label="Wyświetlenia" hint="na liście i mapie" value={viewsCount} />
        <StatRow label="Wejścia" hint="otwarcia ogłoszenia" value={detailViewsCount} />
        <StatRow label="Ulubione" hint="zapisali ofertę" value={favoritesCount} accent />
        <StatRow label="Telefony" hint="kliknięcia w numer" value={phoneClicksCount} />
        <StatRow
          label="Wiadomości"
          hint="otwarcia formularza kontaktu"
          value={messageClicksCount}
          full
        />
      </div>
    </div>
  );
}

function StatRow({
  label,
  hint,
  value,
  accent = false,
  full = false,
}: {
  label: string;
  hint: string;
  value: number;
  accent?: boolean;
  full?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-fg/8 pb-2.5 ${
        full ? 'col-span-2' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-fg/80">{label}</div>
        <div className="text-[10px] leading-tight text-fg/62">{hint}</div>
      </div>
      <div
        className={`text-[19px] font-semibold leading-none tabular-nums ${
          accent ? 'text-brand-bright' : 'text-fg'
        }`}
      >
        {formatIntPL(value)}
      </div>
    </div>
  );
}

function StatusPill({ effectiveStatus }: { effectiveStatus: DzialkaStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.08em] ${
        effectiveStatus === 'AKTYWNE'
          ? 'border border-green-400/20 bg-green-500/15 text-green-300'
          : 'border border-red-400/20 bg-red-500/15 text-red-300'
      }`}
    >
      {effectiveStatus === 'AKTYWNE' ? 'AKTYWNE' : 'ZAKOŃCZONE'}
    </span>
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
          ? 'border-brand/30 bg-brand/12 text-brand-bright hover:border-brand/50 hover:bg-brand/18'
          : 'border-fg/14 bg-fg/[0.03] text-fg/80 hover:border-fg/28 hover:bg-fg/[0.05] hover:text-fg'
      }`}
    >
      {label}
    </button>
  );
}

function Carousel({
  photos,
  coverFallback,
  title,
  featured,
  rent = false,
}: {
  photos: { url: string }[];
  coverFallback: string | null;
  title: string;
  featured: boolean;
  rent?: boolean;
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
      className="relative aspect-[16/10] overflow-hidden bg-fg/5 md:aspect-video"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {has ? (
        <>
          <img
            src={list[i] ?? list[0]}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />

          {featured ? (
            <div className="absolute left-4 top-4 z-10">
              <span className="inline-flex items-center rounded-full border border-brand/35 bg-brand/85 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-black shadow-lg">
                WYRÓŻNIONE
              </span>
            </div>
          ) : null}

          {rent ? (
            <div className="absolute bottom-4 left-4 z-10">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-black/65 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-white shadow-lg backdrop-blur-sm">
                NA WYNAJEM
              </span>
            </div>
          ) : null}

          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-3 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-black/40 text-white opacity-100 backdrop-blur-sm transition md:opacity-0 md:group-hover:opacity-100"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={next}
                className="absolute right-3 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-black/40 text-white opacity-100 backdrop-blur-sm transition md:opacity-0 md:group-hover:opacity-100"
              >
                ›
              </button>

              <div className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium tabular-nums text-white backdrop-blur-sm">
                <IconCamera className="h-3.5 w-3.5" />
                {i + 1}/{list.length}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center bg-surface">
          <span className="text-[12px] tracking-[0.12em] text-fg/30">Zdjęcie wkrótce</span>
        </div>
      )}
    </div>
  );
}