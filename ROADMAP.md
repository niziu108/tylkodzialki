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

Twarda diagnoza (2026-08): mamy ~7,2k działek, Otodom ~48k, NieruchomosciOnline ~63k. Byliśmy 15-20x mniejsi, jesteśmy ~7-9x. Podaż podwoiła się w 6 tygodni (sieci franczyzowe: jedno RE/MAX = 807 działek).
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

- **Data:** 2026-09-02.
- **Stan produktu:** **7 166 aktywnych działek** (licznik produkcyjny 2026-08-27; spadek z 8 277 to skutek backfillu usunięć Galactiki i wygaszania sprzedanych, czyli podaż jest teraz UCZCIWA), **113+ biur z ofertami**, największe źródło: RE/MAX Polska (~807 działek jednym podłączeniem, od 2026-08-21). CRM (Galactica, Asari, EstiCRM, domy.pl, IMO) z auto-syncem **co 2 h** + monitoring. Huby SEO woj→miasto→typ→powiat (~550 stron indeksowalnych, thin-content noindex), od 2026-08-28 z pierwszą stroną ofert w SSR (wcześniej ich HTML nie zawierał ani jednego linku do oferty). Schema.org komplet (Product, RealEstateListing, FAQPage, BreadcrumbList w SSR). Szybkość 90+ na mobile na kluczowych stronach. Mapa+lista na `/kup`. Filtry mediów (twarde). „Sprawdź działkę" (ULDK+MPZP+wycena) na produkcji. Alerty na sam e-mail (bez logowania). Kreator dodawania z autofillem GUGiK + auto-zdjęcie z lotu ptaka + auto-tytuł. Jasny motyw. Blog: renderer premium, **67 artykułów**, backlog 100. Panel biura + statystyki + faktury + KSeF + Stripe. Podgląd popytu w adminie: `/admin/powiadomienia` (alerty kupujących + rozkład po miastach).
- **AKTUALNY PUNKT (do wyboru, wg priorytetu Gwiazdy Północnej):**
  0. **P38 — narzędzie jako lejek (w toku od 2026-09-02).** Zrobione B1 (sekcja „Co dostajesz" jako sześć pytań kupującego), B2 (przykładowy raport pod narzędziem), C1 (sekcja na stronie głównej, nad blogiem) i pierwsza część C2 (ceny transakcyjne z RCN w raporcie). Następne: **dokończyć skan RCN na VPS** (1297 z 7216 ofert), potem strony powiatowe z cenami transakcyjnymi i C3 (dystrybucja, wpina się w P35).
  1. **P27 — Maszyna do podaży** (strategiczny #1). Zacząć od kanału (a) biura albo (b) osoby prywatne.
  2. **P37 — Twarz i wideo** (w toku od 2026-08-27): wysłane/do wysłania maile do twórców (Midel, Luka), równolegle szukanie wykonawcy kanału faceless. Przekaz = marketplace „kup i sprzedaj działkę", NIE „Sprawdź działkę".
  3. **P14 dalej — dokończenie lekkiego kreatora** (mniej tarcia = więcej ogłoszeń, wprost karmi P27b).
  4. **P25 — blog intencyjny + linkowanie** (lekkie, domyka P4b, karmi popyt).
  5. **P24 Faza 3 — „Sprawdź tę działkę" na ofercie** (spina narzędzie z ofertami, off-page linki).
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
  - Miara nadrzędna całego P27: **liczba aktywnych działek w czasie** (dziś ~7,2k → cel etapowy 15k, potem 25k+). To jedyny wykres, który naprawdę się liczy w tym etapie.
- [ ] **P31. Regionalna saturacja podaży (strategia, nie nowa funkcja).** Wybrać 2-3 województwa/powiaty z najlepszym stosunkiem popyt (GSC: frazy już rankujące) do podaży, i tam skoncentrować pozyskanie biur + prywatnych. Cel: w regionach-flagach mieć gęstość porównywalną z dużymi portalami, żeby „efekt płynności" (kupujący znajduje, więc wraca i poleca) ruszył lokalnie, zanim rozlejemy na całą PL. Wykorzystuje dane, które już mamy (huby powiatów pokazują, gdzie jest podaż, a gdzie dziura).
- [~] **P14. Lekki kreator dodawania (killer dla P27b). CZĘŚCIOWO ZROBIONE.** Zrobione: kolejność kroków (lokalizacja pierwsza), autofill z ULDK/GUGiK (powierzchnia, numer działki, obręb, ścieżka administracyjna), auto-zdjęcie ortofoto GUGiK z obrysem działki na canvasie, auto-tytuł, zł/m² na żywo, krok „Szczegóły" opcjonalny, drag&drop plików, pierwsza warstwa rozbicia monolitu (czyste UI do `src/components/dzialka-form/ui.tsx`). **Zostało:** wydzielenie kroków (location/basics/photos/details/seller) do osobnych komponentów stanowych (refaktor krytycznego formularza, przyrostowo), oraz twarda mierzalność lejka (start→publikacja). [[project-strategia-nisza]]
- [ ] **P32. Samoobsługowe podłączenie CRM dla biura (skaluje P27a).** Dziś onboarding integracji jest ręczny (Daniel zakłada, przekazuje FTP mailem). Docelowo biuro samo z `/dla-biur` wybiera swój system, dostaje instrukcję i dane FTP/endpoint, a integracja startuje bez ręcznej roboty. Zdejmuje Daniela z pętli i pozwala podłączać biura szybciej niż jedno na czat. **Uwaga:** duży punkt, robić dopiero gdy 2-3 kolejne CRM są już domknięte (wzorzec ustabilizowany), inaczej automatyzujemy ruchomy cel.

## 🟧 TIER 1 — TERAZ (największy zwrot poza podażą, ~30 dni)

- [ ] **P5. Desktopowy „Napisz".** Jedyna realna luka kontaktu. Przycisk na ofercie (desktop) → modal → wiadomość leci na telefon/mail sprzedawcy (NIE mailto). Filozofia „bez inboxu" zachowana, łatamy tylko desktop. Wprost podbija liczbę kontaktów = leadów. Follow-up: leady zapisywane do bazy/panelu.
- [ ] **P25. Blog pod frazy intencyjne + linkowanie do kategorii (domyka P4b).** Pisać pod realne pytania kupujących (jak „koszt uzbrojenia", już rankuje), w każdym wpisie linkować do właściwych miast/typów/powiatów i do „Sprawdź działkę". Blog łapie górę lejka i przekazuje moc do stron sprzedażowych. Lekkie, wysokodźwigniowe dla popytu.
- [ ] **P4b. Subtelne wewnętrzne linkowanie do bloga (NIE w menu).** Kontekstowa sekcja „Z bloga / Poradnik" (3 najnowsze na dole homepage i/lub powiązany poradnik na ofercie). Sitemap mówi Google „te strony istnieją", linkowanie mówi „są ważne". Domyka się razem z P25.
- [ ] **P24 Faza 3. Przycisk „Sprawdź tę działkę" na stronie oferty.** Spina narzędzie z ofertami (user potwierdza dokładną lokalizację, nie udajemy precyzji z przybliżonego pinu). Wartość dla kupującego + wewnętrzny ruch do magnesu na backlinki. [[project-sprawdz-dzialke]]
- [~] **P38. „Sprawdź działkę" jako lejek, nie jako zakładka (tor B+C). W TOKU od 2026-09-02.** Narzędzie jest gotowe i mocne (ULDK + MPZP + plan ogólny gminy + wycena z ofert + trend), doszło do tego zbieranie **cen transakcyjnych z RCN** (`src/lib/rcn.ts`, `npm run rcn:backfill`, [[project_rcn_ceny_transakcyjne]]). Problem nie leży w danych, tylko w tym, że narzędzie się nie sprzedaje (strona wyliczała funkcje) i że z głównej nikt go nie widzi. Kroki:
  - [x] **B1. Copy sekcji „Co dostajesz w raporcie".** Sześć pytań kupującego zamiast listy funkcji, plan ogólny gminy dopisany (był w raporcie, brakowało go na stronie), CTA z kotwicą do pola. 2026-09-02.
  - [x] **B2. Przykładowy raport pod narzędziem.** Prawdziwa i PUSTA działka (Rzgów pod Łodzią, 1498 m², plan miejscowy „tereny zabudowy mieszkaniowej jednorodzinnej"), stoi dokładnie tam, gdzie pojawi się wynik użytkownika, i znika z chwilą sprawdzania. Brak zabudowy to kryterium, nie przypadek: kupujący szuka działki, na której nic nie stoi, więc demo z cudzym domem myli przekaz. Kandydatów ogląda się na ortofoto (`scripts/demo-ortofoto.ts`), bo warstwa „budynki" w KIEG nie odpowiada na takie pytanie. Podział danych: rejestrowe (ULDK/MPZP/plan ogólny) zamrożone w `demoRaport.ts`, ceny i oferty liczone na żywo z naszej bazy. 2026-09-02.
  - [x] **C1. Sekcja „Sprawdź działkę" na stronie głównej.** Blok przeniesiony spod bloga zaraz za „Wyróżnione oferty", copy z języka rejestrów na pytanie kupującego („Masz na oku konkretną działkę?"), pod przyciskiem lista „W raporcie znajdziesz" (6 haseł). Jeden przycisk zamiast drugiego pola tekstowego: na górze stoi wyszukiwarka ofert i dwa pola na jednym ekranie myliłyby. 2026-09-02.
  - [~] **C2. Ceny transakcyjne widoczne dla kupującego. PIERWSZA CZĘŚĆ ZROBIONA 2026-09-02.** Plan zmieniony po policzeniu danych: agregatów gminnych DZIŚ zrobić się nie da (po odsianiu: 1256 użytecznych transakcji, z ostatnich 24 mies. tylko 435, w 72 powiatach, z czego 13 ma ≥10; gmin w Polsce jest ~2500, więc strony gminne = thin content, a tabela trzyma kod powiatu, nie gminy). Zamiast tego ceny z aktów notarialnych trafiły tam, gdzie ruch już jest:
    - [x] **Sekcja „Ile realnie płacono w okolicy" w raporcie.** Mediana zł/m² z RCN + widełki p25-p75 + zestawienie z ceną ofertową („chcą o 35% więcej niż mediana zapłaconych"). Pule rozdzielone (budowlane vs rolne, `klasaTransakcji`), próg 5 aktów, drabinka promieni 10/20/35 km, okno 24 mies. Poniżej progu sekcji nie ma. `src/lib/rcnStats.ts` + testy. 2026-09-02.
    - [ ] **Dokończyć zbieranie:** przeskanowane 1537 z 7216 ofert (stan 2026-09-02, podgląd: `npm run rcn:stan`). Tempo ~3 oferty/min, więc reszta to ~30 h ciągłej pracy → przenieść `npm run rcn:backfill -- --apply` na VPS (obok crm-workera), nie trzymać na laptopie.
    - [x] **Copy i wygląd wejścia (2026-09-02).** Zniknęły powtórzone przyciski „Sprawdź swoją działkę" (pole jest w hero); na głównej nagłówek bez zakładania roli („Sprawdź dowolną działkę w Polsce", bo korzysta z tego też pośrednik i deweloper), krótszy lead i `ScrollFill` jak pod „Wiedzą o działkach".
    - [x] **Plan miejscowy: ustalone, ile się da (2026-09-02).** Krajowa integracja dostaje od gmin TYLKO symbol, opis, numer uchwały, datę i status. Parametrów zabudowy tam NIE MA (sprawdzone na 10 gminach), nazwy plików rysunku i uchwały są bez adresu, a warstwa rysunków nie renderuje się w kadrze działki (dopiero od ~±10 km). Raport mówi więc wprost, że parametry są w tekście uchwały, i linkuje do jego wyszukania. Parametry (wysokość, powierzchnia zabudowy, biologicznie czynna) mamy z PLANU OGÓLNEGO gminy i to pokrycie rośnie samo.
    - [ ] **Strony powiatowe/gminne z cenami transakcyjnymi** — dopiero gdy próbka to udźwignie (próg ~15 aktów na stronę z 24 mies., poniżej `noindex` i poza sitemap). Raport per działka i tak zostaje `noindex`.
  - [ ] **C3. Gdzie to reklamować** (wpina się w P35: grupy FB, fora, mikro-PR, katalogi narzędzi).
- [ ] **P16b. Sekcja „Statystyki" w panelu biura (styl premium „wow").** Fundament stoi (`BiuroDailyStat` + cron `stats-snapshot` zbierają dzienne dane). Zostaje warstwa „wow": wykresy dzień po dniu (wejścia, telefony, wiadomości) w zieleni marki + duże liczby zbiorcze, liczone tylko dla zalogowanego właściciela. Podbija utrzymanie i wartość postrzeganą (wspiera późniejszą monetyzację za głębię, most z P16a).
- [ ] **P35. Dystrybucja i linki (tor OFF-PAGE, brakująca dźwignia autorytetu).** Cała dotychczasowa roadmapa to on-page (huby, schema, blog, szybkość) i jest zrobiona mocno. Ale żeby przeskoczyć autorytet Otodomu/OLX na frazy z konkurencją, potrzeba LINKÓW z zewnątrz, a ich nie ma jak generować z samego on-page. Mamy idealny magnes („Sprawdź działkę"), brakuje planu jego rozprowadzenia. Tory: (a) posty w grupach FB o działkach i budowie (Paula) oraz na forach z linkiem do narzędzia; (b) mikro-PR „darmowe narzędzie do sprawdzania działek przed zakupem" do lokalnych portali i grup; (c) partnerstwa linkowe z komplementarnymi biznesami (geodeci, projektanci domów, doradcy kredytowi) za wzajemny link lub wpis; (d) katalogi narzędzi i map. Miara: liczba domen linkujących (referring domains) w czasie. Uczciwie: to robota ciągła, nie jednorazowy punkt, i to ona (obok podaży) realnie rusza pozycje na frazy z konkurencją. Domyka wątek „coś nie do skopiowania" z rozmów z Danielem.

- [ ] **P37. Twarz i wideo (kupiona dystrybucja, tor równoległy do P35).** Decyzja 2026-08-27: **nikt z zespołu nie występuje przed kamerą** (ani Daniel, ani Paula), twarz kupujemy na zewnątrz, a produkcję zlecamy. Cel: wypchnąć kategorię „działka" do mainstreamu i zbudować rozpoznawalność portalu jako miejsca, gdzie się działkę **kupuje i sprzedaje**. ŻELAZNA ZASADA PRZEKAZU: bohaterem komunikacji jest **marketplace** (7 tys. działek, kup/sprzedaj), a NIE „Sprawdź działkę" (to dodatek, nie produkt). Tory:
  - **P37a. Twarz kontraktowa.** Długi kontrakt (24 mies., 2 materiały/mies.), tematy i research po naszej stronie, wynagrodzenie stała + bonus od wyników, wyłączność na kategorię (nie promuje konkurencyjnego portalu). Target #1: **Kuba Midel** (publiczność inwestycyjna, kapitał, naturalna kontra „działka to nie kawalerka"). Target #2: **Luka Trochonowicz** (zasięg mainstream ~630 tys., potencjał zmiany mody, nie sprzedaży bezpośredniej).
  - **P37b. Kanał faceless do zlecenia.** 8-12 rolek/mies. montowanych z naszych danych (oferta, cena, zł/m², okolica, co można zbudować), lektor + montaż u freelancera. Zero udziału zespołu przed kamerą, zero czekania na influencera. Tańsze i uruchamialne od zaraz, karmi też P35.
  - **P37c. Mierzalność.** Osobny link/UTM per twórca i per format. Liczymy **wejścia i zapytania**, nie wyświetlenia. Bez tego nie przedłużamy żadnej umowy.
  - Uczciwie: to jedyny punkt roadmapy, gdzie **płacimy za ruch zamiast go zarabiać**. Dlatego warunkiem wejścia jest umowa z klauzulą wyników i wyłącznością, a nie „opłata za sławę".

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
- [ ] **P36. Land Intelligence — historia cen działki (MOAT DANYCH, horyzont korzystania 3-4 mies.).** Fundament „warstwy danych o gruntach", której nikt w PL nie zbiera, i głowny wątek „nie do skopiowania head start" z rozmowy strategicznej 2026-08-17. ZACZĘLIŚMY ZBIERAĆ 2026-08-17 (dane historyczne są nieodtwarzalne wstecz, więc zbieramy OD ZARAZ): tabela `DzialkaPriceSnapshot` (change-log per oferta) + zapis w cronie `stats-snapshot` (23:00). Etapy: (1) [ZROBIONE] zbieranie + sekcja „Historia ceny" na ofercie pod kwotą (spadek = zielony sygnał okazji dla kupującego, np. „Cena niższa o 8% niż 27 lipca"; tylko przy 2+ punktach i realnej zmianie ≥1%, wzrost wygaszony; uczciwość); (2) za ~3-4 mies., gdy uzbiera się historia: agregaty trendu median po regionach na strony `/ceny` (mamy już `CityPriceDailyStat`) + wykres/sparkline trendu na ofercie; (3) docelowo raporty i narzędzia inwestora/dewelopera (płatne PO boomie, patrz P34). [[project_price_history]]
- [ ] **P12b. PostGIS / full-text dla ścieżki tekst/promień** (za zgodą, rusza dane masowo). Rdzeń (P12) już skaluje pod 50k; to optymalizacja mniejszościowej ścieżki. Robić tylko jeśli wyszukiwanie tekstowe stanie się realnym wąskim gardłem. [[feedback-non-destructive-fixes]]
- [ ] **P11b. Przeliczenie współrzędnych pinów z pełnego adresu** (za zgodą). Łagodzenie już wdrożone (znacznik „lokalizacja przybliżona" + okrąg). Docelowe przeliczenie do dokładności sub-km rusza dane, więc tylko świadomie. [[feedback-non-destructive-fixes]]

## ⚪ ODŁOŻONE / ODRZUCONE (świadomie)

- **Monetyzacja/abonamenty B2B** — po boomie (patrz P34).
- **P17. Średnie ceny działek po województwach** — WYCOFANE (prostota strony głównej; zysk SEO niepewny). Może wrócić jako magnes na backlinki, nie jako moduł na główną.
- **P23. Auto-doklejanie danych geoportalu do ofert** — ODRZUCONE (nasze współrzędne przybliżone → zwróciłoby dane sąsiedniej działki; wartość przeniesiona do „Sprawdź działkę"/P24, gdzie precyzję podaje user).
- **P28. Przypomnienia o ulubionych** — ODRZUCONE (ulubione już to załatwiają). Do reaktywacji, gdyby retencja kupujących stała się wąskim gardłem.
- **Inne:** profile biur · recenzje · programatyczne SEO · prompt alertu przy 3. ofercie (pasek pod wyszukiwarką wystarcza). (Historia cen: PRZESTAŁA być odrzucona — robimy ją jako P36, zaczęliśmy 2026-08-17.)

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
- [x] **P38 B1.** Sekcja „Co dostajesz w raporcie" na `/sprawdz-dzialke` przepisana z listy funkcji na sześć pytań kupującego („Czy postawisz tu dom?", „Ile ta ziemia jest naprawdę warta?"), dopisany plan ogólny gminy i obszar uzupełnienia zabudowy, na końcu CTA z kotwicą `#narzedzie` do pola. `app/sprawdz-dzialke/page.tsx`, `SprawdzSearch.tsx`. 2026-09-02.
- [x] **P38 B2.** Przykładowy raport pod narzędziem: prawdziwa PUSTA działka w Rzgowie pod Łodzią (1498 m², MPZP „zabudowa mieszkaniowa jednorodzinna", sąsiad z gotowym domem), w miejscu przyszłego wyniku, z banerem „To nie jest Twoja działka" i etykietą „Przykładowa działka"; znika, gdy user zacznie sprawdzać swoją. Dane rejestrowe zamrożone (`demoRaport.ts` + `npm run demo:zamroz`), ceny/trend/oferty na żywo z bazy w SSR. `app/sprawdz-dzialke/page.tsx`, `SprawdzSearch.tsx`, `Raport.tsx`. 2026-09-02.
- [x] **P38 C1.** „Sprawdź działkę" na stronie głównej wysoko (spod bloga zaraz za „Wyróżnione oferty"): „Masz na oku konkretną działkę?" + przycisk + lista „W raporcie znajdziesz" (konkret dla czytającego i realne frazy na głównej dla Google). Ptaszek marki wydzielony do `src/components/CheckIcon.tsx` i współdzielony z `/sprawdz-dzialke`. `app/page.tsx`. 2026-09-02.
- [x] **P38 C2 (część 1).** Ceny TRANSAKCYJNE z RCN w raporcie „Sprawdź działkę": mediana zł/m² z aktów notarialnych + widełki p25-p75 + zdanie zestawiające z ceną ofertową. Pule rozdzielone (budowlane vs rolne — grunt rolny szedł po ~7 zł/m², działka pod dom po ~100, więc wspólna mediana kłamałaby), próg 5 aktów, promienie 10/20/35 km, okno 24 mies. Plan stron gminnych ODŁOŻONY po policzeniu próbki (435 transakcji z 24 mies. na ~2500 gmin). `src/lib/rcnStats.ts`, `Raport.tsx`, `app/api/sprawdz-dzialke/route.ts`. 2026-09-02.
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

## Wrzesień 2026 (podaż z reklam w CRM)
- [x] **Czujka nowych biur na drop-zonie FTP** (2026-09-02). Galactica i ASARI mają nas jako portal predefiniowany, więc biuro klika eksport u siebie, a jego CRM zakłada NOWY katalog na wspólnym koncie FTP. Silnik importu chodzi wyłącznie po katalogach z `CrmIntegration.ftpRemotePath`, więc taki katalog mógł leżeć tygodniami i nikt by go nie zaimportował (biuro widzi ciszę i uznaje, że portal nie działa). Skan wszystkich 74 kont wykrył `/ckdom` na koncie `asari@`: CKDOM PRIME REAL ESTATE z Radomia, paczka z 25.06.2026, zero integracji w bazie. Sprawa znana Danielowi (dzwonił, biuro po prostu nie wysłało eksportu), więc to nie było przeoczenie po naszej stronie. `scripts/crm-ftp-nowe-biura.ts`, tylko odczyt: odsiewa katalogi zdjęć ASARI i konta obsługiwane od roota, sortuje po świeżości ostatniego pliku, `--mail` wysyła powiadomienie na `CRM_ALERT_EMAIL` tylko gdy coś znajdzie. **Cron ODRZUCONY** (decyzja 2026-09-02): narzędzie zostaje do odpalenia z ręki, `npx tsx scripts/crm-ftp-nowe-biura.ts --all`, gdy będzie potrzeba sprawdzić drop-zone. **Zostaje do sprawdzenia:** 2 integracje Galactiki, które nigdy nic nie zaimportowały (CNP Bytom, Nieruchomości Częstochowa).
- [x] **`/dla-biur` przestawione na zimny ruch z reklam** (2026-09-02). Strona była pisana pod biuro, do którego Daniel już zadzwonił, a reklama u Galactiki i ASARI przyprowadzi kogoś, kto nas nie zna i zadaje trzy pytania: ile to kosztuje, ilu macie kupujących, czy nie przejmiecie mi klienta. Na żadne nie było odpowiedzi. Dołożone: chip „publikacja bezpłatna, bez wyłączności" (nigdzie nie padało, że to za darmo), pasek liczb na żywo (działki w bazie, wyświetlenia ofert miesięcznie liczone z mediany 7 dni w `BiuroDailyStat`, 0 zł), jadący pas logotypów biur z największą liczbą ofert (dane już były w `defaultBiuroLogoUrl`), sekcja „Kupujący dzwoni prosto do Ciebie", obietnica odpowiedzi tego samego dnia roboczego oraz `og:image` (metadane strony nadpisywały cały blok `openGraph` z layoutu, więc link wklejony na FB szedł bez grafiki). **Świadomie BEZ instrukcji per CRM:** przy reklamie w IMO biura same pisały i dostawały indywidualną odpowiedź, więc ręczny krok zostaje.

## Lipiec-sierpień 2026 (podaż, dane, higiena)
- [x] **DZIURA SEO: huby bez ofert w HTML, /sprzedaj jako sam „Ładowanie…"** (2026-08-28). Przegląd wszystkich 45 nagłówków H1 i surowego HTML każdej trasy wykrył dwie ciche awarie. Obie niewidoczne na devie, bo dev renderuje per request i treść tam zawsze jest. **(1) 817 hubów `/dzialki/...` nie miało w HTML ANI JEDNEGO linku do oferty:** cztery szablony renderują `<KupSearch seoMode>` bez `initialItems`, więc zamiast listy szedł napis „Ładowanie ofert…", a `/kup` (jedyne miejsce z SSR listy) oddawał 20. Przy 7161 adresach ofert w sitemapie całe wewnętrzne linkowanie do nich szło z jednej strony. Naprawione: `queryHubListing` w `dzialkiListing.ts`, parametry 1:1 jak klient (skip 0, take 20, sort newest), błąd zapytania → `null` i strona działa jak dotąd. Zasada była już zapisana przy P8: „SSR = linki dla Googlebota". **(2) `/sprzedaj` oddawało 28,5 KB samego fallbacku `<Suspense>`:** `useSearchParams()` w `DzialkaForm` (użyte tylko do `?autopublish=1`) wywalał poddrzewo w tryb CSR. Parametr czytany teraz z `window.location.search` w efekcie, `<Suspense>` usunięty, 36,5 KB z pełną treścią. **Przy okazji:** H1 + „bezpłatne, konto dopiero przy publikacji" na `/sprzedaj` (strona w sitemapie nie miała żadnego nagłówka, a oba argumenty padały dopiero w bramce logowania, po wypełnieniu całego kreatora); `sr-only` H1 na `/kup` (też nie miał żadnego); tytuły zamiast całych zdań w H1 na `/panel/pakiety` i `/panel/wyroznienia`; blog przestał krzyczeć głośniej od głównej (34/58 px Bebas Neue → 30/42 zwykłym krojem, jak `/sprawdz-dzialke`); zapisy do `localStorage` w kreatorze w `try/catch` (przy zablokowanych danych witryny wyjątek z `useEffect` zabierał cały formularz); przeznaczenia w siatce zamiast flex-wrap (koniec osieroconej „Siedliskowej"). **Zweryfikowane produkcyjnym buildem i curlem produkcji, nie devem:** 8 losowych hubów z sitemapy = 8 z ofertami w HTML, cache ISR nietknięty (nowy hub 0,77 s, kolejne wejście 0,02 s). Lokalny build na maszynie Daniela wymaga `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1`.
- [x] **SPRINT WYDAJNOŚCI PRZED FALĄ RUCHU** (2026-08-27, przygotowanie pod P37). Audyt „co się stanie, gdy wejdzie kilka tysięcy osób w godzinę" wykrył dwie ciche awarie: (1) funkcje Vercela działały w **iad1 (Waszyngton)**, a baza Neon stoi w **eu-central-1 (Frankfurt)**, więc każde zapytanie robiło podróż przez Atlantyk (`/kup` robi ich do 7, sekwencyjnie); (2) **`revalidate` był martwy na wszystkich trasach z dynamicznym segmentem**, bo nigdzie w projekcie nie było `generateStaticParams` — produkcja zwracała `x-vercel-cache: MISS` na każdym żądaniu, także dla Googlebota. Naprawione: region funkcji przestawiony na sam `fra1` (odznaczony iad1, który był zaznaczony równolegle) + `generateStaticParams` (pusta tablica = ISR on-demand, zero prerenderu w buildzie) na 9 trasach. **Zmierzony efekt:** `/kup` 2,64 s → 0,43 s dla pojedynczego użytkownika; strona oferty i huby lecą z cache (`HIT`, ~0,16-0,19 s) i nie dotykają bazy. Dołożony wspólny cache 60 s na GOŁE `/kup` (bez filtrów, 1. strona, domyślny sort — każdy filtr, tekst, promień i dalsza strona liczą się na świeżo, więc zasada „świeżość podaży" zostaje tam, gdzie użytkownik realnie szuka): przy 40 równoczesnych żądaniach mediana 3,57 s → 2,20 s, p90 4,89 s → 2,44 s. **Zastrzeżenie do pomiaru:** przy 40 równoczesnych połączeniach z jednej maszyny spowalnia nawet strona serwowana z CDN, więc część tych czasów to sufit klienta testowego, nie serwera. **Co zostaje:** `/kup` dalej renderuje się na żądanie (funkcja na każde wejście) i to jest jej sufit architektoniczny; dalsze cięcie wymagałoby PPR albo wydzielenia statycznego wariantu, na razie niewarte zachodu.

- [x] **RE/MAX Polska** podłączony 2026-08-21: ~807 działek jednym podłączeniem, największe pojedyncze źródło podaży w historii portalu. Paczki zawsze różnicowe, bez `<oferta_usun>`. [[project_remax_feed]]
- [x] **Galactica: backfill usunięć** (2026-08-17): bramka na IMOX kasowała sygnał `<oferta_usun>`, więc sprzedane działki nie znikały. 604 oferty wygaszone, zero powrotów. [[project_galactica_brak_pelnych_eksportow]]
- [x] **Czyszczenie drop-zone FTP** dla wszystkich 3 silników + tryb no-full-export (2026-08-18); raport `npm run crm:prune:report`. [[project_crm_ftp_cleanup]]
- [x] **P36 etap 1: historia ceny działki** (`DzialkaPriceSnapshot` + sekcja „Historia ceny" na ofercie). Zbieranie od 2026-08-17, danych nie da się odtworzyć wstecz. [[project_price_history]]
- [x] **Strony `/ceny`** (mediana zł/m², money page pod zapytania cenowe, reużywa silnika kategorii). 2026-07-12. [[project_ceny_pages]]
- [x] **Perełki** `/admin/perelki`: kolejka 10 okazji na posty FB, oś = promień 10 km. 2026-07-17. [[project_perelki]]
- [x] **Testy (vitest)** `npm test`: reguły językowe + bramki geo, bez bazy i sieci, ~0,3 s. 2026-08-17. [[project_testy]]
- [x] **Statystyki kontra boty** (2026-08-24): liczniki liczyły Googlebota (22 tys. „wejść" vs ~2 tys. ludzi). Realny wzrost widać w GSC: organika ~19x na kwartał. [[project_statystyki_boty]]
- [x] **Wizytówka partnerska biura** włączana ręcznie (RE/MAX). Katalog dla wszystkich pozostaje odrzucony: to narzędzie do podaży, nie sekcja portalu. 2026-08-21. [[project_biuro_profiles]]
- [x] **Oś administracyjna z ULDK (`adminTeryt/Woj/Powiat/Gmina`).** ~11% aktywnych ofert nie dawało się przypisać do powiatu z `locationFull` (feedy CRM podają „Łódzkie”, „Dąbrowica, koniński”), więc wypadały z hubów `/dzialki/powiat/...`. Powiat i gmina liczone teraz z `lat`/`lng` przez ULDK, tekst z feedu jako zapas (`adminOf`). Przy okazji naprawione powiaty dwuczłonowe („łódzki wschodni”, „warszawski zachodni”), które reguła `/ki$/` odrzucała, i ich odmiana. TERYT gminy = klucz pod agregaty cen (RCN). 2026-09-02. `src/lib/uldk.ts`, `src/lib/seoPowiaty.ts`, `scripts/admin-backfill.ts`. [[project_rcn_ceny_transakcyjne]]

---

## 5. KLUCZOWE LEKCJE (żeby nie powtarzać błędów)

- **`revalidate` bez `generateStaticParams` NIE DZIAŁA.** Trasa z dynamicznym segmentem (`[city]`, `[id]`) bez tej funkcji jest renderowana na żądanie, a zadeklarowany `revalidate` jest ignorowany. Objaw: `x-vercel-cache: MISS` i `Cache-Control: no-store` na produkcji mimo poprawnego kodu. Lekarstwo: `generateStaticParams()` zwracające `[]` (ISR on-demand, bez kosztu builda). Sprawdzian: w `next build` trasa musi mieć `●` (SSG), nie `ƒ` (Dynamic).
- **Region funkcji musi siedzieć przy bazie.** Domyślny region Vercela to `iad1` (Waszyngton), a nasz Neon stoi we Frankfurcie. Każde zapytanie szło przez Atlantyk (~95 ms zamiast ~5 ms). Sprawdzian: nagłówek `x-vercel-id` pokazuje region wykonania (`arn1::fra1::` = OK, `arn1::iad1::` = źle). Na Pro można zaznaczyć kilka regionów naraz, więc sprawdź, czy stary nie został włączony obok nowego.
- **Nagłówki mierz GET-em, nie HEAD-em.** `curl -I` potrafi pokazać `MISS` na stronie, która GET-em wraca z `HIT`.
- **Mierz, zanim naprawisz.** Przy szybkości: bez zdjęcia LCP dalej 7,8 s → winowajcą była kliencka karta, nie obraz. Test obnaża prawdziwą przyczynę.
- **Test na realnym feedzie, nie syntetycznym.** IMO: syntetyk dawał fałszywe 9/9; realny plik obnażył kontener `<dzial>` jako rodzica oferty (P-I).
- **Zmiana parsera CRM = `git pull` + `pm2 restart crm-worker` na VPS**, inaczej autosync nadpisuje poprawki starym kodem.
- **Punkty zmieniające render/route weryfikuj realnym `next build`, nie tylko `next dev`** (Turbopack przepuszcza błędy prerenderu i middleware).
- **Płatne API pod kontrolą:** auto-sync re-geokodował całą bazę co dobę (~60 zł/dzień). Reużywaj współrzędnych z bazy; ustaw quota + budżet w GCP. [[project-geocoding-cost-incident]]
- **Tailwind v4 / Lightning CSS** po cichu wycina reguły z `calc()`+`var()` w alfie koloru. `var()` trzymaj poza kolorem. [[project-lightningcss-gotcha]]
- **Tekstowa ścieżka administracyjna z feedu CRM jest niepewna.** Każde biuro wypełnia adres inaczej, więc parsowanie `locationFull` cicho gubiło 11% podaży z osi SEO. Jednostki administracyjne licz z `lat`/`lng` (ULDK), tekst zostaw jako zapas. Uwaga na powiaty dwuczłonowe: „łódzki wschodni” i „warszawski zachodni” nie kończą się na „ki”.
