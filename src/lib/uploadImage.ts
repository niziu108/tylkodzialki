import sharp from 'sharp';
import { uploadBufferToR2 } from '@/lib/r2';

export async function uploadImage(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 🔥 kompresja + konwersja (top jakość / mały rozmiar)
  const optimized = await sharp(buffer)
    .rotate()
    .resize({ width: 2000, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const uploaded = await uploadBufferToR2({
    buffer: optimized,
    originalFileName: file.name,
    mimeType: 'image/webp',
  });

  return uploaded; // { key, url }
}