// Liczniki wyświetleń/wejść/kontaktów są odpalane z przeglądarki (useEffect + fetch). Problem:
// Googlebot i spółka RENDERUJĄ JavaScript, więc każde ich wejście na ofertę podbijało licznik
// tak samo jak wejście człowieka. Przy ~8 tys. zaindeksowanych stron to znaczy, że większość
// „wejść w ofertę" pochodziła od robotów, a biuro w panelu widziało zawyżone statystyki.
//
// Dlatego przed zapisem odsiewamy ruch nie-ludzki po User-Agent. Świadomie po stronie serwera
// (klient może nagłówek zataić, ale nam chodzi o uczciwe boty, które się przedstawiają) i
// świadomie konserwatywnie: lepiej nie doliczyć jednego człowieka niż policzyć stu robotów.

const BOT_PATTERNS = [
  // wyszukiwarki
  'googlebot', 'google-inspectiontool', 'storebot-google', 'adsbot', 'bingbot', 'bingpreview',
  'yandex', 'baiduspider', 'duckduckbot', 'slurp', 'seznambot', 'petalbot', 'applebot',
  // SEO / analityka
  'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'dataforseo', 'serpstatbot', 'screaming frog',
  'seokicks', 'blexbot', 'barkrowler', 'zoominfobot', 'siteauditbot', 'lighthouse',
  // AI / scrapery
  'gptbot', 'oai-searchbot', 'chatgpt-user', 'ccbot', 'claudebot', 'claude-web', 'anthropic-ai',
  'perplexitybot', 'bytespider', 'amazonbot', 'meta-externalagent', 'diffbot',
  // podglądy linków
  'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp', 'telegrambot', 'discordbot',
  'skypeuripreview', 'embedly', 'pinterest',
  // biblioteki i headless
  'headlesschrome', 'phantomjs', 'puppeteer', 'playwright', 'python-requests', 'python-urllib',
  'scrapy', 'node-fetch', 'axios/', 'go-http-client', 'java/', 'okhttp', 'curl/', 'wget/',
  'apache-httpclient', 'libwww-perl', 'httpx',
  // generyczne (na końcu, łapią resztę przedstawiającą się uczciwie)
  'bot/', 'bot;', 'bot)', ' bot ', 'crawler', 'spider', 'monitoring',
];

/** true = to nie jest człowiek z przeglądarki, więc nie liczymy tego do statystyk. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // brak UA = skrypt albo curl, nie przeglądarka
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some((p) => ua.includes(p));
}

/** Wygodna nakładka na Request z route handlera. */
export function isBotRequest(req: Request): boolean {
  return isBotUserAgent(req.headers.get('user-agent'));
}
