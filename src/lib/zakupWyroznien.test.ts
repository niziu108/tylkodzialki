import { describe, expect, it } from 'vitest';
import { ocenPowrotZeStripe, zakupWyroznienZSesji } from './zakupWyroznien';

// Metadane jak z app/api/stripe/checkout-featured (wszystkie wartości to napisy).
const METADANE = {
  type: 'featured',
  userId: 'user_1',
  featuredCredits: '3',
  dzialkaId: 'dzialka_1',
  buyerType: 'private',
};

function sesja(
  zmiany: {
    metadata?: Record<string, string> | null;
    status?: 'open' | 'complete' | 'expired' | null;
    payment_status?: 'paid' | 'unpaid' | 'no_payment_required';
  } = {}
) {
  return {
    metadata: METADANE,
    status: 'complete' as const,
    payment_status: 'paid' as const,
    ...zmiany,
  };
}

describe('zakupWyroznienZSesji', () => {
  it('czyta konto, liczbę punktów i ofertę z metadanych', () => {
    expect(zakupWyroznienZSesji(sesja())).toEqual({
      userId: 'user_1',
      liczba: 3,
      dzialkaId: 'dzialka_1',
    });
  });

  it('zakup bez oferty (przycisk „Kup wyróżnienie" w panelu) nie ma dzialkaId', () => {
    expect(zakupWyroznienZSesji(sesja({ metadata: { ...METADANE, dzialkaId: '' } }))?.dzialkaId).toBeNull();
    expect(zakupWyroznienZSesji(sesja({ metadata: { ...METADANE, dzialkaId: '  ' } }))?.dzialkaId).toBeNull();
  });

  it('pakiet publikacji (bez type=featured) to nie zakup wyróżnień, choć niesie punkty', () => {
    const pakiet = { orderId: 'o_1', userId: 'user_1', credits: '10', featuredCredits: '1' };
    expect(zakupWyroznienZSesji(sesja({ metadata: pakiet }))).toBeNull();
  });

  it('bez konta albo bez dodatniej, całkowitej liczby punktów nie ma czego księgować', () => {
    expect(zakupWyroznienZSesji(sesja({ metadata: { ...METADANE, userId: '' } }))).toBeNull();
    for (const featuredCredits of ['0', '-1', '1.5', 'abc', '']) {
      expect(zakupWyroznienZSesji(sesja({ metadata: { ...METADANE, featuredCredits } }))).toBeNull();
    }
    expect(zakupWyroznienZSesji(sesja({ metadata: null }))).toBeNull();
  });
});

describe('ocenPowrotZeStripe', () => {
  it('opłacona sesja własnego zakupu: można księgować', () => {
    expect(ocenPowrotZeStripe(sesja(), 'user_1')).toEqual({
      stan: 'oplacona',
      zakup: { userId: 'user_1', liczba: 3, dzialkaId: 'dzialka_1' },
    });
  });

  it('otwarta sesja (checkout założony, niezapłacony) nie daje punktów', () => {
    expect(ocenPowrotZeStripe(sesja({ status: 'open', payment_status: 'unpaid' }), 'user_1')).toEqual({
      stan: 'odrzucona',
      powod: 'nieoplacona',
    });
  });

  it('wygasła sesja nie daje punktów', () => {
    expect(ocenPowrotZeStripe(sesja({ status: 'expired', payment_status: 'unpaid' }), 'user_1')).toEqual({
      stan: 'odrzucona',
      powod: 'nieoplacona',
    });
  });

  it('cudza sesja jest odrzucona, nawet opłacona', () => {
    expect(ocenPowrotZeStripe(sesja(), 'user_2')).toEqual({ stan: 'odrzucona', powod: 'obca' });
  });

  it('sesja pakietu publikacji to nie zakup wyróżnień', () => {
    const pakiet = { orderId: 'o_1', userId: 'user_1', credits: '10', featuredCredits: '1' };
    expect(ocenPowrotZeStripe(sesja({ metadata: pakiet }), 'user_1')).toEqual({
      stan: 'odrzucona',
      powod: 'obca',
    });
  });

  it('zamknięta sesja bez potwierdzonej płatności czeka (punkty dopisze webhook)', () => {
    expect(ocenPowrotZeStripe(sesja({ payment_status: 'unpaid' }), 'user_1')).toEqual({ stan: 'w-toku' });
    expect(ocenPowrotZeStripe(sesja({ payment_status: 'no_payment_required' }), 'user_1')).toEqual({
      stan: 'w-toku',
    });
  });
});
