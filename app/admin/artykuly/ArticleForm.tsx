'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

type ArticleFormProps = {
  mode: 'create' | 'edit';
  action: (formData: FormData) => void | Promise<void>;
  initialData?: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    imageUrl: string | null;
    isPublished: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
};

async function uploadImageViaApi(file: File): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    throw new Error(data?.message || 'Nie udało się wgrać zdjęcia.');
  }

  return {
    url: data.url,
    key: data.key,
  };
}

export default function ArticleForm({
  mode,
  action,
  initialData,
}: ArticleFormProps) {
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleUpload(file: File | null) {
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    try {
      const result = await uploadImageViaApi(file);
      setImageUrl(result.url);
    } catch (e: any) {
      setUploadError(e?.message || 'Nie udało się wgrać zdjęcia.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <form
      action={action}
      className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-6"
    >
      {mode === 'edit' && initialData?.id ? (
        <input type="hidden" name="id" value={initialData.id} />
      ) : null}

      <input type="hidden" name="imageUrl" value={imageUrl} />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-white">
            Tytuł artykułu
          </label>
          <input
            type="text"
            name="title"
            defaultValue={initialData?.title || ''}
            placeholder="Np. MPZP – co to jest i jak sprawdzić plan dla działki?"
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 text-sm text-white outline-none transition placeholder:text-[#8f8f8f] focus:border-[#7aa333]/60"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white">
            Slug
          </label>
          <input
            type="text"
            name="slug"
            defaultValue={initialData?.slug || ''}
            placeholder="Np. mpzp-co-to-jest"
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 text-sm text-white outline-none transition placeholder:text-[#8f8f8f] focus:border-[#7aa333]/60"
          />
          <p className="mt-2 text-xs text-[#8f8f8f]">
            Możesz zostawić puste — system wygeneruje slug z tytułu.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white">
            Zdjęcie główne artykułu
          </label>

          <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-3">
            {imageUrl ? (
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <img
                  src={imageUrl}
                  alt="Podgląd zdjęcia artykułu"
                  className="h-44 w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-sm text-[#8f8f8f]">
                Brak zdjęcia głównego
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-[#7aa333] px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90">
                {uploading ? 'Wgrywam...' : imageUrl ? 'Podmień zdjęcie' : 'Wgraj zdjęcie'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                />
              </label>

              {imageUrl ? (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Usuń zdjęcie
                </button>
              ) : null}
            </div>

            {uploadError ? (
              <p className="mt-3 text-xs text-red-300">{uploadError}</p>
            ) : null}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-white">
            Zajawka / excerpt
          </label>
          <textarea
            name="excerpt"
            rows={4}
            defaultValue={initialData?.excerpt || ''}
            placeholder="Krótki opis artykułu widoczny na liście bloga i w panelu admina..."
            className="w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#8f8f8f] focus:border-[#7aa333]/60"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-white">
            Treść artykułu
          </label>
          <textarea
            name="content"
            rows={18}
            defaultValue={initialData?.content || ''}
            placeholder={`Np.

# MPZP – co to jest?

Miejscowy plan zagospodarowania przestrzennego to...

## Jak sprawdzić MPZP?

1. Wejdź na stronę urzędu...
2. Sprawdź numer działki...
`}
            className="w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-[#8f8f8f] focus:border-[#7aa333]/60"
            required
          />
          <p className="mt-2 text-xs text-[#8f8f8f]">
            Możesz pisać normalny tekst albo prosty markdown.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <label className="flex items-center gap-3 text-sm text-white">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={initialData?.isPublished || false}
            className="h-4 w-4 rounded border-white/20 bg-[#1b1b1b]"
          />
          {mode === 'create' ? 'Opublikuj od razu' : 'Artykuł opublikowany'}
        </label>
        <p className="mt-2 text-xs text-[#8f8f8f]">
          Jeśli zostawisz odznaczone, artykuł zapisze się jako szkic.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 text-xs text-[#8f8f8f] sm:text-sm">
          {mode === 'edit' && initialData?.createdAt ? (
            <span>Utworzono: {initialData.createdAt}</span>
          ) : null}
          {mode === 'edit' && initialData?.updatedAt ? (
            <span>Ostatnia aktualizacja: {initialData.updatedAt}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/admin/artykuly"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Anuluj
          </Link>

          <button
            type="submit"
            disabled={uploading}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#7aa333] px-6 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading
              ? 'Poczekaj, trwa upload...'
              : mode === 'create'
              ? 'Zapisz artykuł'
              : 'Zapisz zmiany'}
          </button>
        </div>
      </div>
    </form>
  );
}