// P21: sekcja FAQ na stronach kategorii. Widoczne pytania (natywne <details>, zero JS)
// plus dane strukturalne FAQPage renderowane w SSR (surowy <script type="application/ld+json">,
// nie next/script afterInteractive), żeby Google dostał je wprost w HTML serwera.

import type { FaqItem } from '@/lib/seoCategoryContent';

export default function FaqSection({
  items,
  title = 'Najczęstsze pytania',
  green = false,
  wide = false,
}: {
  items: FaqItem[];
  title?: string;
  green?: boolean;
  // wide: dopasowanie szerokości do sekcji o padding px-6/px-10 (np. /sprawdz-dzialke),
  // żeby FAQ było równo z „Co sprawdzić dalej"; domyślnie węższy padding (strony kategorii).
  wide?: boolean;
}) {
  if (items.length === 0) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };

  return (
    <section className={`mx-auto mt-12 max-w-6xl ${wide ? 'px-6 md:px-10' : 'px-3 md:px-4'}`}>
      <h2 className={`text-xl font-semibold tracking-tight md:text-2xl ${green ? 'text-brand-text' : 'text-fg'}`}>
        {title}
      </h2>

      <div className="mt-6 border-t border-fg/10">
        {items.map((it, i) => (
          <details key={i} className="group border-b border-fg/10">
            <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-[15px] font-medium text-fg/90 transition hover:text-fg [&::-webkit-details-marker]:hidden">
              {it.question}
              <span
                aria-hidden
                className="shrink-0 text-fg/40 transition group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="pb-5 pr-8 text-sm leading-7 text-fg/70">{it.answer}</p>
          </details>
        ))}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
