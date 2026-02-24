'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Photo = { id?: string; url: string; publicId?: string; kolejnosc?: number };

type Dzialka = {
  id: string;
  tytul: string;
  opis?: string | null;
  cenaPln: number;
  powierzchniaM2: number;

  telefon?: string | null;
  email?: string | null;

  locationLabel?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;

  przeznaczenia?: string[];

  prad?:
    | 'BRAK_PRZYLACZA'
    | 'PRZYLACZE_NA_DZIALCE'
    | 'PRZYLACZE_W_DRODZE'
    | 'WARUNKI_PRZYLACZENIA_WYDANE'
    | 'MOZLIWOSC_PRZYLACZENIA'
    | string
    | null;

  woda?:
    | 'BRAK_PRZYLACZA'
    | 'WODOCIAG_NA_DZIALCE'
    | 'WODOCIAG_W_DRODZE'
    | 'STUDNIA_GLEBINOWA'
    | 'MOZLIWOSC_PODLACZENIA'
    | string
    | null;

  kanalizacja?:
    | 'BRAK'
    | 'MIEJSKA_NA_DZIALCE'
    | 'MIEJSKA_W_DRODZE'
    | 'SZAMBO'
    | 'PRZYDOMOWA_OCZYSZCZALNIA'
    | 'MOZLIWOSC_PODLACZENIA'
    | string
    | null;

  gaz?: 'BRAK' | 'GAZ_NA_DZIALCE' | 'GAZ_W_DRODZE' | 'MOZLIWOSC_PODLACZENIA' | string | null;
  swiatlowod?: 'BRAK' | 'W_DRODZE' | 'NA_DZIALCE' | string | null;

  wzWydane?: boolean | null;
  mpzp?: boolean | null;
  projektDomu?: boolean | null;

  klasaZiemi?: string | null;
  wymiary?: string | null;
  ksiegaWieczysta?: string | null;

  sprzedajacyTyp?: 'PRYWATNIE' | 'BIURO' | string | null;
  numerOferty?: string | null;

  zdjecia?: Photo[];
};

const BG = '#131313';
const FG = '#F3EFF5';
const GREEN = '#7aa333';

const ICONS = {
  price: '/cena.webp',
  area: '/powierzchnia.webp',
  type: '/przeznaczenie.webp',
  loc: '/lokalizacja.webp',
  phone: '/telefon.webp',
};

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

function Hr({ className }: { className?: string }) {
  return <div className={cx('border-b border-white/10', className)} />;
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
  return String(p)
    .replace('USLUGOWA', 'USŁUGOWA')
    .replace('LESNA', 'LEŚNA')
    .replace('INWESTYCYJNA', 'INWESTYCYJNA')
    .replace('ROLNA', 'ROLNA')
    .replace('BUDOWLANA', 'BUDOWLANA');
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
  };
  return map[v] ?? v;
}

function InfoLine({ icon, value }: { icon: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <img src={icon} alt="" className="mt-[2px] h-5 w-5 opacity-80 shrink-0" />
      <div className="min-w-0 text-white/90 text-[14px] leading-snug whitespace-normal break-words">{value}</div>
    </div>
  );
}

export default function DzialkaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [d, setD] = useState<Dzialka | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);

  // swipe (fullscreen)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
  }, [id]);

  useEffect(() => {
    if (!id) return;

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
  }, [id]);

  const photos = useMemo(() => {
    const arr = (d?.zdjecia ?? [])
      .slice()
      .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0))
      .map((z) => z.url)
      .filter(Boolean);
    return arr;
  }, [d]);

  const hasPhotos = photos.length > 0;
  const cover = hasPhotos ? photos[Math.min(idx, photos.length - 1)] : null;

  const area = d?.powierzchniaM2 ?? 0;
  const zlZaM2 = area ? Math.round((d?.cenaPln ?? 0) / area) : 0;

  const przezn = Array.isArray(d?.przeznaczenia) ? d!.przeznaczenia!.filter(Boolean) : [];
  const przeznText = przezn.length ? przezn.map(labelPrzeznaczenie).join(', ') : null;

  const loc = d?.locationLabel?.trim() || null;
  const mapSrc = useMemo(() => {
    if (!d) return null;
    if (d.lat && d.lng) return `https://www.google.com/maps?q=${d.lat},${d.lng}&z=15&output=embed`;
    return null;
  }, [d]);

  const prad = labelPrad(d?.prad ?? null);
  const woda = labelWoda(d?.woda ?? null);
  const kan = labelKanalizacja(d?.kanalizacja ?? null);
  const gaz = labelGazShort(d?.gaz ?? null);
  const sw = labelSwiatlowod(d?.swiatlowod ?? null);
  const hasUzbrojenie = Boolean(prad || woda || kan || gaz || sw);

  const opis = (d?.opis ?? '').trim() || null;

  const telefon = (d?.telefon ?? '').trim() || null;
  const numerOferty = (d?.numerOferty ?? '').trim() || null;
  const klasaZiemi = (d?.klasaZiemi ?? '').trim() || null;
  const wymiary = (d?.wymiary ?? '').trim() || null;
  const ksiega = (d?.ksiegaWieczysta ?? '').trim() || null;

  const hasDocs = Boolean(d?.mpzp || d?.wzWydane || d?.projektDomu);
  const showMap = Boolean(mapSrc);

  const prev = () => {
    if (photos.length < 2) return;
    setIdx((p) => (p - 1 + photos.length) % photos.length);
  };
  const next = () => {
    if (photos.length < 2) return;
    setIdx((p) => (p + 1) % photos.length);
  };

  // ✅ POWRÓT DO LISTY: wraca na tę samą stronę i ten sam scroll
  const onBackToListClick = (e: React.MouseEvent) => {
    e.preventDefault();

    try {
      const url = sessionStorage.getItem('TD_KUP_URL') || '/kup';
      const y = sessionStorage.getItem('TD_KUP_SCROLL_Y');

      if (y) sessionStorage.setItem('TD_KUP_RESTORE_Y', y);

      router.push(url); // list page ma mieć scroll={false} i restore w useEffect
    } catch {
      router.push('/kup');
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches?.[0];
    if (!t) return;
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
    if (dx > TH) prev();
    else if (dx < -TH) next();
  };

  // ✅ blokada scrolla tła, kiedy fullscreen galeria otwarta
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
            className="inline-flex items-center gap-2 text-[13px] leading-none py-2 tracking-[0.18em] uppercase text-white/70 hover:text-white transition"
          >
            <span className="relative top-[-1px]">←</span> Wróć do listy
          </Link>

          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <div className="overflow-hidden rounded-3xl bg-[#0f0f0f]/20">
              <div className="aspect-video animate-pulse bg-white/5" />
              <div className="p-6 space-y-4">
                <div className="h-4 w-40 animate-pulse rounded bg-white/5" />
                <div className="h-4 w-64 animate-pulse rounded bg-white/5" />
              </div>
            </div>

            <div className="rounded-3xl bg-[#0f0f0f]/20 p-6 space-y-4">
              <div className="h-5 w-64 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-48 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-56 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-72 animate-pulse rounded bg-white/5" />
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
            className="inline-flex items-center gap-2 text-[13px] leading-none py-2 tracking-[0.18em] uppercase text-white/70 hover:text-white transition"
          >
            <span className="relative top-[-1px]">←</span> Wróć do listy
          </Link>

          <div className="mt-6 rounded-3xl bg-[#0f0f0f]/20 p-6">
            <div className="font-medium text-white/90">Nie udało się załadować ogłoszenia</div>
            <div className="mt-2 text-sm text-white/60">{err ?? 'Brak danych'}</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: BG, color: FG }}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link
          href="/kup"
          scroll={false}
          onClick={onBackToListClick}
          className="inline-flex items-center gap-2 text-[13px] leading-none py-2 tracking-[0.18em] uppercase text-white/70 hover:text-white transition"
        >
          <span className="relative top-[-1px]">←</span> Wróć do listy
        </Link>

        {/* ======= reszta Twojego pliku BEZ ZMIAN ======= */}
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          {/* LEWA KOLUMNA */}
          <section className="min-w-0 space-y-8">
            {/* GALERIA */}
            <div className="min-w-0 overflow-hidden rounded-3xl bg-[#0f0f0f]/20">
              <div className="relative aspect-video bg-white/5">
                {cover ? (
                  <>
                    <img
                      src={cover}
                      alt={d.tytul}
                      className="h-full w-full object-cover cursor-zoom-in"
                      onClick={() => setOpen(true)}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <div className="text-center text-white text-[18px] font-medium leading-tight drop-shadow break-words">
                        {d.tytul}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-white/50">Brak zdjęć</div>
                )}

                {hasPhotos && photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 text-white backdrop-blur-sm border border-white/10"
                      aria-label="Poprzednie"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 text-white backdrop-blur-sm border border-white/10"
                      aria-label="Następne"
                    >
                      ›
                    </button>

                    <div className="absolute right-4 top-4 rounded-full bg-black/45 px-3 py-1 text-xs text-white/80 border border-white/10">
                      {idx + 1}/{photos.length}
                    </div>
                  </>
                )}
              </div>

              {hasPhotos && photos.length > 1 && (
                <div
                  className={cx(
                    'td-thumbstrip px-3 py-3',
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
                        i === idx ? 'border-white/60' : 'border-white/10 opacity-85 hover:opacity-100'
                      )}
                      title={`Zdjęcie ${i + 1}`}
                    >
                      <img src={u} alt={`Zdjęcie ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {opis ? (
              <div className="hidden lg:block">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Opis</div>
                <div className="td-opis mt-4 text-[15px] leading-relaxed text-white/85" dangerouslySetInnerHTML={{ __html: opis }} />
              </div>
            ) : null}

            {showMap ? (
              <div className="hidden lg:block">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Lokalizacja</div>
                {loc ? <div className="mt-2 text-white/85 text-[14px] break-words">{loc}</div> : null}

                {d.mapsUrl ? (
                  <a
                    href={d.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-[12px] tracking-[0.18em] uppercase text-white/70 hover:text-white transition underline decoration-white/20 underline-offset-8"
                  >
                    OTWÓRZ W MAPACH GOOGLE
                  </a>
                ) : null}

                <div className="mt-4 overflow-hidden rounded-3xl bg-[#0f0f0f]/20">
                  <div className="aspect-video">
                    <iframe
                      title="Mapa"
                      src={mapSrc!}
                      className="h-full w-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* PRAWA KOLUMNA */}
          <aside className="min-w-0 rounded-3xl bg-[#0f0f0f]/20">
            <div className="p-6 md:p-7">
              <div className="text-[24px] md:text-[28px] font-semibold tracking-tight text-white leading-[1.12] break-words">
                {d.tytul}
              </div>

              <Hr className="mt-6" />

              <div className="py-5">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={ICONS.price} alt="" className="h-5 w-5 opacity-80 shrink-0" />
                  <div className="min-w-0 text-[20px] md:text-[22px] font-semibold" style={{ color: GREEN }}>
                    {formatPLN(d.cenaPln)}
                    {zlZaM2 ? (
                      <span className="ml-2 text-[12px] text-white/50 font-normal">({formatIntPL(zlZaM2)} zł/m²)</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <Hr />

              <div className="py-5">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={ICONS.area} alt="" className="h-5 w-5 opacity-80 shrink-0" />
                  <div className="text-[20px] md:text-[22px] font-semibold" style={{ color: GREEN }}>
                    {formatIntPL(area)} m²
                  </div>
                </div>
              </div>

              <Hr />

              {przeznText ? (
                <>
                  <div className="py-5">
                    <InfoLine icon={ICONS.type} value={przeznText} />
                  </div>
                  <Hr />
                </>
              ) : null}

              {loc ? (
                <>
                  <div className="py-5">
                    <div className="flex items-start gap-3 min-w-0">
                      <img src={ICONS.loc} alt="" className="mt-[2px] h-5 w-5 opacity-80 shrink-0" />
                      <div className="min-w-0 text-white/90 text-[14px] leading-snug break-words">{loc}</div>
                    </div>
                  </div>
                  <Hr />
                </>
              ) : null}

              {telefon ? (
                <>
                  <div className="py-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={ICONS.phone} alt="" className="h-5 w-5 opacity-80 shrink-0" />
                      <a
                        href={`tel:${telefon.replace(/\s+/g, '')}`}
                        className="min-w-0 text-[20px] md:text-[22px] font-semibold underline decoration-white/20 underline-offset-8 hover:decoration-white/40 transition break-all"
                        style={{ color: GREEN }}
                      >
                        {telefon}
                      </a>
                    </div>
                  </div>
                  <Hr />
                </>
              ) : null}

              {numerOferty ? (
                <>
                  <div className="py-5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Numer oferty</div>
                    <div className="mt-2 text-white/85 text-[15px] break-words">{numerOferty}</div>
                  </div>
                  <Hr />
                </>
              ) : null}

              {hasUzbrojenie ? (
                <>
                  <div className="py-5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Uzbrojenie</div>
                    <div className="mt-3 space-y-2 text-[14px] text-white/85">
                      {prad ? (
                        <div className="break-words">
                          Prąd: <span className="text-white/95">{prad}</span>
                        </div>
                      ) : null}
                      {woda ? (
                        <div className="break-words">
                          Woda: <span className="text-white/95">{woda}</span>
                        </div>
                      ) : null}
                      {kan ? (
                        <div className="break-words">
                          Kanalizacja: <span className="text-white/95">{kan}</span>
                        </div>
                      ) : null}
                      {gaz ? (
                        <div className="break-words">
                          Gaz: <span className="text-white/95">{gaz}</span>
                        </div>
                      ) : null}
                      {sw ? (
                        <div className="break-words">
                          Światłowód: <span className="text-white/95">{sw}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <Hr />
                </>
              ) : null}

              {hasDocs ? (
                <>
                  <div className="py-5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Dokumenty / plan</div>
                    <div className="mt-3 space-y-2 text-[14px] text-white/85">
                      {d.mpzp ? <div>Obowiązuje MPZP</div> : null}
                      {d.wzWydane ? <div>Wydane warunki zabudowy</div> : null}
                      {d.projektDomu ? <div>Działka posiada projekt domu</div> : null}
                    </div>
                  </div>
                  <Hr />
                </>
              ) : null}

              {(klasaZiemi || wymiary || ksiega) ? (
                <>
                  <div className="py-5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Dodatkowe informacje</div>
                    <div className="mt-3 space-y-2 text-[14px] text-white/85">
                      {klasaZiemi ? (
                        <div className="break-words">
                          Klasa ziemi: <span className="text-white/95">{klasaZiemi}</span>
                        </div>
                      ) : null}
                      {wymiary ? (
                        <div className="break-words">
                          Wymiary: <span className="text-white/95">{wymiary}</span>
                        </div>
                      ) : null}
                      {ksiega ? (
                        <div className="break-words">
                          Księga wieczysta: <span className="text-white/95">{ksiega}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <Hr />
                </>
              ) : null}

              {opis ? (
                <>
                  <div className="py-5 lg:hidden">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Opis</div>
                    <div className="td-opis mt-4 text-[15px] leading-relaxed text-white/85" dangerouslySetInnerHTML={{ __html: opis }} />
                  </div>
                  <Hr className="lg:hidden" />
                </>
              ) : null}

              {showMap ? (
                <div className="py-5 lg:hidden">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Lokalizacja</div>
                  {loc ? <div className="mt-2 text-white/85 text-[14px] break-words">{loc}</div> : null}

                  {d.mapsUrl ? (
                    <a
                      href={d.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-[12px] tracking-[0.18em] uppercase text-white/70 hover:text-white transition underline decoration-white/20 underline-offset-8"
                    >
                      OTWÓRZ W MAPACH GOOGLE
                    </a>
                  ) : null}

                  <div className="mt-4 overflow-hidden rounded-3xl bg-[#0f0f0f]/20">
                    <div className="aspect-video">
                      <iframe title="Mapa" src={mapSrc!} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      {/* FULLSCREEN GALERIA */}
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
                    <img
                      src={cover ?? photos[0]}
                      alt={d.tytul}
                      className="mx-auto w-full object-contain max-h-[82svh] sm:max-h-[78vh]"
                      draggable={false}
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
                        i === idx ? 'border-white/60' : 'border-white/10 opacity-85 hover:opacity-100'
                      )}
                      title={`Zdjęcie ${i + 1}`}
                    >
                      <img src={u} alt={`Zdjęcie ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .td-opis {
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .td-opis b,
        .td-opis strong {
          color: rgba(243, 239, 245, 0.98);
          font-weight: 700;
        }
        .td-opis p {
          margin: 0 0 10px 0;
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