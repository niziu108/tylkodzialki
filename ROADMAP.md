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
- Planowana osobna zakładka **„Dla biur"** + odchudzenie sekcji „O nas" na homepage.

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
- [ ] **P3. Napraw komparator wyszukiwarki** — policz „match info" (dystans/dopasowanie) raz na ofertę, potem sortuj. Teraz liczone wielokrotnie w pętli sortowania.
  Gdzie: `app/api/dzialki/route.ts` (funkcja `GET`, sekcja `filtered.sort(...)`).
- [ ] **P4. Artykuły bloga do sitemap.**
  Gdzie: `app/sitemap.ts` (dodać `prisma.article.findMany` → `/blog/[slug]`).

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

- **AKTUALNY PUNKT: P3** (napraw komparator wyszukiwarki — policz „match info" raz na ofertę zamiast w pętli `sort`; szybkość działania przy rosnącej liczbie ofert)
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
