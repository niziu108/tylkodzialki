import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';
import { proxy } from './proxy';

const SEKRET = 'sekret-testowy';

function zapytanie(sciezka: string, opcje: { method?: string; token?: string } = {}) {
  const headers = new Headers();
  if (opcje.token) headers.set('cookie', `next-auth.session-token=${opcje.token}`);
  return proxy(
    new NextRequest(`http://localhost:3000${sciezka}`, { method: opcje.method ?? 'GET', headers })
  );
}

describe('proxy: bramka logowania /panel i /admin', () => {
  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', SEKRET);
    vi.stubEnv('NEXTAUTH_URL', undefined); // ciasteczko bez prefiksu __Secure-, jak na localhost
    vi.stubEnv('VERCEL', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bez sesji odsyła na logowanie z callbackUrl', async () => {
    const res = await zapytanie('/panel');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/logowanie?callbackUrl=%2Fpanel');
  });

  it('callbackUrl niesie ścieżkę z query, a /logowanie nie dostaje parametrów strony', async () => {
    const res = await zapytanie('/panel/pakiety/sukces?session_id=cs_test_1&x=1');
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/logowanie?callbackUrl=%2Fpanel%2Fpakiety%2Fsukces%3Fsession_id%3Dcs_test_1%26x%3D1'
    );
  });

  it('ważna sesja przechodzi dalej, także do /admin (rolę sprawdza strona)', async () => {
    const token = await encode({ token: { email: 'test@example.com' }, secret: SEKRET });
    for (const sciezka of ['/panel', '/admin/crm']) {
      const res = await zapytanie(sciezka, { token });
      expect(res.headers.get('x-middleware-next'), sciezka).toBe('1');
    }
  });

  it('śmieci albo token z innym sekretem to brak sesji', async () => {
    const obcy = await encode({ token: { email: 'test@example.com' }, secret: 'inny-sekret' });
    for (const token of ['smieci', obcy]) {
      const res = await zapytanie('/panel', { token });
      expect(res.status).toBe(307);
    }
  });

  it('POST akcji serwerowej idzie dalej bez przekierowania (sesję sprawdza akcja)', async () => {
    const res = await zapytanie('/panel', { method: 'POST' });
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
});
