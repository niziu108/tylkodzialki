import { describe, it, expect } from 'vitest';
import { publicznaOferta } from './publicznaOferta';

describe('publicznaOferta', () => {
  it('nie wypuszcza e-maili, tokenu ani liczników', () => {
    const d = publicznaOferta({
      id: 'x',
      tytul: 'Działka',
      telefon: '600 000 000',
      email: 'jan@example.com',
      editToken: 'abc',
      viewsCount: 10,
      detailViewsCount: 3,
      phoneClicksCount: 1,
      messageClicksCount: 0,
      owner: { email: 'biuro@example.com', defaultBiuroNazwa: 'Biuro' },
    });
    expect(d).toEqual({ id: 'x', tytul: 'Działka', telefon: '600 000 000', owner: { defaultBiuroNazwa: 'Biuro' } });
  });
});
