# ROADMAP CRM V2

> **Status na 2026-06-18:** Sprint 3 (Monitoring synchronizacji) - **zaimplementowany i zweryfikowany lokalnie** (typecheck, lint, testy logiki statusu). Nowa read-only strona `/admin/crm` pokazuje wszystkie integracje w jednym miejscu (status zdrowia, ostatnia synchronizacja, liczba ofert, nowe, zaktualizowane, błędy), problemy na górze. Czeka na deploy (push na main → Vercel) i potwierdzenie na produkcji. **Następny: Sprint 4 - Alerty awarii CRM.**
> Poprzednio: Sprint 2 (Auto-sync, strategia C) ukończony i na produkcji - cron na VPS (06:00 i 18:00 UTC) kolejkuje import wszystkich aktywnych integracji przez kolejkę + worker.
> Raport z audytu: [docs/CRM_AUDIT_SPRINT1.md](docs/CRM_AUDIT_SPRINT1.md) · Instrukcja auto-sync: [docs/CRM_AUTOSYNC.md](docs/CRM_AUTOSYNC.md)

## Jak prowadzimy sprinty

Każdy sprint robimy w **nowym czacie**, żeby kontekst był posegregowany.
Na start każdego czatu wklej regułkę z pliku [docs/CRM_SPRINT_PROMPT.md](docs/CRM_SPRINT_PROMPT.md)
i wpisz w niej numer aktualnego sprintu.

## Status sprintów

- [x] **Sprint 1 - Audyt obecnych integracji** (ukończony 2026-06-17, raport: [docs/CRM_AUDIT_SPRINT1.md](docs/CRM_AUDIT_SPRINT1.md))
- [x] **Sprint 2 - Automatyczna synchronizacja CRM** (ukończony 2026-06-17, strategia C; cron na VPS 2x dziennie kolejkuje aktywne integracje przez kolejkę + worker)
- [x] **Sprint 3 - Monitoring synchronizacji** (kod gotowy 2026-06-18, zweryfikowany lokalnie; do potwierdzenia na produkcji po deployu)
- [ ] **Sprint 4 - Alerty awarii CRM** (NASTĘPNY)
- [ ] Sprint 5 - Ujednolicenie architektury CRM
- [ ] Sprint 6 - IMO CRM (analiza)
- [ ] Sprint 7 - IMO CRM (implementacja)
- [ ] Sprint 8 - IMO CRM (testy)
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

## CRM SPRINT 3 - Monitoring synchronizacji [KOD GOTOWY 2026-06-18, do potwierdzenia na produkcji]

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

**Do potwierdzenia na produkcji po deployu:** wejść na `/admin/crm`, sprawdzić że widać wszystkie
integracje, że biuro bez pliku (znany błąd) jest oznaczone i na górze, oraz że liczby zgadzają się
z edytorem per user.

## CRM SPRINT 4 - Alerty awarii CRM

Powiadomienie gdy: synchronizacja zakończy się błędem, CRM nie odpowiada,
liczba ofert nagle spadnie, import nie wykona się o czasie.

## CRM SPRINT 5 - Ujednolicenie architektury CRM

Sprawdzić: wspólne mechanizmy, wspólne mapowanie, wspólny importer.
Cel: łatwiejsze dodawanie kolejnych CRM.

W zakresie tego sprintu: **optymalizacja zdjęć (P-B)** - wykrywanie zmian zamiast pełnego re-uploadu przy każdym imporcie, żeby koszt skalował się ze zmianami, nie z całym katalogiem. Szczegóły i kierunek w sekcji "Znalezione problemy / P-B". Warunek konieczny przed wariantem B ("sync przy każdej zmianie").

## CRM SPRINT 6 - IMO CRM (analiza)
Analiza dokumentacji. Bez kodowania.

## CRM SPRINT 7 - IMO CRM (implementacja)

## CRM SPRINT 8 - IMO CRM (testy)

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

---

## CEL KOŃCOWY

Każde biuro po konfiguracji CRM:
- publikuje automatycznie,
- aktualizuje automatycznie,
- usuwa automatycznie,
- nie wymaga ręcznej obsługi.

Portal sam dba o synchronizację.
