'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ARTICLE_CATEGORIES, estimateReadingTime } from '@/lib/articleCategories';

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
    category: string | null;
    readingTime: number | null;
    seoTitle: string | null;
    seoDescription: string | null;
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
  const [readingEstimate, setReadingEstimate] = useState(() =>
    estimateReadingTime(initialData?.content || '')
  );
  const [seoTitleLen, setSeoTitleLen] = useState(
    (initialData?.seoTitle || '').length
  );
  const [seoDescLen, setSeoDescLen] = useState(
    (initialData?.seoDescription || '').length
  );

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
      className="rounded-3xl border border-fg/10 bg-fg/5 p-5 md:p-6"
    >
      {mode === 'edit' && initialData?.id ? (
        <input type="hidden" name="id" value={initialData.id} />
      ) : null}

      <input type="hidden" name="imageUrl" value={imageUrl} />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-fg">
            Tytuł artykułu
          </label>
          <input
            type="text"
            name="title"
            defaultValue={initialData?.title || ''}
            placeholder="Np. MPZP – co to jest i jak sprawdzić plan dla działki?"
            className="h-12 w-full rounded-2xl border border-fg/10 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/50 focus:border-brand/60"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-fg">
            Slug
          </label>
          <input
            type="text"
            name="slug"
            defaultValue={initialData?.slug || ''}
            placeholder="Np. mpzp-co-to-jest"
            className="h-12 w-full rounded-2xl border border-fg/10 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/50 focus:border-brand/60"
          />
          <p className="mt-2 text-xs text-fg/50">
            Możesz zostawić puste — system wygeneruje slug z tytułu.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-fg">
            Zdjęcie główne artykułu
          </label>

          <div className="rounded-2xl border border-fg/10 bg-surface p-3">
            {imageUrl ? (
              <div className="overflow-hidden rounded-2xl border border-fg/10">
                <img
                  src={imageUrl}
                  alt="Podgląd zdjęcia artykułu"
                  className="h-44 w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-fg/10 bg-black/20 text-sm text-fg/50">
                Brak zdjęcia głównego
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90">
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
                  className="inline-flex items-center justify-center rounded-2xl border border-fg/10 bg-fg/5 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-fg/10"
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

        <div>
          <label className="mb-2 block text-sm font-medium text-fg">
            Kategoria
          </label>
          <select
            name="category"
            defaultValue={initialData?.category || ''}
            className="h-12 w-full rounded-2xl border border-fg/10 bg-surface px-4 text-sm text-fg outline-none transition focus:border-brand/60"
          >
            <option value="">Bez kategorii</option>
            {ARTICLE_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-fg/50">
            Steruje chipem na karcie i (wkrótce) ikoną na grafice.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-fg">
            Czas czytania (min)
          </label>
          <input
            type="number"
            name="readingTime"
            min={1}
            defaultValue={initialData?.readingTime ?? ''}
            placeholder={`Auto: ${readingEstimate} min`}
            className="h-12 w-full rounded-2xl border border-fg/10 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/50 focus:border-brand/60"
          />
          <p className="mt-2 text-xs text-fg/50">
            Zostaw puste — policzymy z treści ({readingEstimate} min).
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-fg">
            Zajawka / excerpt
          </label>
          <textarea
            name="excerpt"
            rows={4}
            defaultValue={initialData?.excerpt || ''}
            placeholder="Krótki opis artykułu widoczny na liście bloga i w panelu admina..."
            className="w-full rounded-2xl border border-fg/10 bg-surface px-4 py-3 text-sm text-fg outline-none transition placeholder:text-fg/50 focus:border-brand/60"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-fg">
            Treść artykułu
          </label>
          <textarea
            name="content"
            rows={18}
            defaultValue={initialData?.content || ''}
            onChange={(e) =>
              setReadingEstimate(estimateReadingTime(e.target.value))
            }
            placeholder={`Np.

# MPZP – co to jest?

Miejscowy plan zagospodarowania przestrzennego to...

## Jak sprawdzić MPZP?

1. Wejdź na stronę urzędu...
2. Sprawdź numer działki...
`}
            className="w-full rounded-2xl border border-fg/10 bg-surface px-4 py-3 text-sm leading-7 text-fg outline-none transition placeholder:text-fg/50 focus:border-brand/60"
            required
          />
          <p className="mt-2 text-xs text-fg/50">
            Możesz pisać normalny tekst albo prosty markdown.
          </p>
        </div>

        <details className="rounded-2xl border border-fg/10 bg-black/20 p-4 md:col-span-2">
          <summary className="cursor-pointer select-none text-sm font-medium text-fg">
            SEO (tytuł i opis w Google) — opcjonalne
          </summary>

          <div className="mt-4 grid gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-fg">
                  SEO title
                </label>
                <span
                  className={`text-xs ${seoTitleLen > 60 ? 'text-amber-300' : 'text-fg/50'}`}
                >
                  {seoTitleLen}/60
                </span>
              </div>
              <input
                type="text"
                name="seoTitle"
                defaultValue={initialData?.seoTitle || ''}
                onChange={(e) => setSeoTitleLen(e.target.value.length)}
                placeholder="Domyślnie: tytuł artykułu"
                className="h-12 w-full rounded-2xl border border-fg/10 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/50 focus:border-brand/60"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-fg">
                  SEO description
                </label>
                <span
                  className={`text-xs ${seoDescLen > 160 ? 'text-amber-300' : 'text-fg/50'}`}
                >
                  {seoDescLen}/160
                </span>
              </div>
              <textarea
                name="seoDescription"
                rows={3}
                defaultValue={initialData?.seoDescription || ''}
                onChange={(e) => setSeoDescLen(e.target.value.length)}
                placeholder="Domyślnie: zajawka artykułu"
                className="w-full rounded-2xl border border-fg/10 bg-surface px-4 py-3 text-sm text-fg outline-none transition placeholder:text-fg/50 focus:border-brand/60"
              />
            </div>
          </div>
        </details>
      </div>

      <div className="mt-6 rounded-2xl border border-fg/10 bg-black/20 p-4">
        <label className="flex items-center gap-3 text-sm text-fg">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={initialData?.isPublished || false}
            className="h-4 w-4 rounded border-fg/20 bg-surface"
          />
          {mode === 'create' ? 'Opublikuj od razu' : 'Artykuł opublikowany'}
        </label>
        <p className="mt-2 text-xs text-fg/50">
          Jeśli zostawisz odznaczone, artykuł zapisze się jako szkic.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 text-xs text-fg/50 sm:text-sm">
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
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-fg/10 bg-fg/5 px-6 text-sm font-medium text-fg transition hover:bg-fg/10"
          >
            Anuluj
          </Link>

          <button
            type="submit"
            disabled={uploading}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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