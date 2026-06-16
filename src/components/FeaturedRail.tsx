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
          {items.map((d, i) => (
            <div
              key={d.id}
              className="min-w-[86%] snap-start md:min-w-[380px] xl:min-w-[420px]"
            >
              <OfferCard
                d={d}
                eagerImage={i < 2}
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
