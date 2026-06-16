# TylkoDziałki.pl — Plan działania (ŹRÓDŁO PRAWDY)

> Ten plik jest naszą wspólną mapą. Na początku **każdego** czatu Claude czyta go i kontynuujemy
> od następnego niezrobionego punktu. Cel: najlepszy portal działek w Polsce, docelowo produkt
> wart dziesiątki milionów dolarów.

---

## 🟢 JAK ZACZĄĆ CZAT (wklej to na początku)

```
Czytaj ROADMAP.md w katalogu projektu — to nasz wspólny plan i źródło prawdy.
Trzymaj się sekcji "FILOZOFIA" i "JAK PRACUJEMY".
Powiedz mi, na którym punkcie jesteśmy (AKTUALNY PUNKT), w 1-2 zdaniach co zrobimy, i bierz się za niego.
Rób jeden punkt do końca, sprawdź, że działa, potem zaktualizuj ROADMAP.md (oznacz [x], dopisz
notatkę w DZIENNIKU, ustaw następny AKTUALNY PUNKT) i zaproponuj commit.
Po polsku. Przed większą lub nieodwracalną zmianą — najpierw zapytaj.
```

---

## 0. KONTEKST

- **Produkt:** portal ogłoszeń WYŁĄCZNIE z działkami (nie mieszkania, nie domy, nie lokale).
- **Cel:** najprostsze, najszybsze, najwygodniejsze miejsce do kupna i sprzedaży działek w PL.
- **Właściciel:** Daniel. Komunikacja po polsku (kod może być po angielsku).
- **Stan:** ~3150 ofert, ~50 biur, integracje CRM (Galactica, Asari, EstiCRM, domy.pl, eBiuro), Stripe, KSeF, blog, logowanie, ulubione, panel biura, statystyki ofert.
- **Stack:** Next.js 16 · React 19 · TypeScript · Tailwind · Prisma · PostgreSQL (Neon) · VPS Ubuntu + PM2 · NextAuth · Stripe.

## 1. FILOZOFIA (czego NIE podważać bez powodu)

- **Najpierw wzrost, monetyzacja po boomie.** Nie proponować włączania płatności/abonamentów jako priorytetu — najpierw podaż, ruch i produkt.
- **Kontakt leci prosto na telefon sprzedawcy** (mobile: „Zadzwoń" + SMS z gotową treścią). **Bez skrzynki/inboxu na portalu — to celowy wybór.** Jedyna realna luka: brak działającego kontaktu na desktopie (do załatania w P5).
- **Ciemny motyw celowo** (#131313 + zieleń #7aa333). Nie naciskać na jasny bez danych.
- **Wyszukiwarka: mało filtrów domyślnie**, reszta chowa się pod „Więcej filtrów" (collapsible już istnieje). Nie zaśmiecać.
- **Globalne menu zostaje wąskie, skupione na rdzeniu (działki).** Blog NIE wchodzi do globalnej nawigacji (to materiał wspierający, nie cel — linkujemy do niego kontekstowo, nie z top-nav). Jedyne planowane rozszerzenie nawigacji: zakładka **„Dla biur"** (P9). Do tego odchudzenie sekcji „O nas" na homepage.

## 2. JAK PRACUJEMY (zasady)

- Po polsku, konkretnie, bez owijania.
- **Jeden punkt = (zwykle) jeden czat.** Robimy do końca, weryfikujemy, że działa, dopiero potem dalej.
- Przed większą / nieodwracalną zmianą (migracje DB, usuwanie, deploy, rzeczy na zewnątrz) — **pytam**.
- **Definicja ukończenia punktu:** (1) działa i sprawdzone, (2) `[x]` w roadmapie, (3) notatka w DZIENNIKU (data, pliki, decyzje), (4) ustawiony następny AKTUALNY PUNKT, (5) zaproponowany commit.
- Nie ruszam rzeczy niezwiązanych z bieżącym punktem.

---

## 3. ROADMAPA (po kolei)

### 🔴 SZYBKIE WYGRANE (wpływ duży, koszt mały)
- [x] **P1. `<h1>` na stronie oferty.** ✅ Tytuł oferty to teraz `<h1>` (dokładnie jeden na stronie, w treści renderowanej przez serwer).
  Gdzie: `app/dzialka/[id]/DzialkaClient.tsx`.
  Sortowanie po cenie — **świadomie pominięte**: usunięte celowo dzień wcześniej (commit `44f511a`) i czysto kosmetyczne; nie przywracamy.
- [x] **P2. Zdejmij login-wall z `/sprzedaj`.** ✅ Formularz jest publiczny; logowanie/rejestracja dopiero przy „Opublikuj" (POST → 401 → zapis draftu → `/auth` → powrót na `/sprzedaj?autopublish=1` → auto-publikacja).
  **Uwaga z realizacji:** prawdziwy login-wall siedział w `app/sprzedaj/layout.tsx` (nie w `page.tsx`, jak zakładała roadmapa) — usunięty. Produkcyjny build wymagał owinięcia formularza w `<Suspense>` (`useSearchParams` + statyczny prerender) — naprawione. Rozbieżność zachowania middleware dev↔prod opisana w P15.
- [x] **P3. Napraw komparator wyszukiwarki.** ✅ „Match info" (dystans/dopasowanie) liczone RAZ na ofertę (jeden przebieg `O(n)`), reużyte przez filtr i sortowanie; wykrywanie miasta/województwa i czyszczenie fraz wyniesione do `buildSearchContext` (raz na żądanie). Przy ~3150 ofertach: ~68 100 → 3 150 wywołań match-info na żądanie (**21,6× mniej**, przewaga rośnie z liczbą ofert). Wynik wyszukiwania bez zmian (144/144 porównań stara↔nowa identyczne).
  Gdzie: `app/api/dzialki/route.ts` (`GET`: `buildSearchContext`, `getSearchMatchInfo`, sekcja `ranked.sort(...)`).
- [x] **P4. Artykuły bloga do sitemap.** ✅ Opublikowane artykuły (`isPublished: true`) trafiają do `/sitemap.xml` jako `/blog/[slug]` — koniec „osieroconych" wpisów dla Google. Zweryfikowane na żywej bazie: 14 artykułów w sitemapie, każdy URL żywy (200).
  Gdzie: `app/sitemap.ts` (`prisma.article.findMany` równolegle z ofertami przez `Promise.all`; `changeFrequency: 'monthly'`, `priority: 0.6`).
- [ ] **P4b. Subtelne wewnętrzne linkowanie do bloga** — NIE w globalnym menu (decyzja właściciela 2026-06-16: nawigacja zostaje wąska, skupiona na rdzeniu; slot rezerwujemy pod „Dla biur"/P9). Dodać kontekstową sekcję „Z bloga / Poradnik" (np. 3 najnowsze artykuły na dole homepage i/lub powiązany poradnik na stronie oferty). Cel SEO: artykuły przestają być osierocone — link equity płynie z mocnych stron (`/`, oferty) do treści. Sitemap mówi Google „te strony istnieją"; linkowanie mówi „są ważne" — dopiero razem dają pełny efekt rankingowy.

### 🟠 BARDZO WAŻNE (30 dni)
- [ ] **P5. Desktopowy „Napisz"** — przycisk na ofercie, który i tak wysyła wiadomość na telefon/mail sprzedawcy (filozofia zachowana, łatamy tylko desktop).
- [ ] **P6. Alerty e-mail o nowych działkach** (zapisane wyszukiwanie → mail przy nowej pasującej ofercie). To, nie ulubione, jest silnikiem powrotów.
- [x] **P7. SSR strony oferty** — render po stronie serwera (Prisma bezpośrednio), koniec podwójnego pobierania i pustej ramki dla Google. ✅ Zrobione w SPRINT 1 razem z P1.
- [ ] **P8. „Podobne oferty"** na stronie oferty (leady + SEO + czas na stronie).
- [ ] **P9. `/dla-biur` + odchudzenie hero/„O nas"** na homepage.
- [ ] **P10. Filtry: uzbrojenie/media + typ sprzedawcy** pod istniejącym „Więcej filtrów".

### 🟡 WAŻNE (1–3 miesiące)
- [ ] **P11. Wyszukiwanie po mapie** (piny/klastry, „szukaj w tym obszarze").
- [ ] **P12. Przepisanie silnika wyszukiwarki na bazę** + indeksy / PostGIS + cache (warunek skali 50k ofert).
- [ ] **P13. Huby SEO** (województwa → miasta, unikalna treść per miasto).
- [ ] **P14. Kreator dodawania ofert** zamiast monolitu (~1967 linii w `DzialkaForm.tsx`).
- [ ] **P15. Middleware dev↔prod — do weryfikacji na produkcji** (znalezione przy P2). Produkcyjny `next build` kompiluje `src/middleware.ts` (`ƒ Proxy (Middleware)` w tabeli tras) → w prod ochrona `/panel`/`/admin` i allowlist admina **najpewniej działa**. ALE lokalny `next dev` (Turbopack) middleware **nie zastosował** (anonim: `/panel` → 200, `/admin` → redirect `/` tylko przez strażnika strony). Do zrobienia: potwierdzić na żywej produkcji, że anonim na `/panel` i `/admin` dostaje redirect na `/auth`; jeśli tak — OK, jeśli nie — przenieść `middleware.ts` do roota. Nie blokuje P2 (`/sprzedaj` jest publiczne i statyczne niezależnie od middleware).

### ⚪ ODŁOŻONE (świadomie, nie teraz)
Monetyzacja/abonamenty B2B (po boomie) · profile biur · jasny motyw (kiedyś A/B) · recenzje · historia cen · programatyczne SEO.

---

## 4. DZIENNIK (status i decyzje)

- **AKTUALNY PUNKT: P4b** (subtelne wewnętrzne linkowanie do bloga — BEZ globalnego menu, decyzja właściciela; sekcja „Z bloga/Poradnik" na dole homepage i/lub powiązany poradnik na ofercie. SEO: artykuły przestają być osierocone, link equity płynie z mocnych stron). Poprzedni: **P4 ✅** (artykuły bloga w sitemap — 14 wpisów `/blog/[slug]`, zweryfikowane na żywej bazie).
- 2026-06-16 — Powstał plan. Roadmapa ustalona i przedyskutowana (audyt + uwagi właściciela). Start od P1.
- 2026-06-16 — **SPRINT 1 ukończony (P1 + P7).** Strona oferty renderowana po stronie serwera — Google dostaje pełny HTML, nie pustą ramkę.
  - **Pliki:** `src/lib/dzialki.ts` (nowy helper `getDzialkaById`: Prisma + `cache()`, jedno źródło prawdy), `app/api/dzialki/[id]/route.ts` (używa helpera, odpowiedź bez zmian), `app/dzialka/[id]/page.tsx` (SSR przez Prisma, JSON-LD w HTML serwera, `initial` → klient, `revalidate=60`), `app/dzialka/[id]/DzialkaClient.tsx` (przyjmuje `initial`, koniec podwójnego fetchu, tytuł `<div>`→`<h1>`).
  - **Decyzje:** (1) ISR `revalidate=60` zamiast „force-dynamic" — szybkość dla użytkownika i Googlebota, dane świeże do 60 s. (2) Sortowanie po cenie z litery P1 świadomie pominięte (usunięte celowo `44f511a`, kosmetyka). (3) `key={id}` na kliencie — czysty remount przy zmianie oferty, bez stale state.
  - **Weryfikacja:** `tsc --noEmit` = 0 błędów; realny render z serwera (curl na żywej bazie): `<h1>` = 1 z tytułem oferty, JSON-LD `Product` w źródle, brak skeletonu, treść (Cena/Powierzchnia) w HTML.
- 2026-06-16 — **SPRINT 2 ukończony (P2 — login-wall zdjęty z `/sprzedaj`).** Formularz dodawania działki jest publiczny; konto zakłada się dopiero przy „Opublikuj". (W promptcie właściciel nazwał to „SPRINT 3".)
  - **Pliki:** `app/sprzedaj/layout.tsx` (**USUNIĘTY** — to on był aktywnym login-wallem: `getServerSession` + `redirect('/auth')`; roadmapa błędnie wskazywała `page.tsx`), `app/sprzedaj/page.tsx` (zdjęty redundantny `redirect`, publiczny render + `metadata` SEO „Dodaj ogłoszenie za darmo"), `src/components/DzialkaForm.tsx` (nowy helper `buildDraft`; w `submitListing` obsługa `401`: zapis draftu + `router.push('/auth?callbackUrl=/sprzedaj?autopublish=1')`; deduplikacja zapisu draftu w ścieżce `NO_LISTING_CREDITS`), `src/middleware.ts` (zdjęto `/sprzedaj` z `isProtectedPath` i `matcher`).
  - **Decyzje:** (1) **Reużycie istniejącego mechanizmu `?autopublish=1`** (tego samego, którego używa `panel/pakiety/sukces`) zamiast budowy nowego — draft w localStorage przeżywa round-trip logowania i po powrocie ogłoszenie publikuje się samo. (2) Guard `isAutoPublish` w handlerze 401 — żadnej pętli redirectów, gdy sesja faktycznie nie wstała (pokazujemy komunikat). (3) Layout **usunięty**, nie zneutralizowany — pełnił wyłącznie rolę strażnika. (4) `src/middleware.ts`: zdjęto `/sprzedaj` z ochrony. **Korekta:** produkcyjny `next build` pokazał `ƒ Proxy (Middleware)` — middleware JEST aktywny w prod (mój lokalny Turbopack-dev go nie zastosował, stąd początkowo błędny wniosek o „martwym" kodzie); rozbieżność dev↔prod → **P15**.
  - **Weryfikacja:** `tsc --noEmit` = 0 błędów; ESLint zmienionych plików = 0 **nowych** zgłoszeń (`page.tsx` czysty). Dev (Turbopack, czysty `.next`): anonim `GET /sprzedaj` → **200** z formularzem i `<h1>` (przedtem 307 → `/auth`); `/panel`/`/admin`/`/auth` bez zmian; anonim `POST /api/dzialki` → **401** `Brak autoryzacji.` (kontrakt, na którym opiera się handler 401).
  - **Build fix (po pierwszym pushu `3f326be`):** Vercel padł na prerenderze `/sprzedaj` — `useSearchParams` w `DzialkaForm` bez `<Suspense>`. Po usunięciu layoutu z `getServerSession` strona przestała być dynamiczna i poszła w statyczny prerender, który wymaga granicy `<Suspense>` (CSR bailout). `next dev` tego nie wychwycił. Naprawione: `DzialkaForm` owinięty w `<Suspense>` w `page.tsx` (wzorzec jak `/auth`). **Lekcja:** punkty zmieniające render/route weryfikować realnym `next build`, nie tylko `next dev`. Potwierdzone: lokalny `next build` `✓ 144/144`, `/sprzedaj` = `○ (Static)`.
  - **UX (po uwadze właściciela):** zamiast nagłego przerzutu na `/auth`, niezalogowany po kliknięciu „Dodaj ogłoszenie" widzi ekran **„Zarejestruj się, aby opublikować ofertę"** (analogiczny do ekranu zakupu pakietu) — z informacją, że dane są zapisane, i przyciskiem „Zaloguj się / Zarejestruj" → `/auth?callbackUrl=/sprzedaj?autopublish=1`. `DzialkaForm.tsx`: stan `pendingLogin`. Zweryfikowane `next build` `✓ 144/144`.
- 2026-06-16 — **SPRINT 3 ukończony (P3 — komparator wyszukiwarki).** „Match info" (dystans/dopasowanie) liczone raz na ofertę zamiast wielokrotnie w pętli sortowania. Zmiana niewidoczna dla użytkownika, czysto wydajnościowa.
  - **Plik:** `app/api/dzialki/route.ts` (`GET`). Nowy `buildSearchContext` — wykrycie miasta/województwa, rozszerzony bbox miasta i oczyszczone frazy liczone RAZ na żądanie (wcześniej te same skany leciały dla każdej oferty). `getSearchMatchInfo` — sygnatura z `(d, query, lat, lng, radius, hasRadius)` na `(d, ctx)`. `matchesLocationText(d, terms)` — frazy przekazywane gotowe. Sekcja `GET`: jeden przebieg `allMatching.map(... getSearchMatchInfo)` → tablica `{ item, info }`; filtr i `ranked.sort(...)` czytają policzone `info` (zero liczenia w komparatorze). Bez aktywnego wyszukiwania `info=null` — pomijamy zbędne liczenie (najczęstszy przypadek: lista domyślna).
  - **Decyzje:** (1) **Zachowanie 1:1** — refaktor czysto wydajnościowy; guard `aInfo && bInfo` w komparatorze odtwarza dawne `group=99` dla pustego zapytania, więc kolejność identyczna. (2) Wyniesienie detekcji miasta/województwa do kontekstu — najtańszy, bezpieczny dodatkowy zysk w tym samym hot-pathie. (3) Zakres trzymany w obrębie P3 — innych punktów nie ruszano.
  - **Złożoność:** liczenie dopasowań `O(n·log n)` → `O(n)`; komparator robi już tylko tanie porównania liczb/grup.
  - **Weryfikacja:** `tsc --noEmit` = 0 błędów; ESLint = 0 **nowych** zgłoszeń (18 istniejących `no-explicit-any` w pliku; licznik `: any` 17→17 bez zmian). **Harness równoważności** (stara vs nowa logika, 120 syntetycznych ofert, 8 scenariuszy × 6 sortowań × 3 okna stronicowania): **144/144 identyczne** (te same `total` i ID na stronie). **Pomiar skali** (~3150 ofert, komparator nieposortowany): **~68 100 → 3 150** wywołań match-info na żądanie (**21,6× mniej**; przewaga rośnie z liczbą ofert — to przejście `n·log n → n`). Skrypty weryfikacyjne były tymczasowe — usunięte po sprawdzeniu (jedyna zmiana w repo to `route.ts`).
- 2026-06-16 — **SPRINT HERO (poza numeracją) ukończony — czytelność sekcji hero na homepage.** Owner wstawił sprint poza roadmapą; wykonany w całości, P4 wraca jako następny. Zakres świadomie wąski: **tylko czytelność istniejących elementów**, BEZ dobudowywania liczników „biur"/„lokalizacji" (decyzja ownera — w hero jest jeden licznik „ofert"; mit o trzech licznikach z opisu sprintu nie pokrywał się z kodem: `HeroCounter` renderuje jeden, dodany w `d37f009`).
  - **Pliki:** `app/page.tsx` (tło hero: `filter: brightness(1.15)` na zdjęciu `/kup.webp` → +15% jasności w zakresie 10–20%; overlay `from-black/58 via-black/48` → `from-black/60 via-black/52` — delikatne pogłębienie środka pod tekstem; `<h1>` + `[text-shadow:0_2px_12px_rgba(0,0,0,0.45)]`), `src/components/HeroCounter.tsx` (podpis „ofert w całej Polsce": `text-[9px]`→`text-[11px]` /+2 px/, `text-white/45`→`text-white`, dodany `text-shadow`; sama liczba: dodany `text-shadow` dla premium-pop).
  - **Decyzje:** (1) Jasność zdjęcia przez `filter: brightness` na samym divie tła — overlay i tekst to osobne warstwy, nietknięte. (2) Net efekt liczony: mimo +2–4 % overlay zdjęcie jest realnie jaśniejsze wszędzie (filtr dominuje), a kontrast tekstu zachowany/lepszy. (3) `text-shadow` zamiast ciężkiego przyciemniania — gwarantuje czytelność nad zdjęciem bez psucia „jaśniejszego" wrażenia (premium). (4) Dobudowy liczników świadomie pominięto (pytanie do ownera → „tylko czytelność, 1 licznik"). Pozostawione jako możliwy późniejszy ruch pod dowód społeczny.
  - **Weryfikacja:** `tsc --noEmit` = 0 błędów; ESLint zmienionych plików = 0 **nowych** zgłoszeń (3 istniejące: `<img>` w kartach 89/551 i `any` w mapie artykułów 537 — poza moimi liniami). Render na żywej bazie (dev :3000, 3206 ofert) + zrzuty **desktop / tablet / mobile**: podpis biały i czytelny we wszystkich, zdjęcie wyraźnie jaśniejsze, liczba wybita cieniem, brak zawijania ani przesunięć układu.
- 2026-06-16 — **SPRINT 4 / P4 ukończony — artykuły bloga w sitemap.** Opublikowane artykuły wchodzą do `/sitemap.xml` jako `/blog/[slug]`; Google dostaje pełną listę treści poradnikowej zamiast samego indeksu `/blog`. (Właściciel nazwał ten sprint „SPRINT 4" i obejmował 3 punkty: sitemap / menu / linkowanie — patrz decyzje niżej.)
  - **Plik:** `app/sitemap.ts` — pojedynczy `await dzialka.findMany` zamieniony na `Promise.all([dzialka.findMany, article.findMany])` (zapytania równolegle, drobny zysk czasu). Dla artykułów: `where: { isPublished: true }`, `select: { slug, updatedAt }`, `orderBy: updatedAt desc`, `take: 5000`. Spread `...articles.map(...)` zaraz po wpisie indeksu `/blog`: `lastModified: article.updatedAt`, `changeFrequency: 'monthly'` (treść evergreen), `priority: 0.6` (poniżej indeksu 0.8 i ofert 0.7 — materiał wspierający).
  - **Decyzje:** (1) **`isPublished: true` w zapytaniu sitemap = lustro warunku ze strony `/blog/[slug]`** (`notFound()` dla niepublikowanych) — zero martwych wpisów/404 dla Googlebota. (2) `Promise.all` zamiast drugiego `await` — równoległe zapytania do DB. (3) **„Blog w menu" świadomie pominięte** — decyzja właściciela: globalne menu zostaje wąskie, skupione na rdzeniu (działki); blog to materiał wspierający, slot w nawigacji rezerwujemy pod „Dla biur"/P9. (4) **„Linkowanie do bloga" przeniesione do nowego P4b** (zrobić subtelnie i kontekstowo, bez nawigacji) — to drugi połowa efektu SEO: sitemap mówi „strony istnieją", linki mówią „są ważne".
  - **Weryfikacja:** `tsc --noEmit` = 0 błędów; ESLint `app/sitemap.ts` = 0 zgłoszeń. Realny render z żywej bazy (dev :3000): `GET /sitemap.xml` → **200**, `application/xml`, **3503 URL-e** w tym **14 opublikowanych artykułów** `/blog/<slug>` (przedtem 0). Spot-check `/blog/dlaczego-bogaci-od-pokolen-kupuja-ziemie` → **200**, `<h1>` = „Dlaczego bogaci od pokoleń kupują ziemię?", brak 404 — wpisy w sitemapie są żywe.
