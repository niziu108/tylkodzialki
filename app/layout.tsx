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
        <Providers>
          <div className="flex min-h-screen flex-col">
            <GlobalNav />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>

          <ConsentScripts />

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