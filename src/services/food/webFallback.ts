/** WebFoodLookupService — the honest fallback for when every structured
 * database (bundled generics, USDA, Open Food Facts) fails to return a
 * usable result. A client-only app on static hosting can't scrape arbitrary
 * sites (CORS) or run an extractor, and fabricating nutrition would be worse
 * than nothing. So this builds a targeted, high-quality web search the user
 * opens in their browser — prioritizing the exact barcode/brand/product and
 * "nutrition facts", biased toward official and reputable sources — then the
 * user creates a verified custom food from what they read on the label.
 *
 * The interface is intentionally swappable: a future backend can implement
 * `lookup()` to fetch + extract server-side without changing callers. */

export interface WebFoodResult {
  name?: string;
  brand?: string;
  imageUrl?: string;
  sourceUrl: string;
  retrievedAt: string;
}

export interface WebFoodLookupService {
  /** A curated web-search URL for the user to open. */
  searchUrl(input: { barcode?: string; name?: string; brand?: string }): string;
  /** Structured extraction — only a real backend can do this honestly; the
   * client implementation returns null so the UI offers the manual path. */
  lookup(input: { barcode?: string; name?: string; brand?: string }): Promise<WebFoodResult | null>;
}

const PREFERRED = [
  'site:fatsecret.com',
  'site:nutritionix.com',
  'site:fdc.nal.usda.gov',
  'site:openfoodfacts.org',
].join(' OR ');

export const webFoodLookup: WebFoodLookupService = {
  searchUrl({ barcode, name, brand }) {
    const terms = [brand, name].filter(Boolean).join(' ');
    // Barcode-first when we have one; otherwise brand + product name.
    const q = barcode
      ? `${barcode} ${terms} nutrition facts`
      : `${terms} nutrition facts serving size (${PREFERRED})`;
    return `https://www.google.com/search?q=${encodeURIComponent(q.trim())}`;
  },

  async lookup() {
    // No trustworthy client-side extraction is possible; the UI opens
    // searchUrl() and lets the user enter verified label data instead.
    return null;
  },
};
