# Regułka startowa CRM (wklejaj na początku każdego nowego czatu)

Każdy sprint robimy w nowym czacie. Skopiuj poniższy blok, wpisz numer aktualnego sprintu
w linii "AKTUALNY SPRINT" i wyślij jako pierwszą wiadomość.

---

```
Pracujemy nad portalem tylkodzialki. Realizujemy roadmapę CRM metodą sprintów.

NA START:
1. Przeczytaj ROADMAP_CRM.md w katalogu głównym projektu.
2. Przeczytaj docs/CRM_AUDIT_SPRINT1.md (audyt stanu integracji).

AKTUALNY SPRINT: >>> TU WPISZ, np. SPRINT 2 <<<

ZASADA NADRZĘDNA: nie wolno zepsuć działających integracji.
Produkcyjnie działają: Galactica, Asari, EstiCRM. Mamy aktywne biura i tysiące ofert.
Każda zmiana musi być: wstecznie kompatybilna, bezpieczna, przetestowana.

KOLEJNOŚĆ PRACY: najpierw analiza, potem plan, dopiero później kod.
Jeden sprint = jedno zadanie. Nie przechodź do kolejnego sprintu.
Jeśli nie masz 100% pewności co do zmiany, najpierw zapytaj.
Nie wykonuj dodatkowych zmian bez mojej zgody.
Jeśli znajdziesz inne problemy, nie naprawiaj ich, tylko dopisz do sekcji
"Znalezione problemy" w ROADMAP_CRM.md (wpływ biznesowy + priorytet).

NA START ODPOWIEDZ:
1. Jaki jest aktualny sprint i co dokładnie obejmuje.
2. Jakie jest ryzyko dla działających integracji.
3. Plan bez kodu. Potem czekaj na moją zgodę.

PO ZAKOŃCZENIU SPRINTU:
- sprawdź działanie / przetestuj,
- zaktualizuj ROADMAP_CRM.md: oznacz sprint jako ukończony, ustaw następny,
- przygotuj krótkie podsumowanie: co zrobione, ryzyko, jak przetestowane, efekt biznesowy, następny sprint,
- zaproponuj commit.
```

---

## Po zakończeniu sprintu

1. Pozwól mi (Claude) zaktualizować `ROADMAP_CRM.md` (status sprintu) i zaproponować commit.
2. Otwórz nowy czat na kolejny sprint i wklej regułkę ponownie z nowym numerem.
