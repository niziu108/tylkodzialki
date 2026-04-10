import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import GlobalNav from '@/components/GlobalNav';
import Providers from '@/components/Providers';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import ConsentScripts from '@/components/ConsentScripts';
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

              window.dataLayer = window.dataLayer || [];
              window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

              // Default consent state
              window.gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                wait_for_update: 500
              });

              window.__tdGaLoaded = false;
              window.__tdPixelLoaded = false;

              window.__loadGoogleAnalytics = function () {
                if (window.__tdGaLoaded) return;
                window.__tdGaLoaded = true;

                var gaScript = document.createElement('script');
                gaScript.async = true;
                gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-V9YZ7E7EBD';
                document.head.appendChild(gaScript);

                window.gtag('js', new Date());

                window.gtag('consent', 'update', {
                  analytics_storage: 'granted',
                  ad_storage: 'denied',
                  ad_user_data: 'denied',
                  ad_personalization: 'denied'
                });

                window.gtag('config', 'G-V9YZ7E7EBD', {
                  anonymize_ip: true
                });
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

                fbq('init', '1374422448037164');
                fbq('track', 'PageView');
              };

              function applyStoredConsent() {
                var consent = readConsent();
                if (!consent) return;

                if (consent.analytics === true) {
                  window.__loadGoogleAnalytics();
                }

                if (consent.marketing === true) {
                  window.__loadMetaPixel();
                }
              }

              applyStoredConsent();

              window.addEventListener('cookie-consent-updated', function (e) {
                var consent = e && e.detail ? e.detail : null;
                if (!consent) return;

                if (consent.analytics === true) {
                  window.__loadGoogleAnalytics();
                }

                if (consent.marketing === true) {
                  window.__loadMetaPixel();
                }
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

          <ConsentScripts />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}