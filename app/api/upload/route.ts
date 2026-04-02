import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import sharp from 'sharp';
import { authOptions } from '@/auth-options';
import { uploadBufferToR2 } from '@/lib/r2';

export const runtime = 'nodejs';

const MAX_ORIGINAL_FILE_SIZE_MB = 15;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_WIDTH = 1800;
const WEBP_QUALITY = 78;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.toLowerCase().trim();

  if (!sessionEmail) {
    return NextResponse.json(
      { ok: false, message: 'Brak autoryzacji.' },
      { status: 401 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: 'Brak pliku.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Dozwolone są tylko pliki JPG, PNG, WEBP lub AVIF.',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_ORIGINAL_FILE_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        {
          ok: false,
          message: `Maksymalny rozmiar oryginalnego zdjęcia to ${MAX_ORIGINAL_FILE_SIZE_MB} MB.`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    const optimizedBuffer = await sharp(originalBuffer)
      .rotate()
      .resize({
        width: MAX_WIDTH,
        withoutEnlargement: true,
      })
      .webp({
        quality: WEBP_QUALITY,
      })
      .toBuffer();

    const result = await uploadBufferToR2({
      buffer: optimizedBuffer,
      originalFileName: file.name,
      mimeType: 'image/webp',
    });

    return NextResponse.json({
      ok: true,
      url: result.url,
      publicId: result.key,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Nie udało się wgrać pliku.',
        error: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}