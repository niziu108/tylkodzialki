import type { Metadata } from 'next';

// Strona logowania jest kliencka, więc tytuł i noindex idą przez layout. Wcześniej karta miała
// ogólny tytuł strony głównej, a logowanie nie powinno konkurować w Google z ofertami.
export const metadata: Metadata = {
  title: 'Zaloguj się lub załóż konto',
  robots: { index: false, follow: true },
};

export default function LogowanieLayout({ children }: { children: React.ReactNode }) {
  return children;
}
