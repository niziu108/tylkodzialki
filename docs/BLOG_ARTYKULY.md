# Standard artykułów TylkoDziałki (blog)

Cel: dodawać artykuły regularnie (np. co 3 dni) bez zastanawiania się za każdym razem,
jak mają wyglądać. Jeden powtarzalny format, spójny wygląd, mocne SEO. Artykuły piszemy
z pomocą ChatGPT według gotowego promptu na dole tego pliku, a potem wklejamy do panelu
admina (`/admin/artykuly/nowy`).

---

## 1. Zasady redakcyjne

- **Długość:** 900–1400 słów (poradnik). Krócej = za cienkie pod SEO, dłużej = męczy.
- **Ton:** konkretny, rzeczowy, bez lania wody. Piszemy do osoby, która realnie kupuje
  lub sprzedaje działkę.
- **ZERO długich myślników (—).** Używamy przecinków, kropek, dwukropków. To twarda zasada.
- **Bez pustych superlatyw** ("najlepszy/największy portal"). Konkret zamiast chwalenia się.
- **Jeden temat = jeden artykuł.** Wąsko, ale wyczerpująco.

---

## 2. Struktura artykułu

Kolejność stała:

1. **Tytuł** (pole `Tytuł` w adminie) — z frazą kluczową, najlepiej pytanie lub konkret.
   W treści NIE powtarzamy tytułu jako nagłówka.
2. **Zajawka / excerpt** (pole `Zajawka`) — 1–2 zdania, do 160 znaków. Pokazuje się jako
   lead pod tytułem i jako opis na kartach.
3. **Wstęp** — 2–3 zdania na początku treści, wprowadzają w temat.
4. **„Najważniejsze w skrócie"** — callout z 3–5 punktami (patrz niżej). Tuż po wstępie.
5. **4–6 sekcji** `## Nagłówek` — clou artykułu, z akapitami i listami.
6. **1–2 „Praktyczne wskazówki"** — calloty w treści.
7. **`## Podsumowanie`** — 1 akapit zbierający najważniejsze.
8. **CTA** robi już sama strona (sekcja „Sprawdź działki na sprzedaż" → `/kup`),
   nie trzeba go dopisywać w treści.

---

## 3. Formatowanie (co renderer obsługuje)

Treść to zwykły markdown. Renderer (`src/components/ArticleContent.tsx`) stylizuje:

- `## Sekcja` i `### Podsekcja` — nagłówki (z `## ` budujemy też **spis treści** i kotwice).
  Nie używamy `#` (H1 jest zarezerwowany dla tytułu strony).
- Akapity, **pogrubienie**, *kursywa*.
- Listy `- punkt` (wypunktowanie) i `1. punkt` (numerowane) — renderują się jako prawdziwe listy.
- Linki `[tekst](/kup)` — wewnętrzne otwierają się w tej samej karcie.
- Tabele (markdown GFM).
- **Calloty** to cytaty `>` (patrz niżej).

### Calloty

Każdy cytat `>` renderuje się jako zielony box. Stosujemy dwa wzorce:

```markdown
> **Najważniejsze w skrócie**
> - Pierwszy konkret
> - Drugi konkret
> - Trzeci konkret
```

```markdown
> 💡 **Praktyczna wskazówka:** krótka, użyteczna rada w jednym, dwóch zdaniach.
```

---

## 4. Linkowanie wewnętrzne (ważne dla SEO)

W każdym artykule wstawiamy **2–3 linki wewnętrzne** w naturalnym miejscu w tekście:

- Zawsze: oferty → `[działki na sprzedaż](/kup)`.
- Gdy artykuł dotyczy regionu/miasta/typu, linkujemy do huba:
  - miasto: `/dzialki/wroclaw`, `/dzialki/krakow`, `/dzialki/warszawa`
  - miasto + typ: `/dzialki/wroclaw/budowlane`, `/dzialki/krakow/rolne`
  - województwo: `/dzialki/wojewodztwo/dolnoslaskie`, `/dzialki/wojewodztwo/mazowieckie`
  - typy (slug): `budowlane`, `rolne`, `rekreacyjne`, `inwestycyjne`, `lesne`, `siedliskowe`
- Gdy istnieje powiązany poradnik: `[tytuł](/blog/slug-artykulu)`.

Zasada: link ma być kontekstowy i pomagać czytelnikowi, nie upychany na siłę. Adres huba
najpewniej skopiować z paska adresu po wejściu na daną stronę miasta/typu na żywym serwisie.

---

## 5. SEO (pola w adminie)

- **Slug** — krótki, z frazą, bez polskich znaków. Zostaw puste = wygeneruje się z tytułu.
- **Kategoria** (steruje chipem i ikoną na okładce). Jedna z:
  `Formalności i prawo`, `Kupno działki`, `Sprzedaż działki`, `Budowa`, `Działka rolna`, `Inwestowanie`.
- **Czas czytania** — zostaw puste, policzy się automatycznie z treści.
- **SEO title** — do 60 znaków. Puste = użyje tytułu.
- **SEO description** — do 160 znaków. Puste = użyje zajawki.

Okładka graficzna generuje się automatycznie (tytuł + kategoria + ikona), więc nie trzeba
wgrywać zdjęcia. Własne zdjęcie wgrywamy tylko, gdy realnie pasuje (np. zdjęcie z terenu).

---

## 6. Workflow (panel admina)

1. Wygeneruj artykuł promptem z sekcji 7.
2. `/admin/artykuly/nowy`: wklej Tytuł, Slug, Zajawkę, Treść; wybierz Kategorię.
3. Rozwiń sekcję SEO, wklej SEO title i SEO description (liczniki pilnują długości).
4. Czas czytania zostaw puste.
5. Zaznacz „Opublikuj od razu" (lub zapisz jako szkic) i zapisz.
6. Podejrzyj artykuł („Podgląd") na telefonie i desktopie.

---

## 7. Gotowy prompt do ChatGPT

Skopiuj poniższe, podmień `[TEMAT]` i wyślij do ChatGPT.

```text
Napisz ekspercki artykuł poradnikowy na portal o działkach (tylkodzialki.pl) na temat: [TEMAT].

Zasady:
- Po polsku, konkretnie, rzeczowo, dla osoby kupującej lub sprzedającej działkę.
- 900–1400 słów.
- NIE używaj długich myślników (—). Używaj przecinków i kropek.
- Bez pustych superlatywów i bez chwalenia portalu.

Zwróć dokładnie w tej kolejności i formacie:

TYTUŁ: (z frazą kluczową, najlepiej pytanie lub konkret; bez nazwy portalu)
SLUG: (krótki, bez polskich znaków, słowa łączone myślnikiem)
EXCERPT: (1–2 zdania, max 160 znaków)
SEO_TITLE: (max 60 znaków)
SEO_DESCRIPTION: (max 160 znaków)
KATEGORIA: (jedna z: Formalności i prawo, Kupno działki, Sprzedaż działki, Budowa, Działka rolna, Inwestowanie)

TREŚĆ: (czysty markdown, według schematu)
- Zacznij 2–3 zdaniami wstępu (bez nagłówka, NIE powtarzaj tytułu).
- Potem callout w formacie:
  > **Najważniejsze w skrócie**
  > - punkt
  > - punkt
  > - punkt
- Następnie 4–6 sekcji, każda jako "## Nagłówek sekcji", z akapitami i listami (- albo 1.).
- Wpleć 1–2 calloty w formacie:
  > 💡 **Praktyczna wskazówka:** jedno, dwa zdania.
- Wpleć 2–3 naturalne linki wewnętrzne w markdown, w tym zawsze [działki na sprzedaż](/kup).
  Jeśli temat dotyczy regionu/typu, dodaj link do huba, np. [działki budowlane we Wrocławiu](/dzialki/wroclaw/budowlane).
- Zakończ sekcją "## Podsumowanie" (1 akapit). Nie dopisuj własnego CTA na końcu.
```

---

## 8. Checklist przed publikacją

- [ ] Tytuł z frazą, bez powtórki w treści.
- [ ] Zajawka ≤ 160 znaków.
- [ ] Callout „Najważniejsze w skrócie" na górze.
- [ ] 4–6 sekcji `##`, prawdziwe listy gdzie pasują.
- [ ] 1–2 „Praktyczne wskazówki".
- [ ] 2–3 linki wewnętrzne (w tym `/kup`).
- [ ] `## Podsumowanie`.
- [ ] Kategoria wybrana, SEO title ≤ 60, SEO description ≤ 160.
- [ ] Zero długich myślników.
- [ ] Podgląd na telefonie wygląda dobrze.
