'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import LocationPicker from '@/components/LocationPicker';
import MarkdownOpis from '@/components/MarkdownOpis';

type Przeznaczenie =
  | 'INWESTYCYJNA'
  | 'BUDOWLANA'
  | 'ROLNA'
  | 'LESNA'
  | 'REKREACYJNA'
  | 'SIEDLISKOWA';

type LocationMode = 'EXACT' | 'APPROX';
type SprzedajacyTypUI = 'PRYWATNIE' | 'BIURO_NIERUCHOMOSCI';
type SwiatlowodStatus = 'BRAK' | 'W_DRODZE' | 'NA_DZIALCE' | 'MOZLIWOSC_PODLACZENIA';

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

type UploadedPhoto = {
  url: string;
  publicId: string;
  kolejnosc?: number;
};

type SellerDefaults = {
  telefon: string;
  sprzedajacyTyp: SprzedajacyTypUI;
  sprzedajacyImie: string;
  biuroNazwa: string;
  biuroOpiekun: string;
  biuroLogoUrl: string;
};

type DzialkaDraft = {
  tytul: string;
  telefon: string;
  cenaPln: string;
  powierzchniaM2: string;
  sprzedajacyTyp: SprzedajacyTypUI;
  sprzedajacyImie: string;
  biuroNazwa: string;
  biuroOpiekun: string;
  biuroLogoUrl: string;
  numerOferty: string;
  przeznaczenia: Przeznaczenie[];
  location: LocationValue | null;
  opis: string;
  prad:
    | 'BRAK_PRZYLACZA'
    | 'PRZYLACZE_NA_DZIALCE'
    | 'PRZYLACZE_W_DRODZE'
    | 'WARUNKI_PRZYLACZENIA_WYDANE'
    | 'MOZLIWOSC_PRZYLACZENIA';
  woda:
    | 'BRAK_PRZYLACZA'
    | 'WODOCIAG_NA_DZIALCE'
    | 'WODOCIAG_W_DRODZE'
    | 'STUDNIA_GLEBINOWA'
    | 'MOZLIWOSC_PODLACZENIA';
  kanalizacja:
    | 'BRAK'
    | 'MIEJSKA_NA_DZIALCE'
    | 'MIEJSKA_W_DRODZE'
    | 'SZAMBO'
    | 'PRZYDOMOWA_OCZYSZCZALNIA'
    | 'MOZLIWOSC_PODLACZENIA';
  gaz: 'BRAK' | 'GAZ_NA_DZIALCE' | 'GAZ_W_DRODZE' | 'MOZLIWOSC_PODLACZENIA';
  swiatlowod: SwiatlowodStatus;
  wzWydane: boolean;
  mpzp: boolean;
  projektDomu: boolean;
  klasaZiemi: string;
  wymiary: string;
  ksiegaWieczysta: string;
  uploaded: UploadedPhoto[];
  activeIdx: number;
};

const CREATE_DRAFT_KEY = 'tylkodzialki:create-dzialka-draft:v2';
const SELLER_DEFAULTS_KEY = 'tylkodzialki:seller-defaults:v1';

export type DzialkaFormInitialData = {
  id?: string;
  tytul: string;
  telefon: string;
  email?: string;
  cenaPln: number;
  powierzchniaM2: number;
  sprzedajacyTyp: 'PRYWATNIE' | 'BIURO';
  sprzedajacyImie?: string | null;
  biuroNazwa?: string | null;
  biuroOpiekun?: string | null;
  biuroLogoUrl?: string | null;
  numerOferty?: string | null;
  przeznaczenia: Przeznaczenie[];
  opis?: string | null;

  placeId?: string | null;
  locationFull?: string | null;
  locationLabel?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  locationMode?: LocationMode | null;
  parcelText?: string | null;

  prad:
    | 'BRAK_PRZYLACZA'
    | 'PRZYLACZE_NA_DZIALCE'
    | 'PRZYLACZE_W_DRODZE'
    | 'WARUNKI_PRZYLACZENIA_WYDANE'
    | 'MOZLIWOSC_PRZYLACZENIA';

  woda:
    | 'BRAK_PRZYLACZA'
    | 'WODOCIAG_NA_DZIALCE'
    | 'WODOCIAG_W_DRODZE'
    | 'STUDNIA_GLEBINOWA'
    | 'MOZLIWOSC_PODLACZENIA';

  kanalizacja:
    | 'BRAK'
    | 'MIEJSKA_NA_DZIALCE'
    | 'MIEJSKA_W_DRODZE'
    | 'SZAMBO'
    | 'PRZYDOMOWA_OCZYSZCZALNIA'
    | 'MOZLIWOSC_PODLACZENIA';

  gaz: 'BRAK' | 'GAZ_NA_DZIALCE' | 'GAZ_W_DRODZE' | 'MOZLIWOSC_PODLACZENIA';
  swiatlowod: SwiatlowodStatus;

  wzWydane: boolean;
  mpzp: boolean;
  projektDomu: boolean;

  klasaZiemi?: string | null;
  wymiary?: string | null;
  ksiegaWieczysta?: string | null;

  zdjecia?: UploadedPhoto[];
};

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

const BG = '#131313';
const FG = '#F3EFF5';
const MAX_TITLE_CHARS = 90;
const MAX_OPIS_CHARS = 5000;
const AUTO_PUBLISH_MAX_RETRIES = 8;
const AUTO_PUBLISH_RETRY_DELAY_MS = 1500;
const MAX_PHOTOS = 7;

function saveCreateDraft(draft: DzialkaDraft) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(draft));
}

function loadCreateDraft(): DzialkaDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(CREATE_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DzialkaDraft;
  } catch {
    return null;
  }
}

function clearCreateDraft() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CREATE_DRAFT_KEY);
}

function saveSellerDefaults(defaults: SellerDefaults) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SELLER_DEFAULTS_KEY, JSON.stringify(defaults));
}

function loadSellerDefaults(): SellerDefaults | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(SELLER_DEFAULTS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SellerDefaults;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function Hr({ className }: { className?: string }) {
  return <div className={cx('border-b border-white/10', className)} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[22px] md:text-[26px] font-semibold tracking-tight text-white">{children}</h2>;
}

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

async function uploadImageViaApi(file: File): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    throw new Error(data?.message || 'Nie udało się wgrać zdjęcia.');
  }

  return {
    url: data.url,
    key: data.key,
  };
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
          'selection:bg-white/20 selection:text-white'
        )}
      />

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

export default function DzialkaForm({
  mode,
  initialData,
}: {
  mode: 'create' | 'edit';
  initialData?: DzialkaFormInitialData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldAutoPublish = mode === 'create' && searchParams.get('autopublish') === '1';
  const autoPublishAttemptedRef = useRef(false);

  const [tytul, setTytul] = useState(initialData?.tytul ?? '');
  const [telefon, setTelefon] = useState(initialData?.telefon ?? '');

  const [cenaPln, setCenaPln] = useState(
    typeof initialData?.cenaPln === 'number' ? formatThousandsSpaces(String(initialData.cenaPln)) : ''
  );
  const [powierzchniaM2, setPowierzchniaM2] = useState(
    typeof initialData?.powierzchniaM2 === 'number' ? formatThousandsSpaces(String(initialData.powierzchniaM2)) : ''
  );

  const [sprzedajacyTyp, setSprzedajacyTyp] = useState<SprzedajacyTypUI>(
    initialData?.sprzedajacyTyp === 'BIURO' ? 'BIURO_NIERUCHOMOSCI' : 'PRYWATNIE'
  );
  const [sprzedajacyImie, setSprzedajacyImie] = useState(initialData?.sprzedajacyImie ?? '');
  const [biuroNazwa, setBiuroNazwa] = useState(initialData?.biuroNazwa ?? '');
  const [biuroOpiekun, setBiuroOpiekun] = useState(initialData?.biuroOpiekun ?? '');
  const [biuroLogoUrl, setBiuroLogoUrl] = useState(initialData?.biuroLogoUrl ?? '');

  const [numerOferty, setNumerOferty] = useState(initialData?.numerOferty ?? '');

  const [przeznaczenia, setPrzeznaczenia] = useState<Przeznaczenie[]>(
    initialData?.przeznaczenia?.length ? initialData.przeznaczenia : ['BUDOWLANA']
  );

  const [location, setLocation] = useState<LocationValue | null>(
    initialData?.lat != null &&
      initialData?.lng != null &&
      initialData?.locationLabel
      ? {
          placeId: initialData.placeId ?? null,
          locationFull: initialData.locationFull ?? null,
          locationLabel: initialData.locationLabel,
          lat: initialData.lat,
          lng: initialData.lng,
          mapsUrl: initialData.mapsUrl ?? null,
          locationMode: (initialData.locationMode ?? 'EXACT') as LocationMode,
          parcelText: initialData.parcelText ?? null,
        }
      : null
  );

  const [opis, setOpis] = useState(initialData?.opis ?? '');

  const [prad, setPrad] = useState<
    'BRAK_PRZYLACZA' | 'PRZYLACZE_NA_DZIALCE' | 'PRZYLACZE_W_DRODZE' | 'WARUNKI_PRZYLACZENIA_WYDANE' | 'MOZLIWOSC_PRZYLACZENIA'
  >(initialData?.prad ?? 'BRAK_PRZYLACZA');

  const [woda, setWoda] = useState<
    'BRAK_PRZYLACZA' | 'WODOCIAG_NA_DZIALCE' | 'WODOCIAG_W_DRODZE' | 'STUDNIA_GLEBINOWA' | 'MOZLIWOSC_PODLACZENIA'
  >(initialData?.woda ?? 'BRAK_PRZYLACZA');

  const [kanalizacja, setKanalizacja] = useState<
    'BRAK' | 'MIEJSKA_NA_DZIALCE' | 'MIEJSKA_W_DRODZE' | 'SZAMBO' | 'PRZYDOMOWA_OCZYSZCZALNIA' | 'MOZLIWOSC_PODLACZENIA'
  >(initialData?.kanalizacja ?? 'BRAK');

  const [gaz, setGaz] = useState<'BRAK' | 'GAZ_NA_DZIALCE' | 'GAZ_W_DRODZE' | 'MOZLIWOSC_PODLACZENIA'>(
    initialData?.gaz ?? 'BRAK'
  );

  const [swiatlowod, setSwiatlowod] = useState<SwiatlowodStatus>(
    initialData?.swiatlowod ?? 'BRAK'
  );

  const [wzWydane, setWzWydane] = useState(initialData?.wzWydane ?? false);
  const [mpzp, setMpzp] = useState(initialData?.mpzp ?? false);
  const [projektDomu, setProjektDomu] = useState(initialData?.projektDomu ?? false);

  const [klasaZiemi, setKlasaZiemi] = useState(initialData?.klasaZiemi ?? '');
  const [wymiary, setWymiary] = useState(initialData?.wymiary ?? '');
  const [ksiegaWieczysta, setKsiegaWieczysta] = useState(initialData?.ksiegaWieczysta ?? '');

  const [activeIdx, setActiveIdx] = useState(0);
  const [uploaded, setUploaded] = useState<UploadedPhoto[]>(
    (initialData?.zdjecia ?? [])
      .slice()
      .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0))
      .slice(0, MAX_PHOTOS)
  );

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [createdListing, setCreatedListing] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [pendingPublicationCheckout, setPendingPublicationCheckout] = useState<{
    title: string;
  } | null>(null);

  const [draftHydrated, setDraftHydrated] = useState(mode === 'edit');
  const restoredDraftRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (createdListing) {
      window.scrollTo(0, 0);
    }
  }, [createdListing]);

  useEffect(() => {
    if (pendingPublicationCheckout) {
      window.scrollTo(0, 0);
    }
  }, [pendingPublicationCheckout]);

  function togglePrzeznaczenie(p: Przeznaczenie) {
    setPrzeznaczenia((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  useEffect(() => {
    if (mode !== 'create') return;
    if (restoredDraftRef.current) return;

    restoredDraftRef.current = true;

    const defaults = loadSellerDefaults();

    if (defaults) {
      setTelefon(defaults.telefon ?? '');
      setSprzedajacyTyp(defaults.sprzedajacyTyp ?? 'PRYWATNIE');
      setSprzedajacyImie(defaults.sprzedajacyImie ?? '');
      setBiuroNazwa(defaults.biuroNazwa ?? '');
      setBiuroOpiekun(defaults.biuroOpiekun ?? '');
      setBiuroLogoUrl(defaults.biuroLogoUrl ?? '');
    }

    const draft = loadCreateDraft();
    if (!draft) {
      setDraftHydrated(true);
      return;
    }

    setTytul(draft.tytul ?? '');
    setTelefon(draft.telefon ?? defaults?.telefon ?? '');
    setCenaPln(draft.cenaPln ?? '');
    setPowierzchniaM2(draft.powierzchniaM2 ?? '');
    setSprzedajacyTyp(draft.sprzedajacyTyp ?? defaults?.sprzedajacyTyp ?? 'PRYWATNIE');
    setSprzedajacyImie(draft.sprzedajacyImie ?? defaults?.sprzedajacyImie ?? '');
    setBiuroNazwa(draft.biuroNazwa ?? defaults?.biuroNazwa ?? '');
    setBiuroOpiekun(draft.biuroOpiekun ?? defaults?.biuroOpiekun ?? '');
    setBiuroLogoUrl(draft.biuroLogoUrl ?? defaults?.biuroLogoUrl ?? '');
    setNumerOferty(draft.numerOferty ?? '');
    setPrzeznaczenia(draft.przeznaczenia?.length ? draft.przeznaczenia : ['BUDOWLANA']);
    setLocation(draft.location ?? null);
    setOpis(draft.opis ?? '');
    setPrad(draft.prad ?? 'BRAK_PRZYLACZA');
    setWoda(draft.woda ?? 'BRAK_PRZYLACZA');
    setKanalizacja((draft.kanalizacja ?? 'BRAK') as any);
    setGaz(draft.gaz ?? 'BRAK');
    setSwiatlowod(draft.swiatlowod ?? 'BRAK');
    setWzWydane(!!draft.wzWydane);
    setMpzp(!!draft.mpzp);
    setProjektDomu(!!draft.projektDomu);
    setKlasaZiemi(draft.klasaZiemi ?? '');
    setWymiary(draft.wymiary ?? '');
    setKsiegaWieczysta(draft.ksiegaWieczysta ?? '');
    setUploaded(Array.isArray(draft.uploaded) ? draft.uploaded.slice(0, MAX_PHOTOS) : []);
    setActiveIdx(typeof draft.activeIdx === 'number' ? draft.activeIdx : 0);

    setDraftHydrated(true);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!draftHydrated) return;

    saveCreateDraft({
      tytul,
      telefon,
      cenaPln,
      powierzchniaM2,
      sprzedajacyTyp,
      sprzedajacyImie,
      biuroNazwa,
      biuroOpiekun,
      biuroLogoUrl,
      numerOferty,
      przeznaczenia,
      location,
      opis,
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
      uploaded,
      activeIdx,
    });
  }, [
    mode,
    draftHydrated,
    tytul,
    telefon,
    cenaPln,
    powierzchniaM2,
    sprzedajacyTyp,
    sprzedajacyImie,
    biuroNazwa,
    biuroOpiekun,
    biuroLogoUrl,
    numerOferty,
    przeznaczenia,
    location,
    opis,
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
    uploaded,
    activeIdx,
  ]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!draftHydrated) return;

    saveSellerDefaults({
      telefon,
      sprzedajacyTyp,
      sprzedajacyImie,
      biuroNazwa,
      biuroOpiekun,
      biuroLogoUrl,
    });
  }, [
    mode,
    draftHydrated,
    telefon,
    sprzedajacyTyp,
    sprzedajacyImie,
    biuroNazwa,
    biuroOpiekun,
    biuroLogoUrl,
  ]);

  const currentImages = useMemo(() => {
    return uploaded.map((u) => ({ url: u.url, uploaded: true }));
  }, [uploaded]);

  const previewUrl = currentImages.length
    ? currentImages[Math.min(activeIdx, currentImages.length - 1)]?.url ?? null
    : null;

  function normalizeUploadedOrder(arr: UploadedPhoto[]) {
    return arr.map((x, i) => ({ ...x, kolejnosc: i }));
  }

  function movePhoto(from: number, to: number) {
    if (to < 0 || to >= uploaded.length) return;

    setUploaded((prev) => {
      const a = [...prev].sort((x, y) => (x.kolejnosc ?? 0) - (y.kolejnosc ?? 0));
      const [it] = a.splice(from, 1);
      a.splice(to, 0, it);
      return normalizeUploadedOrder(a);
    });

    setActiveIdx((prev) => {
      if (prev === from) return to;
      if (from < prev && to >= prev) return prev - 1;
      if (from > prev && to <= prev) return prev + 1;
      return prev;
    });
  }

  function removePhoto(index: number) {
    setUploaded((prev) => {
      const sorted = [...prev].sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));
      sorted.splice(index, 1);
      return normalizeUploadedOrder(sorted);
    });

    setActiveIdx((prev) => {
      if (prev > index) return prev - 1;
      if (prev === index) return Math.max(0, prev - 1);
      return prev;
    });
  }

  async function handleAddPhotos(fileList: FileList | null) {
    const arr = Array.from(fileList ?? []);
    if (!arr.length) return;

    const remainingSlots = MAX_PHOTOS - uploaded.length;

    if (remainingSlots <= 0) {
      setErr(`Możesz dodać maksymalnie ${MAX_PHOTOS} zdjęć.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const filesToUpload = arr.slice(0, remainingSlots);

    setErr(null);
    setOk(null);
    setUploadingPhotos(true);

    try {
      const uploadedNow: UploadedPhoto[] = [];

      for (const file of filesToUpload) {
        const out = await uploadImageViaApi(file);
        uploadedNow.push({
          url: out.url,
          publicId: out.key,
        });
      }

      setUploaded((prev) => {
        const merged = [...prev, ...uploadedNow].slice(0, MAX_PHOTOS);
        return normalizeUploadedOrder(merged);
      });

      setActiveIdx((prev) => {
        if (uploaded.length === 0) return 0;
        return prev;
      });

      if (arr.length > remainingSlots) {
        setErr(`Możesz dodać maksymalnie ${MAX_PHOTOS} zdjęć. Nadmiarowe pliki zostały pominięte.`);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (e: any) {
      setErr(e?.message || 'Błąd uploadu zdjęć.');
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function handleLogoUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    setErr(null);
    setOk(null);
    setUploadingLogo(true);

    try {
      const out = await uploadImageViaApi(file);
      setBiuroLogoUrl(out.url);

      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    } catch (e: any) {
      setErr(e?.message || 'Nie udało się wgrać logo biura.');
    } finally {
      setUploadingLogo(false);
    }
  }

  function buildPayload(uploadedSorted: UploadedPhoto[]) {
    const pm2 = parseFormattedNumber(powierzchniaM2);
    const cena = parseFormattedNumber(cenaPln);

    return {
      tytul: tytul.trim().slice(0, MAX_TITLE_CHARS),
      powierzchniaM2: pm2,
      cenaPln: cena,
      przeznaczenia,
      telefon: telefon.trim(),
      opis: opis.trim() ? opis.trim().slice(0, MAX_OPIS_CHARS) : null,
      sprzedajacyTyp: sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' ? 'BIURO' : 'PRYWATNIE',
      sprzedajacyImie: sprzedajacyTyp === 'PRYWATNIE' ? sprzedajacyImie.trim() : null,
      biuroNazwa: sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' ? biuroNazwa.trim() : null,
      biuroOpiekun: sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' ? biuroOpiekun.trim() : null,
      biuroLogoUrl: sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' ? biuroLogoUrl.trim() || null : null,
      numerOferty: sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' ? numerOferty.trim() || null : null,
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
      zdjecia: uploadedSorted,
    };
  }

  async function submitListing(isAutoPublish = false, attempt = 0): Promise<void> {
    setErr(null);
    setOk(null);

    if (!tytul.trim()) return setErr('Podaj tytuł.');
    if (tytul.trim().length > MAX_TITLE_CHARS) return setErr(`Tytuł jest za długi (max ${MAX_TITLE_CHARS} znaków).`);

    const pm2 = parseFormattedNumber(powierzchniaM2);
    const cena = parseFormattedNumber(cenaPln);

    if (!Number.isFinite(pm2) || pm2 <= 0) return setErr('Podaj poprawną powierzchnię.');
    if (!Number.isFinite(cena) || cena <= 0) return setErr('Podaj poprawną cenę.');
    if (!telefon.trim()) return setErr('Podaj telefon.');
    if (przeznaczenia.length < 1) return setErr('Wybierz min. 1 przeznaczenie.');
    if (!location) return setErr('Wybierz lokalizację.');
    if (uploaded.length < 1) return setErr('Dodaj minimum 1 zdjęcie.');
    if (uploaded.length > MAX_PHOTOS) return setErr(`Możesz dodać maksymalnie ${MAX_PHOTOS} zdjęć.`);
    if (uploadingPhotos) return setErr('Poczekaj aż zdjęcia się wgrają.');
    if (uploadingLogo) return setErr('Poczekaj aż logo biura się wgra.');

    if (sprzedajacyTyp === 'PRYWATNIE' && !sprzedajacyImie.trim()) {
      return setErr('Dla ogłoszenia prywatnego podaj imię.');
    }

    if (sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI') {
      if (!biuroNazwa.trim()) return setErr('Dla biura nieruchomości podaj nazwę biura.');
      if (!biuroOpiekun.trim()) return setErr('Dla biura nieruchomości podaj imię opiekuna.');
    }

    const uploadedSorted = [...uploaded].sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));

    setLoading(true);
    try {
      const endpoint =
        mode === 'edit' && initialData?.id
          ? `/api/panel/dzialki/${initialData.id}`
          : '/api/dzialki';

      const method = mode === 'edit' ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(uploadedSorted)),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.error === 'NO_LISTING_CREDITS') {
          if (mode === 'create') {
            saveCreateDraft({
              tytul,
              telefon,
              cenaPln,
              powierzchniaM2,
              sprzedajacyTyp,
              sprzedajacyImie,
              biuroNazwa,
              biuroOpiekun,
              biuroLogoUrl,
              numerOferty,
              przeznaczenia,
              location,
              opis,
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
              uploaded: uploadedSorted,
              activeIdx,
            });
          }

          if (isAutoPublish) {
            if (attempt < AUTO_PUBLISH_MAX_RETRIES) {
              setErr('Finalizuję płatność i publikuję ogłoszenie…');
              await sleep(AUTO_PUBLISH_RETRY_DELAY_MS);
              await submitListing(true, attempt + 1);
              return;
            }

            setErr('Pakiet jest jeszcze księgowany. Odśwież stronę za chwilę i kliknij ponownie „Opublikuj przygotowane ogłoszenie”.');
            return;
          }

          setPendingPublicationCheckout({
            title: tytul.trim() || 'Twoja oferta',
          });
          return;
        }

        throw new Error(data?.message || data?.error || 'Błąd zapisu.');
      }

      if (mode === 'create') {
        clearCreateDraft();

        const createdId = data?.item?.id;
        const createdTitle = data?.item?.tytul || tytul.trim();

        if (createdId) {
          setCreatedListing({
            id: createdId,
            title: createdTitle,
          });
          setOk(
            isAutoPublish
              ? 'Przygotowane ogłoszenie zostało opublikowane automatycznie.'
              : 'Ogłoszenie zostało dodane pomyślnie.'
          );
          return;
        }
      }

      setOk(mode === 'edit' ? 'Zapisano zmiany.' : 'Dodano ogłoszenie.');

      if (mode === 'edit') {
        router.push('/panel');
        router.refresh();
      }
    } catch (e: any) {
      setErr(e?.message || 'Coś poszło nie tak.');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitListing(false, 0);
  }

  useEffect(() => {
    if (mode !== 'create') return;
    if (!draftHydrated) return;
    if (!shouldAutoPublish) return;
    if (autoPublishAttemptedRef.current) return;

    autoPublishAttemptedRef.current = true;

    const draft = loadCreateDraft();

    if (!draft) {
      setErr('Nie znaleziono przygotowanego ogłoszenia do publikacji.');
      return;
    }

    void submitListing(true, 0);
  }, [mode, draftHydrated, shouldAutoPublish]);

  if (pendingPublicationCheckout) {
    return (
      <main className="min-h-screen" style={{ background: BG, color: FG }}>
        <div className="mx-auto max-w-3xl px-6 py-20">
          <div className="rounded-[32px] border border-[#7aa333]/25 bg-white/[0.03] p-8 md:p-10">
            <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
              Oferta gotowa
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Aby opublikować ogłoszenie, kup pakiet
            </h1>

            <p className="mt-4 text-base leading-7 text-white/65">
              Twoja oferta <span className="text-white">{pendingPublicationCheckout.title}</span> została przygotowana i zapisana.
              Po zakupie pakietu będziesz mógł opublikować ją od razu, bez wypełniania formularza ponownie.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/panel/pakiety"
                className="inline-flex items-center justify-center rounded-2xl bg-[#7aa333] px-6 py-4 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Przejdź do pakietów
              </Link>

              <button
                type="button"
                onClick={() => setPendingPublicationCheckout(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.05]"
              >
                Wróć do edycji
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (createdListing) {
    return (
      <main className="min-h-screen" style={{ background: BG, color: FG }}>
        <div className="mx-auto max-w-3xl px-6 py-20">
          <div className="rounded-[32px] border border-[#7aa333]/25 bg-white/[0.03] p-8 md:p-10">
            <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
              Sukces
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Ogłoszenie zostało dodane
            </h1>

            <p className="mt-4 text-base leading-7 text-white/65">
              Twoja oferta <span className="text-white">{createdListing.title}</span> jest już zapisana.
              Teraz możesz przejść do podglądu ogłoszenia albo wrócić do panelu klienta.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/dzialka/${createdListing.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-[#7aa333] px-6 py-4 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Przejdź do ogłoszenia
              </Link>

              <Link
                href="/panel"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.05]"
              >
                Przejdź do panelu
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: BG, color: FG }}>
      <section className="relative mt-6 w-full">
        <div
          className="absolute inset-4"
          style={{
            backgroundImage: `url(/kup.webp)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 65%',
          }}
        />
        <div className="absolute inset-4 bg-black/30" />

        <div className="relative mx-auto flex min-h-[320px] max-w-6xl items-center justify-center px-4 sm:min-h-[360px]">
          <div className="max-w-3xl px-2 text-center">
            <h1 className="text-[30px] font-semibold leading-[1.12] tracking-tight text-white sm:text-[38px] md:text-[46px]">
              {mode === 'edit' ? 'Edytuj ogłoszenie' : 'Dodaj działkę w dwie minuty'}
            </h1>
            <p className="mt-5 text-[16px] font-medium text-white/95 sm:text-[18px] md:text-[20px]">
              {mode === 'edit' ? 'Wprowadź zmiany i zapisz ofertę.' : 'i zacznij otrzymywać zapytania.'}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 pb-24 pt-10 md:px-10">
        <form onSubmit={onSubmit} className="space-y-10">
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

          <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <SectionTitle>Zdjęcia</SectionTitle>
              <div className="text-[13px] font-medium text-white/55">
                minimum 1 zdjęcie, maksymalnie {MAX_PHOTOS}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
              <div className="relative aspect-[16/9] bg-black/25">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/70">
                    <div className="text-center">
                      <div className="text-[16px] font-semibold">Dodaj zdjęcia ogłoszenia</div>
                      <div className="mt-2 text-[13px] text-white/45">
                        Możesz dodawać zdjęcia kilka razy i usuwać pojedyncze miniatury
                      </div>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs text-white/80">
                  Zdjęcia: {currentImages.length}{' '}
                  {uploadingPhotos ? <span className="text-white/60">— wgrywam…</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 p-4">
                <label
                  className={cx(
                    'inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition',
                    uploaded.length >= MAX_PHOTOS
                      ? 'cursor-not-allowed bg-white/10 text-white/45'
                      : 'cursor-pointer bg-[#7aa333] text-black hover:opacity-90'
                  )}
                >
                  {uploaded.length >= MAX_PHOTOS ? `Limit ${MAX_PHOTOS} zdjęć` : 'Dodaj zdjęcia'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleAddPhotos(e.target.files)}
                    disabled={uploaded.length >= MAX_PHOTOS}
                  />
                </label>

                {uploaded.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUploaded([]);
                      setActiveIdx(0);
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.05]"
                  >
                    Usuń wszystkie
                  </button>
                ) : null}
              </div>

              {currentImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {currentImages.map((item, idx) => {
                    const active = idx === activeIdx;

                    return (
                      <div
                        key={idx}
                        className="shrink-0"
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
                        <div
                          className={cx(
                            'relative overflow-hidden rounded-2xl border',
                            active ? 'border-white/60' : 'border-white/10 opacity-85 hover:opacity-100'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveIdx(idx)}
                            className="block"
                          >
                            <img src={item.url} alt="" className="h-16 w-28 object-cover" />
                          </button>

                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white transition hover:bg-black"
                            title="Usuń zdjęcie"
                          >
                            ×
                          </button>
                        </div>

                        <div className="mt-1 flex items-center justify-between px-1">
                          <button
                            type="button"
                            onClick={() => movePhoto(idx, idx - 1)}
                            className="text-[11px] text-white/55 transition hover:text-white/85"
                            title="W lewo"
                          >
                            ↑
                          </button>
                          <div className="text-[11px] text-white/35">{idx + 1}</div>
                          <button
                            type="button"
                            onClick={() => movePhoto(idx, idx + 1)}
                            className="text-[11px] text-white/55 transition hover:text-white/85"
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

            <Hr className="mt-8" />
          </div>

          <div className="space-y-8">
            <SectionTitle>Podstawowe informacje</SectionTitle>

            <div className="grid gap-10 md:grid-cols-2">
              <UnderlineField
                label="Telefon"
                value={telefon}
                onChange={setTelefon}
                placeholder="Np. 605 000 000"
              />

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

            {sprzedajacyTyp === 'PRYWATNIE' && (
              <div className="max-w-xl pt-4">
                <UnderlineField
                  label="Imię sprzedającego"
                  value={sprzedajacyImie}
                  onChange={setSprzedajacyImie}
                  placeholder="Np. Daniel"
                />
              </div>
            )}

            {sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' && (
              <div className="space-y-8 pt-4">
                <div className="grid gap-10 md:grid-cols-2">
                  <UnderlineField
                    label="Nazwa biura"
                    value={biuroNazwa}
                    onChange={setBiuroNazwa}
                    placeholder="Np. TylkoDziałki Nieruchomości"
                  />

                  <UnderlineField
                    label="Imię opiekuna"
                    value={biuroOpiekun}
                    onChange={setBiuroOpiekun}
                    placeholder="Np. Daniel"
                  />

                  <UnderlineField
                    label="Numer oferty"
                    value={numerOferty}
                    onChange={setNumerOferty}
                    placeholder="Np. M2-123/2026"
                  />
                </div>

                <div className="space-y-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Logo biura</div>

                  <div className="flex flex-wrap items-center gap-4">
                    <label
                      className={cx(
                        'inline-flex cursor-pointer items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition',
                        uploadingLogo
                          ? 'bg-white/10 text-white/45'
                          : 'bg-[#7aa333] text-black hover:opacity-90'
                      )}
                    >
                      {uploadingLogo ? 'Wgrywam logo…' : 'Wgraj logo'}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoUpload(e.target.files)}
                        disabled={uploadingLogo}
                      />
                    </label>

                    {biuroLogoUrl ? (
                      <button
                        type="button"
                        onClick={() => setBiuroLogoUrl('')}
                        className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.05]"
                      >
                        Usuń logo
                      </button>
                    ) : null}
                  </div>

                  {biuroLogoUrl ? (
                    <div className="inline-flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <img src={biuroLogoUrl} alt="Logo biura" className="h-16 w-auto max-w-[180px] object-contain" />
                    </div>
                  ) : (
                    <div className="text-sm text-white/45">Logo jest opcjonalne, ale warto je dodać.</div>
                  )}
                </div>
              </div>
            )}

            <Hr className="mt-8" />
          </div>

          <div className="space-y-6">
            <SectionTitle>Przeznaczenie</SectionTitle>

            <MultiTabs
              values={przeznaczenia}
              toggle={(v) => togglePrzeznaczenie(v as Przeznaczenie)}
              options={[
                { value: 'INWESTYCYJNA', label: 'Inwestycyjna' },
                { value: 'BUDOWLANA', label: 'Budowlana' },
                { value: 'ROLNA', label: 'Rolna' },
                { value: 'LESNA', label: 'Leśna' },
                { value: 'REKREACYJNA', label: 'Rekreacyjna' },
                { value: 'SIEDLISKOWA', label: 'Siedliskowa' },
              ]}
            />

            <Hr className="mt-8" />
          </div>

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
                onChange={(v) => setSwiatlowod(v as SwiatlowodStatus)}
                options={[
                  { value: 'BRAK', label: 'Brak' },
                  { value: 'W_DRODZE', label: 'W drodze' },
                  { value: 'NA_DZIALCE', label: 'Na działce' },
                  { value: 'MOZLIWOSC_PODLACZENIA', label: 'Możliwość podłączenia' },
                ]}
              />
              <Hr className="mt-8" />
            </div>
          </div>

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

            <div className="text-[12px] tracking-[0.12em] text-white/40">
              Opis: {opis.length}/{MAX_OPIS_CHARS}
            </div>
          </div>

          <div className="space-y-6">
            <Hr className="mt-8" />
            <SectionTitle>Lokalizacja</SectionTitle>

            <div className="mt-2">
              <LocationPicker value={location ?? undefined} onChange={(v: any) => setLocation(v)} />
            </div>

            <Hr className="mt-8" />
          </div>

          {err && <div className="text-sm font-medium text-red-300">{err}</div>}
          {ok && <div className="text-sm font-medium text-white/85 underline decoration-white/40 underline-offset-8">{ok}</div>}

          {mode === 'create' && (
            <div className="text-xs text-white/35">
              Jeśli nie masz już dostępnych publikacji, po kliknięciu zapiszesz ofertę i przejdziesz do zakupu pakietu.
            </div>
          )}

          <button
            disabled={loading || uploadingPhotos || uploadingLogo}
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
            {uploadingPhotos
              ? 'Wgrywam zdjęcia…'
              : uploadingLogo
              ? 'Wgrywam logo…'
              : loading
              ? shouldAutoPublish
                ? 'Publikowanie przygotowanego ogłoszenia…'
                : mode === 'edit'
                ? 'Zapisywanie zmian…'
                : 'Zapisywanie…'
              : mode === 'edit'
              ? 'Potwierdź zmiany'
              : 'Dodaj ogłoszenie'}
          </button>
        </form>
      </div>
    </main>
  );
}