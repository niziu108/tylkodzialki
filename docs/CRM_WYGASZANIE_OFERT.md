# Wygaszanie sprzedanych ofert z CRM (Galactica / DOMY.PL)

Stan: 2026-08-17. Dotyczy silnika `src/lib/crm/domypl-sync.ts` (Galactica, IMOX, Propertly — format DOMY.PL).

## Problem

Sprzedane działki Galactiki zostawały na portalu bez końca. Bezpiecznik R1
(`deactivateMissingOffers`) gasi oferty nieobecne w **pełnym** eksporcie, a pełny eksport
poznajemy po nagłówku `<zawartosc_pliku>` = „pełny"/„całość". Dane z produkcji:

| źródło | plików pełnych | plików różnicowych |
|---|---|---|
| Galactica | 6 | 6822 |
| IMOX | 39 | — |

Na 46 integracjach Galactiki pełny eksport dostało kiedykolwiek 6. Bezpiecznik praktycznie
nigdy się nie odpalał.

## Przyczyna źródłowa (znaleziona 2026-08-17)

**Galactica wysyła `<oferta_usun>` w każdej paczce — my te znaczniki wyrzucaliśmy.**
Parser (`streamParseDomyPlOffers`) zbierał je od zawsze dla wszystkich źródeł, ale zastosowanie
stało za bramką `if (integration.provider === "IMOX")` (Sprint 7, świadoma decyzja „ścieżka
Galactiki bit w bit").

Sonda po paczkach na FTP z 2026-08-17 (3 największe biura, po 8 najświeższych paczek):

```
oferty_2026-08-17_14-28.zip   zawartosc_pliku="roznica"  ofert=7   oferta_usun=4
oferty_2026-08-17_21-00.zip   zawartosc_pliku="roznica"  ofert=6   oferta_usun=6
oferty_2026-08-17_11-45.zip   zawartosc_pliku="roznica"  ofert=0   oferta_usun=4
```

## Naprawa

1. **Silnik** (`domypl-sync.ts`): usunięcia z `<oferta_usun>` stosujemy dla każdego źródła
   w formacie DOMY.PL, nie tylko dla IMOX.
2. **Dopasowanie po DOKŁADNYM `externalId`** — to nie jest przeoczenie. Galactica używa
   `<oferta_usun>` również w protokole aktualizacji: kasuje starą wersję id (`LER-GS-3541-1`)
   i w tej samej paczce przysyła nową (`LER-GS-3541-2`). Dopasowanie po bazowym id (bez sufiksu
   wersji) wygasiłoby żywą ofertę. W próbce 45 usunięć jednego biura tylko 9 było dokładnych;
   pozostałe 36 to były podbicia wersji.
3. **Zaległości**: `scripts/crm-usun-backfill.ts` czyta paczki zalegające na FTP i stosuje
   usunięcia sprzed naprawy (te nigdy nie przyjdą drugi raz). Usunięcie z paczki z dnia X gasi
   ofertę tylko wtedy, gdy `lastSeenAt` jest starszy niż ta paczka — oferta zdjęta i wystawiona
   ponownie zostaje.

```bash
npm run crm:usun-backfill -- --integracja=<id> --od=2026-06-01
```

Domyślnie raport. Wykonanie: `--apply`. Skrypt nie kasuje niczego z FTP i nie dopisuje nic do
`CrmProcessedFile`; każde wygaszenie to soft delete (`ZAKONCZONE`) + wpis `DEACTIVATE`
w `CrmSyncLog`. Paczki niosą zdjęcia, więc przebieg waży dziesiątki MB na biuro — sensownie
puszczać per biuro i z VPS.

## Czego NIE robimy: wygaszanie po samej bezczynności

Kandydat rozważany na starcie: gasić ofertę, której `lastSeenAt` nie odświeżył się od N dni.
Kalibracja (`npm run crm:expire -- --kalibracja`) i weryfikacja odrzuciły to jako automat.

Rozkład ciszy, po której oferta jednak wróciła (Galactica, okno obserwacji 115 dni, 10 123 przerwy):

| próg | ofert wróciłoby po wygaszeniu |
|---|---|
| 30 dni | 665 (6,57%) |
| 60 dni | 115 (1,14%) |
| 90 dni | 5 (0,05%) |

Liczby wyglądają zachęcająco, ale mierzą tylko oferty, które biuro w ogóle kiedyś ruszyło.
Weryfikacja na żywym przypadku: `LNKF-GS-276` (Piątkowisko, 959 m², 144 000 zł) milczała
103 dni mimo 84 paczek po ostatnim wystąpieniu — i **nadal wisi na stronie biura**. Cisza
w eksporcie różnicowym znaczy „biuro nic nie zmieniło", nie „sprzedane".

Potwierdza to pokrycie: żadne biuro Galactiki nie re-eksportuje całego stanu. Udział ofert
widzianych w ostatnich 30 dniach to najczęściej 6–50% podaży biura.

Skrypt `scripts/crm-expire-stale.ts` zostaje jako **diagnostyka** (raport + kalibracja): pokazuje,
komu podaż zastyga i gdzie eksport wygląda na zepsuty. `--apply` istnieje, ale nie jest to
mechanizm do puszczania rutynowo — właściwym sygnałem jest `<oferta_usun>`.

## Wynik wdrożenia (2026-08-17)

Naprawa silnika na produkcji, backfill przepuszczony w trzech etapach (okno 2 dni → 2,5 tygodnia →
pełny backlog z FTP):

| | |
|---|---|
| ofert wygaszonych z `<oferta_usun>` | **604** |
| z tego wróciło (REACTIVATE) | 0 |
| linków w stanie pośrednim | 0 |
| aktywne oferty Galactiki | 3250 → 2646 |
| paczek przejrzanych w pełnym przebiegu | kilka tysięcy, dziesiątki GB |

Najmocniej oberwały biura, które od dawna nic nie wycofywały: 40% podaży (149 ofert), 30%, 29%,
27%. To nie jest utrata podaży — to działki, których biura nie mają już w sprzedaży, a które
u nas dalej wisiały jako aktualne.

## Co obserwować po wdrożeniu

- `deactivatedCount` w `CrmProcessedFile` i `/admin/crm` — po naprawie powinien przestać być zerem
  dla Galactiki,
- wpisy `DEACTIVATE` w `CrmSyncLog` z komunikatem o `<oferta_usun>`,
- REACTIVATE po wygaszeniu = oferta wróciła (mechanizm sam się naprawia, nic nie tracimy na stałe).
