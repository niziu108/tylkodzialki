import type { Metadata } from 'next';
import DzialkaClient from './DzialkaClient';
import Breadcrumbs from '@/components/Breadcrumbs';
import SimilarOffers from '@/components/SimilarOffers';
import { getDzialkaById, getSimilarDzialki } from '@/lib/dzialki';
import { getSeoRegion } from '@/lib/seo-locations';
import { normalizeText } from '@/lib/dzialkiSearch';

// Oferta renderowana po stronie serwera (ISR): Google dostaje pełny HTML,
// użytkownik gotową treść, a baza jest odpytywana najwyżej raz na 60 s per oferta.
export const revalidate = 60;

const SITE_URL = 'https://tylkodzialki.pl';
const SITE_NAME = 'tylkodzialki.pl';

type PageProps = {
  params: Promise<{ id: string }>;
};

type Photo = {
  url: string;
  kolejnosc?: number | null;
};

type DzialkaSeo = {
  id: string;
  tytul?: string | null;
  opis?: string | null;
  cenaPln?: number | null;
  powierzchniaM2?: number | null;
  locationLabel?: string | null;
  przeznaczenia?: string[] | null;
  zdjecia?: Photo[] | null;
};

function cleanText(value?: string | null) {
  return (value ?? '')
    // Encje najpierw (w tym &amp; przed &lt;), potem strip tagów — inaczej odkodowane
    // <b> zostawałoby w meta jako literalny tag.
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Meta description: Google i tak ucina ~155-160 znaków — tniemy sami na granicy słowa,
// żeby snippet nie urywał się w połowie wyrazu.
function truncateForMeta(text: string, max = 160) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:–-]+$/, '')}…`;
}

function formatArea(value?: number | null) {
  if (!value) return null;
  return new Intl.NumberFormat('pl-PL', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPrice(value?: number | null) {
  if (!value) return null;
  return new Intl.NumberFormat('pl-PL', {
    maximumFractionDigits: 0,
  }).format(value);
}

function labelPrzeznaczenie(value?: string | null) {
  const map: Record<string, string> = {
    INWESTYCYJNA: 'inwestycyjna',
    BUDOWLANA: 'budowlana',
    ROLNA: 'rolna',
    LESNA: 'leśna',
    REKREACYJNA: 'rekreacyjna',
    SIEDLISKOWA: 'siedliskowa',
  };

  if (!value) return 'działka';
  return map[value] ?? value.toLowerCase();
}

function getSortedImages(dzialka: DzialkaSeo): string[] {
  return (dzialka.zdjecia ?? [])
    .slice()
    .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0))
    .map((p) => p.url)
    .filter(Boolean);
}

function getMainImage(dzialka: DzialkaSeo) {
  return getSortedImages(dzialka)[0] || `${SITE_URL}/logo.png`;
}

// Nazwa województwa z ostatniego tokenu `locationFull` (Google geocoding kończy się
// województwem). Do addressRegion w danych strukturalnych. null, gdy nie rozpoznano.
function regionNameFromLocationFull(locationFull?: string | null): string | null {
  if (!locationFull) return null;
  const parts = locationFull.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const slug = normalizeText(parts[parts.length - 1]).replace(/\s+/g, '-');
  return getSeoRegion(slug)?.name ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const dzialka = await getDzialkaById(id);

  const canonical = `/dzialka/${id}`;

  if (!dzialka) {
    return {
      title: 'Działka na sprzedaż',
      description:
        'Sprawdź aktualną ofertę działki na sprzedaż w serwisie tylkodzialki.pl.',
      alternates: {
        canonical,
      },
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const area = formatArea(dzialka.powierzchniaM2);
  const price = formatPrice(dzialka.cenaPln);
  const location = cleanText(dzialka.locationLabel) || 'Polska';

  const firstPurpose = Array.isArray(dzialka.przeznaczenia)
    ? dzialka.przeznaczenia[0]
    : null;

  const purpose = labelPrzeznaczenie(firstPurpose);

  const isRent = dzialka.transakcja === 'WYNAJEM';
  const txnWord = isRent ? 'na wynajem' : 'na sprzedaż';

  const baseTitle = area
    ? `Działka ${purpose} ${area} m² ${txnWord}, ${location}`
    : `Działka ${purpose} ${txnWord}, ${location}`;

  const descriptionParts = [
    area ? `Działka ${purpose} o powierzchni ${area} m²` : `Działka ${purpose}`,
    `lokalizacja: ${location}`,
    price ? (isRent ? `czynsz: ${price} zł/mc` : `cena: ${price} zł`) : null,
    'sprawdź zdjęcia, opis i kontakt do ogłoszeniodawcy na tylkodzialki.pl',
  ].filter(Boolean);

  const description = descriptionParts.join(', ').slice(0, 155);

  const image = getMainImage(dzialka);
  const fullUrl = `${SITE_URL}${canonical}`;
  const isEnded = dzialka.status === 'ZAKONCZONE';

  return {
    title: baseTitle,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'article',
      url: fullUrl,
      siteName: SITE_NAME,
      locale: 'pl_PL',
      title: `${baseTitle} | ${SITE_NAME}`,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: baseTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${baseTitle} | ${SITE_NAME}`,
      description,
      images: [image],
    },
    robots: {
      index: !isEnded,
      follow: true,
      googleBot: {
        index: !isEnded,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const dzialka = await getDzialkaById(id);

  // Podobne oferty (P8): rail na dole strony — leady + SEO (wewnętrzne linkowanie) + czas na stronie.
  const similar = dzialka ? await getSimilarDzialki(dzialka) : [];

  const canonical = `/dzialka/${id}`;
  const fullUrl = `${SITE_URL}${canonical}`;
  const isRent = dzialka?.transakcja === 'WYNAJEM';
  const isEnded = dzialka?.status === 'ZAKONCZONE';
  const title = dzialka?.tytul?.trim() || (isRent ? 'Działka na wynajem' : 'Działka na sprzedaż');

  const price =
    typeof dzialka?.cenaPln === 'number' && dzialka.cenaPln > 0
      ? dzialka.cenaPln
      : null;

  const seoDescription = dzialka
    ? truncateForMeta(
        cleanText(dzialka.opis) ||
          `Działka ${isRent ? 'na wynajem' : 'na sprzedaż'}, ${cleanText(dzialka.locationLabel) || 'Polska'}`,
      )
    : '';

  const offerJsonLd = price
    ? {
        '@type': 'Offer',
        url: fullUrl,
        priceCurrency: 'PLN',
        price,
        availability: isEnded ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      }
    : null;

  const productJsonLd = dzialka
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: title,
        description: seoDescription,
        image: getMainImage(dzialka),
        url: fullUrl,
        ...(offerJsonLd ? { offers: offerJsonLd } : {}),
      }
    : null;

  // P20: RealEstateListing + zagnieżdżony Place (geo/adres/powierzchnia). Bogatsze,
  // poprawne dane strukturalne pod real estate i cytowanie przez AI. Obok Product
  // (który daje rich result z ceną). Wszystko w SSR.
  const hasGeo =
    typeof dzialka?.lat === 'number' &&
    typeof dzialka?.lng === 'number' &&
    Number.isFinite(dzialka.lat) &&
    Number.isFinite(dzialka.lng);
  const addressLocality = dzialka ? cleanText(dzialka.locationLabel) : '';
  const addressRegion = dzialka ? regionNameFromLocationFull(dzialka.locationFull) : null;
  const images = dzialka ? getSortedImages(dzialka) : [];
  const datePosted = dzialka ? (dzialka.publishedAt ?? dzialka.createdAt) : null;

  const place =
    dzialka && (hasGeo || addressLocality || addressRegion)
      ? {
          '@type': 'Place',
          ...(addressLocality ? { name: addressLocality } : {}),
          ...(addressLocality || addressRegion
            ? {
                address: {
                  '@type': 'PostalAddress',
                  ...(addressLocality ? { addressLocality } : {}),
                  ...(addressRegion ? { addressRegion } : {}),
                  addressCountry: 'PL',
                },
              }
            : {}),
          ...(hasGeo
            ? {
                geo: {
                  '@type': 'GeoCoordinates',
                  latitude: dzialka.lat,
                  longitude: dzialka.lng,
                },
              }
            : {}),
        }
      : null;

  const realEstateJsonLd = dzialka
    ? {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        url: fullUrl,
        name: title,
        description: seoDescription,
        ...(datePosted ? { datePosted: new Date(datePosted).toISOString() } : {}),
        ...(images.length ? { image: images } : {}),
        ...(offerJsonLd ? { offers: offerJsonLd } : {}),
        ...(typeof dzialka.powierzchniaM2 === 'number' && dzialka.powierzchniaM2 > 0
          ? {
              additionalProperty: {
                '@type': 'PropertyValue',
                name: 'Powierzchnia działki',
                value: dzialka.powierzchniaM2,
                unitCode: 'MTK',
                unitText: 'm²',
              },
            }
          : {}),
        ...(place ? { spatialCoverage: place } : {}),
      }
    : null;

  return (
    <>
      {productJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(productJsonLd).replace(/</g, '\\u003c'),
          }}
        />
      ) : null}

      {realEstateJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(realEstateJsonLd).replace(/</g, '\\u003c'),
          }}
        />
      ) : null}

      {/* Breadcrumb tylko jako dane strukturalne (BreadcrumbList) — bez widocznej
          nawigacji. Oferta startuje wyżej, a nawigację w górę zapewnia przycisk
          „Wróć do listy" w DzialkaClient. */}
      <Breadcrumbs
        jsonLdOnly
        items={[
          { label: 'Strona główna', href: '/' },
          isRent
            ? { label: 'Działki na wynajem', href: '/kup?transakcja=WYNAJEM' }
            : { label: 'Działki na sprzedaż', href: '/kup' },
          { label: title },
        ]}
      />

      <DzialkaClient key={id} initial={dzialka} />

      <SimilarOffers items={similar} />
    </>
  );
}