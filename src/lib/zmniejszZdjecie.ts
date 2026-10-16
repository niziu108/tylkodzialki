// Zmniejszanie obrazka w przeglądarce PRZED wysłaniem na serwer (16.10.2026).
// Vercel przyjmuje do funkcji najwyżej ok. 4,5 MB (większe żądanie = 413
// FUNCTION_PAYLOAD_TOO_LARGE, zanim dotrze do naszego kodu), a server action domyślnie 1 MB.
// Zdjęcia z telefonu i wizualizacje mają często 5-15 MB.
//
// Zdjęcia: JPEG 0,88 na białym tle (JPEG nie ma przezroczystości).
// Logo: `przezroczystosc: true` = WebP (Safari bez kodera WebP odda PNG), tło zostaje przezroczyste.
// Gdy przeglądarka nie umie odczytać pliku (np. HEIC w Chrome) albo jest to SVG/GIF, zwracamy
// oryginał bez zmian.

export async function zmniejszZdjecie(
  file: File,
  opcje: { maxBok?: number; przezroczystosc?: boolean; limitBezZmian?: number } = {}
): Promise<File> {
  const maxBok = opcje.maxBok ?? 2400;
  const limitBezZmian = opcje.limitBezZmian ?? 3_000_000;
  try {
    if (typeof window === 'undefined') return file;
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
      return file;
    }
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const skala = Math.min(1, maxBok / Math.max(bmp.width, bmp.height));
    if (skala === 1 && file.size <= limitBezZmian) {
      bmp.close();
      return file;
    }
    const w = Math.round(bmp.width * skala);
    const h = Math.round(bmp.height * skala);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      return file;
    }
    if (!opcje.przezroczystosc) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();

    const typ = opcje.przezroczystosc ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, typ, opcje.przezroczystosc ? 0.92 : 0.88));
    if (!blob) return file;
    const rozszerzenie = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const nazwa = file.name.replace(/\.[^.]+$/, '') + '.' + rozszerzenie;
    return new File([blob], nazwa, { type: blob.type || typ });
  } catch {
    return file;
  }
}
