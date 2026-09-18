# Auto-sync CRM (Sprint 2, strategia C)

> **Status: na produkcji od 2026-06-17.** Cron na VPS (root) leci **co 2 godziny** (`0 */2 * * *`,
> zmienione 2026-06-22 z `0 6,18`; doc zaktualizowany 2026-07-12, wcześniej mylnie podawał `0 6,18`).

Automatyczna synchronizacja kolejkuje import wszystkich aktywnych integracji CRM
co ~2 godziny, bez ręcznej obsługi. Ciężką pracę wykonuje istniejący worker na VPS.

## Jak to działa

```
cron na VPS (np. 06:00 i 18:00)
        │  uruchamia skrypt kolejkujący
        ▼
npm run crm:enqueue   ──►  tworzy PENDING CrmImportJob dla każdej aktywnej integracji
        │                  (pomija te, które mają już PENDING/RUNNING)
        ▼
worker --loop (już działa) ──►  bierze joby po kolei i przetwarza istniejącymi silnikami
```

Skrypt kolejkujący tworzy **dokładnie taki sam** job jak ręczny przycisk „synchronizuj" w panelu admina.
Nie dotyka silników importu ani bezpiecznika masowej dezaktywacji.

## Wyłącznik (bez deployu)

Sterowane flagą `AppConfig.crmAutoSyncEnabled` (domyślnie `false`). Na VPS, w katalogu projektu:

```bash
npm run crm:autosync:off     # STOP: kolejka przestaje rosnąć (rollback bez deployu)
npm run crm:autosync:on      # włącz auto-sync
npm run crm:autosync:status  # sprawdź bieżący stan flagi
```

Cron może dalej chodzić, przy fladze `off` skrypt `crm:enqueue` jest no-opem (loguje „Auto-sync wyłączony").
Joby już zakolejkowane worker dokończy (to bezpieczne importy); flaga blokuje tylko tworzenie nowych.

## Test na jednej integracji (faza 1 rolloutu)

Skrypt przyjmuje opcjonalny argument z id integracji. Wymaga włączonej flagi.

```bash
npm run crm:enqueue -- <integrationId>
```

Zakolejkuje job tylko dla tej jednej integracji. Obserwuj log workera i statystyki joba
(`CrmImportJob`): czy wykonał się bez błędu, bez duplikatów, bez masowej dezaktywacji.

## Cron na VPS (zainstalowany)

Wpis w crontab roota na VPS (`crontab -l`):

```cron
0 */2 * * * cd /var/www/tylkodzialki && PATH=/usr/local/bin:/usr/bin:/bin /usr/bin/npm run crm:enqueue >> /var/log/crm-enqueue.log 2>&1
```

Harmonogram: **co 2 godziny** (`0 */2 * * *`, zmienione 2026-06-22 z `0 6,18` = 2×/dobę,
bo 2× było za rzadko na czas weryfikacji IMO). Globalny dla wszystkich biur.
Podgląd logu kolejkowania: `tail -n 20 /var/log/crm-enqueue.log`.

Uwagi:
- W cronie PATH jest okrojony, stąd `PATH=...` inline i bezwzględna ścieżka `/usr/bin/npm`.
- `cd` do katalogu projektu jest potrzebne, by skrypt złapał `.env.local` (tam jest `DATABASE_URL`).
- Skrypt tylko kolejkuje (lekki, szybki). Faktyczny import robi worker, który musi działać w trybie `--loop` (na VPS pod pm2 jako `crm-worker`).
- Worker przetwarza joby sekwencyjnie, więc nawet zakolejkowanie wszystkich naraz nie uderza równolegle w FTP biur.

## Dysk: katalogi tymczasowe i drop-zone FTP

Silniki pobierają paczki do `os.tmpdir()/td-*` (`td-crm-`, `td-esticrm-`, `td-asari-`, `td-locumnet-`,
`td-backfill-`). Katalog kasuje się w `finally` po każdym imporcie.

Wyciek naprawiony 2026-08-17: silnik DOMY.PL tworzył katalog tymczasowy na starcie funkcji pobierającej,
a wczesne wyjście „brak nowych plików" go nie kasowało. Przy 12 przebiegach na dobę × ~100 integracji
w `/tmp` narosło **16 399** pustych katalogów. Teraz katalog powstaje dopiero wtedy, gdy naprawdę jest
co pobierać.

Zabezpieczenia dodatkowe (bo crash/restart procesu nadal może zostawić katalog):
- worker sprząta osierocone `td-*` przy starcie (bez ograniczeń wiekowych — jest jednoinstancyjny),
- oraz **co godzinę w trakcie działania**, ale tylko katalogi starsze niż 12 h (żeby nie ruszyć
  równolegle odpalonego ręcznie `npm run crm:sync -- JOB_ID`).

Zmienne środowiskowe:

| Zmienna | Domyślnie | Do czego |
|---------|-----------|----------|
| `CRM_FEED_RETENTION_DAYS` | `14` | margines wieku przy kasowaniu paczek z FTP biura |
| `CRM_FEED_KEEP_MIN` | `10` | ile najświeższych paczek zostaje na FTP niezależnie od reguł |
| `CRM_MAX_RUN_BYTES` | `5368709120` (5 GB) | limit łącznego rozmiaru plików pobieranych w JEDNYM przebiegu DOMY.PL |

`CRM_MAX_RUN_BYTES` chroni dysk przed przypadkiem „20 plików po kilkaset MB naraz" (zdarzają się paczki
708 MB, rekord w bazie to 2,8 GB). Zawsze pobieramy przynajmniej jeden plik, reszta czeka na kolejny
przebieg — kolejność chronologiczna zostaje zachowana.

## Czyszczenie drop-zone FTP: dwie reguły

Cała decyzja „co wolno skasować z FTP biura" siedzi w jednej funkcji `planFeedPrune`
(`src/lib/crm/feed-pruning.ts`). Używa jej i silnik, i raport — dlatego podgląd pokazuje dokładnie to,
co silnik zrobi, co do pliku.

**Tryb `full-anchor`** (biuro ma rozpoznany pełny eksport) — reguła bez zmian: zostaje najświeższy pełny
eksport i wszystko, co przyszło po nim. Kasujemy tylko starsze paczki dokładnie dopasowane do rekordu
SUCCESS, starsze niż `CRM_FEED_RETENTION_DAYS`, spoza bufora `CRM_FEED_KEEP_MIN`.

**Tryb `no-full-export`** (biuro nigdy nie przysłało pełnego eksportu — u nas głównie Galactica) — nowa
reguła, **domyślnie wyłączona**. Bez snapshotu odniesienia odtworzenie biura z samego FTP i tak jest
niemożliwe (od tego są backupy Neona), więc trzymanie setek paczek w nieskończoność niczego nie ratuje.
Po włączeniu kasujemy paczki, które jednocześnie: są dopasowane do rekordu SUCCESS, są starsze niż
`CRM_FEED_RETENTION_DAYS_NO_FULL` (30 dni), nie należą do `CRM_FEED_KEEP_MIN_NO_FULL` najświeższych (20)
i **nie są największą paczką biura** (największa to najpoważniejszy kandydat na nieoznaczony pełny
eksport z czasów sprzed pola `isFullExport`).

| Zmienna | Domyślnie | Do czego |
|---------|-----------|----------|
| `CRM_FEED_PRUNE_WITHOUT_FULL` | brak (= wyłączone) | `1` włącza sprzątanie u biur bez pełnego eksportu |
| `CRM_FEED_RETENTION_DAYS_NO_FULL` | `30` | margines wieku w tym trybie |
| `CRM_FEED_KEEP_MIN_NO_FULL` | `20` | bufor najświeższych paczek w tym trybie |

### Podgląd przed kasowaniem

```bash
npm run crm:prune:report                 # co skasuje bieżąca polityka
npm run crm:prune:report -- --with-full  # symulacja WŁĄCZONEGO trybu no-full-export
npm run crm:prune:report -- --integration <id>   # jedno biuro
```

Raport tylko czyta: łączy się z FTP po listę plików i liczy plan. Nic nie kasuje. Obejmuje wyłącznie
integracje faktycznie jadące silnikiem DOMY.PL (ASARI/EstiCRM/LocumNet mają własne silniki i własne
reguły czyszczenia, mimo że bywają zapisane z `feedFormat=DOMY_PL`).

### Kolejność wdrożenia (świadomie ostrożna)

1. `npm run crm:prune:report -- --with-full` na VPS — liczby dla wszystkich biur.
2. **Kanarek na jednym biurze**, zanim reguła ruszy dla wszystkich:
   ```bash
   npm run crm:prune:report -- --with-full --integration <id> --apply
   ```
   `--apply` bez `--integration` jest zablokowane. Po skasowaniu poczekaj na kolejny przebieg tego
   biura (cron co 2 h) i sprawdź w logu workera, że import przeszedł czysto i nie ma masowej
   dezaktywacji ofert.
3. Dopiero wtedy globalnie: `CRM_FEED_PRUNE_WITHOUT_FULL=1` w `.env.local` na VPS
   + `pm2 restart crm-worker --update-env`.
4. Wyłączenie to usunięcie zmiennej i restart — bez deployu.

Stan (kontrola 2026-08-17): tryb `full-anchor` działa dla **32 ze 100** integracji DOMY.PL. Pozostałe 68
nie ma ani jednego pliku oznaczonego `isFullExport`. Przykład skali z jednego biura: 748 paczek / 2,3 GB
na FTP, z czego reguła `no-full-export` skasowałaby 511 plików / 1 GB, zostawiając 237.

## EstiCRM: okno paczek, uszkodzone ZIP-y i sprzątanie

Logika w `src/lib/crm/esticrm-feed-window.ts` (testy obok), wpięta w `esticrm-sync.ts`.

**Jak EstiCRM wysyła dane** (pomiar 2026-09-16, wszystkie 11 integracji): pełny eksport
(`export="full"`) tylko raz, w pierwszej paczce po podłączeniu biura, potem same paczki przyrostowe.
Każda paczka przyrostowa ma komplet zdjęć swoich ofert (24 sprawdzone paczki z 4 biur, zero braków).

**Problem:** silnik szedł od najnowszej paczki wstecz aż do pełnego eksportu, czyli w każdym przebiegu
przez całą historię biura (em5: 433 paczki / 6 GB co 2 h, inne biuro 538 paczek / 6,5 GB). Sprzątanie
nic nie kasowało, bo jedyny pełny eksport był najstarszym plikiem. Jedna urwana paczka (em5,
`EstiCRM_22196_20260826095342.zip`) wywracała każdy przebieg błędem `FILE_ENDED` od 26.08 do 16.09.

**Okno przebiegu.** Silnik czyta paczki (i luźne pliki XML poza `definitions.xml`) nie starsze niż
`lastSuccessAt` integracji minus zakładka (24 h). Starsze przeczytał już wcześniejszy udany przebieg.
Przestój workera albo przywrócenie bazy cofa kotwicę, więc okno samo sięga po brakujące paczki.
Jak dawniej, wstecz do pełnego eksportu, silnik czyta, gdy integracja nie ma jeszcze żadnej oferty
w bazie (pierwszy przebieg albo poprawiony provider lub katalog: pełny eksport ze startu leży wtedy
dłużej niż zakładka).

**Kotwica rusza się tylko po przebiegu, który przetworzył wszystko.** Błąd zapisu oferty, oferta
pominięta z braku publikacji albo niewylistowany podkatalog FTP zostawiają `lastSuccessAt` bez zmian,
więc te same paczki wracają w kolejnych przebiegach, aż wejdą (także po zakupie pakietu i
„Synchronizuj teraz"). Skutek w adminie: przy błędach status „Błąd", a przy samych pominięciach
z braku publikacji po 48 h „Nieświeże".

**Uszkodzona paczka** (nie da się jej rozpakować) jest pomijana, a przebieg czyta dalej:
- wpis `ERROR` w `CrmSyncLog` z nazwą pliku, nazwa trafia też do `lastErrorMessage` (panel biura),
- przebieg z taką paczką nigdy nie liczy się jako pełny eksport, więc niczego nie wygasza,
- paczka młodsza niż 30 min mogła się jeszcze wgrywać: bez wpisu ERROR, weźmie ją kolejny przebieg,
- uszkodzona paczka nie blokuje kotwicy (ponowne czytanie jej nie naprawi), więc po dobie wypada z okna,
- awaria środowiska (brak miejsca, uprawnienia) dalej wywraca przebieg, żeby kotwica się nie przesunęła.

**Sprzątanie FTP**, zawsze od najstarszych paczek, bez dziur w czasie:
- reguła pełnego eksportu (bez zmian): starsze od najnowszego pełnego przeczytanego w przebiegu,
  starsze niż `CRM_FEED_RETENTION_DAYS` (14), poza `CRM_FEED_KEEP_MIN` (10) najświeższymi,
- reguła okna (włącznik `CRM_ESTICRM_PRUNE`): starsze od początku okna przebiegu, starsze niż
  `CRM_FEED_RETENTION_DAYS_NO_FULL` (30), poza `CRM_FEED_KEEP_MIN_NO_FULL` (20) najświeższymi. Kasuje
  też jedyny pełny eksport biura, dlatego ma osobny włącznik od DOMY.PL,
- pierwszy nieudany `remove` przerywa sprzątanie w tym przebiegu (inaczej dziura w czasie),
- pusta zmienna (`CRM_FEED_KEEP_MIN_NO_FULL=`) daje wartość domyślną, nie zero.

| Zmienna | Domyślnie | Do czego |
|---------|-----------|----------|
| `CRM_ESTICRM_OVERLAP_HOURS` | `24` | zakładka okna; `off`, liczba ujemna albo ponad rok przywraca czytanie wstecz do pełnego eksportu |
| `CRM_ESTICRM_PRUNE` | brak = tylko podgląd w logu | `1` = sprzątanie u wszystkich biur EstiCRM, lista id po przecinku = kanarek |

Bez włącznika silnik w każdym przebiegu pisze w logu workera, co by skasował:
`[ESTICRM CLEANUP] Podgląd, nic nie kasuję ...`. Wdrożenie sprzątania: kanarek
`CRM_ESTICRM_PRUNE=<id jednego biura>` + `pm2 restart crm-worker --update-env`, kontrola kolejnego
przebiegu tego biura, potem `CRM_ESTICRM_PRUNE=1`.

## Bezpieczeństwo (mapowanie na ryzyka z audytu)

| Ryzyko | Jak zaadresowane |
|--------|------------------|
| R1 masowa dezaktywacja | zero zmian w silnikach; warunek `fullImportMode && pełny eksport` nietknięty |
| R2 nakładające się przebiegi | skrypt pomija integracje z jobem PENDING/RUNNING (guard jak w route admina) |
| R3 skok obciążenia / FTP | worker sekwencyjny: jeden job naraz |
| odwracalność | flaga `crmAutoSyncEnabled`, wyłączenie bez deployu |
