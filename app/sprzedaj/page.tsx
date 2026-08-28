import type { Metadata } from "next";
import DzialkaForm from "@/components/DzialkaForm";

export const metadata: Metadata = {
  title: "Dodaj ogłoszenie działki za darmo",
  description:
    "Wystaw działkę na sprzedaż w kilka minut. Dodawanie ogłoszeń jest darmowe. Wypełnij formularz, a konto założysz dopiero przy publikacji.",
};

// Strona celowo PUBLICZNA — bez login-wall. Formularz wypełnia się bez konta,
// logowanie/rejestracja następuje dopiero przy „Opublikuj" (obsługa w DzialkaForm).
//
// Bez <Suspense>: wcześniej DzialkaForm wołał useSearchParams(), co przy prerenderze
// wywala poddrzewo w tryb CSR i do przeglądarki szedł sam fallback „Ładowanie…”.
// Efekt: statyczny HTML tej strony nie zawierał ani formularza, ani H1, ani zdania
// o tym, że wystawienie jest darmowe. DzialkaForm czyta teraz ?autopublish=1 z window
// w efekcie, więc bailoutu nie ma i cała treść jest w HTML od razu.
export default function SprzedajPage() {
  return <DzialkaForm mode="create" />;
}
