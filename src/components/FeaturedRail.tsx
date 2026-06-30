'use client';

import HomeHorizontalSlider from './HomeHorizontalSlider';
import { OfferCard, useOfferFavorites, LoginPrompt, type OfferData } from './OfferCard';

/**
 * Rail „Wyróżnione oferty" na stronie głównej — używa tej samej karty co lista
 * /kup (OfferCard), więc wygląda i działa identycznie (karuzela, ulubione,
 * plakietka, śledzenie odsłon).
 */
export default function FeaturedRail({ items }: { items: OfferData[] }) {
  const { favoriteIds, toggleFavorite, loginPromptOpen, setLoginPromptOpen } =
    useOfferFavorites(items);

  return (
    <>
      <div className="[touch-action:pan-x_pan-y]">
        <HomeHorizontalSlider>
          {items.map((d) => (
            <div
              key={d.id}
              className="min-w-[86%] snap-start md:min-w-[380px] xl:min-w-[420px]"
            >
              <OfferCard
                d={d}
                // Wyróżnione są POD pełnoekranowym hero (min-h-100svh), więc ich
                // zdjęcia mają być lazy. Wcześniej 2 pierwsze ładowały się eager i
                // konkurowały o pasmo z obrazem hero => wyższe LCP na głównej (4,1 s)
                // niż na /kup (3,0 s, gdzie tej konkurencji nie ma).
                eagerImage={false}
                isFavorite={favoriteIds.has(d.id)}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          ))}
        </HomeHorizontalSlider>
      </div>

      <LoginPrompt open={loginPromptOpen} onClose={() => setLoginPromptOpen(false)} />
    </>
  );
}
