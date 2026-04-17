import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import GlobalNav from '@/components/GlobalNav';
import Providers from '@/components/Providers';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import ConsentScripts from '@/components/ConsentScripts';
import GoogleAnalyticsConsent from '@/components/GoogleAnalyticsConsent';
import { Geist } from 'next/font/google';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const siteUrl = 'https://tylkodzialki.pl';
const siteName = 'TylkoDziałki';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TylkoDziałki.pl – działki na sprzedaż w całej Polsce',
    template: '%s | TylkoDziałki.pl',
  },
  description:
    'TylkoDziałki.pl to portal ogłoszeń poświęcony wyłącznie działkom. Szukaj działek na sprzedaż, przeglądaj oferty i dodawaj własne ogłoszenia w całej Polsce.',
  applicationName: siteName,
  keywords: [
    'działki',
    'działki na sprzedaż',
    'portal działek',
    'ogłoszenia działek',
    'kup działkę',
    'sprzedaj działkę',
    'działki budowlane',
    'działki rolne',
    'działki inwestycyjne',
    'TylkoDziałki',
  ],
  authors: [{ name: 'TylkoDziałki' }],
  creator: 'TylkoDziałki',
  publisher: 'TylkoDziałki',
  alternates: {
    canonical: '/',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName,
    title: 'TylkoDziałki.pl – działki na sprzedaż w całej Polsce',
    description:
      'Portal poświęcony wyłącznie działkom. Szukaj działek, przeglądaj oferty i dodawaj ogłoszenia w całej Polsce.',
    locale: 'pl_PL',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'TylkoDziałki.pl',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TylkoDziałki.pl – działki na sprzedaż w całej Polsce',
    description:
      'Portal poświęcony wyłącznie działkom. Szukaj działek i dodawaj ogłoszenia w całej Polsce.',
    images: ['/logo.png'],
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
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/android-chrome-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/android-chrome-512x512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={geist.variable}>
      <body className="font-sans bg-[#131313] text-white">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <GlobalNav />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>

          <ConsentScripts />

          <Script id="td-website-schema" type="application/ld+json" strategy="afterInteractive">
            {JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'TylkoDziałki.pl',
              url: 'https://tylkodzialki.pl',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://tylkodzialki.pl/kup',
                'query-input': 'required name=search_term_string',
              },
            })}
          </Script>

          <Script id="td-organization-schema" type="application/ld+json" strategy="afterInteractive">
            {JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'TylkoDziałki.pl',
              url: 'https://tylkodzialki.pl',
              logo: 'https://tylkodzialki.pl/logo.png',
            })}
          </Script>

          <Script id="td-meta-pixel" strategy="afterInteractive">
            {`
              (function() {
                function getCookie(name) {
                  var escaped = name.replace(/[-[\\]{}()*+?.,\\\\^$|#\\s]/g, '\\\\$&');
                  var match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
                  return match ? decodeURIComponent(match[1]) : null;
                }

                function readConsent() {
                  try {
                    var raw = getCookie('td_cookie_consent');
                    if (!raw) return null;
                    return JSON.parse(raw);
                  } catch (e) {
                    return null;
                  }
                }

                function initPixel() {
                  if (window.fbq) return;

                  !function(f,b,e,v,n,t,s)
                  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                  if(!f._fbq)f._fbq=n;
                  n.push=n;n.loaded=!0;n.version='2.0';
                  n.queue=[];t=b.createElement(e);t.async=!0;
                  t.src=v;s=b.getElementsByTagName(e)[0];
                  s.parentNode.insertBefore(t,s)}
                  (window, document,'script','https://connect.facebook.net/en_US/fbevents.js');

                  fbq('init', '1374422448037164');
                  fbq('track', 'PageView');
                  console.log('[TD] Meta Pixel loaded');
                }

                var consent = readConsent();
                if (consent && consent.marketing === true) {
                  initPixel();
                }

                window.addEventListener('cookie-consent-updated', function(e) {
                  var nextConsent = e && e.detail ? e.detail : readConsent();
                  if (nextConsent && nextConsent.marketing === true) {
                    initPixel();
                  }
                });
              })();
            `}
          </Script>

          <GoogleAnalyticsConsent />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}