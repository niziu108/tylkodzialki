# Auto-sync CRM (Sprint 2, strategia C)

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

Sterowane flagą `AppConfig.crmAutoSyncEnabled` (domyślnie `false`).

- **Włącz:** ustaw `crmAutoSyncEnabled = true` w rekordzie `AppConfig` (jeden wiersz).
- **Wyłącz / rollback:** ustaw `crmAutoSyncEnabled = false`. Cron może dalej chodzić, skrypt po prostu nic nie zrobi.

Dopóki flaga jest `false`, `npm run crm:enqueue` jest no-opem (loguje „Auto-sync wyłączony").

## Test na jednej integracji (faza 1 rolloutu)

Skrypt przyjmuje opcjonalny argument z id integracji. Wymaga włączonej flagi.

```bash
npm run crm:enqueue -- <integrationId>
```

Zakolejkuje job tylko dla tej jednej integracji. Obserwuj log workera i statystyki joba
(`CrmImportJob`): czy wykonał się bez błędu, bez duplikatów, bez masowej dezaktywacji.

## Pełny rollout (faza 2): cron na VPS

Po teście dodaj wpis do crontab użytkownika, pod którym działa worker.
Godziny: 06:00 i 18:00 czasu serwera (dostosuj w razie potrzeby).

```cron
# Auto-sync CRM: kolejkowanie aktywnych integracji 2x dziennie.
# Dostosuj ścieżki: katalog aplikacji oraz lokalizację npm (w cronie PATH jest minimalny).
0 6,18 * * * cd /sciezka/do/tylkodzialki && /usr/bin/npm run crm:enqueue >> /var/log/crm-enqueue.log 2>&1
```

Uwagi:
- W cronie używaj **ścieżek bezwzględnych** do `npm`/`node` (sprawdź przez `which npm`).
- Skrypt tylko kolejkuje (lekki, szybki). Faktyczny import robi worker, który musi działać w trybie `--loop`.
- Worker przetwarza joby sekwencyjnie, więc nawet zakolejkowanie wszystkich naraz nie uderza równolegle w FTP biur.

## Bezpieczeństwo (mapowanie na ryzyka z audytu)

| Ryzyko | Jak zaadresowane |
|--------|------------------|
| R1 masowa dezaktywacja | zero zmian w silnikach; warunek `fullImportMode && pełny eksport` nietknięty |
| R2 nakładające się przebiegi | skrypt pomija integracje z jobem PENDING/RUNNING (guard jak w route admina) |
| R3 skok obciążenia / FTP | worker sekwencyjny: jeden job naraz |
| odwracalność | flaga `crmAutoSyncEnabled`, wyłączenie bez deployu |
