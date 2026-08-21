'use client';

import { useRouter } from 'next/navigation';
import { OfferCard, useOfferFavorites, LoginPrompt, type OfferData } from '@/components/OfferCard';
import Pager from '@/components/Pager';

/* Lista ofert na wizytówce biura. Świadomie NIE jest to osobny wygląd: te same karty
 * (`OfferCard` w układzie poziomym) i ten sam pager, co na /kup, żeby na komputerze
 * wyglądało jak na komputerze, a na telefonie jak na telefonie — bez drugiego,
 * rozjeżdżającego się z czasem wariantu listy. */
export default function BiuroOfertyList({
  items,
  slug,
  page,
  totalPages,
}: {
  items: OfferData[];
  slug: string;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const { favoriteIds, toggleFavorite, loginPromptOpen, setLoginPromptOpen } =
    useOfferFavorites(items);

  const goTo = (p: number) => {
    const target = Math.max(1, Math.min(totalPages, p));
    router.push(target === 1 ? `/biuro/${slug}` : `/biuro/${slug}?strona=${target}`);
  };

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-fg/12 bg-surface-2/20 p-6 text-fg/70">
        To biuro nie ma teraz aktywnych ofert.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5">
        {items.map((d, index) => (
          <div key={d.id} className="min-w-0">
            <OfferCard
              d={d}
              eagerImage={index < 2}
              horizontal
              isFavorite={favoriteIds.has(d.id)}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        ))}
      </div>

      {totalPages > 1 ? (
        <Pager
          className="mt-10"
          page={page}
          totalPages={totalPages}
          onPrev={() => goTo(page - 1)}
          onNext={() => goTo(page + 1)}
          onGo={goTo}
        />
      ) : null}

      <LoginPrompt open={loginPromptOpen} onClose={() => setLoginPromptOpen(false)} />
    </>
  );
}
