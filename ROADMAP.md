# TylkoDziałki.pl — Plan działania (ŹRÓDŁO PRAWDY)

> Wspólna mapa. Na starcie **każdego** czatu Claude czyta ten plik, mówi gdzie jesteśmy
> (sekcja „GDZIE JESTEŚMY"), bierze następny punkt, robi go do końca, weryfikuje, aktualizuje
> ten plik (odhacza, dopisuje jednolinijkowiec do „ARCHIWUM", ustawia następny punkt) i proponuje commit.
> Po polsku. Przed większą lub nieodwracalną zmianą najpierw pyta.
> Cel: najlepszy portal działek w Polsce, docelowo produkt wart dziesiątki milionów dolarów.

---

## 🟢 JAK ZACZĄĆ CZAT (wklej to na początku)

```
Czytaj ROADMAP.md w katalogu projektu, to nasz wspólny plan i źródło prawdy.
Trzymaj się sekcji "GWIAZDA PÓŁNOCNA", "FILOZOFIA" i "JAK PRACUJEMY".
Powiedz gdzie jesteśmy (sekcja GDZIE JESTEŚMY), w 1-2 zdaniach co zrobimy, i bierz się za to.
Rób jeden punkt do końca, sprawdź że działa, potem zaktualizuj ROADMAP.md (odhacz,
dopisz jednolinijkowiec do ARCHIWUM, ustaw następny punkt) i zaproponuj commit.
Po polsku. Przed większą lub nieodwracalną zmianą najpierw zapytaj.
```

---

## ⭐ GWIAZDA PÓŁNOCNA (to jedno zdanie decyduje o priorytetach)

**Wartość portalu = płynność. Płynność = gęsta PODAŻ tam, gdzie mamy ruch.**

Twarda diagnoza (2026-07): mamy ~3,15k działek, Otodom ~48k, NieruchomosciOnline ~63k. Jesteśmy 15-20x mniejsi.
Produkt i SEO są już na poziomie dużego portalu (huby, mapa, Schema, „Sprawdź działkę", szybkość 90+).
Ale **cały ten świetny ruch ląduje na zbyt cienkiej podaży** i tam się rozbija. Kupujący wchodzi, widzi 8 ofert
zamiast 80, i wychodzi. Dlatego kolejny etap NIE jest o nowych funkcjach, tylko o jednym: **napełnić portal działkami**.

Trzy dźwignie, w tej kolejności wpływu:
1. **PODAŻ** (P27 i pochodne): więcej biur (CRM) + więcej ogłoszeń od osób prywatnych (łatwy kreator + „dodaj za darmo" jako realny magnes) + saturacja 2-3 regionów.
2. **POPYT** (SEO + blog): już mocny, dokładamy głębię (powiat×typ, cechy) i blog intencyjny, żeby ruch rósł i trafiał na coraz gęstszą podaż.
3. **KONWERSJA I ZAUFANIE**: desktop-kontakt, świeżość ofert, dashboard dla biur. Zamienia ruch w leady, a leady w dowód wartości dla biur (most do monetyzacji).

Monetyzacja świadomie ODŁOŻONA do boomu. Najpierw podaż, ruch, płynność. Pieniądze idą za płynnością, nie odwrotnie.

---

## 📍 GDZIE JESTEŚMY (aktualizuj na końcu każdego czatu)

- **Data:** 2026-07-10.
- **Stan produktu:** ~3,15k działek, ~50 biur. CRM (Galactica, Asari, EstiCRM, domy.pl, IMO) z auto-syncem 2x/dobę + monitoring. Huby SEO woj→miasto→typ→powiat (~550 stron indeksowalnych, thin-content noindex). Schema.org komplet (Product, RealEstateListing, FAQPage, BreadcrumbList w SSR). Szybkość 90+ na mobile na kluczowych stronach. Mapa+lista na `/kup`. Filtry mediów (twarde). „Sprawdź działkę" (ULDK+MPZP+wycena) na produkcji. Alerty na sam e-mail (bez logowania). Kreator dodawania z autofillem GUGiK + auto-zdjęcie z lotu ptaka + auto-tytuł. Jasny motyw. Blog: renderer premium, ~16 artykułów, backlog 100. Panel biura + statystyki + faktury + KSeF + Stripe.
- **AKTUALNY PUNKT (do wyboru, wg priorytetu Gwiazdy Północnej):**
  1. **P27 — Maszyna do podaży** (strategiczny #1). Zacząć od kanału (a) biura albo (b) osoby prywatne.
  2. **P14 dalej — dokończenie lekkiego kreatora** (mniej tarcia = więcej ogłoszeń, wprost karmi P27b).
  3. **P25 — blog intencyjny + linkowanie** (lekkie, domyka P4b, karmi popyt).
  4. **P24 Faza 3 — „Sprawdź tę działkę" na ofercie** (spina narzędzie z ofertami, off-page linki).
- **CRM:** następny Sprint 8 (finalna akceptacja IMO), potem 9-14 (Properly, MediaRent). Szczegóły: [ROADMAP_CRM.md](ROADMAP_CRM.md).

---

## 1. FILOZOFIA (czego NIE podważać bez powodu)

- **Najpierw wzrost, monetyzacja po boomie.** Nie proponować płatności/abonamentów jako priorytetu.
- **Nisza działek, NIE pełny portal.** Zostajemy przy działkach (Otodom robi wszystko, my robimy jedno najlepiej).
- **Kontakt leci prosto na telefon sprzedawcy** (mobile: „Zadzwoń" + SMS z gotową treścią). Bez inboxu na portalu, to celowy wybór. Jedyna luka: desktop (P5).
- **Prostota nad modułami.** Tniemy nawet gotowe funkcje, jeśli nie służą kupującemu. Sceptycyzm wobec info-SEO nie dla kupującego.
- **Uczciwy filtr bije więcej wyników.** Media/uzbrojenie filtrujemy „twardo" (fizycznie na działce), nie „w drodze/możliwość".
- **Wyszukiwarka: mało filtrów domyślnie**, reszta pod „Więcej filtrów". Nie zaśmiecać.
- **Globalne menu wąskie, skupione na działkach.** Blog NIE w top-nav (linkujemy kontekstowo). Wyjątki świadome: „Dla biur" i „Sprawdź działkę" (rdzeń niszy).
- **Bezpieczne poprawki nad ruszaniem danych.** Wolimy nakładkę UI / liczenie z bazy niż masowe migracje istniejących lokalizacji.
- **Precyzję działki ewidencyjnej podaje UŻYTKOWNIK**, nie nasze przybliżone współrzędne (dlatego „Sprawdź działkę" działa, a auto-enrich ofert odrzucony).

## 2. JAK PRACUJEMY (zasady)

> ## 🟥🟥 ŻELAZNA ZASADA #1 — BAZA DANYCH TO ŻYWA PRODUKCJA. NIGDY JEJ NIE RESETUJEMY.
>
> **INCYDENT 2026-07-23:** polecenie `prisma migrate diff` z parametrem `--shadow-database-url`
> wskazującym na ŻYWĄ bazę Neon **wyczyściło całą produkcję** (0 działek, 0 kont). Odzyskane
> w całości przez Neon → Backup & Restore (point-in-time do 16:20). Realna strata danych: 0.
> Ale to była godzina koszmaru i pusta strona na oczach właściciela. **Więcej to się NIE MOŻE zdarzyć.**
>
> Bezwzględne zakazy na bazie (`DATABASE_URL` = żywy Neon `neondb`):
> - ❌ **NIGDY** `--shadow-database-url` z jakimkolwiek prawdziwym URL. Shadow DB jest kasowana przez Prismę.
> - ❌ **NIGDY** `prisma migrate dev`, `migrate reset`, `db push --force-reset`, `migrate deploy`
>   (baza nie ma tabeli `_prisma_migrations` — deploy chciałby aplikować historię od zera).
> - ❌ **NIGDY** `DROP`, `TRUNCATE`, masowy `DELETE` bez `WHERE` przez `db execute`.
> - ✅ **JEDYNY** dozwolony flow zmiany schematu: `prisma migrate diff --from-schema-datamodel <stary plik>
>   --to-schema-datamodel prisma/schema.prisma --script` (czysty diff plik→plik, NIE dotyka bazy) →
>   ręcznie przejrzeć SQL (tylko addytywne: `ADD COLUMN` nullable, `CREATE TABLE`, `ADD VALUE`) →
>   **zapytać Daniela** → `prisma db execute --file <migracja>` → `prisma generate` (najpierw stop `next dev`).
> - ✅ Przed jakąkolwiek operacją na schemacie: rozważyć ręczny **snapshot** w Neon (Backup & Restore → Create snapshot).
> - Szczegóły i pełny opis flow: pamięć `project_db_migrations` + `project_incydent_neon_reset`.

- Po polsku, konkretnie. **ZERO długich myślników** w tekstach na stronę (blog, UI); konkret zamiast „najlepszy/największy portal".
- **Jeden punkt = zwykle jeden czat.** Robimy do końca, weryfikujemy, dopiero potem dalej.
- Przed większą / nieodwracalną zmianą (migracje DB, usuwanie, deploy, rzeczy na zewnątrz) **pytamy**.
- **Definicja ukończenia:** (1) działa i sprawdzone, (2) `[x]` w roadmapie, (3) jednolinijkowiec w ARCHIWUM (data, pliki, decyzja), (4) ustawiony następny punkt, (5) zaproponowany commit.
- **Higiena commitów:** Daniel pracuje równolegle. Commituj tylko swoje pliki przez pathspec, sprawdź cudze zmiany. Push na main deployuje całą historię (web = Vercel auto-deploy; VPS = tylko crm-worker).
- **Migracje:** patrz ŻELAZNA ZASADA #1 wyżej. Skrót: TYLKO `migrate diff` plik→plik (odczyt) + `db execute`. Zakaz shadow-database-url, `migrate dev/deploy/reset`.

## ✍️ BLOG / ARTYKUŁY

System bloga gotowy (renderer react-markdown, spis treści, zielone calloty, generowana okładka OG, Schema Article). Standard i prompt: `docs/BLOG_ARTYKULY.md`. Backlog 100 tematów: `docs/BLOG_PLAN.md` (~16 opublikowanych).

**Workflow:** „nowy artykuł" = daję gotowca W CZACIE (nie do pliku), Daniel wkleja do `/admin/artykuly/nowy`, dodaje miniaturę (prompt z ChatGPT w standardzie, 16:10, zieleń #7aa333, bez tekstu), publikuje. Ja aktualizuję `docs/BLOG_PLAN.md`.

**Twarde zasady:** zdjęcie w treści się NIE pojawia (tylko miniatura na listach); linki wewnętrzne tylko do `/kup`, hubów `/dzialki/...`, powiatów i istniejących artykułów; sprawdzać bazę, żeby nie dublować tematów; przy każdym artykule dołączać prompt do miniatury.

---

# 3. ROADMAPA (wg priorytetu Gwiazdy Północnej)

## 🟥 TIER 0 — PODAŻ (największa dźwignia, tu jest gra)

- [ ] **P27. Maszyna do PODAŻY (priorytet strategiczny #1).** Wąskie gardło całego portalu. Rozbić na konkretne tory i dowozić po jednym:
  - **P27a. Kanał BIUR (więcej integracji CRM).** Każde nowe biuro to setki działek naraz. Ścieżki: (1) dokończyć IMO (CRM Sprint 8) i kolejne systemy (Properly, MediaRent, Sprint 9-14); (2) `/dla-biur` jako lejek pozyskania (żyje, dopracować konwersję i dowód wartości z P16a). Miara sukcesu: liczba aktywnych integracji i suma ofert z CRM.
  - **P27b. Kanał OSÓB PRYWATNYCH.** „Dodaj za darmo" jako realny magnes + lejek z grup FB (Paula). Warunek konieczny: kreator bez tarcia (**P14**), bo łatwość = więcej ogłoszeń. Landing „dodaj działkę za 2 minuty", mierzenie start→publikacja (gdzie odpadają).
  - **P27c. Regionalna SATURACJA (patrz P31).** Zamiast cienko wszędzie, wybrać 2-3 regiony i napełnić je gęsto, żeby ruch SEO lądował na płynnej podaży i budował dowód „tu się znajdzie".
  - Miara nadrzędna całego P27: **liczba aktywnych działek w czasie** (dziś ~3,15k → cel etapowy 10k, potem 25k+). To jedyny wykres, który naprawdę się liczy w tym etapie.
- [ ] **P31. Regionalna saturacja podaży (strategia, nie nowa funkcja).** Wybrać 2-3 województwa/powiaty z najlepszym stosunkiem popyt (GSC: frazy już rankujące) do podaży, i tam skoncentrować pozyskanie biur + prywatnych. Cel: w regionach-flagach mieć gęstość porównywalną z dużymi portalami, żeby „efekt płynności" (kupujący znajduje, więc wraca i poleca) ruszył lokalnie, zanim rozlejemy na całą PL. Wykorzystuje dane, które już mamy (huby powiatów pokazują, gdzie jest podaż, a gdzie dziura).
- [~] **P14. Lekki kreator dodawania (killer dla P27b). CZĘŚCIOWO ZROBIONE.** Zrobione: kolejność kroków (lokalizacja pierwsza), autofill z ULDK/GUGiK (powierzchnia, numer działki, obręb, ścieżka administracyjna), auto-zdjęcie ortofoto GUGiK z obrysem działki na canvasie, auto-tytuł, zł/m² na żywo, krok „Szczegóły" opcjonalny, drag&drop plików, pierwsza warstwa rozbicia monolitu (czyste UI do `src/components/dzialka-form/ui.tsx`). **Zostało:** wydzielenie kroków (location/basics/photos/details/seller) do osobnych komponentów stanowych (refaktor krytycznego formularza, przyrostowo), oraz twarda mierzalność lejka (start→publikacja). [[project-strategia-nisza]]
- [ ] **P32. Samoobsługowe podłączenie CRM dla biura (skaluje P27a).** Dziś onboarding integracji jest ręczny (Daniel zakłada, przekazuje FTP mailem). Docelowo biuro samo z `/dla-biur` wybiera swój system, dostaje instrukcję i dane FTP/endpoint, a integracja startuje bez ręcznej roboty. Zdejmuje Daniela z pętli i pozwala podłączać biura szybciej niż jedno na czat. **Uwaga:** duży punkt, robić dopiero gdy 2-3 kolejne CRM są już domknięte (wzorzec ustabilizowany), inaczej automatyzujemy ruchomy cel.

## 🟧 TIER 1 — TERAZ (największy zwrot poza podażą, ~30 dni)

- [ ] **P5. Desktopowy „Napisz".** Jedyna realna luka kontaktu. Przycisk na ofercie (desktop) → modal → wiadomość leci na telefon/mail sprzedawcy (NIE mailto). Filozofia „bez inboxu" zachowana, łatamy tylko desktop. Wprost podbija liczbę kontaktów = leadów. Follow-up: leady zapisywane do bazy/panelu.
- [ ] **P25. Blog pod frazy intencyjne + linkowanie do kategorii (domyka P4b).** Pisać pod realne pytania kupujących (jak „koszt uzbrojenia", już rankuje), w każdym wpisie linkować do właściwych miast/typów/powiatów i do „Sprawdź działkę". Blog łapie górę lejka i przekazuje moc do stron sprzedażowych. Lekkie, wysokodźwigniowe dla popytu.
- [ ] **P4b. Subtelne wewnętrzne linkowanie do bloga (NIE w menu).** Kontekstowa sekcja „Z bloga / Poradnik" (3 najnowsze na dole homepage i/lub powiązany poradnik na ofercie). Sitemap mówi Google „te strony istnieją", linkowanie mówi „są ważne". Domyka się razem z P25.
- [ ] **P24 Faza 3. Przycisk „Sprawdź tę działkę" na stronie oferty.** Spina narzędzie z ofertami (user potwierdza dokładną lokalizację, nie udajemy precyzji z przybliżonego pinu). Wartość dla kupującego + wewnętrzny ruch do magnesu na backlinki. [[project-sprawdz-dzialke]]
- [ ] **P16b. Sekcja „Statystyki" w panelu biura (styl premium „wow").** Fundament stoi (`BiuroDailyStat` + cron `stats-snapshot` zbierają dzienne dane). Zostaje warstwa „wow": wykresy dzień po dniu (wejścia, telefony, wiadomości) w zieleni marki + duże liczby zbiorcze, liczone tylko dla zalogowanego właściciela. Podbija utrzymanie i wartość postrzeganą (wspiera późniejszą monetyzację za głębię, most z P16a).
- [ ] **P35. Dystrybucja i linki (tor OFF-PAGE, brakująca dźwignia autorytetu).** Cała dotychczasowa roadmapa to on-page (huby, schema, blog, szybkość) i jest zrobiona mocno. Ale żeby przeskoczyć autorytet Otodomu/OLX na frazy z konkurencją, potrzeba LINKÓW z zewnątrz, a ich nie ma jak generować z samego on-page. Mamy idealny magnes („Sprawdź działkę"), brakuje planu jego rozprowadzenia. Tory: (a) posty w grupach FB o działkach i budowie (Paula) oraz na forach z linkiem do narzędzia; (b) mikro-PR „darmowe narzędzie do sprawdzania działek przed zakupem" do lokalnych portali i grup; (c) partnerstwa linkowe z komplementarnymi biznesami (geodeci, projektanci domów, doradcy kredytowi) za wzajemny link lub wpis; (d) katalogi narzędzi i map. Miara: liczba domen linkujących (referring domains) w czasie. Uczciwie: to robota ciągła, nie jednorazowy punkt, i to ona (obok podaży) realnie rusza pozycje na frazy z konkurencją. Domyka wątek „coś nie do skopiowania" z rozmów z Danielem.

## 🟨 TIER 2 — WKRÓTCE (1-3 miesiące)

- [ ] **P22b. Pogłębienie hubów SEO.** Kolejne osie na sprawdzonym, data-driven wzorcu (P21/P22): powiat×typ, gmina, oraz cechy (uzbrojone / z WZ / nad jeziorem). Dobrać brakujące miasta z realnej podaży (analiza: 96 miast łapie 92% podaży). ŻELAZNA ZASADA: generuj stronę tylko z realną treścią; pusta = `noindex` + poza sitemap. Lepiej 1500 gęstych niż 15000 cienkich.
- [ ] **P13b. Rozszerzenie huba: województwo×typ** (`/dzialki/wojewodztwo/[woj]/[typ]`, ~96 mocnych treściowo stron, niski thin-risk) + rozważyć zatrzymanie URL huba zamiast rewrite na `/kup`, oraz przeniesienie breadcrumb JSON-LD do SSR tam, gdzie jeszcze `afterInteractive`.
- [ ] **P10b. Filtr: typ sprzedawcy** (prywatny / biuro) pod „Więcej filtrów". Pole `sprzedajacyTyp` już w bazie, bez migracji. Kupujący często chce „tylko od osób prywatnych".
- [ ] **P29. Świeżość i jakość oferty (zaufanie = konwersja).** Portal za 100M sygnalizuje zaufanie. Zrobione już: nieaktywna oferta pokazuje baner + noindex (P-L), opis sanityzowany (P-J). Do dołożenia (lekko, przyrostowo): widoczny sygnał „ostatnia aktualizacja / świeża oferta", odznaka kompletności danych (oferta z pełnymi polami wygląda pewniej), okresowy sweep ofert-zombie. Cel: kupujący ufa, że to co widzi jest aktualne i realne.
- [ ] **P15. Middleware dev↔prod (weryfikacja na produkcji).** Potwierdzić, że anonim na `/panel` i `/admin` dostaje redirect na `/auth` w prod. Jeśli nie, przenieść `src/middleware.ts` do roota. Dług techniczny, nie blokuje niczego, ale warto zamknąć.

## 🟦 TIER 3 — WIZJA (6-12 mies, horyzont „za 100M", cięcie mile widziane)

> To pomysły ambitne, celowo oznaczone jako opcjonalne. Trzymają się niszy i płynności. Jeśli któryś nie służy wprost podaży/kupującemu, tniemy bez żalu (zasada prostoty).

- [ ] **P30. AI „Co tu zbudujesz?" (różnicownik niszy).** Największa realna wątpliwość kupującego działkę: „czy postawię tu dom i jaki". Mamy już dane z „Sprawdź działkę" (MPZP: funkcja, symbol, max wysokość + WZ/klasa gruntu). Nałożyć na to warstwę, która po polsku odpowiada „na tej działce plan dopuszcza X, max wysokość Y, więc realnie zbudujesz...". To rzecz, której pełny portal nie zrobi (bo nie skupia się na działkach), a my tak. Uczciwie: tam gdzie danych brak, mówimy „sprawdź w gminie", nie zgadujemy.
- [ ] **P33. Mobilne doświadczenie / PWA.** Kupujący przegląda na telefonie. Instalowalny skrót, szybkość app-like, ewentualnie push o nowej ofercie w zapisanym wyszukiwaniu (alerty już mamy e-mailem). Tylko jeśli dane pokażą, że mobile retention jest wąskim gardłem.
- [ ] **P34. Monetyzacja „na półce" (gotowa do włączenia po boomie).** Nie budujemy teraz, ale trzymamy jasne warunki wyzwolenia: (a) wyróżnienia ofert (Stripe już działa) skalują się same; (b) partnerstwa marek (linia B, `/partnerstwo` żyje, model wyłączności + leady, bez programmatic) startują przy pierwszym kliencie; (c) abonamenty biur za GŁĘBIĘ danych/widoczność, dopiero gdy raport leadów (P16) da twardy dowód wartości. Wyzwalacz: płynność w regionach-flagach + mierzalne leady per biuro.
- [ ] **P12b. PostGIS / full-text dla ścieżki tekst/promień** (za zgodą, rusza dane masowo). Rdzeń (P12) już skaluje pod 50k; to optymalizacja mniejszościowej ścieżki. Robić tylko jeśli wyszukiwanie tekstowe stanie się realnym wąskim gardłem. [[feedback-non-destructive-fixes]]
- [ ] **P11b. Przeliczenie współrzędnych pinów z pełnego adresu** (za zgodą). Łagodzenie już wdrożone (znacznik „lokalizacja przybliżona" + okrąg). Docelowe przeliczenie do dokładności sub-km rusza dane, więc tylko świadomie. [[feedback-non-destructive-fixes]]

## ⚪ ODŁOŻONE / ODRZUCONE (świadomie)

- **Monetyzacja/abonamenty B2B** — po boomie (patrz P34).
- **P17. Średnie ceny działek po województwach** — WYCOFANE (prostota strony głównej; zysk SEO niepewny). Może wrócić jako magnes na backlinki, nie jako moduł na główną.
- **P23. Auto-doklejanie danych geoportalu do ofert** — ODRZUCONE (nasze współrzędne przybliżone → zwróciłoby dane sąsiedniej działki; wartość przeniesiona do „Sprawdź działkę"/P24, gdzie precyzję podaje user).
- **P28. Przypomnienia o ulubionych** — ODRZUCONE (ulubione już to załatwiają). Do reaktywacji, gdyby retencja kupujących stała się wąskim gardłem.
- **Inne:** profile biur · recenzje · historia cen · programatyczne SEO · prompt alertu przy 3. ofercie (pasek pod wyszukiwarką wystarcza).

---

# 4. ARCHIWUM ZROBIONEGO (skompresowane; pełne opisy w historii git)

> Jednolinijkowce dla referencji i [[linków]]. Kolejność mniej więcej chronologiczna.

## Fundament i szybkie wygrane
- [x] **P1.** `<h1>` na stronie oferty (`DzialkaClient.tsx`). 2026-06-16.
- [x] **P7.** SSR strony oferty (Prisma bezpośrednio, JSON-LD w HTML serwera, koniec podwójnego fetchu). 2026-06-16.
- [x] **P2.** Zdjęty login-wall z `/sprzedaj` (publiczny formularz, logowanie dopiero przy „Opublikuj", draft przeżywa round-trip przez `?autopublish=1`). 2026-06-16.
- [x] **P3.** Komparator wyszukiwarki: match-info liczone raz na ofertę (`O(n·log n)`→`O(n)`, 21,6× mniej wywołań, 144/144 równoważność). 2026-06-16.
- [x] **P4.** Artykuły bloga do sitemap (`isPublished` → `/blog/[slug]`). 2026-06-16.
- [x] **SPRINT HERO.** Czytelność sekcji hero na homepage (jasność zdjęcia, text-shadow, podpis licznika). 2026-06-16.

## Popyt / SEO
- [x] **P13.** Huby SEO woj→miasto→typ (~438 stron indeksowalnych, thin-content noindex + poza sitemap, liczniki = lista co do sztuki, stare URL `/budowlane` działają, zero migracji). `seoHub.ts`, `HubLinkGrid.tsx`, 4 nowe trasy `app/dzialki/...`.
- [x] **P21.** Głębia stron kategorii site-wide: unikalny blok danych + opis + FAQ z naszej bazy na każdej kategorii >0 ofert, zakresy percentylowe p10-p90, próg małej próbki, pełna odmiana 96 miast (gen/loc), `FAQPage`+`BreadcrumbList` w SSR. `seoCategoryContent.ts`, `FaqSection.tsx`. 2026-06-30.
- [x] **P22.** Oś powiatu data-driven z `locationFull` (powiat z geokodowania, dokładne dopasowanie, 110 stron powiatów w sitemap, mesh woj↔powiat, noindex<4). `seoPowiaty.ts`, `seoPowiatContent.ts`, `app/dzialki/powiat/[powiat]`. 2026-07-01. [[project-locationfull-admin]]
- [x] **P20.** Pełna Schema.org: `RealEstateListing` + `Place`/geo na ofercie (obok `Product`), `FAQPage`+`BreadcrumbList` w SSR na hubach. 2026-07-01.
- [x] **P8.** „Podobne oferty" na ofercie (8 najbliższych po bbox+Haversine, SSR = linki dla Googlebota). `getSimilarDzialki`, `SimilarOffers.tsx`.
- [x] **P9.** `/dla-biur` (strona B2B, licznik biur, formularz→lead na biuro@) + odchudzenie homepage (usunięte „O nas"/„Najnowsze", flow: Wyróżnione→blog→lokalizacje). „DLA BIUR" w menu.

## Wyszukiwarka / mapa / wydajność
- [x] **P10.** Filtry mediów (prąd/woda/kanalizacja/gaz) pod „Więcej filtrów", twardy uczciwy filtr (tylko fizycznie na działce), zapis w URL `?media=`. [[feedback-filtry-twarde]]
- [x] **P11.** Mapa + lista na `/kup` (split jak Otodom): piny z ceną, zielone klastry, ciemny popup, „szukaj w tym obszarze" (bbox), mapa lazy/opt-in. `KupMap.tsx`.
- [x] **P11 fix.** Naprawa pinów poza Polską (parser ASARI mylił „szerokość/długość działki" ze współrzędnymi; 143 oferty, wspólna bramka `sanitizePlCoords`). 2026-06-18.
- [x] **P12.** Silnik listy `/kup` w bazie (paginacja+sort+count zamiast całej tabeli do Node, 3 indeksy złożone, 19,6× szybciej / 163× mniej wierszy, 294/294 równoważność). `dzialkiQuery.ts`.
- [x] **SPRINT SZYBKOŚCI.** Mobile 90+ na kluczowych stronach: hero przez `next/image priority` (lekkie źródła), licznik serwerowy, Google Maps + mapa lazy, ISR na głównej, CLS `/kup` 0,002, wyróżnione zdjęcia lazy, skasowane ciężkie webp (~7 MB z repo). 2026-06-30. [[project-lightningcss-gotcha]] [[project-hero-art-direction]]

## Narzędzie „Sprawdź działkę" i dodawanie
- [x] **P24 Faza 1.** Narzędzie `/sprawdz-dzialke`: ULDK/GUGiK (obrys+metraż+numer+administracja) + wycena z naszych ofert + przykładowy raport SSR + sitemap. `uldk.ts`, `app/api/sprawdz-dzialke`, `src/components/sprawdz/`. 2026-07-01.
- [x] **P24 Faza 2.** MPZP z KIMPZP (WMS GetFeatureInfo: funkcja, symbol, plan, max wysokość) + nakładka „Plan miejscowy"; brak planu → „obowiązuje WZ" + link. Redesign premium + bramka logowania. 2026-07-01.
- [x] **P24 repozycja.** Wyszłe z górnego menu (prostota rdzenia; potem WRÓCIŁO 2026-07-05 dla discoverability), hero-zdjęcie, zjazd do raportu, pole „obręb i numer". PDF najpierw dodany, potem USUNIĘTY. [[project-sprawdz-dzialke]]
- [x] **P14 (część).** Kreator dodawania: autofill ULDK, auto-zdjęcie ortofoto GUGiK z obrysem na canvasie, auto-tytuł, lokalizacja pierwsza, zł/m² na żywo, krok szczegóły opcjonalny, drag&drop, pierwsza warstwa rozbicia monolitu. 2026-07-04/05. [[project-geocoding-cost-incident]]
- [x] **Sesja 2026-07-10 (dopieszczenia).** Deep-linki hubów: `KupSearch` w `seoMode` bierze filtry ze strony huba (koniec „cała Polska" na wejściu z Google), wyszukiwarka startuje zwinięta. „Sprawdź działkę": minimalna wyszukiwarka jak `/kup`, sekcja „Co dostajesz" od lewej, mapa na cały ekran + geokodowanie adresu. Dodawanie: mapa na cały ekran z zielonego przycisku. MPZP: parser rozumie 3 formaty (ROW, INSPIRE, schematy gmin) + pola „Obowiązuje od" i „Uchwała" (koniec fałszywego „brak planu"). Oferta: pre-fill wyszukiwarki miejscowością („Więcej działek: [miasto]"). `KupSearch.tsx`, `SprawdzSearch.tsx`, `Raport.tsx`, `mpzp.ts`, `LocationPicker.tsx`, `DzialkaClient.tsx`.

## Leady / alerty / retencja
- [x] **P6.** Alerty e-mail o nowych działkach (zapisane wyszukiwanie → mail, odporne na re-sync CRM, cron `alert-emails` na VPS). Wspólne `dzialkiSearch.ts`.
- [x] **P26.** Alerty na sam e-mail bez logowania (double opt-in; zalogowany = 1 klik na konto; migracja `OfferAlert` na żywej Neon). 2026-07-04. [[feedback-alerty-email-first]]
- [x] **P16a.** Raport leadów per biuro `/admin/statystyki` (duże liczby, okna 7/30 dni, ranking; `BiuroDailyStat` + cron `stats-snapshot`). 2026-06-21. [[project-stats-snapshot]]
- [x] **DROBNE.** Logo biur bez ramki/kafla, wprost na tle (`OfficeLogo.tsx`, mniej requestów). 2026-06-30.

## Motyw / marka / treści
- [x] **Jasny motyw** wdrożony na produkcję (`:root` jasny #f6f7f3, ciemny pod `[data-theme=dark]`, zieleń #7aa333, logo-obrazek, tokeny Tailwind v4). 2026-06-19. [[project-light-theme]]
- [x] **Blog premium** Faza 1+2 (renderer react-markdown, karty 16:10, Schema Article, okładka OG, spis treści). [[project-blog-premium]]
- [x] **Bezpieczeństwo/jakość ofert:** opis sanityzowany + XSS zamknięty (P-J), mapowanie mediów woda/gaz „w drodze" (P-K), nieaktywna oferta = baner + ukryty kontakt + noindex (P-L). 2026-06-20/22.
- [x] **`/partnerstwo`** żyje (statyczna, zbiera zgłoszenia na biuro@; struktura serwowania reklam odłożona do 1. klienta). [[project-monetyzacja-partnerstwo]]

## CRM (szczegóły w [ROADMAP_CRM.md](ROADMAP_CRM.md))
- [x] **Sprint 1-3.** Audyt integracji · auto-sync (cron VPS 2x/dobę przez kolejkę+worker) · monitoring `/admin/crm`.
- [x] **Sprint 6-7.** IMO CRM: analiza (format = domy.pl/Oferty.net) + implementacja silnika (R-A/R-B/R-C w `domypl-sync.ts` tylko dla IMOX, ścieżka Galactiki bit w bit).
- [~] **Sprint 8.** IMO testy: silnik potwierdzony na produkcji (47/47 dodawanie + sprzedaż/wynajem, 47 deactivate różnicowe). Zostaje finalna akceptacja IMO.
- [x] **Poprawki CRM:** miasta na prawach powiatu (P-H), struktura kontenera `<dzial>` (P-I), EstiCRM pełny vs przyrostowy ZIP (P-F), incydent kosztowy Geocoding (reużyj lat/lng z bazy). [[project-geocoding-cost-incident]]

---

## 5. KLUCZOWE LEKCJE (żeby nie powtarzać błędów)

- **Mierz, zanim naprawisz.** Przy szybkości: bez zdjęcia LCP dalej 7,8 s → winowajcą była kliencka karta, nie obraz. Test obnaża prawdziwą przyczynę.
- **Test na realnym feedzie, nie syntetycznym.** IMO: syntetyk dawał fałszywe 9/9; realny plik obnażył kontener `<dzial>` jako rodzica oferty (P-I).
- **Zmiana parsera CRM = `git pull` + `pm2 restart crm-worker` na VPS**, inaczej autosync nadpisuje poprawki starym kodem.
- **Punkty zmieniające render/route weryfikuj realnym `next build`, nie tylko `next dev`** (Turbopack przepuszcza błędy prerenderu i middleware).
- **Płatne API pod kontrolą:** auto-sync re-geokodował całą bazę co dobę (~60 zł/dzień). Reużywaj współrzędnych z bazy; ustaw quota + budżet w GCP. [[project-geocoding-cost-incident]]
- **Tailwind v4 / Lightning CSS** po cichu wycina reguły z `calc()`+`var()` w alfie koloru. `var()` trzymaj poza kolorem. [[project-lightningcss-gotcha]]
