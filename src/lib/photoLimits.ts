// Maksymalna liczba zdjęć na ofertę dodawanych/edytowanych RĘCZNIE przez formularz.
// Jedno źródło prawdy dla walidacji backendu (API tworzenia i edycji oferty).
//
// Uwaga:
// - Import z CRM celowo NIE stosuje tego limitu: silniki sync wgrywają wszystkie zdjęcia
//   z zewnętrznego systemu (w bazie są już oferty z kilkudziesięcioma zdjęciami).
// - Galeria oferty, lista /kup i storage (R2) obsługują dowolną liczbę zdjęć, więc
//   podniesienie limitu nie wpływa na wydajność ani na istniejące oferty.
export const MAX_PHOTOS_PER_OFFER = 12;
