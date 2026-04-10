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
        {/* Consent bootstrap + lazy GA load after consent */}
        <Script id="consent-and-ga-bootstrap" strategy="beforeInteractive">
          {`
            (function () {
              window.dataLayer = window.dataLayer || [];
              window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

              // Domyślnie brak zgody
              window.gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                wait_for_update: 500
              });

              window.__gaLoaded = false;

              window.__loadGoogleAnalytics = function () {
                if (window.__gaLoaded) return;
                window.__gaLoaded = true;

                var script = document.createElement('script');
                script.async = true;
                script.src = 'https://www.googletagmanager.com/gtag/js?id=G-V9YZ7E7EBD';
                document.head.appendChild(script);

                window.gtag('js', new Date());

                // Po zgodzie odblokowujemy analytics
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

              function hasAnalyticsConsent() {
                try {
                  // Preferujemy osobną zgodę analytics,
                  // ale zostawiamy fallback na marketing, jeśli banner dziś tak działa.
                  return (
                    localStorage.getItem('cookie-consent-analytics') === 'true' ||
                    localStorage.getItem('cookie-consent-marketing') === 'true'
                  );
                } catch (e) {
                  return false;
                }
              }

              // Jeśli zgoda była już wcześniej zapisana
              if (hasAnalyticsConsent()) {
                window.__loadGoogleAnalytics();
              }

              // Nasłuch aktualizacji z bannera
              window.addEventListener('cookieConsentAccepted', function (e) {
                var analyticsGranted =
                  !!(e && e.detail && (
                    e.detail.analytics === true || e.detail.marketing === true
                  ));

                if (analyticsGranted) {
                  window.__loadGoogleAnalytics();
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

          {/* META PIXEL */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
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
                  }

                  if (localStorage.getItem('cookie-consent-marketing') === 'true') {
                    initPixel();
                  }

                  window.addEventListener('cookieConsentAccepted', function(e) {
                    if (e.detail?.marketing) {
                      initPixel();
                    }
                  });
                })();
              `,
            }}
          />

          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}