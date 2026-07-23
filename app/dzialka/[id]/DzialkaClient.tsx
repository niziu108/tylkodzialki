'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { HeartIcon } from '@/components/OfferCard';
import { OfficeLogo } from '@/components/OfficeLogo';
import { formatOpis, plainText } from '@/lib/formatOpis';
import AlertBar from '@/components/AlertBar';
import type { AlertCriteria } from '@/lib/alertCriteria';

type Photo = { id?: string; url: string; publicId?: string; kolejnosc?: number };

type Dzialka = {
  id: string;
  tytul: string;
  opis?: string | null;
  cenaPln: number;
  powierzchniaM2: number;
  transakcja?: 'SPRZEDAZ' | 'WYNAJEM' | string | null;
  status?: 'AKTYWNE' | 'ZAKONCZONE' | string | null;

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
  biuroLogoBg?: boolean | null;
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

// formatOpis wydzielone do src/lib/formatOpis.ts (testowane, m.in. pod kątem XSS).

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

function MailIcon({ className }: { className?: string }) {
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
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export default function DzialkaPage({
  initial,
  preview = false,
  onPreviewBack,
}: {
  initial?: Dzialka | null;
  // Tryb podglądu (z kreatora /sprzedaj): identyczny wygląd, ale BEZ skutków ubocznych —
  // bez trackowania, ulubionych, udostępniania i nawigacji „Wróć do listy".
  preview?: boolean;
  // W podglądzie „Wróć do listy" wraca do widoku listy podglądu (nie nawiguje).
  onPreviewBack?: () => void;
}) {
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

  // Numer telefonu domyślnie zakryty — dopiero „Pokaż numer" go odsłania. Samo odsłonięcie
  // liczymy jako lead (kontakt), żeby nikt nie spisał numeru z ekranu bez śladu w statystykach.
  const [phoneRevealed, setPhoneRevealed] = useState(false);

  // Alert pod tytułem oferty pokazujemy dopiero, gdy ktoś ogląda drugą (lub kolejną)
  // działkę w tej sesji — czyli już widać, że przegląda, a nie na pierwszej sekundzie
  // pierwszego wejścia. Wtedy prośba o e-mail jest zasłużona, a nie nachalna.
  const [showAlert, setShowAlert] = useState(false);

  // Klucz okolicy dla alertu: miejscowość (a przy jej braku zaokrąglone współrzędne).
  // Po nim rozpoznajemy, czy dla tej okolicy ktoś już włączył powiadomienie.
  const alertLocationKey = useMemo<string | null>(() => {
    if (!d) return null;
    const town = (d.locationLabel ?? '').split(',')[0]?.trim();
    if (town) return town.toLowerCase();
    if (typeof d.lat === 'number' && typeof d.lng === 'number') {
      return `geo:${d.lat.toFixed(2)},${d.lng.toFixed(2)}`;
    }
    return null;
  }, [d]);

  // Po włączeniu powiadomienia zapamiętujemy okolicę w localStorage (trzyma się między
  // sesjami). Bieżącej oferty tu NIE chowamy — alert ma zostać, żeby pokazać „Sprawdź
  // skrzynkę". Chowa się dopiero przy wejściu w kolejną ofertę z tej samej okolicy.
  const rememberAlertLocation = () => {
    if (!alertLocationKey) return;
    try {
      const raw = localStorage.getItem('TD_ALERT_SUBSCRIBED');
      const arr = raw ? JSON.parse(raw) : [];
      const set = Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string') : [];
      if (!set.includes(alertLocationKey)) {
        set.push(alertLocationKey);
        localStorage.setItem('TD_ALERT_SUBSCRIBED', JSON.stringify(set.slice(-100)));
      }
    } catch {}
  };

  // Formularz „Napisz wiadomość" (desktop) — lead leci mailem do sprzedającego.
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgName, setMsgName] = useState('');
  const [msgEmail, setMsgEmail] = useState('');
  const [msgPhone, setMsgPhone] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgWebsite, setMsgWebsite] = useState(''); // honeypot
  const [msgSending, setMsgSending] = useState(false);
  const [msgDone, setMsgDone] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);

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
    if (preview) return;

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
  }, [id, preview]);

  // Widoczność alertu liczymy raz na ofertę (zależy od id i okolicy, NIE od zapisu na
  // bieżącej stronie — dlatego czytamy localStorage bezpośrednio, a nie ze stanu Reacta).
  // Dzięki temu po kliknięciu „Włącz" alert zostaje z potwierdzeniem, a chowa się dopiero
  // przy wejściu w kolejną ofertę z okolicy, którą ktoś już zapisał.
  useEffect(() => {
    if (!id || preview) {
      setShowAlert(false);
      return;
    }

    try {
      // Ile różnych ofert obejrzanych w tej sesji (klucze TD_DETAIL_VIEWED_*, bieżącą doliczamy).
      const PREFIX = 'TD_DETAIL_VIEWED_';
      const viewed = new Set<string>();
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(PREFIX)) viewed.add(k.slice(PREFIX.length));
      }
      viewed.add(id);
      const enough = viewed.size >= 2;

      // Czy dla tej okolicy ktoś już włączył powiadomienie (localStorage, między sesjami).
      let subscribed = false;
      if (alertLocationKey) {
        const raw = localStorage.getItem('TD_ALERT_SUBSCRIBED');
        const arr = raw ? JSON.parse(raw) : [];
        subscribed = Array.isArray(arr) && arr.includes(alertLocationKey);
      }

      setShowAlert(enough && !!alertLocationKey && !subscribed);
    } catch {
      setShowAlert(false);
    }
  }, [id, preview, alertLocationKey]);

  useEffect(() => {
  if (!d?.id) return;
  if (preview) return;

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
}, [d?.id, preview]);

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

  const loc = plainText(d?.locationLabel) || null;
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

  // Miejscowość oferty (pierwszy człon etykiety) do pre-fillu wyszukiwarki.
  const town = useMemo(() => (d?.locationLabel ?? '').split(',')[0]?.trim() || null, [d]);

  // „Więcej działek w okolicy" — wyszukiwarka z JUŻ wpisaną miejscowością i wyśrodkowana
  // na tej okolicy (współrzędne oferty). To pre-fill: z oferty user wpada w listę ofert
  // z tego miasta bez wpisywania czegokolwiek. Bez współrzędnych /kup sam zgeokoduje tekst.
  const kupTownHref = useMemo(() => {
    if (!town) return null;
    const sp = new URLSearchParams({ loc: town });
    if (typeof d?.lat === 'number' && typeof d?.lng === 'number') {
      sp.set('lat', String(d.lat));
      sp.set('lng', String(d.lng));
      sp.set('radius', '10');
    }
    return `/kup?${sp.toString()}`;
  }, [town, d]);

  const prad = labelPrad(d?.prad ?? null);
  const woda = labelWoda(d?.woda ?? null);
  const kan = labelKanalizacja(d?.kanalizacja ?? null);
  const gaz = labelGazShort(d?.gaz ?? null);
  const sw = labelSwiatlowod(d?.swiatlowod ?? null);
  const hasUzbrojenie = Boolean(prad || woda || kan || gaz || sw);

  const opis = formatOpis(d?.opis);
  // Tytuł to czysty tekst — dekodujemy encje (ó, m²) i usuwamy ewentualne tagi z eksportu CRM.
  const tytul = plainText(d?.tytul);

  // Kryteria alertu wyciągnięte z oglądanej działki: okolica (miejscowość z etykiety
  // + współrzędne w promieniu 10 km) oraz przeznaczenie. Ten sam kształt, co alert
  // z wyszukiwarki, więc silnik dopasowania (geo) działa identycznie.
  const alertCriteria = useMemo<AlertCriteria | null>(() => {
    if (!d) return null;
    const town = (d.locationLabel ?? '').split(',')[0]?.trim() || null;
    const hasGeo = typeof d.lat === 'number' && typeof d.lng === 'number';
    if (!town && !hasGeo) return null;

    return {
      query: town,
      priceMin: null,
      priceMax: null,
      areaMin: null,
      areaMax: null,
      przeznaczenia: (Array.isArray(d.przeznaczenia)
        ? d.przeznaczenia
        : []) as AlertCriteria['przeznaczenia'],
      transakcja: [],
      lat: hasGeo ? (d.lat as number) : null,
      lng: hasGeo ? (d.lng as number) : null,
      radiusKm: hasGeo ? 10 : null,
    };
  }, [d]);

  const isEnded = (d?.status ?? '') === 'ZAKONCZONE';
  // Dla ofert zakończonych chowamy cały kontakt (telefon, SMS, formularz), żeby archiwalna
  // oferta nie wyglądała jak aktywna. telefon=null automatycznie wygasza pasek tel/SMS i CTA.
  const telefon = isEnded ? null : ((d?.telefon ?? '').trim() || null);
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
  const biuroOpiekun = plainText(d?.biuroOpiekun) || null;
  const biuroLogoUrl = (d?.biuroLogoUrl ?? '').trim() || null;
  const biuroLogoBg = Boolean(d?.biuroLogoBg);

  const hasDocs = Boolean(d?.mpzp || d?.wzWydane || d?.projektDomu);
  const showMap = Boolean(mapSrc);


  // Zdarzenie lead do GA4 (konwersja). Odpala się tylko, gdy gtag istnieje, a gtag
  // ładuje się wyłącznie po zgodzie na analytics — więc brak zgody = brak zdarzenia.
  const trackGaLead = (leadType: 'phone' | 'message' | 'form') => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    window.gtag('event', 'generate_lead', {
      lead_type: leadType,
      dzialka_id: id,
    });
  };

  const trackContact = (type: 'phone' | 'message') => {
    if (preview) return;
    if (!id) return;

    trackGaLead(type);

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

  // Odsłonięcie numeru: liczymy jako lead telefoniczny (raz), potem pokazujemy klikalny numer.
  const revealPhone = () => {
    if (phoneRevealed) return;
    setPhoneRevealed(true);
    trackContact('phone');
  };

  const toggleFavorite = async () => {
    if (preview) return;
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
    if (preview) return;
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

  const openMessage = () => {
    if (preview) return;
    setMsgErr(null);
    setMsgDone(false);
    // Gotowy wstęp z numerem oferty — ten sam, co przy SMS na mobile.
    setMsgBody((b) => b || smsText);
    setMsgOpen(true);
  };

  const submitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    if (!id || msgSending) return;

    const email = msgEmail.trim();
    const message = msgBody.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsgErr('Podaj prawidłowy adres e-mail.');
      return;
    }
    if (!message) {
      setMsgErr('Napisz treść wiadomości.');
      return;
    }

    try {
      setMsgSending(true);
      setMsgErr(null);

      const res = await fetch(`/api/dzialki/${id}/wiadomosc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: msgName.trim(),
          email,
          phone: msgPhone.trim(),
          message,
          website: msgWebsite,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setMsgErr(data?.message || 'Nie udało się wysłać wiadomości. Spróbuj ponownie.');
        return;
      }

      setMsgDone(true);
      trackGaLead('form');
    } catch {
      setMsgErr('Brak połączenia. Spróbuj ponownie.');
    } finally {
      setMsgSending(false);
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
    if (preview) {
      onPreviewBack?.();
      return;
    }

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
    if (!open && !msgOpen) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open, msgOpen]);

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

          {/* Napisz wiadomość + ulubione + udostępnij — same ikony, na wysokości „Wróć do listy", po prawej. */}
          <div className="flex items-center gap-1">
            {/* Napisz wiadomość: tylko desktop — na mobile kontakt obsługuje dolny pasek (Zadzwoń / Napisz SMS).
                Dla ofert zakończonych ukryte (oferta archiwalna nie zbiera leadów). */}
            {!preview && !isEnded ? (
              <button
                type="button"
                onClick={openMessage}
                aria-label="Napisz wiadomość"
                className="group hidden h-9 w-9 items-center justify-center text-brand-text transition hover:text-brand-bright md:flex"
              >
                <MailIcon className="h-[20px] w-[20px]" />
              </button>
            ) : null}

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

        {isEnded ? (
          <div className="mt-6 rounded-2xl border border-[#7aa333]/35 bg-[#7aa333]/10 px-4 py-3 text-sm leading-6 text-fg">
            <span className="font-semibold">Ta oferta jest nieaktywna.</span>{' '}
            Ogłoszenie zostało zakończone lub wycofane i nie jest już dostępne. Dane kontaktowe są ukryte.
          </div>
        ) : null}

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
                      alt={tytul}
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
                {tytul}
              </h1>

              {!preview && !isEnded && showAlert && alertCriteria ? (
                <div className="mt-5">
                  <AlertBar criteria={alertCriteria} onCreated={rememberAlertLocation} />
                </div>
              ) : null}

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
                        <OfficeLogo src={biuroLogoUrl} alt="Logo biura" variant="detail" eager bg={biuroLogoBg} />
                      ) : null}
                    </div>
                  </FieldBlock>
                  <Hr />
                </>
              ) : null}

              {/* Kontakt tylko na desktopie — na mobile obsługuje go przyklejony dolny
                  pasek (Zadzwoń / Napisz), więc nie dublujemy „Pokaż numer". */}
              {telefon ? (
                <div className="hidden md:block">
                  <FieldBlock label="Kontakt">
                    {phoneRevealed ? (
                      <a
                        href={`tel:${telefon.replace(/\s+/g, '')}`}
                        className="min-w-0 text-[16px] font-medium text-fg/95 underline decoration-white/20 underline-offset-8 transition break-all hover:decoration-white/40"
                      >
                        {telefon}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={revealPhone}
                        className="inline-flex items-center gap-2 rounded-2xl border border-brand/60 bg-brand/10 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-brand-text transition hover:bg-brand/15 active:scale-[0.98]"
                      >
                        Pokaż numer
                      </button>
                    )}
                  </FieldBlock>
                  <Hr />
                </div>
              ) : null}

              {numerOferty ? (
                <>
                  <FieldBlock label="Numer oferty">
                    <div className="text-fg/90 text-[14px] break-words">{numerOferty}</div>
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

                  {kupTownHref && town ? (
                    <Link
                      href={kupTownHref}
                      className="mt-3 inline-flex text-[12px] tracking-[0.18em] uppercase text-fg/70 hover:text-fg transition underline decoration-white/20 underline-offset-8"
                    >
                      Więcej działek: {town}
                    </Link>
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
                      alt={tytul}
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

      {msgOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
          onClick={() => setMsgOpen(false)}
        >
          <div
            className="relative w-full max-w-[480px] rounded-[28px] border border-fg/10 bg-surface px-6 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMsgOpen(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-fg/12 text-fg/60 transition hover:border-fg/30 hover:text-fg"
              aria-label="Zamknij"
            >
              <span className="relative top-[-1px] text-[18px] leading-none">×</span>
            </button>

            {msgDone ? (
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-brand/35 bg-brand/10 text-[26px] text-brand-text">
                  ✓
                </div>
                <div className="text-[22px] font-semibold tracking-tight text-fg">
                  Wiadomość wysłana
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-fg/64">
                  Twoje zapytanie trafiło do sprzedającego. Odpowie na podany kontakt.
                </p>
                <button
                  type="button"
                  onClick={() => setMsgOpen(false)}
                  className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-brand px-4 text-[12px] font-black uppercase tracking-[0.18em] text-ink transition hover:brightness-110"
                >
                  Gotowe
                </button>
              </div>
            ) : (
              <>
                <div className="pr-10 text-[20px] font-semibold tracking-tight text-fg">
                  Napisz wiadomość
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-fg/60">
                  Pytanie trafi prosto do sprzedającego
                  {numerOferty ? ` (oferta nr ${numerOferty})` : ''}.
                </p>

                <form onSubmit={submitMessage} className="mt-6 grid gap-5">
                  {/* honeypot: ukryte przed ludźmi, łapie boty */}
                  <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
                    <label>
                      Nie wypełniaj tego pola
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={msgWebsite}
                        onChange={(e) => setMsgWebsite(e.target.value)}
                      />
                    </label>
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-[12px] uppercase tracking-[0.16em] text-fg/68"
                      htmlFor="msg-name"
                    >
                      Imię
                    </label>
                    <input
                      id="msg-name"
                      type="text"
                      className="field-line w-full bg-transparent px-0 pb-2.5 text-[15px] text-fg outline-none placeholder:text-fg/25"
                      value={msgName}
                      onChange={(e) => setMsgName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        className="mb-2 block text-[12px] uppercase tracking-[0.16em] text-fg/68"
                        htmlFor="msg-email"
                      >
                        E-mail <span className="text-brand-bright">*</span>
                      </label>
                      <input
                        id="msg-email"
                        type="email"
                        required
                        className="field-line w-full bg-transparent px-0 pb-2.5 text-[15px] text-fg outline-none placeholder:text-fg/25"
                        value={msgEmail}
                        onChange={(e) => setMsgEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-[12px] uppercase tracking-[0.16em] text-fg/68"
                        htmlFor="msg-phone"
                      >
                        Telefon
                      </label>
                      <input
                        id="msg-phone"
                        type="tel"
                        className="field-line w-full bg-transparent px-0 pb-2.5 text-[15px] text-fg outline-none placeholder:text-fg/25"
                        value={msgPhone}
                        onChange={(e) => setMsgPhone(e.target.value)}
                        autoComplete="tel"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-[12px] uppercase tracking-[0.16em] text-fg/68"
                      htmlFor="msg-body"
                    >
                      Wiadomość <span className="text-brand-bright">*</span>
                    </label>
                    <textarea
                      id="msg-body"
                      rows={4}
                      className="field-line w-full resize-y bg-transparent px-0 pb-2.5 text-[15px] leading-relaxed text-fg outline-none placeholder:text-fg/25"
                      value={msgBody}
                      onChange={(e) => setMsgBody(e.target.value)}
                    />
                  </div>

                  {msgErr ? (
                    <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {msgErr}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={msgSending}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-6 text-[12px] font-black uppercase tracking-[0.18em] text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {msgSending ? 'Wysyłanie…' : 'Wyślij wiadomość'}
                  </button>

                  <p className="text-[11px] leading-relaxed text-fg/55">
                    Wysyłając wiadomość, zgadzasz się na kontakt w sprawie tej oferty.
                  </p>
                </form>
              </>
            )}
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
          color: inherit;
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