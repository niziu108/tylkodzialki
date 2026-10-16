import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Formularze admina z plikiem (logo biura, wizytówka) idą przez server action, a ta domyślnie
  // przyjmuje 1 MB. Logo do 2 MB (limit w app/admin/actions.ts) padało bez czytelnego błędu.
  // 4 MB, bo Vercel i tak ucina żądania powyżej ok. 4,5 MB.
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  async redirects() {
    // Stary adres logowania po zmianie nazwy na /logowanie. Dziala tez dla juz
    // wyslanych maili z linkiem resetu (/auth/reset?token=...) — Next przenosi
    // query string na nowy adres. permanent:false (307), zeby bylo odwracalne.
    return [
      { source: "/auth", destination: "/logowanie", permanent: false },
      { source: "/auth/forgot", destination: "/logowanie/forgot", permanent: false },
      { source: "/auth/reset", destination: "/logowanie/reset", permanent: false },
    ];
  },
};

export default nextConfig;
