"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Przeznaczenie } from "@prisma/client";

type Photo = { url: string; publicId?: string; kolejnosc?: number };

export type Dzialka = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  locationLabel?: string | null;
  przeznaczenia?: Przeznaczenie[];
  zdjecia?: Photo[];
};

function formatPLN(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatIntPL(value: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(value);
}

function labelPrzeznaczenie(p: Przeznaczenie) {
  return String(p)
    .replace("USLUGOWA", "USŁUGOWA")
    .replace("LESNA", "LEŚNA")
    .replace("INWESTYCYJNA", "INWESTYCYJNA")
    .replace("ROLNA", "ROLNA")
    .replace("BUDOWLANA", "BUDOWLANA");
}

const ICONS = {
  area: "/powierzchnia.webp",
  price: "/cena.webp",
  type: "/przeznaczenie.webp",
  loc: "/lokalizacja.webp",
};

const GREEN = "#7aa333";

export default function PanelDzialkiList({ items }: { items: Dzialka[] }) {
  const content = useMemo(() => {
    if (!items?.length) {
      return (
        <div className="rounded-3xl border border-white/12 bg-[#0f0f0f]/20 p-6 text-white/70">
          Nie masz jeszcze żadnych ogłoszeń.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {items.map((d) => (
          <PanelDzialkaCard key={d.id} d={d} />
        ))}
      </div>
    );
  }, [items]);

  return content;
}

function PanelDzialkaCard({ d }: { d: Dzialka }) {
  const photos = (d.zdjecia ?? [])
    .slice()
    .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));

  const coverFallback = photos[0]?.url ?? null;
  const loc = d.locationLabel?.trim() || "Lokalizacja niepodana";
  const area = d.powierzchniaM2 ?? 0;
  const zlZaM2 = area ? Math.round(d.cenaPln / area) : 0;
  const przezn = d.przeznaczenia?.length ? d.przeznaczenia.map(labelPrzeznaczenie).join(", ") : "—";

  return (
    <div className="overflow-hidden rounded-3xl border border-white/14 bg-[#0f0f0f]/20 hover:border-white/30 transition">
      {/* Klik w kartę -> podgląd oferty */}
      <Link href={`/dzialka/${d.id}`} className="group block">
        <Carousel photos={photos} coverFallback={coverFallback} title={d.tytul} />
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <img src={ICONS.price} alt="" className="h-5 w-5 opacity-80" />
            <div className="text-[18px] font-semibold" style={{ color: GREEN }}>
              {formatPLN(d.cenaPln)}
              {zlZaM2 ? (
                <span className="ml-2 text-[12px] text-white/50 font-normal">
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

      {/* Akcje (bez kolorowych ramek w środku – czysto) */}
      <div className="px-6 pb-6 pt-0">
        <div className="border-t border-white/10 pt-4 flex flex-wrap gap-x-6 gap-y-3 text-[13px] font-semibold">
          <ActionBtn label="Edytuj ogłoszenie" onClick={() => alert("TODO: edycja")} />
          <ActionBtn label="Przedłuż ogłoszenie" onClick={() => alert("TODO: przedłuż")} />
          <ActionBtn label="Zakończ ogłoszenie" onClick={() => alert("TODO: zakończ")} />
          <ActionBtn label="Usuń ogłoszenie" danger onClick={() => alert("TODO: usuń")} />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`transition ${
        danger ? "text-red-300 hover:text-red-200" : "text-white/75 hover:text-white"
      }`}
      style={{
        textDecoration: "underline",
        textUnderlineOffset: "8px",
        textDecorationThickness: "1px",
        textDecorationColor: danger ? "rgba(248,113,113,0.55)" : "rgba(243,239,245,0.35)",
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
      <div className="text-white/90 text-[14px] leading-snug">{value}</div>
    </div>
  );
}

function Carousel({
  photos,
  coverFallback,
  title,
}: {
  photos: { url: string }[];
  coverFallback: string | null;
  title: string;
}) {
  const list = photos.length ? photos.map((p) => p.url) : coverFallback ? [coverFallback] : [];
  const has = list.length > 0;
  const [i, setI] = useState(0);

  const prev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (list.length < 2) return;
    setI((v) => (v - 1 + list.length) % list.length);
  };

  const next = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (list.length < 2) return;
    setI((v) => (v + 1) % list.length);
  };

  return (
    <div className="relative aspect-video bg-white/5">
      {has ? (
        <>
          <img src={list[i]} alt={title} className="h-full w-full object-cover" loading="lazy" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="text-center text-white text-[18px] font-medium leading-tight drop-shadow">
              {title}
            </div>
          </div>

          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 text-white backdrop-blur-sm
                           opacity-100 md:opacity-0 md:group-hover:opacity-100 transition"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 text-white backdrop-blur-sm
                           opacity-100 md:opacity-0 md:group-hover:opacity-100 transition"
              >
                ›
              </button>

              <div className="absolute right-4 top-4 flex gap-2">
                {list.slice(0, 6).map((_, idx) => (
                  <span key={idx} className={`h-2 w-2 rounded-full ${idx === i ? "bg-black" : "bg-black/40"}`} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-white/50">Brak zdjęć</div>
      )}
    </div>
  );
}