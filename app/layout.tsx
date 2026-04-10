import './globals.css';
import type { Metadata } from 'next';
import GlobalNav from '@/components/GlobalNav';
import Providers from '@/components/Providers';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import ConsentScripts from '@/components/ConsentScripts';
import { Geist } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';

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

          {/* 🔥 GOOGLE ANALYTICS */}
          <GoogleAnalytics gaId="G-QSBPVGMT2W" />
        </Providers>
      </body>
    </html>
  );
}