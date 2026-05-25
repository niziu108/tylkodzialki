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
        await wyroznijOgloszenieAction(dzialkaId);

        sessionStorage.setItem(storageKey, '1');
        setStatus('success');
        setMessage('Ogłoszenie zostało automatycznie wyróżnione.');

        setTimeout(() => {
          router.replace('/panel');
          router.refresh();
        }, 1200);
      } catch (e: any) {
        setStatus('error');
        setMessage(
          e?.message || 'Zakup zakończył się sukcesem, ale nie udało się automatycznie wyróżnić ogłoszenia.'
        );
      }
    })();
  }, [dzialkaId, router]);

  if (status === 'idle') return null;

  return (
    <div
      className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
        status === 'success'
          ? 'border-[#7aa333]/35 bg-[#7aa333]/10 text-[#b6e35e]'
          : status === 'error'
          ? 'border-red-400/25 bg-red-500/10 text-red-200'
          : 'border-white/10 bg-white/[0.04] text-white/80'
      }`}
    >
      {message}
    </div>
  );
}