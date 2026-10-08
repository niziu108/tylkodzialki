/** /llms.txt: opis serwisu dla asystentów AI (ChatGPT, Perplexity, Claude), markdown jako text/plain.
 *
 * Liczby i listy miast liczone z bazy tą samą logiką co sitemapa i /ceny (getHubSitemapEntries,
 * getPolandPriceBoard), więc linki prowadzą tylko do stron z treścią i `index`.
 * Celowo bez nazw systemów CRM i biur partnerskich. */

import { prisma } from '@/lib/prisma';
import { plural } from '@/lib/plural';
import { SEO_REGIONS, SEO_TYPES, inCity } from '@/lib/seo-locations';
import { CITY_RADIUS_KM, MIN_OFERT_DO_CENY, MIN_SAMPLE, getHubSitemapEntries } from '@/lib/seoHub';
import { getPolandPriceBoard } from '@/lib/cenyPolska';
import { SITE_URL, indexableOfferWhere } from '@/lib/sitemapy';

export const revalidate = 3600;

const fmtInt = (n: number) => n.toLocaleString('pl-PL').replace(/\s/g, ' ');
const ofertGen = (n: number) => `${fmtInt(n)} ${plural(n, 'oferty', 'ofert', 'ofert')}`;
const ofert = (n: number) => `${fmtInt(n)} ${plural(n, 'oferta', 'oferty', 'ofert')}`;
// Starsze wpisy bloga mają półpauzy w tytułach i zajawkach, a w naszych tekstach ich nie używamy.
const noDash = (t: string) => t.replace(/\s+[–—]\s+/g, ': ');

function warsawStamp(d: Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export async function GET() {
  const now = new Date();

  const [activeCount, hubEntries, priceBoard, articles] = await Promise.all([
    prisma.dzialka.count({ where: indexableOfferWhere(now) }),
    getHubSitemapEntries(),
    getPolandPriceBoard(),
    prisma.article.findMany({
      where: { isPublished: true },
      select: { slug: true, title: true, excerpt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);

  const hubBySlug = new Map(hubEntries.map((e) => [e.citySlug, e]));
  // W tym pliku medianę miasta podajemy od tej samej próby co ranking na /ceny, mniejsze pule tylko linkujemy.
  const medianBySlug = new Map(
    priceBoard.cities
      .filter((c) => c.detail.pricePerM2 && c.detail.count >= MIN_OFERT_DO_CENY)
      .map((c) => [c.city.slug, { median: c.detail.pricePerM2!.median, count: c.detail.count }])
  );

  // Miasta z realną podażą budowlanych (próg jak na /ceny), od największej podaży.
  const cities = SEO_REGIONS.flatMap((r) => r.cities.map((c) => ({ city: c })))
    .map((x) => ({ ...x, entry: hubBySlug.get(x.city.slug) }))
    .filter((x) => (x.entry?.byType['budowlane'] ?? 0) >= MIN_SAMPLE)
    .sort((a, b) => (b.entry?.total ?? 0) - (a.entry?.total ?? 0));

  const u = (path: string) => `${SITE_URL}${path}`;
  const L: string[] = [];

  L.push('# tylkodzialki.pl', '');
  L.push(
    `> Ogłoszenia wyłącznie z działkami na sprzedaż w całej Polsce (budowlane, rolne, rekreacyjne, inwestycyjne, leśne, siedliskowe), z cenami okolicy pod ofertą i bezpłatnym raportem działki (granice, MPZP, zdjęcie z lotu ptaka). Raport jest pod ofertami, przy których znamy numer działki, a każdą inną działkę można sprawdzić narzędziem „Sprawdź działkę". Teraz ${fmtInt(activeCount)} ${plural(activeCount, 'aktywna oferta', 'aktywne oferty', 'aktywnych ofert')} od biur nieruchomości i prywatnych sprzedających. Treści są po polsku. Cytując dane, prosimy o link do konkretnej strony (huba miasta, strony cen albo oferty), a nie tylko do strony głównej.`,
    ''
  );
  L.push(`Stan danych: ${warsawStamp(now)} (czas polski). Plik odświeża się automatycznie co godzinę.`, '');

  L.push('## Co robi tylkodzialki.pl', '');
  L.push(
    `- [Wyszukiwarka działek](${u('/kup')}): mapa i lista ofert z filtrami: lokalizacja z promieniem, przeznaczenie, cena, powierzchnia, media na działce, MPZP i warunki zabudowy.`,
    `- [Działki według lokalizacji](${u('/dzialki')}): huby województw, powiatów i miast z liczbą ofert, a w miastach podział na przeznaczenie (np. działki budowlane w danym mieście i okolicach).`,
    `- [Ceny działek](${u('/ceny')}): mediana zł/m² i typowy zakres cen działek budowlanych dla miast. To ceny OFERTOWE z aktywnych ogłoszeń, nie ceny transakcyjne.`,
    `- [Sprawdź działkę](${u('/sprawdz-dzialke')}): bezpłatne narzędzie. Po adresie, obrębie i numerze działki albo wskazaniu na mapie pokazuje granice, powierzchnię i numer z rejestru GUGiK, przeznaczenie z miejscowego planu (MPZP), zdjęcie z lotu ptaka (ortofotomapa) i orientacyjną cenę okolicy.`,
    `- Raport pod ofertą: na stronach ofert, gdzie znamy numer działki, ten sam raport (ewidencja, MPZP, ortofotomapa) jest dołączony do ogłoszenia.`,
    `- Ceny w okolicy pod ofertą: porównanie ceny oferty z medianą podobnych ogłoszeń w pobliżu oraz najbliższe ceny transakcyjne z Rejestru Cen Nieruchomości (RCN, dane GUGiK) w promieniu do 10 km.`,
    `- [Wycena działki](${u('/wycena-dzialki')}): dla właściciela: ceny ofert w okolicy i kwoty z aktów notarialnych (Rejestr Cen Nieruchomości) dla wskazanej działki, bez konta.`,
    `- [Wystaw działkę](${u('/sprzedaj')}): bezpłatne dodanie ogłoszenia przez prywatnego sprzedającego. [Dla biur](${u('/dla-biur')}): import ofert biur nieruchomości.`,
    `- [Blog](${u('/blog')}): poradniki o zakupie działki, MPZP, warunkach zabudowy, mediach, kosztach i formalnościach.`,
    ''
  );

  L.push('## Adresy stron', '');
  L.push(
    `- Strona główna: ${u('/')}`,
    `- Wyszukiwarka: ${u('/kup')}`,
    `- Lokalizacje: ${u('/dzialki')}`,
    `- Ceny działek: ${u('/ceny')}`,
    `- Sprawdź działkę: ${u('/sprawdz-dzialke')}`,
    `- Blog: ${u('/blog')}`,
    `- Mapa strony (sitemap): ${u('/sitemap.xml')}`,
    ''
  );

  L.push('## Wzorce adresów', '');
  L.push(
    `- Miasto (wszystkie działki w promieniu ok. ${CITY_RADIUS_KM} km): ${u('/dzialki/{miasto}')}, np. ${u('/dzialki/olsztyn')}`,
    `- Miasto i przeznaczenie: ${u('/dzialki/{miasto}/{typ}')}, np. ${u('/dzialki/olsztyn/budowlane')}`,
    `- Typy: ${SEO_TYPES.map((t) => t.slug).join(', ')}`,
    `- Województwo: ${u('/dzialki/wojewodztwo/{wojewodztwo}')}, np. ${u('/dzialki/wojewodztwo/mazowieckie')}`,
    `- Powiat: ${u('/dzialki/powiat/{wojewodztwo}/{powiat}')}`,
    `- Ceny w mieście: ${u('/ceny/{miasto}')}, np. ${u('/ceny/olsztyn')}`,
    `- Oferta: ${u('/dzialka/{id}')}`,
    `- Artykuł: ${u('/blog/{slug}')}`,
    `- Slug miasta i województwa to nazwa bez polskich znaków, małymi literami, ze spacjami zamienionymi na myślnik (np. jelenia-gora, kujawsko-pomorskie). Strony miast istnieją m.in. dla listy poniżej, strony województw dla wszystkich ${SEO_REGIONS.length} województw.`,
    ''
  );

  L.push('## Metodologia cen', '');
  L.push(
    `- Mediana zł/m² liczona z aktywnych ofert działek budowlanych w promieniu ok. ${CITY_RADIUS_KM} km od miasta (dla dużych miast także w granicach miasta).`,
    `- Zakres to 10. i 90. percentyl, żeby pojedyncze nietypowe ogłoszenia nie zniekształcały wyniku. W tym pliku medianę miasta podajemy od ${MIN_OFERT_DO_CENY} ofert, przy mniejszej próbie tylko linkujemy stronę.`,
    '- To ceny ofertowe (ile chcą sprzedający), nie ceny transakcyjne. Ceny transakcyjne pokazujemy osobno, pod ofertami, z Rejestru Cen Nieruchomości (GUGiK).',
    '- Dane aktualizują się na bieżąco wraz z ofertami, a strony cen zapisują dodatkowo dzienny trend mediany.',
    ''
  );

  const nat = priceBoard.national;
  if (nat.pricePerM2) {
    L.push('## Ceny działek budowlanych w Polsce i województwach', '');
    L.push(
      `- Polska: mediana ofertowa ${fmtInt(nat.pricePerM2.median)} zł/m², typowo od ${fmtInt(nat.pricePerM2.low)} do ${fmtInt(nat.pricePerM2.high)} zł/m² (z ${ofertGen(nat.count)}): ${u('/ceny')}`
    );
    for (const { region, detail } of priceBoard.regions) {
      if (!detail.pricePerM2 || detail.count < MIN_OFERT_DO_CENY) continue;
      L.push(`- ${region.name}: mediana ${fmtInt(detail.pricePerM2.median)} zł/m² (z ${ofertGen(detail.count)})`);
    }
    L.push('');
  }

  L.push('## Pytania ogólne i strony, które na nie odpowiadają', '');
  L.push(
    `- Ile kosztują działki w Polsce, w podziale na miasta? ${u('/ceny')}`,
    `- Jak sprawdzić działkę przed zakupem (MPZP, granice, zdjęcie z lotu ptaka)? ${u('/sprawdz-dzialke')}`,
    `- Ile jest warta moja działka? ${u('/wycena-dzialki')}`,
    `- Jak sprzedać działkę bez pośrednika? ${u('/sprzedaj')}`,
    ''
  );

  if (articles.length > 0) {
    L.push('## Artykuły (blog)', '');
    for (const a of articles) {
      const ex = a.excerpt ? noDash(a.excerpt.replace(/\s+/g, ' ').trim()) : '';
      L.push(`- [${noDash(a.title)}](${u(`/blog/${a.slug}`)})${ex ? `: ${ex}` : ''}`);
    }
    L.push('');
  }

  L.push('## Działki i ceny w miastach', '');
  L.push(
    `Miasta z co najmniej ${MIN_SAMPLE} aktywnymi ofertami działek budowlanych, od największej podaży. Liczby ofert dotyczą promienia ok. ${CITY_RADIUS_KM} km od miasta. Pozostałe przeznaczenia są pod adresem ${u('/dzialki/{miasto}/{typ}')}.`,
    ''
  );
  for (const { city, entry } of cities) {
    const total = entry?.total ?? 0;
    const building = entry?.byType['budowlane'] ?? 0;
    const snap = medianBySlug.get(city.slug);
    const where = inCity(city);
    const others = SEO_TYPES.filter((t) => t.slug !== 'budowlane')
      .map((t) => ({ t, n: entry?.byType[t.slug] ?? 0 }))
      .filter((x) => x.n >= MIN_SAMPLE)
      .map((x) => `${x.t.slug} ${fmtInt(x.n)}`);

    L.push(`### ${city.name}`, '');
    L.push(
      `- Działki na sprzedaż ${where} i okolicach (${ofert(total)}): ${u(`/dzialki/${city.slug}`)}`,
      `- Działki budowlane ${where} i okolicach (${ofert(building)}): ${u(`/dzialki/${city.slug}/budowlane`)}`,
      snap
        ? `- Ile kosztuje działka budowlana ${where}? Mediana ofertowa ${fmtInt(snap.median)} zł/m², z ${fmtInt(snap.count)} ${plural(snap.count, 'oferty', 'ofert', 'ofert')}: ${u(`/ceny/${city.slug}`)}`
        : `- Ile kosztuje działka budowlana ${where}? ${u(`/ceny/${city.slug}`)}`
    );
    if (others.length > 0) L.push(`- Inne przeznaczenia (liczba ofert): ${others.join(', ')}`);
    L.push('');
  }

  L.push('## Kontakt', '');
  L.push('- kontakt@tylkodzialki.pl', '');

  return new Response(L.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
