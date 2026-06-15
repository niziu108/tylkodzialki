'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HeroSearchBar() {
  const router = useRouter();
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = value.trim();
    const query = trimmed ? `?loc=${encodeURIComponent(trimmed)}` : '';

    router.push(`/kup${query}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border border-white/20 bg-black/45 p-2 shadow-lg backdrop-blur-md"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="text"
        placeholder="Wpisz miasto lub region…"
        className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/50"
      />

      <button
        type="submit"
        className="shrink-0 rounded-xl bg-[#7aa333] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
      >
        Szukaj
      </button>
    </form>
  );
}
