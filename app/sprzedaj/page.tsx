'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import LocationPicker from '@/components/LocationPicker';
import { uploadToCloudinary } from '@/lib/cloudinaryUpload';
import MarkdownOpis from '@/components/MarkdownOpis';

type Przeznaczenie = 'BUDOWLANA' | 'USLUGOWA' | 'ROLNA' | 'LESNA' | 'INWESTYCYJNA';
type LocationMode = 'EXACT' | 'APPROX';
type SprzedajacyTypUI = 'PRYWATNIE' | 'BIURO_NIERUCHOMOSCI';

type LocationValue = {
  placeId: string | null;
  locationFull: string | null;
  locationLabel: string;
  lat: number;
  lng: number;
  mapsUrl: string | null;
  locationMode: LocationMode;
  parcelText: string | null;
};

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

const BG = '#131313';
const FG = '#F3EFF5';

// ✅ LIMITY (bezpieczne i “premium”)
const MAX_TITLE_CHARS = 90;
const MAX_OPIS_CHARS = 5000;

function Hr({ className }: { className?: string }) {
  return <div className={cx('border-b border-white/10', className)} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[22px] md:text-[26px] font-semibold tracking-tight text-white">{children}</h2>;
}

/** =========================
 *  ✅ FORMATOWANIE LICZB
 *  - wycina spacje i wszystko poza cyframi
 *  - formatuje na 1 000 000 (spacje tysięcy)
 *  - do API wysyłamy czystą liczbę (bez spacji)
 *  ========================= */
function onlyDigits(input: string) {
  return input.replace(/[^\d]/g, '');
}

function formatThousandsSpaces(digits: string) {
  const cleaned = onlyDigits(digits);
  if (!cleaned) return '';
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function parseFormattedNumber(formatted: string) {
  const digits = onlyDigits(formatted);
  return digits ? Number(digits) : NaN;
}

function UnderlineField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  maxLength,
  showCounter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  showCounter?: boolean;
}) {
  return (
    <label className="block">
      <div className="flex items-end justify-between gap-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">{label}</div>
        {showCounter && typeof maxLength === 'number' ? (
          <div className="text-[11px] tracking-[0.12em] text-white/40">
            {value.length}/{maxLength}
          </div>
        ) : null}
      </div>

      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cx(
          'mt-2 w-full bg-transparent text-[18px] md:text-[19px] text-white/90',
          'border-0 border-b border-white/20 pb-2',
          'placeholder:text-white/35',
          'outline-none focus:border-white/70 focus:ring-0',
          'underline decoration-white/55 decoration-[1px] underline-offset-[10px]',
          'focus:decoration-white/85',
          // ✅ zaznaczenie tekstu bez niebieskiego
          'selection:bg-white/20 selection:text-white'
        )}
      />

      {/* ✅ fix na niebieskie tło z autouzupełniania (Chrome/Edge) */}
      <style jsx global>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-text-fill-color: rgba(255, 255, 255, 0.9) !important;
          box-shadow: 0 0 0px 1000px #131313 inset !important;
          caret-color: rgba(255, 255, 255, 0.9) !important;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>
    </label>
  );
}

function Tabs({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-8">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx('text-[15px] font-semibold tracking-tight transition', active ? 'text-white' : 'text-white/70 hover:text-white')}
            style={{
              textDecoration: active ? 'underline' : 'none',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: active ? 'rgba(243,239,245,0.95)' : 'transparent',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiTabs({
  values,
  toggle,
  options,
}: {
  values: string[];
  toggle: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-8">
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cx(
              'text-[13px] md:text-[14px] font-semibold uppercase tracking-[0.08em] transition',
              active ? 'text-white' : 'text-white/65 hover:text-white'
            )}
            style={{
              textDecoration: active ? 'underline' : 'none',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: active ? 'rgba(243,239,245,0.95)' : 'transparent',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ChoiceRow({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-8">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx('text-[14px] md:text-[15px] font-semibold tracking-tight transition', active ? 'text-white' : 'text-white/70 hover:text-white')}
            style={{
              textDecoration: active ? 'underline' : 'none',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: active ? 'rgba(243,239,245,0.95)' : 'transparent',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SprzedajPage() {
  const [tytul, setTytul] = useState('');

  const [telefon, setTelefon] = useState('');
  const [email, setEmail] = useState('');

  const [cenaPln, setCenaPln] = useState('');
  const [powierzchniaM2, setPowierzchniaM2] = useState('');

  const [sprzedajacyTyp, setSprzedajacyTyp] = useState<SprzedajacyTypUI>('PRYWATNIE');
  const [numerOferty, setNumerOferty] = useState('');

  const [przeznaczenia, setPrzeznaczenia] = useState<Przeznaczenie[]>(['BUDOWLANA']);
  const [location, setLocation] = useState<LocationValue | null>(null);

  const [opis, setOpis] = useState('');

  const [prad, setPrad] = useState<
    'BRAK_PRZYLACZA' | 'PRZYLACZE_NA_DZIALCE' | 'PRZYLACZE_W_DRODZE' | 'WARUNKI_PRZYLACZENIA_WYDANE' | 'MOZLIWOSC_PRZYLACZENIA'
  >('BRAK_PRZYLACZA');

  const [woda, setWoda] = useState<
    'BRAK_PRZYLACZA' | 'WODOCIAG_NA_DZIALCE' | 'WODOCIAG_W_DRODZE' | 'STUDNIA_GLEBINOWA' | 'MOZLIWOSC_PODLACZENIA'
  >('BRAK_PRZYLACZA');

  const [kanalizacja, setKanalizacja] = useState<
    'BRAK' | 'MIEJSKA_NA_DZIALCE' | 'MIEJSKA_W_DRODZE' | 'SZAMBO' | 'PRZYDOMOWA_OCZYSZCZALNIA' | 'MOZLIWOSC_PODLACZENIA'
  >('BRAK');

  const [gaz, setGaz] = useState<'BRAK' | 'GAZ_NA_DZIALCE' | 'GAZ_W_DRODZE' | 'MOZLIWOSC_PODLACZENIA'>('BRAK');
  const [swiatlowod, setSwiatlowod] = useState<'BRAK' | 'W_DRODZE' | 'NA_DZIALCE'>('BRAK');

  const [wzWydane, setWzWydane] = useState(false);
  const [mpzp, setMpzp] = useState(false);
  const [projektDomu, setProjektDomu] = useState(false);

  const [klasaZiemi, setKlasaZiemi] = useState('');
  const [wymiary, setWymiary] = useState('');
  const [ksiegaWieczysta, setKsiegaWieczysta] = useState('');

  const [files, setFiles] = useState<File[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const [uploaded, setUploaded] = useState<Array<{ url: string; publicId: string; kolejnosc?: number }>>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const uploadRunId = useRef(0);

  const [filesToken, setFilesToken] = useState(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function togglePrzeznaczenie(p: Przeznaczenie) {
    setPrzeznaczenia((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  // ✅ PODGLĄD DUŻY = aktywnie kliknięte zdjęcie (activeIdx)
  const previewUrl = useMemo(() => {
    if (files.length < 1) return null;
    const idx = Math.min(activeIdx, files.length - 1);
    return URL.createObjectURL(files[idx]);
  }, [files, activeIdx]);

  function normalizeUploadedOrder(arr: Array<{ url: string; publicId: string; kolejnosc?: number }>) {
    return arr.map((x, i) => ({ ...x, kolejnosc: i }));
  }

  function movePhoto(from: number, to: number) {
    if (to < 0 || to >= files.length) return;

    setFiles((prev) => {
      const a = [...prev];
      const [it] = a.splice(from, 1);
      a.splice(to, 0, it);
      return a;
    });

    setActiveIdx((prev) => {
      if (prev === from) return to;
      if (from < prev && to >= prev) return prev - 1;
      if (from > prev && to <= prev) return prev + 1;
      return prev;
    });

    setUploaded((prev) => {
      if (!prev.length) return prev;
      const a = [...prev].sort((x, y) => (x.kolejnosc ?? 0) - (y.kolejnosc ?? 0));
      if (from >= a.length) return prev;
      const [it] = a.splice(from, 1);
      a.splice(to, 0, it);
      return normalizeUploadedOrder(a);
    });
  }

  useEffect(() => {
    if (files.length < 1) {
      setUploaded([]);
      setUploadingPhotos(false);
      return;
    }

    const myRun = ++uploadRunId.current;

    (async () => {
      try {
        setErr(null);
        setOk(null);
        setUploadingPhotos(true);
        setUploaded([]);

        const results: Array<{ url: string; publicId: string; kolejnosc?: number }> = [];
        for (let i = 0; i < files.length; i++) {
          const out = await uploadToCloudinary(files[i]);
          if (uploadRunId.current !== myRun) return;
          results.push({ url: out.url, publicId: out.publicId, kolejnosc: i });
        }

        if (uploadRunId.current !== myRun) return;
        setUploaded(results);
      } catch (e: any) {
        if (uploadRunId.current !== myRun) return;
        setErr(e?.message || 'Błąd uploadu zdjęć.');
      } finally {
        if (uploadRunId.current === myRun) setUploadingPhotos(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesToken]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!tytul.trim()) return setErr('Podaj tytuł.');
    if (tytul.trim().length > MAX_TITLE_CHARS) return setErr(`Tytuł jest za długi (max ${MAX_TITLE_CHARS} znaków).`);

    const pm2 = parseFormattedNumber(powierzchniaM2);
    const cena = parseFormattedNumber(cenaPln);

    if (!Number.isFinite(pm2) || pm2 <= 0) return setErr('Podaj poprawną powierzchnię.');
    if (!Number.isFinite(cena) || cena <= 0) return setErr('Podaj poprawną cenę.');
    if (!telefon.trim()) return setErr('Podaj telefon.');
    if (!email.trim()) return setErr('Podaj email.');
    if (przeznaczenia.length < 1) return setErr('Wybierz min. 1 przeznaczenie.');
    if (!location) return setErr('Wybierz lokalizację.');
    if (files.length < 1) return setErr('Dodaj minimum 1 zdjęcie.');
    if (uploadingPhotos) return setErr('Poczekaj aż zdjęcia się wgrają.');
    if (uploaded.length < 1) return setErr('Zdjęcia nie zostały wgrane.');

    if (sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' && !numerOferty.trim()) {
      return setErr('Dla Biura nieruchomości podaj numer oferty.');
    }

    const uploadedSorted = [...uploaded].sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));

    setLoading(true);
    try {
      const res = await fetch('/api/dzialki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tytul: tytul.trim().slice(0, MAX_TITLE_CHARS),
          powierzchniaM2: pm2,
          cenaPln: cena,
          przeznaczenia,
          telefon,
          email,

          opis: opis.trim() ? opis.trim().slice(0, MAX_OPIS_CHARS) : null,

          sprzedajacyTyp: sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' ? 'BIURO' : 'PRYWATNIE',
          numerOferty: sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' ? numerOferty.trim() : null,

          ...location,

          prad,
          woda,
          kanalizacja,
          gaz,
          swiatlowod,

          wzWydane,
          mpzp,
          projektDomu,
          klasaZiemi,
          wymiary,
          ksiegaWieczysta,

          zdjecia: uploadedSorted, // ✅ cover = pierwsze wg kolejnosc
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'Błąd zapisu.');

      setOk('Dodano ogłoszenie');
    } catch (e: any) {
      setErr(e?.message || 'Coś poszło nie tak.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: BG, color: FG }}>
      {/* HERO */}
      <section className="relative w-full mt-6">
        <div
          className="absolute inset-4"
          style={{
            backgroundImage: `url(/kup.webp)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 65%',
          }}
        />
        <div className="absolute inset-4 bg-black/30" />

        <div className="relative mx-auto max-w-6xl px-4 min-h-[320px] sm:min-h-[360px] flex items-center justify-center">
          <div className="text-center max-w-3xl px-2">
            <h1 className="text-[30px] sm:text-[38px] md:text-[46px] font-semibold tracking-tight text-white leading-[1.12]">
              Dodaj działkę w dwie minuty
            </h1>
            <p className="mt-5 text-white/95 text-[16px] sm:text-[18px] md:text-[20px] font-medium">
              i zacznij otrzymywać zapytania.
            </p>
          </div>
        </div>
      </section>

      {/* FORMULARZ */}
      <div className="mx-auto max-w-5xl px-6 md:px-10 pt-10 pb-24">
        <form onSubmit={onSubmit} className="space-y-10">
          {/* Tytuł ogłoszenia */}
          <div className="space-y-6">
            <SectionTitle>Tytuł ogłoszenia</SectionTitle>

            <UnderlineField
              label=""
              value={tytul}
              onChange={(v) => setTytul(v.slice(0, MAX_TITLE_CHARS))}
              placeholder="Wpisz tutaj np. Działka budowlana"
              maxLength={MAX_TITLE_CHARS}
              showCounter
            />

            <Hr className="mt-8" />
          </div>

          {/* Zdjęcia */}
          <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <SectionTitle>Zdjęcia</SectionTitle>
              <div className="text-[13px] text-white/55 font-medium">minimum 1 zdjęcie</div>
            </div>

            <label className="block">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const arr = Array.from(e.target.files ?? []);
                  setFiles(arr);
                  setActiveIdx(0);
                  setFilesToken((t) => t + 1);
                }}
              />

              <div className="rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03]">
                {/* ✅ PODGLĄD DUŻY 16:9 — zmienia się po klikaniu miniatur */}
                <div className="relative aspect-[16/9] bg-black/25">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/70">
                      <div className="text-center">
                        <div className="text-[16px] font-semibold">Kliknij aby dodać zdjęcia</div>
                        <div className="mt-2 text-[13px] text-white/45">
                          Możesz dodać kilka — przestawisz kolejność miniaturami
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-xs text-white/80 border border-white/10">
                    Wybrane: {files.length} | Wgrane: {uploaded.length}{' '}
                    {uploadingPhotos ? <span className="text-white/60">— wgrywam…</span> : null}
                  </div>
                </div>

                {/* ✅ MINIATURY + KOLEJNOŚĆ */}
                {files.length > 1 && (
                  <div className="p-3 flex gap-2 overflow-x-auto">
                    {files.map((f, idx) => {
                      const url = URL.createObjectURL(f);
                      const active = idx === activeIdx;

                      return (
                        <div
                          key={idx}
                          className={cx('shrink-0')}
                          draggable
                          onDragStart={() => setDragIdx(idx)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragIdx === null || dragIdx === idx) return;
                            movePhoto(dragIdx, idx);
                            setDragIdx(idx);
                          }}
                          onDragEnd={() => setDragIdx(null)}
                          title="Przeciągnij aby zmienić kolejność"
                        >
                          <button
                            type="button"
                            onClick={() => setActiveIdx(idx)} // ✅ zmienia duży podgląd
                            className={cx(
                              'rounded-2xl overflow-hidden border block',
                              active ? 'border-white/60' : 'border-white/10 opacity-85 hover:opacity-100'
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-16 w-28 object-cover" />
                          </button>

                          <div className="mt-1 flex items-center justify-between px-1">
                            <button
                              type="button"
                              onClick={() => movePhoto(idx, idx - 1)}
                              className="text-[11px] text-white/55 hover:text-white/85 transition"
                              aria-label="Przesuń w lewo"
                              title="W lewo"
                            >
                              ↑
                            </button>
                            <div className="text-[11px] text-white/35">{idx + 1}</div>
                            <button
                              type="button"
                              onClick={() => movePhoto(idx, idx + 1)}
                              className="text-[11px] text-white/55 hover:text-white/85 transition"
                              aria-label="Przesuń w prawo"
                              title="W prawo"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </label>

            <Hr className="mt-8" />
          </div>

          {/* Podstawowe informacje */}
          <div className="space-y-8">
            <SectionTitle>Podstawowe informacje</SectionTitle>

            <div className="grid gap-10 md:grid-cols-2">
              <UnderlineField label="Telefon" value={telefon} onChange={setTelefon} placeholder="Np. 605 000 000" />
              <UnderlineField label="Email" value={email} onChange={setEmail} placeholder="Np. kontakt@..." type="email" />

              <UnderlineField
                label="Cena (PLN)"
                value={cenaPln}
                onChange={(v) => setCenaPln(formatThousandsSpaces(v))}
                placeholder="Np. 150 000"
                inputMode="numeric"
              />

              <UnderlineField
                label="Powierzchnia (m²)"
                value={powierzchniaM2}
                onChange={(v) => setPowierzchniaM2(formatThousandsSpaces(v))}
                placeholder="Np. 1 200"
                inputMode="numeric"
              />
            </div>

            <Hr className="mt-8" />
          </div>

          {/* Kto sprzedaje */}
          <div className="space-y-6">
            <SectionTitle>Kto sprzedaje?</SectionTitle>

            <Tabs
              value={sprzedajacyTyp}
              onChange={(v) => setSprzedajacyTyp(v as SprzedajacyTypUI)}
              options={[
                { value: 'PRYWATNIE', label: 'Prywatnie' },
                { value: 'BIURO_NIERUCHOMOSCI', label: 'Biuro nieruchomości' },
              ]}
            />

            {sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' && (
              <div className="max-w-xl pt-4">
                <UnderlineField label="Numer oferty" value={numerOferty} onChange={setNumerOferty} placeholder="Np. M2-123/2026" />
              </div>
            )}

            <Hr className="mt-8" />
          </div>

          {/* Przeznaczenie */}
          <div className="space-y-6">
            <SectionTitle>Przeznaczenie</SectionTitle>

            <MultiTabs
              values={przeznaczenia}
              toggle={(v) => togglePrzeznaczenie(v as Przeznaczenie)}
              options={[
                { value: 'BUDOWLANA', label: 'BUDOWLANA' },
                { value: 'USLUGOWA', label: 'USŁUGOWA' },
                { value: 'ROLNA', label: 'ROLNA' },
                { value: 'LESNA', label: 'LEŚNA' },
                { value: 'INWESTYCYJNA', label: 'INWESTYCYJNA' },
              ]}
            />

            <Hr className="mt-8" />
          </div>

          {/* Uzbrojenie */}
          <div className="space-y-10">
            <div className="space-y-6">
              <SectionTitle>Prąd</SectionTitle>
              <ChoiceRow
                value={prad}
                onChange={(v) => setPrad(v as any)}
                options={[
                  { value: 'BRAK_PRZYLACZA', label: 'Brak przyłącza' },
                  { value: 'PRZYLACZE_NA_DZIALCE', label: 'Na działce' },
                  { value: 'PRZYLACZE_W_DRODZE', label: 'W drodze' },
                  { value: 'WARUNKI_PRZYLACZENIA_WYDANE', label: 'Warunki wydane' },
                  { value: 'MOZLIWOSC_PRZYLACZENIA', label: 'Możliwość przyłączenia' },
                ]}
              />
              <Hr className="mt-8" />
            </div>

            <div className="space-y-6">
              <SectionTitle>Woda</SectionTitle>
              <ChoiceRow
                value={woda}
                onChange={(v) => setWoda(v as any)}
                options={[
                  { value: 'BRAK_PRZYLACZA', label: 'Brak' },
                  { value: 'WODOCIAG_NA_DZIALCE', label: 'Na działce' },
                  { value: 'WODOCIAG_W_DRODZE', label: 'W drodze' },
                  { value: 'STUDNIA_GLEBINOWA', label: 'Studnia głębinowa' },
                  { value: 'MOZLIWOSC_PODLACZENIA', label: 'Możliwość podłączenia' },
                ]}
              />
              <Hr className="mt-8" />
            </div>

            <div className="space-y-6">
              <SectionTitle>Kanalizacja</SectionTitle>
              <ChoiceRow
                value={kanalizacja}
                onChange={(v) => setKanalizacja(v as any)}
                options={[
                  { value: 'BRAK', label: 'Brak' },
                  { value: 'MIEJSKA_NA_DZIALCE', label: 'Miejska na działce' },
                  { value: 'MIEJSKA_W_DRODZE', label: 'Miejska w drodze' },
                  { value: 'SZAMBO', label: 'Szambo' },
                  { value: 'PRZYDOMOWA_OCZYSZCZALNIA', label: 'Przydomowa oczyszczalnia' },
                  { value: 'MOZLIWOSC_PODLACZENIA', label: 'Możliwość podłączenia' },
                ]}
              />
              <Hr className="mt-8" />
            </div>

            <div className="space-y-6">
              <SectionTitle>Gaz</SectionTitle>
              <ChoiceRow
                value={gaz}
                onChange={(v) => setGaz(v as any)}
                options={[
                  { value: 'BRAK', label: 'Brak' },
                  { value: 'GAZ_NA_DZIALCE', label: 'Na działce' },
                  { value: 'GAZ_W_DRODZE', label: 'W drodze' },
                  { value: 'MOZLIWOSC_PODLACZENIA', label: 'Możliwość podłączenia' },
                ]}
              />
              <Hr className="mt-8" />
            </div>

            <div className="space-y-6">
              <SectionTitle>Światłowód</SectionTitle>
              <ChoiceRow
                value={swiatlowod}
                onChange={(v) => setSwiatlowod(v as any)}
                options={[
                  { value: 'BRAK', label: 'Brak' },
                  { value: 'W_DRODZE', label: 'W drodze' },
                  { value: 'NA_DZIALCE', label: 'Na działce' },
                ]}
              />
              <Hr className="mt-8" />
            </div>
          </div>

          {/* Opcjonalne informacje */}
          <div className="space-y-8">
            <SectionTitle>Opcjonalne informacje</SectionTitle>

            <div className="flex flex-wrap gap-8">
              {[
                { key: 'wz', label: 'Wydane WZ', v: wzWydane, set: setWzWydane },
                { key: 'mpzp', label: 'MPZP', v: mpzp, set: setMpzp },
                { key: 'proj', label: 'Projekt domu', v: projektDomu, set: setProjektDomu },
              ].map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => x.set((p: boolean) => !p)}
                  className={cx('text-[14px] font-semibold tracking-tight transition', x.v ? 'text-white' : 'text-white/70 hover:text-white')}
                  style={{
                    textDecoration: x.v ? 'underline' : 'none',
                    textUnderlineOffset: '10px',
                    textDecorationThickness: '1px',
                    textDecorationColor: x.v ? 'rgba(243,239,245,0.95)' : 'transparent',
                  }}
                >
                  {x.label}
                </button>
              ))}
            </div>

            <div className="grid gap-10 md:grid-cols-2">
              <UnderlineField label="Klasa ziemi" value={klasaZiemi} onChange={setKlasaZiemi} placeholder="Np. IIIa / IVb" />
              <UnderlineField label="Wymiary" value={wymiary} onChange={setWymiary} placeholder="Np. 25×90 m" />
            </div>

            <div className="max-w-2xl">
              <UnderlineField label="Księga wieczysta" value={ksiegaWieczysta} onChange={setKsiegaWieczysta} placeholder="Np. AB1C/00012345/6" />
            </div>

            <Hr className="mt-8" />

            <MarkdownOpis
              value={opis}
              onChange={(v: string) => {
                const next = (v ?? '').slice(0, MAX_OPIS_CHARS);
                setOpis(next);
              }}
            />

            <div className="text-[12px] text-white/40 tracking-[0.12em]">
              Opis: {opis.length}/{MAX_OPIS_CHARS}
            </div>
          </div>

          {/* Lokalizacja */}
          <div className="space-y-6">
            <Hr className="mt-8" />

            <SectionTitle>Lokalizacja</SectionTitle>

            <div className="mt-2">
              <LocationPicker value={location ?? undefined} onChange={(v: any) => setLocation(v)} />
            </div>

            <Hr className="mt-8" />
          </div>

          {err && <div className="text-red-300 text-sm font-medium">{err}</div>}
          {ok && <div className="text-white/85 text-sm font-medium underline underline-offset-8 decoration-white/40">{ok}</div>}

          <button
            disabled={loading || uploadingPhotos}
            className={cx('w-full py-5 text-[16px] md:text-[17px] font-semibold tracking-tight', 'disabled:opacity-60 transition')}
            style={{
              background: 'transparent',
              color: 'white',
              textDecoration: 'underline',
              textUnderlineOffset: '12px',
              textDecorationThickness: '1px',
              textDecorationColor: 'rgba(243,239,245,0.65)',
            }}
          >
            {uploadingPhotos ? 'Wgrywam zdjęcia…' : loading ? 'Zapisywanie…' : 'Dodaj ogłoszenie'}
          </button>
        </form>
      </div>
    </main>
  );
}