import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import GlobalNav from '@/components/GlobalNav';
import Providers from '@/components/Providers';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
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
      <head>
        <Script id="td-consent-bootstrap" strategy="beforeInteractive">
          {`
            (function () {
              var GA_ID = 'G-V9YZ7E7EBD';
              var PIXEL_ID = '1374422448037164';

              function getCookieValue(name) {
                var prefix = name + '=';
                var parts = document.cookie ? document.cookie.split('; ') : [];
                for (var i = 0; i < parts.length; i++) {
                  if (parts[i].indexOf(prefix) === 0) {
                    return decodeURIComponent(parts[i].slice(prefix.length));
                  }
                }
                return null;
              }

              function readConsent() {
                try {
                  var raw = getCookieValue('td_cookie_consent');
                  if (!raw) return null;
                  return JSON.parse(raw);
                } catch (e) {
                  return null;
                }
              }

              window.dataLayer = window.dataLayer || [];
              window.gtag = window.gtag || function () {
                window.dataLayer.push(arguments);
              };

              window.__tdGaLoaded = false;
              window.__tdPixelLoaded = false;

              function sendInitialPageView() {
                window.gtag('event', 'page_view', {
                  page_title: document.title,
                  page_location: window.location.href,
                  page_path: window.location.pathname + window.location.search,
                });
              }

              window.__loadGoogleAnalytics = function () {
                if (window.__tdGaLoaded) return;
                window.__tdGaLoaded = true;

                var gaScript = document.createElement('script');
                gaScript.async = true;
                gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
                gaScript.onload = function () {
                  window.gtag('js', new Date());
                  window.gtag('config', GA_ID, {
                    debug_mode: true,
                    send_page_view: false
                  });
                  sendInitialPageView();
                  console.log('[TD] GA loaded');
                };
                document.head.appendChild(gaScript);
              };

              window.__loadMetaPixel = function () {
                if (window.__tdPixelLoaded || window.fbq) return;
                window.__tdPixelLoaded = true;

                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;
                n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}
                (window, document,'script','https://connect.facebook.net/en_US/fbevents.js');

                fbq('init', PIXEL_ID);
                fbq('track', 'PageView');
                console.log('[TD] Meta Pixel loaded');
              };

              function applyConsent(consent) {
                if (!consent) return;

                if (consent.analytics === true) {
                  window.__loadGoogleAnalytics();
                }

                if (consent.marketing === true) {
                  window.__loadMetaPixel();
                }
              }

              var existingConsent = readConsent();
              applyConsent(existingConsent);

              window.addEventListener('cookie-consent-updated', function (e) {
                var consent = e && e.detail ? e.detail : readConsent();
                applyConsent(consent);
              });
            })();
          `}
        </Script>
      </head>

      <body className="font-sans bg-[#131313] text-white">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <GlobalNav />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>

          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}