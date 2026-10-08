'use client';

import { useEffect, type RefObject } from 'react';

// „Samopiszący się" placeholder pola lokalizacji na stronie głównej (2026-10-08, wzór: Airbnb,
// Działkopedia). Ruch w pustym polu ściąga wzrok tam, gdzie zaczyna się szukanie, a przykłady
// miast od razu mówią, co wpisać.
//
// Wydajność: piszemy WPROST do atrybutu `placeholder` przez ref, bez setState, więc komponent
// wyszukiwarki ani razu się nie przerysowuje. Start dopiero po chwili od wejścia (nie konkuruje
// z pierwszym renderem). Stop, gdy pole ma fokus albo treść, i w karcie w tle.
// Dostępność: przy „ogranicz ruch" (prefers-reduced-motion) zostaje statyczny tekst.

const TYPE_MS = 85;
const ERASE_MS = 40;
const HOLD_MS = 1600;
const GAP_MS = 350;
const START_DELAY_MS = 1200;

export function useTypewriterPlaceholder(
  inputRef: RefObject<HTMLInputElement | null>,
  { enabled, prefix, words }: { enabled: boolean; prefix: string; words: string[] }
) {
  useEffect(() => {
    const input = inputRef.current;
    if (!enabled || !input || words.length === 0) return;

    const staticText = `${prefix}${words[0]}`;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      input.placeholder = staticText;
      return;
    }

    const original = input.placeholder;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Gdy pole startuje już z pierwszą frazą (placeholder z serwera), nie piszemy jej od nowa:
    // stoi chwilę, kasuje się i dopiero potem lecą kolejne.
    let wordIdx = 0;
    let erasing = original === staticText;
    let chars = erasing ? words[0].length : 0;

    // Animujemy tylko, gdy nikt nie pisze i strona jest widoczna.
    const idle = () => document.activeElement !== input && input.value === '' && !document.hidden;

    const tick = () => {
      if (!idle()) {
        // Ktoś pisze albo karta w tle: pełna podpowiedź i ponowna próba za chwilę.
        // Po powrocie zaczynamy od pełnej pierwszej frazy, a nie od połowy miasta.
        input.placeholder = staticText;
        wordIdx = 0;
        erasing = true;
        chars = words[0].length;
        timer = setTimeout(tick, HOLD_MS);
        return;
      }

      const word = words[wordIdx];
      if (!erasing) {
        chars += 1;
        input.placeholder = `${prefix}${word.slice(0, chars)}`;
        if (chars >= word.length) {
          erasing = true;
          timer = setTimeout(tick, HOLD_MS);
          return;
        }
        timer = setTimeout(tick, TYPE_MS);
        return;
      }

      chars -= 1;
      input.placeholder = `${prefix}${word.slice(0, Math.max(chars, 0))}`;
      if (chars <= 0) {
        erasing = false;
        wordIdx = (wordIdx + 1) % words.length;
        timer = setTimeout(tick, GAP_MS);
        return;
      }
      timer = setTimeout(tick, ERASE_MS);
    };

    timer = setTimeout(tick, erasing ? HOLD_MS : START_DELAY_MS);
    return () => {
      if (timer) clearTimeout(timer);
      input.placeholder = original;
    };
    // words/prefix to stałe z miejsca wywołania; restart tylko przy zmianie trybu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, inputRef]);
}
