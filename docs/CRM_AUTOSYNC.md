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

Stan auto-czyszczenia drop-zone (kontrola 2026-08-17): działa dla **32 ze 100** integracji na silniku
DOMY.PL. Reszta nie ma ani jednego pliku oznaczonego `isFullExport`, więc bezpiecznik „zostaw najświeższy
pełny eksport" nie ma punktu odniesienia i nie kasuje nic — to głównie biura Galactiki, patrz osobny wątek
o braku pełnych eksportów.

## Bezpieczeństwo (mapowanie na ryzyka z audytu)

| Ryzyko | Jak zaadresowane |
|--------|------------------|
| R1 masowa dezaktywacja | zero zmian w silnikach; warunek `fullImportMode && pełny eksport` nietknięty |
| R2 nakładające się przebiegi | skrypt pomija integracje z jobem PENDING/RUNNING (guard jak w route admina) |
| R3 skok obciążenia / FTP | worker sekwencyjny: jeden job naraz |
| odwracalność | flaga `crmAutoSyncEnabled`, wyłączenie bez deployu |
