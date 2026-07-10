# ROADMAP CRM V2

> **Status na 2026-06-18:** Sprint 6 (IMO CRM, analiza) - **UKOŃCZONY**. Kluczowe ustalenie: IMO eksportuje w formacie domy.pl/Oferty.net/Melog, który już parsuje silnik `src/lib/crm/domypl-sync.ts`; provider `IMOX` jest w enumie, panelu admina i routingu (kieruje do silnika domypl). Integracja to domknięcie różnic, nie nowy silnik: klasyfikacja działki i transakcji z atrybutów `<dzial tab/typ>` (dziś po prefiksie ID GS/GW pod Galacticę), opcjonalnie `<oferta_usun>`, oraz FTP na VPS (IMO wgrywa push, worker czyta pull). Decyzje Daniela 2026-06-18: architektura przez parametryzację wspólnego silnika bez kopii (ścieżka Galactiki bez zmian), FTP na VPS z kontem per biuro, wariant płatny IMO (1500 PLN netto). Odpowiedzi IMO (2026-06-18) potwierdziły plan; obsługa `<oferta_usun>` jest wymagana, bo pełny eksport idzie tylko raz na 30 dni (codziennie różnicowe). **Sprint 7 (IMO CRM, implementacja silnika) - UKOŃCZONY:** R-A/R-B/R-C dopięte w `domypl-sync.ts` warunkowo dla `IMOX`, ścieżka Galactiki bit w bit; test offline 8/8 (`scripts/crm-imo-selftest.ts`). Zakres świadomie zawężony do silnika (decyzja Daniela 2026-06-18): onboarding i FTP idą procesem ręcznym jak dla pozostałych CRM, bez zmian w kodzie. Czeka na deploy i potwierdzenie na realnym feedzie IMO. **Następny: Sprint 8 - IMO CRM (testy).** Sprint 3 (Monitoring) ukończony i na produkcji; Sprint 4 (Alerty) i Sprint 5 (Ujednolicenie) świadomie odłożone, nie porzucone.
> Poprzednio: Sprint 2 (Auto-sync, strategia C) ukończony i na produkcji - cron na VPS (06:00 i 18:00 UTC) kolejkuje import wszystkich aktywnych integracji przez kolejkę + worker.
> Raport z audytu: [docs/CRM_AUDIT_SPRINT1.md](docs/CRM_AUDIT_SPRINT1.md) · Instrukcja auto-sync: [docs/CRM_AUTOSYNC.md](docs/CRM_AUTOSYNC.md)

## Jak prowadzimy sprinty

Każdy sprint robimy w **nowym czacie**, żeby kontekst był posegregowany.
Na start każdego czatu wklej regułkę z pliku [docs/CRM_SPRINT_PROMPT.md](docs/CRM_SPRINT_PROMPT.md)
i wpisz w niej numer aktualnego sprintu.

## Status sprintów

- [x] **Sprint 1 - Audyt obecnych integracji** (ukończony 2026-06-17, raport: [docs/CRM_AUDIT_SPRINT1.md](docs/CRM_AUDIT_SPRINT1.md))
- [x] **Sprint 2 - Automatyczna synchronizacja CRM** (ukończony 2026-06-17, strategia C; cron na VPS 2x dziennie kolejkuje aktywne integracje przez kolejkę + worker)
- [x] **Sprint 3 - Monitoring synchronizacji** (ukończony 2026-06-18, na produkcji; read-only strona `/admin/crm`)
- [ ] **Sprint 4 - Alerty awarii CRM** (odłożony 2026-06-18)
- [ ] Sprint 5 - Ujednolicenie architektury CRM (przeanalizowany 2026-06-18, wykonanie odłożone; Faza 1 do wpięcia w Sprint 7)
- [x] **Sprint 6 - IMO CRM (analiza)** (ukończony 2026-06-18; IMO = format domy.pl/Oferty.net, już parsowany przez silnik domypl; plan w sekcji Sprint 6)
- [x] **Sprint 7 - IMO CRM (implementacja)** (ukończony 2026-06-18, zakres zawężony do silnika; R-A/R-B/R-C w `domypl-sync.ts` tylko dla IMOX, test offline 8/8; czeka na deploy i realny feed)
- [ ] **Sprint 8 - IMO CRM (testy)** (NASTĘPNY: test na realnym koncie IMO + FTP, potwierdzenie na produkcji)
- [ ] Sprint 9 - Properly CRM (analiza)
- [ ] Sprint 10 - Properly CRM (implementacja)
- [ ] Sprint 11 - Properly CRM (testy)
- [ ] Sprint 12 - MediaRent (analiza)
- [ ] Sprint 13 - MediaRent (implementacja)
- [ ] Sprint 14 - MediaRent (testy)

---

## WAŻNE ZASADY PRACY

Pracujemy metodą sprintów. Jeden sprint = jedno zadanie.

Nie przechodź do kolejnego sprintu, dopóki obecny nie zostanie:
wdrożony, przetestowany, sprawdzony na produkcji, oznaczony jako ukończony.

Jeżeli podczas sprintu znajdziesz inne problemy:
nie naprawiaj ich od razu, dopisz je do sekcji "Znalezione problemy" w tym pliku,
opisz wpływ biznesowy, zaproponuj priorytet.

Nie wykonuj dodatkowych zmian bez mojej zgody.
Jeżeli nie masz 100% pewności co do zmiany, najpierw zapytaj.

Najważniejsze cele projektu CRM:
1. Nie utracić żadnej oferty.
2. Nie zepsuć działających integracji.
3. Wyeliminować ręczną synchronizację.
4. Dodawać kolejne CRM-y szybciej i bezpieczniej.
5. Zwiększać liczbę ofert w portalu.

Po każdym sprincie przygotuj krótkie podsumowanie:
co zostało wykonane, jakie było ryzyko, jak zostało przetestowane,
jaki jest efekt biznesowy, jaki sprint jest następny.

---

## CRM SPRINT 1 - Audyt obecnych integracji [UKOŃCZONY 2026-06-17]

Sprawdzić: Galactica, Asari, EstiCRM.
Zweryfikować: import nowych ofert, aktualizację ofert, zdjęcia, usuwanie ofert, logi błędów.
Nic nie zmieniać. Tylko raport.

**Wynik:** pełny raport w [docs/CRM_AUDIT_SPRINT1.md](docs/CRM_AUDIT_SPRINT1.md).

Najważniejsze ustalenia:
- Architektura pod automatyzację już istnieje: kolejka `CrmImportJob` + worker na VPS + routing na 3 silniki.
- Import jest idempotentny (unikat `CrmOfferLink(integrationId, externalId)`), więc powtórny import nie tworzy duplikatów.
- Masowa dezaktywacja ofert jest zabezpieczona warunkiem `fullImportMode && pełny eksport` (Galactica/EstiCRM) lub `fullImportMode && emptyOffers` (Asari). Niepełny/uszkodzony feed nie wyczyści ofert.
- Synchronizacja jest dziś w 100% ręczna. Brak crona, brak `vercel.json`.
- Zidentyfikowane ryzyka dla Sprintu 2: R1-R6 (patrz audyt).

---

## CRM SPRINT 2 - Automatyczna synchronizacja CRM [UKOŃCZONY 2026-06-17]

Najważniejszy sprint. Wcześniej synchronizacja była w 100% ręczna. Teraz działa automatycznie.

### Stan realizacji (UKOŃCZONY 2026-06-17, na produkcji)

**Co powstało:**
- Flaga `AppConfig.crmAutoSyncEnabled` (domyślnie `false`) - migracja `20260617130000_add_crm_autosync_flag` zastosowana na żywej bazie.
- Funkcja `enqueueAutoSyncJobs` (`src/lib/crm/enqueueAutoSyncJobs.ts`): kolejkuje PENDING `CrmImportJob` dla aktywnych integracji, z guardem R2 (pomija PENDING/RUNNING). Nie dotyka silników ani route'a admina.
- Skrypt CLI dla crona `scripts/crm-enqueue-autosync.ts` (`npm run crm:enqueue`), z opcjonalnym argumentem `integrationId` do testu na jednej integracji.
- Wersjonowany kill-switch `scripts/crm-autosync-flag.ts` (`npm run crm:autosync:on|off|status`).
- Instrukcja operacyjna: [docs/CRM_AUTOSYNC.md](docs/CRM_AUTOSYNC.md).

**Rollout produkcyjny (wykonany):**
- Faza 1: test na jednej integracji (EstiCRM, 9 ofert) - job `SUCCESS`, `upd 9 / new 0` (idempotencja), `deact 0`, `err 0`. Guard R2 potwierdzony (drugie odpalenie = `pominięto: 1`).
- Faza 2: pełny przebieg 50 integracji - same `SUCCESS` plus jeden spodziewany `ERROR` „brak pliku" (biuro bez wgranego feedu).
- Cron na VPS (root): `0 6,18 * * *` (06:00 i 18:00 UTC), kolejkuje przez `npm run crm:enqueue`, worker przetwarza.
- Rollback w każdej chwili bez deployu: `npm run crm:autosync:off`.

**Cel osiągnięty:** synchronizacja wszystkich aktywnych integracji uruchamia się sama, bez ręcznej obsługi Daniela.

**DECYZJA (wybrana strategia): C - hybryda.**
- Harmonogram bazowy (np. 2x dziennie) automatycznie kolejkuje import wszystkich aktywnych integracji.
- Ręczny "synchronizuj teraz" zostaje jak dziś.
- Wariant "synchronizuj przy każdej zmianie" (B) zostaje na później, po wdrożeniu monitoringu (Sprint 3) i alertów (Sprint 4), bo dopiero one dają bezpieczne "oczy" na automat.

**Kryteria ukończenia (Definition of Done):**
1. Harmonogram automatycznie kolejkuje auto-sync aktywnych integracji przez **istniejącą kolejkę `CrmImportJob` + worker**, NIE synchronicznie w żądaniu Vercel.
2. Zachowany guard duplikatów (R2): nie tworzymy drugiego joba dla integracji, która ma już `PENDING`/`RUNNING`.
3. Zachowany bezpiecznik dezaktywacji (R1): bez zmian w warunku `fullImportMode && pełny eksport`.
4. Joby rozłożone w czasie / sekwencyjnie (R3): brak równoległego uderzenia w serwer i FTP biur.
5. Idempotencja zachowana: powtórny auto-import nie tworzy duplikatów.
6. Wdrożenie odwracalne: łatwe wyłączenie auto-sync bez deployu (flaga, np. w `AppConfig` lub zmiennej env).
7. Najpierw test na jednej integracji, potem rollout na resztę.
8. Po wdrożeniu Daniel nie musi wykonywać ręcznej synchronizacji.

**Do rozważenia w planie (przestrzeń projektowa, nie decyzja):**
- Vercel Cron uderza w lekki route, który tylko kolejkuje joby; ciężką pracę robi worker na VPS.
- Albo cron na VPS, który kolejkuje, a ten sam worker przetwarza.

**Wymaganie nadrzędne:** nie wolno pogorszyć działania istniejących CRM.

---

## CRM SPRINT 3 - Monitoring synchronizacji [UKOŃCZONY 2026-06-18, na produkcji]

Dla każdego CRM pokazywać: ostatnia synchronizacja, liczba ofert, liczba nowych ofert,
liczba zaktualizowanych ofert, liczba błędów.
Cel: szybkie wykrywanie problemów.

### Stan realizacji

**Kluczowe ustalenie analizy:** wszystkie potrzebne dane już istnieją na `CrmIntegration`
(`lastSyncAt`, `lastSuccessAt`, `lastErrorAt`, `lastErrorMessage`, `lastImportedOffers`,
`lastCreatedCount`, `lastUpdatedCount`, `lastErrorCount`) i są zapisywane przez wszystkie trzy
silniki po każdym imporcie. Sprint 3 to więc **czysty odczyt**, bez zbierania nowych danych
i bez migracji bazy.

**Co powstało:**
- Nowa, read-only strona serwerowa `app/admin/crm/page.tsx` (route `/admin/crm`): zbiorczy
  monitoring wszystkich integracji w jednej tabeli. Kolumny: status zdrowia, biuro/integracja
  (link do `/admin/crm/{userId}`), system CRM, ostatnia synchronizacja (+ czas względny i data
  ostatniego sukcesu), liczba ofert (`lastImportedOffers`), nowe, zaktualizowane, błędy
  (+ `lastErrorMessage`). Sortowanie: problemy na górze.
- Pasek podsumowania: liczniki ogólne (Błędy / Nieświeże / OK / Wyłączone) oraz rozbicie
  per system CRM (Galactica / Asari / EstiCRM / ...).
- Status zdrowia liczony zgodnie z semantyką silników: **Błąd** (`lastErrorCount > 0` albo
  ostatni przebieg padł: `lastErrorAt` nowszy od `lastSuccessAt`), **Nieświeże** (brak udanego
  importu > 48 h; cron leci co 12 h), **OK**, **Wyłączona** (`isActive = false`).
- Link „Monitoring CRM" w nagłówku panelu admina (`app/admin/page.tsx`), zmiana addytywna.

**Bezpieczeństwo (zasada nadrzędna):** zero zmian w silnikach, workerze, kolejce `CrmImportJob`,
`run-crm-job.ts`, `enqueueAutoSyncJobs` i route'ach `sync-now`. Brak zapisów do bazy, brak
migracji, dostęp tylko dla admina (ten sam guard co reszta `/admin`). Ryzyko dla działających
integracji: praktycznie zerowe (czysta nakładka odczytująca).

**Jak zweryfikowane (lokalnie):** `tsc --noEmit` bez błędów, `eslint` czysty, test logiki statusu
(9/9 przypadków: pełna awaria, błędy cząstkowe, 0 ofert, nieświeże, nigdy nie synchronizowana,
świeże tuż przed progiem). Podgląd w przeglądarce wymaga sesji admina i żywej bazy, więc finalne
potwierdzenie na produkcji po deployu (build wykonuje Vercel).

**Potwierdzone na produkcji (2026-06-18):** Daniel zweryfikował działanie strony `/admin/crm`
na żywym portalu. Sprint zamknięty.

## CRM SPRINT 4 - Alerty awarii CRM

Powiadomienie gdy: synchronizacja zakończy się błędem, CRM nie odpowiada,
liczba ofert nagle spadnie, import nie wykona się o czasie.

## CRM SPRINT 5 - Ujednolicenie architektury CRM

> **Status 2026-06-18:** przeanalizowany, wykonanie odłożone (decyzja Daniela: nie ruszać działającego kodu produkcyjnego dla samego porządku). Potwierdzona duplikacja: bajt-identyczny typ `SyncSummary` i wiele identycznych czystych helperów w 3 silnikach (różni je najwyżej etykieta w logu). Plan fazowy: Faza 1 = wspólny moduł helperów + wspólny typ (zero zmian zachowania); Faza 2 = wspólne FTP + mapowanie enumów mediów; Faza 3 = wspólny szkielet importera (processOffer/deactivate, dotyka bezpiecznika R1, duże ryzyko). Rekomendacja: Fazę 1 wpiąć jako fundament w Sprint 7 (implementacja IMO), gdy czwarty silnik od razu zweryfikuje abstrakcję. P-B (zdjęcia) osobno, bo to zmiana zachowania.

Sprawdzić: wspólne mechanizmy, wspólne mapowanie, wspólny importer.
Cel: łatwiejsze dodawanie kolejnych CRM.

W zakresie tego sprintu: **optymalizacja zdjęć (P-B)** - wykrywanie zmian zamiast pełnego re-uploadu przy każdym imporcie, żeby koszt skalował się ze zmianami, nie z całym katalogiem. Szczegóły i kierunek w sekcji "Znalezione problemy / P-B". Warunek konieczny przed wariantem B ("sync przy każdej zmianie").

## CRM SPRINT 6 - IMO CRM (analiza) [UKOŃCZONY 2026-06-18]

Analiza dokumentacji. Bez kodowania.

### Najważniejsze ustalenie
IMO eksportuje w formacie **domy.pl / Oferty.net / Melog** (XML), czyli w tym samym formacie,
który już parsuje silnik `src/lib/crm/domypl-sync.ts`. Provider `IMOX` istnieje w enumie
(`schema.prisma`), w panelu admina (`AdminCrmIntegrationEditor.tsx`) i w routingu
(`run-crm-job.ts` kieruje wszystko poza ASARI/ESTI do silnika domypl). Kolejka `CrmImportJob`,
worker, auto-sync (Sprint 2) i monitoring (Sprint 3) obsłużą IMO bez zmian. Zgodność rdzenia
potwierdzona przez czytanie kodu: `<param nazwa typ>`, `<cena waluta>`, `<location><area level>`,
współrzędne `n_geo_x`/`n_geo_y`, zdjęcia luzem w ZIP + `zdjecie1..N`, paczka `oferty_*.zip`
zawierająca `oferty.xml`, wykrywanie pełnego eksportu po `<zawartosc_pliku>calosc</>`.
**To nie jest budowa silnika od zera, tylko domknięcie kilku różnic** (szacowo ~80% już gotowe).

### Model integracji (uzgodniony kierunek)
- **Transport (R-D):** IMO wgrywa paczki na FTP (push), a nasz silnik czyta z FTP (pull,
  `domypl-sync.ts` łączy się i pobiera). Trzeba serwera FTP na naszym VPS, osobne konto i katalog
  per biuro (wymóg IMO: "osobne konto FTP i osobny katalog"). **Decyzja Daniela 2026-06-18: FTP na VPS.**
- **Wariant integracji:** płatny zweryfikowany (1500 PLN netto), weryfikacja przez pomoc IMO
  formatem Oferty.net, logo + reklama portalu w IMO przez 30 dni + mailing. **Decyzja Daniela: wariant płatny.**

### Luki do zamknięcia w Sprincie 7
Silnik domypl jest **współdzielony z produkcyjną Galacticą** (oraz GENERIC/GALACTICA), więc każda
zmiana musi być **wstecznie zerowa** dla istniejących integracji. Trzy miejsca są zaszyte pod Galacticę
i nie pasują do IMO:
- **R-A (krytyczne): klasyfikacja "czy to działka".** Dziś po prefiksie ID `GS`/`GW` (konwencja
  Galactiki) lub obecności `typdzialki` (`domypl-sync.ts:867`). Parser strumieniowy **nie czyta
  atrybutu `<dzial tab="dzialki">`** (`:1042` łapie tylko `header` i `oferta`). Działka z IMO bez
  `typdzialki` i bez prefiksu GS/GW zostałaby odrzucona jako "nie działka" → utrata ofert (łamie cel #1).
- **R-B (ważne): sprzedaż vs wynajem.** Dekodowane z prefiksu `GW` lub słów w tytule (`:934`).
  IMO koduje to w atrybucie `<dzial typ="wynajem">`, dziś ignorowanym. Działki na wynajem z IMO
  trafiłyby jako SPRZEDAŻ.
- **R-C (WYMAGANE po odpowiedzi IMO): usuwanie różnicowe `<oferta_usun>`.** Nieobsługiwane dziś
  (parser nie łapie tagu). IMO wysyła pełny eksport tylko na starcie i potem raz na 30 dni, a na co
  dzień różnicowe, w których usunięcia idą przez `<oferta_usun>`. Dezaktywacja przy pełnym eksporcie
  (R1) posprząta więc tylko raz na miesiąc; bieżące znikanie ofert trzeba oprzeć na `<oferta_usun>`
  z różnicowych. Aktywne usuwanie ograniczyć do `provider = IMOX`, by nie zmienić zachowania Galactiki.

Bez zmian (bezpieczne, nie ruszać): idempotencja (unikat `CrmOfferLink(integrationId, externalId)`),
bezpiecznik dezaktywacji R1 (działa też dla IMO, bo `calosc` jest rozpoznawane), izolacja per
integracja, worker sekwencyjny.

### Rekomendacja architektury (zaakceptowana przez Daniela)
Nie kopiować silnika (~1700 linii duplikatu). **Sparametryzować klasyfikację per provider:** dla
`IMOX` czytać typ z atrybutów `<dzial tab/typ>` (działka + sprzedaż/wynajem), dla Galactiki zostawić
obecną ścieżkę (prefiks ID) **bit w bit**. R-C dodać jako osobny, opcjonalny krok. Spina się z Fazą 1
ze Sprintu 5 (wspólny moduł helperów), bo czwarty silnik od razu zweryfikuje abstrakcję.

### Do ustalenia z IMO przed opłatą 1500 zł
- Portal przyjmuje **wyłącznie działki** (`tab="dzialki"`); pozostałe kategorie mają być ignorowane
  bez błędu. Weryfikacja IMO testuje "dodanie oferty po jednej w każdej kategorii", więc trzeba to
  uzgodnić, żeby nie oblać testu za celowe ignorowanie mieszkań/domów/lokali.
- Eksport pełny czy różnicowy i z jaką częstotliwością (przesądza pilność R-C).
- Potwierdzenie, że dane FTP (host/login/katalog per biuro) podajemy my.

### Odpowiedzi IMO (2026-06-18, potwierdzone mailowo)
Daniel wysłał pytania, IMO odpowiedziało; komplet zamyka analizę realnymi danymi:
- Profil "tylko działki" zaakceptowany; weryfikacja obejmie wyłącznie kategorię działek.
- Oferty działek zawsze w `<dzial tab="dzialki">`, atrybut `typ` ("sprzedaz"/"wynajem") zawsze
  ustawiony. Klasyfikację (R-A) i transakcję (R-B) opieramy pewnie na `<dzial>`, bez heurystyk.
- `typdzialki` bywa pusty (pole nieobowiązkowe). Nie polegać na nim; przy pustym dać domyślne
  przeznaczenie (jak push API: `BUDOWLANA`).
- Tryb eksportu: pełny tylko pierwszy raz i potem raz na 30 dni; codziennie różnicowe z pełnym
  kompletem danych oferty. Usunięcia przez `<oferta_usun>` (stąd R-C wymagane). Brak cyklicznego
  pełnego eksportu do bieżącej dezaktywacji, ale pełny ma charakter usuwający (przysłane 8 z 10
  zostawia 8 = nasz bezpiecznik R1 przy `calosc`).
- `<id>` oferty stałe w czasie (idempotencja OK).
- FTP: zakładamy my, osobne konto i katalog per biuro; wyłącznie zwykły FTP, port 21 (zgodne z
  silnikiem, `secure: false`; serwer na VPS w trybie pasywnym).
- Paczka `oferty_*.zip` z `oferty.xml` + zdjęcia luzem, nazwy bez polskich znaków i unikalne
  (zgodne z naszym odczytem ZIP).
- Start weryfikacji: po opłacie proformy IMO startuje od razu, gdy dostanie konto w portalu (dla
  `pomoc@imo.pl`) i testowe konto FTP. Konfigurację eksportu po stronie biura zwykle robi pomoc IMO
  (biuro przekazuje dane FTP). Nasz import: 2x dziennie + na żądanie.
- Po stronie Daniela do startu: opłata 1500 PLN netto, konto testowe portalu dla `pomoc@imo.pl`,
  testowe konto FTP.

### Jak zweryfikowano
Sprint analityczny, bez kodu. Weryfikacja przez czytanie kodu produkcyjnego: silnik domypl (parser
strumieniowy, pobieranie FTP, rozpakowanie ZIP, zdjęcia, dezaktywacja), routing `run-crm-job.ts`,
model `CrmIntegration` i enumy w `schema.prisma`, panel `AdminCrmIntegrationEditor.tsx`, endpoint
`app/api/crm/push/route.ts`. Porównano ze specyfikacją domy.pl/Oferty.net dostarczoną przez IMO.

### Efekt biznesowy
IMO otwiera nowych klientów (biura pracujące na programie IMO mogą publikować na portalu),
plus reklama portalu w interfejsie IMO przez 30 dni i mailing po stronie IMO. Koszt wejścia mocno
obniżony, bo format pokrywa się z istniejącym silnikiem; główna praca to domknięcie R-A/R-B/R-C
i infrastruktura FTP, a nie nowy silnik.

### Następny sprint
Sprint 7: IMO CRM (implementacja). Zakres: parametryzacja klasyfikacji per provider (R-A, R-B),
opcjonalna obsługa `<oferta_usun>` (R-C), przygotowanie FTP na VPS (konta per biuro). Zasada
nadrzędna: wstecznie zerowe dla Galactiki/Asari/Esti.

## CRM SPRINT 7 - IMO CRM (implementacja)

> **Wejście (z analizy Sprintu 6, decyzje Daniela 2026-06-18):** (1) parametryzacja klasyfikacji
> w silniku domypl per provider, ścieżka Galactiki bez zmian; (2) FTP na VPS z kontem i katalogiem
> per biuro; wariant płatny IMO (1500 PLN netto). Zakres: R-A (klasyfikacja działki z `<dzial tab>`),
> R-B (sprzedaż/wynajem z `<dzial typ>`), R-C (`<oferta_usun>` WYMAGANE, bo pełny eksport idzie tylko
> raz na 30 dni; aktywne usuwanie tylko dla IMOX). Parser `streamParseDomyPlOffers` musi zacząć czytać
> `<dzial tab/typ>` i `<oferta_usun>` (dziś łapie tylko `header` i `oferta`). Rozważyć Fazę 1 ze
> Sprintu 5 (wspólny moduł helperów) jako fundament. Zasada nadrzędna: wstecznie zerowe dla
> Galactiki/Asari/Esti, najpierw test na jednej integracji.

### Stan realizacji (UKOŃCZONY 2026-06-18)

**Zakres zawężony przez Daniela do silnika.** Onboarding (rejestracja biura, zakładanie integracji
w panelu, przekazanie danych FTP mailem) działa dla IMO tak samo jak dla pozostałych CRM i jest
obsługiwany ręcznie - bez zmian w kodzie. FTP na VPS i konto w portalu IMO to kroki po stronie Daniela.
Sprint 7 dotyka **wyłącznie** `src/lib/crm/domypl-sync.ts`. Zero migracji bazy, zero zmian w panelu,
workerze, kolejce, auto-sync, monitoringu oraz w silnikach Asari/Esti.

**Kluczowe ustalenie (uściśla analizę Sprintu 6):** parser SAX już dziś zbiera cały fragment
`<oferta>...</oferta>` razem z elementem `<dzial>` (każdy tag wewnątrz oferty trafia do `offerXml`
przez `startTagToXml`, który serializuje atrybuty), a `parseOfferFragment` parsuje to z
`ignoreAttributes:false`. `<dzial tab/typ>` był więc dostępny, tylko nieczytany - R-A i R-B to
dodanie odczytu, bez zmian w SAX. Realna zmiana w SAX dotyczyła tylko R-C (`<oferta_usun>` ma inną
nazwę niż `<oferta>`, więc był pomijany).

**Co powstało (wszystko warunkowo dla `provider === "IMOX"`):**
- `provider` przeprowadzony do `streamParseDomyPlOffers` i `parseOfferFragment`.
- **R-A:** `isLandOffer` rozszerzone o `<dzial tab="dzialki">` (addytywnie; dla nie-IMOX warunek jest
  martwy, klasyfikacja bit w bit jak dziś). Puste `typdzialki` daje domyślnie `BUDOWLANA`
  (to zachowanie `mapPlotTypeToPrzeznaczenia(null)` już istniało).
- **R-B:** dla IMOX transakcja czytana wprost z `<dzial typ="sprzedaz|wynajem">`; pozostali bez zmian
  (prefiks `GW` + słowa w tytule).
- **R-C:** parser zbiera `<oferta_usun>` i zwraca `deletedExternalIds`; nowa funkcja
  `deactivateExternalIds` gasi te oferty miękko (`ZAKONCZONE`), wołana **tylko dla IMOX**. Bezpiecznik
  R1 (`deactivateMissingOffers`) i warunek pełnego eksportu nietknięte.
- Eksport testowy `__domyplInternalsForTest` (czyste funkcje parsujące, bez bazy/FTP).

**Jak zweryfikowano:** `tsc --noEmit` czysty; eslint bez nowych zgłoszeń (dwa istniejące to dług sprzed
sprintu - patrz P-G); test offline `scripts/crm-imo-selftest.ts` (`npx tsx`) - **8/8 PASS**. Test na
sztucznym pełnym eksporcie dowodzi izolacji: ta sama oferta IMO (`<dzial tab=dzialki>`, bez prefiksu)
jest przyjmowana dla IMOX, a odrzucana dla GALACTICA; oferta `GS-200` z `<dzial typ=wynajem>` dla
GALACTICA wychodzi jako SPRZEDAŻ (ignoruje `<dzial>`), a dla IMOX jako WYNAJEM.

**Ryzyko:** niskie. Jedyny współdzielony plik to silnik domypl (Galactica/GENERIC); wszystkie nowe
gałęzie są bramkowane `IMOX`, co potwierdza test. Produkcyjne potwierdzenie na realnym feedzie IMO
to Sprint 8.

**Następny:** Sprint 8 - test na realnym koncie IMO + FTP (pierwszy import jednej integracji IMOX,
weryfikacja na produkcji).

## CRM SPRINT 8 - IMO CRM (testy)

### Stan realizacji (w toku, 2026-06-19)

Testy na realnym koncie IMO + FTP (konto testowe `imo@tylkodzialki.pl`, provider `IMOX`).
Weryfikacja prowadzona na realnych paczkach przysyłanych przez pomoc IMO. Wszystkie elementy
silnika potwierdzone na produkcji (joby integracji `cmqklzvkg0002ie04efo04gnz`):

- **Dodawanie + lokalizacja + sprzedaż/wynajem:** paczka pełna `oferty_20260619101907.zip`
  (47 ofert, m.in. Toruń). Job 12:15 → **import 47/47** (3 nowe + 44 update), 26 sprzedaż / 21 wynajem,
  zero odrzuceń. Potwierdza R-A, R-B i naprawę lokalizacji (P-H) oraz strukturę kontenera `<dzial>` (P-I).
- **Usuwanie różnicowe (R-C):** paczka różnicowa `oferty_20260619165818.zip`
  (`zawartosc_pliku=roznica`, 47× `<oferta_usun>`, 0 nowych ofert). Job 15:05 → **deactivated 47**,
  stan ofert IMO `AKTYWNE=0 / ZAKONCZONE=47`. Soft delete, odwracalny (ponowne wysłanie ofert da REACTIVATE).

Narzędzia diagnostyczne (lokalnie i na VPS): `scripts/crm-imo-inspect.ts` (przepuszcza plik XML
przez parser, raport transakcji/odrzuceń) i `scripts/crm-imo-status.ts` (stan integracji IMO z bazy:
joby, deactivatedCount, rozkład statusów ofert).

**Pozostaje:** finalna akceptacja po stronie IMO (ich testy: zmiany danych w ofercie, operacje na
zdjęciach, marker na mapie, pełny eksport nadpisujący) i dodanie tylkodzialki.pl do szablonów eksportu
w IMO. Po stronie naszego silnika komplet R-A/R-B/R-C działa; te dalsze testy weryfikują odwzorowanie
po stronie portalu (UPDATE pól, zdjęcia, współrzędne — obsługiwane istniejącym `processOffer`).

## CRM SPRINT 9 - Properly CRM (analiza)

## CRM SPRINT 10 - Properly CRM (implementacja)

## CRM SPRINT 11 - Properly CRM (testy)

## CRM SPRINT 12 - MediaRent (analiza)

## CRM SPRINT 13 - MediaRent (implementacja)

## CRM SPRINT 14 - MediaRent (testy)

---

## Znalezione problemy (do zaplanowania)

Zgłoszone podczas Sprintu 1. Nie naprawiamy ich teraz, czekają na decyzję o priorytecie.

### P-A: Route usera `sync-now` nie obsługuje EstiCRM i działa synchronicznie
- **Gdzie:** `app/api/crm/integrations/[id]/sync-now/route.ts`.
- **Co:** route rozgałęzia tylko ASARI vs domypl, brak EstiCRM. Dodatkowo odpala sync synchronicznie w żądaniu Vercel.
- **Wpływ biznesowy:** biuro EstiCRM klikające "synchronizuj" z panelu usera trafia w zły silnik. Duży feed grozi timeoutem funkcji Vercel.
- **Priorytet:** średni. Auto-sync (Sprint 2) i tak ma iść wyłącznie przez kolejkę + worker, więc ten route jest pobocznym długiem do uprzątnięcia.

### P-B: Pełny re-upload zdjęć przy każdej aktualizacji oferty [DO SPRINTU 5]
- **Gdzie:** `processOffer` w silnikach (widoczne w `esticrm-sync.ts`: `removeExistingR2Photos` + ponowny upload wszystkich zdjęć na każdym UPDATE).
- **Co:** każda aktualizacja oferty kasuje i wgrywa od nowa wszystkie zdjęcia do R2, nawet jeśli oferta i zdjęcia się nie zmieniły. Koszt skaluje się z CAŁYM katalogiem biura, nie ze zmianami.
- **Realny ślad (Sprint 2, 2026-06-17):** w pełnym przebiegu 50 integracji jedno biuro ASARI z dużą liczbą zdjęć mieliło ~18+ minut na samym pobieraniu/wgrywaniu zdjęć i, przez sekwencyjny worker, blokowało resztę kolejki.
- **Wpływ biznesowy:** koszt R2 i czas importu rosną z częstotliwością synchronizacji; pojedyncze ciężkie biuro spowalnia całą kolejkę.
- **Kierunek usprawnienia (do Sprintu 5):**
  1. Wykrywanie zmian: pomijać oferty niezmienione od ostatniego importu (zaczep już w schemacie: `CrmOfferLink.externalUpdatedAt`, `lastImportedAt`) - to ~80% korzyści, koszt skaluje się ze zmianami. Ostrożnie per provider, bo każdy CRM raportuje zmiany inaczej.
  2. Różnicowanie zdjęć: wgrywać tylko nowe, kasować tylko usunięte.
  3. Opcjonalnie równoległe pobieranie zdjęć w obrębie joba.
- **Priorytet:** średni. Najpierw dane z monitoringu (Sprint 3) pokażą, jak pilne. Konieczne **zanim** włączymy wariant "sync przy każdej zmianie" (B). Realizacja: w ramach Sprintu 5 (ujednolicenie architektury) albo jako osobny mini-sprint optymalizacji.

### P-C: Usuwanie integracji robi soft delete ofert [ZACOMMITOWANE a07bc5e]
- **Gdzie:** `src/lib/crm/deleteCrmIntegration.ts` + `app/api/admin/crm/integrations/[id]/route.ts`, `app/api/crm/integrations/[id]/route.ts`, `src/components/AdminCrmIntegrationEditor.tsx`.
- **Co:** usunięcie integracji robi soft delete (`ZAKONCZONE`) powiązanych ofert zamiast zostawiać je aktywne.
- **Status:** zacommitowane (`a07bc5e`), drzewo robocze czyste. Pozycja informacyjna, nie blokuje sprintów.

### P-D: `CrmFeedFormat.ESTICRM_XML` jest w schemacie, ale nie ma jej w bazie (dryf)
- **Gdzie:** `prisma/schema.prisma` (enum `CrmFeedFormat`, wartość `ESTICRM_XML` dodana w commicie `9f73338`) bez odpowiadającej migracji.
- **Co:** żywa baza Neon nie zawiera wartości `ESTICRM_XML` w enumie `CrmFeedFormat`. Wykryte przez `prisma migrate diff` podczas Sprintu 2.
- **Skutek:** routing EstiCRM działa dziś wyłącznie dzięki `provider === "ESTI_CRM"` (ta wartość JEST w bazie). Gałąź `feedFormat === "ESTICRM_XML"` w `run-crm-job.ts` w praktyce nigdy nie zadziała, a próba zapisania integracji z `feedFormat = ESTICRM_XML` zostanie odrzucona przez Postgres (nieprawidłowa wartość enuma).
- **Wpływ biznesowy:** dziś utajony, EstiCRM działa przez provider. Ryzyko ujawnia się, gdy ktoś zechce ustawić `feedFormat = ESTICRM_XML` (nowa konfiguracja / panel) - wtedy zapis padnie.
- **Priorytet:** średni. Naprawa to addytywna, bezpieczna migracja `ALTER TYPE "CrmFeedFormat" ADD VALUE 'ESTICRM_XML'`, ale świadomie poza zakresem Sprintu 2.

### P-E: Historyczny błąd `prisma.crmProcessedFile.upsert()` w workerze (Galactica)
- **Gdzie:** worker / silnik domypl-sync, zapis `CrmProcessedFile` (ślad przetworzonego pliku feedu).
- **Co:** w logach `CrmImportJob` widoczne błędy `Invalid prisma.crmProcessedFile.upsert() invocation` z 2 czerwca 2026 (kilka jobów Galactica).
- **Skutek/Status:** pełny przebieg 50 integracji w Sprincie 2 (17 czerwca) NIE odtworzył tego błędu, więc albo już naprawiony jednym z 63 commitów, albo zależny od konkretnego pliku/feedu. Do weryfikacji, nie blokuje.
- **Wpływ biznesowy:** potencjalnie pojedynczy import Galactica mógł się nie zapisać; dziś nieobserwowany.
- **Priorytet:** niski. Zweryfikować przy Sprincie 3 (monitoring) - tam i tak będziemy patrzeć na błędy importu.

### P-F: EstiCRM brał tylko najnowszy ZIP, przyrostowy zasłaniał pełny eksport [NAPRAWIONE fb851eb]
- **Gdzie:** `src/lib/crm/esticrm-sync.ts`, funkcja `downloadEstiFeedFromFtp` (wybór plików).
- **Co:** silnik przetwarzał tylko najnowszy plik ZIP. Gdy biuro wrzuciło pełny eksport, a potem nowszy przyrostowy (`export="incremental"`), pełny był ignorowany i import dawał 0.
- **Realny przypadek:** RGN Lublin (biuro@rgn.com.pl) - 50+ działek w pełnym eksporcie (459 MB), niewidocznych pod nowszym małym przyrostowym z 1 ofertą nie-działką. Import 0 mimo dobrej konfiguracji (`provider=ESTI_CRM`, `pattern=*.xml`).
- **Naprawa (commit `fb851eb`):** silnik idzie od najnowszego pliku, zbiera przyrostowe i zatrzymuje się na pierwszym pełnym eksporcie (czyli najnowszy pełny + nowsze przyrostowe). Dla biur z samymi pełnymi eksportami zachowanie identyczne (pętla kończy się na idx 0), tryb nieznany też kończy pętlę konserwatywnie.
- **Weryfikacja na produkcji (17.06):** RGN 0 → 51 działek; dsilodz dalej 9; pawlowskipolkowice dalej 12; wszystkie `SUCCESS`, 0 błędów. Wymagało restartu workera (`pm2 restart crm-worker`), który przy okazji zaktualizował workera do bieżącego kodu.
- **Status:** naprawione i wdrożone. Pozostały dług powiązany: P-A (route usera `sync-now` nadal bez EstiCRM, idzie przez kolejkę/worker).

### P-G: Istniejący dług eslint w `domypl-sync.ts` (sprzed Sprintu 7)
- **Gdzie:** `src/lib/crm/domypl-sync.ts` - linia ~249 (`Unexpected any`, error) oraz ~128 (`addDays` zdefiniowane, nieużywane, warning).
- **Co:** zgłoszenia eslint obecne na wersji `HEAD` sprzed Sprintu 7 (potwierdzone uruchomieniem eslint na zastashowanym pliku). Sprint 7 ich nie wprowadził i ich nie dotknął (zasada: nie naprawiać poza zakresem).
- **Wpływ biznesowy:** żaden bezpośredni - kod działa na produkcji, build przechodzi. `any` osłabia typowanie w jednym miejscu; `addDays` to martwy helper.
- **Priorytet:** niski. Drobne sprzątanie; `any` można dotknąć przy Fazie 1 ze Sprintu 5 (wspólny moduł helperów), `addDays` usunąć lub wykorzystać.

### P-H: Oferty z miast na prawach powiatu odrzucane „brak lokalizacji" [NAPRAWIONE, Sprint 8]
- **Gdzie:** `src/lib/crm/domypl-sync.ts`, funkcja `parseLocation`.
- **Co:** dla miast na prawach powiatu (Toruń, Kraków, Łódź, Wrocław...) nazwa miasta jest w polu powiatu (`area level=3`), a pole miasto/miejscowość (`level 5/4`) bywa puste. `parseLocation` nie miał fallbacku, więc `miasto = null`, a oferta odpadała na walidacji `parseOfferFragment` („brak lokalizacji"). Utrata ofert (łamie cel #1). Dotyczy wszystkich integracji na silniku domypl (też Galactica), ujawnione przy IMO.
- **Realny przypadek:** pierwsza paczka testowa IMO (47 ofert, oferty z Torunia — siedziby IMO). Weszły tylko 3, reszta głównie przez ten bug. IMO wstrzymało weryfikację (2026-06-19).
- **Naprawa:** fallback `miasto ← powiat`, gdy miasto puste (globalnie, addytywnie — oferty z wypełnionym miastem bez zmian; powiat nie dublowany w `locationFull`). Galactica tylko zyskuje (odzyska wcześniej gubione oferty z miast-powiatów). Test offline `scripts/crm-imo-selftest.ts` rozszerzony o przypadek toruński; `tsc` czysty; **10/10 PASS**.
- **Status:** NAPRAWIONE i zweryfikowane na produkcji (2026-06-19). Sama naprawa lokalizacji podniosła import z 3 do 44/47; pełne **47/47** dopiero po dodatkowej naprawie struktury `<dzial>` (patrz P-I) — okazało się, że pozostałe 3 to nie „nie-działki", tylko działki bez `typdzialki`, gubione przez błędny odczyt kategorii.
- **Lekcja operacyjna (ważne dla kolejnych biur IMO):** integracja IMO w panelu była początkowo na `provider = GALACTICA` (wartość domyślna przy tworzeniu), przez co cały silnik IMO (R-A/R-B/R-C bramkowane `IMOX`) był nieaktywny, a feed leciał starą ścieżką Galactiki (te pierwsze 3 oferty z `typdzialki`). **Każda integracja IMO MUSI mieć ręcznie ustawiony `provider = IMOX`.**

### P-I: IMO trzyma kategorię/typ w kontenerze `<dzial>` (rodzic oferty), nie w atrybucie oferty [NAPRAWIONE 2026-06-19]
- **Gdzie:** `src/lib/crm/domypl-sync.ts` — `parseOfferFragment` + `streamParseDomyPlOffers`.
- **Co:** analiza Sprintu 6/7 założyła, że `<oferta>` zawiera `<dzial tab/typ>` w środku. Realny eksport IMO grupuje oferty w **kontenerze** `<dzial tab="dzialki" typ="sprzedaz">...</dzial>` (rodzic ofert). Odczyt `ofertaNode.dzial` był więc zawsze pusty, przez co R-A (działki bez `typdzialki` tracone) i R-B (wynajem klasyfikowany jako sprzedaż) nie działały na realnych danych. Maskował to `typdzialki` (IMO zwykle go wypełnia) — stąd mylący wynik 44/47 i wynajem pokazywany jako sprzedaż.
- **Drugi, ukryty bug:** kontener był czytany w async `chain.then`, już po tym jak SAX (jeden chunk = przetwarzanie synchroniczne) zamknął `</dzial>` i wyzerował kontekst. Naprawione przez **zamrożenie `tab/typ` synchronicznie** w momencie zamknięcia oferty.
- **Naprawa:** parser śledzi bieżący kontener `<dzial>` i przekazuje `tab/typ` do `parseOfferFragment` (używane tylko dla `IMOX`, Galactica bit w bit ignoruje kontener). Test offline na prawdziwej strukturze **10/10**; realny plik IMO `oferty_20260619101907.zip` **47/47** (26 sprzedaż, 21 wynajem); produkcja **47/47**, zero odrzuceń. Narzędzie `scripts/crm-imo-inspect.ts` do diagnozy paczek.
- **Lekcja:** wcześniejszy test syntetyczny na BŁĘDNEJ strukturze (dzial w ofercie) dawał fałszywe 9/9; dopiero realny plik od IMO obnażył różnicę. Test warto opierać na realnym feedzie, a oferty testowe pozbawiać `typdzialki`, żeby nie maskowały logiki kategorii.

### P-J: Opis oferty — surowe tagi HTML i podatność XSS [NAPRAWIONE 2026-06-20]
- **Gdzie:** `app/dzialka/[id]/DzialkaClient.tsx` (`formatOpis`) → wydzielone do `src/lib/formatOpis.ts`.
- **Co:** opis renderowany przez `dangerouslySetInnerHTML` bez sanityzacji — (1) podatność XSS dla opisów z dowolnego źródła (CRM i ręczne ogłoszenia), (2) IMO przesyła formatowanie **podwójnie zakodowane** (`&amp;lt;u&amp;gt;`), przez co tagi wyświetlały się dosłownie jako tekst.
- **Decyzja Daniela:** wspierać proste formatowanie (pogrubienie/kursywa/podkreślenie), nie czysty tekst.
- **Naprawa:** `formatOpis` dekoduje encje (w tym podwójny escape), escapuje całość i przywraca WYŁĄCZNIE whitelist tagów bez atrybutów (`b/strong/i/em/u` + `br`/akapity). Wszystko inne (`script`, `img onerror`, `svg onload`, atrybuty zdarzeń) zostaje nieszkodliwym tekstem → XSS zamknięty. Test `scripts/format-opis-test.ts` **9/9** (formatowanie + XSS). Portal (Vercel), nie dotyczy workera.
- **Status:** NAPRAWIONE i wdrożone (Vercel). Dotyczy wszystkich ofert, nie tylko IMO. Dodatkowo poprawiony kolor pogrubienia (`.td-opis b/strong` dziedziczy kolor tekstu zamiast jasnego z ciemnego motywu) — czytelne na jasnym motywie; zweryfikowane w preview (kolor ciemny, font-weight 700).

### P-K: Mapowanie mediów — woda/gaz „powyżej 100m" [NAPRAWIONE 2026-06-20]
- **Gdzie:** `src/lib/crm/domypl-sync.ts` — `mapWodaFromParams`, `mapGazFromParams`.
- **Co:** (1) woda — `ma_wode=true` zwracało „na działce" przed sprawdzeniem `typpodlaczeniawody`, więc oferta z wodą „powyżej 100m" (daleko) pokazywała się błędnie jako „na działce"; (2) gaz — wartości odległości („powyżej/do 100m") nie pasowały do żadnego wzorca → „brak" → ukryte w portalu. Zgłoszone przez IMO.
- **Naprawa:** woda — `typpodlaczeniawody` ma priorytet nad `ma_wode`, odległości („100m", „powyżej", „poniżej") → „w drodze"; gaz — odległości → „w drodze". Zgodne z zasadą uczciwego filtra (nie zawyżać „na działce"). Globalnie (też Galactica, tylko na plus). Zweryfikowane na realnej paczce IMO `091057`: woda i gaz „powyżej 100m" → „w drodze".
- **Status:** NAPRAWIONE i na produkcji (worker zaktualizowany 2026-06-20).

### P-L: Oferta nieaktywna z linku bezpośredniego wyglądała jak aktywna [NAPRAWIONE 2026-06-22]
- **Gdzie:** `app/dzialka/[id]/page.tsx` + `app/dzialka/[id]/DzialkaClient.tsx`.
- **Co:** oferta `ZAKONCZONE` otwarta z bezpośredniego linku renderowała się jak aktywna — widoczne dane kontaktowe i formularz, JSON-LD `availability: InStock`, strona indeksowalna. Brak jakiejkolwiek informacji, że oferta jest archiwalna. Zgłoszone przez IMO (link do zdezaktywowanej oferty po teście usuwania). Dotyczy wszystkich ofert, nie tylko IMO.
- **Naprawa:** dla `status === ZAKONCZONE` — baner „Ta oferta jest nieaktywna", ukrycie kontaktu (telefon, SMS, CTA „Napisz wiadomość"; `telefon=null` wygasza pasek mobilny), oraz SEO: `robots noindex` + JSON-LD `availability: SoldOut`. Zweryfikowane w preview na realnej nieaktywnej ofercie (baner widoczny, brak `tel:` i przycisku kontaktu).
- **Status:** NAPRAWIONE i wdrożone (Vercel).

### P-M: Audyt formatowania opisów — spójność między providerami [NAPRAWIONE 2026-07-10]
- **Kontekst:** przegląd całego pipeline'u opisów (import → zapis → render `formatOpis`) pod kątem: „czy każde źródło zachowuje formatowanie, czy gdzieś je gubimy". Render jest wspólny i bezpieczny (`formatOpis`, patrz P-J) — problem leżał na etapie importu i w samym rendererze list.
- **A — EstiCRM spłaszczał opis (`src/lib/crm/esticrm-sync.ts`):** opis przechodził przez `stripHtml` PRZED zapisem — `<p>` zamieniane na spację (akapity sklejane w jedną linię), pogrubienia/kursywa kasowane. Jako jedyny provider gubił formatowanie (ASARI i domy.pl zapisują surowo). Redundantne, bo `formatOpis` i tak czyści HTML bezpiecznie na renderze. **Naprawa:** opis zapisywany surowo (jak ASARI/domy.pl), `stripHtml` usunięty.
- **B — Listy renderowane jako płaskie linijki (`src/lib/formatOpis.ts`):** `ul/ol/li` były w `BLOCK_TAGS` → zamieniane na łamania linii, przez co wypunktowanie/numeracja z CRM i z edytora traciły znaczniki, a CSS `.td-opis ul/ol/li` był martwy. Guziki „Punktuj/Numeruj" w edytorze produkowały listy bez kropek. **Naprawa:** `ul/ol/li` zachowywane jako prawdziwe znaczniki (gołe, bez atrybutów — XSS dalej zamknięty); krok akapitów rozdziela bloki listy od tekstu (lista nie jest zawijana w `<p>` ani łamana `<br />`).
- **C — Meta description SEO (`app/dzialka/[id]/page.tsx`):** `cleanText` nie dekodował encji (surowe `&amp;`/`&oacute;` w snippetach Google) i nie miał limitu długości. **Naprawa:** dekodowanie encji (w tym podwójny escape) + `truncateForMeta` (~160 znaków, cięcie na granicy słowa).
- **D — Encje HTML wyświetlane dosłownie (`src/lib/formatOpis.ts`):** ujawnione na produkcji po wdrożeniu A–C — oferta Galactica/ABN (`LER-GS-2003-4`) pokazywała `W SKR&Oacute;CIE`, `Malin&oacute;wka`, `3 750 m&sup2;`. `decodeEntities` znał tylko `amp/lt/gt/quot/apos/nbsp`, więc nazwane (`&oacute;`, `&Oacute;`, `&sup2;`) i liczbowe (`&#243;`, `&#x142;`) encje zostawały surowe. **Naprawa:** dekoder rozszerzony o mapę nazwanych encji (Latin-1 + typografia) i generyczne encje liczbowe (dec/hex, z zabezpieczeniem code pointów), w pętli rozplątującej podwójny escape; wydzielony jako `decodeHtmlEntities` i użyty też w meta-opisie (`cleanText` w `page.tsx`). Dotyczy WSZYSTKICH providerów, nie tylko Galactiki.
- **E — Tytuł/lokalizacja/opiekun z tymi samymi encjami (`app/dzialka/[id]/DzialkaClient.tsx`, `src/components/CardBody.tsx`):** H1 oferty i karty (`CardBody` — wspólny dla /kup, raili, mapy) renderowały surowy `tytul`/`loc`/`biuroOpiekun` z biura, więc mogły pokazać `&oacute;`/tagi tak jak opis (SEO `<title>`/OG są syntetyzowane przez nas — czyste, bez zmian). **Naprawa:** wspólny helper `plainText` (dekodowanie encji + strip tagów + sklejenie białych znaków) na tych polach; dodatkowo `formatOpis` dopuszcza `<sup>/<sub>` (prawdziwe m²/m³).
- **Weryfikacja:** `scripts/format-opis-test.ts` — **35/35 PASS** (listy + encje + sup + plainText, XSS bez regresji); `tsc --noEmit` czysty.
- **Uwaga operacyjna:** render-fixy (encje, listy, tytuły, meta, sup) działają na Vercel od razu, na CAŁEJ istniejącej bazie. Fix A (EstiCRM: koniec `stripHtml`) działa w ręcznym „Synchronizuj teraz" (Vercel), ale w NOCNYM auto-sync dopiero po aktualizacji **workera na VPS**; istniejące oferty EstiCRM odzyskają akapity dopiero przy kolejnym re-sync (opis nadpisywany surowym).
- **Status:** NAPRAWIONE i wdrożone (Vercel). Zasada na przyszłość: nowy provider = zapisywać opis SUROWO, formatowanie „samo wychodzi" na renderze; nie stripować HTML w parserze; tytuł/lokalizacja przez `plainText`.

---

## CEL KOŃCOWY

Każde biuro po konfiguracji CRM:
- publikuje automatycznie,
- aktualizuje automatycznie,
- usuwa automatycznie,
- nie wymaga ręcznej obsługi.

Portal sam dba o synchronizację.
