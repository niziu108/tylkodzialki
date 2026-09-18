# Gotowość importu na skalę (cel: 50 000 ofert)

Stan wyjściowy (2026-09-09): 7 287 aktywnych ofert, 125 kont z ofertami, największy pojedynczy
dostawca 805 działek. Rozmowy z sieciami franczyzowymi (Metrohouse ~4 300 gruntów, Północ 1 461,
RE/MAX 807) oznaczają, że jedno podłączenie potrafi wnieść więcej ofert, niż serwis miał przez
pierwsze cztery miesiące. Ten dokument spisuje, co zostało zabezpieczone i co jeszcze czeka na
decyzję.

## 1. Hamulec masowej deaktywacji

`src/lib/crm/mass-deactivation.ts`, `src/lib/crm/deactivate-missing.ts`

Do tej pory pełny eksport gasił wszystko, czego w nim nie było, a jedynym warunkiem było „plik ma
co najmniej jedną ofertę". Urwany eksport partnera z 4 tys. działek (timeout generatora, przerwany
transfer, biuro testujące filtr) wyglądał identycznie jak „sprzedaliśmy wszystko".

Teraz: jeśli pełny eksport pomija więcej niż `CRM_DEACTIVATION_MAX_SHARE` procent (domyślnie 40%)
aktywnej podaży integracji i dotyczy to więcej niż `CRM_DEACTIVATION_MIN_COUNT` ofert (domyślnie
25), wygaszanie jest wstrzymane. Oferty zostają aktywne, w `CrmSyncLog` pojawia się wpis ERROR
z powodem, a kolejny poprawny eksport wykona deaktywację normalnie.

Małe biura nie są tym dotknięte: próg liczby bezwzględnej przepuszcza rotację typu „6 ofert, 4
sprzedane".

## 2. Skanowanie podaży zamiast `notIn`

Cztery silniki (domypl, asari, esticrm, locumnet) miały tę samą funkcję w czterech kopiach,
z zapytaniem `externalId: { notIn: [...wszystkie ID z pliku] }`. Prisma wysyła każdy identyfikator
jako osobny parametr, a Postgres przyjmuje ich maksymalnie ~65 tys. Przy skali docelowej to twarda
ściana. Teraz podaż integracji czytana jest stronami po 1000 i porównywana przez `Set` po naszej
stronie, a zapis idzie partiami po 200 zamiast transakcji na każdą ofertę (4 tys. wygaszeń to było
4 tys. round-tripów do Neona).

## 3. Budżet geokodowania

`src/lib/crm/geocode.ts`

Reużycie współrzędnych z bazy zostało po incydencie kosztowym, ale nie jest szczelne: gdy kontrola
krzyżowa odrzuci zapisany pin, oferta idzie do płatnego API przy każdym przebiegu. Licznik stoi
teraz w jedynym miejscu, przez które wychodzi płatne zapytanie:

- `CRM_GEOCODE_RUN_LIMIT` (domyślnie 1500) na przebieg,
- `CRM_GEOCODE_DAILY_LIMIT` (domyślnie 3000) na dobę.

Po wyczerpaniu oferta wchodzi bez współrzędnych i uzupełni się w kolejnym imporcie. Nowy partner
z 4 tys. ofert bez lat/lng rozłoży się na dwa–trzy dni zamiast jednego rachunku.

## 4. Logi importu: 10 GB i rosło

`src/lib/crm/log-policy.ts`, `src/lib/crm/log-retention.ts`, `npm run crm:logi`

Pomiar z 2026-09-09: `CrmSyncLog` ważył 9 975 MB przy 170 MB całej reszty bazy. 8 GB z tego to
payloady wpisów UPDATE/SUCCESS: 1,55 mln kopii XML-a oferty po ~5,4 kB, odkładanych codziennie dla
każdej ruszonej oferty. Przy 50 tys. ofert ten sam mechanizm dokłada ~270 MB dziennie.

- **Zapis**: payload zostaje tylko przy ERROR, CREATE i SKIP_NO_CREDITS, i jest przycinany do 32 kB
  (do 18.09 było 8 kB, patrz niżej).
- **Sprzątanie**: `npm run crm:logi` (raport) i `npm run crm:logi -- --apply`. Faza A zdejmuje
  payload z wpisów starszych niż 14 dni, zachowując całą historię zdarzeń. Faza B kasuje rutynowe
  wiersze starsze niż 120 dni. ERROR i DEACTIVATE zostają bezterminowo.
- **Automat**: worker robi to raz na dobę, ale tylko przy `CRM_LOG_RETENTION_AUTO=1`. Domyślnie
  wyłączony, bo kasuje dane.

Postgres po UPDATE/DELETE zwalnia miejsce do ponownego użycia, ale plik tabeli kurczy się dopiero
po `VACUUM FULL "CrmSyncLog"` (blokuje tabelę na czas operacji).

## 5. Sitemapa

`src/lib/sitemapy.ts`, `app/sitemap.xml/route.ts`, `app/sitemap-oferty/[part]/route.ts`

Google przyjmuje 50 000 adresów na plik i odrzuca cały plik po przekroczeniu. Wszystko leciało
w jednym `/sitemap.xml` z `take: 45000` na ofertach. Teraz `/sitemap.xml` jest indeksem, a treść
siedzi w `/sitemap-strony.xml` i `/sitemap-oferty/N.xml` (po 20 tys. ofert). Adres wejściowy się nie
zmienił, więc robots.txt i to, co Google ma zapamiętane, zostaje ważne.

## Wykonane na produkcji 2026-09-09

Sprzątnięcie zaległości: `npm run crm:logi -- --apply` zdjął payload z 1 279 615 wpisów i usunął
2 124 rutynowe wiersze (dwa przebiegi, łącznie ~21 minut). Payloady leżały w tabeli TOAST, więc
plik nie zmalał sam z siebie: `VACUUM FULL "CrmSyncLog"` (345 s, przy pustej kolejce importu)
sprowadził tabelę z 10 172 MB do 2 567 MB.

Pozostałe ~1,9 GB to payloady z ostatnich 14 dni, czyli okno diagnostyczne, którego retencja nie
rusza. Wpadną pod próg za dwa tygodnie — wtedy warto powtórzyć `npm run crm:logi -- --apply`
(albo włączyć automat). Docelowy rozmiar tabeli to okolice 600–700 MB.

## Poprawka 2026-09-18: UPDATE omijał regułę zapisu

Reguła z `log-policy.ts` działała tylko w `logSync`. Wpisy CREATE i UPDATE/REACTIVATE powstają
w transakcji `processOffer` (`tx.crmSyncLog.create`) i szły z pełnym payloadem, więc od 09.09
każdy UPDATE dalej odkładał XML oferty: ok. 23,5 tys. wpisów i 123 MB na dobę. Dlatego tabela
zamiast zejść do 600–700 MB urosła do 3 900 MB (18.09: heap 488 MB, TOAST 3 094 MB, indeksy 278 MB).

- Każdy zapis CrmSyncLog z payloadem idzie przez `payloadForLog`: 4 silniki oraz trasy
  `/api/crm/push` i `/api/crm/deactivate`. Pilnuje tego test w `log-policy.test.ts`, który skanuje
  `src` i `app` (nowy silnik z zapisem wprost w transakcji nie przejdzie testów).
- Sufit podniesiony z 8 do 32 kB: 8 kB przycinał każdy CREATE z EstiCRM (30 na 30 w 14 dni,
  surowy `rawOffer` do 20,3 tys. znaków), a CREATE to ok. 40 wpisów na dobę.
- Automat retencji nie jest włączony: od 09.09 nie zszedł żaden payload (najstarszy z 26.08,
  zero martwych krotek w tabeli). Punkt 2 z „Czeka na decyzję" nadal otwarty.

## Czeka na decyzję

1. **Indeksy.** `prisma/skala-indeksy.sql`: `CrmOfferLink(integrationId, id)` pod skan podaży
   i `CrmSyncLog(createdAt)` pod retencję. Zmiana schematu na żywej bazie, do wykonania świadomie.
2. **Automat retencji.** `CRM_LOG_RETENTION_AUTO=1` w env workera na VPS. Bez niego sprzątanie
   trzeba uruchamiać ręcznie co kilka tygodni.
3. **Kredyty publikacji.** Dziś `paymentsEnabled = false`, więc import wielkiego partnera przechodzi.
   Po włączeniu płatności biuro z 4 tys. ofert wpadnie w `SKIP_NO_CREDITS` i import stanie: konta
   partnerskie będą potrzebowały wyłączenia limitu albo puli kredytów.
