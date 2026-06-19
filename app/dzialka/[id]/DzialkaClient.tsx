'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { HeartIcon } from '@/components/OfferCard';

type Photo = { id?: string; url: string; publicId?: string; kolejnosc?: number };

type Dzialka = {
  id: string;
  tytul: string;
  opis?: string | null;
  cenaPln: number;
  powierzchniaM2: number;
  transakcja?: 'SPRZEDAZ' | 'WYNAJEM' | string | null;

  telefon?: string | null;
  email?: string | null;

  locationLabel?: string | null;
  locationMode?: 'EXACT' | 'APPROX' | string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;

  przeznaczenia?: string[];

  prad?: string | null;
  woda?: string | null;
  kanalizacja?: string | null;
  gaz?: string | null;
  swiatlowod?: string | null;

  wzWydane?: boolean | null;
  mpzp?: boolean | null;
  projektDomu?: boolean | null;

  klasaZiemi?: string | null;
  wymiary?: string | null;
  ksiegaWieczysta?: string | null;

  sprzedajacyTyp?: 'PRYWATNIE' | 'BIURO' | string | null;
  sprzedajacyImie?: string | null;
  biuroNazwa?: string | null;
  biuroOpiekun?: string | null;
  biuroLogoUrl?: string | null;
  numerOferty?: string | null;

  zdjecia?: Photo[];
};

const BG = 'var(--bg)';
const FG = 'var(--fg)';

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

function Hr({ className }: { className?: string }) {
  return <div className={cx('border-b border-fg/10', className)} />;
}

function formatPLN(value: number) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatIntPL(value: number) {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(value);
}

function labelPrzeznaczenie(p: string) {
  const map: Record<string, string> = {
    INWESTYCYJNA: 'Inwestycyjna',
    BUDOWLANA: 'Budowlana',
    ROLNA: 'Rolna',
    LESNA: 'Leśna',
    REKREACYJNA: 'Rekreacyjna',
    SIEDLISKOWA: 'Siedliskowa',
  };

  return map[p] ?? p;
}

function labelPrad(v?: string | null) {
  if (!v || v === 'BRAK_PRZYLACZA') return null;
  const map: Record<string, string> = {
    PRZYLACZE_NA_DZIALCE: 'Przyłącze na działce',
    PRZYLACZE_W_DRODZE: 'Przyłącze w drodze',
    WARUNKI_PRZYLACZENIA_WYDANE: 'Warunki przyłączenia wydane',
    MOZLIWOSC_PRZYLACZENIA: 'Możliwość przyłączenia',
  };
  return map[v] ?? v;
}

function labelWoda(v?: string | null) {
  if (!v || v === 'BRAK_PRZYLACZA') return null;
  const map: Record<string, string> = {
    WODOCIAG_NA_DZIALCE: 'Wodociąg na działce',
    WODOCIAG_W_DRODZE: 'Wodociąg w drodze',
    STUDNIA_GLEBINOWA: 'Studnia głębinowa',
    MOZLIWOSC_PODLACZENIA: 'Możliwość podłączenia',
  };
  return map[v] ?? v;
}

function labelKanalizacja(v?: string | null) {
  if (!v || v === 'BRAK') return null;
  const map: Record<string, string> = {
    MIEJSKA_NA_DZIALCE: 'Miejska na działce',
    MIEJSKA_W_DRODZE: 'Miejska w drodze',
    SZAMBO: 'Szambo',
    PRZYDOMOWA_OCZYSZCZALNIA: 'Przydomowa oczyszczalnia',
    MOZLIWOSC_PODLACZENIA: 'Możliwość podłączenia',
  };
  return map[v] ?? v;
}

function labelGazShort(v?: string | null) {
  if (!v || v === 'BRAK') return null;
  const map: Record<string, string> = {
    GAZ_NA_DZIALCE: 'Na działce',
    GAZ_W_DRODZE: 'W drodze',
    MOZLIWOSC_PODLACZENIA: 'Możliwość podłączenia',
  };
  return map[v] ?? v.replace(/^GAZ_/, '');
}

function labelSwiatlowod(v?: string | null) {
  if (!v || v === 'BRAK') return null;
  const map: Record<string, string> = {
    W_DRODZE: 'W drodze',
    NA_DZIALCE: 'Na działce',
    MOZLIWOSC_PODLACZENIA: 'Możliwość podłączenia',
  };
  return map[v] ?? v;
}

function formatOpis(raw?: string | null) {
  const text = (raw ?? '').trim();
  if (!text) return null;

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(text);

  if (looksLikeHtml) {
    return text
      .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '</p><p>')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br />');
  }

  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function SmartImg({
  src,
  alt,
  className,
  eager = false,
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  onClick?: () => void;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onClick={onClick}
    />
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

export default function DzialkaPage({ initial }: { initial?: Dzialka | null }) {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string | undefined) ?? initial?.id;

  const [d, setD] = useState<Dzialka | null>(initial ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!initial);

  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [shareDone, setShareDone] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  // Gdy gest był przesunięciem (zmiana zdjęcia), tłumimy następujący po nim klik,
  // żeby swipe na głównym zdjęciu nie otwierał jednocześnie pełnego ekranu.
  const swipeHandledRef = useRef(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (initial) return; // dane przyszły z SSR — koniec podwójnego pobierania

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/dzialki/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`GET /api/dzialki/${id} -> ${res.status}`);

        const data = await res.json();
        if (alive) {
          setD(data);
          setIdx(0);
        }
      } catch (e: any) {
        if (alive) setErr(e?.message ?? 'Błąd pobierania');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, initial]);

  useEffect(() => {
    if (!id) return;

    const key = `TD_DETAIL_VIEWED_${id}`;
    let shouldTrack = true;

    try {
      if (sessionStorage.getItem(key)) {
        shouldTrack = false;
      } else {
        sessionStorage.setItem(key, '1');
      }
    } catch {
      shouldTrack = true;
    }

    if (!shouldTrack) return;

    fetch(`/api/dzialki/${id}/track-detail`, {
      method: 'POST',
      cache: 'no-store',
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
  if (!d?.id) return;

  fetch(`/api/favorites?ids=${d.id}`, {
    cache: 'no-store',
  })
    .then((r) => r.json())
    .then((data) => {
      const ids = Array.isArray(data?.favoriteIds)
        ? data.favoriteIds
        : [];

      setIsFavorite(ids.includes(d.id));
    })
    .catch(() => {});
}, [d?.id]);

  const photos = useMemo(() => {
    return (d?.zdjecia ?? [])
      .slice()
      .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0))
      .map((z) => z.url)
      .filter(Boolean);
  }, [d]);

  useEffect(() => {
    setIdx(0);
  }, [photos.length]);

  const hasPhotos = photos.length > 0;
  const cover = hasPhotos ? photos[Math.min(idx, photos.length - 1)] : null;

  const area = d?.powierzchniaM2 ?? 0;
  const isRent = d?.transakcja === 'WYNAJEM';
  // zł/m² liczymy tylko dla sprzedaży — przy wynajmie cena to czynsz, nie cena gruntu.
  const zlZaM2 = !isRent && area ? Math.round((d?.cenaPln ?? 0) / area) : 0;

  const przezn = Array.isArray(d?.przeznaczenia) ? d.przeznaczenia.filter(Boolean) : [];
  const przeznText = przezn.length ? przezn.map(labelPrzeznaczenie).join(', ') : null;

  const loc = d?.locationLabel?.trim() || null;
  const isApproxLocation = d?.locationMode === 'APPROX';

  const mapSrc = useMemo(() => {
  if (!d) return null;
  if (!d.lat || !d.lng) return null;

  if (d.locationMode === 'APPROX') {
    return `https://www.google.com/maps?ll=${d.lat},${d.lng}&z=12&output=embed`;
  }

  return `https://www.google.com/maps?q=${d.lat},${d.lng}&z=15&output=embed`;
}, [d]);

  // Link do NASZEJ mapy ofert — wyśrodkowanej na tej działce, z jej pinem
  // podświetlonym i ofertami w okolicy. Zostawiamy użytkownika u nas, nie w Google.
  const naszaMapaHref = useMemo(() => {
    if (!d?.lat || !d?.lng) return null;
    const sp = new URLSearchParams({
      lat: String(d.lat),
      lng: String(d.lng),
      radius: '10',
      focus: d.id,
    });
    return `/kup?${sp.toString()}`;
  }, [d]);

  const prad = labelPrad(d?.prad ?? null);
  const woda = labelWoda(d?.woda ?? null);
  const kan = labelKanalizacja(d?.kanalizacja ?? null);
  const gaz = labelGazShort(d?.gaz ?? null);
  const sw = labelSwiatlowod(d?.swiatlowod ?? null);
  const hasUzbrojenie = Boolean(prad || woda || kan || gaz || sw);

  const opis = formatOpis(d?.opis);

  const telefon = (d?.telefon ?? '').trim() || null;
  const telefonHref = telefon ? telefon.replace(/[^\d+]/g, '') : null;
  const numerOferty = (d?.numerOferty ?? '').trim() || null;
  const smsText = numerOferty
  ? `Dzień dobry, piszę w sprawie oferty nr ${numerOferty} z tylkodzialki.pl.`
  : `Dzień dobry, piszę w sprawie działki z tylkodzialki.pl.`;

  const smsHref = telefonHref
  ? `sms:${telefonHref}?&body=${encodeURIComponent(smsText)}`
  : null;
  const klasaZiemi = (d?.klasaZiemi ?? '').trim() || null;
  const wymiary = (d?.wymiary ?? '').trim() || null;
  const ksiega = (d?.ksiegaWieczysta ?? '').trim() || null;

  const sprzedajacyTyp = d?.sprzedajacyTyp ?? null;
  const sprzedajacyImie = (d?.sprzedajacyImie ?? '').trim() || null;
  const biuroOpiekun = (d?.biuroOpiekun ?? '').trim() || null;
  const biuroLogoUrl = (d?.biuroLogoUrl ?? '').trim() || null;

  const hasDocs = Boolean(d?.mpzp || d?.wzWydane || d?.projektDomu);
  const showMap = Boolean(mapSrc);


  const trackContact = (type: 'phone' | 'message') => {
    if (!id) return;

    const url = `/api/dzialki/${id}/track-contact`;
    const body = JSON.stringify({ type });

    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
        return;
      }

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  };

  const toggleFavorite = async () => {
    if (!d?.id) return;

    try {
      setFavoriteLoading(true);

      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dzialkaId: d.id }),
      });

      if (res.status === 401) {
        setFavoriteModalOpen(true);
        return;
      }

      const data = await res.json();
      if (typeof data?.isFavorite === 'boolean') {
        setIsFavorite(data.isFavorite);
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  // Udostępnianie oferty: natywny arkusz telefonu (Web Share API), a gdy go brak
  // (zwykle desktop) — kopiowanie linku do schowka. Darmowy kanał wzrostu.
  const shareOffer = async () => {
    if (typeof window === 'undefined') return;

    const url = window.location.href;
    const title = d?.tytul?.trim() || 'Działka na sprzedaż';
    const bits = [
      area ? `${formatIntPL(area)} m²` : null,
      loc,
      d?.cenaPln ? `${formatIntPL(d.cenaPln)} zł` : null,
    ].filter(Boolean);
    const text = bits.length ? `${title}, ${bits.join(', ')}` : title;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {
      return; // użytkownik anulował natywne udostępnianie
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareDone(true);
        window.setTimeout(() => setShareDone(false), 2200);
        return;
      }
    } catch {
      // brak dostępu do schowka — ostatecznością jest prompt
    }

    try {
      window.prompt('Skopiuj link do oferty:', url);
    } catch {
      /* nic więcej nie zrobimy */
    }
  };

  const prev = () => {
    if (photos.length < 2) return;
    setIdx((p) => (p - 1 + photos.length) % photos.length);
  };

  const next = () => {
    if (photos.length < 2) return;
    setIdx((p) => (p + 1) % photos.length);
  };

  const onBackToListClick = (e: React.MouseEvent) => {
    e.preventDefault();

    try {
      const url = sessionStorage.getItem('TD_KUP_URL') || '/kup';
      const y = sessionStorage.getItem('TD_KUP_SCROLL_Y');

      if (y) sessionStorage.setItem('TD_KUP_RESTORE_Y', y);

      router.push(url);
    } catch {
      router.push('/kup');
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches?.[0];
    if (!t) return;
    swipeHandledRef.current = false;
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current;
    const sy = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (sx == null || sy == null) return;

    const t = e.changedTouches?.[0];
    if (!t) return;

    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    if (Math.abs(dy) > Math.abs(dx)) return;

    const TH = 40;
    if (dx > TH) {
      swipeHandledRef.current = true;
      prev();
    } else if (dx < -TH) {
      swipeHandledRef.current = true;
      next();
    }
  };

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!id) {
    return (
      <main className="min-h-screen" style={{ background: BG, color: FG }}>
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="text-sm text-red-300">Brak ID w URL.</div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: BG, color: FG }}>
        <div className="mx-auto max-w-6xl px-4 py-10">
          <Link
            href="/kup"
            scroll={false}
            onClick={onBackToListClick}
            className="inline-flex items-center gap-2 text-[13px] leading-none py-2 tracking-[0.18em] uppercase text-fg/70 hover:text-fg transition"
          >
            <span className="relative top-[-1px]">←</span> Wróć do listy
          </Link>

          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <div className="overflow-hidden rounded-3xl bg-surface-2/20">
              <div className="aspect-video animate-pulse bg-fg/5" />
              <div className="p-6 space-y-4">
                <div className="h-4 w-40 animate-pulse rounded bg-fg/5" />
                <div className="h-4 w-64 animate-pulse rounded bg-fg/5" />
              </div>
            </div>

            <div className="rounded-3xl bg-surface-2/20 p-6 space-y-4">
              <div className="h-5 w-64 animate-pulse rounded bg-fg/5" />
              <div className="h-4 w-48 animate-pulse rounded bg-fg/5" />
              <div className="h-4 w-56 animate-pulse rounded bg-fg/5" />
              <div className="h-4 w-72 animate-pulse rounded bg-fg/5" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (err || !d) {
    return (
      <main className="min-h-screen" style={{ background: BG, color: FG }}>
        <div className="mx-auto max-w-6xl px-4 py-10">
          <Link
            href="/kup"
            scroll={false}
            onClick={onBackToListClick}
            className="inline-flex items-center gap-2 text-[13px] leading-none py-2 tracking-[0.18em] uppercase text-fg/70 hover:text-fg transition"
          >
            <span className="relative top-[-1px]">←</span> Wróć do listy
          </Link>

          <div className="mt-6 rounded-3xl bg-surface-2/20 p-6">
            <div className="font-medium text-fg/90">Nie udało się załadować ogłoszenia</div>
            <div className="mt-2 text-sm text-fg/72">{err ?? 'Brak danych'}</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={{ color: FG }}>
      {/* Delikatny zielony gradient od góry — dodaje charakteru jasnej stronie oferty. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[520px]"
        style={{
          background:
            'radial-gradient(80% 70% at 50% -12%, rgba(122,163,51,0.16), rgba(122,163,51,0) 70%)',
        }}
      />

      <div
        className={cx(
          'relative z-10 mx-auto max-w-6xl px-4 pt-6',
          telefon ? 'pb-24 md:pb-10' : 'pb-10'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/kup"
            scroll={false}
            onClick={onBackToListClick}
            className="inline-flex items-center gap-2 text-[13px] leading-none py-2 tracking-[0.18em] uppercase text-fg/70 hover:text-fg transition"
          >
            <span className="relative top-[-1px]">←</span> Wróć do listy
          </Link>

          {/* Ulubione + udostępnij — same ikony, na wysokości „Wróć do listy", po prawej. */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={favoriteLoading}
              onClick={toggleFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? 'W ulubionych' : 'Dodaj do ulubionych'}
              className={cx(
                'group flex h-9 w-9 items-center justify-center transition disabled:cursor-wait disabled:opacity-60',
                isFavorite ? 'text-brand-text' : 'text-brand-text/85 hover:text-brand-text'
              )}
            >
              <HeartIcon filled={isFavorite} />
            </button>

            <button
              type="button"
              onClick={shareOffer}
              aria-label="Udostępnij ofertę"
              className="group flex h-9 w-9 items-center justify-center text-brand-text transition hover:text-brand-bright"
            >
              <ShareIcon className="h-[21px] w-[21px]" />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-0 lg:gap-10 lg:grid-cols-2">
          <section className="min-w-0 lg:space-y-8">
            <div className="min-w-0 -mx-4 overflow-hidden rounded-none bg-surface-2/20 lg:mx-0 lg:rounded-3xl">
              <div
                className="relative aspect-[4/3] touch-pan-y bg-fg/5 lg:aspect-video"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                {cover ? (
                  <>
                    <SmartImg
                      src={cover}
                      alt={d.tytul}
                      className="h-full w-full object-cover cursor-zoom-in"
                      eager
                      onClick={() => {
                        if (swipeHandledRef.current) {
                          swipeHandledRef.current = false;
                          return;
                        }
                        setOpen(true);
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-fg/70">
                    Brak zdjęć
                  </div>
                )}

                {hasPhotos && photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 hidden h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm border border-white/10 lg:flex"
                      aria-label="Poprzednie"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      className="absolute right-3 top-1/2 -translate-y-1/2 hidden h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm border border-white/10 lg:flex"
                      aria-label="Następne"
                    >
                      ›
                    </button>

                    <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white/85 border border-white/10 backdrop-blur-sm">
                      {idx + 1}/{photos.length}
                    </div>
                  </>
                )}
              </div>

              {hasPhotos && photos.length > 1 && (
                <div
                  className={cx(
                    'td-thumbstrip px-4 py-3 lg:px-3',
                    'flex flex-nowrap gap-2',
                    'overflow-x-auto overscroll-x-contain',
                    'min-w-0'
                  )}
                >
                  {photos.map((u, i) => (
                    <button
                      key={u + i}
                      type="button"
                      onClick={() => setIdx(i)}
                      className={cx(
                        'shrink-0 h-16 w-28 overflow-hidden rounded-2xl border transition',
                        i === idx ? 'border-fg/60' : 'border-fg/10 opacity-85 hover:opacity-100'
                      )}
                      title={`Zdjęcie ${i + 1}`}
                    >
                      <SmartImg
                        src={u}
                        alt={`Zdjęcie ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {opis ? (
              <div className="hidden lg:block">
                <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">Opis</div>
                <div
                  className="td-opis mt-4 text-[15px] leading-relaxed text-fg/85"
                  dangerouslySetInnerHTML={{ __html: opis }}
                />
              </div>
            ) : null}
          </section>

          <aside className="min-w-0 -mx-4 rounded-none bg-surface-2/20 lg:mx-0 lg:rounded-3xl">
            <div className="px-4 pb-6 pt-0 lg:p-7">
              {isRent ? (
                <span className="mb-1 flex w-fit items-center rounded-full border border-fg/30 bg-fg/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg/90 lg:mb-0">
                  Na wynajem
                </span>
              ) : null}

              <h1 className="mt-0 text-[24px] md:text-[28px] font-semibold tracking-tight text-fg leading-[1.12] break-words lg:mt-2">
                {d.tytul}
              </h1>

              <Hr className="mt-6" />

              <FieldBlock label={isRent ? 'Cena najmu' : 'Cena'}>
                <div className="min-w-0 text-[15px] md:text-[16px] font-medium text-fg/95 break-words">
                  {formatPLN(d.cenaPln)}
                  {isRent ? (
                    <span className="ml-1 text-[13px] text-fg/72 font-normal">/mc</span>
                  ) : null}
                  {zlZaM2 ? (
                    <span className="ml-2 text-[12px] text-fg/70 font-normal">
                      ({formatIntPL(zlZaM2)} zł/m²)
                    </span>
                  ) : null}
                </div>
              </FieldBlock>

              <Hr />

              <FieldBlock label="Powierzchnia">
                <div className="text-[15px] md:text-[16px] font-medium text-fg/95 break-words">
                  {formatIntPL(area)} m²
                </div>
              </FieldBlock>

              <Hr />

              {przeznText ? (
                <>
                  <FieldBlock label="Przeznaczenie">
                    <div className="min-w-0 text-fg/90 text-[14px] leading-snug whitespace-normal break-words">
                      {przeznText}
                    </div>
                  </FieldBlock>
                  <Hr />
                </>
              ) : null}

              {sprzedajacyTyp === 'PRYWATNIE' ? (
                <>
                  <FieldBlock label="Ogłoszenie prywatne">
                    <div className="space-y-2 text-[14px] text-fg/85">
                      {sprzedajacyImie ? (
                        <div className="break-words">
                          Imię: <span className="text-fg/95">{sprzedajacyImie}</span>
                        </div>
                      ) : null}
                    </div>
                  </FieldBlock>
                  <Hr />
                </>
              ) : null}

              {sprzedajacyTyp === 'BIURO' ? (
                <>
                  <FieldBlock label="Ogłoszenie biura nieruchomości">
                    <div className="space-y-3 text-[14px] text-fg/85">
                      {biuroOpiekun ? (
                        <div className="break-words">
                          Opiekun: <span className="text-fg/95">{biuroOpiekun}</span>
                        </div>
                      ) : null}

                      {biuroLogoUrl ? (
                        <div className="w-fit overflow-hidden rounded-2xl border border-fg/10 bg-fg/[0.03] p-3">
                          <img
                            src={biuroLogoUrl}
                            alt="Logo biura"
                            className="h-16 w-auto max-w-[140px] object-contain"
                          />
                        </div>
                      ) : null}
                    </div>
                  </FieldBlock>
                  <Hr />
                </>
              ) : null}

              {telefon ? (
                <>
                  <FieldBlock label="Kontakt">
                    <a
                      href={`tel:${telefon.replace(/\s+/g, '')}`}
                      onClick={() => trackContact('phone')}
                      className="min-w-0 text-[15px] md:text-[16px] font-medium text-fg/95 underline decoration-white/20 underline-offset-8 hover:decoration-white/40 transition break-all"
                    >
                      {telefon}
                    </a>
                  </FieldBlock>
                  <Hr />
                </>
              ) : null}

              {numerOferty ? (
                <>
                  <FieldBlock label="Numer oferty">
                    <div className="text-fg/90 text-[14px] break-words">{numerOferty}</div>
                  </FieldBlock>
                  <Hr />
                </>
              ) : null}

              {hasUzbrojenie ? (
                <>
                  <FieldBlock label="Uzbrojenie">
                    <div className="space-y-2 text-[14px] text-fg/85">
                      {prad ? <div>Prąd: <span className="text-fg/95">{prad}</span></div> : null}
                      {woda ? <div>Woda: <span className="text-fg/95">{woda}</span></div> : null}
                      {kan ? <div>Kanalizacja: <span className="text-fg/95">{kan}</span></div> : null}
                      {gaz ? <div>Gaz: <span className="text-fg/95">{gaz}</span></div> : null}
                      {sw ? <div>Światłowód: <span className="text-fg/95">{sw}</span></div> : null}
                    </div>
                  </FieldBlock>
                  <Hr />
                </>
              ) : null}

              {hasDocs ? (
                <>
                  <FieldBlock label="Dokumenty / plan">
                    <div className="space-y-2 text-[14px] text-fg/85">
                      {d.mpzp ? <div>Obowiązuje MPZP</div> : null}
                      {d.wzWydane ? <div>Wydane warunki zabudowy</div> : null}
                      {d.projektDomu ? <div>Działka posiada projekt domu</div> : null}
                    </div>
                  </FieldBlock>
                  <Hr />
                </>
              ) : null}

              {(klasaZiemi || wymiary || ksiega) ? (
                <>
                  <FieldBlock label="Dodatkowe informacje">
                    <div className="space-y-2 text-[14px] text-fg/85">
                      {klasaZiemi ? <div>Klasa ziemi: <span className="text-fg/95">{klasaZiemi}</span></div> : null}
                      {wymiary ? <div>Wymiary: <span className="text-fg/95">{wymiary}</span></div> : null}
                      {ksiega ? <div>Księga wieczysta: <span className="text-fg/95">{ksiega}</span></div> : null}
                    </div>
                  </FieldBlock>
                  <Hr />
                </>
              ) : null}

              {opis ? (
                <>
                  <div className="py-5 lg:hidden">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">Opis</div>
                    <div
                      className="td-opis mt-4 text-[15px] leading-relaxed text-fg/85"
                      dangerouslySetInnerHTML={{ __html: opis }}
                    />
                  </div>
                  <Hr className="lg:hidden" />
                </>
              ) : null}

              {(loc || showMap || isApproxLocation) ? (
                <div className="py-5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">Lokalizacja</div>

                  {loc ? (
                    <div className="mt-2 min-w-0 text-fg/90 text-[14px] leading-snug whitespace-normal break-words">
                      {loc}
                    </div>
                  ) : null}

                  {isApproxLocation ? (
                    <div className="mt-3 text-[12px] uppercase tracking-[0.18em] text-fg/68">
                     Lokalizacja przybliżona
                   </div>
                  ) : null}

                  {naszaMapaHref ? (
                    <Link
                      href={naszaMapaHref}
                      className="mt-4 inline-flex text-[12px] tracking-[0.18em] uppercase text-fg/70 hover:text-fg transition underline decoration-white/20 underline-offset-8"
                    >
                      ZOBACZ NA MAPIE OFERT
                    </Link>
                  ) : null}

                  {showMap && naszaMapaHref ? (
  <Link
    href={naszaMapaHref}
    aria-label="Zobacz tę działkę na mapie ofert"
    className="group mt-4 block overflow-hidden rounded-3xl bg-surface-2/20"
  >
    <div className="relative aspect-video">
      {/* Mapa to tylko podgląd — klik nie ucieka do Google, otwiera naszą mapę ofert. */}
      <iframe
        title="Mapa"
        src={mapSrc!}
        className="pointer-events-none h-full w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        tabIndex={-1}
      />

      {isApproxLocation ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-44 w-44 rounded-full border-2 border-brand/70 bg-brand/20 shadow-[0_0_60px_rgba(122,163,51,0.28)]" />
        </div>
      ) : null}

      {/* Sygnał, że podgląd jest klikalny i prowadzi do mapy z ofertami w okolicy. */}
      <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-90 transition group-hover:opacity-100">
        <span className="m-3 inline-flex items-center gap-2 rounded-full border border-brand/60 bg-bg/90 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-fg backdrop-blur">
          Zobacz oferty w okolicy
        </span>
      </div>
    </div>
  </Link>
) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      {open && hasPhotos ? (
        <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
            <div className="relative w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
              <div className="relative rounded-3xl bg-black/30 overflow-visible">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute right-3 top-3 sm:right-4 sm:top-4 z-20 h-10 w-10 rounded-full border border-white/20 bg-black/55 text-white/90 hover:border-white/40 transition flex items-center justify-center"
                  aria-label="Zamknij galerię"
                >
                  <span className="text-[20px] leading-none relative top-[-1px]">×</span>
                </button>

                <div className="overflow-hidden rounded-3xl">
                  <div className="relative w-full" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                    <SmartImg
                      src={cover ?? photos[0]}
                      alt={d.tytul}
                      className="mx-auto w-full object-contain max-h-[82svh] sm:max-h-[78vh]"
                      eager
                    />

                    {photos.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={prev}
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 text-white border border-white/10"
                          aria-label="Poprzednie"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={next}
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 text-white border border-white/10"
                          aria-label="Następne"
                        >
                          ›
                        </button>

                        <div className="absolute right-3 bottom-3 sm:right-4 sm:bottom-4 rounded-full bg-black/45 px-3 py-1 text-xs text-white/80 border border-white/10">
                          {idx + 1}/{photos.length}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {photos.length > 1 ? (
                <div className="mt-4 flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1 td-thumbstrip">
                  {photos.map((u, i) => (
                    <button
                      key={u + i}
                      type="button"
                      onClick={() => setIdx(i)}
                      className={cx(
                        'h-16 w-28 shrink-0 overflow-hidden rounded-2xl border transition',
                        i === idx ? 'border-fg/60' : 'border-fg/10 opacity-85 hover:opacity-100'
                      )}
                      title={`Zdjęcie ${i + 1}`}
                    >
                      <SmartImg src={u} alt={`Zdjęcie ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

            {telefon && telefonHref ? (
  <div className="fixed bottom-0 left-0 right-0 z-[90] bg-bg/88 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2.5 backdrop-blur-xl md:hidden">
    <div className="mx-auto grid max-w-[420px] grid-cols-2 gap-2">
      <a
        href={`tel:${telefonHref}`}
        onClick={() => trackContact('phone')}
        className="flex h-12 items-center justify-center rounded-2xl border border-brand/70 bg-surface-2/92 text-[12px] font-semibold uppercase tracking-[0.18em] text-fg/80 shadow-[0_0_22px_rgba(0,0,0,0.08)] transition active:scale-[0.98]"
      >
        Zadzwoń
      </a>

      {smsHref ? (
        <a
          href={smsHref}
          onClick={() => trackContact('message')}
          className="flex h-12 items-center justify-center rounded-2xl border border-fg/15 bg-brand/95 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink shadow-[0_0_22px_rgba(0,0,0,0.08)] transition active:scale-[0.98]"
        >
          Napisz
        </a>
      ) : null}
    </div>
  </div>
) : null}


      {shareDone ? (
        <div className="fixed inset-x-0 bottom-24 z-[1000] flex justify-center px-4 md:bottom-10">
          <div className="rounded-full border border-fg/15 bg-surface px-4 py-2 text-[13px] text-fg/90 shadow-[0_10px_30px_rgba(0,0,0,0.10)]">
            Skopiowano link do oferty
          </div>
        </div>
      ) : null}

      {favoriteModalOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
          <div className="w-full max-w-[480px] rounded-[28px] border border-fg/10 bg-surface px-6 py-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-brand/35 bg-brand/10 text-[28px] text-brand-text">
              ♡
            </div>

            <div className="text-[25px] font-semibold uppercase tracking-[0.13em] text-fg">
              Zapisz ofertę
            </div>

            <p className="mt-5 text-[14px] leading-relaxed text-fg/64">
              Zaloguj się lub zarejestruj, aby dodać ofertę do ulubionych.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setFavoriteModalOpen(false)}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-fg/12 bg-fg/[0.035] px-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-fg/75 transition hover:bg-fg/[0.06] hover:text-fg"
              >
                Przeglądaj dalej
              </button>

              <Link
                href="/logowanie"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-4 text-[12px] font-black uppercase tracking-[0.18em] text-ink transition hover:brightness-110"
              >
                Przejdź do logowania
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .td-opis {
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: normal;
        }
        .td-opis b,
        .td-opis strong {
          color: rgba(243, 239, 245, 0.98);
          font-weight: 700;
        }
        .td-opis p {
          margin: 0 0 12px 0;
        }
        .td-opis ul {
          margin: 10px 0 10px 18px;
          padding: 0;
          list-style: disc !important;
          list-style-position: outside;
        }
        .td-opis ol {
          margin: 10px 0 10px 18px;
          padding: 0;
          list-style: decimal !important;
          list-style-position: outside;
        }
        .td-opis li {
          margin: 6px 0;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .td-opis a {
          color: rgba(243, 239, 245, 0.85);
          text-decoration: underline;
          text-underline-offset: 6px;
          text-decoration-color: rgba(243, 239, 245, 0.25);
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .td-opis a:hover {
          text-decoration-color: rgba(243, 239, 245, 0.45);
        }

        .td-thumbstrip {
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .td-thumbstrip::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </main>
  );
}