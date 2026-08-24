import { describe, expect, it } from 'vitest';
import { isBotUserAgent } from './isBotRequest';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('isBotUserAgent', () => {
  it('przepuszcza prawdziwe przeglądarki', () => {
    expect(isBotUserAgent(CHROME)).toBe(false);
    expect(isBotUserAgent(IPHONE)).toBe(false);
  });

  it('odsiewa Googlebota, który renderuje JS i podbijał liczniki', () => {
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      )
    ).toBe(true);
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      )
    ).toBe(true);
  });

  it('odsiewa skanery SEO, AI i skrypty', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
      'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1',
      'python-requests/2.31.0',
      'curl/8.4.0',
      'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0',
    ]) {
      expect(isBotUserAgent(ua), ua).toBe(true);
    }
  });

  it('traktuje brak User-Agent jak skrypt', () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent('')).toBe(true);
  });
});
