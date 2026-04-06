export const COOKIE_CONSENT_NAME = 'td_cookie_consent';
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 rok

export type CookieConsentValue = 'accepted' | 'rejected';

export function setCookieConsent(value: CookieConsentValue) {
  if (typeof document === 'undefined') return;

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';

  document.cookie = [
    `${COOKIE_CONSENT_NAME}=${value}`,
    'Path=/',
    `Max-Age=${COOKIE_CONSENT_MAX_AGE}`,
    'SameSite=Lax',
    secure,
  ].join('; ');
}

export function getCookieConsent(): CookieConsentValue | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split('; ').filter(Boolean);
  const match = cookies.find((row) =>
    row.startsWith(`${COOKIE_CONSENT_NAME}=`)
  );

  if (!match) return null;

  const value = match.split('=')[1];

  if (value === 'accepted' || value === 'rejected') {
    return value;
  }

  return null;
}