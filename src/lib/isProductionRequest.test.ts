import { describe, expect, it } from 'vitest';
import { isProductionHost, isProductionRequest } from './isProductionRequest';

function trackRequest(host: string) {
  return new Request('https://tylkodzialki.pl/api/dzialki/abc/track-detail', {
    method: 'POST',
    headers: { host },
  });
}

describe('isProductionHost', () => {
  it('przepuszcza domenę główną i www', () => {
    expect(isProductionHost('tylkodzialki.pl')).toBe(true);
    expect(isProductionHost('www.tylkodzialki.pl')).toBe(true);
    expect(isProductionHost('WWW.TylkoDzialki.PL')).toBe(true);
  });

  it('odsiewa lokalny dev, podgląd Vercela i podszywające się domeny', () => {
    for (const host of [
      'localhost:3000',
      '127.0.0.1:3000',
      '192.168.0.12:3000', // telefon w tej samej sieci co dev
      'tylkodzialki-git-main-daniel.vercel.app',
      'dev.tylkodzialki.pl',
      'tylkodzialki.pl.example.com',
    ]) {
      expect(isProductionHost(host), host).toBe(false);
    }
  });

  it('traktuje brak Host jak nie-produkcję', () => {
    expect(isProductionHost(null)).toBe(false);
    expect(isProductionHost('')).toBe(false);
  });
});

describe('isProductionRequest', () => {
  it('liczy produkcyjny build na naszej domenie', () => {
    expect(isProductionRequest(trackRequest('tylkodzialki.pl'), 'production')).toBe(true);
  });

  it('nie liczy next dev, nawet z Host produkcji', () => {
    expect(isProductionRequest(trackRequest('tylkodzialki.pl'), 'development')).toBe(false);
  });

  it('nie liczy next start na localhost ani podglądu Vercela', () => {
    expect(isProductionRequest(trackRequest('localhost:3000'), 'production')).toBe(false);
    expect(
      isProductionRequest(trackRequest('tylkodzialki-abc123.vercel.app'), 'production')
    ).toBe(false);
  });
});
