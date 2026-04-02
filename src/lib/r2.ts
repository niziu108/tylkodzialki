import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const requiredEnv = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Brak ${key} w .env.local`);
  }
}

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function sanitizeFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function getExtension(fileName: string, mimeType: string) {
  const fromName = fileName.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;

  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/avif') return 'avif';

  return 'jpg';
}

export async function uploadBufferToR2(params: {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
}) {
  const { buffer, originalFileName, mimeType } = params;

  const ext = getExtension(originalFileName, mimeType);
  const baseName = sanitizeFileName(originalFileName.replace(/\.[^.]+$/, '')) || 'image';
  const key = `dzialki/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${baseName}.${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return {
    key,
    url: `${process.env.R2_PUBLIC_URL!.replace(/\/$/, '')}/${key}`,
  };
}

export async function deleteFromR2(key: string) {
  if (!key) return;

  await r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    })
  );
}