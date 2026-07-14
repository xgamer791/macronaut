import { Nutrition } from '@/domain/types';
import { foodHttp, HttpClientError } from './httpClient';
import { FoodProvider, ProviderError, ProviderFood, SearchOptions } from './types';

const BASE = 'https://trackapi.nutritionix.com';

/** Well-known US restaurant brand names → treat as restaurant category. */
const RESTAURANT_BRANDS = [
  "mcdonald's",
  'mcdonalds',
  'chipotle',
  'starbucks',
  'subway',
  "chick-fil-a",
  'chickfila',
  'taco bell',
  'tacobell',
  "wendy’s",
  'wendys',
  'burger king',
  'panera',
  "domino's",
  'dominos',
  'pizza hut',
  "papa john's",
  'kfc',
  'popeyes',
  'five guys',
  'in-n-out',
  'shake shack',
  'dunkin',
  "arby's",
  'sonic',
  'whataburger',
  "carl's jr",
  'jack in the box',
  'panda express',
  'olive garden',
  "applebee's",
  "chili's",
  'outback',
  'ihop',
  "denny's",
];

export function isConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_NUTRITIONIX_APP_ID?.trim() &&
      process.env.EXPO_PUBLIC_NUTRITIONIX_APP_KEY?.trim(),
  );
}

function authHeaders(): Record<string, string> {
  return {
    'x-app-id': process.env.EXPO_PUBLIC_NUTRITIONIX_APP_ID!.trim(),
    'x-app-key': process.env.EXPO_PUBLIC_NUTRITIONIX_APP_KEY!.trim(),
    'Content-Type': 'application/json',
  };
}

function isRestaurantBrand(brand?: string): boolean {
  if (!brand) return false;
  const b = brand.toLowerCase().trim();
  return RESTAURANT_BRANDS.some((r) => b === r || b.includes(r) || r.includes(b));
}

interface NixFood {
  food_name?: string;
  brand_name?: string;
  nix_item_id?: string;
  nix_item_name?: string;
  nix_brand_name?: string;
  tag_id?: string | number;
  tag_name?: string;
  upc?: string;
  serving_qty?: number;
  serving_unit?: string;
  serving_weight_grams?: number;
  nf_calories?: number;
  nf_protein?: number;
  nf_total_carbohydrate?: number;
  nf_total_fat?: number;
  nf_saturated_fat?: number;
  nf_dietary_fiber?: number;
  nf_sugars?: number;
  nf_sodium?: number;
  nf_cholesterol?: number;
  nf_ingredient_statement?: string;
  photo?: { thumb?: string; highres?: string };
}

interface InstantHit {
  food_name?: string;
  brand_name?: string;
  nix_item_id?: string;
  tag_id?: string | number;
  tag_name?: string;
  photo?: { thumb?: string };
  serving_unit?: string;
  serving_qty?: number;
}

function nutritionFrom(item: NixFood): Nutrition | undefined {
  if (item.nf_calories === undefined || item.nf_calories === null) return undefined;
  const n: Nutrition = { calories: item.nf_calories };
  if (item.nf_protein != null) n.protein = item.nf_protein;
  if (item.nf_total_carbohydrate != null) n.carbs = item.nf_total_carbohydrate;
  if (item.nf_total_fat != null) n.fat = item.nf_total_fat;
  if (item.nf_saturated_fat != null) n.saturatedFat = item.nf_saturated_fat;
  if (item.nf_dietary_fiber != null) n.fiber = item.nf_dietary_fiber;
  if (item.nf_sugars != null) n.sugar = item.nf_sugars;
  if (item.nf_sodium != null) n.sodium = item.nf_sodium;
  if (item.nf_cholesterol != null) n.cholesterol = item.nf_cholesterol;
  return n;
}

function toProviderFood(item: NixFood, opts: { common?: boolean } = {}): ProviderFood | null {
  const name = (item.nix_item_name || item.food_name || '').trim();
  if (!name) return null;
  const nutrition = nutritionFrom(item);
  if (!nutrition) return null;
  const brand = item.nix_brand_name || item.brand_name || undefined;
  const restaurant = isRestaurantBrand(brand) ? brand : undefined;
  const id =
    item.nix_item_id ||
    (item.tag_id != null ? `tag:${item.tag_id}` : undefined) ||
    item.upc ||
    name.toLowerCase().replace(/\s+/g, '-');
  const ingredients = item.nf_ingredient_statement
    ? item.nf_ingredient_statement.split(/,\s*/).map((s) => s.trim()).filter(Boolean)
    : undefined;
  return {
    provider: 'nutritionix',
    id: String(id),
    name,
    brand: restaurant ? undefined : brand,
    restaurant,
    barcode: item.upc || undefined,
    imageUrl: item.photo?.highres || item.photo?.thumb || undefined,
    isGeneric: Boolean(opts.common) && !brand,
    nutritionPerServing: nutrition,
    gramsPerServing: item.serving_weight_grams || undefined,
    servingLabel:
      item.serving_qty && item.serving_unit
        ? `${item.serving_qty} ${item.serving_unit}`
        : item.serving_unit,
    servingUnit: item.serving_unit,
    ingredients,
    category: restaurant ? 'restaurant' : opts.common && !brand ? 'generic' : 'packaged',
  };
}

async function requestJson<T>(
  url: string,
  init: { method?: string; body?: string; signal?: AbortSignal },
): Promise<T> {
  try {
    return await foodHttp.requestJson<T>(url, {
      method: init.method ?? 'GET',
      headers: authHeaders(),
      body: init.body,
      signal: init.signal,
    });
  } catch (err) {
    if (err instanceof HttpClientError) {
      if (err.kind === 'abort') throw err;
      if (err.kind === 'rate-limit') {
        throw new ProviderError('Nutritionix rate limit', 'nutritionix', 'rate-limit');
      }
      if (err.status === 401 || err.status === 403) {
        throw new ProviderError('Nutritionix auth failed', 'nutritionix', 'auth');
      }
      throw new ProviderError(
        `Nutritionix error ${err.status ?? ''}`.trim(),
        'nutritionix',
        'bad-response',
      );
    }
    if ((err as Error).name === 'AbortError') throw err;
    throw new ProviderError('Network request failed', 'nutritionix', 'network');
  }
}

async function fetchItemByNixId(nixItemId: string, signal?: AbortSignal): Promise<ProviderFood | null> {
  const url = `${BASE}/v2/search/item?nix_item_id=${encodeURIComponent(nixItemId)}`;
  const json = await requestJson<{ foods?: NixFood[] }>(url, { signal });
  const item = json.foods?.[0];
  return item ? toProviderFood(item) : null;
}

async function fetchNaturalNutrients(query: string, signal?: AbortSignal): Promise<ProviderFood[]> {
  const json = await requestJson<{ foods?: NixFood[] }>(`${BASE}/v2/natural/nutrients`, {
    method: 'POST',
    body: JSON.stringify({ query }),
    signal,
  });
  return (json.foods ?? [])
    .map((f) => toProviderFood(f, { common: true }))
    .filter((f): f is ProviderFood => f !== null);
}

export const nutritionixProvider: FoodProvider & { isConfigured: typeof isConfigured } = {
  id: 'nutritionix',
  isConfigured,

  async search(query, opts: SearchOptions = {}) {
    if (!isConfigured()) return [];
    if (opts.filter === 'generic') {
      // Common foods via natural language for generic-intent searches.
      try {
        return (await fetchNaturalNutrients(query, opts.signal)).slice(0, opts.limit ?? 15);
      } catch {
        return [];
      }
    }

    const json = await requestJson<{ branded?: InstantHit[]; common?: InstantHit[] }>(
      `${BASE}/v2/search/instant`,
      {
        method: 'POST',
        body: JSON.stringify({ query, detailed: true }),
        signal: opts.signal,
      },
    );

    const out: ProviderFood[] = [];
    const limit = opts.limit ?? 25;

    // Branded: resolve a handful via /search/item for full nutrition.
    const branded = (json.branded ?? []).slice(0, Math.min(8, limit));
    for (const hit of branded) {
      if (!hit.nix_item_id) continue;
      try {
        const full = await fetchItemByNixId(hit.nix_item_id, opts.signal);
        if (full) out.push(full);
      } catch {
        // Skip individual item failures; keep searching.
      }
      if (out.length >= limit) break;
    }

    if (opts.filter !== 'branded' && out.length < limit) {
      const commons = (json.common ?? []).slice(0, 5);
      if (commons.length > 0) {
        const names = commons.map((c) => c.food_name).filter(Boolean).join(', ');
        if (names) {
          try {
            const natural = await fetchNaturalNutrients(names, opts.signal);
            for (const f of natural) {
              if (out.length >= limit) break;
              out.push(f);
            }
          } catch {
            // Instant common hits without nutrients aren't useful alone.
          }
        }
      }
    }

    return out;
  },

  async getByBarcode(code, signal) {
    if (!isConfigured()) return null;
    try {
      const url = `${BASE}/v2/search/item?upc=${encodeURIComponent(code)}`;
      const json = await requestJson<{ foods?: NixFood[] }>(url, { signal });
      const item = json.foods?.[0];
      return item ? toProviderFood(item) : null;
    } catch (err) {
      if (err instanceof ProviderError && err.kind === 'bad-response') return null;
      throw err;
    }
  },
};
