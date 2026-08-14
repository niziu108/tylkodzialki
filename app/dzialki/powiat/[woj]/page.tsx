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

export const revalidate = 3600;

export default async function LegacyPowiatRedirect({ params }: PageProps) {
  const { woj: legacyPowiatSlug } = await params;

  const matches = await findPowiatBySlug(legacyPowiatSlug);
  if (matches.length === 0) notFound();

  // findPowiatBySlug zwraca posortowane malejąco po podaży, więc [0] = największy rynek.
  const target = matches[0];
  permanentRedirect(`/dzialki/powiat/${target.wojSlug}/${target.slug}`);
}
