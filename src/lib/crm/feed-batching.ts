// Czysta logika doboru plików do jednego przebiegu importu. Trzymana osobno od silnika, żeby dało
// się ją testować bez FTP, bazy i R2.

export type SizedFeedFile = {
  remoteFileName: string;
  size: number | null;
};

export const DEFAULT_MAX_RUN_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Ogranicza listę plików jednego przebiegu do łącznego rozmiaru `maxBytes`.
 *
 * Zdarzają się paczki po 700 MB (rekord w bazie: 2,8 GB), więc limit „20 plików na przebieg" sam
 * z siebie nie chroni dysku VPS. Pierwszy plik bierzemy ZAWSZE — inaczej pojedyncza paczka większa
 * niż limit zablokowałaby integrację na zawsze. Reszta czeka na kolejny przebieg, kolejność
 * chronologiczna (od najstarszego) zostaje zachowana.
 */
export function limitFeedsByTotalBytes<T extends SizedFeedFile>(files: T[], maxBytes: number): T[] {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return files;

  const limited: T[] = [];
  let totalBytes = 0;

  for (const file of files) {
    const size = file.size ?? 0;
    if (limited.length > 0 && totalBytes + size > maxBytes) break;
    limited.push(file);
    totalBytes += size;
  }

  return limited;
}

export function totalFeedBytes(files: SizedFeedFile[]): number {
  return files.reduce((acc, file) => acc + (file.size ?? 0), 0);
}
