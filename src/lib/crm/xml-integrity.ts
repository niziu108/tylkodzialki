/**
 * Bramka na uszkodzone pliki XML z feedów CRM, wspólna dla wszystkich silników.
 *
 * Parser fast-xml-parser (ASARI, EstiCRM, LocumNet) nie rzuca, gdy plik urywa się na granicy
 * elementu: brak zamknięcia korzenia, pusty plik albo sam nagłówek dają po cichu niepełną listę
 * ofert. Plik złapany w trakcie wgrywania albo ucięty przez CRM wewnątrz poprawnego ZIP-a wyglądałby
 * jak eksport z mniejszą liczbą ofert: przy pełnym eksporcie reszta poszłaby do wygaszenia, a oferta
 * ucięta w połowie weszłaby do bazy bez części zdjęć albo opisu. Uszkodzony plik pomijamy w całości.
 *
 * Fałszywych odrzuceń nie ma: 1498 prawdziwych plików ASARI (16.09.2026) oraz 73 unikalne pliki
 * z paczek EstiCRM (5 biur), LocumNet i DOMY.PL (Galactica, IMOX) przechodzą walidację bez odrzuceń,
 * a liczba ofert wg walidowanego parsera zgadza się z liczbą wg SAX w każdym z nich (17.09.2026).
 * Walidator odrzuca też XML „brudny, ale kompletny" (np. nieescapowany `&` w tekście). Świadomie:
 * parser potrafi na takim pliku zgubić część struktury, a w prawdziwych paczkach to nie występuje.
 */

import { XMLValidator } from "fast-xml-parser";
import sax from "sax";

/** Null dla poprawnego XML, opis błędu dla uszkodzonego (około 1 ms na 50 KB). */
export function xmlIntegrityProblem(xml: string): string | null {
  const result = XMLValidator.validate(xml);
  if (result === true) return null;
  return `${result.err.msg} (linia ${result.err.line})`;
}

/**
 * To samo co `xmlIntegrityProblem`, ale strumieniowo, dla silnika DOMY.PL. Ten parsuje ofertę po
 * ofercie parserem SAX i zapisuje każdą od razu, więc błąd wychodził dopiero po imporcie części
 * pliku. Tutaj ten sam SAX w trybie strict przechodzi plik raz bez zapisów: skoro przejście
 * kontrolne jest czyste, właściwe parsowanie tych samych bajtów też będzie.
 *
 * Strumień jest zawsze zamykany. Pusty plik albo sam nagłówek to też problem (SAX ich nie zgłasza).
 */
export function xmlStreamIntegrityProblem(stream: NodeJS.ReadableStream): Promise<string | null> {
  return new Promise((resolve) => {
    // Te same opcje co w streamParseDomyPlOffers (domypl-sync.ts): wynik ma odpowiadać właściwemu przebiegowi.
    const saxStream = sax.createStream(true, { lowercase: true, trim: false, normalize: false });
    let sawRootElement = false;
    let settled = false;

    const finish = (problem: string | null) => {
      if (settled) return;
      settled = true;
      stream.unpipe(saxStream);
      const closable = stream as { destroy?: () => void };
      if (typeof closable.destroy === "function") closable.destroy();
      resolve(problem);
    };

    saxStream.on("opentag", () => {
      sawRootElement = true;
    });
    saxStream.on("error", (error: Error) => {
      const line = (saxStream as { _parser?: { line?: number } })._parser?.line;
      finish(`${error.message.split("\n")[0]}${typeof line === "number" ? ` (linia ${line + 1})` : ""}`);
    });
    saxStream.on("end", () => {
      finish(sawRootElement ? null : "Plik nie zawiera elementu głównego.");
    });
    stream.on("error", (error: unknown) => {
      finish(`Błąd odczytu: ${error instanceof Error ? error.message : String(error)}`);
    });

    stream.pipe(saxStream);
  });
}
