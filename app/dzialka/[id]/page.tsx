import type { Metadata } from 'next';
import DzialkaClient from './DzialkaClient';

const SITE_URL = 'https://tylkodzialki.pl';
const SITE_NAME = 'TylkoDziałki.pl';

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
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function getMainImage(dzialka: DzialkaSeo) {
  const photos = (dzialka.zdjecia ?? [])
    .slice()
    .sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0))
    .map((p) => p.url)
    .filter(Boolean);

  return photos[0] || `${SITE_URL}/logo.png`;
}

async function getDzialka(id: string): Promise<DzialkaSeo | null> {
  try {
    const res = await fetch(`${SITE_URL}/api/dzialki/${id}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;

    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const dzialka = await getDzialka(id);

  const canonical = `/dzialka/${id}`;

  if (!dzialka) {
    return {
      title: 'Działka na sprzedaż',
      description:
        'Sprawdź aktualną ofertę działki na sprzedaż w serwisie TylkoDziałki.pl.',
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

  const baseTitle = area
    ? `Działka ${purpose} ${area} m² na sprzedaż – ${location}`
    : `Działka ${purpose} na sprzedaż – ${location}`;

  const descriptionParts = [
    area ? `Działka ${purpose} o powierzchni ${area} m²` : `Działka ${purpose}`,
    `lokalizacja: ${location}`,
    price ? `cena: ${price} zł` : null,
    'sprawdź zdjęcia, opis i kontakt do ogłoszeniodawcy na TylkoDziałki.pl',
  ].filter(Boolean);

  const description = descriptionParts.join(', ').slice(0, 155);

  const image = getMainImage(dzialka);
  const fullUrl = `${SITE_URL}${canonical}`;

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
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

export default async function Page() {
  return <DzialkaClient />;
}