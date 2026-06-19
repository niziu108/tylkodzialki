import type { Metadata } from "next";
import { Suspense } from "react";
import DzialkaForm from "@/components/DzialkaForm";

export const metadata: Metadata = {
  title: "Dodaj ogłoszenie działki za darmo — tylkodzialki.pl",
  description:
    "Wystaw działkę na sprzedaż w kilka minut. Dodawanie ogłoszeń jest darmowe — wypełnij formularz, a konto założysz dopiero przy publikacji.",
};

function SprzedajFallback() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-fg/72">Ładowanie…</div>
      </div>
    </main>
  );
}

// Strona celowo PUBLICZNA — bez login-wall. Formularz wypełnia się bez konta,
// logowanie/rejestracja następuje dopiero przy „Opublikuj" (obsługa w DzialkaForm).
// DzialkaForm używa useSearchParams() (?autopublish=1) → wymaga <Suspense>, żeby
// strona mogła być prerenderowana statycznie (CSR bailout przy next build).
export default function SprzedajPage() {
  return (
    <Suspense fallback={<SprzedajFallback />}>
      <DzialkaForm mode="create" />
    </Suspense>
  );
}
