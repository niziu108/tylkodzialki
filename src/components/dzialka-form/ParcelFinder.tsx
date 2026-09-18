'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { createParcelOverlay } from '@/lib/parcelOverlay';
import type { DaneDzialki } from '@/lib/kreatorDzialki';
import type { ParcelCandidate } from '@/lib/uldk';
import { powiatLabelFromUldk } from '@/lib/uldkQuery';
import { plural } from '@/lib/plural';
import { SectionTitle, UnderlineField } from './ui';

// Wskazanie działki numerem z dokumentów albo kliknięciem na mapie z granicami (strona „Sprawdź
// wartość swojej działki"). Silnik ten sam co w „Sprawdź działkę" (ULDK, plan miejscowy, ceny w
// okolicy), więc po wyborze dostajemy komplet danych z jednego zapytania. Tekstu celowo mało:
// długie objaśnienia przy polach zniechęcają (feedback Daniela 2026-09-15).
//
// Nie zgadujemy, o którą działkę chodzi: ta sama para obręb i numer powtarza się w wielu powiatach,
// więc przy kilku trafieniach wybiera człowiek ([[feedback-filtry-twarde]]).

type Punkt = { lat: number; lng: number };

/** Pełne dane działki z POST /api/sprawdz-dzialke. Błąd wraca jako wyjątek z komunikatem dla ludzi. */
export async function pobierzDaneDzialki(body: { parcelId: string } | Punkt): Promise<DaneDzialki> {
  const res = await fetch('/api/sprawdz-dzialke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as (Partial<DaneDzialki> & { error?: string }) | null;
  if (!res.ok || !json || json.error || !json.parcel || !json.valuation) {
    throw new Error(json?.error || 'Nie udało się pobrać danych działki. Spróbuj ponownie za chwilę.');
  }
  return {
    parcel: json.parcel,
    valuation: json.valuation,
    mpzp: json.mpzp ?? null,
    mpzpNiedostepny: Boolean(json.mpzpNiedostepny),
    rcn: json.rcn ?? null,
  };
}

export default function ParcelFinder({
  onFound,
  onFallback,
  error,
  oznaczWymagane = true,
}: {
  onFound: (dane: DaneDzialki) => void;
  // „nie mam numeru i nie znajdę działki na mapie": zwykła lokalizacja bez danych z ewidencji.
  // Bez tej funkcji wyjścia awaryjnego nie pokazujemy.
  onFallback?: () => void;
  // podświetlenie po próbie przejścia dalej bez wskazanej działki
  error?: boolean;
  // gwiazdka przy nagłówku: tam, gdzie działka jest wymagana
  oznaczWymagane?: boolean;
}) {
  const [obreb, setObreb] = useState('');
  const [numer, setNumer] = useState('');
  const [kandydaci, setKandydaci] = useState<ParcelCandidate[] | null>(null);
  const [filtr, setFiltr] = useState('');
  const [ladowanie, setLadowanie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [mapaOtwarta, setMapaOtwarta] = useState(false);

  async function wczytaj(body: { parcelId: string } | Punkt): Promise<boolean> {
    setLadowanie(true);
    setBlad(null);
    try {
      const dane = await pobierzDaneDzialki(body);
      setKandydaci(null);
      onFound(dane);
      return true;
    } catch (e: unknown) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się pobrać danych działki.');
      return false;
    } finally {
      setLadowanie(false);
    }
  }

  async function szukaj() {
    if (ladowanie) return;
    const o = obreb.trim();
    const n = numer.trim();
    setBlad(null);

    if (!o) {
      setBlad('Wpisz obręb (nazwę albo numer), a obok numer działki.');
      return;
    }
    // Sam obręb ma sens tylko wtedy, gdy ktoś wkleił wszystko w jedno pole („Domiechowice 100")
    // albo gotowy identyfikator ewidencyjny.
    if (!n && !/[\s.]/.test(o)) {
      setBlad('Wpisz jeszcze numer działki, np. 123/4.');
      return;
    }

    setLadowanie(true);
    setKandydaci(null);
    setFiltr('');
    try {
      const res = await fetch(
        `/api/sprawdz-dzialke/szukaj?obreb=${encodeURIComponent(o)}&numer=${encodeURIComponent(n)}`
      );
      const json = (await res.json().catch(() => null)) as
        | { items?: ParcelCandidate[]; error?: string }
        | null;
      if (!res.ok || !json || json.error || !json.items) {
        throw new Error(json?.error || 'Nie udało się wyszukać działki.');
      }

      if (json.items.length === 0) {
        setBlad('Nie ma takiej działki w rejestrze. Sprawdź obręb i numer albo wskaż działkę na mapie.');
        return;
      }
      if (json.items.length === 1) {
        await wczytaj({ parcelId: json.items[0].id });
        return;
      }
      setKandydaci(json.items);
    } catch (e: unknown) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się wyszukać działki.');
    } finally {
      setLadowanie(false);
    }
  }

  // Enter w formularzu przeszedłby dalej (onSubmit), a tu ma szukać.
  function naEnter(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void szukaj();
  }

  // „Dąbrowa 12" to kilkadziesiąt działek w Polsce, więc przy długiej liście jest pole zawężania.
  const zawezenie = filtr.trim().toLocaleLowerCase('pl-PL');
  const widoczni = (kandydaci ?? []).filter((k) =>
    zawezenie
      ? `${k.commune} ${k.county} ${k.voivodeship} ${k.region}`.toLocaleLowerCase('pl-PL').includes(zawezenie)
      : true
  );

  return (
    <div className="space-y-6" data-field-error={error ? 'true' : undefined}>
      <div>
        <SectionTitle>
          Numer działki {oznaczWymagane ? <span className="text-brand-bright">*</span> : null}
        </SectionTitle>
        <p className="mt-2 text-[14px] leading-6 text-fg/65">Znajdziesz go w akcie notarialnym.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
        <UnderlineField
          label="Obręb"
          value={obreb}
          onChange={setObreb}
          onKeyDown={naEnter}
          placeholder="Nazwa albo numer, np. Domiechowice"
          error={error}
        />
        <UnderlineField
          label="Numer działki"
          value={numer}
          onChange={setNumer}
          onKeyDown={naEnter}
          placeholder="Np. 123/4"
          error={error}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void szukaj()}
          disabled={ladowanie}
          className="inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {ladowanie ? 'Szukam…' : 'Znajdź działkę'}
        </button>

        <button
          type="button"
          onClick={() => {
            setBlad(null);
            setMapaOtwarta(true);
          }}
          disabled={ladowanie}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand/40 bg-brand/[0.08] px-6 py-3 text-sm font-semibold text-brand-text transition hover:border-brand/60 hover:bg-brand/[0.12] disabled:opacity-60"
        >
          <PinGlyph />
          Wskaż na mapie
        </button>
      </div>

      {kandydaci && kandydaci.length > 1 && !ladowanie ? (
        <div className="rounded-2xl border border-fg/12 bg-fg/[0.03] p-4">
          <p className="text-[14px] leading-6 text-fg/75">
            <span className="font-semibold text-fg">
              {kandydaci.length} {plural(kandydaci.length, 'działka', 'działki', 'działek')} o tym numerze.
            </span>{' '}
            Wskaż swoją gminę:
          </p>

          {kandydaci.length > 8 ? (
            <input
              value={filtr}
              onChange={(e) => setFiltr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              placeholder="Zawęź: gmina, powiat albo województwo"
              aria-label="Zawęź listę działek"
              className="field-line mt-3 w-full bg-transparent pb-2 text-[16px] text-fg outline-none placeholder:text-fg/55"
            />
          ) : null}

          <ul className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {widoczni.map((k) => (
              <li key={k.id}>
                <button
                  type="button"
                  onClick={() => void wczytaj({ parcelId: k.id })}
                  className="w-full rounded-xl border border-fg/12 px-3 py-2.5 text-left transition hover:border-brand/60 hover:bg-brand/10"
                >
                  <span className="block text-[14px] font-semibold text-fg">{k.commune || k.county}</span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-fg/60">
                    {powiatLabelFromUldk(k.county)}, {k.voivodeship} · obręb {k.region} · działka{' '}
                    {k.parcelNumber}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {widoczni.length === 0 ? (
            <p className="mt-3 text-[13px] leading-6 text-fg/55">Żadna nie pasuje. Wpisz samą nazwę gminy.</p>
          ) : null}
        </div>
      ) : null}

      {ladowanie ? <p className="text-[14px] leading-6 text-fg/65">Sprawdzamy działkę…</p> : null}

      {blad && !mapaOtwarta ? (
        <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{blad}</p>
      ) : null}

      {error && !blad && !ladowanie ? (
        <p className="text-[12px] text-red-400/90">Wskaż swoją działkę, żeby przejść dalej.</p>
      ) : null}

      {onFallback ? (
        <p className="border-t border-fg/10 pt-5 text-[14px] leading-6 text-fg/65">
          Nie znasz numeru?{' '}
          <button
            type="button"
            onClick={onFallback}
            className="font-semibold text-fg underline decoration-fg/30 underline-offset-4 transition hover:decoration-fg"
          >
            Podaj samą miejscowość
          </button>
        </p>
      ) : null}

      {mapaOtwarta ? (
        <MapaDzialek
          ladowanie={ladowanie}
          blad={blad}
          onZamknij={() => {
            setMapaOtwarta(false);
            setBlad(null);
          }}
          onWybierz={async (p) => {
            if (await wczytaj(p)) setMapaOtwarta(false);
          }}
        />
      ) : null}
    </div>
  );
}

// Mapa na cały ekran z granicami działek (WMS GUGiK), jak w „Sprawdź działkę". Montowana dopiero
// po otwarciu: kto szuka po numerze, nie płaci za wczytanie mapy Google.
function MapaDzialek({
  ladowanie,
  blad,
  onZamknij,
  onWybierz,
}: {
  ladowanie: boolean;
  blad: string | null;
  onZamknij: () => void;
  onWybierz: (p: Punkt) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const szukajRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [punkt, setPunkt] = useState<Punkt | null>(null);
  const [satelita, setSatelita] = useState(false);
  const [bladMapy, setBladMapy] = useState<string | null>(null);

  useEffect(() => {
    let anulowane = false;

    loadGoogleMaps()
      .then(() => {
        if (anulowane || !mapDivRef.current || !window.google?.maps) return;

        const map = new google.maps.Map(mapDivRef.current, {
          center: { lat: 52.0, lng: 19.2 },
          zoom: 6,
          mapTypeId: 'roadmap',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });
        mapRef.current = map;
        map.overlayMapTypes.push(createParcelOverlay());

        const marker = new google.maps.Marker({ map, visible: false });
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.setPosition(p);
          marker.setVisible(true);
          setPunkt(p);
        });

        if (szukajRef.current) {
          const ac = new google.maps.places.Autocomplete(szukajRef.current, {
            componentRestrictions: { country: 'pl' },
            fields: ['geometry'],
          });
          ac.addListener('place_changed', () => {
            const loc = ac.getPlace().geometry?.location;
            if (!loc) return;
            map.setCenter(loc);
            map.setZoom(17);
          });
        }
      })
      .catch(() => {
        if (!anulowane) setBladMapy('Nie udało się wczytać mapy. Wyszukaj działkę po numerze.');
      });

    return () => {
      anulowane = true;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setMapTypeId(satelita ? 'hybrid' : 'roadmap');
  }, [satelita]);

  // Pod mapą na cały ekran strona nie może się przewijać, a Escape zamyka mapę.
  useEffect(() => {
    const html = document.documentElement;
    const poprzednie = html.style.overflow;
    html.style.overflow = 'hidden';
    const naKlawisz = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onZamknij();
    };
    window.addEventListener('keydown', naKlawisz);
    return () => {
      html.style.overflow = poprzednie;
      window.removeEventListener('keydown', naKlawisz);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const komunikat = bladMapy ?? blad;

  return (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Wskaż działkę na mapie">
      <div ref={mapDivRef} className="h-full w-full bg-[#e8eaed]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 max-w-md flex-1 flex-col items-start gap-2">
          <input
            ref={szukajRef}
            onKeyDown={(e) => {
              // Pole bywa w formularzu: Enter nie może go wysłać.
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholder="Wpisz miejscowość albo adres"
            aria-label="Szukaj miejsca na mapie"
            className="pointer-events-auto w-full rounded-xl bg-surface/95 px-4 py-3 text-[16px] text-fg shadow-lg outline-none backdrop-blur placeholder:text-fg/55"
          />
          <div className="pointer-events-auto rounded-xl bg-surface/95 px-4 py-2.5 text-[13px] leading-snug text-fg/80 shadow-lg backdrop-blur">
            Przybliż mapę i kliknij swoją działkę.
          </div>
          <div className="pointer-events-auto flex w-44 overflow-hidden rounded-xl bg-surface/95 text-[12px] font-medium uppercase tracking-[0.14em] shadow-lg backdrop-blur">
            {([false, true] as const).map((sat) => {
              const aktywny = satelita === sat;
              return (
                <button
                  key={String(sat)}
                  type="button"
                  onClick={() => setSatelita(sat)}
                  aria-pressed={aktywny}
                  className={`flex-1 py-2.5 text-center transition ${aktywny ? 'bg-brand text-ink' : 'text-fg/75 hover:text-fg'}`}
                >
                  {sat ? 'Satelita' : 'Mapa'}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onZamknij}
          className="pointer-events-auto inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-surface/95 px-4 text-[12px] font-medium uppercase tracking-[0.18em] text-fg/80 shadow-lg backdrop-blur transition hover:text-fg"
        >
          Zamknij ✕
        </button>
      </div>

      {komunikat ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
          <p className="pointer-events-auto max-w-md rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2.5 text-center text-sm text-red-100 shadow-lg backdrop-blur">
            {komunikat}
          </p>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex justify-center p-5">
        <button
          type="button"
          onClick={() => {
            if (punkt) onWybierz(punkt);
          }}
          disabled={!punkt || ladowanie}
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-8 text-[12px] font-medium uppercase tracking-[0.22em] text-ink shadow-[0_12px_40px_rgba(0,0,0,0.25)] transition hover:bg-brand-bright disabled:opacity-60"
        >
          {ladowanie ? 'Sprawdzam działkę…' : punkt ? 'To moja działka' : 'Kliknij swoją działkę'}
        </button>
      </div>
    </div>
  );
}

function PinGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
