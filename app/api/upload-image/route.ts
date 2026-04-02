import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { uploadBufferToR2 } from '@/lib/r2';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: 'Nie przesłano pliku.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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

    return NextResponse.json({
      ok: true,
      url: uploaded.url,
      key: uploaded.key,
    });
  } catch (e: any) {
    console.error('UPLOAD_IMAGE_ERROR', e);

    return NextResponse.json(
      {
        ok: false,
        message: 'Nie udało się wgrać zdjęcia.',
      },
      { status: 500 }
    );
  }
}