'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dokonczZakupWyroznieniaAction } from '../../app/panel/actions';
import type { ZakupWyroznieniaResult } from '../../app/panel/actions';

// Powrót ze Stripe po zakupie wyróżnienia (/panel?success=featured&session_id=...). Serwer
// sprawdza płatność u Stripe, księguje ją, jeśli webhook jeszcze nie zdążył, i wyróżnia ofertę
// wybraną przed zakupem. Płatność niepotwierdzona albo chwilowa awaria to „w-toku": pytamy
// jeszcze kilka razy, a na koniec uspokajamy zamiast odsyłać do zakupu.
const PROBY = 6;
const ODSTEP_MS = 2500;

type Stan = 'ksiegowanie' | 'wyrozniono' | 'zaksiegowano' | 'opoznienie' | 'blad';

const KOMUNIKATY: Record<Exclude<Stan, 'blad'>, string> = {
  ksiegowanie: 'Płatność jest księgowana…',
  wyrozniono: 'Płatność przyjęta. Ogłoszenie jest wyróżnione.',
  zaksiegowano:
    'Płatność przyjęta i zaksięgowana na Twoim koncie. Ogłoszenie wyróżnisz przyciskiem „Wyróżnij”.',
  opoznienie:
    'Płatność jest jeszcze księgowana. Odśwież stronę za kilka minut, nie musisz płacić ponownie.',
};

export default function AutoFeaturedAfterPurchase({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const hasRunRef = useRef(false);

  const [stan, setStan] = useState<Stan>('ksiegowanie');
  const [blad, setBlad] = useState('');

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    (async () => {
      for (let proba = 1; proba <= PROBY; proba++) {
        let wynik: ZakupWyroznieniaResult;

        try {
          wynik = await dokonczZakupWyroznieniaAction(sessionId);
        } catch {
          // Sieć albo nieoczekiwany błąd serwera (na produkcji bez treści). Akcja jest
          // bezpieczna do powtórzenia, więc traktujemy to jak „jeszcze księgujemy".
          wynik = { stan: 'w-toku' };
        }

        if ('error' in wynik) {
          setBlad(wynik.error);
          setStan('blad');
          return;
        }

        if (wynik.stan !== 'w-toku') {
          setStan(wynik.stan);
          // Świeże saldo i znaczek wyróżnienia na liście. Komunikat zostaje na miejscu.
          router.refresh();
          return;
        }

        if (proba < PROBY) {
          await new Promise((resolve) => setTimeout(resolve, ODSTEP_MS));
        }
      }

      setStan('opoznienie');
    })();
  }, [sessionId, router]);

  return (
    <div
      role="status"
      className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
        stan === 'wyrozniono' || stan === 'zaksiegowano'
          ? 'border-brand/35 bg-brand/10 text-brand-text'
          : stan === 'blad'
          ? 'border-red-500/25 bg-red-500/10 text-red-500'
          : 'border-fg/10 bg-fg/[0.04] text-fg/80'
      }`}
    >
      {stan === 'blad' ? blad : KOMUNIKATY[stan]}
    </div>
  );
}
