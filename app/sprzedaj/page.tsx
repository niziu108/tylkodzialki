import type { Metadata } from "next";
import DzialkaForm from "@/components/DzialkaForm";

export const metadata: Metadata = {
  title: "Dodaj ogłoszenie działki za darmo — TylkoDziałki.pl",
  description:
    "Wystaw działkę na sprzedaż w kilka minut. Dodawanie ogłoszeń jest darmowe — wypełnij formularz, a konto założysz dopiero przy publikacji.",
};

// Strona celowo PUBLICZNA — bez login-wall. Formularz wypełnia się bez konta,
// logowanie/rejestracja następuje dopiero przy „Opublikuj" (obsługa w DzialkaForm).
export default function SprzedajPage() {
  return <DzialkaForm mode="create" />;
}
