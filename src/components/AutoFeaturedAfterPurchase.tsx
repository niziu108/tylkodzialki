'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { wyroznijOgloszenieAction } from '../../app/panel/actions';

export default function AutoFeaturedAfterPurchase({
  dzialkaId,
}: {
  dzialkaId: string;
}) {
  const router = useRouter();
  const hasRunRef = useRef(false);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!dzialkaId) return;
    if (hasRunRef.current) return;

    const storageKey = `TD_AUTO_FEATURED_${dzialkaId}`;
    const alreadyDone =
      typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null;

    if (alreadyDone === '1') return;

    hasRunRef.current = true;
    setStatus('loading');
    setMessage('Trwa automatyczne wyróżnianie ogłoszenia...');

    (async () => {
      try {
        const result = await wyroznijOgloszenieAction(dzialkaId);

        if (result?.error) {
          setStatus('error');
          setMessage(result.error);
          return;
        }

        sessionStorage.setItem(storageKey, '1');
        setStatus('success');
        setMessage('Ogłoszenie zostało automatycznie wyróżnione.');

        setTimeout(() => {
          router.replace('/panel');
          router.refresh();
        }, 1200);
      } catch (e) {
        // Brak punktów (np. płatność jeszcze nie zaksięgowana): akcja robi redirect() do zakupu,
        // a przejście wykonuje już router. Bez tego mignąłby tu komunikat „NEXT_REDIRECT".
        if (e instanceof Error && e.message === 'NEXT_REDIRECT') {
          return;
        }

        // Treść nieoczekiwanego wyjątku na produkcji nie dociera (sam digest).
        setStatus('error');
        setMessage(
          'Zakup zakończył się sukcesem, ale nie udało się automatycznie wyróżnić ogłoszenia.'
        );
      }
    })();
  }, [dzialkaId, router]);

  if (status === 'idle') return null;

  return (
    <div
      className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
        status === 'success'
          ? 'border-brand/35 bg-brand/10 text-brand-text'
          : status === 'error'
          ? 'border-red-400/25 bg-red-500/10 text-red-200'
          : 'border-fg/10 bg-fg/[0.04] text-fg/80'
      }`}
    >
      {message}
    </div>
  );
}