# Auto-sync CRM (Sprint 2, strategia C)

> **Status: na produkcji od 2026-06-17.** Cron na VPS (root) `0 6,18 * * *` (06:00 i 18:00 UTC).

Automatyczna synchronizacja kolejkuje import wszystkich aktywnych integracji CRM
o stałych godzinach, bez ręcznej obsługi. Ciężką pracę wykonuje istniejący worker na VPS.

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
0 6,18 * * * cd /var/www/tylkodzialki && PATH=/usr/local/bin:/usr/bin:/bin /usr/bin/npm run crm:enqueue >> /var/log/crm-enqueue.log 2>&1
```

Godziny: 06:00 i 18:00 **UTC** (serwer jest na UTC), czyli ok. 08:00 i 20:00 czasu polskiego.
Podgląd logu kolejkowania: `tail -n 20 /var/log/crm-enqueue.log`.

Uwagi:
- W cronie PATH jest okrojony, stąd `PATH=...` inline i bezwzględna ścieżka `/usr/bin/npm`.
- `cd` do katalogu projektu jest potrzebne, by skrypt złapał `.env.local` (tam jest `DATABASE_URL`).
- Skrypt tylko kolejkuje (lekki, szybki). Faktyczny import robi worker, który musi działać w trybie `--loop` (na VPS pod pm2 jako `crm-worker`).
- Worker przetwarza joby sekwencyjnie, więc nawet zakolejkowanie wszystkich naraz nie uderza równolegle w FTP biur.

## Bezpieczeństwo (mapowanie na ryzyka z audytu)

| Ryzyko | Jak zaadresowane |
|--------|------------------|
| R1 masowa dezaktywacja | zero zmian w silnikach; warunek `fullImportMode && pełny eksport` nietknięty |
| R2 nakładające się przebiegi | skrypt pomija integracje z jobem PENDING/RUNNING (guard jak w route admina) |
| R3 skok obciążenia / FTP | worker sekwencyjny: jeden job naraz |
| odwracalność | flaga `crmAutoSyncEnabled`, wyłączenie bez deployu |
