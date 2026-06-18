import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
