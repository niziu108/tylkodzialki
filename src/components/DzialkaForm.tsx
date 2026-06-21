'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import LocationPicker from '@/components/LocationPicker';
import MarkdownOpis from '@/components/MarkdownOpis';
import { OfficeLogo } from '@/components/OfficeLogo';
import { MAX_PHOTOS_PER_OFFER } from '@/lib/photoLimits';

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

type FieldKey =
  | 'tytul'
  | 'cenaPln'
  | 'powierzchniaM2'
  | 'telefon'
  | 'przeznaczenia'
  | 'location'
  | 'photos'
  | 'sprzedajacyImie'
  | 'biuroNazwa'
  | 'biuroOpiekun';

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
  transakcja: 'SPRZEDAZ' | 'WYNAJEM';
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
  step?: number;
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
  transakcja?: 'SPRZEDAZ' | 'WYNAJEM' | null;
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

const BG = 'var(--bg)';
const FG = 'var(--fg)';
const MAX_TITLE_CHARS = 90;
const MAX_OPIS_CHARS = 5000;
const AUTO_PUBLISH_MAX_RETRIES = 8;
const AUTO_PUBLISH_RETRY_DELAY_MS = 1500;
const MAX_PHOTOS = MAX_PHOTOS_PER_OFFER; // limit zdjęć na ofertę — jedno źródło prawdy: src/lib/photoLimits.ts

type WizardStep = { title: string; short: string };

const STEPS: WizardStep[] = [
  { title: 'Podstawowe informacje', short: 'Podstawy' },
  { title: 'Zdjęcia', short: 'Zdjęcia' },
  { title: 'Lokalizacja', short: 'Lokalizacja' },
  { title: 'Szczegóły i uzbrojenie', short: 'Szczegóły' },
  { title: 'Kto sprzedaje', short: 'Sprzedający' },
];
const LAST_STEP = STEPS.length - 1;

// Każde pole wymagane mapujemy na krok, w którym się znajduje. Dzięki temu „Dalej"
// waliduje tylko bieżący krok, a „Opublikuj" potrafi przeskoczyć do najwcześniejszego
// kroku, w którym czegoś brakuje.
const FIELD_STEP: Record<FieldKey, number> = {
  tytul: 0,
  cenaPln: 0,
  powierzchniaM2: 0,
  telefon: 0,
  przeznaczenia: 0,
  photos: 1,
  location: 2,
  sprzedajacyImie: 4,
  biuroNazwa: 4,
  biuroOpiekun: 4,
};

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
  return <div className={cx('border-b border-fg/10', className)} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[22px] md:text-[26px] font-semibold tracking-tight text-fg">{children}</h2>;
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
  autoComplete,
  maxLength,
  showCounter,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  maxLength?: number;
  showCounter?: boolean;
  required?: boolean;
  error?: boolean;
}) {
  return (
    <label className="block">
      <div className="flex items-end justify-between gap-4">
        <div className={cx(
          'text-[11px] uppercase tracking-[0.18em]',
          error ? 'text-red-400/90' : 'text-fg/70'
        )}>
          {label}
          {required ? <span className={error ? 'text-red-400' : 'text-brand-bright'}> *</span> : null}
        </div>
        {showCounter && typeof maxLength === 'number' ? (
          <div className="text-[11px] tracking-[0.12em] text-fg/64">
            {value.length}/{maxLength}
          </div>
        ) : null}
      </div>

      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cx(
          'mt-2 w-full bg-transparent text-[18px] md:text-[19px] text-fg/90',
          error ? 'border-0 border-b border-red-400/70 pb-2' : 'border-0 border-b border-fg/20 pb-2',
          'placeholder:text-fg/62',
          error ? 'outline-none focus:border-red-400/90 focus:ring-0' : 'outline-none focus:border-fg/70 focus:ring-0',
          error
            ? 'underline decoration-red-400/55 decoration-[1px] underline-offset-[10px]'
            : 'underline decoration-white/55 decoration-[1px] underline-offset-[10px]',
          error ? 'focus:decoration-red-400/80' : 'focus:decoration-white/85',
          'selection:bg-fg/20 selection:text-fg'
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
            aria-pressed={active}
            className={cx('text-[15px] font-semibold tracking-tight transition', active ? 'text-fg' : 'text-fg/70 hover:text-fg')}
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
            aria-pressed={active}
            className={cx(
              'text-[13px] md:text-[14px] font-semibold uppercase tracking-[0.08em] transition',
              active ? 'text-fg' : 'text-fg/70 hover:text-fg'
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
            aria-pressed={active}
            className={cx('text-[14px] md:text-[15px] font-semibold tracking-tight transition', active ? 'text-fg' : 'text-fg/70 hover:text-fg')}
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

function handleOpisPasteAsPlainText(e: React.ClipboardEvent<HTMLDivElement>) {
  const text = e.clipboardData.getData('text/plain');
  if (!text) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  const textarea = target.closest('textarea') as HTMLTextAreaElement | null;
  const input = target.closest('input') as HTMLInputElement | null;
  const editable = target.closest('[contenteditable="true"]') as HTMLElement | null;

  if (!textarea && !input && !editable) return;

  e.preventDefault();

  if (textarea || input) {
    const el = (textarea ?? input)!;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const nextValue = el.value.slice(0, start) + text + el.value.slice(end);

    const proto = Object.getPrototypeOf(el);
    const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    valueSetter?.call(el, nextValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));

    requestAnimationFrame(() => {
      const pos = start + text.length;
      el.setSelectionRange?.(pos, pos);
    });

    return;
  }

  if (editable) {
    editable.focus();

    if (document.queryCommandSupported?.('insertText')) {
      document.execCommand('insertText', false, text);
      editable.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    selection.deleteFromDocument();
    const range = selection.getRangeAt(0);
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    editable.dispatchEvent(new Event('input', { bubbles: true }));
  }
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
  const opisWrapRef = useRef<HTMLDivElement | null>(null);
  const errSummaryRef = useRef<HTMLDivElement | null>(null);

  const [tytul, setTytul] = useState(initialData?.tytul ?? '');
  const [telefon, setTelefon] = useState(initialData?.telefon ?? '');

  const [cenaPln, setCenaPln] = useState(
    typeof initialData?.cenaPln === 'number' ? formatThousandsSpaces(String(initialData.cenaPln)) : ''
  );
  const [powierzchniaM2, setPowierzchniaM2] = useState(
    typeof initialData?.powierzchniaM2 === 'number' ? formatThousandsSpaces(String(initialData.powierzchniaM2)) : ''
  );

  const [transakcja, setTransakcja] = useState<'SPRZEDAZ' | 'WYNAJEM'>(
    initialData?.transakcja === 'WYNAJEM' ? 'WYNAJEM' : 'SPRZEDAZ'
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

  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(mode === 'edit' ? STEPS.length - 1 : 0);

  const [activeIdx, setActiveIdx] = useState(0);
  const [uploaded, setUploaded] = useState<UploadedPhoto[]>(
    (initialData?.zdjecia ?? [])
      .slice()
      .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0))
      .slice(0, MAX_PHOTOS)
  );

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<FieldKey>>(new Set());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [createdListing, setCreatedListing] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [pendingPublicationCheckout, setPendingPublicationCheckout] = useState<{
    title: string;
  } | null>(null);

  // Niezalogowany użytkownik kliknął „Opublikuj" — pokazujemy ekran z prośbą o
  // logowanie/rejestrację zamiast nagłego przerzutu na /auth.
  const [pendingLogin, setPendingLogin] = useState<{
    title: string;
  } | null>(null);

  const [draftHydrated, setDraftHydrated] = useState(mode === 'edit');
  const restoredDraftRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function syncOpisEditorHeight() {
    const wrap = opisWrapRef.current;
    if (!wrap) return;

    const textarea = wrap.querySelector('textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.style.height = 'auto';
      const computed = window.getComputedStyle(textarea);
      const minHeight = parseFloat(computed.minHeight || '220');
      const maxHeight = parseFloat(computed.maxHeight || '0');
      const nextHeight = textarea.scrollHeight;
      const targetHeight = Math.max(nextHeight, minHeight);

      if (maxHeight > 0) {
        textarea.style.height = `${Math.min(targetHeight, maxHeight)}px`;
      } else {
        textarea.style.height = `${targetHeight}px`;
      }

      textarea.style.overflowY = 'auto';
      return;
    }

    const editable = wrap.querySelector('[contenteditable="true"]') as HTMLElement | null;
    if (editable) {
      editable.style.height = 'auto';
      const computed = window.getComputedStyle(editable);
      const minHeight = parseFloat(computed.minHeight || '220');
      const maxHeight = parseFloat(computed.maxHeight || '0');
      const nextHeight = editable.scrollHeight;
      const targetHeight = Math.max(nextHeight, minHeight);

      if (maxHeight > 0) {
        editable.style.height = `${Math.min(targetHeight, maxHeight)}px`;
      } else {
        editable.style.height = `${targetHeight}px`;
      }

      editable.style.overflowY = 'auto';
    }
  }

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

  useEffect(() => {
    if (pendingLogin) {
      window.scrollTo(0, 0);
    }
  }, [pendingLogin]);

  // Przy zmianie kroku przewijamy na górę, żeby nowy krok zaczynał się od nagłówka.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      syncOpisEditorHeight();
    });

    const timeout = window.setTimeout(() => {
      syncOpisEditorHeight();
    }, 120);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [opis]);

  function clearFieldError(key: FieldKey) {
    setFieldErrors((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function togglePrzeznaczenie(p: Przeznaczenie) {
    setPrzeznaczenia((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
    clearFieldError('przeznaczenia');
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
    setTransakcja(draft.transakcja === 'WYNAJEM' ? 'WYNAJEM' : 'SPRZEDAZ');
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

    if (typeof draft.step === 'number') {
      const restoredStep = Math.min(Math.max(draft.step, 0), STEPS.length - 1);
      setStep(restoredStep);
      setMaxStep((m) => Math.max(m, restoredStep));
    }

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
      transakcja,
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
      step,
    });
  }, [
    mode,
    draftHydrated,
    tytul,
    telefon,
    cenaPln,
    powierzchniaM2,
    transakcja,
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
    step,
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

  // Duży podgląd zawsze pokazuje zdjęcie główne (pierwsze na liście).
  const previewUrl = currentImages.length ? currentImages[0]?.url ?? null : null;

  function normalizeUploadedOrder(arr: UploadedPhoto[]) {
    return arr.map((x, i) => ({ ...x, kolejnosc: i }));
  }

  // Stabilny identyfikator miniatury (do śledzenia przeciąganego zdjęcia).
  function photoKey(p: UploadedPhoto) {
    return p.publicId || p.url;
  }

  // Przeciąganie miniatur na Pointer Events — jeden kod dla myszy i dotyku.
  // Pozycję docelową liczymy z punktów środkowych sąsiednich miniatur.
  function reorderDraggedTo(targetIdx: number) {
    setUploaded((prev) => {
      const curIdx = prev.findIndex((u) => photoKey(u) === dragIdRef.current);
      if (curIdx === -1 || curIdx === targetIdx) return prev;
      const arr = [...prev];
      const [moved] = arr.splice(curIdx, 1);
      arr.splice(Math.max(0, Math.min(targetIdx, arr.length)), 0, moved);
      return normalizeUploadedOrder(arr);
    });
  }

  function onThumbPointerDown(e: React.PointerEvent<HTMLDivElement>, item: UploadedPhoto) {
    if (e.button > 0) return;
    dragIdRef.current = photoKey(item);
    setDraggingId(photoKey(item));
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // brak realnego wskaźnika (np. testy) — ignorujemy
    }
  }

  function onThumbPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragIdRef.current == null) return;
    const strip = stripRef.current;
    if (!strip) return;

    const els = Array.from(strip.querySelectorAll<HTMLElement>('[data-thumb]'));
    if (!els.length) return;

    // Siatka 2D — celujemy w miniaturę, której środek jest najbliżej kursora/palca.
    let target = 0;
    let best = Infinity;
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = (e.clientX - cx) ** 2 + (e.clientY - cy) ** 2;
      if (dist < best) {
        best = dist;
        target = i;
      }
    }

    reorderDraggedTo(target);
  }

  function endThumbDrag(e: React.PointerEvent<HTMLDivElement>) {
    dragIdRef.current = null;
    setDraggingId(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignorujemy
    }
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
      const results = await Promise.allSettled(
        filesToUpload.map((file) => uploadImageViaApi(file))
      );

      const uploadedNow: UploadedPhoto[] = [];
      let failedCount = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          uploadedNow.push({ url: result.value.url, publicId: result.value.key });
        } else {
          failedCount += 1;
        }
      }

      if (uploadedNow.length > 0) {
        setUploaded((prev) => {
          const merged = [...prev, ...uploadedNow].slice(0, MAX_PHOTOS);
          return normalizeUploadedOrder(merged);
        });

        clearFieldError('photos');

        setActiveIdx((prev) => {
          if (uploaded.length === 0) return 0;
          return prev;
        });
      }

      if (failedCount > 0 && uploadedNow.length > 0) {
        setErr(`Nie udało się wgrać ${failedCount} z ${filesToUpload.length} zdjęć. Pozostałe dodano pomyślnie.`);
      } else if (failedCount > 0) {
        setErr('Nie udało się wgrać zdjęć. Spróbuj ponownie.');
      } else if (arr.length > remainingSlots) {
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
      transakcja,
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

  // Jedno źródło prawdy dla draftu zapisywanego w localStorage (autosave + zapis przed
  // odejściem na logowanie / zakup pakietu). Po powrocie na /sprzedaj?autopublish=1 draft
  // hydratuje formularz i ogłoszenie publikuje się automatycznie.
  function buildDraft(uploadedForDraft: UploadedPhoto[]): DzialkaDraft {
    return {
      tytul,
      telefon,
      cenaPln,
      powierzchniaM2,
      transakcja,
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
      uploaded: uploadedForDraft,
      activeIdx,
      step,
    };
  }

  // Jedna lista braków dla całego formularza. Walidacja kroku to po prostu filtr po
  // FIELD_STEP, a publikacja używa pełnej listy.
  function collectContentIssues(): Array<{ field: FieldKey; message: string }> {
    const issues: Array<{ field: FieldKey; message: string }> = [];

    if (!tytul.trim()) {
      issues.push({ field: 'tytul', message: 'Podaj tytuł ogłoszenia.' });
    } else if (tytul.trim().length > MAX_TITLE_CHARS) {
      issues.push({ field: 'tytul', message: `Tytuł jest za długi (max ${MAX_TITLE_CHARS} znaków).` });
    }

    const pm2 = parseFormattedNumber(powierzchniaM2);
    const cena = parseFormattedNumber(cenaPln);

    if (!Number.isFinite(pm2) || pm2 <= 0) {
      issues.push({ field: 'powierzchniaM2', message: 'Podaj poprawną powierzchnię (m²).' });
    }
    if (!Number.isFinite(cena) || cena <= 0) {
      issues.push({ field: 'cenaPln', message: 'Podaj poprawną cenę (PLN).' });
    }
    if (!telefon.trim()) {
      issues.push({ field: 'telefon', message: 'Podaj numer telefonu.' });
    }
    if (przeznaczenia.length < 1) {
      issues.push({ field: 'przeznaczenia', message: 'Wybierz minimum 1 przeznaczenie.' });
    }
    if (!location) {
      issues.push({ field: 'location', message: 'Wybierz lokalizację działki.' });
    }
    if (uploaded.length < 1) {
      issues.push({ field: 'photos', message: 'Dodaj minimum 1 zdjęcie.' });
    }
    if (sprzedajacyTyp === 'PRYWATNIE' && !sprzedajacyImie.trim()) {
      issues.push({ field: 'sprzedajacyImie', message: 'Podaj imię sprzedającego.' });
    }
    if (sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI') {
      if (!biuroNazwa.trim()) {
        issues.push({ field: 'biuroNazwa', message: 'Podaj nazwę biura nieruchomości.' });
      }
      if (!biuroOpiekun.trim()) {
        issues.push({ field: 'biuroOpiekun', message: 'Podaj imię opiekuna biura.' });
      }
    }

    return issues;
  }

  function validateStep(targetStep: number): boolean {
    const issues = collectContentIssues().filter((i) => FIELD_STEP[i.field] === targetStep);

    if (issues.length > 0) {
      setValidationErrors(issues.map((i) => i.message));
      setFieldErrors(new Set(issues.map((i) => i.field)));
      requestAnimationFrame(() => {
        errSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return false;
    }

    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setValidationErrors([]);
    setFieldErrors(new Set());
    const next = Math.min(step + 1, LAST_STEP);
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
  }

  function goBack() {
    setValidationErrors([]);
    setStep((s) => Math.max(0, s - 1));
  }

  function goToStep(target: number) {
    if (target < 0 || target > LAST_STEP) return;
    if (target > maxStep) return;
    setValidationErrors([]);
    setStep(target);
  }

  async function submitListing(isAutoPublish = false, attempt = 0): Promise<void> {
    setErr(null);
    setOk(null);

    const issues = collectContentIssues();
    const errs = issues.map((i) => i.message);
    const fields = new Set<FieldKey>(issues.map((i) => i.field));

    if (uploadingPhotos) {
      errs.push('Poczekaj aż zdjęcia się wgrają.');
    }
    if (uploadingLogo) {
      errs.push('Poczekaj aż logo biura się wgra.');
    }

    if (errs.length > 0) {
      setValidationErrors(errs);
      setFieldErrors(fields);

      // Przeskocz do najwcześniejszego kroku, w którym brakuje danych.
      if (issues.length > 0) {
        setStep(Math.min(...issues.map((i) => FIELD_STEP[i.field])));
      }

      requestAnimationFrame(() => {
        errSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return;
    }

    setValidationErrors([]);
    setFieldErrors(new Set());

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
        // Niezalogowany użytkownik wypełnił publiczny formularz — logowanie DOPIERO TERAZ.
        // Zapisujemy draft i pokazujemy ekran „zaloguj się, aby opublikować" (bez nagłego
        // przerzutu). Stamtąd → /auth → powrót na /sprzedaj?autopublish=1 → auto-publikacja.
        if (res.status === 401 && mode === 'create') {
          if (isAutoPublish) {
            setErr('Nie udało się potwierdzić logowania. Zaloguj się ponownie i opublikuj ogłoszenie.');
            return;
          }

          saveCreateDraft(buildDraft(uploadedSorted));
          setPendingLogin({ title: tytul.trim() || 'Twoja oferta' });
          return;
        }

        if (data?.error === 'NO_LISTING_CREDITS') {
          if (mode === 'create') {
            saveCreateDraft(buildDraft(uploadedSorted));
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
    // Enter / submit formularza NIGDY nie publikuje — tylko przechodzi dalej
    // (na ostatnim kroku jedynie waliduje). Publikacja wyłącznie przez jawne
    // kliknięcie „Opublikuj".
    goNext();
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

    setStep(LAST_STEP);
    void submitListing(true, 0);
  }, [mode, draftHydrated, shouldAutoPublish]);

  if (pendingLogin) {
    return (
      <main className="min-h-screen" style={{ background: BG, color: FG }}>
        <div className="mx-auto max-w-3xl px-6 py-20">
          <div className="rounded-[32px] border border-brand/25 bg-fg/[0.03] p-8 md:p-10">
            <div className="inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-bright">
              Oferta gotowa
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
              Zarejestruj się, aby opublikować ofertę
            </h1>

            <p className="mt-4 text-base leading-7 text-fg/70">
              Twoja oferta <span className="text-fg">{pendingLogin.title}</span> jest przygotowana i zapisana.
              Zaloguj się lub załóż <span className="text-fg">darmowe</span> konto — opublikujemy ją automatycznie, bez wypełniania formularza ponownie.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/logowanie?callbackUrl=${encodeURIComponent('/sprzedaj?autopublish=1')}`}
                className="inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-4 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Zaloguj się / Zarejestruj
              </Link>

              <button
                type="button"
                onClick={() => setPendingLogin(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-fg/15 bg-fg/[0.03] px-6 py-4 text-sm font-semibold text-fg transition hover:border-fg/30 hover:bg-fg/[0.05]"
              >
                Wróć do edycji
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (pendingPublicationCheckout) {
    return (
      <main className="min-h-screen" style={{ background: BG, color: FG }}>
        <div className="mx-auto max-w-3xl px-6 py-20">
          <div className="rounded-[32px] border border-brand/25 bg-fg/[0.03] p-8 md:p-10">
            <div className="inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-bright">
              Oferta gotowa
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
              Aby opublikować ogłoszenie, kup pakiet
            </h1>

            <p className="mt-4 text-base leading-7 text-fg/70">
              Twoja oferta <span className="text-fg">{pendingPublicationCheckout.title}</span> została przygotowana i zapisana.
              Po zakupie pakietu będziesz mógł opublikować ją od razu, bez wypełniania formularza ponownie.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/panel/pakiety"
                className="inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-4 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Przejdź do pakietów
              </Link>

              <button
                type="button"
                onClick={() => setPendingPublicationCheckout(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-fg/15 bg-fg/[0.03] px-6 py-4 text-sm font-semibold text-fg transition hover:border-fg/30 hover:bg-fg/[0.05]"
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
          <div className="rounded-[32px] border border-brand/25 bg-fg/[0.03] p-8 md:p-10">
            <div className="inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-bright">
              Sukces
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
              Ogłoszenie zostało dodane
            </h1>

            <p className="mt-4 text-base leading-7 text-fg/70">
              Twoja oferta <span className="text-fg">{createdListing.title}</span> jest już zapisana.
              Teraz możesz przejść do podglądu ogłoszenia albo wrócić do panelu klienta.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/dzialka/${createdListing.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-4 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Przejdź do ogłoszenia
              </Link>

              <Link
                href="/panel"
                className="inline-flex items-center justify-center rounded-2xl border border-fg/15 bg-fg/[0.03] px-6 py-4 text-sm font-semibold text-fg transition hover:border-fg/30 hover:bg-fg/[0.05]"
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
      <header className="border-b border-fg/10">
        <div className="mx-auto max-w-5xl px-6 pb-5 pt-7 md:px-10">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.2em] text-fg/68">
                {mode === 'edit' ? 'Edycja ogłoszenia' : 'Dodaj działkę'}
              </div>
              <h1 className="mt-1.5 truncate text-[24px] font-semibold leading-tight tracking-tight text-fg md:text-[30px]">
                {STEPS[step].title}
              </h1>
            </div>
            <div className="hidden shrink-0 text-right text-[13px] font-medium text-fg/68 sm:block">
              Krok {step + 1} / {STEPS.length}
            </div>
          </div>

          {/* Pasek kroków — desktop */}
          <ol className="mt-6 hidden items-center md:flex">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              const reachable = i <= maxStep;

              return (
                <li key={i} className="flex flex-1 items-center last:flex-none">
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    disabled={!reachable}
                    aria-current={active ? 'step' : undefined}
                    className={cx('group flex items-center gap-3', reachable ? 'cursor-pointer' : 'cursor-default')}
                  >
                    <span
                      className={cx(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[14px] font-semibold transition',
                        active
                          ? 'border-brand-bright bg-brand text-black'
                          : done
                          ? 'border-brand/60 bg-brand/15 text-brand-bright'
                          : 'border-fg/20 bg-fg/[0.03] text-fg/70 group-hover:border-fg/35'
                      )}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span
                      className={cx(
                        'whitespace-nowrap text-[13px] font-semibold tracking-tight transition',
                        active ? 'text-fg' : done ? 'text-fg/70 group-hover:text-fg' : 'text-fg/64 group-hover:text-fg/70'
                      )}
                    >
                      {s.short}
                    </span>
                  </button>

                  {i < STEPS.length - 1 ? (
                    <span className={cx('mx-3 h-px flex-1 transition', i < step ? 'bg-brand/50' : 'bg-fg/10')} />
                  ) : null}
                </li>
              );
            })}
          </ol>

          {/* Pasek postępu — mobile */}
          <div className="mt-5 md:hidden">
            <div className="flex items-center justify-between text-[12px] font-medium">
              <span className="text-fg/75">{STEPS[step].short}</span>
              <span className="text-fg/68">{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-fg/10">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 pb-24 pt-10 md:px-10">
        <form onSubmit={onSubmit} className="space-y-10">
          <div className="text-xs text-fg/64">
            <span className="text-brand-bright">*</span> pole wymagane
          </div>

          {validationErrors.length > 0 ? (
            <div
              ref={errSummaryRef}
              className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-4"
            >
              <div className="mb-2 text-sm font-semibold text-red-200">Uzupełnij brakujące pola:</div>
              <ul className="space-y-1">
                {validationErrors.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-300/90">
                    <span className="mt-0.5 shrink-0 text-red-400/70">·</span>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {step === 0 && (
          <div className="space-y-6">
            <SectionTitle>
              Tytuł ogłoszenia <span className="text-brand-bright">*</span>
            </SectionTitle>

            <UnderlineField
              label=""
              value={tytul}
              onChange={(v) => { setTytul(v.slice(0, MAX_TITLE_CHARS)); clearFieldError('tytul'); }}
              placeholder="Wpisz tutaj np. Działka budowlana"
              maxLength={MAX_TITLE_CHARS}
              showCounter
              error={fieldErrors.has('tytul')}
            />

            <Hr className="mt-8" />
          </div>

          )}

          {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <SectionTitle>
                Zdjęcia <span className="text-brand-bright">*</span>
              </SectionTitle>
              <div className="text-[13px] font-medium text-fg/70">
                minimum 1 zdjęcie, maksymalnie {MAX_PHOTOS}
              </div>
            </div>

            <div className={cx(
              'overflow-hidden rounded-3xl border bg-fg/[0.03]',
              fieldErrors.has('photos') ? 'border-red-400/50' : 'border-fg/10'
            )}>
              <div className="relative aspect-[16/9] bg-surface">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-fg/70">
                    <div className="text-center">
                      <div className="text-[16px] font-semibold">Dodaj zdjęcia ogłoszenia</div>
                      <div className="mt-2 text-[13px] text-fg/68">
                        Możesz dodawać zdjęcia kilka razy i usuwać pojedyncze miniatury
                      </div>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs text-white/80">
                  Zdjęcia: {currentImages.length}{' '}
                  {uploadingPhotos ? <span className="text-fg/72">— wgrywam…</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-fg/10 p-4">
                <label
                  className={cx(
                    'inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition',
                    uploaded.length >= MAX_PHOTOS
                      ? 'cursor-not-allowed bg-fg/10 text-fg/68'
                      : 'cursor-pointer bg-brand text-black hover:opacity-90'
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
                    className="inline-flex items-center justify-center rounded-2xl border border-fg/15 bg-fg/[0.03] px-5 py-3 text-sm font-semibold text-fg transition hover:border-fg/30 hover:bg-fg/[0.05]"
                  >
                    Usuń wszystkie
                  </button>
                ) : null}
              </div>

              {uploaded.length > 0 && (
                <>
                  <div className="px-3 pt-2 text-[12px] leading-relaxed text-fg/70">
                    Przeciągnij miniatury, aby zmienić kolejność.{' '}
                    <span className="text-brand-bright">Pierwsze zdjęcie będzie zdjęciem głównym.</span>
                  </div>

                  <div ref={stripRef} className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-6">
                    {uploaded.map((item, idx) => {
                      const isMain = idx === 0;
                      const dragging = draggingId === photoKey(item);

                      return (
                        <div
                          key={photoKey(item)}
                          data-thumb="1"
                          onPointerDown={(e) => onThumbPointerDown(e, item)}
                          onPointerMove={onThumbPointerMove}
                          onPointerUp={endThumbDrag}
                          onPointerCancel={endThumbDrag}
                          className={cx(
                            'relative cursor-grab touch-none select-none transition-transform active:cursor-grabbing',
                            dragging ? 'z-10 scale-105' : ''
                          )}
                        >
                          <div
                            className={cx(
                              'relative overflow-hidden rounded-xl border-2',
                              isMain ? 'border-brand-bright' : 'border-fg/10',
                              dragging ? 'ring-2 ring-fg/40' : ''
                            )}
                          >
                            <img
                              src={item.url}
                              alt=""
                              draggable={false}
                              className="pointer-events-none aspect-[4/3] w-full object-cover"
                            />

                            {isMain ? (
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-brand py-[2px] text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-black">
                                Główne
                              </div>
                            ) : null}

                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => removePhoto(idx)}
                              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white transition hover:bg-black"
                              title="Usuń zdjęcie"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <Hr className="mt-8" />
          </div>

          )}

          {step === 0 && (
          <div className="space-y-8">
            <SectionTitle>Podstawowe informacje</SectionTitle>

            <div>
              <div className="mb-3 text-[12px] uppercase tracking-[0.22em] text-fg/70">Typ oferty</div>
              <Tabs
                value={transakcja}
                onChange={(v) => setTransakcja(v as 'SPRZEDAZ' | 'WYNAJEM')}
                options={[
                  { value: 'SPRZEDAZ', label: 'Sprzedaż' },
                  { value: 'WYNAJEM', label: 'Wynajem' },
                ]}
              />
            </div>

            <div className="grid gap-10 md:grid-cols-2">
              <UnderlineField
                label="Telefon"
                value={telefon}
                onChange={(v) => { setTelefon(v); clearFieldError('telefon'); }}
                placeholder="Np. 605 000 000"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                error={fieldErrors.has('telefon')}
              />

              <UnderlineField
                label={transakcja === 'WYNAJEM' ? 'Czynsz (PLN / miesiąc)' : 'Cena (PLN)'}
                value={cenaPln}
                onChange={(v) => { setCenaPln(formatThousandsSpaces(v)); clearFieldError('cenaPln'); }}
                placeholder={transakcja === 'WYNAJEM' ? 'Np. 2 500' : 'Np. 150 000'}
                inputMode="numeric"
                required
                error={fieldErrors.has('cenaPln')}
              />

              <UnderlineField
                label="Powierzchnia (m²)"
                value={powierzchniaM2}
                onChange={(v) => { setPowierzchniaM2(formatThousandsSpaces(v)); clearFieldError('powierzchniaM2'); }}
                placeholder="Np. 1 200"
                inputMode="numeric"
                required
                error={fieldErrors.has('powierzchniaM2')}
              />
            </div>

            <Hr className="mt-8" />
          </div>

          )}

          {step === 4 && (
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
                  onChange={(v) => { setSprzedajacyImie(v); clearFieldError('sprzedajacyImie'); }}
                  placeholder="Np. Daniel"
                  required
                  error={fieldErrors.has('sprzedajacyImie')}
                />
              </div>
            )}

            {sprzedajacyTyp === 'BIURO_NIERUCHOMOSCI' && (
              <div className="space-y-8 pt-4">
                <div className="grid gap-10 md:grid-cols-2">
                  <UnderlineField
                    label="Nazwa biura"
                    value={biuroNazwa}
                    onChange={(v) => { setBiuroNazwa(v); clearFieldError('biuroNazwa'); }}
                    placeholder="Np. TylkoDziałki Nieruchomości"
                    required
                    error={fieldErrors.has('biuroNazwa')}
                  />

                  <UnderlineField
                    label="Imię opiekuna"
                    value={biuroOpiekun}
                    onChange={(v) => { setBiuroOpiekun(v); clearFieldError('biuroOpiekun'); }}
                    placeholder="Np. Daniel"
                    required
                    error={fieldErrors.has('biuroOpiekun')}
                  />

                  <UnderlineField
                    label="Numer oferty"
                    value={numerOferty}
                    onChange={setNumerOferty}
                    placeholder="Np. M2-123/2026"
                  />
                </div>

                <div className="space-y-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">Logo biura</div>

                  <div className="flex flex-wrap items-center gap-4">
                    <label
                      className={cx(
                        'inline-flex cursor-pointer items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition',
                        uploadingLogo
                          ? 'bg-fg/10 text-fg/68'
                          : 'bg-brand text-black hover:opacity-90'
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
                        className="inline-flex items-center justify-center rounded-2xl border border-fg/15 bg-fg/[0.03] px-5 py-3 text-sm font-semibold text-fg transition hover:border-fg/30 hover:bg-fg/[0.05]"
                      >
                        Usuń logo
                      </button>
                    ) : null}
                  </div>

                  {biuroLogoUrl ? (
                    <OfficeLogo src={biuroLogoUrl} alt="Logo biura" variant="detail" eager />
                  ) : (
                    <div className="text-sm text-fg/68">Logo jest opcjonalne, ale warto je dodać.</div>
                  )}
                </div>
              </div>
            )}

            <Hr className="mt-8" />
          </div>

          )}

          {step === 0 && (
          <div className="space-y-6">
            <SectionTitle>
              Przeznaczenie <span className="text-brand-bright">*</span>
            </SectionTitle>

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

            {fieldErrors.has('przeznaczenia') ? (
              <div className="text-[12px] text-red-400/90">Wybierz minimum 1 przeznaczenie.</div>
            ) : null}

            <Hr className="mt-8" />
          </div>

          )}

          {step === 3 && (
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

          )}

          {step === 3 && (
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
                  aria-pressed={x.v}
                  className={cx('text-[14px] font-semibold tracking-tight transition', x.v ? 'text-fg' : 'text-fg/70 hover:text-fg')}
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

            <div
              ref={opisWrapRef}
              className="opis-mobile-fix"
              onPasteCapture={handleOpisPasteAsPlainText}
              onInputCapture={() => syncOpisEditorHeight()}
            >
              <MarkdownOpis
                value={opis}
                onChange={(v: string) => {
                  const next = (v ?? '').slice(0, MAX_OPIS_CHARS);
                  setOpis(next);
                }}
              />
            </div>

            <div className="text-[12px] tracking-[0.12em] text-fg/64">
              Opis: {opis.length}/{MAX_OPIS_CHARS}
            </div>

            <style jsx global>{`
              .opis-mobile-fix textarea,
              .opis-mobile-fix input,
              .opis-mobile-fix [contenteditable='true'] {
                color: rgba(255, 255, 255, 0.92) !important;
                -webkit-text-fill-color: rgba(255, 255, 255, 0.92) !important;
                caret-color: #ffffff !important;
                background: transparent !important;
              }

              .opis-mobile-fix textarea::placeholder,
              .opis-mobile-fix input::placeholder,
              .opis-mobile-fix [contenteditable='true']::placeholder {
                color: rgba(255, 255, 255, 0.4) !important;
                -webkit-text-fill-color: rgba(255, 255, 255, 0.4) !important;
              }

              .opis-mobile-fix textarea *,
              .opis-mobile-fix input *,
              .opis-mobile-fix [contenteditable='true'] *,
              .opis-mobile-fix [contenteditable='true'] p,
              .opis-mobile-fix [contenteditable='true'] div,
              .opis-mobile-fix [contenteditable='true'] span,
              .opis-mobile-fix [contenteditable='true'] strong,
              .opis-mobile-fix [contenteditable='true'] em,
              .opis-mobile-fix [contenteditable='true'] b,
              .opis-mobile-fix [contenteditable='true'] i,
              .opis-mobile-fix [contenteditable='true'] u,
              .opis-mobile-fix [contenteditable='true'] li,
              .opis-mobile-fix [contenteditable='true'] ul,
              .opis-mobile-fix [contenteditable='true'] ol,
              .opis-mobile-fix [contenteditable='true'] h1,
              .opis-mobile-fix [contenteditable='true'] h2,
              .opis-mobile-fix [contenteditable='true'] h3,
              .opis-mobile-fix [contenteditable='true'] h4,
              .opis-mobile-fix [contenteditable='true'] h5,
              .opis-mobile-fix [contenteditable='true'] h6,
              .opis-mobile-fix [contenteditable='true'] a,
              .opis-mobile-fix [contenteditable='true'] code,
              .opis-mobile-fix [contenteditable='true'] blockquote {
                color: rgba(255, 255, 255, 0.92) !important;
                -webkit-text-fill-color: rgba(255, 255, 255, 0.92) !important;
                background-color: transparent !important;
                border-color: rgba(255, 255, 255, 0.15) !important;
              }

              .opis-mobile-fix textarea,
              .opis-mobile-fix [contenteditable='true'] {
                min-height: 220px !important;
                max-height: 65vh !important;
                overflow-y: auto !important;
                resize: vertical !important;
                -webkit-overflow-scrolling: touch;
                line-height: 1.55 !important;
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.45) rgba(255, 255, 255, 0.08);
              }

              .opis-mobile-fix textarea::-webkit-scrollbar,
              .opis-mobile-fix [contenteditable='true']::-webkit-scrollbar {
                width: 10px;
              }

              .opis-mobile-fix textarea::-webkit-scrollbar-track,
              .opis-mobile-fix [contenteditable='true']::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.08);
                border-radius: 999px;
              }

              .opis-mobile-fix textarea::-webkit-scrollbar-thumb,
              .opis-mobile-fix [contenteditable='true']::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.42);
                border-radius: 999px;
                border: 2px solid transparent;
                background-clip: padding-box;
              }

              .opis-mobile-fix textarea::-webkit-scrollbar-thumb:hover,
              .opis-mobile-fix [contenteditable='true']::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.62);
                background-clip: padding-box;
              }

              @media (max-width: 768px) {
                .opis-mobile-fix textarea,
                .opis-mobile-fix [contenteditable='true'] {
                  min-height: 260px !important;
                  max-height: 55vh !important;
                  font-size: 16px !important;
                  line-height: 1.6 !important;
                }

                .opis-mobile-fix textarea::-webkit-scrollbar,
                .opis-mobile-fix [contenteditable='true']::-webkit-scrollbar {
                  width: 8px;
                }
              }
            `}</style>
          </div>

          )}

          {step === 2 && (
          <div className="space-y-6">
            <Hr className="mt-8" />
            <SectionTitle>
              Lokalizacja <span className="text-brand-bright">*</span>
            </SectionTitle>

            <div className="mt-2">
              <LocationPicker value={location ?? undefined} onChange={(v: any) => { setLocation(v); clearFieldError('location'); }} />
            </div>

            {fieldErrors.has('location') ? (
              <div className="text-[12px] text-red-400/90">Wybierz lokalizację działki z listy.</div>
            ) : null}

            <Hr className="mt-8" />
          </div>

          )}

          {err && <div className="text-sm font-medium text-red-300">{err}</div>}
          {ok && <div className="text-sm font-medium text-fg/85 underline decoration-white/40 underline-offset-8">{ok}</div>}

          {step === LAST_STEP && mode === 'create' && (
            <div className="text-xs text-fg/62">
              Po kliknięciu zapiszesz ofertę.
            </div>
          )}

          {/* Nawigacja kreatora — przyklejona do dołu ekranu */}
          <div className="-mx-6 border-t border-fg/10 px-6 pt-6 md:-mx-10 md:px-10">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0 || loading}
                className={cx(
                  'inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition',
                  step === 0
                    ? 'cursor-not-allowed border-fg/10 text-fg/30'
                    : 'border-fg/15 bg-fg/[0.03] text-fg hover:border-fg/30 hover:bg-fg/[0.05]'
                )}
              >
                ← Wstecz
              </button>

              <div className="hidden text-[13px] font-medium text-fg/64 sm:block">
                Krok {step + 1} z {STEPS.length}
              </div>

              {step < LAST_STEP ? (
                <button
                  key="wizard-next"
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand px-7 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Dalej →
                </button>
              ) : (
                <button
                  key="wizard-submit"
                  type="button"
                  onClick={() => void submitListing(false, 0)}
                  disabled={loading || uploadingPhotos || uploadingLogo}
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand px-7 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
                >
                  {uploadingPhotos
                    ? 'Wgrywam zdjęcia…'
                    : uploadingLogo
                    ? 'Wgrywam logo…'
                    : loading
                    ? shouldAutoPublish
                      ? 'Publikowanie…'
                      : mode === 'edit'
                      ? 'Zapisywanie zmian…'
                      : 'Zapisywanie…'
                    : mode === 'edit'
                    ? 'Potwierdź zmiany'
                    : 'Opublikuj ogłoszenie'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}