export async function uploadToCloudinary(file: File) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

  if (!cloudName || !preset) {
    throw new Error('Brak NEXT_PUBLIC_CLOUDINARY_* w .env.local');
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);

  const res = await fetch(url, { method: 'POST', body: form });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || 'Cloudinary upload failed');
  }

  return {
    url: data.secure_url as string,
    publicId: data.public_id as string,
    width: data.width as number | undefined,
    height: data.height as number | undefined,
  };
}