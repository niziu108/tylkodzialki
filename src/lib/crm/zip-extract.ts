import fs from "fs";
import { promises as fsp } from "fs";
import unzipper from "unzipper";

/**
 * Rozpakowuje paczkę ZIP z FTP biura na dysk workera.
 *
 * Urwany plik kończy się błędem `FILE_ENDED` bez pola `syscall`, także przy cięciu dokładnie na
 * granicy wpisów albo w katalogu centralnym (test w esticrm-feed-window.test.ts). Silnik EstiCRM
 * pomija wtedy paczkę i jedzie dalej, dlatego po błędzie nie może zostać nic otwartego.
 */
export async function extractZipToDir(localZipPath: string, outputDir: string) {
  await fsp.mkdir(outputDir, { recursive: true });

  // Strumień źródłowy MUSI być zamknięty także gdy rozpakowanie rzuci. Worker jest długo
  // żyjącym procesem: niezamknięty deskryptor do pliku, który potem kasujemy razem z tempDir,
  // trzyma jego rozmiar na dysku aż do końca procesu (plik "deleted", ale wciąż otwarty).
  // Przy paczce psującej się w kółko to rosło o kilka GB na przebieg i zapchało VPS (ENOSPC).
  const source = fs.createReadStream(localZipPath);

  // To samo dotyczy zapisu wpisu przerwanego błędem: unzipper go nie zamyka (sprawdzone
  // 16.09.2026, `closed=false` jeszcze po 300 ms). Po udanym rozpakowaniu wszystkie zapisy są
  // już zamknięte i destroy nic nie zmienia.
  const writers: fs.WriteStream[] = [];

  try {
    await source
      .pipe(
        unzipper.Extract({
          path: outputDir,
          getWriter: ({ path: entryPath }: { path: string }) => {
            const writer = fs.createWriteStream(entryPath);
            writers.push(writer);
            return writer;
          },
        })
      )
      .promise();
  } finally {
    source.destroy();
    for (const writer of writers) writer.destroy();
  }
}
