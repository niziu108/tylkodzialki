import Link from 'next/link';
import KupList from '../kup/KupList';
import type { FavoriteOffer } from '@/lib/favorites';

// Polska odmiana rzeczownika przy liczniku: 1 / 2-4 / 5+ (wyjątek 12-14).
function odmianaOfert(n: number) {
  const d = n % 10;
  const s = n % 100;
  if (n === 1) return 'zapisana oferta';
  if (d >= 2 && d <= 4 && !(s >= 12 && s <= 14)) return 'zapisane oferty';
  return 'zapisanych ofert';
}

/**
 * Widok zapisanych ofert. Ten sam ekran ma dwa wejścia: serce w nawigacji
 * (/ulubione, w trakcie przeglądania) i zakładkę w panelu klienta (tam, gdzie
 * jest całe konto). Wejścia dwa, komponent jeden — inaczej obie listy z czasem
 * rozjeżdżają się w dwa różne widoki tego samego.
 */
export default function UlubioneWidok({ items }: { items: FavoriteOffer[] }) {
  if (!items.length) {
    return (
      <div className="rounded-3xl border border-fg/12 bg-surface-2/30 p-8 text-fg/70">
        Nie masz jeszcze zapisanych ofert.
        <div className="mt-5">
          <Link
            href="/kup"
            className="inline-flex rounded-full border border-brand/60 px-5 py-3 text-[14px] font-semibold text-brand-text transition hover:bg-brand hover:text-ink"
          >
            Przeglądaj działki
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Zwykły nagłówek listy zamiast wielkiej zielonej liczby (88 px) z wersalikiem:
          to lista do przeglądania, nie statystyka (13.10). */}
      <h2 className="mb-5 text-[19px] font-semibold tracking-tight text-fg">
        {items.length} {odmianaOfert(items.length)}
      </h2>

      <KupList items={items} loading={false} error={null} />
    </>
  );
}
