import type { Metadata } from 'next';
import KupSearch from './KupSearch';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Szukaj działki – oferty działek na sprzedaż',
  description:
    'Przeglądaj oferty działek na sprzedaż w całej Polsce. Filtruj po lokalizacji, cenie, powierzchni i przeznaczeniu.',
  alternates: {
    canonical: '/kup',
  },
};

export default function KupPage() {
  return (
    <main className="pt-10 pb-20">
      <KupSearch />
    </main>
  );
}