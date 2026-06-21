import type { Metadata } from 'next';
import PodgladClient from './PodgladClient';

export const metadata: Metadata = {
  title: 'Podgląd ogłoszenia',
  // Trasa techniczna (tylko wewnątrz iframe w kreatorze) — poza indeksem Google.
  robots: { index: false, follow: false },
};

// Renderuje PRAWDZIWĄ stronę oferty w trybie podglądu, na podstawie danych
// przekazanych z formularza /sprzedaj przez localStorage (ten sam origin).
// Używane wyłącznie wewnątrz <iframe> w kreatorze — stąd realny widok desktop/mobile.
export default function PodgladPage() {
  return <PodgladClient />;
}
