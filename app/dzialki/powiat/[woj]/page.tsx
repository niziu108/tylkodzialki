import { notFound, permanentRedirect } from 'next/navigation';
import { findPowiatBySlug } from '@/lib/seoPowiaty';

// Warstwa zgodności wstecznej. Do P22b powiat miał URL bez województwa:
// `/dzialki/powiat/[powiat]` (np. /dzialki/powiat/brzeski). Ten segment nie był unikalny —
// „brzeski" istnieje w opolskim i małopolskim — więc strona scalała dwa rynki. Nowy URL to
// `/dzialki/powiat/[woj]/[powiat]`. Ta strona (jeden segment) mapuje TU wpadające stare adresy:
// param nazywa się `woj` (bo tak nazywa się folder trasy), ale VALUE to legacy slug powiatu.
//
//   • jeden pasujący powiat  -> 308 na nowy, pełny URL (zachowuje moc SEO zaindeksowanego adresu),
//   • kolizja (kilka)        -> 308 na wariant z największą podażą (stara strona i tak mieszała
//                               dane, nie ma jednego „poprawnego" celu; największy rynek = najlepszy
//                               typowany zamiar),
//   • brak                   -> 404.
type PageProps = {
  params: Promise<{ woj: string }>;
};

// 15 minut, nie godzina: od 2026-08-28 huby serwują pierwszą stronę ofert z SSR,
// więc to `revalidate` decyduje, jak stara jest lista i liczniki. Kwadrans to
// kompromis między świeżością podaży a liczbą regeneracji (regenerują się tylko
// strony, które ktoś odwiedza, i to w tle — odwiedzający nigdy nie czeka).
export const revalidate = 900;

// Bez generateStaticParams Next renderuje trasę dynamicznie przy każdym wejściu,
// więc powyższy revalidate nie działał (produkcja zwracała x-vercel-cache: MISS
// na każdym żądaniu, także dla Googlebota). Pusta tablica = zero prerenderu
// w buildzie, ale strona generuje się przy pierwszym wejściu i potem leci
// z cache przez czas z revalidate.
export function generateStaticParams() {
  return [];
}

export default async function LegacyPowiatRedirect({ params }: PageProps) {
  const { woj: legacyPowiatSlug } = await params;

  const matches = await findPowiatBySlug(legacyPowiatSlug);
  if (matches.length === 0) notFound();

  // findPowiatBySlug zwraca posortowane malejąco po podaży, więc [0] = największy rynek.
  const target = matches[0];
  permanentRedirect(`/dzialki/powiat/${target.wojSlug}/${target.slug}`);
}
