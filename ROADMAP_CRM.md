# ROADMAP CRM V2

> **Status na 2026-06-17:** Sprint 2 (Auto-sync, strategia C) - **implementacja gotowa i bezpiecznie wdrożona** (flaga `crmAutoSyncEnabled` domyślnie OFF, zero zmian zachowania na produkcji). Pozostaje **aktywacja produkcyjna** (flaga + cron na VPS, Faza 1/2). Po niej: Sprint 3.
> Raport z audytu: [docs/CRM_AUDIT_SPRINT1.md](docs/CRM_AUDIT_SPRINT1.md) · Instrukcja auto-sync: [docs/CRM_AUTOSYNC.md](docs/CRM_AUTOSYNC.md)

## Jak prowadzimy sprinty

Każdy sprint robimy w **nowym czacie**, żeby kontekst był posegregowany.
Na start każdego czatu wklej regułkę z pliku [docs/CRM_SPRINT_PROMPT.md](docs/CRM_SPRINT_PROMPT.md)
i wpisz w niej numer aktualnego sprintu.

## Status sprintów

- [x] **Sprint 1 - Audyt obecnych integracji** (ukończony 2026-06-17, raport: [docs/CRM_AUDIT_SPRINT1.md](docs/CRM_AUDIT_SPRINT1.md))
- [~] **Sprint 2 - Automatyczna synchronizacja CRM** (strategia C; implementacja + migracja gotowe i wdrożone z flagą OFF, pozostaje rollout produkcyjny: flaga + cron - patrz sekcja Sprint 2)
- [ ] Sprint 3 - Monitoring synchronizacji (NASTĘPNY po rollout Sprintu 2)
- [ ] Sprint 4 - Alerty awarii CRM
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

## CRM SPRINT 2 - Automatyczna synchronizacja CRM [IMPLEMENTACJA GOTOWA, ROLLOUT PENDING]

Najważniejszy sprint. Obecnie synchronizacja wykonywana jest ręcznie.

### Stan realizacji (2026-06-17)

**Zrobione i wdrożone (bezpiecznie, flaga OFF):**
- Flaga `AppConfig.crmAutoSyncEnabled` (domyślnie `false`) - migracja `20260617130000_add_crm_autosync_flag` zastosowana na żywej bazie.
- Funkcja `enqueueAutoSyncJobs` (`src/lib/crm/enqueueAutoSyncJobs.ts`): kolejkuje PENDING `CrmImportJob` dla aktywnych integracji, z guardem R2 (pomija PENDING/RUNNING). Nie dotyka silników ani route'a admina.
- Skrypt CLI dla crona `scripts/crm-enqueue-autosync.ts` (`npm run crm:enqueue`), z opcjonalnym argumentem `integrationId` do testu na jednej integracji.
- Instrukcja operacyjna: [docs/CRM_AUTOSYNC.md](docs/CRM_AUTOSYNC.md).
- Przetestowane: typecheck OK; dry-run przy fladze OFF = no-op (0 jobów), co potwierdza odczyt nowej kolumny z bazy.

**Rollout produkcyjny - do wykonania przez Daniela (DoD #7, #8):**
- [ ] Faza 1: włączyć flagę, odpalić `npm run crm:enqueue -- <integrationId>` dla JEDNEJ integracji, sprawdzić przebieg workera (brak duplikatów, brak masowej dezaktywacji).
- [ ] Faza 2: dodać wpis crontab 2x dziennie (06:00, 18:00) na VPS, obserwować pierwsze automatyczne przebiegi na wszystkich aktywnych.
- [ ] Po potwierdzeniu na produkcji: oznaczyć Sprint 2 jako ukończony, ustawić Sprint 3 jako następny.
- Rollback w każdej chwili: `crmAutoSyncEnabled = false` (bez deployu).

**Cel:** automatyczne uruchamianie synchronizacji wszystkich aktywnych integracji,
bez ręcznej obsługi Daniela.

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

## CRM SPRINT 3 - Monitoring synchronizacji

Dla każdego CRM pokazywać: ostatnia synchronizacja, liczba ofert, liczba nowych ofert,
liczba zaktualizowanych ofert, liczba błędów.
Cel: szybkie wykrywanie problemów.

## CRM SPRINT 4 - Alerty awarii CRM

Powiadomienie gdy: synchronizacja zakończy się błędem, CRM nie odpowiada,
liczba ofert nagle spadnie, import nie wykona się o czasie.

## CRM SPRINT 5 - Ujednolicenie architektury CRM

Sprawdzić: wspólne mechanizmy, wspólne mapowanie, wspólny importer.
Cel: łatwiejsze dodawanie kolejnych CRM.

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

### P-B: Pełny re-upload zdjęć przy każdej aktualizacji oferty
- **Gdzie:** `processOffer` w silnikach (widoczne w `esticrm-sync.ts`: `removeExistingR2Photos` + ponowny upload wszystkich zdjęć na każdym UPDATE).
- **Co:** każda aktualizacja oferty kasuje i wgrywa od nowa wszystkie zdjęcia do R2.
- **Wpływ biznesowy:** koszt R2 i czas importu rosną z częstotliwością synchronizacji.
- **Priorytet:** średni. Trzeba rozważyć **zanim** włączymy wariant "sync przy każdej zmianie" (B).

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

---

## CEL KOŃCOWY

Każde biuro po konfiguracji CRM:
- publikuje automatycznie,
- aktualizuje automatycznie,
- usuwa automatycznie,
- nie wymaga ręcznej obsługi.

Portal sam dba o synchronizację.
