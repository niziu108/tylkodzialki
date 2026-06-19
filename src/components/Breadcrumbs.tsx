import Link from 'next/link';
import Script from 'next/script';

const SITE_URL = 'https://tylkodzialki.pl';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export default function Breadcrumbs({
  items,
  // jsonLdOnly: emituj wyłącznie dane strukturalne BreadcrumbList, bez widocznej
  // nawigacji. Używane na stronie oferty (/dzialka/[id]), gdzie nawigację w górę
  // zapewnia przycisk „Wróć do listy", a breadcrumb ma sens tylko SEO-wo.
  jsonLdOnly = false,
}: {
  items: BreadcrumbItem[];
  jsonLdOnly?: boolean;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };

  return (
    <>
      {jsonLdOnly ? null : (
      <nav aria-label="Breadcrumb" className="text-[13px] text-fg/70">
        <ol className="flex flex-wrap items-center gap-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              {index > 0 ? <span className="text-fg/30">/</span> : null}

              {item.href ? (
                <Link href={item.href} className="transition hover:text-fg">
                  {item.label}
                </Link>
              ) : (
                <span className="text-fg/80">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      )}

      <Script id="td-breadcrumb-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(jsonLd)}
      </Script>
    </>
  );
}
