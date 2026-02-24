import './globals.css';
import type { Metadata } from 'next';
import GlobalNav from '@/components/GlobalNav';
import { Geist } from 'next/font/google';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

export const metadata: Metadata = {
  title: 'TylkoDziałki',
  description: 'Kup i sprzedawaj działki bez pośredników.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={geist.variable}>
      <body className="font-sans bg-[#131313] text-white">
        <GlobalNav />
        {children}
      </body>
    </html>
  );
}