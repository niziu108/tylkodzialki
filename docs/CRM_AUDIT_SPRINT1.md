# Audyt CRM - Sprint 1

> Data: 2026-06-17. Sprint read-only, zero zmian w kodzie. To jest raport.
> Zakres: Galactica, Asari, EstiCRM. Cel: zrozumieć jak działa to, co działa na produkcji,
> i nazwać ryzyka przed automatyzacją (Sprint 2).

## 1. Architektura

- **Web na Vercel** (auto-deploy z `main`). **Worker CRM na VPS.**
- **Trzy silniki importu**, wszystkie po FTP, pobierają ZIP/XML, parsują i zapisują oferty:
  - Galactica / GENERIC: `src/lib/crm/domypl-sync.ts` (~1700 linii), eksport `syncCrmIntegrationNow`
  - Asari: `src/lib/crm/asari-sync.ts` (~1500 linii), eksport `syncAsariIntegrationNow`
  - EstiCRM: `src/lib/crm/esticrm-sync.ts` (~1270 linii), eksport `syncEstiCrmIntegrationNow`
- **Kolejka importu już istnieje:** model `CrmImportJob` (`PENDING -> RUNNING -> SUCCESS/ERROR`) w `prisma/schema.prisma`.
- **Worker:** `scripts/crm-worker.ts`. W trybie `--loop` co 10 s bierze najstarszy job `PENDING`, woła `runCrmImportJob`, oznacza wynik. Tryb jednorazowy: `crm-worker.ts JOB_ID`.
- **Routing silników:** `src/lib/crm/run-crm-job.ts` wybiera silnik po `provider` (`ESTI_CRM`, `ASARI`, reszta -> domypl) lub po `feedFormat === "ESTICRM_XML"`. Aktualizuje statystyki joba i integracji.

### Model danych (kluczowe)
- `CrmIntegration` - konfiguracja per biuro (FTP, provider, feedFormat, `isActive`, `fullImportMode`, statystyki ostatniego importu).
- `CrmOfferLink` - mostek między ofertą w bazie a ofertą w CRM. **Unikat `(integrationId, externalId)`** to podstawa idempotencji.
- `CrmSyncLog` - log akcji per oferta (`CREATE/UPDATE/DEACTIVATE/REACTIVATE/DELETE/ERROR`).
- `CrmImportJob` - kolejka zadań importu.
- `CrmProcessedFile` - ślad przetworzonych plików feedu (unikat `(integrationId, remoteFileName)`).
- Enum providerów: `GENERIC, ASARI, ESTI_CRM, IMOX, GALACTICA`. Formaty: `DOMY_PL, EBIURO_V2, ESTICRM_XML`.

## 2. Dwie ścieżki uruchomienia (obie dziś ręczne)

1. **Admin** `app/api/admin/crm/integrations/[id]/sync-now/route.ts`:
   tworzy `CrmImportJob` (PENDING), worker na VPS go podejmuje. Ma guard na duplikat (PENDING/RUNNING).
   Komunikat wprost: "Teraz uruchom worker poza Vercel". **To jest ścieżka bezpieczna i docelowa pod automat.**
2. **User** `app/api/crm/integrations/[id]/sync-now/route.ts`:
   odpala sync **synchronicznie w żądaniu** i obsługuje tylko ASARI vs domypl (brak EstiCRM). **Ścieżka ryzykowna** (patrz P-A).

**Wniosek dla Sprintu 2:** całe rusztowanie pod automatyzację już jest (kolejka + worker + routing + guard).
Brakuje jednego: czegoś, co samo dodaje joby zamiast Daniela.

## 3. Weryfikacja wymaganych obszarów

| Obszar | Jak działa | Ocena |
|--------|------------|-------|
| Import nowych ofert | brak `CrmOfferLink` -> tworzy `Dzialka` + link, status `AKTYWNE` | OK |
| Aktualizacja ofert | istnieje link -> UPDATE pól; oferta `ZAKONCZONE` -> REACTIVATE | OK |
| Zdjęcia | upload do R2; przy UPDATE kasowane i wgrywane od nowa | działa, ale patrz P-B |
| Usuwanie ofert | akcja DELETE z feedu lub brak w pełnym eksporcie -> soft delete `ZAKONCZONE` + `endedAt` | OK, bezpieczne |
| Logi błędów | `CrmSyncLog`, `CrmImportJob.errorMessage`, `CrmIntegration.lastErrorMessage` | OK, ale tylko "pull", brak alertów |

## 4. Mechanizmy bezpieczeństwa, których NIE WOLNO ruszać

- **Idempotencja:** oferta identyfikowana przez unikat `CrmOfferLink(integrationId, externalId)`. Powtórny import = UPDATE, nie duplikat. Można bezpiecznie powtarzać import (fundament pod auto-sync).
- **Bezpiecznik dezaktywacji (R1):** brakujące oferty gasną tylko przy pełnym eksporcie i włączonym `fullImportMode`:
  - domypl / EstiCRM: `fullImportMode && isFullExport` (tryb eksportu zawiera "full"/"complete"/"calosc"),
  - Asari: `fullImportMode && emptyOffers`.
  Częściowy lub nieudany feed NIE wyczyści ofert.
- **Soft delete, nie kasowanie:** dezaktywacja ustawia `ZAKONCZONE` + `endedAt`, nie usuwa rekordu, zdjęć ani statystyk. Odwracalne.
- **Izolacja per integracja:** każda oferta wisi pod swoim `integrationId`. Operacje jednej integracji nie dotykają ofert innego biura.
- **Guard duplikatów joba (R2):** enqueue admina nie tworzy drugiego joba, gdy istnieje `PENDING`/`RUNNING`.
- **Worker sekwencyjny:** jeden job naraz, więc w obrębie jednego workera nie ma równoległych przebiegów.

## 5. Ryzyka dla działających integracji (materializują się w Sprincie 2)

| # | Ryzyko | Status dziś | Wymóg w Sprincie 2 |
|---|--------|-------------|---------------------|
| R1 | Masowa dezaktywacja ofert przy niepełnym/uszkodzonym feedzie | ZABEZPIECZONE warunkiem pełnego eksportu | zachować warunek bez zmian |
| R2 | Nakładające się przebiegi (scheduler odpala, gdy poprzedni trwa) | guard duplikatów + worker sekwencyjny | scheduler używa tego samego guardu |
| R3 | Skok obciążenia + uderzenie w FTP biur przy odpaleniu wszystkich naraz | brak (dziś jedno biuro naraz) | rozłożyć w czasie / kolejkować, nie równolegle |
| R4 | Re-upload wszystkich zdjęć przy każdej aktualizacji | istnieje | istotne przed wariantem "sync przy zmianie" |
| R5 | Cicha awaria bez nadzoru (wygasłe FTP, brak pliku) | wyłapuje Daniel patrząc na wynik | dlatego Sprint 3 i 4 tuż po 2 |
| R6 | Route usera `sync-now`: synchroniczny + brak EstiCRM | istniejący dług | auto-sync wyłącznie przez kolejkę + worker |

## 6. Stan automatyzacji dziś

- **Brak crona.** Brak pliku `vercel.json`. Brak harmonogramu.
- Skrypt npm: `crm:sync` -> `tsx scripts/crm-worker.ts`.
- Synchronizacja jest w 100% ręczna: Daniel wywołuje sync (panel admina kolejkuje job, worker na VPS przetwarza).

## 7. Rekomendacja wejścia w Sprint 2

Strategia **C (hybryda)**: harmonogram bazowy (np. 2x dziennie) kolejkuje import wszystkich aktywnych
integracji przez istniejącą kolejkę + worker, a ręczny "sync teraz" zostaje. Wariant "przy zmianie"
po wdrożeniu monitoringu (Sprint 3) i alertów (Sprint 4). Szczegóły i Definition of Done w `ROADMAP_CRM.md`.
