/** Strony serwisu, blog, huby SEO, powiaty, ceny i wizytówki. Oferty mają własne pliki. */

import { renderUrlset, xmlResponse } from '@/lib/sitemapy';
import { getPageSitemapEntries } from '@/lib/sitemapyStrony';

export const revalidate = 3600;

export async function GET() {
  return xmlResponse(renderUrlset(await getPageSitemapEntries()));
}
