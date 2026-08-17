'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapPin } from './KupMap';
import { CardBody } from './CardBody';
import { IconCamera } from './CardIcons';
import { parcelMediaLabel } from '@/lib/media';
import { useOfferFavorites, LoginPrompt, HeartIcon } from './OfferCard';

/* ────────────────────────────────────────────────────────────────────────────
 *  Karta oferty pokazywana po kliknięciu pinu (P11). Renderowana jako WŁASNY
 *  panel nad mapą (nie w dymku Google) — pełna kontrola nad wyglądem. Ciało to
 *  wspólny `CardBody` (jak lista/„podobne"), więc cena, media, sprzedawca i
 *  serduszko są w tych samych miejscach co wszędzie. Krzyżyk „Zamknij" jest NAD
 *  kartą (osobno), żeby zamykanie nie wchodziło w ofertę.
 *
 *  Pin z mapy niesie tylko id, pozycję, cenę i flagi (P27) — cała reszta karty
 *  (zdjęcia, lokalizacja, metraż, media, biuro) dociąga się stąd, po kliknięciu.
 *  Dzięki temu payload mapy jest ~10× lżejszy, a szczegóły płaci tylko ten, kto
 *  faktycznie otworzył ofertę. Cena jest znana od razu, więc karta nigdy nie jest pusta. */

const PRZEZN_LABEL: Record<string, string> = {
  INWESTYCYJNA: 'Inwestycyjna',
  BUDOWLANA: 'Budowlana',
  ROLNA: 'Rolna',
  LESNA: 'Leśna',
  REKREACYJNA: 'Rekreacyjna',
  SIEDLISKOWA: 'Siedliskowa',
};

type Photo = { url: string; kolejnosc?: number };

type Detail = {
  photos: string[];
  loc: string | null;
  area: number | null;
  przezn: string[];
  prad: string | null;
  woda: string | null;
  kanalizacja: string | null;
  gaz: string | null;
  sprzedajacyTyp: string | null;
  biuroNazwa: string | null;
  biuroLogoUrl: string | null;
  biuroLogoBg: boolean;
};

export default function MapOfferCard({ pin, onClose }: { pin: MapPin; onClose?: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [i, setI] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Ulubione dla pojedynczej oferty popupu (to samo źródło co lista).
  const favItems = useMemo(() => [{ id: pin.id }], [pin.id]);
  const { favoriteIds, toggleFavorite, loginPromptOpen, setLoginPromptOpen } = useOfferFavorites(favItems);
  const isFavorite = favoriteIds.has(pin.id);

  // Karta jest montowana z `key={pin.id}` (patrz KupMap), więc stan startuje pusty
  // przy każdej ofercie — nie trzeba go tu zerować.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dzialki/${pin.id}`, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list: Photo[] = Array.isArray(data.zdjecia) ? data.zdjecia : [];
        setDetail({
          photos: list
            .slice()
            .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0))
            .map((p) => p.url)
            .filter(Boolean),
          loc: data.locationLabel ?? null,
          area: typeof data.powierzchniaM2 === 'number' ? data.powierzchniaM2 : null,
          przezn: Array.isArray(data.przeznaczenia) ? data.przeznaczenia : [],
          prad: data.prad ?? null,
          woda: data.woda ?? null,
          kanalizacja: data.kanalizacja ?? null,
          gaz: data.gaz ?? null,
          sprzedajacyTyp: data.sprzedajacyTyp ?? null,
          biuroNazwa: data.biuroNazwa ?? null,
          biuroLogoUrl: data.biuroLogoUrl ?? null,
          biuroLogoBg: !!data.biuroLogoBg,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pin.id]);

  const photos = detail?.photos ?? [];
  const has = photos.length > 0;
  const total = photos.length;

  const go = (dir: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (total < 2) return;
    setI((v) => (v + dir + total) % total);
  };

  const isRent = pin.transakcja === 'WYNAJEM';
  // Do czasu odpowiedzi pokazujemy myślniki zamiast pustki — cena i tak jest znana z pinu.
  const przezn =
    (detail?.przezn ?? []).map((x) => PRZEZN_LABEL[x] ?? x).filter(Boolean).join(', ') || '—';
  const loc = (detail?.loc ?? '').trim() || (detail ? 'Lokalizacja niepodana' : '…');

  return (
    <>
      <div>
        {/* Zamknij — NAD ofertą, osobno, żeby zamykanie nie klikało w ofertę. */}
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-label="Zamknij i wróć do mapy"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-fg/15 bg-bg/95 text-[20px] leading-none text-fg shadow-[0_8px_24px_rgba(0,0,0,0.10)] backdrop-blur transition hover:bg-surface"
          >
            ×
          </button>
        </div>

        <div
          className={`relative w-full overflow-hidden rounded-2xl border bg-bg ${
            pin.featured
              ? 'border-brand/55 shadow-[0_18px_60px_rgba(0,0,0,0.12),0_0_0_1px_rgba(122,163,51,0.30),0_0_24px_rgba(122,163,51,0.20)]'
              : 'border-fg/12 shadow-[0_18px_60px_rgba(0,0,0,0.12)]'
          }`}
        >
          <a
            href={`/dzialka/${pin.id}`}
            onClick={() => {
              // Zapamiętaj, że w ofertę wchodzimy Z MAPY — na ofercie przycisk powrotu
              // zamieni się w „Wróć do mapy" i wróci na /kup z otwartą mapą (?focus=).
              try {
                sessionStorage.setItem('TD_KUP_FROM_MAP', pin.id);
              } catch {}
            }}
            className="group block text-left text-fg no-underline"
          >
            {/* Karuzela */}
            <div
              className="relative aspect-[16/10] w-full overflow-hidden bg-surface-2"
              onTouchStart={(e) => {
                touchStartX.current = e.changedTouches[0]?.clientX ?? null;
              }}
              onTouchEnd={(e) => {
                const start = touchStartX.current;
                const end = e.changedTouches[0]?.clientX ?? null;
                if (start == null || end == null || total < 2) return;
                const diff = start - end;
                if (Math.abs(diff) < 40) return;
                setI((v) => (v + (diff > 0 ? 1 : -1) + total) % total);
              }}
            >
              {has ? (
                <img
                  src={photos[i] ?? photos[0]}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-surface-2">
                  {/* Dopóki szczegóły lecą, nie twierdzimy, że zdjęć nie ma. */}
                  {detail && (
                    <span className="text-[11px] tracking-[0.12em] text-fg/30">Zdjęcie wkrótce</span>
                  )}
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent" />

              {pin.featured && (
                <span className="absolute left-3 top-3 rounded-full border border-brand/40 bg-brand/90 px-2.5 py-1 text-[9px] font-semibold tracking-[0.14em] text-black">
                  WYRÓŻNIONE
                </span>
              )}

              {isRent && (
                <span className="absolute left-3 bottom-3 rounded-full border border-white/30 bg-black/65 px-2.5 py-1 text-[9px] font-semibold tracking-[0.14em] text-white backdrop-blur-sm">
                  NA WYNAJEM
                </span>
              )}

              {total > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Poprzednie zdjęcie"
                    onClick={(e) => go(-1, e)}
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/70"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Następne zdjęcie"
                    onClick={(e) => go(1, e)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/70"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white backdrop-blur-sm">
                    <IconCamera className="h-3 w-3" />
                    {i + 1}/{total}
                  </div>
                </>
              )}
            </div>

            {/* Ciało — wspólne z listą i „podobnymi" (bez tytułu, kompaktowo). */}
            <CardBody
              cena={pin.cena}
              isRent={isRent}
              loc={loc}
              area={detail?.area ?? 0}
              przezn={przezn}
              media={parcelMediaLabel(detail ?? {})}
              compact
              sellerType={
                detail?.sprzedajacyTyp === 'BIURO' || detail?.sprzedajacyTyp === 'PRYWATNIE'
                  ? detail.sprzedajacyTyp
                  : null
              }
              biuroNazwa={detail?.biuroNazwa ?? null}
              biuroLogoUrl={detail?.biuroLogoUrl ?? null}
              biuroLogoBg={detail?.biuroLogoBg ?? false}
              heartSlot={
                <button
                  type="button"
                  aria-label={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite(pin.id);
                  }}
                  className={`flex h-8 w-8 items-center justify-center transition active:scale-90 ${
                    isFavorite ? 'text-brand-text' : 'text-brand-text/80 hover:text-brand-text'
                  }`}
                >
                  <HeartIcon filled={isFavorite} />
                </button>
              }
              extra={
                pin.approx ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/12 px-2.5 py-1 text-[10px] text-brand-bright">
                    ◎ Lokalizacja przybliżona
                  </span>
                ) : undefined
              }
            />
          </a>
        </div>
      </div>

      <LoginPrompt open={loginPromptOpen} onClose={() => setLoginPromptOpen(false)} />
    </>
  );
}
