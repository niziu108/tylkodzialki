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
- [ ] **P2. Zdejmij login-wall z `/sprzedaj`.** Formularz publiczny, logowanie/rejestracja dopiero przy „Opublikuj".
  Gdzie: `app/sprzedaj/page.tsx` (teraz `redirect("/auth")`); `src/components/DzialkaForm.tsx`; POST w `app/api/dzialki/route.ts`.
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

### ⚪ ODŁOŻONE (świadomie, nie teraz)
Monetyzacja/abonamenty B2B (po boomie) · profile biur · jasny motyw (kiedyś A/B) · recenzje · historia cen · programatyczne SEO.

---

## 4. DZIENNIK (status i decyzje)

- **AKTUALNY PUNKT: P2** (zdejmij login-wall z `/sprzedaj` — bezpośrednio zwiększa podaż ofert)
- 2026-06-16 — Powstał plan. Roadmapa ustalona i przedyskutowana (audyt + uwagi właściciela). Start od P1.
- 2026-06-16 — **SPRINT 1 ukończony (P1 + P7).** Strona oferty renderowana po stronie serwera — Google dostaje pełny HTML, nie pustą ramkę.
  - **Pliki:** `src/lib/dzialki.ts` (nowy helper `getDzialkaById`: Prisma + `cache()`, jedno źródło prawdy), `app/api/dzialki/[id]/route.ts` (używa helpera, odpowiedź bez zmian), `app/dzialka/[id]/page.tsx` (SSR przez Prisma, JSON-LD w HTML serwera, `initial` → klient, `revalidate=60`), `app/dzialka/[id]/DzialkaClient.tsx` (przyjmuje `initial`, koniec podwójnego fetchu, tytuł `<div>`→`<h1>`).
  - **Decyzje:** (1) ISR `revalidate=60` zamiast „force-dynamic" — szybkość dla użytkownika i Googlebota, dane świeże do 60 s. (2) Sortowanie po cenie z litery P1 świadomie pominięte (usunięte celowo `44f511a`, kosmetyka). (3) `key={id}` na kliencie — czysty remount przy zmianie oferty, bez stale state.
  - **Weryfikacja:** `tsc --noEmit` = 0 błędów; realny render z serwera (curl na żywej bazie): `<h1>` = 1 z tytułem oferty, JSON-LD `Product` w źródle, brak skeletonu, treść (Cena/Powierzchnia) w HTML.
